<script lang="ts" module>
	import AudioWaveformIcon from '@lucide/svelte/icons/audio-waveform';
	import CommandIcon from '@lucide/svelte/icons/command';
	import HouseIcon from '@lucide/svelte/icons/house';
	// This is sample data.
	const data = {
		teams: [
			{
				name: 'Acme Inc',
				logo: CommandIcon,
				plan: 'Enterprise'
			},
			{
				name: 'Acme Corp.',
				logo: AudioWaveformIcon,
				plan: 'Startup'
			},
			{
				name: 'Evil Corp.',
				logo: CommandIcon,
				plan: 'Free'
			}
		],
		navMain: [
			{
				title: 'Webcams',
				url: '',
				icon: HouseIcon,
				isActive: true
			}
		],
		navSecondary: []
	};
</script>

<script lang="ts">
	import * as Sidebar from '#lib/components/ui/sidebar/index.js';
	import NavMain from './nav-main.svelte';
	import NavSecondary from './nav-secondary.svelte';
	import TeamSwitcher from './team-switcher.svelte';
	import type { ComponentProps } from 'svelte';

	let { ref = $bindable(null), ...restProps }: ComponentProps<typeof Sidebar.Root> = $props();
</script>

<Sidebar.Root bind:ref class="border-e-0" {...restProps}>
	<Sidebar.Header>
		<TeamSwitcher teams={data.teams} />
		<NavMain items={data.navMain} />
	</Sidebar.Header>
	<Sidebar.Content>
		<NavSecondary items={data.navSecondary} class="mt-auto" />
	</Sidebar.Content>
	<Sidebar.Rail />
</Sidebar.Root>
