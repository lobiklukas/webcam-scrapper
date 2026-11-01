<script lang="ts">
	import * as Sidebar from '#lib/components/ui/sidebar/index.js';
	import Logo from './logo.svelte';
	import type { ComponentProps } from 'svelte';

	let { ref = $bindable(null), ...restProps }: ComponentProps<typeof Sidebar.Root> = $props();
</script>

<Sidebar.Root bind:ref class="border-e-0" {...restProps}>
	<Sidebar.Header>
		<Sidebar.Menu>
			<Sidebar.MenuItem>
				<Sidebar.MenuButton class="hover:bg-transparent">
					{#snippet child({ props })}
						<a href="/" {...props}>
							<Logo />
						</a>
					{/snippet}
				</Sidebar.MenuButton>
			</Sidebar.MenuItem>
		</Sidebar.Menu>
	</Sidebar.Header>
	<Sidebar.Rail />
</Sidebar.Root>
