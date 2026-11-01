import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { createOpenApiDocument } from '../openapi.js';

/**
 * Writes the OpenAPI document that `@hey-api/openapi-ts` turns into `packages/api-client`.
 * Run through `pnpm gen:openapi`, which builds first and then executes this compiled file: Nest's
 * DI relies on the decorator metadata only `tsc` emits, so a transpile-only runner (tsx) would
 * boot without it. The document is built from decorators, so dummy credentials are enough and
 * nothing connects to Postgres.
 */
process.env.DATABASE_URL ??= 'postgres://root:root@localhost:5432/local';
process.env.BETTER_AUTH_SECRET ??= 'generate-openapi-placeholder-secret-32ch';

const outputPath = fileURLToPath(
	new URL('../../../../packages/contracts/openapi.json', import.meta.url)
);

const app = await NestFactory.create(AppModule, { bodyParser: false, logger: ['error'] });
await app.init();

const document = createOpenApiDocument(app);
await writeFile(outputPath, `${JSON.stringify(document, null, '\t')}\n`);

await app.close();

// oxlint-disable-next-line no-console -- this is a CLI tool, its output is the point.
console.log(`OpenAPI document written to ${outputPath}`);
