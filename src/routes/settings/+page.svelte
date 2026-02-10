<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { validateProgramUpload } from '$lib/schemas/program-upload';

	let { form } = $props();

	let uploadError = $state('');
	let fileInput = $state<HTMLInputElement | null>(null);
	let hiddenDataInput = $state<HTMLInputElement | null>(null);
	let uploadForm = $state<HTMLFormElement | null>(null);

	function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		uploadError = '';

		const reader = new FileReader();
		reader.onload = () => {
			let parsed: unknown;
			try {
				parsed = JSON.parse(reader.result as string);
			} catch {
				uploadError = 'Invalid JSON file';
				return;
			}

			const result = validateProgramUpload(parsed);
			if (!result.ok) {
				uploadError = result.error;
				return;
			}

			if (hiddenDataInput) {
				hiddenDataInput.value = JSON.stringify(result.data);
			}
			uploadForm?.requestSubmit();
		};
		reader.readAsText(file);

		// Reset so the same file can be re-selected
		input.value = '';
	}
</script>

<div class="space-y-6">
	<h1 class="text-2xl font-bold">Settings</h1>

	<section class="space-y-3">
		<h2 class="text-lg font-semibold">Export Data</h2>
		<div class="flex flex-col gap-2 sm:flex-row">
			<Button
				href="/settings/export/json"
				variant="outline"
				class="min-h-[44px]"
				data-testid="export-json-btn"
			>
				Export as JSON
			</Button>
			<Button
				href="/settings/export/csv"
				variant="outline"
				class="min-h-[44px]"
				data-testid="export-csv-btn"
			>
				Export as CSV
			</Button>
		</div>
	</section>

	<section class="space-y-3">
		<div>
			<h2 class="text-lg font-semibold">Import Program</h2>
			<p class="text-sm text-muted-foreground">Upload a JSON file to create a new program.</p>
		</div>

		{#if uploadError || form?.error}
			<div
				class="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
				data-testid="upload-error"
			>
				{uploadError || form?.error}
			</div>
		{/if}

		<input
			bind:this={fileInput}
			type="file"
			accept=".json"
			class="hidden"
			onchange={handleFileSelect}
		/>

		<form bind:this={uploadForm} method="POST" action="?/upload" use:enhance class="contents">
			<input bind:this={hiddenDataInput} type="hidden" name="data" />
		</form>

		<Button
			variant="outline"
			class="min-h-[44px]"
			data-testid="upload-program-btn"
			onclick={() => fileInput?.click()}
		>
			Upload Program File
		</Button>
	</section>
</div>
