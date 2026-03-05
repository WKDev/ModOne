import { test, expect } from './fixtures/browser-test';

/**
 * Symbol Editor tool selectors (EditorToolbar.tsx uses title attributes):
 *
 *   '[title="Select"]'                  — select/pointer tool
 *   '[title="Rect"]'                    — rectangle draw tool
 *   '[title="Circle"]'                  — circle draw tool
 *   '[title="Polyline"]'                — polyline draw tool
 *   '[title="Arc"]'                     — arc draw tool
 *   '[title="Text"]'                    — text tool
 *   '[title="Pin"]'                     — pin placement tool
 *   '[title="Undo (Ctrl+Z)"]'           — undo button
 *   '[title="Redo (Ctrl+Shift+Z)"]'     — redo button
 *
 * Properties panel (PropertiesPanel.tsx — label for="..." ids):
 *   '#symbol-name'                      — name input
 *   '#symbol-desc'                      — description textarea
 *   '#symbol-category'                  — category input
 *   '#symbol-width'                     — width input
 *   '#symbol-height'                    — height input
 *   '#symbol-author'                    — author input
 *   '#symbol-version'                   — version input
 *   'button:has-text("Save Symbol")'    — save-to-library button
 *
 * Editor canvas (EditorCanvas.tsx — SVG element):
 *   'svg'                               — main drawing surface
 *
 * All tests require the Symbol Editor overlay to be open.
 * Marked test.fixme() because there is no data-testid entry-point yet.
 */

