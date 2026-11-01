import { StandardSchemaValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { webcamListItemDto } from '@webcam-scrapper/contracts/dto';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';

describe('frames (e2e)', () => {
	let app: INestApplication<App>;

	beforeEach(async () => {
		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [AppModule]
		}).compile();

		app = moduleFixture.createNestApplication();
		app.useGlobalPipes(new StandardSchemaValidationPipe());
		await app.init();
	});

	afterEach(async () => {
		await app.close();
	});

	it('serves the frame a location previews, anonymously, as an image', async () => {
		const list = await request(app.getHttpServer()).get('/api/webcams?limit=50').expect(200);
		const preview = webcamListItemDto
			.array()
			.parse(list.body)
			.find((location) => location.frame);

		// A fresh database has no catalogue, and object storage only holds what a poller stored.
		if (!preview?.frame) return;

		const response = await request(app.getHttpServer())
			.get(preview.frame.url)
			.expect(200)
			.expect('Cache-Control', 'public, max-age=31536000, immutable');

		expect(response.headers['content-type']).toBe(preview.frame.contentType);
		expect(response.body.byteLength ?? response.body.length).toBe(preview.frame.bytes);
	});

	it('rejects an id that is not a uuid', async () => {
		await request(app.getHttpServer()).get('/api/frames/abc').expect(400);
	});

	it('answers 404 for a frame that does not exist', async () => {
		await request(app.getHttpServer())
			.get('/api/frames/00000000-0000-0000-0000-000000000000')
			.expect(404);
	});
});
