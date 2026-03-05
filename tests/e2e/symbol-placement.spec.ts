import { test, expect } from './fixtures/browser-test';

test.describe('Symbol Placement on Canvas', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('places a custom symbol on the canvas by drag-drop from library', async ({ page }) => {
    await expect(page.locator('[data-testid="symbol-library"]')).toBeVisible();

    // Find the first draggable symbol card in the library
    const symbolCard = page.locator('[data-testid^="symbol-entry-"]').first();
    await expect(symbolCard).toBeVisible();

    // Identify the canvas drop target
    const canvas = page.locator('[data-testid="panel-container"]');
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).toBeTruthy();

    // Perform drag from the symbol card to the centre of the canvas
    const cardBox = await symbolCard.boundingBox();
    expect(cardBox).toBeTruthy();

    const dropX = canvasBox!.x + canvasBox!.width / 2;
    const dropY = canvasBox!.y + canvasBox!.height / 2;

    await page.mouse.move(cardBox!.x + cardBox!.width / 2, cardBox!.y + cardBox!.height / 2);
    await page.mouse.down();
    await page.mouse.move(dropX, dropY, { steps: 20 });
    await page.mouse.up();

    // A block should now appear on the canvas
    await expect(page.locator('[data-symbol-id]').first()).toBeVisible();
  });

  test('places a symbol by searching then dragging from library', async ({ page }) => {
    await expect(page.locator('[data-testid="symbol-library"]')).toBeVisible();

    // Search for the symbol by name
    await page.fill('input[placeholder="Search symbols..."]', 'TestSymbol');

    // Only matching cards remain visible
    const matchingCard = page.locator('[data-testid^="symbol-entry-"]:has-text("TestSymbol")').first();
    await expect(matchingCard).toBeVisible();

    // Drag to canvas
    const canvas = page.locator('[data-testid="panel-container"]');
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).toBeTruthy();

    const cardBox = await matchingCard.boundingBox();
    expect(cardBox).toBeTruthy();

    await page.mouse.move(cardBox!.x + cardBox!.width / 2, cardBox!.y + cardBox!.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      canvasBox!.x + canvasBox!.width / 2,
      canvasBox!.y + canvasBox!.height / 2,
      { steps: 20 }
    );
    await page.mouse.up();

    // Block placed on canvas
    await expect(page.locator('[data-symbol-id]').first()).toBeVisible();
  });

  test('placed symbol renders with non-zero bounding box', async ({ page }) => {
    // After placement (assume done in prior step / fixture):
    const placedBlock = page.locator('[data-symbol-id]').first();
    await expect(placedBlock).toBeVisible();

    // The rendered block must occupy real screen space
    const blockBox = await placedBlock.boundingBox();
    expect(blockBox).toBeTruthy();
    expect(blockBox!.width).toBeGreaterThan(0);
    expect(blockBox!.height).toBeGreaterThan(0);
  });

  test('multiple symbols can be placed independently', async ({ page }) => {
    const symbolCard = page.locator('[data-testid^="symbol-entry-"]').first();
    const canvas = page.locator('[data-testid="panel-container"]');
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).toBeTruthy();

    const cardBox = await symbolCard.boundingBox();
    expect(cardBox).toBeTruthy();

    // Place first instance
    await page.mouse.move(cardBox!.x + cardBox!.width / 2, cardBox!.y + cardBox!.height / 2);
    await page.mouse.down();
    await page.mouse.move(canvasBox!.x + 100, canvasBox!.y + 100, { steps: 20 });
    await page.mouse.up();

    // Place second instance at a different location
    await page.mouse.move(cardBox!.x + cardBox!.width / 2, cardBox!.y + cardBox!.height / 2);
    await page.mouse.down();
    await page.mouse.move(canvasBox!.x + 300, canvasBox!.y + 200, { steps: 20 });
    await page.mouse.up();

    // Two distinct blocks exist on the canvas
    await expect(page.locator('[data-symbol-id]')).toHaveCount(2);
  });

  test('placed symbol persists after canvas pan', async ({ page }) => {
    // Verify initial placement
    const placedBlock = page.locator('[data-symbol-id]').first();
    await expect(placedBlock).toBeVisible();

    // Pan the canvas by space+drag
    const canvas = page.locator('[data-testid="panel-container"]');
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).toBeTruthy();

    await page.keyboard.down('Space');
    await page.mouse.move(canvasBox!.x + 200, canvasBox!.y + 200);
    await page.mouse.down();
    await page.mouse.move(canvasBox!.x + 350, canvasBox!.y + 350, { steps: 10 });
    await page.mouse.up();
    await page.keyboard.up('Space');

    // Block should still be in the DOM (just repositioned)
    await expect(page.locator('[data-symbol-id]').first()).toBeVisible();
  });
});
