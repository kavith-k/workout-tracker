<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';

	let { data } = $props();

	const allCompleted = $derived(
		data.summary.totalExercises > 0 &&
			data.summary.completedExercises === data.summary.totalExercises
	);

	function formatDuration(minutes: number | null): string {
		if (minutes == null) return '--';
		if (minutes < 1) return '<1 min';
		if (minutes < 60) return `${minutes} min`;
		const h = Math.floor(minutes / 60);
		const m = minutes % 60;
		return m > 0 ? `${h}h ${m}m` : `${h}h`;
	}

	function formatVolume(volume: number): string {
		if (volume === 0) return '0';
		if (volume >= 1000) return `${(volume / 1000).toFixed(1).replace(/\.0$/, '')}k`;
		return volume.toLocaleString();
	}
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
			<p class="font-semibold text-neon">All exercises completed. Great work.</p>
		</div>
	{/if}

	<!-- Stats grid -->
	<div class="grid grid-cols-2 gap-3" data-testid="workout-stats">
		<div class="glass-card p-4 text-center">
			<p class="text-2xl font-bold" data-testid="stat-exercises">
				{data.summary.completedExercises}/{data.summary.totalExercises}
			</p>
			<p class="text-xs text-muted-foreground">Exercises</p>
		</div>
		<div class="glass-card p-4 text-center">
			<p class="text-2xl font-bold" data-testid="stat-sets">
				{data.summary.totalSets}
			</p>
			<p class="text-xs text-muted-foreground">Sets</p>
		</div>
		<div class="glass-card p-4 text-center">
			<p class="text-2xl font-bold" data-testid="stat-duration">
				{formatDuration(data.summary.durationMinutes)}
			</p>
			<p class="text-xs text-muted-foreground">Duration</p>
		</div>
		<div class="glass-card p-4 text-center">
			<p class="text-2xl font-bold" data-testid="stat-volume">
				{formatVolume(data.summary.totalVolume)} kg
			</p>
			<p class="text-xs text-muted-foreground">Volume</p>
		</div>
	</div>

	{#if data.summary.skippedExercises > 0}
		<p class="text-center text-sm text-muted-foreground" data-testid="skipped-count">
			{data.summary.skippedExercises} exercise{data.summary.skippedExercises !== 1 ? 's' : ''} skipped
		</p>
	{/if}

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
