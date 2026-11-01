import { Readable } from 'node:stream';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { FramesController } from './frames.controller.js';
import { FramesService } from './frames.service.js';
import type { StoredFrame } from './frames.service.js';

const id = '0f7c4a2e-6b0c-4f14-9c66-2f9d1c0a1b2c';

describe('FramesController', () => {
	let controller: FramesController;
	const service = { open: vi.fn<(id: string) => Promise<StoredFrame>>() };

	beforeEach(async () => {
		vi.resetAllMocks();
		const module: TestingModule = await Test.createTestingModule({
			controllers: [FramesController],
			providers: [{ provide: FramesService, useValue: service }]
		}).compile();

		controller = module.get(FramesController);
	});

	it('streams the stored frame with its own content type and length', async () => {
		const body = Readable.from(Buffer.from('jpeg'));
		service.open.mockResolvedValue({ contentType: 'image/jpeg', contentLength: 4, body });

		const file = await controller.findOne(id);

		expect(service.open).toHaveBeenCalledWith(id);
		expect(file.getStream()).toBe(body);
		expect(file.options).toEqual({ type: 'image/jpeg', length: 4 });
	});

	it('propagates the not found error', async () => {
		const error = new Error('missing');
		service.open.mockRejectedValue(error);

		await expect(controller.findOne(id)).rejects.toBe(error);
	});
});
