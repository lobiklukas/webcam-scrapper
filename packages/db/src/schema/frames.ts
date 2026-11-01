import { index, integer, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { cam } from './webcams.js';

export const frame = pgTable(
	'frame',
	{
		id: uuid().primaryKey().defaultRandom(),
		camId: integer('cam_id')
			.notNull()
			.references(() => cam.id, { onDelete: 'cascade' }),
		capturedAt: timestamp('captured_at', { withTimezone: true }).notNull(),
		storageKey: text('storage_key').notNull(),
		sha256: text().notNull(),
		bytes: integer().notNull(),
		contentType: text('content_type').notNull(),
		etag: text(),
		lastModified: text('last_modified'),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
	},
	(table) => [
		unique('frame_cam_sha256_unique').on(table.camId, table.sha256),
		unique('frame_cam_captured_at_unique').on(table.camId, table.capturedAt),
		index('frame_cam_captured_at_idx').on(table.camId, table.capturedAt.desc())
	]
);

export const pollAttempt = pgTable(
	'poll_attempt',
	{
		id: uuid().primaryKey().defaultRandom(),
		camId: integer('cam_id')
			.notNull()
			.references(() => cam.id, { onDelete: 'cascade' }),
		startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
		durationMs: integer('duration_ms'),
		status: text().notNull(),
		httpStatus: integer('http_status'),
		bytes: integer(),
		error: text()
	},
	(table) => [
		index('poll_attempt_cam_started_at_idx').on(table.camId, table.startedAt.desc()),
		index('poll_attempt_status_started_at_idx').on(table.status, table.startedAt.desc())
	]
);
