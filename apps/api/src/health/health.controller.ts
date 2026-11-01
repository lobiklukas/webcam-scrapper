import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { HealthDto } from './health.dto.js';

@ApiTags('health')
@AllowAnonymous()
@Controller('health')
export class HealthController {
	@Get()
	@ApiOkResponse({ type: HealthDto, description: 'The API process is up.' })
	check(): HealthDto {
		return {
			status: 'ok',
			uptime: Math.round(process.uptime()),
			timestamp: new Date().toISOString()
		};
	}
}
