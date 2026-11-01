import { sql } from 'drizzle-orm';
import { cam, createDb, location, type Database } from '@webcam-scrapper/db';
import { SOURCES, SOURCE_IDS } from './sources/index.ts';
import type { Catalogue, SourceAdapter, SourceId } from './lib/types.ts';

/** Postgres has a parameter cap and the districts alone are thousands of rows. */
const CHUNK_SIZE = 500;

const key = (source: string, originalId: string): string => `${source}\u0000${originalId}`;

function chunks<T>(rows: readonly T[]): T[][] {
	const batches: T[][] = [];
	for (let index = 0; index < rows.length; index += CHUNK_SIZE) {
		batches.push(rows.slice(index, index + CHUNK_SIZE));
	}

	return batches;
}

/** `pnpm seed [--] <source>…` or `SEED_SOURCES=caltrans,tfl`; every source when neither is given. */
function selectedSources(args: readonly string[]): SourceAdapter[] {
	const requested =
		args.length > 0
			? args
			: (process.env.SEED_SOURCES ?? '')
					.split(/[\s,]+/)
					.map((id) => id.trim())
					.filter(Boolean);

	if (requested.length === 0) return [...SOURCES];

	const unknown = requested.filter((id) => !SOURCE_IDS.includes(id as SourceId));
	if (unknown.length > 0) {
		throw new Error(
			`Unknown source ${unknown.join(', ')}; known sources: ${SOURCE_IDS.join(', ')}`
		);
	}

	return SOURCES.filter((source) => requested.includes(source.id));
}

async function saveCatalogue(database: Database, { locations, cams }: Catalogue) {
	const locationIds = new Map<string, number>();

	return database.transaction(async (tx) => {
		let savedLocations = 0;

		for (const batch of chunks(locations)) {
			// oxlint-disable-next-line eslint/no-await-in-loop -- one transaction, so the batches are serial
			const saved = await tx
				.insert(location)
				.values(batch)
				.onConflictDoUpdate({
					target: [location.source, location.originalId],
					set: {
						name: sql`excluded.name`,
						long: sql`excluded.long`,
						lat: sql`excluded.lat`,
						updatedAt: sql`now()`
					}
				})
				.returning({ id: location.id, source: location.source, originalId: location.originalId });

			for (const row of saved) locationIds.set(key(row.source, row.originalId), row.id);
			savedLocations += saved.length;
		}

		const rows = cams.flatMap((row) => {
			const locationId = locationIds.get(key(row.source, row.locationOriginalId));
			if (locationId === undefined) return [];

			return [
				{
					source: row.source,
					originalId: row.originalId,
					locationId,
					retrievalUrl: row.retrievalUrl,
					inCollection: row.inCollection,
					pollIntervalS: row.pollIntervalS,
					nextPollAt: sql`now() + random() * interval '600 seconds'`
				}
			];
		});

		let savedCams = 0;

		for (const batch of chunks(rows)) {
			// oxlint-disable-next-line eslint/no-await-in-loop -- one transaction, so the batches are serial
			const saved = await tx
				.insert(cam)
				.values(batch)
				.onConflictDoUpdate({
					target: [cam.source, cam.originalId],
					set: {
						locationId: sql`excluded.location_id`,
						retrievalUrl: sql`excluded.retrieval_url`,
						inCollection: sql`excluded.in_collection`,
						pollIntervalS: sql`excluded.poll_interval_s`,
						updatedAt: sql`now()`
					}
				})
				.returning({ id: cam.id });

			savedCams += saved.length;
		}

		return { locations: savedLocations, cams: savedCams };
	});
}

/**
 * Reads the public camera catalogues and upserts them into `location` and `cam`. Re-runnable: rows
 * are matched on `(source, original_id)`, so existing ids are updated instead of duplicated, and a
 * camera that disappeared upstream is left alone. Each source is its own transaction, so one broken
 * provider does not roll back the others; it does abort the run.
 */
export async function seed(args: readonly string[]) {
	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) {
		throw new Error('DATABASE_URL is not set; export it or run `pnpm seed` from the repo root');
	}

	const adapters = selectedSources(args);
	const { db, close } = createDb(databaseUrl);
	const totals = { locations: 0, cams: 0 };

	try {
		const saved = await Promise.all(
			adapters.map(async (adapter) => ({
				label: adapter.label,
				counts: await saveCatalogue(db, await adapter.load())
			}))
		);

		for (const { label, counts } of saved) {
			totals.locations += counts.locations;
			totals.cams += counts.cams;
			console.log(`${label}: ${counts.locations} locations, ${counts.cams} cams`);
		}

		console.log(`Seeded ${totals.locations} locations and ${totals.cams} cams`);
	} finally {
		await close();
	}
}

await seed(process.argv.slice(2));
