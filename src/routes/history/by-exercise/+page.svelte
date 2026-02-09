<script lang="ts">
	import { resolve } from '$app/paths';

	let { data } = $props();

	function formatRelativeDate(date: Date): string {
		const now = new Date();
		const diffMs = now.getTime() - new Date(date).getTime();
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
		if (diffDays === 0) return 'Today';
		if (diffDays === 1) return 'Yesterday';
		if (diffDays < 30) return `${diffDays} days ago`;
		return new Date(date).toLocaleDateString('en-GB', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}
</script>

<div class="space-y-4">
	<h1 class="text-2xl font-bold">History</h1>

	<div class="flex gap-1 rounded-lg bg-muted p-1" data-testid="view-toggle">
		<a
			href={resolve('/history')}
			class="flex-1 rounded-md bg-muted px-3 py-1.5 text-center text-sm font-medium text-muted-foreground hover:bg-muted/80"
		>
			By Date
		</a>
		<span
			class="flex-1 rounded-md bg-foreground px-3 py-1.5 text-center text-sm font-medium text-background"
		>
			By Exercise
		</span>
	</div>

	{#if data.exercises.length === 0}
		<div
			class="flex flex-col items-center justify-center gap-4 py-12 text-center"
			data-testid="empty-state"
		>
			<p class="text-muted-foreground">
				No exercise history yet. Complete a workout to see it here.
			</p>
		</div>
	{:else}
		<div class="space-y-3">
			{#each data.exercises as exercise (exercise.id)}
				<div data-testid="exercise-history-item" class="rounded-lg border border-border p-4">
					<p class="font-medium">{exercise.name}</p>
					<div class="mt-1 space-y-0.5 text-sm text-muted-foreground">
						<p data-testid="exercise-session-count">
							{exercise.sessionCount}
							{exercise.sessionCount === 1 ? 'session' : 'sessions'}
						</p>
						<p data-testid="exercise-last-performed">
							Last performed: {exercise.lastPerformed
								? formatRelativeDate(exercise.lastPerformed)
								: 'Never'}
						</p>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
