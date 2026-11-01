## Project Configuration

- **Language**: TypeScript
- **Package Manager**: pnpm (workspace root: `../..`). This app **runs** on Bun via
  `@sveltejs/adapter-bun` — build with `pnpm build` from the root, never plain `vite build` under Node.
- **Add-ons**: oxlint + oxfmt (repo-level config), tailwindcss, vitest (browser mode), adapter-bun,
  drizzle, better-auth, ai-tools
- **Lint/format**: do not add ESLint or Prettier here. Run `pnpm lint` / `pnpm fmt` at the root;
  Svelte template + a11y rules come from `@rsvelte/oxlint-plugin` (see `.oxlintrc.json`).

---

You are able to use the Svelte MCP server, where you have access to comprehensive Svelte 5 and SvelteKit documentation. Here's how to use the available tools effectively:

## Available Svelte MCP Tools:

### 1. list-sections

Use this FIRST to discover all available documentation sections. Returns a structured list with titles, use_cases, and paths.
When asked about Svelte or SvelteKit topics, ALWAYS use this tool at the start of the chat to find relevant sections.

### 2. get-documentation

Retrieves full documentation content for specific sections. Accepts single or multiple sections.
After calling the list-sections tool, you MUST analyze the returned documentation sections (especially the use_cases field) and then use the get-documentation tool to fetch ALL documentation sections that are relevant for the user's task.

### 3. svelte-autofixer

Analyzes Svelte code and returns issues and suggestions.
You MUST use this tool whenever writing Svelte code before sending it to the user. Keep calling it until no issues or suggestions are returned.

### 4. playground-link

Generates a Svelte Playground link with the provided code.
After completing the code, ask the user if they want a playground link. Only call this tool after user confirmation and NEVER if code was written to files in their project.
