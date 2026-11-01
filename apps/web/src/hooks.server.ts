import type { Handle } from '@sveltejs/kit/hooks';
import { isApiPath, proxyToApi } from '#lib/server/api-proxy.ts';
import { readSession } from '#lib/server/session.ts';

/**
 * Two jobs, in order:
 * 1. `/api/*` is proxied to the Nest API, so auth calls and the eventual read API are
 *    same-origin for the browser (cookies, no CORS, no API URL in client code).
 * 2. Every other request gets `locals.user` / `locals.session` from the API — documents
 *    and SvelteKit data requests alike, which is what layouts, loads and form actions read.
 */
export const handle: Handle = async ({ event, resolve }) => {
	if (isApiPath(event.url.pathname)) {
		return proxyToApi(event);
	}

	const { snapshot, setCookies } = await readSession(event.request.headers.get('cookie'));
	if (snapshot) {
		event.locals.user = snapshot.user;
		event.locals.session = snapshot.session;
	}

	const response = await resolve(event);
	if (setCookies.length === 0) return response;

	// better-auth rolls the session expiry; pass the refreshed cookie to the browser.
	const headers = new Headers(response.headers);
	for (const cookie of setCookies) headers.append('set-cookie', cookie);

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers
	});
};
