import type { Readable } from 'node:stream';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { frame } from '@webcam-scrapper/db';
import { DB, type AppDatabase } from '../db/db.js';
import { ObjectNotFoundError, type ObjectStorage } from './frames.storage.js';

export const FRAME_STORAGE = 'FRAME_STORAGE';

/** A frame's bytes plus the metadata the HTTP layer needs to answer with it. */
export interface StoredFrame {
	contentType: string;
	contentLength: number;
	body: Readable;
}

@Injectable()
export class FramesService {
	constructor(
		@Inject(DB) private readonly db: AppDatabase,
		@Inject(FRAME_STORAGE) private readonly storage: ObjectStorage
	) {}

	/** Opens one stored frame, by the id the webcams list puts in its preview URLs. */
	async open(id: string): Promise<StoredFrame> {
		const [row] = await this.db
			.select({ storageKey: frame.storageKey, contentType: frame.contentType, bytes: frame.bytes })
			.from(frame)
			.where(eq(frame.id, id))
			.limit(1);

		if (!row) throw new NotFoundException(`Frame ${id} not found`);

		try {
			const body = await this.storage.get(row.storageKey);

			return { contentType: row.contentType, contentLength: row.bytes, body };
		} catch (error) {
			if (error instanceof ObjectNotFoundError) {
				throw new NotFoundException(`Frame ${id} has no stored object`);
			}

			throw error;
		}
	}
}
