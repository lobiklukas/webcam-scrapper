import {
	boolean,
	doublePrecision,
	index,
	integer,
	pgTable,
	text,
	timestamp
} from 'drizzle-orm/pg-core';

/**
 * A camera site: one mast or station that groups one or more camera views.
 * `originalId` is the id the upstream source uses (a Digitraffic station id), which makes it
 * the natural key the scraper upserts on.
 */
export const location = pgTable('location', {
	id: integer().primaryKey().generatedAlwaysAsIdentity(),
	originalId: text('original_id').notNull().unique(),
	name: text('name').notNull(),
	/** Longitude in decimal degrees, WGS 84. */
	long: doublePrecision('long').notNull(),
	/** Latitude in decimal degrees, WGS 84. */
	lat: doublePrecision('lat').notNull(),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at')
		.defaultNow()
		.$onUpdate(() => /* @__PURE__ */ new Date())
		.notNull()
});

/**
 * One camera view on a location. `originalId` is the upstream preset id; `retrievalUrl` is where
 * the frame is downloaded from.
 */
export const cam = pgTable(
	'cam',
	{
		id: integer().primaryKey().generatedAlwaysAsIdentity(),
		originalId: text('original_id').notNull().unique(),
		locationId: integer('location_id')
			.notNull()
			.references(() => location.id, { onDelete: 'cascade' }),
		retrievalUrl: text('retrieval_url'),
		/** Whether the upstream source still publishes this view. */
		inCollection: boolean('in_collection').default(true).notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull()
	},
	(table) => [index('cam_location_id_idx').on(table.locationId)]
);
