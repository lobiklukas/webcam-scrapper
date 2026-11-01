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

async function createService(rows: unknown[], get: ReturnType<typeof vi.fn<GetObject>>) {
	const module: TestingModule = await Test.createTestingModule({
		providers: [
			FramesService,
			{ provide: DB, useValue: databaseReturning(rows) },
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
});
