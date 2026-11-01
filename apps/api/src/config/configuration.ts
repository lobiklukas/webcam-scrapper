export interface AppConfig {
	/** Port the HTTP server listens on. */
	port: number;
	/** Origin of the browser app: CORS allow-list and better-auth trusted origin. */
	webOrigin: string;
	/** Public URL of this API; better-auth uses it as `baseURL` for cookies and links. */
	apiOrigin: string;
	/** Postgres connection string, the single database for every app. */
	databaseUrl: string;
	/** Signs better-auth sessions and tokens. 32+ high-entropy characters in production. */
	betterAuthSecret: string;
	/** Node environment, drives Swagger exposure. */
	nodeEnv: string;
}

function required(name: string): string {
	const value = process.env[name];
	if (!value) throw new Error(`${name} is not set`);
	return value;
}

/**
 * Maps environment variables onto the typed config consumed through `ConfigService`.
 * Keep this the single place that reads `process.env`.
 */
export default (): AppConfig => {
	const port = Number.parseInt(process.env.PORT ?? '3000', 10);

	return {
		port,
		webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
		apiOrigin: process.env.API_ORIGIN ?? `http://localhost:${port}`,
		databaseUrl: required('DATABASE_URL'),
		betterAuthSecret: required('BETTER_AUTH_SECRET'),
		nodeEnv: process.env.NODE_ENV ?? 'development'
	};
};
