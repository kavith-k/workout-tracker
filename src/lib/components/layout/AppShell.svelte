<script lang="ts">
	import type { Snippet } from 'svelte';
	import TabBar from './TabBar.svelte';
	import ResumeWorkoutBanner from '$lib/components/shared/ResumeWorkoutBanner.svelte';
	import OfflineIndicator from '$lib/components/shared/OfflineIndicator.svelte';

	let {
		children,
		inProgressWorkout = null
	}: {
		children: Snippet;
		inProgressWorkout?: { id: number; dayName: string; programName: string } | null;
	} = $props();
</script>

<div class="flex min-h-svh flex-col">
	<ResumeWorkoutBanner {inProgressWorkout} />

	<main
		class="flex-1 px-5 pt-6"
		style="padding-bottom: calc(5.5rem + env(safe-area-inset-bottom, 0px));"
	>
		{@render children()}
	</main>

	<OfflineIndicator />
	<TabBar />
</div>
