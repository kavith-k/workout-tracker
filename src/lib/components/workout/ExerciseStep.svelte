<script lang="ts">
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';

	interface SetData {
		id: number;
		setNumber: number;
		weight: number | null;
		reps: number | null;
		unit: 'kg' | 'lbs';
	}

	interface ExerciseLog {
		exerciseName: string;
		isAdhoc: boolean;
		sets: SetData[];
	}

	interface OverloadData {
		previous: { date: Date; sets: Array<{ weight: number; reps: number; unit: string }> } | null;
		max: { weight: number; reps: number; unit: string; date: Date } | null;
	}

	let {
		exercise,
		overload,
		onupdateset,
		ontoggleunit,
		onaddset,
		onremoveset
	}: {
		exercise: ExerciseLog;
		overload: OverloadData | undefined;
		onupdateset: (setIndex: number, field: 'weight' | 'reps', value: number | null) => void;
		ontoggleunit: () => void;
		onaddset: () => void;
		onremoveset: (setIndex: number) => void;
	} = $props();

	function formatDate(date: Date): string {
		return new Date(date).toLocaleDateString('en-GB', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}

	function formatPreviousSets(sets: Array<{ weight: number; reps: number; unit: string }>): string {
		return sets.map((s) => `${s.weight}${s.unit} x ${s.reps}`).join(', ');
	}

	let unit = $derived(exercise.sets[0]?.unit ?? 'kg');
</script>

<div class="glass-card overflow-hidden p-4" data-testid="exercise-step">
	<div class="flex items-start justify-between">
		<div>
			<h3 class="font-semibold" data-testid="exercise-step-name">
				{exercise.exerciseName}
			</h3>
			{#if exercise.isAdhoc}
				<Badge variant="outline" class="mt-1">Ad-hoc</Badge>
			{/if}
		</div>
	</div>

	{#if overload}
		<div class="mt-2 space-y-0.5 text-xs text-muted-foreground">
			{#if overload.previous}
				<p data-testid="previous-hint">
					Previous ({formatDate(overload.previous.date)}): {formatPreviousSets(
						overload.previous.sets
					)}
				</p>
			{/if}
			{#if overload.max}
				<p data-testid="max-hint">
					Max: {overload.max.weight}{overload.max.unit} x {overload.max.reps} reps ({formatDate(
						overload.max.date
					)})
				</p>
			{/if}
		</div>
	{/if}

	<div class="mt-3 space-y-2">
		<div
			class="grid grid-cols-[2rem_1fr_1fr_auto] items-center gap-2 text-xs font-medium text-muted-foreground"
		>
			<span>Set</span>
			<span class="flex items-center gap-1">
				Weight
				<button
					type="button"
					class="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground hover:bg-muted/80 hover:text-foreground"
					onclick={ontoggleunit}
					data-testid="unit-toggle"
				>
					{unit}
				</button>
			</span>
			<span>Reps</span>
			<span></span>
		</div>
		{#each exercise.sets as set, i (set.id)}
			<div class="grid grid-cols-[2rem_1fr_1fr_auto] items-center gap-2" data-testid="set-row-{i}">
				<span class="text-center text-sm text-muted-foreground">
					{set.setNumber}
				</span>
				<Input
					type="number"
					value={set.weight ?? ''}
					step="0.5"
					min="0"
					inputmode="decimal"
					onchange={(e) => {
						const val = e.currentTarget.value;
						onupdateset(i, 'weight', val === '' ? null : Number(val));
					}}
					data-testid="weight-input-{i}"
				/>
				<Input
					type="number"
					value={set.reps ?? ''}
					min="0"
					inputmode="numeric"
					onchange={(e) => {
						const val = e.currentTarget.value;
						onupdateset(i, 'reps', val === '' ? null : Number(val));
					}}
					data-testid="reps-input-{i}"
				/>
				{#if exercise.sets.length > 1}
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						class="min-h-11 min-w-11 text-muted-foreground"
						onclick={() => onremoveset(i)}
						data-testid="remove-set-{i}"
					>
						&times;
					</Button>
				{:else}
					<div class="w-8"></div>
				{/if}
			</div>
		{/each}
	</div>

	<Button
		type="button"
		variant="ghost"
		size="sm"
		class="mt-2 min-h-11 text-muted-foreground"
		onclick={onaddset}
		data-testid="add-set-btn"
	>
		+ Add Set
	</Button>
</div>
