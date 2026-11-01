import { API_URL } from '$app/env/private';
import type { RequestEvent } from '@sveltejs/kit';

/** Body-parsing and connection headers that must not be copied between the two hops. */
const HOP_BY_HOP = new Set([
	'connection',
	'content-encoding',
	'content-length',
	'keep-alive',
	'transfer-encoding',
	'upgrade'
]);

/** true for the paths the API owns; the browser never talks to the API directly. */
export function isApiPath(pathname: string): boolean {
	return pathname === '/api' || pathname.startsWith('/api/');
}

/**
 * Forwards `/api/*` to the Nest API and copies the response back.
 *
 * The whole auth surface (`/api/auth/**`) goes through here, so the session cookie
 * belongs to this origin: no cookie domain, no CORS, and SvelteKit can read the
 * session on the server with the same cookie the browser sends.
 */
export async function proxyToApi(event: RequestEvent): Promise<Response> {
	const url = new URL(event.url.pathname + event.url.search, API_URL);
	const headers = new Headers(event.request.headers);
	headers.set('host', url.host);

	const method = event.request.method;
	const body =
		method === 'GET' || method === 'HEAD' ? undefined : await event.request.arrayBuffer();

	const upstream = await fetch(url, { method, headers, body, redirect: 'manual' });

	const responseHeaders = new Headers();
	for (const [name, value] of upstream.headers) {
		if (!HOP_BY_HOP.has(name.toLowerCase())) responseHeaders.append(name, value);
	}
	// `Set-Cookie` can repeat and cannot be represented by a single header value.
	responseHeaders.delete('set-cookie');
	for (const cookie of upstream.headers.getSetCookie()) {
		responseHeaders.append('set-cookie', cookie);
	}

	return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
}
