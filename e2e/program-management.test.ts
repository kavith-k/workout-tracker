import { expect, test } from '@playwright/test';

test.describe.serial('Program Management', () => {
	test('shows empty state when no programs exist', async ({ page }) => {
		await page.goto('/programs');
		await expect(page.getByText('No programs yet')).toBeVisible();
		await expect(page.getByRole('link', { name: 'Create Program' })).toBeVisible();
	});

	test('creates a program with days and exercises', async ({ page }) => {
		await page.goto('/programs');

		// Navigate to create page
		await page.getByRole('link', { name: 'Create Program' }).click();
		await expect(page.getByRole('heading', { name: 'New Program' })).toBeVisible();

		// Fill in program name
		await page.getByPlaceholder('e.g., Push Pull Legs').fill('Upper Lower Split');

		// Add first day
		await page.getByRole('button', { name: 'Add Day' }).click();
		await page.getByPlaceholder('Day name (e.g., Push Day)').fill('Upper Day');

		// Add exercise to first day
		await page.getByRole('button', { name: 'Add Exercise' }).click();
		await page.getByPlaceholder('Exercise name').fill('Bench Press');

		// Submit
		await page.getByRole('button', { name: 'Create Program' }).click();

		// Should redirect to programs list
		await expect(page).toHaveURL('/programs');
		await expect(page.getByText('Upper Lower Split')).toBeVisible();
	});

	test('creates a program with multiple days and exercises', async ({ page }) => {
		await page.goto('/programs/new');

		// Fill in program name
		await page.getByPlaceholder('e.g., Push Pull Legs').fill('PPL');

		// Add first day
		await page.getByRole('button', { name: 'Add Day' }).click();
		const dayInputs = page.getByPlaceholder('Day name (e.g., Push Day)');
		await dayInputs.first().fill('Push');

		// Add exercise to first day
		const addExerciseButtons = page.getByRole('button', { name: 'Add Exercise' });
		await addExerciseButtons.first().click();
		await page.getByPlaceholder('Exercise name').first().fill('Overhead Press');

		// Add second day
		await page.getByRole('button', { name: 'Add Day' }).click();
		await dayInputs.nth(1).fill('Pull');

		// Add exercise to second day
		await addExerciseButtons.nth(1).click();
		const exerciseInputs = page.getByPlaceholder('Exercise name');
		await exerciseInputs.nth(1).fill('Barbell Row');

		// Submit
		await page.getByRole('button', { name: 'Create Program' }).click();

		// Should redirect to programs list
		await expect(page).toHaveURL('/programs');
		await expect(page.getByText('PPL')).toBeVisible();
	});

	test('activates a program', async ({ page }) => {
		await page.goto('/programs');

		// Find the first program and set it as active
		const firstCard = page.locator('[data-testid="program-card"]').first();
		await firstCard.getByRole('button', { name: 'Actions' }).click();
		await page.getByRole('menuitem', { name: 'Set Active' }).click();

		// Should show Active badge
		await expect(page.getByText('Active')).toBeVisible();
	});

	test('switches active program', async ({ page }) => {
		await page.goto('/programs');

		// Find the non-active program (Upper Lower Split) and set it active
		const cards = page.locator('[data-testid="program-card"]');
		const upperLowerCard = cards.filter({ hasText: 'Upper Lower Split' });
		await upperLowerCard.getByRole('button', { name: 'Actions' }).click();
		await page.getByRole('menuitem', { name: 'Set Active' }).click();

		// Upper Lower Split should be active now
		await expect(upperLowerCard.getByText('Active')).toBeVisible();

		// There should only be one Active badge
		await expect(page.getByText('Active')).toHaveCount(1);
	});

	test('duplicates a program', async ({ page }) => {
		await page.goto('/programs');

		// Open dropdown for PPL and click Duplicate
		const pplCard = page.locator('[data-testid="program-card"]').filter({ hasText: 'PPL' });
		await pplCard.getByRole('button', { name: 'Actions' }).click();
		await page.getByRole('menuitem', { name: 'Duplicate' }).click();

		// Duplicate dialog should appear
		await expect(page.getByRole('heading', { name: 'Duplicate Program' })).toBeVisible();

		// Change the name and submit
		const nameInput = page.getByLabel('Program Name');
		await nameInput.clear();
		await nameInput.fill('PPL v2');
		await page.getByRole('button', { name: 'Duplicate' }).click();

		// Both programs should be visible
		await expect(page.getByText('PPL v2')).toBeVisible();
		await expect(page.getByText('PPL').first()).toBeVisible();
	});

	test('edits an existing program', async ({ page }) => {
		await page.goto('/programs');

		// Open dropdown for the first program and click Edit
		const firstCard = page.locator('[data-testid="program-card"]').first();
		await firstCard.getByRole('button', { name: 'Actions' }).click();
		await page.getByRole('menuitem', { name: 'Edit' }).click();

		// Should be on edit page
		await expect(page.getByRole('heading', { name: 'Edit Program' })).toBeVisible();

		// Change the program name
		const nameInput = page.getByPlaceholder('e.g., Push Pull Legs');
		await nameInput.clear();
		await nameInput.fill('Updated Split');

		// Save
		await page.getByRole('button', { name: 'Save Changes' }).click();

		// Should redirect to programs list with updated name
		await expect(page).toHaveURL('/programs');
		await expect(page.getByText('Updated Split')).toBeVisible();
	});

	test('deletes a program', async ({ page }) => {
		await page.goto('/programs');

		// Count programs before delete
		const cardsBefore = await page.locator('[data-testid="program-card"]').count();

		// Delete the first program (Updated Split)
		const firstCard = page.locator('[data-testid="program-card"]').first();
		const programName = await firstCard.locator('span.font-medium').textContent();
		await firstCard.getByRole('button', { name: 'Actions' }).click();
		await page.getByRole('menuitem', { name: 'Delete' }).click();

		// Delete confirmation dialog should appear
		const deleteDialog = page.locator('[role="alertdialog"]');
		await expect(deleteDialog).toBeVisible();
		await expect(deleteDialog).toContainText('cannot be undone');

		// Confirm delete
		await deleteDialog.getByRole('button', { name: 'Delete' }).click();

		// Program count should decrease
		await expect(page.locator('[data-testid="program-card"]')).toHaveCount(cardsBefore - 1);

		// The deleted program name should not be visible
		if (programName) {
			await expect(page.getByText(programName, { exact: true })).not.toBeVisible();
		}
	});
});
