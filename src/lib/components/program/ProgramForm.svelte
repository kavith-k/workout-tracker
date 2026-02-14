<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Separator } from '$lib/components/ui/separator';
	import { Plus, Trash2, GripVertical, X } from '@lucide/svelte';
	import { untrack } from 'svelte';
	import { flip } from 'svelte/animate';
	import { dragHandleZone, dragHandle, type DndEvent } from 'svelte-dnd-action';
	import { generateId } from '$lib/utils';

	type DayExercise = {
		id: string;
		exerciseName: string;
		setsCount: number;
	};

	type Day = {
		id: string;
		name: string;
		exercises: DayExercise[];
	};

	type InitialData = {
		name: string;
		days: Array<{
			name: string;
			exercises: Array<{ exerciseName: string; setsCount: number }>;
		}>;
	};

	function buildInitialDays(data?: InitialData): Day[] {
		if (!data?.days) return [];
		return data.days.map((d) => ({
			id: generateId(),
			name: d.name,
			exercises: d.exercises.map((ex) => ({
				id: generateId(),
				exerciseName: ex.exerciseName,
				setsCount: ex.setsCount
			}))
		}));
	}

	interface Props {
		initialData?: InitialData;
		exerciseNames?: string[];
		submitLabel?: string;
	}

	const { initialData, exerciseNames = [], submitLabel = 'Save Program' }: Props = $props();

	let programName = $state(untrack(() => initialData?.name ?? ''));
	let days: Day[] = $state(untrack(() => buildInitialDays(initialData)));
	let submitting = $state(false);

	let errors = $state<{
		programName?: string;
		days?: string;
		dayNames?: Record<string, string>;
		exerciseNames?: Record<string, string>;
		exerciseSets?: Record<string, string>;
	}>({});

	let serializedData = $derived(
		JSON.stringify({
			name: programName,
			days: days.map((d) => ({
				name: d.name,
				exercises: d.exercises.map((ex) => ({
					exerciseName: ex.exerciseName,
					setsCount: ex.setsCount
				}))
			}))
		})
	);

	const FLIP_DURATION_MS = 150;

	function addDay() {
		days.push({
			id: generateId(),
			name: '',
			exercises: []
		});
	}

	function removeDay(dayId: string) {
		const idx = days.findIndex((d) => d.id === dayId);
		if (idx !== -1) days.splice(idx, 1);
	}

	function handleDaySort(e: CustomEvent<DndEvent<Day>>) {
		days = e.detail.items;
	}

	function addExercise(dayIndex: number) {
		days[dayIndex].exercises.push({
			id: generateId(),
			exerciseName: '',
			setsCount: 3
		});
	}

	function removeExercise(dayIndex: number, exId: string) {
		const idx = days[dayIndex].exercises.findIndex((ex) => ex.id === exId);
		if (idx !== -1) days[dayIndex].exercises.splice(idx, 1);
	}

	function handleExerciseSort(dayIndex: number, e: CustomEvent<DndEvent<DayExercise>>) {
		days[dayIndex].exercises = e.detail.items;
	}

	function validate(): boolean {
		const newErrors: typeof errors = {};

		if (!programName.trim()) {
			newErrors.programName = 'Program name is required';
		}

		if (days.length === 0) {
			newErrors.days = 'At least one day is required';
		}

		const dayNameErrors: Record<string, string> = {};
		const exerciseNameErrors: Record<string, string> = {};
		const exerciseSetsErrors: Record<string, string> = {};

		for (const day of days) {
			if (!day.name.trim()) {
				dayNameErrors[day.id] = 'Day name is required';
			}
			for (const ex of day.exercises) {
				if (!ex.exerciseName.trim()) {
					exerciseNameErrors[ex.id] = 'Exercise name is required';
				}
				if (ex.setsCount < 1) {
					exerciseSetsErrors[ex.id] = 'Sets must be at least 1';
				}
			}
		}

		if (Object.keys(dayNameErrors).length > 0) {
			newErrors.dayNames = dayNameErrors;
		}
		if (Object.keys(exerciseNameErrors).length > 0) {
			newErrors.exerciseNames = exerciseNameErrors;
		}
		if (Object.keys(exerciseSetsErrors).length > 0) {
			newErrors.exerciseSets = exerciseSetsErrors;
		}

		errors = newErrors;
		return Object.keys(errors).length === 0;
	}
</script>

<form
	method="POST"
	use:enhance={(e) => {
		if (!validate()) {
			e.cancel();
			return;
		}
		submitting = true;
		return async ({ update }) => {
			await update();
			submitting = false;
		};
	}}
	class="space-y-6"
