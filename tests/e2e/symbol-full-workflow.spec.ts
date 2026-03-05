import { test, expect } from './fixtures/browser-test';
import { selectors } from './utils/selectors';

/**
 * Full-lifecycle selectors (all component layers, no data-testid on symbols):
 *
 * Project operations (from selectors.ts):
 *   selectors.menuFile, selectors.menuNewProject
 *   selectors.projectNameInput, selectors.createProjectBtn
 *   selectors.menuSave
 *
 * Symbol Editor (EditorToolbar / PropertiesPanel — title/id attrs):
 *   '[title="Rect"]'                           — draw rectangle tool
 *   '[title="Pin"]'                            — place pin tool
 *   '#symbol-name'                             — symbol name input
 *   '#symbol-category'                         — symbol category input
 *   'button:has-text("Save Symbol")'           — save to project library
 *   '[title="Save"]'                           — quick-save in header
 *   '[title="Close"]'                          — close editor overlay
 *   'text=Symbol saved successfully'           — save confirmation
 *
 * LibraryBrowser (drag source):
 *   'input[placeholder="Search symbols..."]'   — library search
 *   '[draggable="true"]:has-text("TestSymbol")'— specific symbol card
 *
 * Canvas (drop target + wire drawing):
 *   '[data-testid="panel-container"]'          — canvas container
 *   '[data-symbol-id]'                         — placed custom symbol block
 *   '[data-pin-id][data-direction="input"]'    — input pin on placed block
 *   '[data-block-id]'                          — any placed block
 *   '[data-pin-id][data-direction="output"]'   — output pin on any block
 *   '[data-wire-id]'                           — wire/connection element
 *
 * T31 full lifecycle: create → save → place → wire → save → reload → verify
 * Marked test.fixme() because Symbol Editor entry-point and canvas selectors
 * are not yet exposed via data-testid.
 */

test.describe('Symbol Full Lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test(
    'complete symbol lifecycle: create → save → place → wire → save → reload → verify',
    async ({ page }) => {
      test.fixme(
        true,
        'Requires data-testid on Symbol Editor entry-point and canvas pin/wire elements'
      );

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
      // Open Symbol Editor via menu / toolbar (replace with real selector once exposed)
      // await page.click('[data-testid="new-symbol-btn"]');
      await expect(page.locator('text=Symbol Editor')).toBeVisible();

      // Draw a rectangle body
      await page.click('[title="Rect"]');
      const canvas = page.locator('svg').first();
      const canvasBox = await canvas.boundingBox();
      expect(canvasBox).toBeTruthy();

      await page.mouse.move(canvasBox!.x + 80, canvasBox!.y + 80);
      await page.mouse.down();
      await page.mouse.move(canvasBox!.x + 160, canvasBox!.y + 140);
      await page.mouse.up();

      // Place an input pin on the left edge
      await page.click('[title="Pin"]');
      await page.mouse.click(canvasBox!.x + 80, canvasBox!.y + 110);
      // Configure pin in the popover (if it appears):
      // await page.click('button:has-text("Input")');
      // await page.click('button:has-text("OK")');

      // Place an output pin on the right edge
      await page.click('[title="Pin"]');
      await page.mouse.click(canvasBox!.x + 160, canvasBox!.y + 110);
      // Configure pin in the popover (if it appears):
      // await page.click('button:has-text("Output")');
      // await page.click('button:has-text("OK")');

      // ── Step 3: Set symbol metadata and save ────────────────────────────
      await page.fill('#symbol-name', 'TestSymbol');
      await page.fill('#symbol-category', 'Custom');

      await page.click('button:has-text("Save Symbol")');
      await expect(page.locator('text=Symbol saved successfully')).toBeVisible();

      // Close editor
      await page.click('[title="Close"]');
      await expect(page.locator('text=Symbol Editor')).not.toBeVisible();

      // ── Step 4: Verify symbol appears in the library ─────────────────────
      // await page.click('[data-testid="activity-symbols"]');
      await expect(page.locator('input[placeholder="Search symbols..."]')).toBeVisible();
      await expect(
        page.locator('[draggable="true"]:has-text("TestSymbol")')
      ).toBeVisible();

      // ── Step 5: Drag symbol to canvas ───────────────────────────────────
      const symbolCard = page.locator('[draggable="true"]:has-text("TestSymbol")').first();
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
    test.fixme(
      true,
      'Requires a saved project with at least one custom symbol in the library'
    );

    // Save project
    await page.keyboard.press('Control+s');
    await page.waitForTimeout(500);

    // Reload
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Open Library panel
    // await page.click('[data-testid="activity-symbols"]');

    // Symbol from previous session should still be listed
    await expect(page.locator('[draggable="true"]').first()).toBeVisible();
  });

  test('no console errors occur when opening Symbol Editor on a new project', async ({ page }) => {
    test.fixme(
      true,
      'Needs data-testid on the "New Symbol" entry-point button/menu item'
    );

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

    // Open Symbol Editor
    // await page.click('[data-testid="new-symbol-btn"]');
    await expect(page.locator('text=Symbol Editor')).toBeVisible();

    // Interact with the editor
    await page.click('[title="Rect"]');
    await page.click('[title="Pin"]');
    await page.click('[title="Select"]');

    // Close editor
    await page.click('[title="Close"]');

    // No errors should have occurred
    expect(consoleErrors).toHaveLength(0);
  });

  test('symbol with two pins can be placed and both pins are accessible', async ({ page }) => {
    test.fixme(
      true,
      'Requires a custom symbol with two pins already in the library'
    );

    // Place the custom symbol on canvas (drag-drop from library as per symbol-placement tests)
    const customBlock = page.locator('[data-symbol-id]').first();
    await expect(customBlock).toBeVisible();

    // Verify the placed symbol has exactly two pins
    const pins = customBlock.locator('[data-pin-id]');
    await expect(pins).toHaveCount(2);
  });
});
