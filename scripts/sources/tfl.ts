import { fetchJson } from '../lib/http.ts';
import { expander, humanize, streetSuffixes } from '../lib/names.ts';
import { pollInterval } from '../lib/poll.ts';
import type { Catalogue, SeedCam, SeedLocation, SourceAdapter } from '../lib/types.ts';

const JAMCAMS_URL = 'https://api.tfl.gov.uk/Place/Type/JamCam';
const IMAGE_CADENCE_S = 60;

const abbreviations = expander({
	rd: 'Road',
	ave: 'Avenue',
	av: 'Avenue',
	ln: 'Lane',
	pl: 'Place',
	sq: 'Square',
	cres: 'Crescent',
	cl: 'Close',
	ct: 'Court',
	crt: 'Court',
	dr: 'Drive',
	gdns: 'Gardens',
	grdns: 'Gardens',
	grns: 'Gardens',
	pk: 'Park',
	ter: 'Terrace',
	tce: 'Terrace',
	wk: 'Walk',
	wd: 'Wood',
	grve: 'Grove',
	gr: 'Grove',
	hl: 'Hill',
	cmn: 'Common',
	cmon: 'Common',
	brdg: 'Bridge',
	bdge: 'Bridge',
	brd: 'Bridge',
	brg: 'Bridge',
	grt: 'Great',
	gt: 'Great',
	lwr: 'Lower',
	lr: 'Lower',
	upr: 'Upper',
	nth: 'North',
	nthern: 'Northern',
	sth: 'South',
	wst: 'West',
	emb: 'Embankment',
	embkmt: 'Embankment',
	tnl: 'Tunnel',
	appr: 'Approach',
	jn: 'Junction',
	jnc: 'Junction',
	opp: 'opposite',
	rbt: 'Roundabout',
	rbout: 'Roundabout',
	rdb: 'Roundabout',
	bway: 'Broadway',
	ch: 'Church',
	hosp: 'Hospital',
	sta: 'Station',
	gyr: 'Gyratory',
	circ: 'Circus',
	rb: 'Roundabout',
	upass: 'Underpass'
});

interface JamCam {
	id: string;
	commonName: string;
	lat: number;
	lon: number;
	additionalProperties: { key: string; value: string }[];
}

function property(cam: JamCam, key: string): string | null {
	return cam.additionalProperties.find((entry) => entry.key === key)?.value ?? null;
}

export const tfl: SourceAdapter = {
	id: 'tfl',
	label: 'TfL JamCams',

	async load(): Promise<Catalogue> {
		const places = await fetchJson<JamCam[]>(JAMCAMS_URL);

		const locations: SeedLocation[] = [];
		const cams: SeedCam[] = [];

		for (const place of places) {
			const imageUrl = property(place, 'imageUrl');
			if (!imageUrl || !Number.isFinite(place.lon) || !Number.isFinite(place.lat)) continue;

			const originalId = place.id.replace(/^JamCams_/, '');

			locations.push({
				source: 'tfl',
				originalId,
				name: humanize(place.commonName, (text) => abbreviations(streetSuffixes(text))),
				long: place.lon,
				lat: place.lat
			});

			cams.push({
				source: 'tfl',
				originalId,
				locationOriginalId: originalId,
				retrievalUrl: imageUrl,
				inCollection: property(place, 'available') === 'true',
				pollIntervalS: pollInterval(IMAGE_CADENCE_S)
			});
		}

		return { locations, cams };
	}
};
