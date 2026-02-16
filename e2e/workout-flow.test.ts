import { expect, test } from '@playwright/test';

test.describe.serial('Workout Flow', () => {
	test('sets up a program for workout testing', async ({ page }) => {
		await page.goto('/programs/new');

		await page.getByPlaceholder('e.g., Push Pull Legs').fill('Workout Test Program');
		await page.getByRole('button', { name: 'Add Day' }).click();
		await page.getByPlaceholder('Day name (e.g., Push Day)').fill('Push Day');

		await page.getByRole('button', { name: 'Add Exercise' }).click();
		await page.getByPlaceholder('Exercise name').first().fill('Bench Press');

		await page.getByRole('button', { name: 'Add Exercise' }).click();
		await page.getByPlaceholder('Exercise name').nth(1).fill('Overhead Press');

		await page.getByRole('button', { name: 'Add Exercise' }).click();
		await page.getByPlaceholder('Exercise name').nth(2).fill('Tricep Dips');

		await page.getByRole('button', { name: 'Create Program' }).click();
		await expect(page).toHaveURL('/programs');

		// Set it as active
		const card = page
			.locator('[data-testid="program-card"]')
			.filter({ hasText: 'Workout Test Program' });
		await card.getByRole('button', { name: 'Actions' }).click();
		await page.getByRole('menuitem', { name: 'Set Active' }).click();
		await expect(card.getByText('Active')).toBeVisible();
	});

	test('shows active program and workout days on home screen', async ({ page }) => {
		await page.goto('/');

		await expect(page.getByTestId('active-program-name')).toContainText('Workout Test Program');
		await expect(page.getByTestId('workout-day-buttons')).toBeVisible();
		await expect(page.getByText('Push Day')).toBeVisible();
		await expect(page.getByText('3 exercises')).toBeVisible();
	});

	test('full workout flow: wizard navigation, log, skip, add adhoc, finish, summary', async ({
		page
	}) => {
		await page.goto('/');

		// Start workout
		await page.getByRole('button', { name: 'Push Day' }).click();
		await expect(page.getByTestId('workout-title')).toContainText('Push Day');
		await expect(page.getByText('Workout Test Program')).toBeVisible();

		// Should see the wizard with first exercise (Bench Press)
		await expect(page.getByTestId('exercise-step')).toBeVisible();
		await expect(page.getByTestId('exercise-step-name')).toContainText('Bench Press');

		// Should see progress bar with 3 circles
		await expect(page.getByTestId('wizard-progress-bar')).toBeVisible();
		await expect(page.getByTestId('progress-circle-0')).toBeVisible();
		await expect(page.getByTestId('progress-circle-1')).toBeVisible();
		await expect(page.getByTestId('progress-circle-2')).toBeVisible();

		// Should see Skip button (no reps filled yet)
		await expect(page.getByTestId('wizard-next-btn')).toContainText('Skip');

		// Log sets for Bench Press
		await page.getByTestId('weight-input-0').fill('80');
		await page.getByTestId('reps-input-0').fill('8');
		// Trigger change events
		await page.getByTestId('reps-input-0').blur();

		// Button should now show "Next" since reps are filled
		await expect(page.getByTestId('wizard-next-btn')).toContainText('Next');

		// Click Next to save and advance
		await page.getByTestId('wizard-next-btn').click();

		// Should now be on exercise 2 (Overhead Press)
		await expect(page.getByTestId('exercise-step-name')).toContainText('Overhead Press');

		// Should have Previous button
		await expect(page.getByTestId('wizard-previous-btn')).toBeVisible();

		// Log sets for OHP
		await page.getByTestId('weight-input-0').fill('40');
		await page.getByTestId('reps-input-0').fill('10');
		await page.getByTestId('reps-input-0').blur();

		// Click Next to save and advance to Tricep Dips
		await page.getByTestId('wizard-next-btn').click();

		// Should now be on exercise 3 (Tricep Dips) -- last exercise
		await expect(page.getByTestId('exercise-step-name')).toContainText('Tricep Dips');

		// Last exercise shows Previous, Add Exercise, and Finish buttons
		await expect(page.getByTestId('wizard-previous-btn')).toBeVisible();
		await expect(page.getByTestId('wizard-add-exercise-btn')).toBeVisible();
		await expect(page.getByTestId('wizard-finish-btn')).toBeVisible();

		// Add an ad-hoc exercise
		await page.getByTestId('wizard-add-exercise-btn').click();
		await expect(page.getByRole('heading', { name: 'Add Exercise' })).toBeVisible();
		await page.getByTestId('adhoc-exercise-input').fill('Lateral Raise');
		await page.getByTestId('adhoc-submit-btn').click();

		// Wait for the dialog to close and progress bar to update
		await expect(page.getByTestId('progress-circle-3')).toBeVisible();

		// Tricep Dips is no longer the last exercise -- should show Next/Skip now
		await expect(page.getByTestId('wizard-next-btn')).toBeVisible();

		// Skip Tricep Dips (no reps filled)
		await page.getByTestId('wizard-next-btn').click();

		// Should be on Lateral Raise (exercise 4, the last exercise)
		await expect(page.getByTestId('exercise-step-name')).toContainText('Lateral Raise');
		await expect(page.getByText('Ad-hoc')).toBeVisible();

		// Test jumping via progress bar -- jump back to Bench Press
		await page.getByTestId('progress-circle-0').click();
		await expect(page.getByTestId('exercise-step-name')).toContainText('Bench Press');

		// Verify data persists after reload
		await page.reload();
		await expect(page.getByTestId('exercise-step-name')).toContainText('Bench Press');
		await expect(page.getByTestId('weight-input-0')).toHaveValue('80');
		await expect(page.getByTestId('reps-input-0')).toHaveValue('8');

		// Navigate to last exercise to finish
		const progressCircles = await page.getByTestId('wizard-progress-bar').locator('button').count();
		await page.getByTestId(`progress-circle-${progressCircles - 1}`).click();
		await expect(page.getByTestId('wizard-finish-btn')).toBeVisible();

		// Finish workout
		await page.getByTestId('wizard-finish-btn').click();
		await expect(page.getByText('Finish Workout?')).toBeVisible();
		await page.getByTestId('confirm-stop-btn').click();

		// Verify summary
		await expect(page.getByTestId('workout-summary')).toBeVisible();
		await expect(page.getByText('Workout Complete')).toBeVisible();
		await expect(page.getByTestId('stat-exercises')).toBeVisible();

		// 2/3 completed (Bench Press + OHP completed, Tricep Dips was skipped)
		await expect(page.getByTestId('stat-exercises')).toContainText('2/3');
		await expect(page.getByTestId('skipped-count')).toContainText('1 exercise skipped');

		// PRs should be detected (first workout ever for these exercises)
		await expect(page.getByTestId('pr-list')).toBeVisible();
		await expect(page.getByTestId('pr-item')).toHaveCount(2);

		// Done button returns to home
		await page.getByTestId('done-btn').click();
		await expect(page).toHaveURL('/');
	});

	test('blocks starting a second workout and shows resume banner', async ({ page }) => {
		await page.goto('/');

		// Start a new workout
		await page.getByRole('button', { name: 'Push Day' }).click();
		await expect(page.getByTestId('workout-title')).toBeVisible();

		// Navigate to home
		await page.goto('/');

		// Should see the in-progress notice
		await expect(page.getByTestId('workout-in-progress-notice')).toBeVisible();

		// Day buttons should be disabled
		await expect(page.getByRole('button', { name: 'Push Day' })).toBeDisabled();

		// Navigate to programs page -- resume banner should appear
		await page.goto('/programs');
		await expect(page.getByTestId('resume-workout-banner')).toBeVisible();
		await expect(page.getByText('Workout in progress: Push Day')).toBeVisible();

		// Click Resume to go back to workout
		await page.getByRole('link', { name: 'Resume' }).click();
		await expect(page.getByTestId('workout-title')).toContainText('Push Day');

		// Finish this workout via wizard
		// Navigate to last exercise
		const circleCount = await page.getByTestId('wizard-progress-bar').locator('button').count();
		await page.getByTestId(`progress-circle-${circleCount - 1}`).click();
		await page.getByTestId('wizard-finish-btn').click();
		await expect(page.getByText('Finish Workout?')).toBeVisible();
		await page.getByTestId('confirm-stop-btn').click();

		// No exercises were logged, so the workout is cancelled and redirects to home
		await expect(page).toHaveURL('/?cancelled=1');
	});

	test('shows congratulatory message when all exercises are completed', async ({ page }) => {
		await page.goto('/');

		// Start a new workout
		await page.getByRole('button', { name: 'Push Day' }).click();
		await expect(page.getByTestId('workout-title')).toBeVisible();

		// Log at least one set for every planned exercise using wizard navigation
		const circleCount = await page.getByTestId('wizard-progress-bar').locator('button').count();

		for (let i = 0; i < circleCount; i++) {
			if (i > 0) {
				// We should already be on the next exercise after clicking Next
			}

			await page.getByTestId('weight-input-0').fill(String(50 + i * 10));
			await page.getByTestId('reps-input-0').fill('10');
			await page.getByTestId('reps-input-0').blur();

			if (i < circleCount - 1) {
				// Click Next for non-last exercises
				await page.getByTestId('wizard-next-btn').click();
			}
		}

		// Finish workout from the last exercise
		await page.getByTestId('wizard-finish-btn').click();
		await page.getByTestId('confirm-stop-btn').click();

		// Should see congratulatory message (3/3 exercises completed)
		await expect(page.getByTestId('congrats-message')).toBeVisible();
		await expect(page.getByText('All exercises completed. Great work.')).toBeVisible();
	});

	test('shows last workout info on home screen', async ({ page }) => {
		await page.goto('/');

		await expect(page.getByTestId('last-workout-info')).toBeVisible();
		await expect(page.getByText('Last workout: Push Day')).toBeVisible();
	});
});
