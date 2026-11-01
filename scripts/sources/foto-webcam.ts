import { fetchText } from '../lib/http.ts';
import { humanize } from '../lib/names.ts';
import { pollInterval } from '../lib/poll.ts';
import type { Catalogue, SeedCam, SeedLocation, SourceAdapter } from '../lib/types.ts';

const INDEX_URL = 'https://www.foto-webcam.eu/';
const METADATA_START = 'var metadata= new Object(';
const HOST = 'www.foto-webcam.eu';
const PARTNER_PREFIX = '/webcam/tmp/partner/';
const SIZE = /\/(?:150|180|240|320|400|640|720|1200)\.jpg$/;

interface FotoCam {
	id: string;
	name: string;
	title: string;
	imgurl: string;
	latitude: number;
	longitude: number;
	captureInterval: number;
	offline: boolean;
	hidden: boolean;
}

/**
 * foto-webcam serves its own cameras at eight sizes and documents 1200px as the largest, but it
 * only proxies a 400px thumbnail for partner cameras, which are hosted elsewhere. The advertised
 * `imgurl` is therefore kept for partners and upgraded only where the size list is known to hold.
 */
export function imageUrl(cam: { imgurl: string }): string {
	const url = new URL(cam.imgurl);
	const hosted = url.host === HOST && !url.pathname.startsWith(PARTNER_PREFIX);

	return hosted ? cam.imgurl.replace(SIZE, '/1200.jpg') : cam.imgurl;
}

/**
 * The index page has no API, but it embeds the whole catalogue in `var metadata= new Object({…})`
 * next to the HTML. The object is found by brace counting rather than by regex, because the
 * titles and keywords it carries contain both braces and quotes.
 */
export function readMetadata(html: string): FotoCam[] {
	const start = html.indexOf(METADATA_START);
	if (start < 0) throw new Error('foto-webcam: metadata block not found');

	const from = start + METADATA_START.length;
	let depth = 0;
	let inString = false;
	let escaped = false;

	for (let index = from; index < html.length; index += 1) {
		const char = html.charAt(index);

		if (inString) {
			if (escaped) escaped = false;
			else if (char === '\\') escaped = true;
			else if (char === '"') inString = false;
			continue;
		}

		if (char === '"') {
			inString = true;
		} else if (char === '{') {
			depth += 1;
		} else if (char === '}') {
			depth -= 1;
			if (depth === 0) {
				const parsed: { cams: FotoCam[] } = JSON.parse(html.slice(from, index + 1));
				return parsed.cams;
			}
		}
	}

	throw new Error('foto-webcam: metadata block is not terminated');
}

export const fotoWebcam: SourceAdapter = {
	id: 'foto-webcam',
	label: 'foto-webcam.eu',

	async load(): Promise<Catalogue> {
		const cams = readMetadata(await fetchText(INDEX_URL));

		const locations: SeedLocation[] = [];
		const retrievalCams: SeedCam[] = [];

		for (const cam of cams) {
			if (cam.hidden) continue;
			if (!Number.isFinite(cam.latitude) || !Number.isFinite(cam.longitude)) continue;

			locations.push({
				source: 'foto-webcam',
				originalId: cam.id,
				name: humanize(cam.name),
				long: cam.longitude,
				lat: cam.latitude
			});

			retrievalCams.push({
				source: 'foto-webcam',
				originalId: cam.id,
				locationOriginalId: cam.id,
				retrievalUrl: imageUrl(cam),
				inCollection: !cam.offline,
				pollIntervalS: pollInterval(cam.captureInterval)
			});
		}

		return { locations, cams: retrievalCams };
	}
};
