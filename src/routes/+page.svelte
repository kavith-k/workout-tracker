<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { ChevronRight } from '@lucide/svelte';

	let { data } = $props();

	let startError = $state('');

	function formatDaysAgo(daysAgo: number): string {
		if (daysAgo === 0) return 'today';
		if (daysAgo === 1) return 'yesterday';
		return `${daysAgo} days ago`;
	}
</script>

<div class="space-y-6">
	<h1 class="text-3xl font-bold tracking-tight">Home</h1>

	{#if data.inProgressWorkout}
		<div
			class="rounded-2xl border border-neon/20 bg-neon/10 p-4"
			data-testid="workout-in-progress-notice"
		>
			<p class="text-sm font-medium text-neon">
				A workout is already in progress. Please finish or stop it before starting a new one.
			</p>
			<Button
				href="/workout/{data.inProgressWorkout.id}"
				variant="outline"
				class="mt-2 min-h-[44px] rounded-xl"
			>
				Resume Workout
			</Button>
		</div>
	{/if}

	{#if !data.activeProgram}
		<div
			class="flex flex-col items-center justify-center gap-3 py-16 text-center"
			data-testid="no-active-program"
		>
			<p class="text-muted-foreground">
				No active program. Set a program as active to start working out.
			</p>
			<Button href="/programs" class="min-h-[44px] rounded-xl">Go to Programs</Button>
		</div>
	{:else}
		<div>
			<div class="flex items-center gap-2">
				<h2 class="text-lg font-semibold" data-testid="active-program-name">
					{data.activeProgram.name}
				</h2>
				<Badge variant="default">Active</Badge>
			</div>

			{#if data.lastWorkout}
				<p class="mt-1 text-sm text-muted-foreground" data-testid="last-workout-info">
					Last workout: {data.lastWorkout.dayName}, {formatDaysAgo(data.lastWorkout.daysAgo)}
				</p>
			{/if}
		</div>

		{#if startError}
			<div
				class="rounded-2xl bg-destructive/10 p-3 text-sm text-destructive"
				data-testid="form-error"
			>
				{startError}
			</div>
		{/if}

		<div data-testid="workout-day-buttons">
			<div class="glass-card overflow-hidden">
				{#each data.activeProgram.days as day (day.id)}
					<form
						method="POST"
						action="/workout/start"
						use:enhance={() => {
							startError = '';
							return async ({ result, update }) => {
								if (result.type === 'failure') {
									startError = (result.data as { error?: string })?.error ?? 'Something went wrong';
								} else {
									await update();
								}
							};
						}}
					>
						<input type="hidden" name="workoutDayId" value={day.id} />
						<button
							type="submit"
							class="flex min-h-[44px] w-full items-center gap-3 border-b border-border/40 px-4 py-3 text-left last:border-b-0 active:bg-muted/60 disabled:opacity-50"
							disabled={!!data.inProgressWorkout}
							data-testid="workout-day-{day.id}"
						>
							<div class="min-w-0 flex-1">
								<p class="font-medium">{day.name}</p>
								<p class="text-xs text-muted-foreground">
									{day.exercises.length} exercise{day.exercises.length !== 1 ? 's' : ''}
								</p>
							</div>
							<ChevronRight class="size-5 shrink-0 text-muted-foreground/40" />
						</button>
					</form>
				{/each}
			</div>
		</div>
	{/if}
</div>
