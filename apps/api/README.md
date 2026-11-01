# @windy/api

Nest 12 API for the webcams clone. Part of the repo described in
[`../../README.md`](../../README.md) — run commands from the repo root.

- `pnpm dev --filter @windy/api` — watch mode on <http://localhost:3000>
- `GET /health` — liveness payload
- `GET /docs` — Swagger UI (skipped when `NODE_ENV=production`), `GET /docs-json` — OpenAPI document
- Config: `src/config/configuration.ts` is the only reader of `process.env`; values are read through
  the typed `ConfigService`. Copy `.env.example` to `.env` to override `PORT` / `WEB_ORIGIN`.

## Layout

```
src/
  app.module.ts        ConfigModule (global) + feature modules
  config/              typed env mapping
  health/              health.module/controller/dto + unit spec
  main.ts              bootstrap: CORS, global ValidationPipe, Swagger, shutdown hooks
test/                  e2e specs (supertest)
```

Feature modules follow `src/<feature>/<feature>.{module,controller,service}.ts`. Anything touching the
database belongs behind a service, and DTOs are validated with `class-validator` — the global
`ValidationPipe` runs with `whitelist` and `forbidNonWhitelisted`, so unknown payload keys are a 400.
