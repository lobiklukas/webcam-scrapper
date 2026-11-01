import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { WebcamsController } from './webcams.controller.js';
import { WebcamsService } from './webcams.service.js';
import type {
	ListWebcamsQuery,
	WebcamDto,
	WebcamListItemDto
} from '@webcam-scrapper/contracts/dto';

const cam = {
	id: 1,
	originalId: 'C0150301',
	retrievalUrl: 'https://example.test/C0150301.jpg',
	inCollection: true
};

const summary: WebcamListItemDto = {
	id: 1,
	originalId: 'C01503',
	name: 'kt51_Inkoo',
	long: 23.99616,
	lat: 60.05374,
	camCount: 3,
	cam,
	frame: {
		id: '2c9a0f4e-8f0b-4b2f-9b6d-6f60a1b2c3d4',
		capturedAt: '2024-05-01T10:00:00.000Z',
		contentType: 'image/jpeg',
		bytes: 1024,
		url: '/api/frames/2c9a0f4e-8f0b-4b2f-9b6d-6f60a1b2c3d4'
	}
};

const detail: WebcamDto = {
	id: summary.id,
	originalId: summary.originalId,
	name: summary.name,
	long: summary.long,
	lat: summary.lat,
	camCount: summary.camCount,
	cams: [cam]
};

describe('WebcamsController', () => {
	let controller: WebcamsController;
	const service = {
		list: vi.fn<(query: ListWebcamsQuery) => Promise<WebcamListItemDto[]>>(),
		findOne: vi.fn<(id: number) => Promise<WebcamDto>>()
	};

	beforeEach(async () => {
		vi.resetAllMocks();
		const module: TestingModule = await Test.createTestingModule({
			controllers: [WebcamsController],
			providers: [{ provide: WebcamsService, useValue: service }]
		}).compile();

		controller = module.get(WebcamsController);
	});

	it('returns the locations the service lists', async () => {
		service.list.mockResolvedValue([summary]);

		await expect(controller.list({ limit: 50, offset: 0 })).resolves.toEqual([summary]);
		expect(service.list).toHaveBeenCalledWith({ limit: 50, offset: 0 });
	});

	it('forwards the filter to the service', async () => {
		service.list.mockResolvedValue([]);

		await controller.list({ q: 'inkoo', limit: 10, offset: 5 });

		expect(service.list).toHaveBeenCalledWith({ q: 'inkoo', limit: 10, offset: 5 });
	});

	it('returns one location with its cameras', async () => {
		service.findOne.mockResolvedValue(detail);

		await expect(controller.findOne(1)).resolves.toEqual(detail);
		expect(service.findOne).toHaveBeenCalledWith(1);
	});
});
