# @webcam-scrapper/api

Nest 12 API for the webcams clone: registry, read API, ingestion, **auth and Postgres**. Part of the
repo described in [`../../README.md`](../../README.md) — run commands from the repo root.

- `pnpm dev --filter @webcam-scrapper/api` — watch mode on <http://localhost:3000>
- `GET /health` — liveness payload (`@AllowAnonymous()`; every other route needs a session)
- `GET /api/webcams?q=&limit=&offset=` — locations with their camera count, `GET /api/webcams/:id`
  — one location with its cameras (`@AllowAnonymous()`; public read data, reached through the `/api/*`
  proxy of `apps/web`)
- `* /api/auth/**` — better-auth endpoints (sign-up, sign-in, sign-out, get-session, …)
- `GET /docs` — Swagger UI (skipped when `NODE_ENV=production`), `GET /docs-json` — OpenAPI document
- Config: `src/config/configuration.ts` is the only reader of `process.env`; values are read through
  the typed `ConfigService`. Copy `.env.example` to `.env` and fill `DATABASE_URL`,
  `BETTER_AUTH_SECRET` (32+ characters), `API_ORIGIN`, `WEB_ORIGIN`, `PORT`.

`pnpm db:start` / `db:push` / `auth:schema` at the repo root manage the schema in `packages/db`.

## Auth

`src/auth/auth.ts` builds the better-auth instance; `@thallesp/nestjs-better-auth` mounts it and
registers a global `AuthGuard`, so a route is protected by default — opt out per controller or
handler with `@AllowAnonymous()`. Because better-auth reads the raw body, `main.ts` starts Nest with
`bodyParser: false`; the module re-adds the parsers for other routes.

Sessions are cookies signed with `BETTER_AUTH_SECRET` and stored in Postgres. The SvelteKit app never
creates a session itself: it proxies `/api/*` here and reads `GET /api/auth/get-session`.

## Database

`@nestjs/drizzle` (registered in `app.module.ts`) owns one drizzle client and its pool; inject it with
the `DB` token from `src/db/db.ts`. The schema lives in `@webcam-scrapper/db` — including the
generated better-auth tables — so workers can share it later.

## Layout

```
src/
  app.module.ts        ConfigModule (global) + DrizzleModule + AuthModule + feature modules
  auth/                createAuth(): the better-auth instance
  config/              typed env mapping
  db/db.ts             `DB` injection token + `AppDatabase` type
  health/              health.module/controller/dto + unit spec
  webcams/             webcams.module/controller/service/dto + unit spec (public read API)
  main.ts              bootstrap: bodyParser off, CORS, global StandardSchemaValidationPipe, Swagger, shutdown hooks
test/                  e2e specs (supertest) + env defaults for them
```

Feature modules follow `src/<feature>/<feature>.{module,controller,service}.ts`. Anything touching the
database belongs behind a service. DTOs are **zod** schemas in `<feature>.dto.ts`: each schema is
also the type (`z.infer`), the Swagger response (`@ApiOkResponse({ standardSchema })`) and the
runtime validator, because `@Query`/`@Param`/`@Body` take `{ schema }` and the global
`StandardSchemaValidationPipe` validates whatever schema the parameter carries. No `class-validator`
decorators, no `@ApiProperty` duplication — `@nestjs/swagger` converts the zod schema itself.
