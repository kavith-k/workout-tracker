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

<div class="space-y-6">
	<h1 class="text-3xl font-bold tracking-tight">History</h1>

	<div class="flex rounded-xl bg-muted p-1" data-testid="view-toggle">
		<a
			href={resolve('/history')}
			class="flex min-h-[36px] flex-1 items-center justify-center rounded-lg px-3 text-sm font-medium text-muted-foreground"
		>
			By Date
		</a>
		<span
			class="flex min-h-[36px] flex-1 items-center justify-center rounded-lg bg-card px-3 text-sm font-medium text-foreground shadow-sm"
		>
			By Exercise
		</span>
	</div>

	{#if data.exercises.length === 0}
		<div
			class="flex flex-col items-center justify-center gap-3 py-16 text-center"
			data-testid="empty-state"
		>
			<p class="text-muted-foreground">
				No exercise history yet. Complete a workout to see it here.
			</p>
		</div>
	{:else}
		<div class="overflow-hidden rounded-2xl bg-card shadow-xs">
			{#each data.exercises as exercise (exercise.id)}
				<div
					data-testid="exercise-history-item"
					class="flex min-h-[44px] items-center border-b border-border/40 px-4 py-3 last:border-b-0"
				>
					<div class="min-w-0 flex-1">
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
				</div>
			{/each}
		</div>
	{/if}
</div>
