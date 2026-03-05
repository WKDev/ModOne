import { test, expect } from './fixtures/browser-test';
import { selectors } from './utils/selectors';

/**
 * Symbol wiring selectors (OneCanvas — custom symbol pins and wires):
 *
 * Canvas area:
 *   '[data-testid="panel-container"]'         — outer canvas container
 *   '[data-symbol-id]'                         — placed custom symbol block
 *   '[data-block-id]'                          — any placed block (built-in or custom)
 *
 * Pins / connection points:
 *   '[data-pin-id]'                            — a pin/port element on a block
 *   '[data-pin-id][data-direction="input"]'    — input pin
 *   '[data-pin-id][data-direction="output"]'   — output pin
 *
 * Wire elements:
 *   '[data-wire-id]'                           — a wire/connection segment in SVG
 *
 * Wiring requires: open project, at least one placed custom symbol with pins,
 * and at least one placed built-in block.
 */

test.describe('Symbol Wiring', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('connects a wire from a built-in block output to a custom symbol input pin', async ({ page }) => {
    // Locate built-in block output pin
    const builtInBlock = page.locator('[data-block-id]').first();
    await expect(builtInBlock).toBeVisible();

    const outputPin = builtInBlock.locator('[data-pin-id][data-direction="output"]').first();
    await expect(outputPin).toBeVisible();

    // Locate custom symbol input pin
    const customSymbol = page.locator('[data-symbol-id]').first();
    await expect(customSymbol).toBeVisible();

    const inputPin = customSymbol.locator('[data-pin-id][data-direction="input"]').first();
    await expect(inputPin).toBeVisible();

    // Drag from output pin to input pin to draw a wire
    const outputBox = await outputPin.boundingBox();
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

    // A wire element must now exist in the canvas SVG
    await expect(page.locator('[data-wire-id]').first()).toBeVisible();
  });

  test('connects a wire from custom symbol output to another block input', async ({ page }) => {
    // Locate the custom symbol output pin
    const customSymbol = page.locator('[data-symbol-id]').first();
    const outputPin = customSymbol.locator('[data-pin-id][data-direction="output"]').first();

    // Locate destination block input pin
    const destBlock = page.locator('[data-block-id]').nth(1);
    const inputPin = destBlock.locator('[data-pin-id][data-direction="input"]').first();

    const outputBox = await outputPin.boundingBox();
    const inputBox = await inputPin.boundingBox();
    expect(outputBox).toBeTruthy();
    expect(inputBox).toBeTruthy();

    // Draw wire
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

    // Wire created
    await expect(page.locator('[data-wire-id]').first()).toBeVisible();
  });

  test('wire persists after project save and page reload', async ({ page }) => {
    // Save project via Ctrl+S
    await page.keyboard.press('Control+s');
    await page.waitForTimeout(500);

    // Reload the page
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Wire must still exist after reload
    await expect(page.locator('[data-wire-id]').first()).toBeVisible();
  });

  test('cannot connect two output pins together', async ({ page }) => {
    // Locate two output pins
    const firstOutputPin = page
      .locator('[data-pin-id][data-direction="output"]')
      .first();
    const secondOutputPin = page
      .locator('[data-pin-id][data-direction="output"]')
      .nth(1);

    const firstBox = await firstOutputPin.boundingBox();
    const secondBox = await secondOutputPin.boundingBox();
    expect(firstBox).toBeTruthy();
    expect(secondBox).toBeTruthy();

    // Attempt invalid wire
    await page.mouse.move(
      firstBox!.x + firstBox!.width / 2,
      firstBox!.y + firstBox!.height / 2
    );
    await page.mouse.down();
    await page.mouse.move(
      secondBox!.x + secondBox!.width / 2,
      secondBox!.y + secondBox!.height / 2,
      { steps: 20 }
    );
    await page.mouse.up();

    // No wire should be created for an invalid connection
    await expect(page.locator('[data-wire-id]')).toHaveCount(0);
  });

  test('wired connection is visible in canvas after zoom', async ({ page }) => {
    // Verify the wire exists
    await expect(page.locator('[data-wire-id]').first()).toBeVisible();

    // Zoom in using Ctrl++
    await page.keyboard.press('Control+=');
    await page.waitForTimeout(200);

    // Wire should still be visible in the DOM
    await expect(page.locator('[data-wire-id]').first()).toBeVisible();

    // Zoom back out
    await page.keyboard.press('Control+-');
    await page.waitForTimeout(200);

    await expect(page.locator('[data-wire-id]').first()).toBeVisible();
  });

  test('status bar shows no errors after valid wiring', async ({ page }) => {
    // After a valid wire is placed, no error indicator should appear in the status bar
    const statusBar = page.locator(selectors.statusBar);
    await expect(statusBar).toBeVisible();

    // Status bar should not contain an error indicator
    await expect(statusBar.locator('[data-testid="status-error"]')).toHaveCount(0);
  });
});
