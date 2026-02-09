<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import {
		DropdownMenu,
		DropdownMenuContent,
		DropdownMenuItem,
		DropdownMenuSeparator,
		DropdownMenuTrigger
	} from '$lib/components/ui/dropdown-menu';
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
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Ellipsis } from '@lucide/svelte';

	let { data } = $props();

	let deleteDialogOpen = $state(false);
	let deleteTargetId = $state<number | null>(null);
	let deleteTargetName = $state('');
	let deleteTargetHasHistory = $state(false);

	let renameDialogOpen = $state(false);
	let renameTargetId = $state<number | null>(null);
	let renameName = $state('');

	function openDeleteDialog(id: number, name: string, hasHistory: boolean) {
		deleteTargetId = id;
		deleteTargetName = name;
		deleteTargetHasHistory = hasHistory;
		deleteDialogOpen = true;
	}

	function openRenameDialog(id: number, name: string) {
		renameTargetId = id;
		renameName = name;
		renameDialogOpen = true;
	}

	function formatRelativeDate(date: Date): string {
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
		if (diffDays === 0) return 'Today';
		if (diffDays === 1) return 'Yesterday';
		if (diffDays < 30) return `${diffDays} days ago`;
		return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
	}

	function formatMaxWeight(
		maxWeight: { weight: number; reps: number | null; unit: string; date: Date } | null
	): string {
		if (!maxWeight) return 'No history';
		const repsStr = maxWeight.reps !== null ? ` x ${maxWeight.reps} reps` : '';
		return `${maxWeight.weight} ${maxWeight.unit}${repsStr}`;
	}
</script>

<div class="space-y-4">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold">Exercises</h1>
	</div>

	{#if data.exercises.length === 0}
		<div
			class="flex flex-col items-center justify-center gap-4 py-12 text-center"
			data-testid="empty-state"
		>
			<p class="text-muted-foreground">
				No exercises yet. Exercises are added automatically when you create programs.
			</p>
			<Button href="/programs">Go to Programs</Button>
		</div>
	{:else}
		<div class="space-y-3">
			{#each data.exercises as exercise (exercise.id)}
				<div
					data-testid="exercise-item"
					class="flex items-start justify-between rounded-lg border border-border p-4"
				>
					<div class="min-w-0 flex-1">
						<p class="font-medium" data-testid="exercise-name">{exercise.name}</p>
						<div class="mt-1 space-y-0.5 text-sm text-muted-foreground">
							<p data-testid="exercise-max-weight">
								{#if exercise.maxWeight}
									Max: {formatMaxWeight(exercise.maxWeight)} — {formatRelativeDate(
										exercise.maxWeight.date
									)}
								{:else}
									Max: No history
								{/if}
							</p>
							<p data-testid="exercise-last-performed">
								Last performed: {exercise.lastPerformed
									? formatRelativeDate(exercise.lastPerformed)
									: 'Never'}
							</p>
						</div>
					</div>

					<DropdownMenu>
						<DropdownMenuTrigger>
							{#snippet child({ props })}
								<Button
									variant="ghost"
									size="icon-sm"
									{...props}
									aria-label="Actions for {exercise.name}"
								>
									<Ellipsis class="size-4" />
								</Button>
							{/snippet}
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem onclick={() => openRenameDialog(exercise.id, exercise.name)}>
								Rename
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								class="text-destructive focus:text-destructive"
								onclick={() =>
									openDeleteDialog(exercise.id, exercise.name, exercise.lastPerformed !== null)}
							>
								Delete
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			{/each}
		</div>
	{/if}
</div>

<!-- Delete Confirmation Dialog -->
<AlertDialog bind:open={deleteDialogOpen}>
	<AlertDialogContent>
		<AlertDialogHeader>
			<AlertDialogTitle>Delete Exercise</AlertDialogTitle>
			<AlertDialogDescription>
				{#if deleteTargetHasHistory}
					This exercise has workout history. The history will be kept but "{deleteTargetName}" will
					be removed from the library and any programs using it.
				{:else}
					Are you sure you want to delete "{deleteTargetName}"? It will be removed from any programs
					using it. This action cannot be undone.
				{/if}
			</AlertDialogDescription>
		</AlertDialogHeader>
		<AlertDialogFooter>
			<AlertDialogCancel>Cancel</AlertDialogCancel>
			<form method="POST" action="?/delete" use:enhance class="contents">
				<input type="hidden" name="exerciseId" value={deleteTargetId} />
				<AlertDialogAction type="submit">Delete</AlertDialogAction>
			</form>
		</AlertDialogFooter>
	</AlertDialogContent>
</AlertDialog>

<!-- Rename Dialog -->
<Dialog bind:open={renameDialogOpen}>
	<DialogContent>
		<DialogHeader>
			<DialogTitle>Rename Exercise</DialogTitle>
			<DialogDescription>Enter a new name for this exercise.</DialogDescription>
		</DialogHeader>
		<form method="POST" action="?/rename" use:enhance class="space-y-4">
			<input type="hidden" name="exerciseId" value={renameTargetId} />
			<div class="space-y-2">
				<Label for="rename-input">Exercise Name</Label>
				<Input id="rename-input" name="newName" bind:value={renameName} />
			</div>
			<DialogFooter>
				<DialogClose>
					{#snippet child({ props })}
						<Button variant="outline" {...props}>Cancel</Button>
					{/snippet}
				</DialogClose>
				<Button type="submit">Save</Button>
			</DialogFooter>
		</form>
	</DialogContent>
</Dialog>
