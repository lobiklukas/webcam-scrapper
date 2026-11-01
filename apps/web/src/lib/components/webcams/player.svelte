<script lang="ts">
	import PauseIcon from '@lucide/svelte/icons/pause';
	import PlayIcon from '@lucide/svelte/icons/play';
	import SquareIcon from '@lucide/svelte/icons/square';
	import { Button } from '#lib/components/ui/button/index.js';
	import { FRAME_INTERVAL_MS, captureTime, type Frame } from '#lib/frames.js';

	let { frames, alt }: { frames: Frame[]; alt: string } = $props();

	let index = $state(0);
	let playing = $state(false);

	const current = $derived(frames[index] ?? frames[0] ?? null);
	const last = $derived(Math.max(frames.length - 1, 0));
	const oldest = $derived(frames[0] ?? null);
	const newest = $derived(frames[last] ?? null);

	$effect(() => {
		if (!playing) return;

		const timer = setInterval(() => {
			if (index >= frames.length - 1) {
				playing = false;
				return;
			}

			index += 1;
		}, FRAME_INTERVAL_MS);

		return () => clearInterval(timer);
	});

	// The next few frames are prefetched, otherwise playback waits on the network for every image.
	$effect(() => {
		for (const frame of frames.slice(index + 1, index + 4)) {
			new Image().src = frame.url;
		}
	});

	function toggle() {
		if (frames.length === 0) return;
		if (!playing && index >= frames.length - 1) index = 0;

		playing = !playing;
	}

	function stop() {
		playing = false;
		index = 0;
	}
</script>

<div class="flex flex-col gap-3">
	<div class="aspect-video w-full overflow-hidden rounded-xl bg-muted">
		{#if current}
			<img src={current.url} {alt} class="size-full object-cover" />
		{:else}
			<p
				class="flex size-full items-center justify-center px-6 text-center text-sm text-muted-foreground"
			>
				No frames in this window.
			</p>
		{/if}
	</div>

	<div class="flex flex-wrap items-center justify-between gap-2">
		<div class="flex items-center gap-2">
			<Button size="icon" variant="outline" onclick={toggle} disabled={frames.length === 0}>
				{#if playing}
					<PauseIcon />
				{:else}
					<PlayIcon />
				{/if}
				<span class="sr-only">{playing ? 'Pause' : 'Play'}</span>
			</Button>
			<Button size="icon" variant="outline" onclick={stop} disabled={frames.length === 0}>
				<SquareIcon />
				<span class="sr-only">Stop</span>
			</Button>
		</div>

		<span class="text-xs text-muted-foreground tabular-nums">
			{current ? captureTime(current.capturedAt) : '—'}
		</span>
	</div>

	<div class="flex flex-col gap-1">
		<input
			type="range"
			min="0"
			max={last}
			step="1"
			value={index}
			disabled={frames.length < 2}
			aria-label="Timeline"
			class="h-7 w-full accent-primary"
			oninput={(event) => {
				index = Number(event.currentTarget.value);
			}}
		/>

		<div class="flex justify-between gap-2 text-xs text-muted-foreground tabular-nums">
			<span>From {oldest ? captureTime(oldest.capturedAt) : '—'}</span>
			<span>To {newest ? captureTime(newest.capturedAt) : '—'}</span>
		</div>
	</div>
</div>
