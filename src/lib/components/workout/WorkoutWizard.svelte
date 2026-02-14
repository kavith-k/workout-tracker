<script lang="ts">
	import WizardProgressBar from './WizardProgressBar.svelte';
	import ExerciseStep from './ExerciseStep.svelte';
	import WizardBottomBar from './WizardBottomBar.svelte';
	import { addToQueue, type ActionType } from '$lib/offline/queue';
	import { offlineState, updatePendingCount } from '$lib/offline/stores.svelte';

	interface SetData {
		id: number;
		exerciseLogId: number;
		setNumber: number;
		weight: number | null;
		reps: number | null;
		unit: 'kg' | 'lbs';
		createdAt: Date;
	}

	interface ExerciseLogData {
		id: number;
		exerciseId: number | null;
		sessionId: number;
		exerciseName: string;
		status: string;
		isAdhoc: boolean;
		sortOrder: number;
		createdAt: Date;
		sets: SetData[];
	}

	interface OverloadMap {
		[exerciseLogId: number]: {
			previous: {
				date: Date;
				sets: Array<{ weight: number; reps: number; unit: string }>;
			} | null;
			max: { weight: number; reps: number; unit: string; date: Date } | null;
		};
	}

	let {
		exerciseLogs,
		progressiveOverload,
		onfinish,
		onaddexercise
	}: {
		exerciseLogs: ExerciseLogData[];
		progressiveOverload: OverloadMap;
		onfinish: () => void;
		onaddexercise: () => void;
	} = $props();

	let currentIndex = $state(0);
	let saving = $state(false);
	let saveError = $state<string | null>(null);
	let lastFingerprint = $state('');

	function cloneLogs(logs: ExerciseLogData[]): ExerciseLogData[] {
		return logs.map((log) => ({
			...log,
			sets: log.sets.map((set) => ({ ...set }))
		}));
	}

	function computeFingerprint(logs: ExerciseLogData[]): string {
		return logs.map((log) => `${log.id}:${log.sets.map((s) => s.id).join(',')}`).join('|');
	}

	function createPlaceholderSet(log: ExerciseLogData): SetData {
		const lastSet = log.sets[log.sets.length - 1];
		return {
			id: -Date.now(),
			exerciseLogId: log.id,
			setNumber: log.sets.length + 1,
			weight: null,
			reps: null,
			unit: lastSet?.unit ?? 'kg',
			createdAt: new Date()
		};
	}

	// Deep clone exercise logs into local state for editing without server round-trips.
	// Re-syncs when exerciseLogs changes (e.g. after page reload or adhoc add).
	let localLogs = $state<ExerciseLogData[]>([]);

	$effect(() => {
		const fingerprint = computeFingerprint(exerciseLogs);
		if (fingerprint !== lastFingerprint) {
			if (lastFingerprint === '') {
				// Initial load -- full clone
				localLogs = cloneLogs(exerciseLogs);
			} else {
				// Subsequent changes -- preserve in-progress edits
				syncFromServer();
			}
			lastFingerprint = fingerprint;
		}
	});

	let currentLog = $derived(localLogs[currentIndex]);

	let hasFilledSets = $derived.by(() => {
		if (!currentLog) return false;
		return currentLog.sets.some((s) => s.reps != null);
	});

	let progressExercises = $derived(
		localLogs.map((log) => ({
			id: log.id,
			exerciseName: log.exerciseName,
			hasFilledSets: log.sets.some((s) => s.reps != null)
		}))
	);

	let isFirst = $derived(currentIndex === 0);
	let isLast = $derived(currentIndex === localLogs.length - 1);

	async function queueAction(action: ActionType, payload: Record<string, unknown>) {
		await addToQueue(action, payload);
		await updatePendingCount();
	}

	async function saveCurrentExercise(): Promise<boolean> {
		const log = localLogs[currentIndex];
		if (!log) return true;

		// Only save if there are sets with reps filled
		const filledSets = log.sets.filter((s) => s.reps != null);
		if (filledSets.length === 0) return true;

		saving = true;
		try {
			const setsPayload = log.sets
				.filter((s) => s.id > 0) // exclude placeholder sets from offline add
				.map((s) => ({
					setLogId: s.id,
					weight: s.weight,
					reps: s.reps,
					unit: s.unit
				}));

			const formData = new FormData();
			formData.set('exerciseLogId', String(log.id));
			formData.set('exerciseId', String(log.exerciseId ?? 0));
			formData.set('sets', JSON.stringify(setsPayload));

			const response = await fetch('?/saveExercise', {
				method: 'POST',
				body: formData
			});

			if (!response.ok && !offlineState.isOnline) {
				await queueAction('SAVE_EXERCISE', {
					exerciseLogId: log.id,
					exerciseId: log.exerciseId,
					sets: setsPayload
				});
			} else if (!response.ok) {
				let message = 'Failed to save exercise';
				try {
					const body = await response.json();
					if (body?.error) message = body.error;
				} catch {
					// Response body not JSON, use default message
				}
				saveError = message;
				return false;
			}

			saveError = null;
			return true;
		} catch {
			// Network error -- queue offline
			await queueAction('SAVE_EXERCISE', {
				exerciseLogId: log.id,
				exerciseId: log.exerciseId,
				sets: log.sets
					.filter((s) => s.id > 0)
					.map((s) => ({
						setLogId: s.id,
						weight: s.weight,
						reps: s.reps,
						unit: s.unit
					}))
			});
			return true;
		} finally {
			saving = false;
		}
	}

	async function handleNext() {
		if (await saveCurrentExercise()) {
			currentIndex = Math.min(currentIndex + 1, localLogs.length - 1);
		}
	}

	function handleSkip() {
		// Just advance without saving
		currentIndex = Math.min(currentIndex + 1, localLogs.length - 1);
	}

	async function handlePrevious() {
		if (await saveCurrentExercise()) {
			currentIndex = Math.max(currentIndex - 1, 0);
		}
	}

	async function handleJump(index: number) {
		if (index === currentIndex) return;
		if (await saveCurrentExercise()) {
			currentIndex = index;
		}
	}

	async function handleFinish() {
		if (hasFilledSets) {
			await saveCurrentExercise();
		}
		onfinish();
	}

	function handleUpdateSet(setIndex: number, field: 'weight' | 'reps', value: number | null) {
		const log = localLogs[currentIndex];
		if (!log || !log.sets[setIndex]) return;
		log.sets[setIndex][field] = value;
	}

	function handleToggleUnit() {
		const log = localLogs[currentIndex];
		if (!log) return;
		const currentUnit = log.sets[0]?.unit ?? 'kg';
		const newUnit = currentUnit === 'kg' ? 'lbs' : 'kg';
		for (const set of log.sets) {
			set.unit = newUnit;
		}
	}

	async function handleAddSet() {
		const log = localLogs[currentIndex];
		if (!log) return;

		// Try server-side first
		const formData = new FormData();
		formData.set('exerciseLogId', String(log.id));

		try {
			const response = await fetch('?/addSet', {
				method: 'POST',
				body: formData
			});

			if (!response.ok && !offlineState.isOnline) {
				await queueAction('ADD_SET', { exerciseLogId: log.id });
				log.sets.push(createPlaceholderSet(log));
			} else if (response.ok) {
				// Invalidate to get the real set from server data
				const { invalidateAll } = await import('$app/navigation');
				await invalidateAll();
				syncFromServer();
			}
		} catch {
			await queueAction('ADD_SET', { exerciseLogId: log.id });
			log.sets.push(createPlaceholderSet(log));
		}
	}

	async function handleRemoveSet(setIndex: number) {
		const log = localLogs[currentIndex];
		if (!log || !log.sets[setIndex]) return;
		const set = log.sets[setIndex];

		if (set.id > 0) {
			// Real set -- remove from server
			const formData = new FormData();
			formData.set('setLogId', String(set.id));

			try {
				const response = await fetch('?/removeSet', {
					method: 'POST',
					body: formData
				});

				if (!response.ok && !offlineState.isOnline) {
					await queueAction('REMOVE_SET', { setLogId: set.id });
				}
			} catch {
				await queueAction('REMOVE_SET', { setLogId: set.id });
			}
		}

		// Remove locally
		log.sets.splice(setIndex, 1);
		log.sets.forEach((s, i) => (s.setNumber = i + 1));
	}

	function syncFromServer() {
		// Merge server data into local logs, preserving edits for the current exercise
		const currentLogId = localLogs[currentIndex]?.id;
		const currentEdits = currentLogId ? localLogs[currentIndex].sets.map((s) => ({ ...s })) : null;

		localLogs = cloneLogs(exerciseLogs);

		// Restore current exercise edits
		if (currentEdits && currentLogId) {
			const idx = localLogs.findIndex((l) => l.id === currentLogId);
			if (idx !== -1) {
				// Merge: keep server set IDs but apply local weight/reps/unit edits
				for (const localSet of currentEdits) {
					if (localSet.id < 0) continue; // placeholder, skip
					const serverSet = localLogs[idx].sets.find((s) => s.id === localSet.id);
					if (serverSet) {
						serverSet.weight = localSet.weight;
						serverSet.reps = localSet.reps;
						serverSet.unit = localSet.unit;
					}
				}
			}
		}

		// Clamp currentIndex if exercises were removed
		if (currentIndex >= localLogs.length) {
			currentIndex = Math.max(0, localLogs.length - 1);
		}
	}
</script>

<WizardProgressBar exercises={progressExercises} {currentIndex} onjump={handleJump} />

{#if currentLog}
	{#key currentLog.id}
		<ExerciseStep
			exercise={currentLog}
			overload={progressiveOverload[currentLog.id]}
			onupdateset={handleUpdateSet}
			ontoggleunit={handleToggleUnit}
			onaddset={handleAddSet}
			onremoveset={handleRemoveSet}
		/>
	{/key}
{/if}

{#if saveError}
	<p class="px-4 py-2 text-sm text-destructive">{saveError}</p>
{/if}

<WizardBottomBar
	{isFirst}
	{isLast}
	{hasFilledSets}
	{saving}
	onprevious={handlePrevious}
	onnext={handleNext}
	onskip={handleSkip}
	onfinish={handleFinish}
	{onaddexercise}
/>
