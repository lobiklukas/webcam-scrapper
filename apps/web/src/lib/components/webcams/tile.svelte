<script lang="ts">
	let { name }: { name: string } = $props();
</script>

<div class="flex flex-col gap-2">
	<div class="aspect-video w-full rounded-xl bg-muted" title={name}></div>
	<span>
		{name}
	</span>
</div>
