import { test, expect } from '@playwright/test';

/** Smoke de UI: valida que o shell do CMS carrega e o login está acessível. */
test('página de login do CMS carrega', async ({ page }) => {
  await page.goto('/login');
  await expect(page.locator('input[type="password"]')).toBeVisible();
  await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
});
