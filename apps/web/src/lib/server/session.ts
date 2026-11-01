import { API_URL } from '$app/env/private';
import type { AuthSession, AuthUser } from '#lib/types/auth.ts';

/** better-auth's default base path — keep in sync with the API's auth config. */
const AUTH_BASE_PATH = '/api/auth';

export interface SessionSnapshot {
	user: AuthUser;
	session: AuthSession;
}

export interface SessionLookup {
	/** `null` when there is no cookie, the session expired, or the API is unreachable. */
	snapshot: SessionSnapshot | null;
	/** `Set-Cookie` values the API returned, e.g. a rolled session expiry. */
	setCookies: string[];
}

const NO_SESSION: SessionLookup = { snapshot: null, setCookies: [] };

/**
 * Reads the current session from the API on the server, forwarding the browser's
 * cookie. A failure to reach the API renders the page logged-out instead of failing
 * the request: the API being down must not take the front end down with it.
 */
export async function readSession(cookie: string | null): Promise<SessionLookup> {
	if (!cookie) return NO_SESSION;

	try {
		const response = await fetch(`${API_URL}${AUTH_BASE_PATH}/get-session`, {
			headers: { cookie, accept: 'application/json' }
		});
		if (!response.ok) return NO_SESSION;

		const body = (await response.json()) as Partial<SessionSnapshot> | null;
		if (!body?.user || !body.session) return NO_SESSION;

		return {
			snapshot: { user: body.user, session: body.session },
			setCookies: response.headers.getSetCookie()
		};
	} catch {
		return NO_SESSION;
	}
}
