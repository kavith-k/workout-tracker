<script lang="ts">
	/* eslint-disable svelte/prefer-svelte-reactivity -- Date used for computation only, not reactive state */
	import { tick } from 'svelte';

	let { workoutDates }: { workoutDates: string[] } = $props();

	const DAYS = ['Mon', '', 'Wed', '', 'Fri', '', ''];
	const CELL_SIZE_PX = 14;
	const GAP_PX = 3;
	const COL_STEP_PX = CELL_SIZE_PX + GAP_PX;
	const LABEL_PX = 32;

	let scrollContainer: HTMLDivElement;

	let weekCount = $derived.by(() => {
		if (workoutDates.length === 0) return 0;

		// Find the earliest date in the data
		const sorted = [...workoutDates].sort();
		const earliest = new Date(sorted[0] + 'T00:00:00');
		const today = new Date();

		// Calculate weeks between earliest date and now
		const dayOfWeek = today.getDay();
		const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
		const currentMonday = new Date(today);
		currentMonday.setDate(today.getDate() - mondayOffset);

		const diffMs = currentMonday.getTime() - earliest.getTime();
		const diffWeeks = Math.ceil(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1;

		return Math.max(4, diffWeeks);
	});

	let gridWidthPx = $derived(LABEL_PX + weekCount * COL_STEP_PX);

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
			monthLabel: { month: string; year: string | null } | null;
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
			let monthLabel: { month: string; year: string | null } | null = null;
			for (const day of days) {
				if (day.date.endsWith('-01')) {
					const d = new Date(day.date + 'T00:00:00');
					const month = d.toLocaleDateString('en-GB', { month: 'short' });
					monthLabel = {
						month,
						year: d.getMonth() === 0 ? String(d.getFullYear()) : null
					};
					break;
				}
			}
			// Also label the very first week
			if (w === 0 && !monthLabel) {
				const d = new Date(days[0].date + 'T00:00:00');
				monthLabel = { month: d.toLocaleDateString('en-GB', { month: 'short' }), year: null };
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

	$effect(() => {
		if (grid.length === 0) return;
		tick().then(() => {
			if (scrollContainer) {
				scrollContainer.scrollLeft = scrollContainer.scrollWidth;
			}
		});
	});
</script>

<div class="rounded-lg border border-border bg-card p-3">
	<div bind:this={scrollContainer} class="overflow-x-auto p-1">
		{#if weekCount > 0}
			<div
				class="inline-grid"
				style="grid-template-columns: auto repeat({weekCount}, {CELL_SIZE_PX}px); gap: {GAP_PX}px; min-width: {gridWidthPx}px;"
			>
				<!-- Month labels row -->
				<div></div>
				{#each grid as week, wi (wi)}
					<div
						class="flex flex-col items-start justify-end text-[10px] leading-none text-muted-foreground"
					>
						{#if week.monthLabel}
							{#if week.monthLabel.year}
								<span class="font-semibold">{week.monthLabel.year}</span>
							{/if}
							<span>{week.monthLabel.month}</span>
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
							class="rounded-[3px] {day.isFuture
								? 'bg-transparent'
								: day.isToday
									? day.hasWorkout
										? 'bg-primary ring-1 ring-primary/50 ring-offset-1 ring-offset-background'
										: 'border border-muted-foreground/30 bg-muted-foreground/10'
									: day.hasWorkout
										? 'bg-primary'
										: 'bg-muted-foreground/15'}"
							style="width: {CELL_SIZE_PX}px; height: {CELL_SIZE_PX}px;"
							title={day.date}
						></div>
					{/each}
				{/each}
			</div>
		{/if}
	</div>
</div>
