import { type Page, expect } from '@playwright/test';
import { selectors } from './selectors';
import { waitForAppReady, waitForElement } from './app';

/**
 * Common test operations and helpers for E2E tests
 */

/**
 * Create a new project via the UI
 */
export async function createNewProject(
  page: Page,
  projectName: string,
  folderPath?: string
): Promise<void> {
  // Click File menu
  await page.click(selectors.menuFile);

  // Click New Project
  await page.click(selectors.menuNewProject);

  // Wait for dialog to appear
  await waitForElement(page, selectors.newProjectDialog);

  // Fill in project name
  await page.fill(selectors.projectNameInput, projectName);

  // If folder path provided, set it (may require native dialog interaction)
  if (folderPath) {
    // In a real Tauri app, this would open a native dialog
    // For testing, we may need to mock this or use a predefined path
    await page.click(selectors.projectFolderSelect);
  }

  // Click Create button
  await page.click(selectors.createProjectBtn);

  // Wait for project to load
  await page.waitForSelector(selectors.projectHeader, { state: 'visible' });
}

/**
 * Open an existing project by path
 */
export async function openProject(page: Page, projectPath: string): Promise<void> {
  // Click File menu
  await page.click(selectors.menuFile);

  // Click Open Project
  await page.click(selectors.menuOpenProject);

  // Note: Opening a project requires native file dialog interaction
  // In tests, we may need to use a predefined project or mock the dialog
}

/**
 * Save the current project
 */
export async function saveProject(page: Page): Promise<void> {
  await page.keyboard.press('Control+s');
  // Wait for save notification or indicator
  await page.waitForTimeout(500); // Brief wait for save operation
}

/**
 * Toggle sidebar visibility with keyboard shortcut
 */
export async function toggleSidebar(page: Page): Promise<void> {
  await page.keyboard.press('Control+b');
  // Wait for transition to complete
  await page.waitForTimeout(300);
}

/**
 * Check if sidebar is visible
 */
export async function isSidebarVisible(page: Page): Promise<boolean> {
  const sidebar = page.locator(selectors.sidebarContent);
  const isVisible = await sidebar.isVisible();
  if (!isVisible) return false;

  // Also check width is > 0
  const box = await sidebar.boundingBox();
  return box !== null && box.width > 0;
}

/**
 * Switch to a specific sidebar tab via activity bar
 */
export async function switchSidebarTab(
  page: Page,
  tab: 'explorer' | 'search' | 'modbus' | 'settings'
): Promise<void> {
  const selector = {
    explorer: selectors.activityExplorer,
    search: selectors.activitySearch,
    modbus: selectors.activityModbus,
    settings: selectors.activitySettings,
  }[tab];

  await page.click(selector);
  // Wait for panel content to update
  await page.waitForTimeout(200);
}

/**
 * Close a panel by its ID
 */
export async function closePanel(page: Page, panelId: string): Promise<void> {
  await page.click(selectors.panelCloseBtn(panelId));
}

/**
 * Close a tab by its ID
 */
export async function closeTab(page: Page, tabId: string): Promise<void> {
  // Hover over tab to reveal close button
  await page.hover(selectors.tab(tabId));
  await page.click(selectors.tabCloseBtn(tabId));
}

/**
 * Start the Modbus TCP server
 */
export async function startModbusTcpServer(page: Page, port?: number): Promise<void> {
  // Switch to Modbus panel
  await switchSidebarTab(page, 'modbus');

  // Optionally set port
  if (port !== undefined) {
    await page.fill(selectors.tcpPortInput, port.toString());
  }

  // Click start button
  await page.click(selectors.modbusStartTcp);

  // Wait for status to show running
  await expect(page.locator(selectors.tcpStatus)).toContainText('Running', {
    timeout: 5000,
  });
}

/**
 * Stop the Modbus TCP server
 */
export async function stopModbusTcpServer(page: Page): Promise<void> {
  await page.click(selectors.modbusStopTcp);

  // Wait for status to show stopped
  await expect(page.locator(selectors.tcpStatus)).toContainText('Stopped', {
    timeout: 5000,
  });
}

/**
 * Start simulation
 */
export async function startSimulation(page: Page): Promise<void> {
  await page.keyboard.press('F5');
  // Or use button
  // await page.click(selectors.simulationStart);

  // Wait for status
  await expect(page.locator(selectors.simulationStatus)).toContainText('Running', {
    timeout: 5000,
  });
}

/**
 * Stop simulation
 */
export async function stopSimulation(page: Page): Promise<void> {
  await page.keyboard.press('Shift+F5');
  // Or use button
  // await page.click(selectors.simulationStop);

  // Wait for status
  await expect(page.locator(selectors.simulationStatus)).toContainText('Stopped', {
    timeout: 5000,
  });
}

/**
 * Open settings dialog
 */
export async function openSettings(page: Page): Promise<void> {
  // Via sidebar
  await switchSidebarTab(page, 'settings');

  // Or via menu
  // await page.click(selectors.menuEdit);
  // await page.click('[data-testid="menu-preferences"]');
}

/**
 * Close settings dialog
 */
export async function closeSettings(page: Page): Promise<void> {
  const dialog = page.locator(selectors.settingsDialog);
  if (await dialog.isVisible()) {
    await page.click(selectors.settingsClose);
  }
}

/**
 * Drag and resize a panel
 */
export async function resizePanel(
  page: Page,
  handleSelector: string,
  deltaX: number,
  deltaY: number
): Promise<void> {
  const handle = page.locator(handleSelector);
  const box = await handle.boundingBox();

  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + deltaX, box.y + deltaY);
    await page.mouse.up();
  }
}

/**
 * Search in the search panel
 */
export async function performSearch(page: Page, query: string): Promise<void> {
  await switchSidebarTab(page, 'search');
  await page.fill(selectors.searchInput, query);
  await page.keyboard.press('Enter');
  // Wait for results
  await page.waitForSelector(selectors.searchResults, { state: 'visible' });
}

/**
 * Clear console output
 */
export async function clearConsole(page: Page): Promise<void> {
  await page.click(selectors.consoleClear);
}

/**
 * Get console output text
 */
export async function getConsoleOutput(page: Page): Promise<string> {
  return await page.locator(selectors.consoleOutput).textContent() ?? '';
}

/**
 * Verify error dialog appears with specific message
 */
export async function verifyErrorDialog(
  page: Page,
  expectedMessage?: string
): Promise<void> {
  await expect(page.locator(selectors.errorMessage)).toBeVisible();
  if (expectedMessage) {
    await expect(page.locator(selectors.errorMessage)).toContainText(expectedMessage);
  }
}

/**
 * Dismiss any notification that appears
 */
export async function dismissNotification(page: Page): Promise<void> {
  const notification = page.locator(selectors.notification);
  if (await notification.isVisible()) {
    await notification.click();
  }
}

/**
 * Wait for and verify a notification message
 */
export async function expectNotification(
  page: Page,
  message: string,
  timeout = 5000
): Promise<void> {
  const notification = page.locator(selectors.notification);
  await expect(notification).toBeVisible({ timeout });
  await expect(notification).toContainText(message);
}

/**
 * Get memory value at a specific address
 */
export async function getMemoryValue(page: Page, address: number): Promise<string> {
  const valueLocator = page.locator(selectors.memoryValue(address));
  return await valueLocator.textContent() ?? '';
}

/**
 * Verify the project header shows the expected name
 */
export async function verifyProjectName(page: Page, expectedName: string): Promise<void> {
  await expect(page.locator(selectors.projectName)).toContainText(expectedName);
}
