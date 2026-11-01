import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/**
 * Builds the OpenAPI document for this API. `main.ts` serves it at `/docs`, and
 * `src/tools/generate-openapi.ts` writes it to `packages/contracts/openapi.json` so
 * `@hey-api/openapi-ts` can generate `packages/api-client` from the same shape.
 */
export function createOpenApiDocument(app: INestApplication) {
	return SwaggerModule.createDocument(
		app,
		new DocumentBuilder()
			.setTitle('Windy webcams API')
			.setDescription('Camera registry, snapshots and map clusters.')
			.setVersion('0.0.0')
			.build()
	);
}
