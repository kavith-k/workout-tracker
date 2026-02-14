<script lang="ts">
	interface ExerciseInfo {
		id: number;
		exerciseName: string;
		hasFilledSets: boolean;
	}

	let {
		exercises,
		currentIndex,
		onjump
	}: {
		exercises: ExerciseInfo[];
		currentIndex: number;
		onjump: (index: number) => void;
	} = $props();

	let scrollContainer: HTMLDivElement | undefined = $state();

	$effect(() => {
		if (!scrollContainer) return;
		// Auto-scroll to keep the current circle visible
		const circle = scrollContainer.children[currentIndex] as HTMLElement | undefined;
		if (circle) {
			circle.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
		}
	});
</script>

<div
	bind:this={scrollContainer}
	class="scrollbar-hide flex gap-2 overflow-x-auto px-1 py-2"
	data-testid="wizard-progress-bar"
>
	{#each exercises as exercise, i (exercise.id)}
		<button
			type="button"
			class="flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-medium transition-all
				{i === currentIndex
				? 'bg-muted text-muted-foreground ring-2 ring-primary'
				: exercise.hasFilledSets
					? 'bg-primary text-primary-foreground'
					: 'bg-muted text-muted-foreground'}"
			onclick={() => onjump(i)}
			aria-label="Go to exercise {i + 1}: {exercise.exerciseName}"
			aria-current={i === currentIndex ? 'step' : undefined}
			data-testid="progress-circle-{i}"
		>
			{i + 1}
		</button>
	{/each}
</div>

<style>
	.scrollbar-hide {
		-ms-overflow-style: none;
		scrollbar-width: none;
	}
	.scrollbar-hide::-webkit-scrollbar {
		display: none;
	}
</style>
