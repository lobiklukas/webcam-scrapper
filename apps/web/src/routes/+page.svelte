<script lang="ts">
	import type { WebcamsControllerListResponse } from '@webcam-scrapper/api-client';
	import type { PageData } from './$types';
	import Feed from '#lib/components/webcams/feed.svelte';
	import FilterBar, { ALL_PROVIDERS } from '#lib/components/webcams/filter-bar.svelte';

	type Webcam = WebcamsControllerListResponse[number];

	let { data }: { data: PageData } = $props();

	/** The select value; `source` is what the API understands, and `undefined` means "no filter". */
	let provider = $state(ALL_PROVIDERS);
	const source = $derived(provider === ALL_PROVIDERS ? undefined : provider);

	/**
	 * Page 0 already came from `+page.ts` on the server, so the unfiltered feed seeds it as
	 * `initialData`: the first paint has real tiles and the browser does not refetch it until it
	 * goes stale. The `{#key}` remount gives every filter its own query and its own cache entry.
	 */
	const initial: { webcams: Webcam[]; loadedAt: number } = $derived({
		webcams: data.webcams,
		loadedAt: data.loadedAt
	});
</script>

<svelte:head>
	<title>Webcams</title>
</svelte:head>

<FilterBar
	sources={data.sources}
	bind:value={provider}
	onselect={() => window.scrollTo({ top: 0 })}
/>

{#key source}
	<Feed {source} initial={source ? undefined : initial} />
{/key}
