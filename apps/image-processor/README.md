# image-processor — Python image analysis service

**Status: skeleton.** Empty on purpose; nothing here runs yet.

High level shape once it starts (WL-137):

```
apps/image-processor/
  app/          FastAPI app, routes, request/response models
  processors/   one module per step: preprocess, quality, classify, detect, count, describe
  pipelines/    named step lists that mirror the pipeline rows in Postgres
  models/       model loading and version metadata
  services/     storage (S3/MinIO) and inference plumbing
  pyproject.toml
```

## Why it is a separate app in this repo

- OpenCV, YOLO and ONNX Runtime do not belong in the Nest process.
- Same repo, same review flow, same compose file — but its own runtime and its own scaling.
- It is **not** a pnpm workspace member. Turbo does not build it; compose runs it.

## Boundary

The Nest orchestrator (WL-143) posts a storage key plus a step list; this service returns one
structured result per step with confidence, duration and model metadata. No database access here,
no Redis here — it reads and writes object storage and nothing else.

Activated by: WL-137 (scaffold), WL-136 (contract), WL-135/138/139 (steps), WL-141 (container).
