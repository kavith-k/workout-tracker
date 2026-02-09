<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';

	let { data } = $props();

	const allCompleted = $derived(
		data.summary.totalExercises > 0 &&
			data.summary.completedExercises === data.summary.totalExercises
	);
</script>

<div class="space-y-6" data-testid="workout-summary">
	<div class="text-center">
		<h1 class="text-2xl font-bold">Workout Complete</h1>
		<p class="mt-1 text-muted-foreground">
			{data.summary.programName} — {data.summary.dayName}
		</p>
	</div>

	{#if allCompleted}
		<div
			class="rounded-lg border border-green-600/30 bg-green-50 p-4 text-center dark:bg-green-950/20"
			data-testid="congrats-message"
		>
			<p class="font-semibold text-green-800 dark:text-green-200">
				All exercises completed! Great work.
			</p>
		</div>
	{/if}

	<div class="rounded-lg border border-border p-4" data-testid="exercise-count">
		<p class="text-lg font-semibold">
			{data.summary.completedExercises}/{data.summary.totalExercises} exercises
		</p>
		{#if data.summary.skippedExercises > 0}
			<p class="text-sm text-muted-foreground">
				{data.summary.skippedExercises} skipped
			</p>
		{/if}
	</div>

	{#if data.summary.prs.length > 0}
		<div class="space-y-3" data-testid="pr-list">
			<h2 class="font-semibold">Personal Records</h2>
			{#each data.summary.prs as pr (pr.exerciseName)}
				<div
					class="flex items-center justify-between rounded-lg border border-border p-3"
					data-testid="pr-item"
				>
					<span class="font-medium">{pr.exerciseName}</span>
					<Badge variant="secondary">
						{pr.weight}
						{pr.unit} x {pr.reps}
					</Badge>
				</div>
			{/each}
		</div>
	{/if}

	<div class="flex justify-center pt-4">
		<Button href="/" data-testid="done-btn">Done</Button>
	</div>
</div>
