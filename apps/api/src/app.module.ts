import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DrizzleModule } from '@nestjs/drizzle';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { createDb } from '@webcam-scrapper/db';
import { createAuth } from './auth/auth.js';
import configuration, { type AppConfig } from './config/configuration.js';
import { DB, type AppDatabase } from './db/db.js';
import { HealthModule } from './health/health.module.js';

@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true,
			cache: true,
			load: [configuration]
		}),
		// Registers the drizzle client globally under `getDrizzleToken()` / `@InjectDrizzle()`
		// and closes the pool on shutdown. `db:` because postgres.js takes a client, not a URL.
		DrizzleModule.forRootAsync({
			inject: [ConfigService],
			useFactory: (config: ConfigService<AppConfig, true>) => ({
				db: createDb(config.get('databaseUrl', { infer: true })).db
			})
		}),
		AuthModule.forRootAsync({
			inject: [DB, ConfigService],
			useFactory: (database: AppDatabase, config: ConfigService<AppConfig, true>) => ({
				auth: createAuth({
					database,
					baseURL: config.get('apiOrigin', { infer: true }),
					secret: config.get('betterAuthSecret', { infer: true }),
					trustedOrigins: [config.get('webOrigin', { infer: true })]
				})
			})
		}),
		HealthModule
	]
})
export class AppModule {}
