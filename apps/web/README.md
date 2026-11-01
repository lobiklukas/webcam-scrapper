# @windy/web

SvelteKit front end: camera map, player, management UI. Part of the repo described in
[`../../README.md`](../../README.md) — run commands from the repo root.

- Dev server: <http://localhost:5173> (`pnpm dev --filter @windy/web`)
- Production build (`@sveltejs/adapter-node`): `pnpm build`, then `pnpm start`
  (`node --env-file-if-exists=.env build`, serves on `PORT` from `.env`)
- Postgres via `../..`: `pnpm db:start`; env in `.env` (copy `.env.example`)
- Env vars are validated at build time and at boot — a missing value fails fast at startup

Drizzle schema: `src/lib/server/db/schema.ts`. Better-auth config: `src/lib/server/auth.ts`
(`pnpm auth:schema` regenerates the auth tables).
