# image-processor — Python image analysis service

**Status: scaffolded, not wired.** The uv project, the FastAPI app and `GET /health` exist and
test; there is no `/process` route and no pipeline yet, so nothing in the repo calls this service.

```sh
uv sync                                  # once, from this directory
uv run uvicorn app.main:app --reload     # http://127.0.0.1:8000/health
uv run pytest
uv run ruff check . && uv run ruff format .
```

The port is 8000, which is free because web owns 5173 and the API owns 3000.

Shape once the pipeline lands (WL-136/137/138):

```
apps/image-processor/
  app/          FastAPI app, routes, request/response models
  processors/   one module per step: preprocess, quality, classify, detect, count, describe
  pipelines/    named step lists that mirror the pipeline rows in Postgres
  models/       model loading and version metadata
  services/     storage (S3/MinIO) and inference plumbing
  tests/        pytest
  pyproject.toml
```

## Why it is a separate app in this repo

- OpenCV, YOLO and ONNX Runtime do not belong in the Nest process.
- Same repo, same review flow, same compose file — but its own runtime and its own scaling.
- It is **not** a pnpm workspace member. Turbo does not build it; compose runs it. `uv` owns the
  environment (`pyproject.toml`, `uv.lock`, `.python-version`), `ruff` owns lint and format, and the
  repo-level `oxlint`/`oxfmt` never touch it.

## Boundary

The Nest orchestrator (WL-143) posts a storage key plus a step list; this service returns one
structured result per step with confidence, duration and model metadata. No database access here,
no Redis here — it reads and writes object storage and nothing else.

Activated by: WL-137 (scaffold), WL-136 (contract), WL-135/138/139 (steps), WL-141 (container).
What each step should compute, what it costs on CPU and what is not worth building is decided in
[`docs/research/05-image-analysis.md`](../../docs/research/05-image-analysis.md).
