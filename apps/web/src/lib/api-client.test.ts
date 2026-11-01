import { describe, expect, it } from 'vitest';
import { webcamsControllerList } from '@webcam-scrapper/api-client';
import { client } from '@webcam-scrapper/api-client/client';
import { webcamsControllerListQueryKey } from '@webcam-scrapper/api-client/svelte-query';

/**
 * Guards the generated client in `packages/api-client`: the package is consumed from source, so
 * this also proves Vite resolves it and that the paths still line up with the `/api/*` proxy.
 */
describe('generated API client', () => {
	it('requests the proxied path with the query', async () => {
		const requested: string[] = [];
		client.setConfig({
			baseUrl: 'http://localhost',
			fetch: (request) => {
				requested.push(request instanceof Request ? request.url : String(request));
				return Promise.resolve(Response.json([]));
			}
		});

		await webcamsControllerList({ query: { limit: 5 } });

		expect(requested).toEqual(['http://localhost/api/webcams?limit=5']);
	});

	it('builds a TanStack Query key from the same parameters', () => {
		const [queryKey] = webcamsControllerListQueryKey({ query: { q: 'inkoo' } });

		expect(queryKey).toMatchObject({ _id: 'webcamsControllerList', query: { q: 'inkoo' } });
	});
});
