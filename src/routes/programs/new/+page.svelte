<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { ChevronLeft } from '@lucide/svelte';
	import ProgramForm from '$lib/components/program/ProgramForm.svelte';

	let { data, form } = $props();
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
		<h1 class="text-xl font-semibold">New Program</h1>
	</div>

	{#if form?.error}
		<div
			class="rounded-2xl bg-destructive/10 p-3 text-sm text-destructive"
			data-testid="form-error"
		>
			{form.error}
		</div>
	{/if}

	<ProgramForm exerciseNames={data.exercises} submitLabel="Create Program" />
</div>
