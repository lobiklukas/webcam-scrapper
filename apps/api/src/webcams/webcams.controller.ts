import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import {
	listWebcamsQueryDto,
	webcamDto,
	webcamIdParamDto,
	webcamListItemDto,
	type ListWebcamsQuery,
	type WebcamDto,
	type WebcamListItemDto
} from '@webcam-scrapper/contracts/dto';
// Value import: `emitDecoratorMetadata` needs the class at runtime for constructor injection.
// oxlint-disable-next-line typescript/consistent-type-imports
import { WebcamsService } from './webcams.service.js';

/**
 * Public read API. The path carries the `/api` prefix because the SvelteKit app reaches the API
 * through its `/api/*` proxy, which forwards the path unchanged (same reason better-auth lives at
 * `/api/auth`). Browsing cameras needs no session, hence `@AllowAnonymous()`.
 */
@ApiTags('webcams')
@AllowAnonymous()
@Controller('api/webcams')
export class WebcamsController {
	constructor(private readonly webcams: WebcamsService) {}

	@Get()
	@ApiOkResponse({
		standardSchema: webcamListItemDto,
		isArray: true,
		description: 'Locations matching the filter, each with a camera and its newest frame.'
	})
	list(
		@Query({ schema: listWebcamsQueryDto }) query: ListWebcamsQuery
	): Promise<WebcamListItemDto[]> {
		return this.webcams.list(query);
	}

	@Get(':id')
	@ApiOkResponse({ standardSchema: webcamDto, description: 'One location with its cameras.' })
	@ApiNotFoundResponse({ description: 'No location with that id.' })
	findOne(@Param('id', { schema: webcamIdParamDto }) id: number): Promise<WebcamDto> {
		return this.webcams.findOne(id);
	}
}
