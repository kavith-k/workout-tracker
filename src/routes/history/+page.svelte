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
	import { ChevronRight, Ellipsis, LoaderCircle } from '@lucide/svelte';
	import type { SessionSummary } from '$lib/server/db/queries/history';

	let { data, form } = $props();

	let sessions = $state<SessionSummary[]>([]);
	let currentPage = $state(1);
	let loading = $state(false);
	let hasMore = $state(true);
	let sentinel = $state<HTMLDivElement>();

	let deleteDialogOpen = $state(false);
	let deleteTargetId = $state<number | null>(null);
	let deleteTargetDay = $state('');
	let deletingSession = $state(false);

	// Initialise from server-loaded data
	$effect(() => {
		sessions = data.sessions;
		currentPage = data.page;
		hasMore = data.page * data.limit < data.total;
	});

	async function loadMore() {
		if (loading || !hasMore) return;
		loading = true;

		const nextPage = currentPage + 1;
		const res = await fetch(`/api/history?page=${nextPage}&limit=${data.limit}`);
		const result: { sessions: SessionSummary[]; total: number } = await res.json();

		sessions = [...sessions, ...result.sessions];
		currentPage = nextPage;
		hasMore = nextPage * data.limit < result.total;
		loading = false;
	}

	// Set up IntersectionObserver on the sentinel element
	$effect(() => {
		if (!sentinel) return;

		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting) {
					loadMore();
				}
			},
			{ rootMargin: '200px' }
		);

		observer.observe(sentinel);

		return () => observer.disconnect();
	});

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

	{#if form?.error}
		<div
			class="rounded-2xl bg-destructive/10 p-3 text-sm text-destructive"
			data-testid="form-error"
		>
			{form.error}
		</div>
	{/if}

	{#if sessions.length === 0}
		<div
			class="flex flex-col items-center justify-center gap-3 py-16 text-center"
			data-testid="empty-state"
		>
			<p class="text-muted-foreground">No workout history yet.</p>
		</div>
	{:else}
		<div class="glass-card overflow-hidden">
			{#each sessions as session (session.id)}
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

		<!-- Sentinel for infinite scroll -->
		{#if hasMore}
			<div bind:this={sentinel} class="flex justify-center py-4">
				{#if loading}
					<LoaderCircle class="size-6 animate-spin text-muted-foreground" />
				{/if}
			</div>
		{/if}
	{/if}
</div>

<!-- Delete Confirmation Dialog -->
<AlertDialog bind:open={deleteDialogOpen}>
	<AlertDialogContent class="rounded-2xl">
		<AlertDialogHeader>
			<AlertDialogTitle>Delete Workout</AlertDialogTitle>
			<AlertDialogDescription>
				Delete this "{deleteTargetDay}" workout? This cannot be undone.
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
						deleteDialogOpen = false;
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
