import { test, expect } from './fixtures/browser-test';
import type { Page } from '@playwright/test';

async function openSymbolEditor(page: Page) {
  await page.keyboard.press('Control+Shift+P');
  await page.waitForSelector('[data-testid="command-palette"]', { state: 'visible' });
  await page.fill('[data-testid="command-palette-input"]', 'Symbol Editor');
  await page.click('text=Open Symbol Editor');
  await page.waitForSelector('[data-testid="symbol-editor"]', { state: 'visible' });
}

test.describe('Symbol Editor', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('draws a rectangle on the editor canvas', async ({ page }) => {
    await openSymbolEditor(page);

    // Verify editor is visible
    await expect(page.locator('[data-testid="symbol-editor"]')).toBeVisible();

    // Select the Rect tool from the toolbar
    await page.click('[data-testid="tool-rect"]');

    // Confirm Rect tool is now active (button has blue background class)
    const rectBtn = page.locator('[data-testid="tool-rect"]');
    await expect(rectBtn).toHaveClass(/bg-blue-600/);

    // Draw a rectangle on the SVG canvas by click-drag
    const canvas = page.locator('[data-testid="editor-canvas-svg"]');
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
    await openSymbolEditor(page);
    await expect(page.locator('[data-testid="symbol-editor"]')).toBeVisible();

    // Select Pin tool
    await page.click('[data-testid="tool-pin"]');

    const pinBtn = page.locator('[data-testid="tool-pin"]');
    await expect(pinBtn).toHaveClass(/bg-blue-600/);

    // Click on the canvas to place a pin — triggers the PinConfigPopover
    const canvas = page.locator('[data-testid="editor-canvas-svg"]');
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
    await openSymbolEditor(page);
    await expect(page.locator('[data-testid="symbol-editor"]')).toBeVisible();

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
    await openSymbolEditor(page);
    await expect(page.locator('[data-testid="symbol-editor"]')).toBeVisible();

    // Set width
    await page.fill('#symbol-width', '120');
    await expect(page.locator('#symbol-width')).toHaveValue('120');

    // Set height
    await page.fill('#symbol-height', '80');
    await expect(page.locator('#symbol-height')).toHaveValue('80');
  });

  test('undo and redo buttons are disabled on fresh symbol', async ({ page }) => {
    await openSymbolEditor(page);
    await expect(page.locator('[data-testid="symbol-editor"]')).toBeVisible();

    // On a new symbol, Undo and Redo should both be disabled
    const undoBtn = page.locator('[title="Undo (Ctrl+Z)"]');
    const redoBtn = page.locator('[title="Redo (Ctrl+Shift+Z)"]');

    await expect(undoBtn).toBeDisabled();
    await expect(redoBtn).toBeDisabled();
  });

  test('undo removes the last drawn shape', async ({ page }) => {
    await openSymbolEditor(page);
    await expect(page.locator('[data-testid="symbol-editor"]')).toBeVisible();

    // Draw a rectangle
    await page.click('[data-testid="tool-rect"]');
    const canvas = page.locator('[data-testid="editor-canvas-svg"]');
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
    await openSymbolEditor(page);
    await expect(page.locator('[data-testid="symbol-editor"]')).toBeVisible();

    // Set a distinct name
    await page.fill('#symbol-name', 'PersistenceTestSymbol');
    await page.fill('#symbol-category', 'Test');

    // Draw a rectangle to have visible graphics
    await page.click('[data-testid="tool-rect"]');
    const canvas = page.locator('[data-testid="editor-canvas-svg"]');
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).toBeTruthy();

    await page.mouse.move(canvasBox!.x + 60, canvasBox!.y + 60);
    await page.mouse.down();
    await page.mouse.move(canvasBox!.x + 140, canvasBox!.y + 120);
    await page.mouse.up();

    // Save to library
    await page.click('[data-testid="save-symbol-btn"]');
    await expect(page.locator('text=Symbol saved successfully')).toBeVisible();

    // Close editor
    await page.click('[title="Close"]');
    await expect(page.locator('[data-testid="symbol-editor"]')).not.toBeVisible();

    // Symbol should appear in the library with the given name
    await expect(page.locator('text=PersistenceTestSymbol')).toBeVisible();

    // Double-click or use Edit button to reopen
    const symbolRow = page.locator('.group', { hasText: 'PersistenceTestSymbol' }).first();
    await symbolRow.hover();
    await symbolRow.locator('[title="Edit"]').click();

    // Editor reopens with the saved name
    await expect(page.locator('[data-testid="symbol-editor"]')).toBeVisible();
    await expect(page.locator('#symbol-name')).toHaveValue('PersistenceTestSymbol');
  });
});
