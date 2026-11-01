import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';

export interface CreateDbOptions {
	/** Maximum size of the connection pool. */
	maxConnections?: number;
}

/**
 * Creates a drizzle client plus the underlying postgres.js pool.
 * Applications own the instance (and call `close()` on shutdown); this package
 * only builds it, so nothing here is a module-level singleton.
 */
export function createDb(databaseUrl: string, options: CreateDbOptions = {}) {
	const client = postgres(databaseUrl, { max: options.maxConnections });
	const db = drizzle(client, { schema });

	return {
		db,
		client,
		close: (): Promise<void> => client.end()
	};
}

export type Database = ReturnType<typeof createDb>['db'];
