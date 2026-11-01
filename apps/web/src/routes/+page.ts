import { error } from '@sveltejs/kit';
import { webcamsControllerList } from '@webcam-scrapper/api-client';
import { WEBCAM_PAGE_SIZE } from '#lib/webcams.js';
import type { PageLoad } from './$types';

/**
 * Loads the first page on the server, so the feed is in the HTML instead of a skeleton.
 *
 * `fetch` is SvelteKit's: the request is handled internally and goes through the `/api/*` proxy in
 * `hooks.server.ts` like any other, cookies included. `baseUrl` has to be absolute because the
 * generated client builds a `Request`, and Node refuses a relative URL there.
 *
 * Universal rather than `+page.server.ts`, so client-side navigation to `/` gets a fresh first page
 * through the same code path. `+page.svelte` seeds the infinite query with this page as
 * `initialData`, so the browser does not ask for it again straight away.
 */
export const load: PageLoad = async ({ fetch, url }) => {
	const {
		data,
		error: apiError,
		response
	} = await webcamsControllerList({
		baseUrl: url.origin,
		fetch,
		query: { limit: WEBCAM_PAGE_SIZE }
	});

	if (apiError) {
		error(502, `The webcam API answered ${response?.status ?? 'nothing'}`);
	}

	return {
		webcams: data ?? [],
		/** When the page was fetched; the query uses it as `initialDataUpdatedAt` for staleness. */
		loadedAt: Date.now()
	};
};
