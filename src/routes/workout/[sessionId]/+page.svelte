<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Badge } from '$lib/components/ui/badge';
	import {
		AlertDialog,
		AlertDialogAction,
		AlertDialogCancel,
		AlertDialogContent,
		AlertDialogDescription,
		AlertDialogFooter,
		AlertDialogHeader,
		AlertDialogTitle
	} from '$lib/components/ui/alert-dialog';
	import {
		Dialog,
		DialogClose,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';
	import { Label } from '$lib/components/ui/label';
	import { addToQueue, type ActionType } from '$lib/offline/queue';
	import { offlineState, updatePendingCount } from '$lib/offline/stores.svelte';

	let { data } = $props();

	async function queueAction(action: ActionType, payload: Record<string, unknown>) {
		await addToQueue(action, payload);
		await updatePendingCount();
	}

	function isNetworkError(result: { type: string; error?: unknown; status?: number }) {
		if (result.type !== 'error') return false;
		if (!offlineState.isOnline) return true;
		if (result.status && result.status >= 400) return false;
		return true;
	}

	let stopDialogOpen = $state(false);
	let stoppingWorkout = $state(false);
	let adhocDialogOpen = $state(false);
	let adhocExerciseName = $state('');
	let adhocError = $state('');
	let adhocSubmitting = $state(false);
	let selectedExerciseLogId = $state<number | null>(null);

	function scrollToExercise(exerciseLogId: number) {
		selectedExerciseLogId = exerciseLogId;
		const el = document.getElementById(`exercise-log-${exerciseLogId}`);
		if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

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
</script>

<div class="space-y-4">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-xl font-bold" data-testid="workout-title">{data.session.dayName}</h1>
			<p class="text-sm text-muted-foreground">{data.session.programName}</p>
		</div>
		{#if data.session.status === 'in_progress'}
			<Button
				variant="destructive"
				size="sm"
				class="min-h-[44px] rounded-xl"
				onclick={() => (stopDialogOpen = true)}
				data-testid="stop-workout-btn"
			>
				Stop Workout
			</Button>
		{/if}
	</div>

	{#if data.session.status === 'completed'}
		<div
			class="glass-card p-4 text-center text-sm text-muted-foreground"
			data-testid="offline-completed-banner"
		>
			Workout stopped (pending sync)
		</div>
	{/if}

	{#if data.session.status === 'in_progress'}
		<!-- Exercise navigator -->
		<div class="flex gap-2 overflow-x-auto pb-2" data-testid="exercise-navigator">
			{#each data.session.exerciseLogs as log (log.id)}
				<button
					class="min-h-[36px] shrink-0 rounded-full px-4 py-1 text-sm font-medium transition-colors
						{selectedExerciseLogId === log.id
						? 'neon-glow bg-neon text-neon-foreground'
						: 'glass-card text-foreground'}
						{log.status === 'skipped' ? 'line-through opacity-50' : ''}"
					onclick={() => scrollToExercise(log.id)}
					data-testid="exercise-nav-{log.id}"
				>
					{log.exerciseName}
				</button>
			{/each}
		</div>
	{/if}

	<!-- Exercise cards -->
	<div class="space-y-6">
		{#each data.session.exerciseLogs as log (log.id)}
			<div
				id="exercise-log-{log.id}"
				class="glass-card overflow-hidden p-4 {log.status === 'skipped' ? 'opacity-60' : ''}"
				data-testid="exercise-card-{log.id}"
			>
				<div class="flex items-start justify-between">
					<div>
						<h3 class="font-semibold" data-testid="exercise-name-{log.id}">
							{log.exerciseName}
						</h3>
						{#if log.isAdhoc}
							<Badge variant="outline" class="mt-1">Ad-hoc</Badge>
						{/if}
					</div>
					<div class="flex gap-2">
						{#if data.session.status === 'in_progress'}
							{#if log.status === 'skipped'}
								<form
									method="POST"
									action="?/unskip"
									use:enhance={() => {
										return async ({ result, update }) => {
											if (isNetworkError(result)) {
												await queueAction('UNSKIP_EXERCISE', {
													exerciseLogId: log.id
												});
												const unskipLog = data.session.exerciseLogs.find((l) => l.id === log.id);
												if (unskipLog) unskipLog.status = 'logged';
											} else {
												await update();
											}
										};
									}}
								>
									<input type="hidden" name="exerciseLogId" value={log.id} />
									<Button
										type="submit"
										variant="outline"
										size="sm"
										class="min-h-[44px]"
										data-testid="unskip-{log.id}"
									>
										Unskip
									</Button>
								</form>
							{:else}
								<form
									method="POST"
									action="?/skip"
									use:enhance={() => {
										return async ({ result, update }) => {
											if (isNetworkError(result)) {
												await queueAction('SKIP_EXERCISE', {
													exerciseLogId: log.id
												});
												const skipLog = data.session.exerciseLogs.find((l) => l.id === log.id);
												if (skipLog) skipLog.status = 'skipped';
											} else {
												await update();
											}
										};
									}}
								>
									<input type="hidden" name="exerciseLogId" value={log.id} />
									<Button
										type="submit"
										variant="ghost"
										size="sm"
										class="min-h-[44px]"
										data-testid="skip-{log.id}"
									>
										Skip
									</Button>
								</form>
							{/if}
						{/if}
					</div>
				</div>

				<!-- Progressive overload hints -->
				{#if data.progressiveOverload[log.id]}
					{@const overload = data.progressiveOverload[log.id]}
					<div class="mt-2 space-y-0.5 text-xs text-muted-foreground">
						{#if overload.previous}
							<p data-testid="previous-hint-{log.id}">
								Previous ({formatDate(overload.previous.date)}): {formatPreviousSets(
									overload.previous.sets
								)}
							</p>
						{/if}
						{#if overload.max}
							<p data-testid="max-hint-{log.id}">
								Max: {overload.max.weight}{overload.max.unit} x {overload.max.reps} reps ({formatDate(
									overload.max.date
								)})
							</p>
						{/if}
					</div>
				{/if}

				{#if log.status !== 'skipped'}
					<!-- Set rows -->
					<div class="mt-3 space-y-2">
						<div
							class="grid grid-cols-[2rem_1fr_1fr_auto] items-center gap-2 text-xs font-medium text-muted-foreground"
						>
							<span>Set</span>
							<span>Weight</span>
							<span>Reps</span>
							<span></span>
						</div>
						{#each log.sets as set (set.id)}
							<div
								class="grid grid-cols-[2rem_1fr_1fr_auto] items-center gap-2"
								data-testid="set-row-{set.id}"
							>
								<span class="text-center text-sm text-muted-foreground">{set.setNumber}</span>
								<form
									id="set-form-{set.id}"
									method="POST"
									action="?/updateSet"
									use:enhance={({ formData }) => {
										return async ({ result }) => {
											if (isNetworkError(result)) {
												const weight = formData.get('weight');
												const reps = formData.get('reps');
												await queueAction('UPDATE_SET', {
													setLogId: Number(formData.get('setLogId')),
													exerciseId: Number(formData.get('exerciseId')),
													weight: weight === '' ? null : Number(weight),
													reps: reps === '' ? null : Number(reps),
													unit: formData.get('unit')
												});
												for (const exerciseLog of data.session.exerciseLogs) {
													const setEntry = exerciseLog.sets.find(
														(s) => s.id === Number(formData.get('setLogId'))
													);
													if (setEntry) {
														const w = formData.get('weight');
														const r = formData.get('reps');
														const u = formData.get('unit') as 'kg' | 'lbs' | null;
														if (w !== null) setEntry.weight = w === '' ? null : Number(w);
														if (r !== null) setEntry.reps = r === '' ? null : Number(r);
														if (u) setEntry.unit = u;
														break;
													}
												}
											}
										};
									}}
									class="contents"
								>
									<input type="hidden" name="setLogId" value={set.id} />
									<input type="hidden" name="exerciseLogId" value={log.id} />
									<input type="hidden" name="exerciseId" value={log.exerciseId} />
									<div class="relative">
										<Input
											type="number"
											name="weight"
											value={set.weight ?? ''}
											placeholder="0"
											step="0.5"
											min="0"
											inputmode="decimal"
											class="pr-8"
											onchange={(e) => e.currentTarget.form?.requestSubmit()}
											data-testid="weight-input-{set.id}"
										/>
										<button
											type="button"
											class="absolute top-1/2 right-0 flex min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center text-xs text-muted-foreground hover:text-foreground"
											onclick={(e) => {
												const form = e.currentTarget.closest('form');
												if (!form) return;
												const unitInput =
													form.querySelector<HTMLInputElement>('input[name="unit"]');
												if (unitInput) {
													unitInput.value = unitInput.value === 'kg' ? 'lbs' : 'kg';
													form.requestSubmit();
												}
											}}
											data-testid="unit-toggle-{set.id}"
										>
											{set.unit}
										</button>
										<input type="hidden" name="unit" value={set.unit} />
									</div>
									<Input
										type="number"
										name="reps"
										value={set.reps ?? ''}
										placeholder="0"
										min="0"
										inputmode="numeric"
										onchange={(e) => e.currentTarget.form?.requestSubmit()}
										data-testid="reps-input-{set.id}"
									/>
								</form>
								{#if data.session.status === 'in_progress' && log.sets.length > 1}
									<form
										method="POST"
										action="?/removeSet"
										use:enhance={() => {
											return async ({ result, update }) => {
												if (isNetworkError(result)) {
													await queueAction('REMOVE_SET', {
														setLogId: set.id
													});
													for (const exerciseLog of data.session.exerciseLogs) {
														const idx = exerciseLog.sets.findIndex((s) => s.id === set.id);
														if (idx !== -1) {
															exerciseLog.sets.splice(idx, 1);
															exerciseLog.sets.forEach((s, i) => (s.setNumber = i + 1));
															break;
														}
													}
												} else {
													await update();
												}
											};
										}}
									>
										<input type="hidden" name="setLogId" value={set.id} />
										<Button
											type="submit"
											variant="ghost"
											size="icon-sm"
											class="min-h-[44px] min-w-[44px] text-muted-foreground"
											data-testid="remove-set-{set.id}"
										>
											&times;
										</Button>
									</form>
								{:else}
									<div class="w-8"></div>
								{/if}
							</div>
						{/each}
					</div>

					{#if data.session.status === 'in_progress'}
						<form
							method="POST"
							action="?/addSet"
							use:enhance={() => {
								return async ({ result, update }) => {
									if (isNetworkError(result)) {
										await queueAction('ADD_SET', {
											exerciseLogId: log.id
										});
										const targetLog = data.session.exerciseLogs.find((l) => l.id === log.id);
										if (targetLog) {
											const lastSet = targetLog.sets[targetLog.sets.length - 1];
											targetLog.sets.push({
												id: -Date.now(),
												exerciseLogId: log.id,
												setNumber: targetLog.sets.length + 1,
												weight: null,
												reps: null,
												unit: lastSet?.unit ?? 'kg',
												createdAt: new Date()
											});
										}
									} else {
										await update();
									}
								};
							}}
							class="mt-2"
						>
							<input type="hidden" name="exerciseLogId" value={log.id} />
							<Button
								type="submit"
								variant="ghost"
								size="sm"
								class="min-h-[44px] text-muted-foreground"
								data-testid="add-set-{log.id}"
							>
								+ Add Set
							</Button>
						</form>
					{/if}
				{/if}
			</div>
		{/each}
	</div>

	{#if data.session.status === 'in_progress'}
		<div class="flex justify-center pb-4">
			<Button
				variant="outline"
				class="min-h-[44px] rounded-xl"
				onclick={() => (adhocDialogOpen = true)}
				data-testid="add-adhoc-btn"
			>
				+ Add Exercise
			</Button>
		</div>
	{/if}
</div>

<!-- Stop Workout Confirmation -->
<AlertDialog bind:open={stopDialogOpen}>
	<AlertDialogContent>
		<AlertDialogHeader>
			<AlertDialogTitle>Stop Workout?</AlertDialogTitle>
			<AlertDialogDescription>
				Any exercises without logged sets will be marked as skipped. You can review your summary
				afterwards.
			</AlertDialogDescription>
		</AlertDialogHeader>
		<AlertDialogFooter>
			<AlertDialogCancel class="min-h-[44px]">Continue Workout</AlertDialogCancel>
			<form
				method="POST"
				action="?/stop"
				use:enhance={() => {
					stoppingWorkout = true;
					return async ({ result, update }) => {
						if (isNetworkError(result)) {
							await queueAction('COMPLETE_WORKOUT', {
								sessionId: data.session.id
							});
							stopDialogOpen = false;
							data.session.status = 'completed';
						} else {
							await update();
						}
						stoppingWorkout = false;
					};
				}}
				class="contents"
			>
				<input type="hidden" name="sessionId" value={data.session.id} />
				<AlertDialogAction
					type="submit"
					class="min-h-[44px]"
					disabled={stoppingWorkout}
					data-testid="confirm-stop-btn"
				>
					{stoppingWorkout ? 'Stopping...' : 'Stop Workout'}
				</AlertDialogAction>
			</form>
		</AlertDialogFooter>
	</AlertDialogContent>
</AlertDialog>

<!-- Add Ad-hoc Exercise Dialog -->
<Dialog bind:open={adhocDialogOpen}>
	<DialogContent>
		<DialogHeader>
			<DialogTitle>Add Exercise</DialogTitle>
			<DialogDescription>
				Add an extra exercise to this workout. If the exercise is new, it will be added to your
				library.
			</DialogDescription>
		</DialogHeader>
		<form
			method="POST"
			action="?/addAdhoc"
			use:enhance={() => {
				adhocError = '';
				adhocSubmitting = true;
				return async ({ result, update }) => {
					if (isNetworkError(result)) {
						await queueAction('ADD_ADHOC', {
							sessionId: data.session.id,
							exerciseName: adhocExerciseName.trim()
						});
						const now = Date.now();
						const placeholderId = -now;
						data.session.exerciseLogs.push({
							id: placeholderId,
							exerciseId: null,
							sessionId: data.session.id,
							exerciseName: adhocExerciseName.trim(),
							status: 'logged',
							isAdhoc: true,
							sortOrder: data.session.exerciseLogs.length,
							createdAt: new Date(),
							sets: [
								{
									id: -(now + 1),
									exerciseLogId: placeholderId,
									setNumber: 1,
									weight: null,
									reps: null,
									unit: 'kg',
									createdAt: new Date()
								},
								{
									id: -(now + 2),
									exerciseLogId: placeholderId,
									setNumber: 2,
									weight: null,
									reps: null,
									unit: 'kg',
									createdAt: new Date()
								},
								{
									id: -(now + 3),
									exerciseLogId: placeholderId,
									setNumber: 3,
									weight: null,
									reps: null,
									unit: 'kg',
									createdAt: new Date()
								}
							]
						});
						adhocDialogOpen = false;
						adhocExerciseName = '';
					} else if (result.type === 'failure') {
						adhocError = (result.data as { error?: string })?.error ?? 'Something went wrong';
					} else {
						adhocDialogOpen = false;
						adhocExerciseName = '';
						await update();
					}
					adhocSubmitting = false;
				};
			}}
			class="space-y-4"
		>
			<input type="hidden" name="sessionId" value={data.session.id} />
			<div class="space-y-2">
				<Label for="adhoc-name">Exercise Name</Label>
				<Input
					id="adhoc-name"
					name="exerciseName"
					bind:value={adhocExerciseName}
					placeholder="e.g., Lateral Raise"
					data-testid="adhoc-exercise-input"
				/>
				{#if adhocError}
					<p class="text-sm text-destructive" data-testid="adhoc-error">{adhocError}</p>
				{/if}
			</div>
			<DialogFooter>
				<DialogClose>
					{#snippet child({ props })}
						<Button variant="outline" {...props}>Cancel</Button>
					{/snippet}
				</DialogClose>
				<Button
					type="submit"
					disabled={!adhocExerciseName.trim() || adhocSubmitting}
					data-testid="adhoc-submit-btn"
				>
					{adhocSubmitting ? 'Adding...' : 'Add'}
				</Button>
			</DialogFooter>
		</form>
	</DialogContent>
</Dialog>
