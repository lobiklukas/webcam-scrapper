import { Readable } from 'node:stream';
import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { DB, type AppDatabase } from '../db/db.js';
import { ObjectNotFoundError, type ObjectStorage } from './frames.storage.js';
import { FRAME_STORAGE, FramesService } from './frames.service.js';

const id = '0f7c4a2e-6b0c-4f14-9c66-2f9d1c0a1b2c';
const row = { storageKey: 'frames/1/a.jpg', contentType: 'image/jpeg', bytes: 12 };

type GetObject = (key: string) => Promise<Readable>;

function databaseReturning(rows: unknown[]): AppDatabase {
	return {
		select: () => ({
			from: () => ({ where: () => ({ limit: () => Promise.resolve(rows) }) })
		})
	} as unknown as AppDatabase;
}

/** The list query is ordered and capped, so its chain is `where().orderBy().limit()`. */
function databaseListing(rows: unknown[], limit: ReturnType<typeof vi.fn>): AppDatabase {
	return {
		select: () => ({
			from: () => ({ where: () => ({ orderBy: () => ({ limit }) }) })
		})
	} as unknown as AppDatabase;
}

async function createService(rows: unknown[], get: ReturnType<typeof vi.fn<GetObject>>) {
	return createServiceWith(databaseReturning(rows), get);
}

async function createServiceWith(
	database: AppDatabase,
	get: ReturnType<typeof vi.fn<GetObject>> = vi.fn<GetObject>()
) {
	const module: TestingModule = await Test.createTestingModule({
		providers: [
			FramesService,
			{ provide: DB, useValue: database },
			{ provide: FRAME_STORAGE, useValue: { get } satisfies ObjectStorage }
		]
	}).compile();

	return module.get(FramesService);
}

describe('FramesService', () => {
	const body = Readable.from(Buffer.from('jpeg'));

	it('reads the object its frame row points at', async () => {
		const get = vi.fn<GetObject>().mockResolvedValue(body);
		const service = await createService([row], get);

		await expect(service.open(id)).resolves.toEqual({
			contentType: 'image/jpeg',
			contentLength: 12,
			body
		});
		expect(get).toHaveBeenCalledWith(row.storageKey);
	});

	it('answers 404 for an unknown frame', async () => {
		const get = vi.fn<GetObject>();
		const service = await createService([], get);

		await expect(service.open(id)).rejects.toBeInstanceOf(NotFoundException);
		expect(get).not.toHaveBeenCalled();
	});

	it('answers 404 when the object behind the row is gone', async () => {
		const get = vi.fn<GetObject>().mockRejectedValue(new ObjectNotFoundError(row.storageKey));
		const service = await createService([row], get);

		await expect(service.open(id)).rejects.toBeInstanceOf(NotFoundException);
	});

	it('lets storage failures through as server errors', async () => {
		const error = new Error('bucket unreachable');
		const get = vi.fn<GetObject>().mockRejectedValue(error);
		const service = await createService([row], get);

		await expect(service.open(id)).rejects.toBe(error);
	});

	it('lists a window oldest first, capped at the newest frames', async () => {
		const limit = vi.fn().mockResolvedValue([
			{ id, capturedAt: new Date('2026-05-01T10:10:00.000Z'), contentType: 'image/jpeg', bytes: 20 },
			{
				id: '1f7c4a2e-6b0c-4f14-9c66-2f9d1c0a1b2c',
				capturedAt: new Date('2026-05-01T10:00:00.000Z'),
				contentType: 'image/jpeg',
				bytes: 10
			}
		]);
		const service = await createServiceWith(databaseListing([], limit));

		const frames = await service.list({ camId: 7, limit: 2 });

		expect(frames.map((entry) => entry.capturedAt)).toEqual([
			'2026-05-01T10:00:00.000Z',
			'2026-05-01T10:10:00.000Z'
		]);
		expect(frames[0]?.url).toBe('/api/frames/1f7c4a2e-6b0c-4f14-9c66-2f9d1c0a1b2c');
		expect(limit).toHaveBeenCalledWith(2);
	});
});