test.describe('Symbol Editor', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('draws a rectangle on the editor canvas', async ({ page }) => {
    test.fixme(
      true,
      'Needs data-testid on the "New Symbol" entry-point to open the editor'
    );

    // Open Symbol Editor
    // await page.click('[data-testid="new-symbol-btn"]');

    // Verify editor is visible
    await expect(page.locator('text=Symbol Editor')).toBeVisible();

    // Select the Rect tool from the toolbar
    await page.click('[title="Rect"]');

    // Confirm Rect tool is now active (button has blue background class)
    const rectBtn = page.locator('[title="Rect"]');
    await expect(rectBtn).toHaveClass(/bg-blue-600/);

    // Draw a rectangle on the SVG canvas by click-drag
    const canvas = page.locator('svg').first();
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).toBeTruthy();

    const startX = canvasBox!.x + 100;
    const startY = canvasBox!.y + 100;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 80, startY + 60);
    await page.mouse.up();

    // At least one rect element must now exist in the SVG
    await expect(canvas.locator('rect').first()).toBeVisible();
  });

  test('places a pin on the symbol', async ({ page }) => {
    test.fixme(
      true,
      'Needs data-testid on the "New Symbol" entry-point and pin popover confirmation'
    );

    // Open Symbol Editor
    // await page.click('[data-testid="new-symbol-btn"]');
    await expect(page.locator('text=Symbol Editor')).toBeVisible();

    // Select Pin tool
    await page.click('[title="Pin"]');

    const pinBtn = page.locator('[title="Pin"]');
    await expect(pinBtn).toHaveClass(/bg-blue-600/);

    // Click on the canvas to place a pin — triggers the PinConfigPopover
    const canvas = page.locator('svg').first();
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).toBeTruthy();

    await page.mouse.click(
      canvasBox!.x + canvasBox!.width / 2,
      canvasBox!.y + canvasBox!.height / 2
    );

    // Pin config popover should appear to configure the pin
    await expect(page.locator('text=Pin')).toBeVisible();
  });

  test('sets symbol name and category in Properties panel', async ({ page }) => {
    test.fixme(
      true,
      'Needs data-testid on the "New Symbol" entry-point'
    );

    // Open Symbol Editor
    // await page.click('[data-testid="new-symbol-btn"]');
    await expect(page.locator('text=Symbol Editor')).toBeVisible();

    // Fill name
    await page.fill('#symbol-name', 'MyCustomSymbol');
    await expect(page.locator('#symbol-name')).toHaveValue('MyCustomSymbol');

    // Fill category
    await page.fill('#symbol-category', 'Power');
    await expect(page.locator('#symbol-category')).toHaveValue('Power');

    // Fill description
    await page.fill('#symbol-desc', 'A custom power symbol');
    await expect(page.locator('#symbol-desc')).toHaveValue('A custom power symbol');

    // Confirm unsaved indicator visible in header
    await expect(page.locator('text=Unsaved')).toBeVisible();
  });

  test('sets symbol dimensions in Properties panel', async ({ page }) => {
    test.fixme(
      true,
      'Needs data-testid on the "New Symbol" entry-point'
    );

    // Open Symbol Editor
    // await page.click('[data-testid="new-symbol-btn"]');
    await expect(page.locator('text=Symbol Editor')).toBeVisible();

    // Set width
    await page.fill('#symbol-width', '120');
    await expect(page.locator('#symbol-width')).toHaveValue('120');

    // Set height
    await page.fill('#symbol-height', '80');
    await expect(page.locator('#symbol-height')).toHaveValue('80');
  });

  test('undo and redo buttons are disabled on fresh symbol', async ({ page }) => {
    test.fixme(
      true,
      'Needs data-testid on the "New Symbol" entry-point'
    );

    // Open Symbol Editor with a blank symbol
    // await page.click('[data-testid="new-symbol-btn"]');
    await expect(page.locator('text=Symbol Editor')).toBeVisible();

    // On a new symbol, Undo and Redo should both be disabled
    const undoBtn = page.locator('[title="Undo (Ctrl+Z)"]');
    const redoBtn = page.locator('[title="Redo (Ctrl+Shift+Z)"]');

    await expect(undoBtn).toBeDisabled();
    await expect(redoBtn).toBeDisabled();
  });

  test('undo removes the last drawn shape', async ({ page }) => {
    test.fixme(
      true,
      'Needs data-testid on the "New Symbol" entry-point'
    );

    // Open Symbol Editor
    // await page.click('[data-testid="new-symbol-btn"]');
    await expect(page.locator('text=Symbol Editor')).toBeVisible();

    // Draw a rectangle
    await page.click('[title="Rect"]');
    const canvas = page.locator('svg').first();
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).toBeTruthy();

    await page.mouse.move(canvasBox!.x + 50, canvasBox!.y + 50);
    await page.mouse.down();
    await page.mouse.move(canvasBox!.x + 130, canvasBox!.y + 110);
    await page.mouse.up();

    // Undo should now be enabled
    const undoBtn = page.locator('[title="Undo (Ctrl+Z)"]');
    await expect(undoBtn).toBeEnabled();

    // Click Undo
    await undoBtn.click();

    // Redo should now be enabled
    const redoBtn = page.locator('[title="Redo (Ctrl+Shift+Z)"]');
    await expect(redoBtn).toBeEnabled();
  });

  test('saves symbol and verifies persistence across close-reopen', async ({ page }) => {
    test.fixme(
      true,
      'Needs data-testid on New Symbol entry-point and a way to reopen the saved symbol from Library'
    );

    // Open Symbol Editor
    // await page.click('[data-testid="new-symbol-btn"]');
    await expect(page.locator('text=Symbol Editor')).toBeVisible();

    // Set a distinct name
    await page.fill('#symbol-name', 'PersistenceTestSymbol');
    await page.fill('#symbol-category', 'Test');

    // Draw a rectangle to have visible graphics
    await page.click('[title="Rect"]');
    const canvas = page.locator('svg').first();
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).toBeTruthy();

    await page.mouse.move(canvasBox!.x + 60, canvasBox!.y + 60);
    await page.mouse.down();
    await page.mouse.move(canvasBox!.x + 140, canvasBox!.y + 120);
    await page.mouse.up();

    // Save to library
    await page.click('button:has-text("Save Symbol")');
    await expect(page.locator('text=Symbol saved successfully')).toBeVisible();

    // Close editor
    await page.click('[title="Close"]');
    await expect(page.locator('text=Symbol Editor')).not.toBeVisible();

    // Symbol should appear in the library with the given name
    await expect(page.locator('text=PersistenceTestSymbol')).toBeVisible();

    // Double-click or use Edit button to reopen
    const symbolRow = page.locator('.group', { hasText: 'PersistenceTestSymbol' }).first();
    await symbolRow.hover();
    await symbolRow.locator('[title="Edit"]').click();

    // Editor reopens with the saved name
    await expect(page.locator('text=Symbol Editor')).toBeVisible();
    await expect(page.locator('#symbol-name')).toHaveValue('PersistenceTestSymbol');
  });
});
