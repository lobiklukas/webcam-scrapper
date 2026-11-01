import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { createDb } from './src/client.js';

/**
 * Loaded by `pnpm auth:schema` (better-auth CLI) only — never by the running apps.
 *
 * The CLI derives `src/schema/auth.ts` from these options, so they must stay in
 * sync with the runtime config in `apps/api/src/auth/auth.ts`: a plugin added
 * there (admin, organization, …) adds tables/columns that have to be generated
 * here, otherwise drizzle and better-auth disagree at runtime.
 */
const { db } = createDb(
	process.env.DATABASE_URL ?? 'postgres://unused:unused@localhost:5432/unused'
);

export const auth = betterAuth({
	baseURL: process.env.API_ORIGIN ?? 'http://localhost:3000',
	secret: process.env.BETTER_AUTH_SECRET ?? 'schema-generation-only',
	database: drizzleAdapter(db, { provider: 'pg' }),
	emailAndPassword: { enabled: true }
});
