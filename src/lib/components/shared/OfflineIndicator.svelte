<script lang="ts">
	import { offlineState } from '$lib/offline/stores.svelte';
</script>

{#if !offlineState.isOnline || offlineState.pendingSyncCount > 0}
	<div class="fixed right-4 bottom-4 z-50 rounded-full bg-gray-800 px-3 py-1 text-sm text-white">
		{#if !offlineState.isOnline}
			Offline
		{:else if offlineState.pendingSyncCount > 0}
			Syncing {offlineState.pendingSyncCount}...
		{/if}
	</div>
{/if}
