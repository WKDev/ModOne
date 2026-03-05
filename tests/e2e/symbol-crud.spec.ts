import { test, expect } from './fixtures/browser-test';

/**
 * Symbol-specific selectors (components use title/label/id — no data-testid):
 *
 * Symbol Editor:
 *   'text=Symbol Editor'                    — editor overlay header
 *   '#symbol-name'                          — name input (PropertiesPanel)
 *   '#symbol-category'                      — category input
 *   '#symbol-version'                       — version input
 *   'button:has-text("Save Symbol")'        — save to library (PropertiesPanel)
 *   '[title="Save"]'                        — quick-save in editor header
 *   '[title="Close"]'                       — close editor
 *
 * LibraryManager:
 *   'button:has-text("project Library")'    — project library tab
 *   'button:has-text("global Library")'     — global library tab
 *   '[title="Edit"]'                        — edit button (hover-revealed per row)
 *   '[title="Delete"]'                      — delete button (hover-revealed per row)
 *   'button:has-text("Delete")'             — confirm delete in dialog
 *   'button:has-text("Cancel")'             — cancel delete in dialog
 *   'text=Symbol saved successfully'        — save-success feedback in PropertiesPanel
 *
 * Entry-point to Symbol Editor and LibraryManager are not yet exposed via
 * data-testid. Tests that depend on navigation are marked test.fixme().
 */

test.describe('Symbol CRUD Operations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('creates a new symbol via Symbol Editor', async ({ page }) => {
    test.fixme(
      true,
      'Needs data-testid on the "New Symbol" entry-point button/menu item'
    );

    // Open Symbol Editor (replace with real selector once exposed)
    // await page.click('[data-testid="new-symbol-btn"]');

    // Verify editor overlay is visible
    await expect(page.locator('text=Symbol Editor')).toBeVisible();

    // Fill symbol name
    await page.fill('#symbol-name', 'TestSymbol');

    // Fill category
    await page.fill('#symbol-category', 'TestCategory');

    // Save to project library
    await page.click('button:has-text("Save Symbol")');

    // Verify save-success feedback
    await expect(page.locator('text=Symbol saved successfully')).toBeVisible();
  });

  test('edits an existing symbol name', async ({ page }) => {
    test.fixme(
      true,
      'Requires Library Manager visible and at least one symbol to exist'
    );

    // Navigate to Library Manager project tab
    await page.click('button:has-text("project Library")');

    // Hover the first row to reveal action buttons
    const firstRow = page.locator('.group').first();
    await firstRow.hover();

    // Click Edit
    await firstRow.locator('[title="Edit"]').click();

    // Verify Symbol Editor opened
    await expect(page.locator('text=Symbol Editor')).toBeVisible();

    // Update name
    const nameInput = page.locator('#symbol-name');
    await nameInput.clear();
    await nameInput.fill('RenamedSymbol');

    // Save
    await page.click('button:has-text("Save Symbol")');

    // Verify success
    await expect(page.locator('text=Symbol saved successfully')).toBeVisible();

    // Close editor
    await page.click('[title="Close"]');

    // Confirm updated name shows in library
    await expect(page.locator('text=RenamedSymbol')).toBeVisible();
  });

  test('edits symbol category', async ({ page }) => {
    test.fixme(
      true,
      'Requires Symbol Editor to be open with an existing symbol'
    );

    // Update category field
    const categoryInput = page.locator('#symbol-category');
    await categoryInput.clear();
    await categoryInput.fill('UpdatedCategory');

    // Save
    await page.click('button:has-text("Save Symbol")');

    // Verify success
    await expect(page.locator('text=Symbol saved successfully')).toBeVisible();
  });

  test('deletes a symbol from the library', async ({ page }) => {
    test.fixme(
      true,
      'Requires Library Manager to be visible with at least one symbol'
    );

    // Switch to project library tab
    await page.click('button:has-text("project Library")');

    // Hover first row to reveal Delete button
    const firstRow = page.locator('.group').first();
    await firstRow.hover();

    // Click Delete (trash icon)
    await firstRow.locator('[title="Delete"]').click();

    // Delete-confirmation dialog must appear
    await expect(page.locator('text=Delete Symbol')).toBeVisible();
    await expect(page.locator('text=This cannot be undone')).toBeVisible();

    // Confirm deletion
    await page.click('button:has-text("Delete")');

    // Dialog closed
    await expect(page.locator('text=Delete Symbol')).not.toBeVisible();
  });

  test('cancels symbol deletion and symbol remains', async ({ page }) => {
    test.fixme(
      true,
      'Requires Library Manager to be visible with at least one symbol'
    );

    // Navigate to Library Manager
    await page.click('button:has-text("project Library")');

    // Hover first row, click Delete
    const firstRow = page.locator('.group').first();
    await firstRow.hover();
    await firstRow.locator('[title="Delete"]').click();

    // Confirm dialog is visible
    await expect(page.locator('text=Delete Symbol')).toBeVisible();

    // Cancel — symbol must NOT be removed
    await page.click('button:has-text("Cancel")');

    // Dialog dismissed
    await expect(page.locator('text=Delete Symbol')).not.toBeVisible();
  });

  test('validates that symbol name is required before saving', async ({ page }) => {
    test.fixme(
      true,
      'Requires Symbol Editor to be open with an empty name'
    );

    // Clear the name field
    const nameInput = page.locator('#symbol-name');
    await nameInput.clear();

    // Attempt to save
    await page.click('button:has-text("Save Symbol")');

    // Validation error must be shown
    await expect(page.locator('text=Name is required')).toBeVisible();
  });
});
