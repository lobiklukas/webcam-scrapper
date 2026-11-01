import type { Readable } from 'node:stream';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { frame } from '@webcam-scrapper/db';
import {
	framePath,
	type FramePreviewDto,
	type ListFramesQuery
} from '@webcam-scrapper/contracts/dto';
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

	/**
	 * The frames of one camera inside a window, oldest first. The cap takes the newest frames of the
	 * window and the result is reversed, so a camera with more frames than `limit` still plays its
	 * most recent run instead of stopping early in the past.
	 */
	async list({ camId, from, to, limit }: ListFramesQuery): Promise<FramePreviewDto[]> {
		const rows = await this.db
			.select({
				id: frame.id,
				capturedAt: frame.capturedAt,
				contentType: frame.contentType,
				bytes: frame.bytes
			})
			.from(frame)
			.where(
				and(
					eq(frame.camId, camId),
					from ? gte(frame.capturedAt, new Date(from)) : undefined,
					to ? lte(frame.capturedAt, new Date(to)) : undefined
				)
			)
			.orderBy(desc(frame.capturedAt))
			.limit(limit);

		return rows.reverse().map((row) => ({
			id: row.id,
			capturedAt: row.capturedAt.toISOString(),
			contentType: row.contentType,
			bytes: row.bytes,
			url: framePath(row.id)
		}));
	}
}
