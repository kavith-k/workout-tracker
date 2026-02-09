<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { ArrowLeft } from '@lucide/svelte';
	import ProgramForm from '$lib/components/program/ProgramForm.svelte';

	let { data } = $props();
</script>

<div class="space-y-4">
	<div class="flex items-center gap-3">
		<Button variant="ghost" size="icon" href="/programs" aria-label="Back to programs">
			<ArrowLeft class="size-5" />
		</Button>
		<h1 class="text-2xl font-bold">New Program</h1>
	</div>

	<ProgramForm exerciseNames={data.exercises} submitLabel="Create Program" />
</div>
