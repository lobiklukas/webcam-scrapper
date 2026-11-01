# @windy/web

SvelteKit front end: camera map, player, management UI. Part of the repo described in
[`../../README.md`](../../README.md) — run commands from the repo root.

- Dev server: <http://localhost:5173> (`pnpm dev --filter @windy/web`)
- Build/run under Bun (adapter-bun): `pnpm build`, then `bun ./build/index.js`
- Postgres via `../..`: `pnpm db:start`; env in `.env` (copy `.env.example`)
- Env vars are validated at build time — a missing `.env` fails the build, not the request

Drizzle schema: `src/lib/server/db/schema.ts`. Better-auth config: `src/lib/server/auth.ts`
(`pnpm auth:schema` regenerates the auth tables).
