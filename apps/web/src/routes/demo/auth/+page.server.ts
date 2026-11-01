import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => {
	if (!event.locals.user) {
		return redirect(302, '/demo/auth/login');
	}
	return { user: event.locals.user };
};

export const actions: Actions = {
	signOut: async (event) => {
		// Relative URL: goes through the `/api/*` proxy, so SvelteKit forwards the
		// cleared session cookie to the browser for us.
		await event.fetch('/api/auth/sign-out', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({})
		});

		return redirect(302, '/demo/auth/login');
	}
};
