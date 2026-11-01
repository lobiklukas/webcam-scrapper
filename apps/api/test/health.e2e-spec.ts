import request from 'supertest';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';

describe('HTTP surface (e2e)', () => {
	let app: INestApplication<App>;

	beforeEach(async () => {
		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [AppModule]
		}).compile();

		app = moduleFixture.createNestApplication();
		await app.init();
	});

	afterEach(async () => {
		await app.close();
	});

	it('GET /health answers 200', async () => {
		const response = await request(app.getHttpServer()).get('/health').expect(200);

		expect(response.body).toMatchObject({ status: 'ok' });
	});

	it('serves the better-auth endpoints outside the session guard', async () => {
		const response = await request(app.getHttpServer()).get('/api/auth/ok').expect(200);

		expect(response.body).toMatchObject({ ok: true });
	});
});
