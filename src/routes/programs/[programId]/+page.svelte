<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { ArrowLeft } from '@lucide/svelte';
	import { untrack } from 'svelte';
	import ProgramForm from '$lib/components/program/ProgramForm.svelte';

	let { data } = $props();

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

<div class="space-y-4">
	<div class="flex items-center gap-3">
		<Button variant="ghost" size="icon" href="/programs" aria-label="Back to programs">
			<ArrowLeft class="size-5" />
		</Button>
		<h1 class="text-2xl font-bold">Edit Program</h1>
	</div>

	<ProgramForm {initialData} exerciseNames={data.exercises} submitLabel="Save Changes" />
</div>
