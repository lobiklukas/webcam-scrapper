import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { account, session, user, verification, type Database } from '@webcam-scrapper/db';

export interface CreateAuthOptions {
	/** drizzle client from `DbModule`. */
	database: Database;
	/** Public URL of this API. */
	baseURL: string;
	/** Session/token signing secret. */
	secret: string;
	/** Browser origins allowed to call the auth endpoints (the SvelteKit app). */
	trustedOrigins: string[];
}

/**
 * The better-auth instance. Tables come from `@webcam-scrapper/db/src/schema/auth.ts`,
 * which `pnpm auth:schema` generates from `packages/db/better-auth.config.ts` — keep
 * both option sets in sync when adding plugins.
 */
export function createAuth({ database, baseURL, secret, trustedOrigins }: CreateAuthOptions) {
	return betterAuth({
		baseURL,
		secret,
		trustedOrigins,
		database: drizzleAdapter(database, {
			provider: 'pg',
			schema: { user, session, account, verification }
		}),
		emailAndPassword: { enabled: true }
	});
}

export type Auth = ReturnType<typeof createAuth>;
