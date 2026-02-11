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
	import { ChevronRight, Ellipsis } from '@lucide/svelte';

	let { data, form } = $props();

	let deleteDialogOpen = $state(false);
	let deleteTargetId = $state<number | null>(null);
	let deleteTargetDay = $state('');
	let deletingSession = $state(false);

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

<div class="space-y-6">
	<h1 class="text-3xl font-bold tracking-tight">History</h1>

	<div class="flex rounded-xl bg-muted p-1" data-testid="view-toggle">
		<span
			class="flex min-h-[36px] flex-1 items-center justify-center rounded-lg bg-card px-3 text-sm font-medium text-foreground shadow-sm"
		>
			By Date
		</span>
		<a
			href={resolve('/history/by-exercise')}
			class="flex min-h-[36px] flex-1 items-center justify-center rounded-lg px-3 text-sm font-medium text-muted-foreground"
		>
			By Exercise
		</a>
	</div>

	{#if form?.error}
		<div
			class="rounded-2xl bg-destructive/10 p-3 text-sm text-destructive"
			data-testid="form-error"
		>
			{form.error}
		</div>
	{/if}

	{#if data.sessions.length === 0}
		<div
			class="flex flex-col items-center justify-center gap-3 py-16 text-center"
			data-testid="empty-state"
		>
			<p class="text-muted-foreground">
				No workout history yet. Complete a workout to see it here.
			</p>
		</div>
	{:else}
		<div class="overflow-hidden rounded-2xl bg-card shadow-xs">
			{#each data.sessions as session (session.id)}
				<div
					data-testid="session-card"
					class="flex min-h-[44px] items-center border-b border-border/40 last:border-b-0"
				>
					<a
						href={resolve('/history/[sessionId]', { sessionId: String(session.id) })}
						class="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 active:bg-muted/60"
					>
						<div class="min-w-0 flex-1">
							<p class="font-bold" data-testid="session-date">
								{getDayOfWeek(session.completedAt ?? session.startedAt)}
							</p>
							<p class="text-sm text-muted-foreground">
								{session.programName} &middot; {formatDate(
									session.completedAt ?? session.startedAt
								)}
							</p>
							<p class="mt-1 text-sm text-muted-foreground" data-testid="session-exercises">
								{session.completedCount}/{session.exerciseCount} exercises{#if session.skippedCount > 0}
									&middot; {session.skippedCount} skipped
								{/if}
							</p>
						</div>
						<ChevronRight class="size-5 shrink-0 text-muted-foreground/40" />
					</a>

					<DropdownMenu>
						<DropdownMenuTrigger>
							{#snippet child({ props })}
								<Button
									variant="ghost"
									size="icon-sm"
									class="mr-1 min-h-[44px] min-w-[44px]"
									{...props}
									aria-label="Actions for session"
								>
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
	<AlertDialogContent class="rounded-2xl">
		<AlertDialogHeader>
			<AlertDialogTitle>Delete Workout</AlertDialogTitle>
			<AlertDialogDescription>
				Are you sure you want to delete this "{deleteTargetDay}" workout? This action cannot be
				undone.
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
				<input type="hidden" name="sessionId" value={deleteTargetId} />
				<AlertDialogAction type="submit" class="min-h-[44px] rounded-xl" disabled={deletingSession}>
					{deletingSession ? 'Deleting...' : 'Delete'}
				</AlertDialogAction>
			</form>
		</AlertDialogFooter>
	</AlertDialogContent>
</AlertDialog>