>
	<input type="hidden" name="data" value={serializedData} />

	<div class="space-y-2">
		<Label for="program-name">Program Name</Label>
		<Input id="program-name" placeholder="e.g., Push Pull Legs" bind:value={programName} />
		{#if errors.programName}
			<p class="text-sm text-destructive">{errors.programName}</p>
		{/if}
	</div>

	{#if errors.days}
		<p class="text-sm text-destructive">{errors.days}</p>
	{/if}

	<div
		use:dragHandleZone={{
			items: days,
			flipDurationMs: FLIP_DURATION_MS,
			type: 'days',
			dropTargetStyle: {}
		}}
		onconsider={handleDaySort}
		onfinalize={handleDaySort}
		class="space-y-4"
	>
		{#each days as day, dayIndex (day.id)}
			<div class="glass-card space-y-4 p-4" animate:flip={{ duration: FLIP_DURATION_MS }}>
				<div class="flex items-center gap-2">
					<button
						type="button"
						use:dragHandle
						aria-label="Drag to reorder day"
						class="touch-manipulation cursor-grab rounded p-2 text-muted-foreground hover:text-foreground active:cursor-grabbing"
					>
						<GripVertical class="size-5" />
					</button>
					<div class="flex-1">
						<Input placeholder="Day name (e.g., Push Day)" bind:value={day.name} />
						{#if errors.dayNames?.[day.id]}
							<p class="mt-1 text-sm text-destructive">{errors.dayNames[day.id]}</p>
						{/if}
					</div>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						class="min-h-11 min-w-11"
						onclick={() => removeDay(day.id)}
						aria-label="Remove day"
					>
						<Trash2 class="size-4 text-destructive" />
					</Button>
				</div>

				<div
					use:dragHandleZone={{
						items: day.exercises,
						flipDurationMs: FLIP_DURATION_MS,
						type: `exercises-${day.id}`,
						dropTargetStyle: {}
					}}
					onconsider={(e) => handleExerciseSort(dayIndex, e)}
					onfinalize={(e) => handleExerciseSort(dayIndex, e)}
					class="space-y-2 pl-2"
				>
					{#each day.exercises as exercise (exercise.id)}
						<div
							class="space-y-1"
							animate:flip={{ duration: FLIP_DURATION_MS }}
						>
							<div class="flex items-center gap-2">
								<button
									type="button"
									use:dragHandle
									aria-label="Drag to reorder exercise"
									class="touch-manipulation cursor-grab rounded p-2 text-muted-foreground hover:text-foreground active:cursor-grabbing"
								>
									<GripVertical class="size-4" />
								</button>
								<div class="flex-1">
									<Input
										placeholder="Exercise name"
										bind:value={exercise.exerciseName}
										list="exercise-suggestions"
									/>
								</div>
								<div class="w-20">
									<Input
										type="number"
										inputmode="numeric"
										min="1"
										placeholder="Sets"
										bind:value={exercise.setsCount}
									/>
								</div>
								<Button
									type="button"
									variant="ghost"
									size="icon-sm"
									class="min-h-11 min-w-11"
									onclick={() => removeExercise(dayIndex, exercise.id)}
									aria-label="Remove exercise"
								>
									<X class="size-3.5 text-destructive" />
								</Button>
							</div>
							{#if errors.exerciseNames?.[exercise.id]}
								<p class="text-sm text-destructive">
									{errors.exerciseNames[exercise.id]}
								</p>
							{/if}
							{#if errors.exerciseSets?.[exercise.id]}
								<p class="text-sm text-destructive">
									{errors.exerciseSets[exercise.id]}
								</p>
							{/if}
						</div>
					{/each}
				</div>

				<Button
					type="button"
					variant="outline"
					size="sm"
					class="min-h-11 w-full"
					onclick={() => addExercise(dayIndex)}
				>
					<Plus class="size-4" />
					Add Exercise
				</Button>
			</div>
		{/each}
	</div>

	<Button type="button" variant="outline" class="min-h-11 w-full" onclick={addDay}>
		<Plus class="size-4" />
		Add Day
	</Button>

	<Separator />

	<Button type="submit" class="min-h-11 w-full" disabled={submitting}>
		{submitting ? 'Saving...' : submitLabel}
	</Button>

	<datalist id="exercise-suggestions">
		{#each exerciseNames as name (name)}
			<option value={name}></option>
		{/each}
	</datalist>
</form>
