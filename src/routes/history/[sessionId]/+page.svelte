<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Separator } from '$lib/components/ui/separator';
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
		DropdownMenu,
		DropdownMenuContent,
		DropdownMenuItem,
		DropdownMenuTrigger
	} from '$lib/components/ui/dropdown-menu';
	import { ArrowLeft, Ellipsis } from '@lucide/svelte';

	let { data, form } = $props();

	let deleteSessionDialogOpen = $state(false);
	let deleteExerciseDialogOpen = $state(false);
	let deleteExerciseLogId = $state<number | null>(null);
	let deleteExerciseName = $state('');
	let deletingSession = $state(false);
	let deletingExerciseLog = $state(false);

	function formatDate(date: Date): string {
		return new Date(date).toLocaleDateString('en-GB', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}

	function openDeleteExerciseDialog(logId: number, name: string) {
		deleteExerciseLogId = logId;
		deleteExerciseName = name;
		deleteExerciseDialogOpen = true;
	}
</script>

<div class="space-y-4" data-testid="session-detail">
	<!-- Header -->
	<div class="space-y-2">
		<div class="flex items-center gap-3">
			<Button
				variant="ghost"
				size="icon"
				class="min-h-[44px] min-w-[44px]"
				href="/history"
				aria-label="Back to history"
			>
				<ArrowLeft class="size-5" />
			</Button>
			<div class="flex-1">
				<h1 class="text-xl font-bold">{data.session.dayName}</h1>
				<p class="text-sm text-muted-foreground">{data.session.programName}</p>
			</div>
			<Button
				variant="destructive"
				size="sm"
				class="min-h-[44px]"
				onclick={() => (deleteSessionDialogOpen = true)}
				data-testid="delete-session-btn"
			>
				Delete Session
			</Button>
		</div>
		<p class="pl-12 text-sm text-muted-foreground" data-testid="session-detail-date">
			{formatDate(data.session.startedAt)}
		</p>
	</div>

	{#if form?.error}
		<div
			class="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
			data-testid="form-error"
		>
			{form.error}
		</div>
	{/if}

	<Separator />

	<!-- Exercise logs -->
	{#if data.session.exerciseLogs.length === 0}
		<div class="flex flex-col items-center justify-center gap-4 py-12 text-center">
			<p class="text-muted-foreground">No exercises recorded in this session.</p>
		</div>
	{:else}
		<div class="space-y-4">
			{#each data.session.exerciseLogs as log (log.id)}
				<div
					class="rounded-lg border border-border p-4 {log.status === 'skipped' ? 'opacity-60' : ''}"
					data-testid="exercise-log-card"
				>
					<div class="flex items-start justify-between">
						<div class="flex items-center gap-2">
							<h3 class="font-semibold" data-testid="exercise-log-name">
								{log.exerciseName}
							</h3>
							{#if log.status === 'skipped'}
								<Badge variant="secondary">Skipped</Badge>
							{/if}
						</div>

						<DropdownMenu>
							<DropdownMenuTrigger>
								{#snippet child({ props })}
									<Button
										variant="ghost"
										size="icon-sm"
										class="min-h-[44px] min-w-[44px]"
										{...props}
										aria-label="Actions for {log.exerciseName}"
									>
										<Ellipsis class="size-4" />
									</Button>
								{/snippet}
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem
									class="text-destructive focus:text-destructive"
									onclick={() => openDeleteExerciseDialog(log.id, log.exerciseName)}
									data-testid="delete-exercise-log-btn"
								>
									Delete
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>

					{#if log.status !== 'skipped' && log.sets.length > 0}
						<div class="mt-3">
							<div class="grid grid-cols-4 gap-2 text-xs font-medium text-muted-foreground">
								<span>Set</span>
								<span>Weight</span>
								<span>Reps</span>
								<span>Unit</span>
							</div>
							{#each log.sets as set (set.id)}
								<div class="grid grid-cols-4 gap-2 py-1 text-sm" data-testid="set-detail-row">
									<span class="text-muted-foreground">{set.setNumber}</span>
									<span>{set.weight ?? '-'}</span>
									<span>{set.reps ?? '-'}</span>
									<span class="text-muted-foreground">{set.unit}</span>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>

<!-- Delete Session Confirmation -->
<AlertDialog bind:open={deleteSessionDialogOpen}>
	<AlertDialogContent>
		<AlertDialogHeader>
			<AlertDialogTitle>Delete Session</AlertDialogTitle>
			<AlertDialogDescription>
				Are you sure you want to delete this workout session? This will permanently remove the
				session and all logged sets. This action cannot be undone.
			</AlertDialogDescription>
		</AlertDialogHeader>
		<AlertDialogFooter>
			<AlertDialogCancel class="min-h-[44px]">Cancel</AlertDialogCancel>
			<form
				method="POST"
				action="?/deleteSession"
				use:enhance={() => {
					deletingSession = true;
					return async ({ update }) => {
						await update();
						deletingSession = false;
					};
				}}
				class="contents"
			>
				<input type="hidden" name="sessionId" value={data.session.id} />
				<AlertDialogAction type="submit" class="min-h-[44px]" disabled={deletingSession}>
					{deletingSession ? 'Deleting...' : 'Delete'}
				</AlertDialogAction>
			</form>
		</AlertDialogFooter>
	</AlertDialogContent>
</AlertDialog>

<!-- Delete Exercise Log Confirmation -->
<AlertDialog bind:open={deleteExerciseDialogOpen}>
	<AlertDialogContent>
		<AlertDialogHeader>
			<AlertDialogTitle>Delete Exercise</AlertDialogTitle>
			<AlertDialogDescription>
				Are you sure you want to delete "{deleteExerciseName}" from this session? This will remove
				all logged sets for this exercise. This action cannot be undone.
			</AlertDialogDescription>
		</AlertDialogHeader>
		<AlertDialogFooter>
			<AlertDialogCancel class="min-h-[44px]">Cancel</AlertDialogCancel>
			<form
				method="POST"
				action="?/deleteExerciseLog"
				use:enhance={() => {
					deletingExerciseLog = true;
					return async ({ update }) => {
						await update();
						deletingExerciseLog = false;
					};
				}}
				class="contents"
			>
				<input type="hidden" name="exerciseLogId" value={deleteExerciseLogId} />
				<AlertDialogAction type="submit" class="min-h-[44px]" disabled={deletingExerciseLog}>
					{deletingExerciseLog ? 'Deleting...' : 'Delete'}
				</AlertDialogAction>
			</form>
		</AlertDialogFooter>
	</AlertDialogContent>
</AlertDialog>
