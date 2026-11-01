# @windy/db — Drizzle schema, client and migrations

**Status: skeleton.** The tables live in `apps/web/src/lib/server/db` today; this package becomes
their home once they are needed by more than one app.

> TBD (WL-1, research issue): whether SvelteKit keeps its own drizzle client for better-auth tables
> or every query moves behind the API. That decision decides how much of this package `apps/web`
> imports.

## What lands here

| Path          | Contents                                                                     |
| ------------- | ---------------------------------------------------------------------------- |
| `src/schema/` | Drizzle table definitions, one file per domain area (webcam, image, pipeline, events, …) |
| `src/client.ts` | `drizzle(postgres(DATABASE_URL))` factory, not a module-level singleton      |
| `src/index.ts` | barrel export: `export * from './schema/index.js'` and the client type      |
| `migrations/` | generated SQL from `drizzle-kit generate`                                    |

## Rules

- **Drizzle, not Prisma or TypeORM.** `drizzle-kit generate` produces SQL, `drizzle-kit migrate`
  applies it; a schema change without a migration fails CI.
- Tables are shared by `apps/web`, `apps/api` and the workers, so this package is the only place
  table shapes are defined.
- No query code here. Services own queries; the package owns shapes.
- `packages/db` must not import `$app/*` or any SvelteKit module — the current client does
  (`import { DATABASE_URL } from '$app/env/private'`) and that is why it cannot be reused yet.

Activated by: WL-95 (extract schema + client), WL-90 (migrations in CI and at deploy).
