<script lang="ts">
	import { untrack } from 'svelte';
	import { createInfiniteQuery } from '@tanstack/svelte-query';
	import type { WebcamsControllerListResponse } from '@webcam-scrapper/api-client';
	import { webcamsControllerListInfiniteOptions } from '@webcam-scrapper/api-client/svelte-query';
	import { infiniteScroll } from '#lib/actions/infinite-scroll.js';
	import { Skeleton } from '#lib/components/ui/skeleton/index.js';
	import { WEBCAM_PAGE_SIZE, nextWebcamOffset } from '#lib/webcams.js';
	import Tile from '#lib/components/webcams/tile.svelte';

	type Webcam = WebcamsControllerListResponse[number];

	/**
	 * `+page.svelte` remounts this component per filter, so `source` and `initial` are a fixed
	 * snapshot: `untrack` keeps the query from being rebuilt if the props ever change.
	 *
	 * Only the unfiltered feed comes with the server page. A filtered query starts empty and is
	 * fetched in the browser, so it never shows tiles that do not match the filter.
	 */
	let { source, initial }: { source?: string; initial?: { webcams: Webcam[]; loadedAt: number } } =
		$props();

	const query = untrack(() =>
		createInfiniteQuery({
			...webcamsControllerListInfiniteOptions({
				query: { limit: WEBCAM_PAGE_SIZE, source }
			}),
			initialPageParam: 0,
			getNextPageParam: (lastPage, _pages, lastOffset) =>
				nextWebcamOffset(lastPage.length, lastOffset),
			...(initial
				? {
						initialData: { pages: [initial.webcams], pageParams: [0] },
						initialDataUpdatedAt: initial.loadedAt
					}
				: {})
		})
	);

	/** Every location loaded so far, flattened out of the per-page arrays. */
	const webcams: Webcam[] = $derived($query.data?.pages.flat() ?? []);
</script>

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
			<Tile {webcam} />
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
			{#if source}
				No cameras from {source}.
			{:else}
				No cameras yet — seed the catalogue with <code>pnpm seed</code>.
			{/if}
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
