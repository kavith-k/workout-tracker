<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { ChevronLeft } from '@lucide/svelte';
	import { untrack } from 'svelte';
	import ProgramForm from '$lib/components/program/ProgramForm.svelte';

	let { data, form } = $props();

	const initialData = untrack(() => ({
		name: data.program.name,
		days: data.program.days.map(
			(d: { name: string; exercises: Array<{ exerciseName: string; setsCount: number }> }) => ({
				name: d.name,
				exercises: d.exercises.map((ex: { exerciseName: string; setsCount: number }) => ({
					exerciseName: ex.exerciseName,
					setsCount: ex.setsCount
				}))
			})
		)
	}));
</script>

<div class="space-y-6">
	<div class="flex items-center gap-2">
		<Button
			variant="ghost"
			size="icon"
			href="/programs"
			aria-label="Back to programs"
			class="-ml-2 min-h-[44px] min-w-[44px]"
		>
			<ChevronLeft class="size-5" />
		</Button>
		<h1 class="text-xl font-semibold">Edit Program</h1>
	</div>

	{#if form?.error}
		<div
			class="rounded-2xl bg-destructive/10 p-3 text-sm text-destructive"
			data-testid="form-error"
		>
			{form.error}
		</div>
	{/if}

	<ProgramForm {initialData} exerciseNames={data.exercises} submitLabel="Save Changes" />
</div>
