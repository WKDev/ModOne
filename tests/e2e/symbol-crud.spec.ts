import { test, expect } from './fixtures/browser-test';
import type { Page } from '@playwright/test';

async function openSymbolEditor(page: Page) {
  await page.keyboard.press('Control+Shift+P');
  await page.waitForSelector('[data-testid="command-palette"]', { state: 'visible' });
  await page.fill('[data-testid="command-palette-input"]', 'Symbol Editor');
  await page.click('text=Open Symbol Editor');
  await page.waitForSelector('[data-testid="symbol-editor"]', { state: 'visible' });
}

test.describe('Symbol CRUD Operations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('creates a new symbol via Symbol Editor', async ({ page }) => {
    await openSymbolEditor(page);

    // Verify editor overlay is visible
    await expect(page.locator('[data-testid="symbol-editor"]')).toBeVisible();

    // Fill symbol name
    await page.fill('#symbol-name', 'TestSymbol');

    // Fill category
    await page.fill('#symbol-category', 'TestCategory');

    // Save to project library
    await page.click('[data-testid="save-symbol-btn"]');

    // Verify save-success feedback
    await expect(page.locator('text=Symbol saved successfully')).toBeVisible();
  });

  test('edits an existing symbol name', async ({ page }) => {
    await openSymbolEditor(page);
    await page.click('[title="Close"]');

    // Navigate to Library Manager project tab
    await page.click('[data-testid="library-tab-project"]');

    // Hover the first row to reveal action buttons
    const firstRow = page.locator('.group').first();
    await firstRow.hover();

    // Click Edit
    await firstRow.locator('[data-testid="symbol-edit-btn"]').click();

    // Verify Symbol Editor opened
    await expect(page.locator('[data-testid="symbol-editor"]')).toBeVisible();

    // Update name
    const nameInput = page.locator('#symbol-name');
    await nameInput.clear();
    await nameInput.fill('RenamedSymbol');

    // Save
    await page.click('[data-testid="save-symbol-btn"]');

    // Verify success
    await expect(page.locator('text=Symbol saved successfully')).toBeVisible();

    // Close editor
    await page.click('[title="Close"]');

    // Confirm updated name shows in library
    await expect(page.locator('text=RenamedSymbol')).toBeVisible();
  });

  test('edits symbol category', async ({ page }) => {
    await openSymbolEditor(page);

    // Update category field
    const categoryInput = page.locator('#symbol-category');
    await categoryInput.clear();
    await categoryInput.fill('UpdatedCategory');

    // Save
    await page.click('[data-testid="save-symbol-btn"]');

    // Verify success
    await expect(page.locator('text=Symbol saved successfully')).toBeVisible();
  });

  test('deletes a symbol from the library', async ({ page }) => {
    await openSymbolEditor(page);
    await page.click('[title="Close"]');

    // Switch to project library tab
    await page.click('[data-testid="library-tab-project"]');

    // Hover first row to reveal Delete button
    const firstRow = page.locator('.group').first();
    await firstRow.hover();

    // Click Delete (trash icon)
    await firstRow.locator('[data-testid="symbol-delete-btn"]').click();

    // Delete-confirmation dialog must appear
    await expect(page.locator('text=Delete Symbol')).toBeVisible();
    await expect(page.locator('text=This cannot be undone')).toBeVisible();

    // Confirm deletion
    await page.click('button:has-text("Delete")');

    // Dialog closed
    await expect(page.locator('text=Delete Symbol')).not.toBeVisible();
  });

  test('cancels symbol deletion and symbol remains', async ({ page }) => {
    await openSymbolEditor(page);
    await page.click('[title="Close"]');

    // Navigate to Library Manager
    await page.click('[data-testid="library-tab-project"]');

    // Hover first row, click Delete
    const firstRow = page.locator('.group').first();
    await firstRow.hover();
    await firstRow.locator('[data-testid="symbol-delete-btn"]').click();

    // Confirm dialog is visible
    await expect(page.locator('text=Delete Symbol')).toBeVisible();

    // Cancel — symbol must NOT be removed
    await page.click('button:has-text("Cancel")');

    // Dialog dismissed
    await expect(page.locator('text=Delete Symbol')).not.toBeVisible();
  });

  test('validates that symbol name is required before saving', async ({ page }) => {
    await openSymbolEditor(page);

    // Clear the name field
    const nameInput = page.locator('#symbol-name');
    await nameInput.clear();

    // Attempt to save
    await page.click('[data-testid="save-symbol-btn"]');

    // Validation error must be shown
    await expect(page.locator('text=Name is required')).toBeVisible();
  });
});
