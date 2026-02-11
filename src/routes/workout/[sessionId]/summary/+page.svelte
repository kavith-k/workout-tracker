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
		<h1 class="text-3xl font-bold">Workout Complete</h1>
		<p class="mt-1 text-muted-foreground">
			{data.summary.programName} — {data.summary.dayName}
		</p>
	</div>

	{#if allCompleted}
		<div class="rounded-2xl bg-neon/10 p-4 text-center" data-testid="congrats-message">
			<p class="font-semibold text-neon">All exercises completed! Great work.</p>
		</div>
	{/if}

	<div class="glass-card p-4" data-testid="exercise-count">
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
		<div data-testid="pr-list">
			<h2 class="mb-2 font-semibold">Personal Records</h2>
			<div class="glass-card overflow-hidden">
				{#each data.summary.prs as pr (pr.exerciseName)}
					<div
						class="flex items-center justify-between border-b border-border/40 p-3 last:border-b-0"
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
		</div>
	{/if}

	<div class="flex justify-center pt-4">
		<Button href="/" class="min-h-[44px] rounded-xl" data-testid="done-btn">Done</Button>
	</div>
</div>
