# Windy webcams clone

Monorepo for a webcam map with a management UI. The research that drives the product shape lives in
[`docs/research/`](docs/research/).

## Layout

```
apps/
  web/    SvelteKit 3 app: map, player, camera management UI (runs on Bun via adapter-bun)
  api/    Nest 12 app: camera registry, read API, ingestion (health + config + Swagger today)
packages/ reserve for code shared by both apps (workspace glob already wired)
docs/
  research/  Windy teardown, camera sources, management flows, ingestion strategy
```

## Prerequisites

| Tool   | Version                         | Why                                                                                  |
| ------ | ------------------------------- | ------------------------------------------------------------------------------------ |
| Node   | >= 24                           | both apps                                                                            |
| pnpm   | 12.x (`packageManager` pins it) | installs and runs the workspace                                                      |
| Bun    | >= 1.3                          | **runtime for `apps/web`** — `@sveltejs/adapter-bun` refuses to build/run under Node |
| Docker | any                             | local Postgres (`apps/web/compose.yaml`)                                             |

## Commands

All of them run from the repo root.

```sh
pnpm install

pnpm dev            # turbo: both apps (web :5173, api :3000)
pnpm dev --filter @windy/api   # one app, streamed logs

pnpm lint           # oxlint everywhere + type-aware pass over apps/api
pnpm fmt            # oxfmt --write
pnpm fmt:check      # oxfmt --check (CI gate)
pnpm check          # turbo: svelte-check + tsc --noEmit
pnpm test           # turbo: vitest in both apps
pnpm build          # turbo: nest build + vite build (via bun)
```

Database (owned by `apps/web`):

```sh
pnpm db:start       # docker compose up (Postgres 5432)
pnpm auth:schema    # generate better-auth tables into drizzle schema
pnpm db:push        # apply schema
pnpm db:studio      # drizzle studio
```

The web app validates its environment at build time, so `apps/web/.env` must exist — copy
`apps/web/.env.example`.

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
