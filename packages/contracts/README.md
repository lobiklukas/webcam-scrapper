# @webcam-scrapper/contracts — DTOs, socket events and job payloads

One source of truth for the three surfaces that cross process boundaries. `apps/api` validates with
these schemas, `apps/web` types with them, and `packages/api-client` is generated from the OpenAPI
document that `apps/api` derives from them.

| Directory     | Contents                                                                  |
| ------------- | ------------------------------------------------------------------------- |
| `src/dto/`    | zod schemas for REST request/response bodies, plus their inferred types   |
| `src/events/` | (planned) WebSocket event names and payloads (`webcam.image_captured`, …) |
| `src/queues/` | (planned) BullMQ queue names and payload types (`CaptureJob`, …)          |

`openapi.json` is a **generated** artefact, not hand-written: `pnpm gen:api` from the repo root writes
it here and then regenerates `packages/api-client` from it.

## Using a DTO

```ts
// apps/api: validation + Swagger, both from the same object
import { listWebcamsQueryDto, webcamDto } from '@webcam-scrapper/contracts/dto';

// anywhere: the type, no runtime cost
import type { WebcamDto } from '@webcam-scrapper/contracts/dto';
```

A DTO is a zod schema and its type at once (`export const webcamDto = …; export type WebcamDto =
z.infer<typeof webcamDto>`). The API passes it to `@Query({ schema })` / `@ApiOkResponse({ standardSchema })`,
so a new field means one edit, not three.

## Building

This is a built package like `packages/db`: `types` point at `src/`, runtime `exports` at `dist/`, so
`apps/api` needs `pnpm build` (turbo runs `^build`) before it starts. `apps/web` consumes the types
through Vite, which reads the same sources.

## Rules

- Queue payloads carry **ids and storage keys only** — never image bytes, never credentials.
- Every payload is versioned in its shape, not in its name: add fields, do not rename them.
- zod is the source; the Python processor's Pydantic models mirror it (generated, not hand-copied).
- Import as `@webcam-scrapper/contracts/dto` (and later `./queues`), with `.js` extensions inside
  `apps/api`.
