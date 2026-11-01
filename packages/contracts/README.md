# @windy/contracts — DTOs, socket events and job payloads

**Status: skeleton.** Nothing is published from here yet; both apps still define their own shapes.

One source of truth for the three surfaces that cross process boundaries:

| Directory       | Contents                                                                 |
| --------------- | ------------------------------------------------------------------------ |
| `src/dto/`      | zod schemas for REST request/response bodies, plus their inferred types  |
| `src/events/`   | WebSocket event names and payloads (`webcam.image_captured`, `system.queue_updated`, …) |
| `src/queues/`   | BullMQ queue names and payload types (`CaptureJob`, `ImageProcessingJob`, `AiAnalysisJob`) |

## Rules

- Queue payloads carry **ids and storage keys only** — never image bytes, never credentials.
- Every payload is versioned in its shape, not in its name: add fields, do not rename them.
- zod is the source; `apps/api` validates with it, `apps/web` types with it, and the Python
  processor's Pydantic models mirror it (generated, not hand-copied) — see WL-136.
- Import as `@windy/contracts/queues` etc., with `.js` extensions inside `apps/api`.

Activated by: WL-91 (create the package), WL-136 (Python processing contract).
