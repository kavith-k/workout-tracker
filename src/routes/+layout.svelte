<script lang="ts">
	import './layout.css';
	import { onMount } from 'svelte';
	import favicon from '$lib/assets/favicon.svg';
	import AppShell from '$lib/components/layout/AppShell.svelte';
	import { initOfflineListeners } from '$lib/offline/stores.svelte';
	import { setupSyncListeners } from '$lib/offline/sync';
	import { themeStore } from '$lib/stores/theme.svelte';

	let { children, data } = $props();

	onMount(() => {
		themeStore.init();
		const cleanupOffline = initOfflineListeners();
		const cleanupSync = setupSyncListeners();
		return () => {
			cleanupOffline();
			cleanupSync();
		};
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<AppShell inProgressWorkout={data.inProgressWorkout}>
	{@render children()}
</AppShell>
