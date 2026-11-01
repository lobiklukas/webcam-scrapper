import type { Readable } from 'node:stream';
import { GetObjectCommand, NoSuchKey, S3Client } from '@aws-sdk/client-s3';
import type { AppConfig } from '../config/configuration.js';

/** Reads an object's bytes; the API only ever reads, the worker owns every write. */
export interface ObjectStorage {
	get(key: string): Promise<Readable>;
}

/** The frame row exists but object storage has no object for its key. */
export class ObjectNotFoundError extends Error {}

export class S3ObjectStorage implements ObjectStorage {
	private readonly client: S3Client;
	private readonly bucket: string;

	constructor(options: AppConfig['storage']) {
		this.bucket = options.bucket;
		this.client = new S3Client({
			endpoint: options.endpoint,
			region: options.region,
			forcePathStyle: options.forcePathStyle,
			credentials: { accessKeyId: options.accessKeyId, secretAccessKey: options.secretAccessKey }
		});
	}

	async get(key: string): Promise<Readable> {
		try {
			const result = await this.client.send(
				new GetObjectCommand({ Bucket: this.bucket, Key: key })
			);

			if (!result.Body) throw new ObjectNotFoundError(key, { cause: result });

			return result.Body as Readable;
		} catch (error) {
			if (error instanceof NoSuchKey || isNotFound(error)) {
				throw new ObjectNotFoundError(key, { cause: error });
			}

			throw error;
		}
	}
}

function isNotFound(error: unknown): boolean {
	if (typeof error !== 'object' || error === null) return false;

	const candidate = error as { name?: string; $metadata?: { httpStatusCode?: number } };
	return candidate.name === 'NotFound' || candidate.$metadata?.httpStatusCode === 404;
}
