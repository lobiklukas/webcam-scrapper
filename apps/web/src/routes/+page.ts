import { error } from '@sveltejs/kit';
import { webcamsControllerList, webcamsControllerListSources } from '@webcam-scrapper/api-client';
import { WEBCAM_PAGE_SIZE } from '#lib/webcams.js';
import type { PageLoad } from './$types';

/**
 * Loads the first page on the server, so the feed is in the HTML instead of a skeleton, together
 * with the provider ids the filter offers.
 *
 * `fetch` is SvelteKit's: the requests are handled internally and go through the `/api/*` proxy in
 * `hooks.server.ts` like any other, cookies included. `baseUrl` has to be absolute because the
 * generated client builds a `Request`, and Node refuses a relative URL there.
 *
 * Universal rather than `+page.server.ts`, so client-side navigation to `/` gets a fresh first page
 * through the same code path. `+page.svelte` seeds the infinite query with this page as
 * `initialData`, so the browser does not ask for it again straight away. The filter itself is not a
 * URL parameter: picking a provider only swaps the query, it never reruns this load.
 */
export const load: PageLoad = async ({ fetch, url }) => {
	const baseUrl = url.origin;

	const [list, sources] = await Promise.all([
		webcamsControllerList({ baseUrl, fetch, query: { limit: WEBCAM_PAGE_SIZE } }),
		webcamsControllerListSources({ baseUrl, fetch })
	]);

	if (list.error) {
		error(502, `The webcam API answered ${list.response?.status ?? 'nothing'}`);
	}

	if (sources.error) {
		error(502, `The webcam API answered ${sources.response?.status ?? 'nothing'}`);
	}

	return {
		webcams: list.data ?? [],
		sources: sources.data ?? [],
		/** When the page was fetched; the query uses it as `initialDataUpdatedAt` for staleness. */
		loadedAt: Date.now()
	};
};
