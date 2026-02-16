<script lang="ts">
	/* eslint-disable svelte/prefer-svelte-reactivity -- Date used for computation only, not reactive state */
	let { workoutDates }: { workoutDates: string[] } = $props();

	const DAYS = ['Mon', '', 'Wed', '', 'Fri', '', ''];
	// Column step: cell (size-3.25 = 0.8125rem) + gap (gap-0.75 = 0.1875rem) = 1rem = 16px
	// Label column + gap: ~2rem = 32px
	const COL_STEP_PX = 16;
	const LABEL_PX = 32;
	const MAX_WEEKS = 52;

	let containerWidth = $state(0);

	let weekCount = $derived(
		containerWidth > 0
			? Math.max(4, Math.min(MAX_WEEKS, Math.floor((containerWidth - LABEL_PX) / COL_STEP_PX)))
			: 0
	);

	let workoutSet = $derived(new Set(workoutDates));

	let grid = $derived.by(() => {
		if (weekCount === 0) return [];

		const today = new Date();
		const todayStr = formatDate(today);

		// Find the most recent Monday (start of current week)
		const dayOfWeek = today.getDay();
		const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
		const currentMonday = new Date(today);
		currentMonday.setDate(today.getDate() - mondayOffset);

		// Go back weekCount-1 more weeks to get the start
		const startMonday = new Date(currentMonday);
		startMonday.setDate(currentMonday.getDate() - (weekCount - 1) * 7);

		const weeks: Array<{
			days: Array<{ date: string; hasWorkout: boolean; isToday: boolean; isFuture: boolean }>;
			monthLabel: string | null;
		}> = [];

		for (let w = 0; w < weekCount; w++) {
			const weekStart = new Date(startMonday);
			weekStart.setDate(startMonday.getDate() + w * 7);

			const days: Array<{
				date: string;
				hasWorkout: boolean;
				isToday: boolean;
				isFuture: boolean;
			}> = [];

			for (let d = 0; d < 7; d++) {
				const cellDate = new Date(weekStart);
				cellDate.setDate(weekStart.getDate() + d);
				const dateStr = formatDate(cellDate);
				days.push({
					date: dateStr,
					hasWorkout: workoutSet.has(dateStr),
					isToday: dateStr === todayStr,
					isFuture: cellDate > today
				});
			}

			// Show month label if this week contains the 1st of a month
			let monthLabel: string | null = null;
			for (const day of days) {
				if (day.date.endsWith('-01')) {
					const d = new Date(day.date + 'T00:00:00');
					monthLabel = d.toLocaleDateString('en-GB', { month: 'short' });
					break;
				}
			}
			// Also label the very first week
			if (w === 0 && !monthLabel) {
				const d = new Date(days[0].date + 'T00:00:00');
				monthLabel = d.toLocaleDateString('en-GB', { month: 'short' });
			}

			weeks.push({ days, monthLabel });
		}

		return weeks;
	});

	function formatDate(d: Date): string {
		const year = d.getFullYear();
		const month = String(d.getMonth() + 1).padStart(2, '0');
		const day = String(d.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}
</script>

<div bind:clientWidth={containerWidth} class="pb-1">
	{#if weekCount > 0}
		<div class="inline-grid gap-0.75" style="grid-template-columns: auto repeat({weekCount}, 1fr);">
			<!-- Month labels row -->
			<div></div>
			{#each grid as week, wi (wi)}
				<div class="flex h-4 items-end text-[10px] leading-none text-muted-foreground">
					{#if week.monthLabel}
						{week.monthLabel}
					{/if}
				</div>
			{/each}

			<!-- Grid rows (one per day of week) -->
			{#each DAYS as dayLabel, dayIndex (dayIndex)}
				<!-- Day label -->
				<div
					class="flex items-center justify-end pr-1 text-[10px] leading-none text-muted-foreground"
				>
					{dayLabel}
				</div>

				<!-- Day cells -->
				{#each grid as week, wi (wi)}
					{@const day = week.days[dayIndex]}
					<div
						class="size-3.25 rounded-[3px] {day.isFuture
							? 'bg-transparent'
							: day.isToday
								? day.hasWorkout
									? 'bg-primary ring-1 ring-primary/50 ring-offset-1 ring-offset-background'
									: 'bg-muted ring-1 ring-muted-foreground/30 ring-offset-1 ring-offset-background'
								: day.hasWorkout
									? 'bg-primary'
									: 'bg-muted'}"
						title={day.date}
					></div>
				{/each}
			{/each}
		</div>
	{/if}
</div>
