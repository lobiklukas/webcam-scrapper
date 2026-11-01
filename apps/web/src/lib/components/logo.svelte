<script lang="ts">
	import { cn } from '#lib/utils.js';

	let { class: className }: { class?: string } = $props();
</script>

<span class={cn('flex items-center gap-2 font-semibold tracking-tight', className)}>
	<svg viewBox="0 0 24 24" class="size-5 shrink-0" aria-hidden="true">
		<rect x="1" y="1" width="22" height="22" rx="7" class="fill-foreground" />
		<circle cx="12" cy="12" r="5.5" fill="none" stroke-width="1.7" class="stroke-background" />
		<circle cx="12" cy="12" r="2" class="fill-background" />
	</svg>
	<span class="truncate">Webcams</span>
</span>
