# AGENTS.md

Monorepo for a "Windy webcams" clone: a Turborepo + pnpm workspace with a SvelteKit front end and a
Nest API. Read this before changing anything.

## Repo map

| Path                   | What it is                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------ |
| `apps/web`             | SvelteKit 3 app (Svelte 5, Tailwind 4, adapter-node). No DB, no auth of its own                  |
| `apps/api`             | Nest 12 app (health, config, Swagger, better-auth, drizzle client, Postgres)                     |
| `apps/worker`          | scrape worker: plain Node + tsx, no Nest; claims due cams, stores frames, publishes to RabbitMQ  |
| `apps/image-processor` | Python FastAPI service (uv, ruff): image analysis, scaffolded with `GET /health` only, port 8000 |
| `packages/db`          | drizzle schema (incl. generated better-auth tables), client factory, migrations                  |
| `packages/contracts`   | zod DTOs shared by api and web + the generated `openapi.json`                                    |
| `packages/api-client`  | generated fetch client, SDK and TanStack Query options for the web app                           |
| `scripts`              | one-off `.ts` tooling run with `tsx` (no build); `seed` upserts into Postgres                    |
| `docs/research`        | Product research: Windy teardown, camera sources, management flows, ingestion                    |

## Commands (always from the repo root)

```sh
pnpm dev         # turbo: web :5173, api :3000, and the scrape worker (hot reload)
pnpm lint        # oxlint + type-aware oxlint over apps/api and apps/worker
pnpm fmt         # oxfmt --write          (pnpm fmt:check for CI)
pnpm check       # svelte-check + tsc --noEmit via turbo
pnpm test        # vitest in both apps
pnpm build       # nest build + vite build (adapter-node)
pnpm db:start    # docker compose up: Postgres 5432, object storage 9000/9001, RabbitMQ 5672/15672
pnpm worker      # turbo, scrape worker (apps/worker, hot reload via tsx)
pnpm bucket:create  # create the S3 bucket once after `pnpm db:start`
pnpm db:push     # apply packages/db schema (db:generate / db:migrate for SQL)
pnpm auth:schema # regenerate packages/db/src/schema/auth.ts, then run pnpm fmt
pnpm seed        # upsert the Digitraffic catalogue into location/cam (needs DATABASE_URL)
pnpm gen:api     # export openapi.json from apps/api, then regenerate packages/api-client
```

Never add `eslint`, `prettier`, `npm install`, or `bun` instructions: linting/formatting is
**oxlint + oxfmt** and the package manager is **pnpm 12**.

## Non-obvious constraints

- **`apps/worker` is not Nest and owns the frame writes.** It reads `cam`, claims due rows
  (`next_poll_at <= now()` with `FOR UPDATE SKIP LOCKED`), and is the only writer of `frame`,
  `poll_attempt` and the poll columns of `cam`. `apps/api` reads those tables and never writes
  them. It has its own `src/config.ts` (the only `process.env` reader in that app) because it runs
  without a Nest container. `pnpm dev` starts it next to web and api; `pnpm worker` runs only it.
  `SCRAPE_ENABLED=false` in `apps/worker/.env` keeps it running without polling, which is the sane
  default when the seeded catalogue is due (`pnpm dev` otherwise polls a few cams per second).
- **Local object storage is `rustfs` (S3-compatible), not MinIO.** The `minio/minio` images are not
  pullable in this environment; the worker only speaks S3, so switching back is a `S3_*` change.
  The bucket is created by `pnpm bucket:create`, not by the worker at boot.
- **`apps/api` reads frame bytes out of object storage, it never writes them.**
  `GET /api/frames/:id` looks the frame row up in Postgres and streams the object the worker stored,
  so the browser never learns the storage host or the bucket layout. Both apps read the same `S3_*`
  variables (config: `apps/api/src/config/configuration.ts`, `apps/worker/src/config.ts`); the API
  only needs storage reachable once someone asks for a frame.
