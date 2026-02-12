import { expect, test } from '@playwright/test';

test.describe.serial('Export', () => {
	test('settings page shows export buttons', async ({ page }) => {
		await page.goto('/settings');

		await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
		await expect(page.getByText('Export Data')).toBeVisible();
		await expect(page.getByTestId('export-json-btn')).toBeVisible();
		await expect(page.getByTestId('export-csv-btn')).toBeVisible();
	});

	test('exports JSON with correct structure', async ({ request }) => {
		const response = await request.get('/settings/export/json');

		expect(response.status()).toBe(200);
		expect(response.headers()['content-type']).toContain('application/json');
		expect(response.headers()['content-disposition']).toContain('workout-tracker-export.json');

		const data = await response.json();

		// Verify top-level structure
		expect(data.version).toBe('1.0');
		expect(data.exportedAt).toBeDefined();
		expect(Array.isArray(data.programs)).toBe(true);
		expect(Array.isArray(data.exercises)).toBe(true);

		// Should have programs from earlier test phases
		expect(data.programs.length).toBeGreaterThan(0);

		// Each program should have days array
		const program = data.programs[0];
		expect(Array.isArray(program.days)).toBe(true);
		expect(program.name).toBeDefined();
		expect(typeof program.isActive).toBe('boolean');

		// Should have exercises in the library
		expect(data.exercises.length).toBeGreaterThan(0);
		expect(data.exercises[0].name).toBeDefined();
		expect(data.exercises[0].unitPreference).toBeDefined();
	});

	test('exports CSV with correct structure', async ({ request }) => {
		const response = await request.get('/settings/export/csv');

		expect(response.status()).toBe(200);
		expect(response.headers()['content-type']).toContain('text/csv');
		expect(response.headers()['content-disposition']).toContain('workout-tracker-export.csv');

		const csv = await response.text();
		const lines = csv.trim().split('\n');

		// Should have at least the header
		expect(lines.length).toBeGreaterThanOrEqual(1);

		// Verify header
		expect(lines[0]).toBe(
			'session_date,session_id,program_name,day_name,' +
				'exercise_name,exercise_status,set_number,weight,reps,unit'
		);

		// Should have data rows from earlier test phases
		if (lines.length > 1) {
			const firstDataRow = lines[1].split(',');
			// session_date should be a date string (YYYY-MM-DD)
			expect(firstDataRow[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
			// session_id should be a number
			expect(Number(firstDataRow[1])).toBeGreaterThan(0);
			// exercise_status should be 'logged' or 'skipped'
			expect(['logged', 'skipped']).toContain(firstDataRow[5]);
		}
	});

	test('downloads JSON via settings page button', async ({ page }) => {
		await page.goto('/settings');

		const downloadPromise = page.waitForEvent('download');
		await page.getByTestId('export-json-btn').click();
		const download = await downloadPromise;

		expect(download.suggestedFilename()).toBe('workout-tracker-export.json');
	});

	test('downloads CSV via settings page button', async ({ page }) => {
		await page.goto('/settings');

		const downloadPromise = page.waitForEvent('download');
		await page.getByTestId('export-csv-btn').click();
		const download = await downloadPromise;

		expect(download.suggestedFilename()).toBe('workout-tracker-export.csv');
	});
});
