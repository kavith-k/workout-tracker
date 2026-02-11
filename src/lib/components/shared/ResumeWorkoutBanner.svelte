<script lang="ts">
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button';

	let {
		inProgressWorkout = null
	}: {
		inProgressWorkout?: { id: number; dayName: string; programName: string } | null;
	} = $props();

	let isOnWorkoutPage = $derived(page.url.pathname.startsWith('/workout/'));
	let showBanner = $derived(inProgressWorkout && !isOnWorkoutPage);
</script>

{#if showBanner}
	<div
		class="border-b border-yellow-600/20 bg-yellow-50/80 px-5 py-2.5 backdrop-blur-sm dark:bg-yellow-950/20"
		data-testid="resume-workout-banner"
	>
		<div class="flex items-center justify-between">
			<p class="text-sm font-medium text-yellow-800 dark:text-yellow-200">
				Workout in progress: {inProgressWorkout!.dayName}
			</p>
			<Button
				href="/workout/{inProgressWorkout!.id}"
				variant="outline"
				size="sm"
				class="min-h-[44px] rounded-xl">Resume</Button
			>
		</div>
	</div>
{/if}
