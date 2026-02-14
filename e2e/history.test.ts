import { expect, test } from '@playwright/test';

test.describe.serial('History', () => {
	test('shows history with completed workouts', async ({ page }) => {
		await page.goto('/history');

		await expect(page.getByRole('heading', { name: 'History' })).toBeVisible();

		// Should have session cards from previous workout-flow tests
		const sessionCards = page.getByTestId('session-card');
		const count = await sessionCards.count();
		expect(count).toBeGreaterThan(0);

		// Each card should show exercise counts
		await expect(sessionCards.first().getByTestId('session-exercises')).toBeVisible();
	});

	test('shows skipped exercises correctly in session detail', async ({ page }) => {
		await page.goto('/history');

		// Find a session that has skipped exercises
		const sessionWithSkipped = page.getByTestId('session-card').filter({ hasText: /skipped/ });
		await expect(sessionWithSkipped.first()).toBeVisible();
		await sessionWithSkipped.first().locator('a').click();
		await expect(page.getByTestId('session-detail')).toBeVisible();

		// Should show exercise log cards
		const exerciseCards = page.getByTestId('exercise-log-card');
		await expect(exerciseCards.first()).toBeVisible();

		// Should have at least one skipped badge
		await expect(page.getByText('Skipped').first()).toBeVisible();
	});

	test('views session detail with exercise logs and sets', async ({ page }) => {
		await page.goto('/history');

		// Find a session with non-zero completed exercises (has logged sets)
		const sessionWithSets = page
			.getByTestId('session-card')
			.filter({ hasText: /[1-9]\d*\/\d+ exercises/ });
		await sessionWithSets.first().locator('a').click();
		await expect(page.getByTestId('session-detail')).toBeVisible();

		// Session header should show the date (embedded in subtitle)
		await expect(page.getByText(/\d{1,2}\s\w+\s\d{4}/)).toBeVisible();

		// Should show exercise names
		await expect(page.getByTestId('exercise-log-name').first()).toBeVisible();

		// Should show set detail rows
		await expect(page.getByTestId('set-detail-row').first()).toBeVisible();

		// Navigate back to history
		await page.getByLabel('Back to history').click();
		await expect(page).toHaveURL('/history');
	});

	test('deletes an exercise log from session detail', async ({ page }) => {
		await page.goto('/history');

		// Navigate to first session detail
		await page.getByTestId('session-card').first().locator('a').click();
		await expect(page.getByTestId('session-detail')).toBeVisible();

		// Count exercise logs before deletion
		const exerciseCards = page.getByTestId('exercise-log-card');
		const countBefore = await exerciseCards.count();
		expect(countBefore).toBeGreaterThan(1);

		// Open dropdown on first exercise and click Delete
		await exerciseCards
			.first()
			.getByRole('button', { name: /Actions for/ })
			.click();
		await page.getByTestId('delete-exercise-log-btn').click();

		// Confirm deletion in the dialog
		const deleteExerciseDialog = page.getByLabel('Delete Exercise');
		await expect(deleteExerciseDialog).toBeVisible();
		await deleteExerciseDialog.getByRole('button', { name: 'Delete' }).click();

		// Wait for the exercise log to be removed (use auto-retrying assertion)
		await expect(exerciseCards).toHaveCount(countBefore - 1);
	});

	test('deletes a session from history list', async ({ page }) => {
		await page.goto('/history');

		// Count sessions before deletion
		const sessionCards = page.getByTestId('session-card');
		const countBefore = await sessionCards.count();
		expect(countBefore).toBeGreaterThan(0);

		// Open dropdown on last session card and click Delete
		await sessionCards.last().getByRole('button', { name: 'Actions for session' }).click();
		await page.getByRole('menuitem', { name: 'Delete' }).click();

		// Confirm deletion in the dialog
		const deleteWorkoutDialog = page.getByLabel('Delete Workout');
		await expect(deleteWorkoutDialog).toBeVisible();
		await deleteWorkoutDialog.getByRole('button', { name: 'Delete' }).click();

		// Wait for the session to be removed (use auto-retrying assertion)
		await expect(sessionCards).toHaveCount(countBefore - 1);
	});
});
