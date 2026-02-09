<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';

	let { data } = $props();

	function formatDaysAgo(daysAgo: number): string {
		if (daysAgo === 0) return 'today';
		if (daysAgo === 1) return 'yesterday';
		return `${daysAgo} days ago`;
	}
</script>

<div class="space-y-6">
	<h1 class="text-2xl font-bold">Home</h1>

	{#if data.inProgressWorkout}
		<div
			class="rounded-lg border border-yellow-600/30 bg-yellow-50 p-4 dark:bg-yellow-950/20"
			data-testid="workout-in-progress-notice"
		>
			<p class="text-sm font-medium text-yellow-800 dark:text-yellow-200">
				A workout is already in progress. Please finish or stop it before starting a new one.
			</p>
			<Button href="/workout/{data.inProgressWorkout.id}" variant="outline" class="mt-2">
				Resume Workout
			</Button>
		</div>
	{/if}

	{#if !data.activeProgram}
		<div
			class="flex flex-col items-center justify-center gap-4 py-12 text-center"
			data-testid="no-active-program"
		>
			<p class="text-muted-foreground">
				No active program. Set a program as active to start working out.
			</p>
			<Button href="/programs">Go to Programs</Button>
		</div>
	{:else}
		<div>
			<div class="flex items-center gap-2">
				<h2 class="text-lg font-semibold" data-testid="active-program-name">
					{data.activeProgram.name}
				</h2>
				<Badge variant="secondary">Active</Badge>
			</div>

			{#if data.lastWorkout}
				<p class="mt-1 text-sm text-muted-foreground" data-testid="last-workout-info">
					Last workout: {data.lastWorkout.dayName}, {formatDaysAgo(data.lastWorkout.daysAgo)}
				</p>
			{/if}
		</div>

		<div class="grid gap-3" data-testid="workout-day-buttons">
			{#each data.activeProgram.days as day (day.id)}
				<form method="POST" action="/workout/start">
					<input type="hidden" name="workoutDayId" value={day.id} />
					<Button
						type="submit"
						variant="outline"
						class="h-auto w-full justify-start px-4 py-3 text-left"
						disabled={!!data.inProgressWorkout}
						data-testid="workout-day-{day.id}"
					>
						<div>
							<p class="font-medium">{day.name}</p>
							<p class="text-xs text-muted-foreground">
								{day.exercises.length} exercise{day.exercises.length !== 1 ? 's' : ''}
							</p>
						</div>
					</Button>
				</form>
			{/each}
		</div>
	{/if}
</div>
