<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { Button } from '#lib/components/ui/button/index.js';
	import { sourceLabel } from '#lib/webcams.js';
	import Player from '#lib/components/webcams/player.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const views = $derived(data.webcam.cams.length);

	/** Every control rewrites the URL, which is what makes `+page.ts` reload the frames. */
	function navigate(next: { cam?: number; from?: string; to?: string }) {
		const params = new URLSearchParams();
		const cam = next.cam ?? data.camId;
		if (cam !== null) params.set('cam', String(cam));
		params.set('from', next.from ?? data.range.from);
		params.set('to', next.to ?? data.range.to);

		goto(`${page.url.pathname}?${params}`, { reset: false });
	}
</script>

<svelte:head>
	<title>{data.webcam.name} · Webcams</title>
</svelte:head>

<div class="flex flex-col gap-4">
	<div class="flex flex-wrap items-end justify-between gap-3">
		<div class="flex flex-col gap-0.5">
			<h1 class="text-lg font-semibold">{data.webcam.name}</h1>
			<p class="text-xs text-muted-foreground">
				{sourceLabel(data.webcam.source)} · {views}
				{views === 1 ? 'camera' : 'cameras'}
			</p>
		</div>

		{#if views > 1}
			<div class="flex flex-wrap gap-1">
				{#each data.webcam.cams as cam, position (cam.id)}
					<Button
						variant={cam.id === data.camId ? 'default' : 'outline'}
						size="sm"
						onclick={() => navigate({ cam: cam.id })}
					>
						View {position + 1}
					</Button>
				{/each}
			</div>
		{/if}
	</div>

	{#if data.camId === null}
		<p class="text-sm text-muted-foreground">This webcam has no camera views yet.</p>
	{:else}
		{#key `${data.camId}-${data.range.from}-${data.range.to}`}
			<Player frames={data.frames} alt={data.webcam.name} />
		{/key}
	{/if}

	<div class="flex flex-wrap items-end gap-3 text-xs">
		<label class="flex flex-col gap-1">
			<span class="text-muted-foreground">From</span>
			<input
				type="date"
				value={data.range.from}
				max={data.range.to}
				class="h-7 rounded-md border border-input bg-background px-2"
				onchange={(event) => navigate({ from: event.currentTarget.value })}
			/>
		</label>
		<label class="flex flex-col gap-1">
			<span class="text-muted-foreground">To</span>
			<input
				type="date"
				value={data.range.to}
				min={data.range.from}
				class="h-7 rounded-md border border-input bg-background px-2"
				onchange={(event) => navigate({ to: event.currentTarget.value })}
			/>
		</label>
		<a class="pb-1 text-muted-foreground underline-offset-4 hover:underline" href="/">All webcams</a
		>
	</div>
</div>
