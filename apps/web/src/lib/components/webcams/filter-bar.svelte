<script module lang="ts">
	/** Select value that means "no provider filter", so `value` can always stay a string. */
	export const ALL_PROVIDERS = 'all';
</script>

<script lang="ts">
	import * as Select from '#lib/components/ui/select/index.js';
	import { sourceLabel } from '#lib/webcams.js';

	let {
		sources,
		value = $bindable(ALL_PROVIDERS),
		onselect
	}: { sources: string[]; value?: string; onselect?: (value: string) => void } = $props();

	/** Rendered here instead of through `Select.Value`, which cannot resolve an item before mount. */
	const label = $derived(value === ALL_PROVIDERS ? 'All providers' : sourceLabel(value));
</script>

<!-- `top-14` clears the sticky app header above it. -->
<div
	class="sticky top-14 z-20 -mx-4 flex items-center gap-3 border-b border-border/60 bg-background px-4 py-2.5"
>
	<Select.Root type="single" bind:value onValueChange={onselect}>
		<Select.Trigger size="sm" class="min-w-44 bg-background" aria-label="Filter by provider">
			{label}
		</Select.Trigger>
		<Select.Content>
			<Select.Item value={ALL_PROVIDERS} label="All providers">All providers</Select.Item>
			{#each sources as source (source)}
				<Select.Item value={source} label={sourceLabel(source)}>{sourceLabel(source)}</Select.Item>
			{/each}
		</Select.Content>
	</Select.Root>
</div>
