import { z } from 'zod';

export interface WorkerConfig {
	databaseUrl: string;
	amqpUrl: string;
	storage: {
		endpoint: string;
		region: string;
		bucket: string;
		accessKeyId: string;
		secretAccessKey: string;
		forcePathStyle: boolean;
	};
	scrape: {
		enabled: boolean;
		batchSize: number;
		idleMs: number;
		maxBytes: number;
		timeoutMs: number;
	};
}

const envSchema = z
	.object({
		DATABASE_URL: z.string().min(1),
		AMQP_URL: z.string().default('amqp://webcams:webcams@localhost:5672'),
		S3_ENDPOINT: z.string().default('http://localhost:9000'),
		S3_REGION: z.string().default('us-east-1'),
		S3_BUCKET: z.string().default('webcams-dev'),
		S3_ACCESS_KEY_ID: z.string().default('minioadmin'),
		S3_SECRET_ACCESS_KEY: z.string().default('minioadmin'),
		S3_FORCE_PATH_STYLE: z.stringbool().default(true),
		SCRAPE_ENABLED: z.stringbool().default(true),
		SCRAPE_BATCH_SIZE: z.coerce.number().int().positive().default(8),
		SCRAPE_IDLE_MS: z.coerce.number().int().positive().default(1_000),
		SCRAPE_MAX_BYTES: z.coerce
			.number()
			.int()
			.positive()
			.default(10 * 1024 * 1024),
		SCRAPE_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000)
	})
	.transform((env): WorkerConfig => ({
		databaseUrl: env.DATABASE_URL,
		amqpUrl: env.AMQP_URL,
		storage: {
			endpoint: env.S3_ENDPOINT,
			region: env.S3_REGION,
			bucket: env.S3_BUCKET,
			accessKeyId: env.S3_ACCESS_KEY_ID,
			secretAccessKey: env.S3_SECRET_ACCESS_KEY,
			forcePathStyle: env.S3_FORCE_PATH_STYLE
		},
		scrape: {
			enabled: env.SCRAPE_ENABLED,
			batchSize: env.SCRAPE_BATCH_SIZE,
			idleMs: env.SCRAPE_IDLE_MS,
			maxBytes: env.SCRAPE_MAX_BYTES,
			timeoutMs: env.SCRAPE_TIMEOUT_MS
		}
	}));

export function loadConfig(): WorkerConfig {
	const parsed = envSchema.safeParse(process.env);

	if (!parsed.success) {
		const problems = parsed.error.issues
			.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
			.join('; ');
		throw new Error(`invalid worker config: ${problems}`);
	}

	return parsed.data;
}
