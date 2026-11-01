# webcam-scrapper — architecture v1

Capture public webcams, store their frames, analyse those frames, and surface history, events and
analytics. This document is the decision record for v1: the stack is fixed by the monorepo that
already exists, so anything below that contradicts it is out of scope.

## 1. Locked stack

| Layer            | Choice                                                          | Why / constraint                                                |
| ---------------- | --------------------------------------------------------------- | --------------------------------------------------------------- |
| Monorepo         | Turborepo + pnpm 12                                             | already scaffolded; no npm/yarn/bun                              |
| Web              | SvelteKit 3, Svelte 5 runes, Tailwind 4, adapter-node, :5173     | already scaffolded                                               |
| API              | Nest 12, feature folders, Swagger, :3000                         | already scaffolded                                               |
| ORM              | **Drizzle ORM + drizzle-kit** on Postgres                        | already in `apps/web`; **no Prisma, no TypeORM**                 |
| Auth             | better-auth (sessions in Postgres)                               | already in `apps/web`; API verifies the same session             |
| Queues           | BullMQ + Redis                                                   | Postgres is the source of truth, Redis is disposable             |
| Images           | S3 / MinIO                                                       | never in Postgres, never in the repo                             |
| Image processing | Python FastAPI + OpenCV + YOLO/ONNX                              | called by a Nest orchestrator over HTTP                          |
| Realtime         | Nest WebSocket gateway (socket.io) → web                         | rooms per camera and per user                                    |
| Charts           | Apache ECharts                                                   | heavy time series, one library                                    |
| Polish           | oxlint + oxfmt, Vitest                                           | repo level; never eslint/prettier                                |

Deviations from the earlier sketch: Prisma → **Drizzle**; a separate `image-processor/` project →
`apps/image-processor` **inside the same monorepo**; one database client per app → **one shared
`packages/db`**.

## 2. Shape

```
                      SvelteKit (apps/web, :5173)
                        │  REST + WebSocket
                        ▼
   Nest API (apps/api, :3000) ───────────────► Postgres (Drizzle, packages/db)
     │  enqueue (BullMQ)                        ▲   ▲
     ▼                                          │   │ results, events, outbox
   Redis ──► workers, one codebase, several modes│   │
              ├─ scheduler   (claims due sources) │   │
              ├─ capture     (http / mjpeg / rtsp)│   │
              ├─ stream mgr  (persistent streams)─┤   │
              ├─ processing  (orchestrates Python)┘   │
              └─ maintenance (retention, rollups) ────┘
                        │ HTTP
                        ▼
              apps/image-processor (FastAPI + OpenCV + YOLO)
                        │ read/write
                        ▼
                     S3 / MinIO
```

Three seams, kept hard:

1. **The API never downloads or analyses an image.** It writes rows and enqueues jobs.
2. **Processing never talks to Redis.** The Nest orchestrator consumes jobs and calls Python.
3. **Nothing is only in Redis.** Every job has a row that can re-derive it.

## 3. Data model

Postgres, UUID keys, `jsonb` for step configs and results, `timestamptz` everywhere.

| Table                                        | Purpose                                                                        |
| -------------------------------------------- | ------------------------------------------------------------------------------ |
| `webcam`                                     | the logical camera: name, location, enabled, status, default pipeline          |
| `webcam_source`                              | the technical connection: `HTTP_IMAGE \| MJPEG \| RTSP`, url, encrypted creds, `capture_interval`, `config` |
| `scrape_schedules`                           | `next_run_at`, `last_run_at`, interval — what the scheduler claims             |
| `scrape_run`                                 | one attempt: status (`PENDING/RUNNING/SUCCESS/FAILED/TIMEOUT`), timings, error, retries |
| `image`                                      | one stored frame: `storage_key`, `thumbnail_key`, `checksum`, `perceptual_hash`, dimensions, `captured_at` |
| `pipeline` / `pipeline_step`                 | versioned, ordered processing steps with per-step config                       |
| `processing_run`                             | one image × one pipeline version: status, timings, error                       |
| `processing_step_run`                        | one step inside a run: model id, model version, duration, outcome              |
| `analysis_result`                            | structured step output: `result_type` + `result_data jsonb` + confidence        |
| `detected_event` / `event_observation`       | what happened over time, not just what is in a frame                            |
| `webcam_status_history`                      | online/offline/error over time                                                 |
| `outbox_events`                              | reliable publish: written in the same transaction as the result                |
| `users`, `session`, …                        | better-auth, generated                                                |

Rules that are easy to get wrong later:

- `scrape_run`, `image`, `processing_run` are **separate**. A scrape can fail without a frame; a
  frame can succeed and fail processing.
