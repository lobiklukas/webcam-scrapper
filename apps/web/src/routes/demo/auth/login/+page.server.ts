import { fail, redirect } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

interface AuthErrorBody {
	message?: string;
	code?: string;
}

export const load: PageServerLoad = (event) => {
	if (event.locals.user) {
		return redirect(302, '/demo/auth');
	}
	return {};
};

/**
 * Posts to the API through the `/api/*` proxy. better-auth answers with a
 * `Set-Cookie` the proxy passes back, and SvelteKit stores it on the browser
 * response because the request is a same-origin internal fetch.
 */
async function authenticate(
	event: RequestEvent,
	endpoint: 'sign-in/email' | 'sign-up/email',
	body: Record<string, string>
) {
	const response = await event.fetch(`/api/auth/${endpoint}`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body)
	});

	if (!response.ok) {
		const error = (await response.json().catch(() => null)) as AuthErrorBody | null;
		return fail(400, {
			message: error?.message ?? 'Authentication failed'
		});
	}

	return redirect(302, '/demo/auth');
}

export const actions: Actions = {
	signInEmail: async (event) => {
		const formData = await event.request.formData();
		return authenticate(event, 'sign-in/email', {
			email: formData.get('email')?.toString() ?? '',
			password: formData.get('password')?.toString() ?? ''
		});
	},
	signUpEmail: async (event) => {
		const formData = await event.request.formData();
		return authenticate(event, 'sign-up/email', {
			email: formData.get('email')?.toString() ?? '',
			password: formData.get('password')?.toString() ?? '',
			name: formData.get('name')?.toString() ?? ''
		});
	}
};
