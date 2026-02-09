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

	test('full workout flow: start, log, skip, add adhoc, stop, summary', async ({ page }) => {
		await page.goto('/');

		// Start workout
		await page.getByRole('button', { name: 'Push Day' }).click();
		await expect(page.getByTestId('workout-title')).toContainText('Push Day');
		await expect(page.getByText('Workout Test Program')).toBeVisible();

		// Should see exercise navigator
		await expect(page.getByTestId('exercise-navigator')).toBeVisible();

		// Should see all exercise cards (use heading selectors to avoid navigator duplicates)
		const exerciseHeadings = page.locator('h3[data-testid^="exercise-name-"]');
		await expect(exerciseHeadings).toHaveCount(3);
		await expect(exerciseHeadings.filter({ hasText: 'Bench Press' })).toBeVisible();
		await expect(exerciseHeadings.filter({ hasText: 'Overhead Press' })).toBeVisible();
		await expect(exerciseHeadings.filter({ hasText: 'Tricep Dips' })).toBeVisible();

		// Log sets for Bench Press (first exercise)
		const exerciseCards = page.locator('[id^="exercise-log-"]');
		const benchCard = exerciseCards.first();
		const benchWeights = benchCard.locator('input[name="weight"]');
		const benchReps = benchCard.locator('input[name="reps"]');

		await benchWeights.first().fill('80');
		await benchWeights
			.first()
			.evaluate((el: HTMLInputElement) => el.dispatchEvent(new Event('change', { bubbles: true })));
		await benchReps.first().fill('8');
		await benchReps
			.first()
			.evaluate((el: HTMLInputElement) => el.dispatchEvent(new Event('change', { bubbles: true })));

		// Log sets for Overhead Press (second exercise)
		const ohpCard = exerciseCards.nth(1);
		const ohpWeights = ohpCard.locator('input[name="weight"]');
		const ohpReps = ohpCard.locator('input[name="reps"]');

		await ohpWeights.first().fill('40');
		await ohpWeights
			.first()
			.evaluate((el: HTMLInputElement) => el.dispatchEvent(new Event('change', { bubbles: true })));
		await ohpReps.first().fill('10');
		await ohpReps
			.first()
			.evaluate((el: HTMLInputElement) => el.dispatchEvent(new Event('change', { bubbles: true })));

		// Skip Tricep Dips (third exercise)
		const tricepCard = exerciseCards.nth(2);
		await tricepCard.getByRole('button', { name: 'Skip' }).click();
		await expect(tricepCard.getByRole('button', { name: 'Unskip' })).toBeVisible();

		// Unskip Tricep Dips
		await tricepCard.getByRole('button', { name: 'Unskip' }).click();
		await expect(tricepCard.getByRole('button', { name: 'Skip' })).toBeVisible();

		// Skip it again (leave it skipped for stop)
		await tricepCard.getByRole('button', { name: 'Skip' }).click();

		// Add an ad-hoc exercise
		await page.getByTestId('add-adhoc-btn').click();
		await expect(page.getByRole('heading', { name: 'Add Exercise' })).toBeVisible();
		await page.getByTestId('adhoc-exercise-input').fill('Lateral Raise');
		await page.getByTestId('adhoc-submit-btn').click();

		// Verify ad-hoc exercise appears (check via heading to avoid navigator duplicate)
		await expect(exerciseHeadings.filter({ hasText: 'Lateral Raise' })).toBeVisible();
		await expect(page.getByText('Ad-hoc')).toBeVisible();

		// Verify data persists after reload
		await page.reload();
		await expect(benchCard.locator('input[name="weight"]').first()).toHaveValue('80');
		await expect(benchCard.locator('input[name="reps"]').first()).toHaveValue('8');

		// Stop workout
		await page.getByTestId('stop-workout-btn').click();
		await expect(page.getByText('Stop Workout?')).toBeVisible();
		await page.getByTestId('confirm-stop-btn').click();

		// Verify summary
		await expect(page.getByTestId('workout-summary')).toBeVisible();
		await expect(page.getByText('Workout Complete')).toBeVisible();
		await expect(page.getByTestId('exercise-count')).toBeVisible();

		// 2/3 completed (Bench Press + OHP, Tricep Dips was skipped)
		await expect(page.getByTestId('exercise-count')).toContainText('2/3');
		await expect(page.getByText('1 skipped')).toBeVisible();

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

		// Navigate to programs page — resume banner should appear
		await page.goto('/programs');
		await expect(page.getByTestId('resume-workout-banner')).toBeVisible();
		await expect(page.getByText('Workout in progress: Push Day')).toBeVisible();

		// Click Resume to go back to workout
		await page.getByRole('link', { name: 'Resume' }).click();
		await expect(page.getByTestId('workout-title')).toContainText('Push Day');

		// Stop this workout for cleanup
		await page.getByTestId('stop-workout-btn').click();
		await page.getByTestId('confirm-stop-btn').click();
		await expect(page.getByTestId('workout-summary')).toBeVisible();
	});

	test('shows congratulatory message when all exercises are completed', async ({ page }) => {
		await page.goto('/');

		// Start a new workout
		await page.getByRole('button', { name: 'Push Day' }).click();
		await expect(page.getByTestId('workout-title')).toBeVisible();

		// Log at least one set for every planned exercise
		const exerciseCards = page.locator('[id^="exercise-log-"]');
		const count = await exerciseCards.count();

		for (let i = 0; i < count; i++) {
			const card = exerciseCards.nth(i);
			const weightInput = card.locator('input[name="weight"]').first();
			const repsInput = card.locator('input[name="reps"]').first();

			await weightInput.fill(String(50 + i * 10));
			await weightInput.evaluate((el: HTMLInputElement) =>
				el.dispatchEvent(new Event('change', { bubbles: true }))
			);
			await repsInput.fill('10');
			await repsInput.evaluate((el: HTMLInputElement) =>
				el.dispatchEvent(new Event('change', { bubbles: true }))
			);
		}

		// Stop workout
		await page.getByTestId('stop-workout-btn').click();
		await page.getByTestId('confirm-stop-btn').click();

		// Should see congratulatory message (3/3 exercises completed)
		await expect(page.getByTestId('congrats-message')).toBeVisible();
		await expect(page.getByText('All exercises completed')).toBeVisible();
	});

	test('shows last workout info on home screen', async ({ page }) => {
		await page.goto('/');

		await expect(page.getByTestId('last-workout-info')).toBeVisible();
		await expect(page.getByText('Last workout: Push Day')).toBeVisible();
	});
});