- **Drizzle relations live in `packages/db/src/schema/relations.ts`**, not next to the tables —
  `webcams.ts` and `frames.ts` already import each other, so a `relations()` call there would read a
  table before it is defined. Listing endpoints use `db.query.<table>…` with `with:` instead of
  hand-written joins, with one caveat: inside a relational query drizzle rewrites _every_ column
  reference to the current relation's alias, so `${otherTable.column}` in `extras`/`orderBy` renders
  the wrong table. Correlate through a second query (see `WebcamsService.countCams`) instead.
- **Turbo passes the worker's runtime env through `globalPassThroughEnv`**, and both `dev` and
  `worker` `dependsOn: ["^build"]` so `packages/db` has a `dist` before either starts. Without that
  dependency the worker's first import races the db build.
- **The broker is RabbitMQ, and producers only declare the exchange.** `frames` is a durable topic
  exchange; the worker publishes `frame.stored` with a persistent, confirmed message. A consumer
  owns its own queue + binding, so no queue exists until the processing consumer lands.
- **`apps/web` targets Node** via `@sveltejs/adapter-node`: `build` is `vite build`, `start` is
  `node --env-file-if-exists=.env build` (the env file is what supplies `PORT`, `API_URL`, `ORIGIN`
  in production). Do not reintroduce `bun --bun` or an adapter that needs another runtime.
- **`apps/web` has no database access and no auth code.** Postgres belongs to `apps/api`, which owns
  drizzle and better-auth. `apps/web/src/hooks.server.ts` proxies `/api/*` to `API_URL` and fills
  `locals.user` / `locals.session` from `GET /api/auth/get-session`; server code reaches the API
  through that proxy (`event.fetch('/api/…')`), never `API_URL` directly.
- **`apps/api` runs with `bodyParser: false`.** `@thallesp/nestjs-better-auth` needs the raw request
  body and re-adds JSON/urlencoded parsing for every other route. Dropping that flag breaks every
  `/api/auth/*` call in a way that looks like a hang.
- **The auth guard is global.** Every controller route requires a session unless the controller or
  handler is marked `@AllowAnonymous()` (or `@OptionalAuth()`); `/health` is anonymous on purpose.
  Drizzle is registered by `@nestjs/drizzle` in `AppModule` and injected via the `DB` token in
  `src/db/db.ts`.
- **better-auth tables are generated, not hand-written.** `packages/db/src/schema/auth.ts` comes from
  `pnpm auth:schema`, which reads `packages/db/better-auth.config.ts`. Adding a plugin in
  `apps/api/src/auth/auth.ts` means updating that config and regenerating, or the schema and runtime
  disagree.
- **`packages/db` is a built package.** `types` point at `src/`, runtime `exports` at `dist/`, so
  `pnpm build` (turbo `^build`) must run before `apps/api` starts or its tests import stale/missing
  `dist`.
- **The web app owns port 5173, the API owns 3000.** `adapter-node` defaults to 3000, hence the
  `PORT` in `apps/web/.env`; keep that in mind before adding any other server.
- **`apps/image-processor` is Python and outside pnpm, turbo and oxlint.** `uv` owns the
  environment (`pyproject.toml`, `uv.lock`, `.python-version` = 3.12), `ruff` owns lint and format
  with its settings in that `pyproject.toml`. Root `pnpm lint` / `pnpm fmt` / `pnpm test` deliberately
  skip it: run `uv run ruff check .`, `uv run ruff format .` and `uv run pytest` in that directory.
  It has `app/` (`main.py` with `create_app()`) and `tests/` today; `processors/`, `pipelines/`,
  `models/` and `services/` arrive with the steps. Port 8000, no database, no Redis — it reads and
  writes object storage and nothing else, and no repo code calls it yet.
- **Lint/format are repo-level, not per-package.** `oxlint` and `oxfmt` run once over the tree from
  the root; do not add per-app `lint` scripts or Turbo tasks for them.
- **Config locations:** `.oxlintrc.json` (root, shared) extended by `apps/web/.oxlintrc.json` and
  `apps/api/.oxlintrc.json`. Nested configs do **not** inherit automatically — always `extends` the
  root one. Same for `.oxfmtrc.json`: one root file, `apps/web` behaviour lives in its `overrides`.
  Do not add a nested `.oxfmtrc.json`; nested files replace the root config instead of merging.
