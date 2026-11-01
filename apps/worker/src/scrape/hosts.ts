import type { ClaimedCam } from './types.js';

export function groupByHost(cams: ClaimedCam[]): Map<string, ClaimedCam[]> {
	const groups = new Map<string, ClaimedCam[]>();

	for (const cam of cams) {
		let host = 'invalid';
		try {
			host = new URL(cam.retrievalUrl).host;
		} catch {
			host = 'invalid';
		}

		const group = groups.get(host);
		if (group) group.push(cam);
		else groups.set(host, [cam]);
	}

	return groups;
}
