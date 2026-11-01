import { fetchJson } from '../lib/http.ts';
import { finnishRoad, humanize } from '../lib/names.ts';
import type { Catalogue, SeedCam, SeedLocation, SourceAdapter } from '../lib/types.ts';

const STATIONS_URL = 'https://tie.digitraffic.fi/api/weathercam/v1/stations';
const IMAGE_URL = 'https://weathercam.digitraffic.fi';
const POLL_INTERVAL_S = 600;

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

export const digitraffic: SourceAdapter = {
	id: 'digitraffic',
	label: 'Fintraffic Digitraffic weather cameras',

	async load(): Promise<Catalogue> {
		const stations = await fetchJson<StationCollection>(STATIONS_URL, {
			'digitraffic-user': 'webcam-scrapper'
		});

		const locations: SeedLocation[] = [];
		const cams: SeedCam[] = [];

		for (const station of stations.features) {
			const coordinates = station.geometry?.coordinates;
			if (!coordinates) continue;

			const [long, lat] = coordinates;
			const { id: locationId, name, presets = [] } = station.properties;

			locations.push({
				source: 'digitraffic',
				originalId: locationId,
				name: finnishRoad(humanize(name)),
				long,
				lat
			});

			for (const preset of presets) {
				cams.push({
					source: 'digitraffic',
					originalId: preset.id,
					locationOriginalId: locationId,
					retrievalUrl: `${IMAGE_URL}/${preset.id}.jpg`,
					inCollection: preset.inCollection,
					pollIntervalS: POLL_INTERVAL_S
				});
			}
		}

		return { locations, cams };
	}
};
