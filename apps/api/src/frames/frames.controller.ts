import { Controller, Get, Header, Param, StreamableFile } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { frameIdParamDto } from '@webcam-scrapper/contracts/dto';
// Value import: `emitDecoratorMetadata` needs the class at runtime for constructor injection.
// oxlint-disable-next-line typescript/consistent-type-imports
import { FramesService } from './frames.service.js';

/**
 * Serves frame bytes, so the browser never learns the storage host or the bucket layout. Frames
 * are immutable once stored (the key carries the content hash), hence the year-long cache.
 */
@ApiTags('frames')
@AllowAnonymous()
@Controller('api/frames')
export class FramesController {
	constructor(private readonly frames: FramesService) {}

	@Get(':id')
	@Header('Cache-Control', 'public, max-age=31536000, immutable')
	@ApiOkResponse({ description: 'The stored frame, with the `Content-Type` it was captured as.' })
	@ApiNotFoundResponse({ description: 'No frame with that id.' })
	async findOne(@Param('id', { schema: frameIdParamDto }) id: string): Promise<StreamableFile> {
		const stored = await this.frames.open(id);

		return new StreamableFile(stored.body, {
			type: stored.contentType,
			length: stored.contentLength
		});
	}
}
