import { expect, test } from '@playwright/test';

test.describe.serial('Export', () => {
	test('settings page shows export buttons', async ({ page }) => {
		await page.goto('/settings');

		await expect(page.getByText('Settings')).toBeVisible();
		await expect(page.getByText('Export Data')).toBeVisible();
		await expect(page.getByTestId('export-json-btn')).toBeVisible();
		await expect(page.getByTestId('export-csv-btn')).toBeVisible();
	});

	test('exports JSON with correct structure', async ({ page }) => {
		await page.goto('/settings');

		const downloadPromise = page.waitForEvent('download');
		await page.getByTestId('export-json-btn').click();
		const download = await downloadPromise;

		expect(download.suggestedFilename()).toBe('workout-tracker-export.json');

		const stream = await download.createReadStream();
		const chunks: Buffer[] = [];
		for await (const chunk of stream) {
			chunks.push(chunk);
		}
		const content = Buffer.concat(chunks).toString('utf-8');
		const data = JSON.parse(content);

		expect(data.version).toBe('1.0');
		expect(data.exportedAt).toBeDefined();
		expect(Array.isArray(data.programs)).toBe(true);
		expect(Array.isArray(data.exercises)).toBe(true);

		// Should have data from previous test phases
		expect(data.programs.length).toBeGreaterThan(0);
		expect(data.exercises.length).toBeGreaterThan(0);

		// Verify program structure
		const program = data.programs[0];
		expect(program).toHaveProperty('id');
		expect(program).toHaveProperty('name');
		expect(program).toHaveProperty('isActive');
		expect(program).toHaveProperty('days');

		// Verify exercise library structure
		const exercise = data.exercises[0];
		expect(exercise).toHaveProperty('id');
		expect(exercise).toHaveProperty('name');
		expect(exercise).toHaveProperty('unitPreference');
	});

	test('exports CSV with correct structure', async ({ page }) => {
		await page.goto('/settings');

		const downloadPromise = page.waitForEvent('download');
		await page.getByTestId('export-csv-btn').click();
		const download = await downloadPromise;

		expect(download.suggestedFilename()).toBe('workout-tracker-export.csv');

		const stream = await download.createReadStream();
		const chunks: Buffer[] = [];
		for await (const chunk of stream) {
			chunks.push(chunk);
		}
		const content = Buffer.concat(chunks).toString('utf-8');
		const lines = content.split('\n');

		// Verify header
		expect(lines[0]).toBe(
			'session_date,session_id,program_name,day_name,exercise_name,exercise_status,set_number,weight,reps,unit'
		);

		// Should have data rows from previous workout tests
		expect(lines.length).toBeGreaterThan(1);

		// Verify data row structure (split first data row)
		const fields = lines[1].split(',');
		expect(fields.length).toBeGreaterThanOrEqual(10);

		// Session date should be YYYY-MM-DD format
		expect(fields[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});
});