- `captured_at` is when the frame was taken, not when the job finished — charts depend on it.
- Results record the pipeline version, model id and model version, so old results stay explainable
  and a new pipeline can reprocess history.
- Events are first-class: `first_seen_at`, `last_seen_at`, `ended_at`, `status`, `dedupe_key`, plus
  observations. Ninety frames of the same jam are one event with ninety observations.

## 4. Queues

| Queue              | Owner         | Notes                                                        |
| ------------------ | ------------- | ------------------------------------------------------------ |
| `capture-http`     | capture worker| scheduled snapshot fetch, SSRF-guarded, checksummed          |
| `capture-stream`   | stream manager| frames sampled from MJPEG/RTSP connections                   |
| `image-preprocess` | processing    | validate, resize, thumbnail, quality gate                    |
| `image-analyze`    | processing    | classification, detection, counting (parallel steps)         |
| `image-ai`         | processing    | vision-language description — slow, budgeted, off by default |
| `event-detect`     | processing    | temporal rules over the newest results                       |
| `image-maintenance`| maintenance   | retention, rollups                                           |

- Payloads carry ids and storage keys, never bytes.
- Retries: exponential backoff with a cap, bounded attempts, job timeout below the stall interval.
- Concurrency is set per queue **and** per camera.
- Every handler is idempotent: `(source, checksum)` for frames, `(image, pipeline_version)` for runs.
- Reliable publish: **transactional outbox** → relay → Redis. A crash between commit and publish
  cannot lose a frame; a duplicate publish cannot duplicate work.
- Failures end in a DLQ with payload and error, replayable from the API.

## 5. Capture

`CaptureProvider` is the only place that knows a protocol:

```ts
interface CaptureProvider {
  testConnection(source: WebcamSource): Promise<CaptureTestResult>;
  capture(source: WebcamSource): Promise<CapturedFrame>;
  start?(source: WebcamSource): Promise<void>;
  stop?(sourceId: string): Promise<void>;
}
```

- **HTTP_IMAGE** — scheduled by `scrape_schedules`, never on a persistent connection.
- **MJPEG** — persistent multipart connection, keep the newest frame, reconnect with backoff.
- **RTSP** — one ffmpeg process per stream writing sampled frames, killed if it stalls.

Streams are not polled. A separate **stream manager** process owns live connections, enforces a
global connection cap, detects frozen feeds and restarts them. Store one frame per N seconds per
camera with a hard per-hour cap; never store every frame.

Hardening: treat camera URLs as untrusted (block private networks, cap response size, validate
redirects), encrypt credentials at rest, redact them from responses and logs, dedupe by SHA-256 and
keep a perceptual hash for near-duplicates.

## 6. Processing

The Nest orchestrator owns the run; Python owns pixels.

```
image-analyze ─► orchestrator ─► POST /process ─► FastAPI
                     │              { storage_key, steps[], previous_image_id }
                     │                     │
                     └── persist ◄─────────┘ { results: [{ type, data, confidence, model }] }
```

- Steps are small and pure: preprocess, quality gate, classify, detect, count, describe.
- A failed AI step must not discard a successful detection — steps fail independently.
- Same image may be processed again by a new pipeline version; results are additive, history is
  never rewritten.
- Deterministic CV (YOLO/OpenCV) and the vision-language step live in **different queues**; the UI
  can show boxes long before the sentence arrives.

## 7. API and realtime

REST for commands and queries, WebSocket for nudges.

```
POST   /webcams                 GET /webcams/:id/images?from&to&class&cursor
GET    /webcams                 GET /images/:id            GET /images/:id/analysis
GET    /webcams/:id             GET /webcams/:id/events    GET /webcams/:id/analytics
PATCH  /webcams/:id             POST /webcams/:id/capture
GET    /webcams/:id/sources     POST /webcams/:id/probe
GET    /pipelines               POST /pipelines            POST /pipelines/:id/publish
GET    /events                  GET /analytics/overview     GET /system/queues
```

Realtime events, published from the outbox relay: `webcam.image_captured`,
`webcam.processing_completed`, `webcam.event_detected`, `webcam.status_changed`,
`system.queue_updated`. Rooms: `webcam:{id}`, `user:{id}`. The socket authenticates with the same
session guard as REST.

## 8. Repo layout

```
apps/
  web/                SvelteKit UI (existing)
  api/                Nest API + worker process modes (existing)
  image-processor/    FastAPI + OpenCV + YOLO            (new, README only)
packages/
  db/                 drizzle schema, client, migrations (new, README only — from apps/web)
  contracts/          zod DTOs, socket events, BullMQ payloads (new, README only)
compose.yaml          postgres + redis + minio + services (not created yet, see WL-92)
docs/                 research + this file
```

