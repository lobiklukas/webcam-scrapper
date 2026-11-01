# webcam-scrapper — a Windy webcams clone

Monorepo for a webcam map with a management UI. The research that drives the product shape lives in
[`docs/research/`](docs/research/).

## Layout

```
apps/
  web/    SvelteKit 3 app: map, player, camera management UI (adapter-node)
  api/    Nest 12 app: camera registry, read API, ingestion, auth + Postgres (health + config + Swagger today)
packages/
  db/     drizzle schema (incl. the generated better-auth tables), client factory, migrations
docs/
  research/  Windy teardown, camera sources, management flows, ingestion strategy
```

Only `apps/api` talks to Postgres. `apps/web` renders on the server and proxies `/api/*` to the API,
so the browser only ever sees the web origin (see [Auth and the API hop](#auth-and-the-api-hop)).

## Prerequisites

| Tool   | Version                         | Why                             |
| ------ | ------------------------------- | ------------------------------- |
| Node   | >= 24                           | both apps                       |
| pnpm   | 12.x (`packageManager` pins it) | installs and runs the workspace |
| Docker | any                             | local Postgres (`compose.yaml`) |

## Commands

All of them run from the repo root.

```sh
pnpm install

pnpm dev            # turbo: both apps (web :5173, api :3000)
pnpm dev --filter @webcam-scrapper/api   # one app, streamed logs

pnpm lint           # oxlint everywhere + type-aware pass over apps/api
pnpm fmt            # oxfmt --write
pnpm fmt:check      # oxfmt --check (CI gate)
pnpm check          # turbo: svelte-check + tsc --noEmit
pnpm test           # turbo: vitest in both apps
pnpm build          # turbo: nest build + vite build (adapter-node)
```

Running the web app's production build (`@sveltejs/adapter-node`):

```sh
pnpm --filter @webcam-scrapper/web build
pnpm --filter @webcam-scrapper/web start   # node --env-file-if-exists=.env build
```

`start` listens on `PORT` from `apps/web/.env` (5173 — the API owns 3000), and needs `API_URL`
(the API base URL) plus `ORIGIN`. SvelteKit validates the web env at build time **and** at boot, so a
missing value fails at startup instead of on the first request; copy `apps/web/.env.example`.

`apps/api` reads its own `.env` (`pnpm --filter @webcam-scrapper/api dev`): `PORT` (3000),
`API_ORIGIN`, `WEB_ORIGIN`, `DATABASE_URL` and `BETTER_AUTH_SECRET`. `configuration.ts` is the only
module that reads `process.env`, and it throws on a missing `DATABASE_URL` / `BETTER_AUTH_SECRET`.

Database (owned by `apps/api`, schema in `packages/db`):

```sh
pnpm db:start       # docker compose up (Postgres 5432)
pnpm auth:schema    # regenerate packages/db/src/schema/auth.ts from the better-auth config
pnpm db:push        # apply schema            (pnpm db:generate for SQL migrations)
pnpm db:studio      # drizzle studio
```

After `pnpm auth:schema`, run `pnpm fmt` — the generator emits its own formatting.

## Auth and the API hop

better-auth runs in `apps/api` (Nest), with its tables in Postgres via `@webcam-scrapper/db`:

- `POST /api/auth/sign-up/email`, `sign-in/email`, `sign-out`, `GET /api/auth/get-session` — served by
  the API, guarded globally; controllers opt out with `@AllowAnonymous()` (`/health` does).
- The browser never calls `:3000`. `apps/web/src/hooks.server.ts` proxies `/api/*` to `API_URL`, so the
  session cookie belongs to the web origin — no CORS, no cookie domain.
- On every other request the same hook reads `GET /api/auth/get-session` and fills `locals.user` /
  `locals.session`, which loads and form actions read. Form actions post to the proxy with
  `event.fetch('/api/auth/…')`; SvelteKit forwards the resulting `Set-Cookie` to the browser.
- `/demo/auth` is the working login / sign-up / sign-out page.

## Tooling decisions

- **pnpm workspaces + Turborepo.** Versions shared by both apps (TypeScript, Vitest, Vite, oxc,
  Turbo) live in the `catalog:` block of `pnpm-workspace.yaml` so they cannot drift.
- **oxlint + oxfmt instead of ESLint + Prettier.**
  - `.oxlintrc.json` — repo-wide rules; `apps/web` adds `@rsvelte/oxlint-plugin` (eslint-plugin-svelte
    ports plus Svelte compiler/a11y diagnostics, so template rules are still enforced);
    `apps/api` adds `eslint-plugin-nestjs-security` through oxlint's `jsPlugins`.
  - `apps/api` is additionally linted with `--type-aware` (`oxlint-tsgolint`), which is what makes
    rules like `typescript/no-floating-promises` fire.
  - `.oxfmtrc.json` — one repo-wide formatter config. Svelte formatting needs `svelte: true`
    (oxfmt delegates to `prettier-plugin-svelte`), Tailwind class sorting is scoped to `apps/web`.
- **Lint and format run once at the root**, not per package: oxc is a single binary over the whole
  tree (~0.4 s), so splitting it across Turbo tasks would only add overhead.
