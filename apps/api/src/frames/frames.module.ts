import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../config/configuration.js';
import { FramesController } from './frames.controller.js';
import { FRAME_STORAGE, FramesService } from './frames.service.js';
import { S3ObjectStorage } from './frames.storage.js';

@Module({
	controllers: [FramesController],
	providers: [
		FramesService,
		{
			provide: FRAME_STORAGE,
			inject: [ConfigService],
			useFactory: (config: ConfigService<AppConfig, true>) =>
				new S3ObjectStorage(config.get('storage', { infer: true }))
		}
	]
})
export class FramesModule {}
