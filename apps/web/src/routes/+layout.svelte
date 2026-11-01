<script lang="ts">
	import { QueryClientProvider } from '@tanstack/svelte-query';
	import { ModeWatcher } from 'mode-watcher';
	import * as Breadcrumb from '#lib/components/ui/breadcrumb/index.js';
	import * as Sidebar from '#lib/components/ui/sidebar/index.js';
	import { createQueryClient } from '#lib/query-client.js';
	import type { LayoutProps } from './$types';

	import { Separator } from '#lib/components/ui/separator/index.js';
	import AppSidebar from '#lib/components/app-sidebar.svelte';
	import ModeToggle from '#lib/components/mode-toggle.svelte';

	import './layout.css';

	let { children }: LayoutProps = $props();

	// Server: one client per request. Browser: one client for the page's lifetime.
	const queryClient = createQueryClient();
</script>

<ModeWatcher />

<QueryClientProvider client={queryClient}>
	<Sidebar.Provider>
		<AppSidebar />
		<Sidebar.Inset>
			<header
				class="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border/60 bg-background"
			>
				<div class="flex flex-1 items-center gap-2 px-3">
					<Sidebar.Trigger />
					<Separator
						orientation="vertical"
						class="me-2 data-vertical:h-4 data-vertical:self-auto"
					/>
					<Breadcrumb.Root>
						<Breadcrumb.List>
							<Breadcrumb.Item>
								<Breadcrumb.Page class="line-clamp-1">Webcams</Breadcrumb.Page>
							</Breadcrumb.Item>
						</Breadcrumb.List>
					</Breadcrumb.Root>
				</div>
				<div class="px-3">
					<ModeToggle />
				</div>
			</header>
			<div class="flex flex-1 flex-col gap-4 px-4 py-2">
				{@render children()}
			</div>
		</Sidebar.Inset>
	</Sidebar.Provider>
</QueryClientProvider>
