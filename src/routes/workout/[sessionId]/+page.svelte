<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
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
	import WorkoutWizard from '$lib/components/workout/WorkoutWizard.svelte';

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
</script>

<div class="space-y-4">
	<div>
		<h1 class="text-xl font-bold" data-testid="workout-title">{data.session.dayName}</h1>
		<p class="text-sm text-muted-foreground">{data.session.programName}</p>
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
		<WorkoutWizard
			exerciseLogs={data.session.exerciseLogs}
			progressiveOverload={data.progressiveOverload}
			prescribedSetCounts={data.prescribedSetCounts}
			onfinish={() => (stopDialogOpen = true)}
			onaddexercise={() => (adhocDialogOpen = true)}
		/>
	{/if}
</div>

<!-- Stop Workout Confirmation -->
<AlertDialog bind:open={stopDialogOpen}>
	<AlertDialogContent>
		<AlertDialogHeader>
			<AlertDialogTitle>Finish Workout?</AlertDialogTitle>
			<AlertDialogDescription>
				Exercises without logged sets will be marked as skipped.
			</AlertDialogDescription>
		</AlertDialogHeader>
		<AlertDialogFooter>
			<AlertDialogCancel class="min-h-11">Continue Workout</AlertDialogCancel>
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
					class="min-h-11"
					disabled={stoppingWorkout}
					data-testid="confirm-stop-btn"
				>
					{stoppingWorkout ? 'Finishing...' : 'Finish Workout'}
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
			<DialogDescription>New exercises will be added to your library.</DialogDescription>
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
