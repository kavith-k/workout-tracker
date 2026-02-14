<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { validateProgramUpload } from '$lib/schemas/program-upload';
	import { themeStore } from '$lib/stores/theme.svelte';

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
	<h1 class="text-3xl font-bold tracking-tight">Settings</h1>

	<section class="space-y-2">
		<h2 class="px-1 pb-1.5 text-sm font-medium tracking-wide text-muted-foreground uppercase">
			Appearance
		</h2>
		<div class="glass-card overflow-hidden">
			<div class="flex min-h-11 items-center justify-between px-4 py-3">
				<span>Theme</span>
				<div class="flex rounded-lg bg-muted p-0.5">
					<button
						class="rounded-md px-3 py-1.5 text-xs font-medium transition-colors {themeStore.theme ===
						'light'
							? 'bg-neon text-neon-foreground'
							: 'text-muted-foreground'}"
						onclick={() => (themeStore.theme = 'light')}
					>
						Light
					</button>
					<button
						class="rounded-md px-3 py-1.5 text-xs font-medium transition-colors {themeStore.theme ===
						'dark'
							? 'bg-neon text-neon-foreground'
							: 'text-muted-foreground'}"
						onclick={() => (themeStore.theme = 'dark')}
					>
						Dark
					</button>
					<button
						class="rounded-md px-3 py-1.5 text-xs font-medium transition-colors {themeStore.theme ===
						'system'
							? 'bg-neon text-neon-foreground'
							: 'text-muted-foreground'}"
						onclick={() => (themeStore.theme = 'system')}
					>
						System
					</button>
				</div>
			</div>
		</div>
	</section>

	<section class="space-y-2">
		<h2 class="px-1 pb-1.5 text-sm font-medium tracking-wide text-muted-foreground uppercase">
			Export Data
		</h2>
		<div class="glass-card overflow-hidden">
			<a
				href={resolve('/settings/export/json')}
				class="flex min-h-11 items-center border-b border-border/40 px-4 py-3 last:border-b-0 active:bg-muted/60"
				data-testid="export-json-btn"
			>
				<span class="min-w-0 flex-1">Export as JSON</span>
			</a>
			<a
				href={resolve('/settings/export/csv')}
				class="flex min-h-11 items-center border-b border-border/40 px-4 py-3 last:border-b-0 active:bg-muted/60"
				data-testid="export-csv-btn"
			>
				<span class="min-w-0 flex-1">Export as CSV</span>
			</a>
		</div>
	</section>

	<section class="space-y-2">
		<div class="px-1">
			<h2 class="pb-1.5 text-sm font-medium tracking-wide text-muted-foreground uppercase">
				Import Program
			</h2>
			<p class="text-sm text-muted-foreground">Upload a JSON file to import a program.</p>
		</div>

		{#if uploadError || form?.error}
			<div
				class="rounded-2xl bg-destructive/10 p-3 text-sm text-destructive"
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

		<div class="glass-card overflow-hidden">
			<button
				class="flex min-h-11 w-full items-center px-4 py-3 text-left active:bg-muted/60"
				data-testid="upload-program-btn"
				onclick={() => fileInput?.click()}
			>
				Upload Program File
			</button>
		</div>
	</section>
</div>
