import { type Page, type Browser, chromium } from '@playwright/test';

/**
 * Tauri app lifecycle helpers for E2E testing
 *
 * Note: For Tauri apps, we test through the web interface served by Vite
 * The Playwright webServer configuration handles starting the dev server
 */

/**
 * Wait for the application to be fully loaded and ready
 */
export async function waitForAppReady(page: Page, timeout = 30000): Promise<void> {
  // Wait for the main layout to be visible
  await page.waitForSelector('[data-testid="main-layout"]', {
    state: 'visible',
    timeout
  });

  // Wait for any initial loading states to complete
  await page.waitForFunction(() => {
    const loading = document.querySelector('[data-testid="loading-spinner"]');
    return !loading || (loading as HTMLElement).style.display === 'none';
  }, { timeout });
}

/**
 * Wait for a specific element to appear and be interactive
 */
export async function waitForElement(
  page: Page,
  selector: string,
  options: { timeout?: number; state?: 'visible' | 'attached' | 'hidden' } = {}
): Promise<void> {
  const { timeout = 10000, state = 'visible' } = options;
  await page.waitForSelector(selector, { state, timeout });
}

/**
 * Wait for navigation or page transition to complete
 */
export async function waitForNavigation(page: Page, timeout = 10000): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout });
}

/**
 * Take a screenshot with a descriptive name
 */
export async function takeScreenshot(
  page: Page,
  name: string,
  options: { fullPage?: boolean } = {}
): Promise<void> {
  await page.screenshot({
    path: `tests/e2e/screenshots/${name}.png`,
    fullPage: options.fullPage ?? false,
  });
}

/**
 * Get the current viewport size
 */
export async function getViewportSize(page: Page): Promise<{ width: number; height: number }> {
  const size = page.viewportSize();
  return size ?? { width: 1280, height: 720 };
}

/**
 * Set the viewport size for responsive testing
 */
export async function setViewportSize(
  page: Page,
  width: number,
  height: number
): Promise<void> {
  await page.setViewportSize({ width, height });
}

/**
 * Clear all application state (localStorage, sessionStorage)
 */
export async function clearAppState(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

/**
 * Get localStorage value
 */
export async function getLocalStorageItem(page: Page, key: string): Promise<string | null> {
  return await page.evaluate((k) => localStorage.getItem(k), key);
}

/**
 * Set localStorage value
 */
export async function setLocalStorageItem(
  page: Page,
  key: string,
  value: string
): Promise<void> {
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [key, value]);
}

/**
 * Launch browser with Tauri-optimized settings
 * Use this for standalone browser tests outside of Playwright Test
 */
export async function launchBrowser(): Promise<Browser> {
  return chromium.launch({
    headless: process.env.CI === 'true',
    args: [
      '--disable-web-security',
      '--allow-file-access-from-files',
    ],
  });
}

/**
 * Create a new page with default settings
 */
export async function createPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    locale: 'en-US',
  });
  return context.newPage();
}

/**
 * Close browser and cleanup resources
 */
export async function closeBrowser(browser: Browser): Promise<void> {
  await browser.close();
}

/**
 * Reload the page and wait for app to be ready
 */
export async function reloadApp(page: Page): Promise<void> {
  await page.reload();
  await waitForAppReady(page);
}

/**
 * Check if the app is in a specific state
 */
export async function isAppState(
  page: Page,
  state: 'loading' | 'ready' | 'error'
): Promise<boolean> {
  switch (state) {
    case 'loading':
      return await page.locator('[data-testid="loading-spinner"]').isVisible();
    case 'ready':
      return await page.locator('[data-testid="main-layout"]').isVisible();
    case 'error':
      return await page.locator('[data-testid="error-message"]').isVisible();
    default:
      return false;
  }
}
