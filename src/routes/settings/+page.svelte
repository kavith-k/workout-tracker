<script lang="ts">
	import { Button } from '$lib/components/ui/button';
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
</div>
