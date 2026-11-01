import { StandardSchemaValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
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

		expect(Array.isArray(response.body)).toBe(true);
		for (const item of response.body) {
			expect(typeof item.id).toBe('number');
			expect(typeof item.name).toBe('string');
			expect(typeof item.camCount).toBe('number');
		}
	});

	it('rejects a limit outside the schema', async () => {
		await request(app.getHttpServer()).get('/api/webcams?limit=0').expect(400);
		await request(app.getHttpServer()).get('/api/webcams?limit=abc').expect(400);
	});

	it('answers 404 for a location that does not exist', async () => {
		await request(app.getHttpServer()).get('/api/webcams/2147483647').expect(404);
	});

	it('returns a location with its cameras', async () => {
		const list = await request(app.getHttpServer()).get('/api/webcams?limit=1').expect(200);
		const [first] = list.body as { id: number; camCount: number }[];

		// A fresh database has no catalogue yet; the detail shape is covered by the unit spec.
		if (!first) return;

		const detail = await request(app.getHttpServer()).get(`/api/webcams/${first.id}`).expect(200);

		expect(detail.body).toMatchObject({ id: first.id });
		expect(detail.body.cams).toHaveLength(first.camCount);
	});
});
