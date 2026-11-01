import { sql } from 'drizzle-orm';
import {
	boolean,
	doublePrecision,
	index,
	integer,
	pgTable,
	text,
	timestamp,
	uniqueIndex
} from 'drizzle-orm/pg-core';

/**
 * `location` and `cam` ids are only unique inside their provider, so `source` is part of both
 * tables and of their natural keys: two providers may publish the same `original_id`.
 */
export const location = pgTable(
	'location',
	{
		id: integer().primaryKey().generatedAlwaysAsIdentity(),
		source: text().notNull(),
		originalId: text('original_id').notNull(),
		name: text().notNull(),
		long: doublePrecision('long').notNull(),
		lat: doublePrecision('lat').notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull()
	},
	(table) => [uniqueIndex('location_source_original_id_idx').on(table.source, table.originalId)]
);

export const cam = pgTable(
	'cam',
	{
		id: integer().primaryKey().generatedAlwaysAsIdentity(),
		source: text().notNull(),
		originalId: text('original_id').notNull(),
		locationId: integer('location_id')
			.notNull()
			.references(() => location.id, { onDelete: 'cascade' }),
		retrievalUrl: text('retrieval_url'),
		inCollection: boolean('in_collection').default(true).notNull(),
		pollIntervalS: integer('poll_interval_s').default(600).notNull(),
		nextPollAt: timestamp('next_poll_at', { withTimezone: true }).defaultNow().notNull(),
		enabled: boolean().default(true).notNull(),
		failureCount: integer('failure_count').default(0).notNull(),
		lastSha256: text('last_sha256'),
		lastEtag: text('last_etag'),
		lastModified: text('last_modified'),
		lastOkAt: timestamp('last_ok_at', { withTimezone: true }),
		lastFrameAt: timestamp('last_frame_at', { withTimezone: true }),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull()
	},
	(table) => [
		index('cam_location_id_idx').on(table.locationId),
		index('cam_due_idx')
			.on(table.nextPollAt)
			.where(sql`enabled and retrieval_url is not null`),
		uniqueIndex('cam_source_original_id_idx').on(table.source, table.originalId)
	]
);
