import {
	CreateBucketCommand,
	HeadBucketCommand,
	PutObjectCommand,
	S3Client
} from '@aws-sdk/client-s3';
import type { WorkerConfig } from './config.js';

export interface Storage {
	put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
	ping(): Promise<void>;
}

function isNotFound(error: unknown): boolean {
	if (typeof error !== 'object' || error === null) return false;

	const candidate = error as { name?: string; $metadata?: { httpStatusCode?: number } };
	return candidate.name === 'NotFound' || candidate.$metadata?.httpStatusCode === 404;
}

export class S3Storage implements Storage {
	private readonly client: S3Client;
	private readonly bucket: string;

	constructor(options: WorkerConfig['storage']) {
		this.bucket = options.bucket;
		this.client = new S3Client({
			endpoint: options.endpoint,
			region: options.region,
			forcePathStyle: options.forcePathStyle,
			credentials: { accessKeyId: options.accessKeyId, secretAccessKey: options.secretAccessKey }
		});
	}

	async put(key: string, bytes: Uint8Array, contentType: string): Promise<void> {
		await this.client.send(
			new PutObjectCommand({
				Bucket: this.bucket,
				Key: key,
				Body: bytes,
				ContentType: contentType,
				ContentLength: bytes.byteLength
			})
		);
	}

	async ensureBucket(): Promise<void> {
		try {
			await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
			return;
		} catch (error) {
			if (!isNotFound(error)) throw error;
		}

		await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
	}

	async ping(): Promise<void> {
		try {
			await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
		} catch (error) {
			const reason = error instanceof Error ? error.message : String(error);
			throw new Error(
				`Object storage bucket "${this.bucket}" is not reachable: ${reason}. Start it with \`pnpm db:start\`.`,
				{ cause: error }
			);
		}
	}
}
