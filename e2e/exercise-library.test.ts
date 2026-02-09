import { expect, test } from '@playwright/test';

test.describe.serial('Exercise Library', () => {
	test('shows exercises created from programs', async ({ page }) => {
		await page.goto('/exercises');

		const exerciseItems = page.locator('[data-testid="exercise-item"]');
		await expect(exerciseItems).toHaveCount(3);

		await expect(
			page.getByTestId('exercise-name').filter({ hasText: 'Bench Press' })
		).toBeVisible();
		await expect(
			page.getByTestId('exercise-name').filter({ hasText: 'Overhead Press' })
		).toBeVisible();
		await expect(
			page.getByTestId('exercise-name').filter({ hasText: 'Barbell Row' })
		).toBeVisible();
	});

	test('shows exercise stats', async ({ page }) => {
		await page.goto('/exercises');

		const exerciseItems = page.locator('[data-testid="exercise-item"]');
		const count = await exerciseItems.count();

		for (let i = 0; i < count; i++) {
			const item = exerciseItems.nth(i);
			await expect(item.getByTestId('exercise-max-weight')).toContainText('Max: No history');
			await expect(item.getByTestId('exercise-last-performed')).toContainText(
				'Last performed: Never'
			);
		}
	});

	test('renames an exercise', async ({ page }) => {
		await page.goto('/exercises');

		// Open the actions menu for Bench Press
		await page.getByRole('button', { name: 'Actions for Bench Press' }).click();
		await page.getByRole('menuitem', { name: 'Rename' }).click();

		// Rename dialog should appear
		await expect(page.getByRole('heading', { name: 'Rename Exercise' })).toBeVisible();

		// Clear and type new name
		const nameInput = page.getByLabel('Exercise Name');
		await nameInput.clear();
		await nameInput.fill('Flat Bench Press');

		// Save
		await page.getByRole('button', { name: 'Save' }).click();

		// Verify rename
		await expect(
			page.getByTestId('exercise-name').filter({ hasText: 'Flat Bench Press' })
		).toBeVisible();
		await expect(
			page.getByTestId('exercise-name').filter({ hasText: /^Bench Press$/ })
		).not.toBeVisible();
	});

	test('deletes an exercise without history', async ({ page }) => {
		await page.goto('/exercises');

		const exerciseItems = page.locator('[data-testid="exercise-item"]');
		const countBefore = await exerciseItems.count();

		// Open the actions menu for Flat Bench Press and delete
		await page.getByRole('button', { name: 'Actions for Flat Bench Press' }).click();
		await page.getByRole('menuitem', { name: 'Delete' }).click();

		// Delete dialog should appear — no workout history so should not mention it
		const dialogDescription = page.locator('[role="alertdialog"]');
		await expect(dialogDescription).toBeVisible();
		await expect(dialogDescription).toContainText('Are you sure you want to delete');
		await expect(dialogDescription).not.toContainText('workout history');

		// Confirm delete
		await page.getByRole('button', { name: 'Delete' }).click();

		// Verify count decreased
		await expect(exerciseItems).toHaveCount(countBefore - 1);

		// Verify Flat Bench Press is gone
		await expect(
			page.getByTestId('exercise-name').filter({ hasText: 'Flat Bench Press' })
		).not.toBeVisible();
	});

	test('shows empty state when all exercises are deleted', async ({ page }) => {
		await page.goto('/exercises');

		// Delete Overhead Press
		await page.getByRole('button', { name: 'Actions for Overhead Press' }).click();
		await page.getByRole('menuitem', { name: 'Delete' }).click();
		await page.getByRole('button', { name: 'Delete' }).click();

		// Wait for Overhead Press to be removed
		await expect(
			page.getByTestId('exercise-name').filter({ hasText: 'Overhead Press' })
		).not.toBeVisible();

		// Reload to clear dialog state, then delete the remaining exercise
		await page.goto('/exercises');

		// Delete Barbell Row
		await page.getByRole('button', { name: 'Actions for Barbell Row' }).click();
		await page.getByRole('menuitem', { name: 'Delete' }).click();
		await page.getByRole('button', { name: 'Delete' }).click();

		// Verify empty state
		await expect(page.getByTestId('empty-state')).toBeVisible();
		await expect(page.getByText('No exercises yet')).toBeVisible();
	});
});
