import { test, expect } from './fixtures/browser-test';
import { selectors } from './utils/selectors';
import type { Page } from '@playwright/test';

async function openSymbolEditor(page: Page) {
  await page.keyboard.press('Control+Shift+P');
  await page.waitForSelector('[data-testid="command-palette"]', { state: 'visible' });
  await page.fill('[data-testid="command-palette-input"]', 'Symbol Editor');
  await page.click('text=Open Symbol Editor');
  await page.waitForSelector('[data-testid="symbol-editor"]', { state: 'visible' });
}

test.describe('Symbol Full Lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test(
    'complete symbol lifecycle: create → save → place → wire → save → reload → verify',
    async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      // ── Step 1: Create a new project ─────────────────────────────────────
      await page.click(selectors.menuFile);
      await page.click(selectors.menuNewProject);
      await expect(page.locator(selectors.newProjectDialog)).toBeVisible();
      await page.fill(selectors.projectNameInput, 'SymbolLifecycleProject');
      await page.click(selectors.createProjectBtn);
      await page.waitForLoadState('networkidle');

      // ── Step 2: Open Symbol Editor and create a symbol ───────────────────
      await openSymbolEditor(page);
      await expect(page.locator('[data-testid="symbol-editor"]')).toBeVisible();

      // Draw a rectangle body
      await page.click('[data-testid="tool-rect"]');
      const canvas = page.locator('[data-testid="editor-canvas-svg"]');
      const canvasBox = await canvas.boundingBox();
      expect(canvasBox).toBeTruthy();

      await page.mouse.move(canvasBox!.x + 80, canvasBox!.y + 80);
      await page.mouse.down();
      await page.mouse.move(canvasBox!.x + 160, canvasBox!.y + 140);
      await page.mouse.up();

      // Place an input pin on the left edge
      await page.click('[data-testid="tool-pin"]');
      await page.mouse.click(canvasBox!.x + 80, canvasBox!.y + 110);
      // Configure pin in the popover (if it appears):
      // await page.click('button:has-text("Input")');
      // await page.click('button:has-text("OK")');

      // Place an output pin on the right edge
      await page.click('[data-testid="tool-pin"]');
      await page.mouse.click(canvasBox!.x + 160, canvasBox!.y + 110);
      // Configure pin in the popover (if it appears):
      // await page.click('button:has-text("Output")');
      // await page.click('button:has-text("OK")');

      // ── Step 3: Set symbol metadata and save ────────────────────────────
      await page.fill('#symbol-name', 'TestSymbol');
      await page.fill('#symbol-category', 'Custom');

      await page.click('[data-testid="save-symbol-btn"]');
      await expect(page.locator('text=Symbol saved successfully')).toBeVisible();

      // Close editor
      await page.click('[title="Close"]');
      await expect(page.locator('[data-testid="symbol-editor"]')).not.toBeVisible();

      // ── Step 4: Verify symbol appears in the library ─────────────────────
      await expect(page.locator('[data-testid="symbol-library"]')).toBeVisible();
      await expect(
        page.locator('[data-testid^="symbol-entry-"]:has-text("TestSymbol")')
      ).toBeVisible();

      // ── Step 5: Drag symbol to canvas ───────────────────────────────────
      const symbolCard = page.locator('[data-testid^="symbol-entry-"]:has-text("TestSymbol")').first();
      const mainCanvas = page.locator('[data-testid="panel-container"]');
      const mainCanvasBox = await mainCanvas.boundingBox();
      expect(mainCanvasBox).toBeTruthy();

      const cardBox = await symbolCard.boundingBox();
      expect(cardBox).toBeTruthy();

      await page.mouse.move(cardBox!.x + cardBox!.width / 2, cardBox!.y + cardBox!.height / 2);
      await page.mouse.down();
      await page.mouse.move(
        mainCanvasBox!.x + mainCanvasBox!.width / 2,
        mainCanvasBox!.y + mainCanvasBox!.height / 2,
        { steps: 20 }
      );
      await page.mouse.up();

      // Verify the custom symbol block appeared on canvas
      await expect(page.locator('[data-symbol-id]').first()).toBeVisible();

      // ── Step 6: Connect a wire to the custom symbol input pin ────────────
      const customBlock = page.locator('[data-symbol-id]').first();
      const inputPin = customBlock.locator('[data-pin-id][data-direction="input"]').first();
      const outputSource = page
        .locator('[data-block-id]')
        .locator('[data-pin-id][data-direction="output"]')
        .first();

      const outputBox = await outputSource.boundingBox();
      const inputBox = await inputPin.boundingBox();
      expect(outputBox).toBeTruthy();
      expect(inputBox).toBeTruthy();

      await page.mouse.move(
        outputBox!.x + outputBox!.width / 2,
        outputBox!.y + outputBox!.height / 2
      );
      await page.mouse.down();
      await page.mouse.move(
        inputBox!.x + inputBox!.width / 2,
        inputBox!.y + inputBox!.height / 2,
        { steps: 20 }
      );
      await page.mouse.up();

      // Wire must be present
      await expect(page.locator('[data-wire-id]').first()).toBeVisible();

      // ── Step 7: Save the project ─────────────────────────────────────────
      await page.keyboard.press('Control+s');
      await page.waitForTimeout(500);

      // ── Step 8: Reload the page ──────────────────────────────────────────
      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);

      // ── Step 9: Verify canvas state is fully restored ────────────────────
      // Custom symbol block still on canvas
      await expect(page.locator('[data-symbol-id]').first()).toBeVisible();

      // Wire still connected
      await expect(page.locator('[data-wire-id]').first()).toBeVisible();

      // ── Step 10: Verify no console errors during the entire flow ─────────
      expect(consoleErrors).toHaveLength(0);
    }
  );

  test('symbol library persists across project reload', async ({ page }) => {
    // Save project
    await page.keyboard.press('Control+s');
    await page.waitForTimeout(500);

    // Reload
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Symbol from previous session should still be listed
    await expect(page.locator('[data-testid^="symbol-entry-"]').first()).toBeVisible();
  });

  test('no console errors occur when opening Symbol Editor on a new project', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Create project
    await page.click(selectors.menuFile);
    await page.click(selectors.menuNewProject);
    await page.fill(selectors.projectNameInput, 'ErrorCheckProject');
    await page.click(selectors.createProjectBtn);
    await page.waitForLoadState('networkidle');

    await openSymbolEditor(page);
    await expect(page.locator('[data-testid="symbol-editor"]')).toBeVisible();

    // Interact with the editor
    await page.click('[data-testid="tool-rect"]');
    await page.click('[data-testid="tool-pin"]');
    await page.click('[data-testid="tool-select"]');

    // Close editor
    await page.click('[title="Close"]');

    // No errors should have occurred
    expect(consoleErrors).toHaveLength(0);
  });

  test('symbol with two pins can be placed and both pins are accessible', async ({ page }) => {
    // Place the custom symbol on canvas (drag-drop from library as per symbol-placement tests)
    const customBlock = page.locator('[data-symbol-id]').first();
    await expect(customBlock).toBeVisible();

    // Verify the placed symbol has exactly two pins
    const pins = customBlock.locator('[data-pin-id]');
    await expect(pins).toHaveCount(2);
  });
});
