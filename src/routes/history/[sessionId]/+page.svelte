<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
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
		DropdownMenu,
		DropdownMenuContent,
		DropdownMenuItem,
		DropdownMenuTrigger
	} from '$lib/components/ui/dropdown-menu';
	import { ChevronLeft, Ellipsis } from '@lucide/svelte';

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

<div class="space-y-6" data-testid="session-detail">
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
				<ChevronLeft class="size-5" />
			</Button>
			<div class="min-w-0 flex-1">
				<h1 class="text-xl font-bold">{data.session.dayName}</h1>
				<p class="text-sm text-muted-foreground">
					{data.session.programName} &middot; {formatDate(data.session.startedAt)}
				</p>
			</div>
			<Button
				variant="ghost"
				size="sm"
				class="min-h-[44px] text-destructive hover:text-destructive"
				onclick={() => (deleteSessionDialogOpen = true)}
				data-testid="delete-session-btn"
			>
				Delete
			</Button>
		</div>
	</div>

	{#if form?.error}
		<div
			class="rounded-2xl bg-destructive/10 p-3 text-sm text-destructive"
			data-testid="form-error"
		>
			{form.error}
		</div>
	{/if}

	<!-- Exercise logs -->
	{#if data.session.exerciseLogs.length === 0}
		<div class="flex flex-col items-center justify-center gap-3 py-16 text-center">
			<p class="text-muted-foreground">No exercises recorded in this session.</p>
		</div>
	{:else}
		<div class="space-y-4">
			{#each data.session.exerciseLogs as log (log.id)}
				<div
					class="glass-card overflow-hidden {log.status === 'skipped' ? 'opacity-60' : ''}"
					data-testid="exercise-log-card"
				>
					<div class="flex min-h-[44px] items-start justify-between px-4 py-3">
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
						<div class="border-t border-border/40 px-4 py-3">
							<div class="grid grid-cols-3 gap-2 text-xs font-medium text-muted-foreground">
								<span>Set</span>
								<span>Weight ({log.sets[0].unit})</span>
								<span>Reps</span>
							</div>
							{#each log.sets as set (set.id)}
								<div class="grid grid-cols-3 gap-2 py-1 text-sm" data-testid="set-detail-row">
									<span class="text-muted-foreground">{set.setNumber}</span>
									<span>{set.weight ?? '-'}</span>
									<span>{set.reps ?? '-'}</span>
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
	<AlertDialogContent class="rounded-2xl">
		<AlertDialogHeader>
			<AlertDialogTitle>Delete Session</AlertDialogTitle>
			<AlertDialogDescription>
				This will permanently remove the session and all logged sets.
			</AlertDialogDescription>
		</AlertDialogHeader>
		<AlertDialogFooter>
			<AlertDialogCancel class="min-h-[44px] rounded-xl">Cancel</AlertDialogCancel>
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
				<AlertDialogAction type="submit" class="min-h-[44px] rounded-xl" disabled={deletingSession}>
					{deletingSession ? 'Deleting...' : 'Delete'}
				</AlertDialogAction>
			</form>
		</AlertDialogFooter>
	</AlertDialogContent>
</AlertDialog>

<!-- Delete Exercise Log Confirmation -->
<AlertDialog bind:open={deleteExerciseDialogOpen}>
	<AlertDialogContent class="rounded-2xl">
		<AlertDialogHeader>
			<AlertDialogTitle>Delete Exercise</AlertDialogTitle>
			<AlertDialogDescription>
				"{deleteExerciseName}" and all its logged sets will be permanently removed.
			</AlertDialogDescription>
		</AlertDialogHeader>
		<AlertDialogFooter>
			<AlertDialogCancel class="min-h-[44px] rounded-xl">Cancel</AlertDialogCancel>
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
				<AlertDialogAction
					type="submit"
					class="min-h-[44px] rounded-xl"
					disabled={deletingExerciseLog}
				>
					{deletingExerciseLog ? 'Deleting...' : 'Delete'}
				</AlertDialogAction>
			</form>
		</AlertDialogFooter>
	</AlertDialogContent>
</AlertDialog>
