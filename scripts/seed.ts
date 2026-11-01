import { sql } from 'drizzle-orm';
import { cam, createDb, location } from '@webcam-scrapper/db';

const STATIONS_URL = 'https://tie.digitraffic.fi/api/weathercam/v1/stations';
const IMAGE_URL_PREFIX = 'https://weathercam.digitraffic.fi';

interface StationPreset {
	id: string;
	inCollection: boolean;
}

interface StationFeature {
	properties: {
		id: string;
		name: string;
		presets?: StationPreset[];
	};
	geometry: {
		/** `[lon, lat, height]`, WGS 84. */
		coordinates: [number, number, number?];
	} | null;
}

interface StationCollection {
	features: StationFeature[];
}

async function fetchStations(): Promise<StationCollection> {
	const response = await fetch(STATIONS_URL, {
		headers: {
			// Digitraffic answers 406 without gzip and asks clients to identify themselves.
			'Accept-Encoding': 'gzip',
			'Digitraffic-User': 'webcam-scrapper'
		}
	});

	if (!response.ok) {
		throw new Error(`GET ${STATIONS_URL} failed: ${response.status} ${response.statusText}`);
	}

	return (await response.json()) as StationCollection;
}

function toLocationRow(station: StationFeature) {
	const coordinates = station.geometry?.coordinates;
	if (!coordinates) return [];
	const [long, lat] = coordinates;

	return [
		{
			originalId: station.properties.id,
			name: station.properties.name,
			long,
			lat
		}
	];
}

function toCamRows(station: StationFeature) {
	return (station.properties.presets ?? []).map((preset) => ({
		originalId: preset.id,
		locationOriginalId: station.properties.id,
		retrievalUrl: `${IMAGE_URL_PREFIX}/${preset.id}.jpg`,
		inCollection: preset.inCollection
	}));
}

/**
 * Downloads the Digitraffic weathercam catalogue and upserts it into `location` and `cam`.
 * Re-runnable: rows are matched on `original_id`, so existing ids are updated instead of duplicated.
 * Rows whose upstream camera disappeared are left alone.
 */
export async function seed() {
	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) {
		throw new Error('DATABASE_URL is not set; export it or run `pnpm seed` from the repo root');
	}

	const stations = (await fetchStations()).features;
	const locationRows = stations.flatMap(toLocationRow);
	const camRows = stations.flatMap(toCamRows);

	const { db, close } = createDb(databaseUrl);

	try {
		const counts = await db.transaction(async (tx) => {
			const savedLocations = await tx
				.insert(location)
				.values(locationRows)
				.onConflictDoUpdate({
					target: location.originalId,
					set: {
						name: sql`excluded.name`,
						long: sql`excluded.long`,
						lat: sql`excluded.lat`,
						updatedAt: sql`now()`
					}
				})
				.returning({ id: location.id, originalId: location.originalId });

			const locationIds = new Map(savedLocations.map((row) => [row.originalId, row.id]));
			const rows = camRows.flatMap((row) => {
				const locationId = locationIds.get(row.locationOriginalId);
				if (locationId === undefined) return [];
				const { locationOriginalId: _, ...values } = row;
				return [{ ...values, locationId }];
			});

			const savedCams = await tx
				.insert(cam)
				.values(rows)
				.onConflictDoUpdate({
					target: cam.originalId,
					set: {
						locationId: sql`excluded.location_id`,
						retrievalUrl: sql`excluded.retrieval_url`,
						inCollection: sql`excluded.in_collection`,
						updatedAt: sql`now()`
					}
				})
				.returning({ id: cam.id });

			return { locations: savedLocations.length, cams: savedCams.length };
		});

		console.log(`Seeded ${counts.locations} locations and ${counts.cams} cams`);
	} finally {
		await close();
	}
}

await seed();
