export interface AppConfig {
	/** Port the HTTP server listens on. */
	port: number;
	/** Origin allowed by CORS; the SvelteKit app in development. */
	webOrigin: string;
	/** Node environment, drives Swagger exposure. */
	nodeEnv: string;
}

/**
 * Maps environment variables onto the typed config consumed through `ConfigService`.
 * Keep this the single place that reads `process.env`.
 */
export default (): AppConfig => ({
	port: Number.parseInt(process.env.PORT ?? '3000', 10),
	webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
	nodeEnv: process.env.NODE_ENV ?? 'development'
});
