<script lang="ts">
	import CameraOffIcon from '@lucide/svelte/icons/camera-off';
	import type { WebcamsControllerListResponse } from '@webcam-scrapper/api-client';
	import { sourceLabel } from '#lib/webcams.js';

	type Webcam = WebcamsControllerListResponse[number];

	let { webcam }: { webcam: Webcam } = $props();
</script>

<figure class="flex flex-col gap-1.5">
	<div class="aspect-video w-full overflow-hidden rounded-xl bg-muted">
		{#if webcam.frame}
			<img
				src={webcam.frame.url}
				alt={webcam.name}
				loading="lazy"
				decoding="async"
				class="size-full object-cover"
			/>
		{:else}
			<div class="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground">
				<CameraOffIcon class="size-5" />
				<span class="text-xs">No frame yet</span>
			</div>
		{/if}
	</div>
	<figcaption class="flex min-w-0 flex-col">
		<span class="truncate text-sm">{webcam.name}</span>
		<span class="truncate text-xs text-muted-foreground">{sourceLabel(webcam.source)}</span>
	</figcaption>
</figure>
