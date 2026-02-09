<script lang="ts">
	import type { Snippet } from 'svelte';
	import HamburgerMenu from './HamburgerMenu.svelte';
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
	<header class="sticky top-0 z-40 border-b border-border bg-background">
		<div class="flex h-14 items-center gap-3 px-4">
			<HamburgerMenu />
			<span class="text-lg font-semibold">Workout Tracker</span>
		</div>
	</header>

	<ResumeWorkoutBanner {inProgressWorkout} />

	<main class="flex-1 px-4 py-4">
		{@render children()}
	</main>

	<OfflineIndicator />
</div>
