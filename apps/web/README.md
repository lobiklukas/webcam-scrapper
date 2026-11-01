# @webcam-scrapper/web

SvelteKit front end: camera map, player, management UI. Part of the repo described in
[`../../README.md`](../../README.md) — run commands from the repo root.

- Dev server: <http://localhost:5173> (`pnpm dev --filter @webcam-scrapper/web`)
- Production build (`@sveltejs/adapter-node`): `pnpm build`, then `pnpm start`
  (`node --env-file-if-exists=.env build`, serves on `PORT` from `.env`)
- Env vars are validated at build time and at boot — a missing value fails fast at startup

This app has **no database and no auth code**. The Nest API owns both; this app is a client:

- `src/hooks.server.ts` proxies `/api/*` to `API_URL`, so the browser only ever sees `:5173` and the
  session cookie belongs to this origin.
- The same hook fills `locals.user` / `locals.session` from `GET /api/auth/get-session`, so loads and
  form actions read the session on the server.
- Form actions post to the API with `event.fetch('/api/auth/…')` — SvelteKit forwards the `Set-Cookie`
  the API returns.
- `/demo/auth` is the login / sign-up / sign-out example; it uses exactly those two mechanisms.

Client-side data comes from the generated client in `@webcam-scrapper/api-client` (fetch client + SDK

- TanStack Query options, rebuilt with `pnpm gen:api`). `src/routes/+layout.svelte` wraps the app in a
  `QueryClientProvider` built by `src/lib/query-client.ts`; queries are disabled during SSR, so server
  data still belongs in `load` functions using `event.fetch`. Because the client uses a relative base
  URL and every generated path starts with `/api`, requests land on the proxy above — no `API_URL` in
  client code.

Env (`.env`, copy `.env.example`): `PORT`, `API_URL` (base URL of the API, e.g.
`http://localhost:3000`), `ORIGIN`.
