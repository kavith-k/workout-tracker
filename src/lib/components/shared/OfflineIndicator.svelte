<script lang="ts">
	import { offlineState } from '$lib/offline/stores.svelte';
</script>

{#if !offlineState.isOnline || offlineState.pendingSyncCount > 0}
	<div
		class="fixed right-4 z-50 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground shadow-lg backdrop-blur-sm"
		style="bottom: calc(5rem + env(safe-area-inset-bottom, 0px));"
	>
		{#if !offlineState.isOnline}
			Offline
		{:else if offlineState.pendingSyncCount > 0}
			Syncing {offlineState.pendingSyncCount}...
		{/if}
	</div>
{/if}
