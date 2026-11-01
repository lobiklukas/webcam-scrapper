import { StandardSchemaValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import type { AppConfig } from './config/configuration.js';
import { createOpenApiDocument } from './openapi.js';

async function bootstrap(): Promise<void> {
	// Body parsing is disabled so better-auth receives the raw request body; the auth module
	// re-adds the JSON/urlencoded parsers for every other route.
	const app = await NestFactory.create(AppModule, { bodyParser: false });
	const config = app.get<ConfigService<AppConfig, true>>(ConfigService);

	app.enableCors({ origin: config.get('webOrigin', { infer: true }), credentials: true });
	app.useGlobalPipes(new StandardSchemaValidationPipe());
	app.enableShutdownHooks();

	if (config.get('nodeEnv', { infer: true }) !== 'production') {
		SwaggerModule.setup('docs', app, createOpenApiDocument(app));
	}

	await app.listen(config.get('port', { infer: true }));
}

await bootstrap();
