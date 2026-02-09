<script lang="ts">
	import { Button } from '$lib/components/ui/button';
</script>

<div class="space-y-8">
	<h1 class="text-2xl font-bold">Settings</h1>

	<section class="space-y-4">
		<div>
			<h2 class="text-lg font-semibold">Export Data</h2>
			<p class="text-sm text-muted-foreground">
				Download your workout data for backup or analysis.
			</p>
		</div>

		<div class="flex gap-3">
			<Button href="/settings/export/json" variant="outline" data-testid="export-json-btn">
				Export as JSON
			</Button>
			<Button href="/settings/export/csv" variant="outline" data-testid="export-csv-btn">
				Export as CSV
			</Button>
		</div>
	</section>
</div>
