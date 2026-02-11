<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Separator } from '$lib/components/ui/separator';
	import { Plus, Trash2, ChevronUp, ChevronDown, X } from '@lucide/svelte';
	import { untrack } from 'svelte';
	import { generateId } from '$lib/utils';

	type DayExercise = {
		tempId: string;
		exerciseName: string;
		setsCount: number;
	};

	type Day = {
		tempId: string;
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
			tempId: generateId(),
			name: d.name,
			exercises: d.exercises.map((ex) => ({
				tempId: generateId(),
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

	function addDay() {
		days.push({
			tempId: generateId(),
			name: '',
			exercises: []
		});
	}

	function removeDay(dayTempId: string) {
		const idx = days.findIndex((d) => d.tempId === dayTempId);
		if (idx !== -1) days.splice(idx, 1);
	}

	function moveDayUp(dayIndex: number) {
		if (dayIndex <= 0) return;
		const item = days.splice(dayIndex, 1)[0];
		days.splice(dayIndex - 1, 0, item);
	}

	function moveDayDown(dayIndex: number) {
		if (dayIndex >= days.length - 1) return;
		const item = days.splice(dayIndex, 1)[0];
		days.splice(dayIndex + 1, 0, item);
	}

	function addExercise(dayIndex: number) {
		days[dayIndex].exercises.push({
			tempId: generateId(),
			exerciseName: '',
			setsCount: 3
		});
	}

	function removeExercise(dayIndex: number, exTempId: string) {
		const idx = days[dayIndex].exercises.findIndex((ex) => ex.tempId === exTempId);
		if (idx !== -1) days[dayIndex].exercises.splice(idx, 1);
	}

	function moveExerciseUp(dayIndex: number, exIndex: number) {
		if (exIndex <= 0) return;
		const exs = days[dayIndex].exercises;
		const item = exs.splice(exIndex, 1)[0];
		exs.splice(exIndex - 1, 0, item);
	}

	function moveExerciseDown(dayIndex: number, exIndex: number) {
		const exs = days[dayIndex].exercises;
		if (exIndex >= exs.length - 1) return;
		const item = exs.splice(exIndex, 1)[0];
		exs.splice(exIndex + 1, 0, item);
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
				dayNameErrors[day.tempId] = 'Day name is required';
			}
			for (const ex of day.exercises) {
				if (!ex.exerciseName.trim()) {
					exerciseNameErrors[ex.tempId] = 'Exercise name is required';
				}
				if (ex.setsCount < 1) {
					exerciseSetsErrors[ex.tempId] = 'Sets must be at least 1';
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

	{#each days as day, dayIndex (day.tempId)}
		<div class="space-y-4 rounded-lg border border-border p-4">
			<div class="flex items-center gap-2">
				<div class="flex-1">
					<Input placeholder="Day name (e.g., Push Day)" bind:value={day.name} />
					{#if errors.dayNames?.[day.tempId]}
						<p class="mt-1 text-sm text-destructive">{errors.dayNames[day.tempId]}</p>
					{/if}
				</div>
				<div class="flex items-center gap-1">
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						class="min-h-[44px] min-w-[44px]"
						onclick={() => moveDayUp(dayIndex)}
						disabled={dayIndex === 0}
						aria-label="Move day up"
					>
						<ChevronUp class="size-4" />
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						class="min-h-[44px] min-w-[44px]"
						onclick={() => moveDayDown(dayIndex)}
						disabled={dayIndex === days.length - 1}
						aria-label="Move day down"
					>
						<ChevronDown class="size-4" />
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						class="min-h-[44px] min-w-[44px]"
						onclick={() => removeDay(day.tempId)}
						aria-label="Remove day"
					>
						<Trash2 class="size-4 text-destructive" />
					</Button>
				</div>
			</div>

			{#each day.exercises as exercise, exIndex (exercise.tempId)}
				<div class="space-y-1 pl-2">
					<div class="flex items-center gap-2">
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
						<div class="flex items-center gap-0.5">
							<Button
								type="button"
								variant="ghost"
								size="icon-sm"
								class="min-h-[44px] min-w-[44px]"
								onclick={() => moveExerciseUp(dayIndex, exIndex)}
								disabled={exIndex === 0}
								aria-label="Move exercise up"
							>
								<ChevronUp class="size-3.5" />
							</Button>
							<Button
								type="button"
								variant="ghost"
								size="icon-sm"
								class="min-h-[44px] min-w-[44px]"
								onclick={() => moveExerciseDown(dayIndex, exIndex)}
								disabled={exIndex === day.exercises.length - 1}
								aria-label="Move exercise down"
							>
								<ChevronDown class="size-3.5" />
							</Button>
							<Button
								type="button"
								variant="ghost"
								size="icon-sm"
								class="min-h-[44px] min-w-[44px]"
								onclick={() => removeExercise(dayIndex, exercise.tempId)}
								aria-label="Remove exercise"
							>
								<X class="size-3.5 text-destructive" />
							</Button>
						</div>
					</div>
					{#if errors.exerciseNames?.[exercise.tempId]}
						<p class="text-sm text-destructive">{errors.exerciseNames[exercise.tempId]}</p>
					{/if}
					{#if errors.exerciseSets?.[exercise.tempId]}
						<p class="text-sm text-destructive">{errors.exerciseSets[exercise.tempId]}</p>
					{/if}
				</div>
			{/each}

			<Button
				type="button"
				variant="outline"
				size="sm"
				class="min-h-[44px] w-full"
				onclick={() => addExercise(dayIndex)}
			>
				<Plus class="size-4" />
				Add Exercise
			</Button>
		</div>
	{/each}

	<Button type="button" variant="outline" class="min-h-[44px] w-full" onclick={addDay}>
		<Plus class="size-4" />
		Add Day
	</Button>

	<Separator />

	<Button type="submit" class="min-h-[44px] w-full" disabled={submitting}>
		{submitting ? 'Saving...' : submitLabel}
	</Button>

	<datalist id="exercise-suggestions">
		{#each exerciseNames as name (name)}
			<option value={name}></option>
		{/each}
	</datalist>
</form>
