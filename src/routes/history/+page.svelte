<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
	import {
		DropdownMenu,
		DropdownMenuContent,
		DropdownMenuItem,
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
	import { Ellipsis } from '@lucide/svelte';

	let { data } = $props();

	let deleteDialogOpen = $state(false);
	let deleteTargetId = $state<number | null>(null);
	let deleteTargetDay = $state('');

	function openDeleteDialog(id: number, dayName: string) {
		deleteTargetId = id;
		deleteTargetDay = dayName;
		deleteDialogOpen = true;
	}

	function formatDate(date: Date): string {
		return new Date(date).toLocaleDateString('en-GB', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}

	function getDayOfWeek(date: Date): string {
		return new Date(date).toLocaleDateString('en-GB', { weekday: 'long' });
	}
</script>

<div class="space-y-4">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold">History</h1>
	</div>

	<div class="flex gap-1" data-testid="view-toggle">
		<Button variant="default" size="sm" class="rounded-full">By Date</Button>
		<Button variant="ghost" size="sm" class="rounded-full" href="/history/by-exercise">
			By Exercise
		</Button>
	</div>

	{#if data.sessions.length === 0}
		<div
			class="flex flex-col items-center justify-center gap-4 py-12 text-center"
			data-testid="empty-state"
		>
			<p class="text-muted-foreground">
				No workout history yet. Complete a workout to see it here.
			</p>
		</div>
	{:else}
		<div class="space-y-3">
			{#each data.sessions as session (session.id)}
				<div
					data-testid="session-card"
					class="flex items-start justify-between rounded-lg border border-border p-4"
				>
					<a
						href={resolve('/history/[sessionId]', { sessionId: String(session.id) })}
						class="min-w-0 flex-1"
					>
						<p class="font-bold" data-testid="session-date">
							{getDayOfWeek(session.completedAt ?? session.startedAt)}
						</p>
						<p class="text-sm text-muted-foreground">
							{session.programName} &middot; {formatDate(session.completedAt ?? session.startedAt)}
						</p>
						<p class="mt-1 text-sm text-muted-foreground" data-testid="session-exercises">
							{session.completedCount}/{session.exerciseCount} exercises{#if session.skippedCount > 0}
								&middot; {session.skippedCount} skipped
							{/if}
						</p>
					</a>

					<DropdownMenu>
						<DropdownMenuTrigger>
							{#snippet child({ props })}
								<Button variant="ghost" size="icon-sm" {...props} aria-label="Actions for session">
									<Ellipsis class="size-4" />
								</Button>
							{/snippet}
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem
								class="text-destructive focus:text-destructive"
								onclick={() => openDeleteDialog(session.id, session.dayName)}
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
			<AlertDialogTitle>Delete Workout</AlertDialogTitle>
			<AlertDialogDescription>
				Are you sure you want to delete this "{deleteTargetDay}" workout? This action cannot be
				undone.
			</AlertDialogDescription>
		</AlertDialogHeader>
		<AlertDialogFooter>
			<AlertDialogCancel>Cancel</AlertDialogCancel>
			<form method="POST" action="?/deleteSession" use:enhance class="contents">
				<input type="hidden" name="sessionId" value={deleteTargetId} />
				<AlertDialogAction type="submit">Delete</AlertDialogAction>
			</form>
		</AlertDialogFooter>
	</AlertDialogContent>
</AlertDialog>
