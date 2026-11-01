# @webcam-scrapper/api-client — generated from the API's OpenAPI document

Typed fetch client, SDK functions and TanStack Query options for `apps/api`. **Everything in
`src/client/` is generated** by [`@hey-api/openapi-ts`](https://heyapi.dev); only the config file and
this README are hand-written.

```
packages/contracts/openapi.json     ← written by `pnpm gen:api` (apps/api boots and exports it)
  └→ src/client/                    ← written by `@hey-api/openapi-ts`
       index.ts                     SDK functions + types (`webcamsControllerList`, `WebcamDto`…)
       client.gen.ts                the fetch client instance (`client.setConfig({ … })`)
       @tanstack/svelte-query.gen.ts  query options + query keys
```

## Regenerating

From the repo root, after changing a controller, a DTO in `packages/contracts`, or the Swagger setup:

```sh
pnpm gen:api
```

It builds `packages/contracts`, builds and boots `apps/api` headlessly to write
`packages/contracts/openapi.json`, then runs `openapi-ts` here. The output is formatted with oxfmt and
**committed**, so `pnpm build`, `pnpm check` and `pnpm test` never need a running API. Do not edit
files under `src/client/` — the next generation overwrites them.

## Consuming it

```ts
import { webcamsControllerList } from '@webcam-scrapper/api-client';
import { webcamsControllerListOptions } from '@webcam-scrapper/api-client/svelte-query';
import { client } from '@webcam-scrapper/api-client/client';

// TanStack Query (the app wraps every page in a QueryClientProvider, see apps/web)
const options = webcamsControllerListOptions({ query: { q: 'inkoo', limit: 20 } });

// plain call
const { data } = await webcamsControllerList({ query: { limit: 20 } });

// global client config: base URL, auth header, interceptors
client.setConfig({ headers: { 'x-example': 'value' } });
```

## Why it works in the browser without CORS

Every path in the document starts with `/api` (the controllers are mounted at `/api/…`), and the
generated client uses a relative `baseUrl`. In `apps/web` that means the request goes to the web
origin and is proxied to Nest by `src/lib/server/api-proxy.ts` — no API URL, no CORS, and the
session cookie stays on one origin. The fetch client is bundled into the output, so the only runtime
dependency is `@tanstack/svelte-query`.

## Config

`openapi-ts.config.ts` picks the plugins: bundled fetch client, `typescript`, `sdk`, and
`@tanstack/svelte-query` (query options + query keys). Add or tune plugins there, then run
`pnpm gen:api` again; `src/client` is ignored by oxlint (`.oxlintrc.json`) because it is generated.
