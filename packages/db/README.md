# @webcam-scrapper/db — Drizzle schema, client and migrations

The one place table shapes are defined. `apps/api` reads and writes the database; `apps/web` never
touches it. Import the schema or the client factory, not a module-level singleton:

```ts
import { createDb, user, session } from '@webcam-scrapper/db';
```

## Contents

| Path                    | What it is                                                          |
| ----------------------- | ------------------------------------------------------------------- |
| `src/schema/`           | drizzle table definitions — one file per domain area                |
| `src/schema/auth.ts`    | **generated** by `pnpm auth:schema` from `better-auth.config.ts`    |
| `src/client.ts`         | `createDb(url)` → `{ db, client, close }`; the caller owns the pool |
| `src/index.ts`          | barrel: schema tables + `createDb` + the `Database` type            |
| `better-auth.config.ts` | read by the better-auth CLI only, never by a running app            |
| `drizzle.config.ts`     | drizzle-kit config; migrations land in `migrations/`                |

## Scripts (usually via the root: `pnpm db:*`, `pnpm auth:schema`)

```sh
pnpm db:push       # apply the schema to the database (dev)
pnpm db:generate   # write SQL migrations into migrations/
pnpm db:migrate    # apply migrations
pnpm db:studio     # drizzle studio
pnpm auth:schema   # regenerate src/schema/auth.ts, then run `pnpm fmt`
```

`DATABASE_URL` must be in the environment (drizzle-kit and the auth CLI read `.env` here).

## Building

This is a built package: `types` point at `src/`, runtime `exports` at `dist/`, so typechecking works
against the source while Node resolves compiled `.js`. `apps/api` therefore needs `pnpm build` (turbo
runs `^build` first) — or `pnpm dev`, which also runs `tsc --watch` here.

## Rules

- **Drizzle, not Prisma or TypeORM.** `drizzle-kit generate` produces SQL, `drizzle-kit migrate`
  applies it; a schema change without a migration fails CI.
- Tables are shared by `apps/api` and the future workers, so this package is the only place table
  shapes are defined.
- No query code here. Services own queries; the package owns shapes.
- `packages/db` must not import `$app/*` or any SvelteKit module.
- Adding a better-auth plugin means editing it twice: `apps/api/src/auth/auth.ts` (runtime) and
  `better-auth.config.ts` (generation), then `pnpm auth:schema`. Keep those options in sync.
