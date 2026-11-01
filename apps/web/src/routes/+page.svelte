<script lang="ts">
	import { untrack } from 'svelte';
	import { createInfiniteQuery } from '@tanstack/svelte-query';
	import type { WebcamsControllerListResponse } from '@webcam-scrapper/api-client';
	import { webcamsControllerListInfiniteOptions } from '@webcam-scrapper/api-client/svelte-query';
	import { infiniteScroll } from '#lib/actions/infinite-scroll.js';
	import { Skeleton } from '#lib/components/ui/skeleton/index.js';
	import { WEBCAM_PAGE_SIZE, nextWebcamOffset } from '#lib/webcams.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	/**
	 * Page 0 already came from `+page.ts` on the server, so it is seeded as `initialData`: the first
	 * paint has real tiles and the browser does not refetch it until it goes stale.
	 * Further pages are fetched in the browser only (see `src/lib/query-client.ts`).
	 *
	 * `untrack` on purpose: this is a one-off snapshot. If `data` changes later (client-side
	 * navigation back to `/`), the query must not be rebuilt underneath the user.
	 */
	const serverPage = untrack(() => ({
		pages: [data.webcams],
		pageParams: [0],
		loadedAt: data.loadedAt
	}));

	const query = createInfiniteQuery({
		...webcamsControllerListInfiniteOptions({ query: { limit: WEBCAM_PAGE_SIZE } }),
		initialPageParam: 0,
		getNextPageParam: (lastPage, _pages, lastOffset) =>
			nextWebcamOffset(lastPage.length, lastOffset),
		initialData: { pages: serverPage.pages, pageParams: serverPage.pageParams },
		initialDataUpdatedAt: serverPage.loadedAt
	});

	type Webcam = WebcamsControllerListResponse[number];

	/** Every location loaded so far, flattened out of the per-page arrays. */
	const webcams: Webcam[] = $derived($query.data?.pages.flat() ?? []);
</script>

<svelte:head>
	<title>Webcams</title>
</svelte:head>

{#if $query.isPending}
	<div class="grid grid-flow-row grid-cols-3 gap-4">
		{#each { length: 12 } as _, index (index)}
			<div class="aspect-video w-full rounded-xl bg-muted"><Skeleton class="h-full w-full" /></div>
		{/each}
	</div>
{:else if $query.isError}
	<div
		class="flex max-w-xl flex-col items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-6"
	>
		<p class="text-sm font-medium">Could not load the cameras.</p>
		<p class="text-sm text-muted-foreground">{$query.error.message}</p>
		<button
			type="button"
			class="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-accent"
			onclick={() => $query.refetch()}
		>
			Retry
		</button>
	</div>
{:else}
	<div class="grid grid-flow-row grid-cols-3 gap-4">
		{#each webcams as webcam (webcam.id)}
			<!--
				TODO: render the rest. `webcam` is WebcamSummaryDto:
				{ id, originalId, name, long, lat, camCount }
			-->
			<div class="aspect-video w-full rounded-xl bg-muted" title={webcam.name}></div>
		{/each}

		{#if $query.isFetchingNextPage}
			{#each { length: 6 } as _, index (index)}
				<div class="aspect-video w-full rounded-xl bg-muted">
					<Skeleton class="h-full w-full" />
				</div>
			{/each}
		{/if}
	</div>

	{#if webcams.length === 0}
		<p class="mt-4 text-sm text-muted-foreground">
			No cameras yet — seed the catalogue with <code>pnpm seed</code>.
		</p>
	{/if}
{/if}

<!--
	Loads the next page as soon as this sentinel is within 600px of the viewport; it stays disabled
	while a page is in flight and once the catalogue ends.
-->
<div
	class="h-px w-full"
	use:infiniteScroll={{
		onReachEnd: () => $query.fetchNextPage(),
		disabled: !$query.hasNextPage || $query.isFetchingNextPage
	}}
></div>
