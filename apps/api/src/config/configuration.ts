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
	/** Object storage the worker writes frames to; the API only reads them back out. */
	storage: {
		endpoint: string;
		region: string;
		bucket: string;
		accessKeyId: string;
		secretAccessKey: string;
		forcePathStyle: boolean;
	};
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
		nodeEnv: process.env.NODE_ENV ?? 'development',
		storage: {
			endpoint: process.env.S3_ENDPOINT ?? 'http://localhost:9000',
			region: process.env.S3_REGION ?? 'us-east-1',
			bucket: process.env.S3_BUCKET ?? 'webcams-dev',
			accessKeyId: process.env.S3_ACCESS_KEY_ID ?? 'minioadmin',
			secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? 'minioadmin',
			forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false'
		}
	};
};
