import { fetchJson } from '../lib/http.ts';
import { expander, humanize, withPlace } from '../lib/names.ts';
import type { Catalogue, SeedCam, SeedLocation, SourceAdapter } from '../lib/types.ts';

const DISTRICTS = Array.from({ length: 12 }, (_, index) => index + 1);
const statusUrl = (district: number): string =>
	`https://cwwp2.dot.ca.gov/data/d${district}/cctv/cctvStatusD${String(district).padStart(2, '0')}.json`;

const DEFAULT_POLL_INTERVAL_S = 600;
const MIN_POLL_INTERVAL_S = 600;

const abbreviations = expander({
	blvd: 'Boulevard',
	ave: 'Avenue',
	av: 'Avenue',
	rd: 'Road',
	ln: 'Lane',
	dr: 'Drive',
	pkwy: 'Parkway',
	cyn: 'Canyon',
	onr: 'Onramp',
	offr: 'Offramp'
});

interface CctvEntry {
	cctv: {
		index: string;
		location: {
			district: string;
			locationName: string;
			nearbyPlace: string;
			longitude: string;
			latitude: string;
		};
		inService: string;
		imageData: {
			static: {
				currentImageUpdateFrequency: string;
				currentImageURL: string;
			};
		};
	};
}

/** `hwy5atpocket.jpg` → `hwy5atpocket`; the file name is unique across all twelve districts. */
function imageId(url: string): string | null {
	const name = new URL(url).pathname.split('/').pop();
	if (!name) return null;

	return name.replace(/\.[a-z]+$/i, '');
}

function pollIntervalS(frequencyInMinutes: string): number {
	const minutes = Number(frequencyInMinutes);
	if (!Number.isFinite(minutes) || minutes <= 0) return DEFAULT_POLL_INTERVAL_S;

	return Math.max(minutes * 60, MIN_POLL_INTERVAL_S);
}

export const caltrans: SourceAdapter = {
	id: 'caltrans',
	label: 'Caltrans CWWP2 CCTV',

	async load(): Promise<Catalogue> {
		const districts = await Promise.all(
			DISTRICTS.map((district) => fetchJson<{ data: CctvEntry[] }>(statusUrl(district)))
		);

		const locations: SeedLocation[] = [];
		const cams: SeedCam[] = [];

		for (const { data } of districts) {
			for (const entry of data) {
				const { cctv } = entry;
				const id = imageId(cctv.imageData.static.currentImageURL);
				const long = Number(cctv.location.longitude);
				const lat = Number(cctv.location.latitude);
				if (!id || !Number.isFinite(long) || !Number.isFinite(lat)) continue;

				locations.push({
					source: 'caltrans',
					originalId: id,
					name: withPlace(
						humanize(cctv.location.locationName, abbreviations),
						cctv.location.nearbyPlace
					),
					long,
					lat
				});

				cams.push({
					source: 'caltrans',
					originalId: id,
					locationOriginalId: id,
					retrievalUrl: cctv.imageData.static.currentImageURL,
					inCollection: cctv.inService === 'true',
					pollIntervalS: pollIntervalS(cctv.imageData.static.currentImageUpdateFrequency)
				});
			}
		}

		return { locations, cams };
	}
};
