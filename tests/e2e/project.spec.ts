import { test, expect } from '@playwright/test';
import { selectors } from './utils/selectors';
import { testProjectNames, shortcuts } from './fixtures';

test.describe('Project Operations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for app to be ready
    await page.waitForLoadState('networkidle');
  });

  test('displays application main layout on load', async ({ page }) => {
    // Verify the main layout components are visible
    await expect(page.locator(selectors.menuBar)).toBeVisible();
    await expect(page.locator(selectors.activityBar)).toBeVisible();
    await expect(page.locator(selectors.statusBar)).toBeVisible();
  });

  test('opens new project dialog from File menu', async ({ page }) => {
    // Click File menu
    await page.click(selectors.menuFile);

    // Click New Project
    await page.click(selectors.menuNewProject);

    // Verify dialog opens
    await expect(page.locator(selectors.newProjectDialog)).toBeVisible();

    // Verify input fields are present
    await expect(page.locator(selectors.projectNameInput)).toBeVisible();
  });

  test('closes new project dialog with cancel button', async ({ page }) => {
    // Open dialog
    await page.click(selectors.menuFile);
    await page.click(selectors.menuNewProject);
    await expect(page.locator(selectors.newProjectDialog)).toBeVisible();

    // Click cancel
    await page.click(selectors.cancelProjectBtn);

    // Verify dialog closes
    await expect(page.locator(selectors.newProjectDialog)).not.toBeVisible();
  });

  test('closes new project dialog with close button', async ({ page }) => {
    // Open dialog
    await page.click(selectors.menuFile);
    await page.click(selectors.menuNewProject);
    await expect(page.locator(selectors.newProjectDialog)).toBeVisible();

    // Click X button
    await page.click(selectors.newProjectClose);

    // Verify dialog closes
    await expect(page.locator(selectors.newProjectDialog)).not.toBeVisible();
  });

  test('validates project name is required', async ({ page }) => {
    // Open dialog
    await page.click(selectors.menuFile);
    await page.click(selectors.menuNewProject);

    // Clear input and try to create
    await page.fill(selectors.projectNameInput, '');

    // Create button should be disabled or show error
    const createBtn = page.locator(selectors.createProjectBtn);

    // Either button is disabled or clicking shows error
    const isDisabled = await createBtn.isDisabled();
    if (!isDisabled) {
      await createBtn.click();
      // Expect error message
      await expect(page.locator('[data-testid="project-name-error"]')).toBeVisible();
    }
  });

  test('opens open project dialog from File menu', async ({ page }) => {
    // Click File menu
    await page.click(selectors.menuFile);

    // Click Open Project menu item
    const openMenuItem = page.locator(selectors.menuOpenProject);
    await expect(openMenuItem).toBeVisible();

    // Note: Actually clicking will open a native file dialog
    // which cannot be controlled by Playwright
  });

  test('keyboard shortcut Ctrl+N opens new project dialog', async ({ page }) => {
    // Use keyboard shortcut
    await page.keyboard.press(shortcuts.newProject);

    // Verify dialog opens
    await expect(page.locator(selectors.newProjectDialog)).toBeVisible();
  });

  test('displays recent projects in File menu', async ({ page }) => {
    // Click File menu
    await page.click(selectors.menuFile);

    // Look for Recent Projects submenu
    const recentMenu = page.locator(selectors.menuRecentProjects);
    await expect(recentMenu).toBeVisible();
  });

  test('menu bar shows all expected menus', async ({ page }) => {
    // Verify all menu labels are visible
    await expect(page.locator(selectors.menuFile)).toBeVisible();
    await expect(page.locator(selectors.menuEdit)).toBeVisible();
    await expect(page.locator(selectors.menuView)).toBeVisible();
    await expect(page.locator(selectors.menuSimulation)).toBeVisible();
    await expect(page.locator(selectors.menuModbus)).toBeVisible();
    await expect(page.locator(selectors.menuHelp)).toBeVisible();
  });
});

test.describe('Project State Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('shows no project open initially', async ({ page }) => {
    // Project header should indicate no project
    const projectHeader = page.locator(selectors.projectHeader);

    // Either not visible or shows "No Project" indicator
    const isVisible = await projectHeader.isVisible();
    if (isVisible) {
      const text = await projectHeader.textContent();
      expect(text?.toLowerCase()).toMatch(/no project|untitled|new/i);
    }
  });

  test('unsaved changes dialog appears when needed', async ({ page }) => {
    // This test would require setting up a project first
    // and making modifications - skipping for initial implementation
    test.skip();
  });
});

test.describe('Project Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('handles invalid project gracefully', async ({ page }) => {
    // This test requires file dialog interaction
    // which is not directly testable with Playwright
    test.skip();
  });

  test('displays error for corrupted project file', async ({ page }) => {
    // This test requires file dialog interaction
    test.skip();
  });
});
