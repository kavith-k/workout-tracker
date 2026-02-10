<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { ArrowLeft } from '@lucide/svelte';
	import ProgramForm from '$lib/components/program/ProgramForm.svelte';

	let { data, form } = $props();
</script>

<div class="space-y-4">
	<div class="flex items-center gap-3">
		<Button variant="ghost" size="icon" href="/programs" aria-label="Back to programs">
			<ArrowLeft class="size-5" />
		</Button>
		<h1 class="text-2xl font-bold">New Program</h1>
	</div>

	{#if form?.error}
		<div
			class="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
			data-testid="form-error"
		>
			{form.error}
		</div>
	{/if}

	<ProgramForm exerciseNames={data.exercises} submitLabel="Create Program" />
</div>
