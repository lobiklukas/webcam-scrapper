import { Module } from '@nestjs/common';
import { WebcamsController } from './webcams.controller.js';
import { WebcamsService } from './webcams.service.js';

@Module({
	controllers: [WebcamsController],
	providers: [WebcamsService]
})
export class WebcamsModule {}
