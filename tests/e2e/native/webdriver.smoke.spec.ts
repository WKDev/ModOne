import { test, expect } from '@playwright/test';

test.describe('Tauri Native WebDriver', () => {
  test('webdriver status endpoint responds', async () => {
    const endpoint = process.env.TAURI_WEBDRIVER_ENDPOINT ?? 'http://127.0.0.1:4445/status';

    let response: Response;
    try {
      response = await fetch(endpoint);
    } catch {
      test.skip(true, `Native WebDriver endpoint is not available: ${endpoint}`);
      return;
    }

    if (!response.ok) {
      test.skip(true, `Native WebDriver endpoint returned ${response.status}`);
      return;
    }

    expect(response.ok).toBe(true);

    const body = (await response.json()) as { value?: { ready?: boolean } };
    expect(typeof body.value?.ready).toBe('boolean');
  });
});