- **Svelte template linting comes from a JS plugin** (`@rsvelte/oxlint-plugin`, enabled in
  `apps/web/.oxlintrc.json`), because oxlint has no native Svelte plugin. Svelte _formatting_ needs
  `"svelte": true` in `.oxfmtrc.json` plus the `svelte` package installed. Both are load-bearing.
- **Type-aware rules only fire with `--type-aware`.** Root `pnpm lint` already runs a second pass
  over `apps/api` and `apps/worker`; a bare `oxlint` will silently skip
  `typescript/no-floating-promises`.
- **Shared dependency versions live in `catalog:`** in `pnpm-workspace.yaml`. Reference them as
  `"catalog:"`, never by pasting a version into an app.
- **pnpm 12 does not run dependency build scripts** unless allowed in `allowBuilds` in
  `pnpm-workspace.yaml`. If a native package misbehaves after install, look there first.
- **`scripts` runs from source with `tsx`, but consumes `packages/db` through its `dist`.** That is
  why `seed` is a Turbo task with `dependsOn: ["^build"]` rather than a plain pnpm script, and why
  `DATABASE_URL` sits in its `passThroughEnv`: `DATABASE_URL=… pnpm seed` overrides the
  `packages/db/.env` the script loads by default.
- **`packages/api-client` is generated, never edited.** `pnpm gen:api` builds `apps/api`, boots it
  headlessly to write `packages/contracts/openapi.json`, then runs `@hey-api/openapi-ts`. The output
  under `src/client/` is committed so builds and tests need no running API; `oxlint` ignores it.
  The generator runs the _compiled_ API (`node dist/tools/generate-openapi.js`), because Nest's DI
  needs the decorator metadata only `tsc` emits — `tsx` would boot without it.
- **DTOs live in `packages/contracts`, not in `apps/api`.** One zod object is the type (`z.infer`),
  the runtime validator (`@Query`/`@Param`/`@Body` take `{ schema }`, the global
  `StandardSchemaValidationPipe` runs it) and the Swagger schema (`@ApiOkResponse({ standardSchema })`),
  which is what ends up in the generated client.
- **e2e specs do not run `main.ts`.** `Test.createTestingModule` + `createNestApplication` skips the
  global pipe, CORS and Swagger setup, so a spec that asserts a 400 has to install
  `new StandardSchemaValidationPipe()` itself (see `test/webcams.e2e-spec.ts`).

## Conventions

- No explanatory comments in source: names and structure carry the intent. Applies to `apps/worker`
  and to the drizzle schema; generated files keep whatever their generator emits.
- TypeScript everywhere, ESM only (`"type": "module"`, `nodenext` resolution). Import local files
  with the `.js` extension in `apps/api` (Node ESM).
- API DTOs are **zod** schemas in `packages/contracts/src/dto/`, imported as
  `@webcam-scrapper/contracts/dto`. Do not add `class-validator`/`class-transformer` decorators or a
  second validation pipe.
- The web app talks to the API through the generated client (`@webcam-scrapper/api-client`) inside
  TanStack Query. In a `load` it works too, but then `baseUrl` must be absolute (`url.origin`) because
  the client builds a `Request` and Node rejects relative URLs there — and `hooks.server.ts` has to
  keep passing `filterSerializedResponseHeaders` for `content-type`/`content-length`, or every header
  read on that response throws during SSR.
- API: feature folders (`src/<feature>/<feature>.{module,controller,service}.ts`), config through
  `ConfigService` typed by `src/config/configuration.ts` — the only place that reads `process.env`.
- Web: Svelte 5 runes, routes under `src/routes`, server-only code under `src/lib/server`.
- Server render the first page, then hand it to the query as `initialData` (see `routes/+page.ts` and
  `routes/+page.svelte`): the HTML has real content, the client does not refetch page 0, and further
  pages come from the browser only (queries are `enabled: browser`, the client has no absolute URL).
- Auth in the web app is a form action posting to the `/api/*` proxy with `event.fetch`, then a
  redirect; the session itself always comes from `locals`, never from client-side state.
- Tests are Vitest in both apps. `apps/web` component tests run in a real browser
  (`vitest-browser-svelte` + Playwright), so `pnpm exec playwright install chromium` is required once.
