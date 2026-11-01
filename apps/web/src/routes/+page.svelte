<script lang="ts">
	import { createInfiniteQuery } from '@tanstack/svelte-query';
	import type { WebcamsControllerListResponse } from '@webcam-scrapper/api-client';
	import { webcamsControllerListInfiniteOptions } from '@webcam-scrapper/api-client/svelte-query';
	import { infiniteScroll } from '#lib/actions/infinite-scroll.js';
	import { Skeleton } from '#lib/components/ui/skeleton/index.js';

	/** Cards per request; also the page size `getNextPageParam` uses to detect the last page. */
	const PAGE_SIZE = 24;

	/**
	 * The generated helper turns `pageParam` into `?offset=`, so all this adds is when to stop:
	 * a page shorter than PAGE_SIZE means the catalogue is exhausted.
	 * Queries are browser-only (see `src/lib/query-client.ts`), so the first page arrives after
	 * hydration.
	 */
	const query = createInfiniteQuery({
		...webcamsControllerListInfiniteOptions({ query: { limit: PAGE_SIZE } }),
		initialPageParam: 0,
		getNextPageParam: (lastPage, _pages, lastOffset) => {
			if (lastPage.length < PAGE_SIZE) return undefined;
			return (typeof lastOffset === 'number' ? lastOffset : 0) + PAGE_SIZE;
		}
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