What exists right now: `apps/image-processor/`, `packages/db/` and `packages/contracts/` are
**high level folders with a README each** stating what goes in them and which issue fills them.
Nothing is wired into pnpm workspaces, turbo or compose yet, so `pnpm install`, `build`, `check`
and `test` behave exactly as before. Deep subfolders and `compose.yaml` are created by the issue
that needs them, not in advance.

Process modes from `apps/api`: `start:api`, `start:scheduler`, `start:capture`, `start:processing`,
`start:stream`. Scale each independently; the processor is the CPU/GPU-shaped one, capture is
network-shaped.

## 9. Roadmap → board

| Phase | Theme                                            | Epic    |
| ----- | ------------------------------------------------ | ------- |
| 1     | Foundation: packages, config, compose, migrations | WL-1    |
| 2     | Camera management UI: add, probe, maintain        | WL-59   |
| 3a    | Source adapters and catalogue import              | WL-60   |
| 3b    | Capture pollers and frame storage                 | WL-2    |
| 4     | Jobs, scheduler, outbox                           | WL-84   |
| 5     | Image processing service (Python)                 | WL-85   |
| 6     | Read API and realtime                             | WL-3    |
| 7     | History and analysis UI                           | WL-5    |
| 8     | RTSP and MJPEG streams                            | WL-86   |
| 9     | Events and temporal detection                     | WL-87   |
| 10    | AI scene descriptions                             | WL-88   |
| 11    | Pipelines and analytics                           | WL-89   |
| 12    | Hardening: tests, retention, observability, deploy| WL-7    |

Build order: static image capture end to end first (phases 1–6), because it exercises every seam
with the least infrastructure. Streams (8) come after the pipeline is proven on snapshots.

## 10. Numbers worth remembering

At 500 cameras and a 60 s interval that is **720,000 frames/day**. At 200 KB each that is
~144 GB/day, ~4.3 TB/month before dedupe and sampling. Hence: sampling policy, retention from day
one (originals 7–30 days, thumbnails 30–90, analysis and events kept long), and cheap deterministic
CV gating the expensive VLM step.

## 11. TBD — decisions not yet made

Nothing below is settled. Each row is tracked as a Research issue labelled `tbd`, and closes when the
answer is written into this section with its reason. Anything not listed here is decided.

| # | Question | Options | What it blocks | Issue |
| - | -------- | ------- | -------------- | ----- |
| 1 | Does SvelteKit query Postgres, or only the API? | (a) web keeps drizzle for better-auth tables only, domain tables via API — recommended; (b) everything behind the API, auth moves into Nest; (c) web keeps full DB access | shape of `packages/db`, whether the session guard (WL-94) is enough | WL-144 |
| 2 | Production object storage | managed S3 / self-hosted MinIO / Cloudflare R2 — MinIO is the local answer regardless | storage adapter surface (WL-18), env contract (WL-93) | WL-145 |
| 3 | Single user, team, or multi-tenant organizations? | (a) single-user tool; (b) shared workspace, everyone sees every camera; (c) organizations with isolated cameras and pipelines | `organization_id` on every domain table — expensive to add after data exists; WL-72 | WL-146 |
| 4 | Model stack | Ultralytics YOLO (fast start, AGPL-3.0) / ONNX Runtime (permissive, more plumbing) / both behind a `Detector` interface | detection step (WL-138), model versions, licence note | WL-147 |
| 5 | CPU-only inference for v1, or GPU from the start | CPU absorbs 0.5–4 frames/s at low resolution; GPU buys latency and bigger models | compose shape (WL-141), worker concurrency (WL-131), cost model (WL-126) | WL-148 |
| 6 | Which stream sources are legal, and the per-source policy | explicit reuse permission only / curated allowlist / general support with attribution | MJPEG and RTSP providers (WL-108, WL-112), credential policy (WL-110) | WL-149 |
| 7 | Pipeline editor shape | predefined pipeline types with editable step parameters — recommended / node graph | `pipeline_steps` JSONB shape (WL-117), editor UI (WL-123) | WL-150 |
| 8 | Analytics store | Postgres hourly/daily rollups — recommended / TimescaleDB or a column store later | rollup tables (WL-120), analytics page (WL-124) | WL-151 |
| 9 | Retention defaults and enforcement | originals 7–30 days, thumbnails 30–90, analysis and events kept long; per camera or global; does deleting an original keep its rollups | retention job (WL-21), sampling policy (WL-100) | WL-152 |

Decided, so not TBD: Drizzle over Prisma, event-first data model, outbox over direct publish, one
monorepo with independently scalable process modes, streams after static capture, thumbnails and
originals in object storage and never in Postgres.
