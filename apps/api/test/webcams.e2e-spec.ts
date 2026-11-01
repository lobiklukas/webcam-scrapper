import { StandardSchemaValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { webcamListItemDto, webcamDto, webcamSourceDto } from '@webcam-scrapper/contracts/dto';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';

describe('webcams (e2e)', () => {
	let app: INestApplication<App>;

	beforeEach(async () => {
		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [AppModule]
		}).compile();

		app = moduleFixture.createNestApplication();
		// main.ts installs these globally; a bare testing app does not pick them up.
		app.useGlobalPipes(new StandardSchemaValidationPipe());
		await app.init();
	});

	afterEach(async () => {
		await app.close();
	});

	it('lists locations anonymously', async () => {
		const response = await request(app.getHttpServer()).get('/api/webcams').expect(200);

		// The same DTO the controller documents, so response drift fails here too.
		expect(() => webcamListItemDto.array().parse(response.body)).not.toThrow();
	});

	it('rejects a limit outside the schema', async () => {
		await request(app.getHttpServer()).get('/api/webcams?limit=0').expect(400);
		await request(app.getHttpServer()).get('/api/webcams?limit=abc').expect(400);
	});

	it('lists the provider ids in the catalogue', async () => {
		const response = await request(app.getHttpServer()).get('/api/webcams/sources').expect(200);

		expect(() => webcamSourceDto.array().parse(response.body)).not.toThrow();
	});

	it('filters the list down to one provider', async () => {
		const [source] = webcamSourceDto
			.array()
			.parse((await request(app.getHttpServer()).get('/api/webcams/sources')).body);

		// A fresh database has no catalogue yet; the filter query is still exercised when it has.
		if (!source) return;

		const response = await request(app.getHttpServer())
			.get(`/api/webcams?source=${source}`)
			.expect(200);

		const locations = webcamListItemDto.array().parse(response.body);

		expect(locations.length).toBeGreaterThan(0);
		expect(locations.every((location) => location.source === source)).toBe(true);
	});

	it('answers 404 for a location that does not exist', async () => {
		await request(app.getHttpServer()).get('/api/webcams/2147483647').expect(404);
	});

	it('returns a location with its cameras', async () => {
		const list = await request(app.getHttpServer()).get('/api/webcams?limit=1').expect(200);
		const [first] = webcamListItemDto.array().parse(list.body);

		// A fresh database has no catalogue yet; the detail shape is covered by the unit spec.
		if (!first) return;

		const response = await request(app.getHttpServer()).get(`/api/webcams/${first.id}`).expect(200);
		const detail = webcamDto.parse(response.body);

		expect(detail.id).toBe(first.id);
		expect(detail.cams).toHaveLength(first.camCount);
	});
});
