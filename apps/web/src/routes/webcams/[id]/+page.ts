import { error } from '@sveltejs/kit';
import { framesControllerList, webcamsControllerFindOne } from '@webcam-scrapper/api-client';
import {
	FRAME_LIMIT,
	dayEnd,
	dayStart,
	defaultFrameWindow,
	isDay,
	type FrameWindow
} from '#lib/frames.js';
import type { PageLoad } from './$types';

/**
 * The timeline window is a query parameter, not component state: `?from=&to=` is what the page
 * loads, so the player is server-rendered, a link to a day is shareable and the back button works.
 * A malformed or inverted range falls back to the default instead of failing the page.
 */
function resolveRange(params: URLSearchParams): FrameWindow {
	const fallback = defaultFrameWindow();
	const from = params.get('from') ?? fallback.from;
	const to = params.get('to') ?? fallback.to;

	return isDay(from) && isDay(to) && from <= to ? { from, to } : fallback;
}

/**
 * Loads the location and its frames for the selected camera and window, so the first paint has a
 * photo. `baseUrl` is absolute because the generated client builds a `Request`.
 */
export const load: PageLoad = async ({ fetch, url, params }) => {
	const id = Number(params.id);
	if (!Number.isInteger(id)) error(404, 'No such webcam');

	const {
		data: webcam,
		error: apiError,
		response
	} = await webcamsControllerFindOne({ baseUrl: url.origin, fetch, path: { id } });

	if (apiError || !webcam) {
		error(response?.status === 404 ? 404 : 502, 'The webcam API could not answer');
	}

	const selected = url.searchParams.get('cam');
	const cam = webcam.cams.find((entry) => String(entry.id) === selected) ?? webcam.cams[0] ?? null;
	const range = resolveRange(url.searchParams);

	if (!cam) return { webcam, camId: null, range, frames: [] };

	const { data: frames } = await framesControllerList({
		baseUrl: url.origin,
		fetch,
		query: { camId: cam.id, from: dayStart(range.from), to: dayEnd(range.to), limit: FRAME_LIMIT }
	});

	return { webcam, camId: cam.id, range, frames: frames ?? [] };
};
