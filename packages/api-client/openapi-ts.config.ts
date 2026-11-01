import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
	input: '../contracts/openapi.json',
	output: {
		path: './src/client',
		// Repo tooling is oxc (AGENTS.md), so generated code is formatted by the same formatter.
		postProcess: ['oxfmt']
	},
	plugins: [
		{
			// Fetches from the current origin, i.e. through the SvelteKit `/api/*` proxy: every path
			// in the document already starts with `/api`. The client is bundled into the output, so
			// no runtime dependency on `@hey-api/client-fetch`.
			name: '@hey-api/client-fetch',
			bundle: true
		},
		'@hey-api/typescript',
		'@hey-api/sdk',
		{
			name: '@tanstack/svelte-query',
			queryOptions: true,
			queryKeys: true
		}
	]
});
