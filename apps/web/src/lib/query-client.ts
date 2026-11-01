import { browser } from '$app/env';
import { QueryClient } from '@tanstack/svelte-query';

/**
 * One `QueryClient` per layout instance: on the server that is one per request, in the browser it
 * is the client for the lifetime of the page.
 *
 * Queries are disabled during SSR on purpose — the generated client in
 * `@webcam-scrapper/api-client` builds relative URLs, which only resolve in the browser where the
 * request goes through the `/api/*` proxy. Server-side data belongs in a `load` function that uses
 * `event.fetch`, not in a query.
 */
export function createQueryClient(): QueryClient {
	return new QueryClient({
		defaultOptions: {
			queries: {
				enabled: browser,
				staleTime: 30_000,
				refetchOnWindowFocus: false
			}
		}
	});
}
