<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
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
	import { Ellipsis, Plus } from '@lucide/svelte';

	let { data } = $props();

	let deleteDialogOpen = $state(false);
	let deleteTargetId = $state<number | null>(null);
	let deleteTargetName = $state('');

	let duplicateDialogOpen = $state(false);
	let duplicateTargetId = $state<number | null>(null);
	let duplicateName = $state('');

	function openDeleteDialog(id: number, name: string) {
		deleteTargetId = id;
		deleteTargetName = name;
		deleteDialogOpen = true;
	}

	function openDuplicateDialog(id: number, name: string) {
		duplicateTargetId = id;
		duplicateName = `${name} (Copy)`;
		duplicateDialogOpen = true;
	}
</script>

<div class="space-y-4">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold">Programs</h1>
	</div>

	{#if data.programs.length === 0}
		<div class="flex flex-col items-center justify-center gap-4 py-12 text-center">
			<p class="text-muted-foreground">No programs yet. Create your first workout program.</p>
			<Button href="/programs/new">
				<Plus class="size-4" />
				Create Program
			</Button>
		</div>
	{:else}
		<div class="space-y-3">
			{#each data.programs as program (program.id)}
				<div
					data-testid="program-card"
					class="flex items-center justify-between rounded-lg border border-border p-4"
				>
					<div class="flex items-center gap-3">
						<span class="font-medium">{program.name}</span>
						{#if program.isActive}
							<Badge variant="secondary">Active</Badge>
						{/if}
					</div>

					<DropdownMenu>
						<DropdownMenuTrigger>
							{#snippet child({ props })}
								<Button variant="ghost" size="icon-sm" {...props} aria-label="Actions">
									<Ellipsis class="size-4" />
								</Button>
							{/snippet}
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem>
								<a
									href={resolve('/programs/[programId]', { programId: String(program.id) })}
									class="w-full"
								>
									Edit
								</a>
							</DropdownMenuItem>
							<DropdownMenuItem onclick={() => openDuplicateDialog(program.id, program.name)}>
								Duplicate
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							{#if !program.isActive}
								<DropdownMenuItem>
									<form method="POST" action="?/setActive" use:enhance class="contents">
										<input type="hidden" name="programId" value={program.id} />
										<button type="submit" class="w-full text-left">Set Active</button>
									</form>
								</DropdownMenuItem>
							{/if}
							<DropdownMenuItem
								class="text-destructive focus:text-destructive"
								onclick={() => openDeleteDialog(program.id, program.name)}
							>
								Delete
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			{/each}
		</div>

		<Button href="/programs/new" class="min-h-[44px] w-full">
			<Plus class="size-4" />
			Create Program
		</Button>
	{/if}
</div>

<!-- Delete Confirmation Dialog -->
<AlertDialog bind:open={deleteDialogOpen}>
	<AlertDialogContent>
		<AlertDialogHeader>
			<AlertDialogTitle>Delete Program</AlertDialogTitle>
			<AlertDialogDescription>
				Are you sure you want to delete "{deleteTargetName}"? This action cannot be undone.
			</AlertDialogDescription>
		</AlertDialogHeader>
		<AlertDialogFooter>
			<AlertDialogCancel>Cancel</AlertDialogCancel>
			<form method="POST" action="?/delete" use:enhance class="contents">
				<input type="hidden" name="programId" value={deleteTargetId} />
				<AlertDialogAction type="submit">Delete</AlertDialogAction>
			</form>
		</AlertDialogFooter>
	</AlertDialogContent>
</AlertDialog>

<!-- Duplicate Dialog -->
<Dialog bind:open={duplicateDialogOpen}>
	<DialogContent>
		<DialogHeader>
			<DialogTitle>Duplicate Program</DialogTitle>
			<DialogDescription>Enter a name for the duplicate program.</DialogDescription>
		</DialogHeader>
		<form method="POST" action="?/duplicate" use:enhance class="space-y-4">
			<input type="hidden" name="programId" value={duplicateTargetId} />
			<div class="space-y-2">
				<Label for="duplicate-name">Program Name</Label>
				<Input id="duplicate-name" name="newName" bind:value={duplicateName} />
			</div>
			<DialogFooter>
				<DialogClose>
					{#snippet child({ props })}
						<Button variant="outline" {...props}>Cancel</Button>
					{/snippet}
				</DialogClose>
				<Button type="submit">Duplicate</Button>
			</DialogFooter>
		</form>
	</DialogContent>
</Dialog>
