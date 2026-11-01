# AGENTS.md

Monorepo for a "Windy webcams" clone: a Turborepo + pnpm workspace with a SvelteKit front end and a
Nest API. Read this before changing anything.

## Repo map

| Path            | What it is                                                                    |
| --------------- | ----------------------------------------------------------------------------- |
| `apps/web`      | SvelteKit 3 app (Svelte 5, Tailwind 4, drizzle + better-auth, Postgres)       |
| `apps/api`      | Nest 12 app (health, config, Swagger; ingestion and read API land here)       |
| `packages/*`    | Workspace glob is wired but empty; put code both apps need here               |
| `docs/research` | Product research: Windy teardown, camera sources, management flows, ingestion |

## Commands (always from the repo root)

```sh
pnpm dev         # turbo, both apps: web :5173, api :3000
pnpm lint        # oxlint + type-aware oxlint over apps/api
pnpm fmt         # oxfmt --write          (pnpm fmt:check for CI)
pnpm check       # svelte-check + tsc --noEmit via turbo
pnpm test        # vitest in both apps
pnpm build       # nest build + vite build (adapter-node)
```

Never add `eslint`, `prettier`, `npm install`, or `bun` instructions: linting/formatting is
**oxlint + oxfmt** and the package manager is **pnpm 12**.

## Non-obvious constraints

- **`apps/web` targets Node** via `@sveltejs/adapter-node`: `build` is `vite build`, `start` is
  `node --env-file-if-exists=.env build` (the env file is what supplies `PORT`, `ORIGIN`,
  `DATABASE_URL`, `BETTER_AUTH_SECRET` in production). Do not reintroduce `bun --bun` or an
  adapter that needs another runtime.
- **The web app owns port 5173, the API owns 3000.** `adapter-node` defaults to 3000, hence the
  `PORT` in `apps/web/.env`; keep that in mind before adding any other server.
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
  over `apps/api`; a bare `oxlint` will silently skip `typescript/no-floating-promises`.
- **Shared dependency versions live in `catalog:`** in `pnpm-workspace.yaml`. Reference them as
  `"catalog:"`, never by pasting a version into an app.
- **pnpm 12 does not run dependency build scripts** unless allowed in `allowBuilds` in
  `pnpm-workspace.yaml`. If a native package misbehaves after install, look there first.

## Conventions

- TypeScript everywhere, ESM only (`"type": "module"`, `nodenext` resolution). Import local files
  with the `.js` extension in `apps/api` (Node ESM).
- API: feature folders (`src/<feature>/<feature>.{module,controller,service}.ts`), config through
  `ConfigService` typed by `src/config/configuration.ts` — the only place that reads `process.env`.
- Web: Svelte 5 runes, routes under `src/routes`, server-only code under `src/lib/server`.
- Tests are Vitest in both apps. `apps/web` component tests run in a real browser
  (`vitest-browser-svelte` + Playwright), so `pnpm exec playwright install chromium` is required once.
