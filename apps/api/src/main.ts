import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import type { AppConfig } from './config/configuration.js';

async function bootstrap(): Promise<void> {
	const app = await NestFactory.create(AppModule);
	const config = app.get<ConfigService<AppConfig, true>>(ConfigService);

	app.enableCors({ origin: config.get('webOrigin', { infer: true }), credentials: true });
	app.useGlobalPipes(
		new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true })
	);
	app.enableShutdownHooks();

	if (config.get('nodeEnv', { infer: true }) !== 'production') {
		const document = SwaggerModule.createDocument(
			app,
			new DocumentBuilder()
				.setTitle('Windy webcams API')
				.setDescription('Camera registry, snapshots and map clusters.')
				.setVersion('0.0.0')
				.build()
		);
		SwaggerModule.setup('docs', app, document);
	}

	await app.listen(config.get('port', { infer: true }));
}

await bootstrap();
