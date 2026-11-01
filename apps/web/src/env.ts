import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	API_URL: {
		description:
			'Base URL of the Nest API, e.g. `http://localhost:3000`. Server-only: the browser reaches it through the `/api` proxy in `hooks.server.ts`.'
	},
	ORIGIN: {
		description: 'The app origin (base URL), e.g. `http://localhost:5173`.'
	}
});
