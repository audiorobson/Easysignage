import { test, expect } from '@playwright/test';

/**
 * Fase 6 — PR 6.2: trilha de auditoria. O interceptor global
 * (`apps/api/src/audit/audit-log.interceptor.ts`) já tem cobertura unitária
 * completa; este teste cobre a ponta-a-ponta real: uma mutação feita na UI
 * do CMS aparece na tela `/settings/audit`.
 */
test('criar um site regista uma entrada na trilha de auditoria', async ({ page }) => {
  await page.goto('/login');
  await page.locator('input[type="password"]').fill('admin123');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(/\/dashboard/);

  const siteName = `Site Auditoria E2E ${Date.now()}`;

  await page.goto('/sites/new');
  await page.getByLabel('Nome').fill(siteName);
  await page.getByRole('button', { name: 'Criar espaço' }).click();
  await page.waitForURL(/\/sites\/[^/]+$/);

  await page.goto('/settings/audit');
  await expect(page.getByRole('heading', { name: 'Auditoria' })).toBeVisible();

  await page.getByLabel('Área').selectOption('sites');
  await page.getByLabel('Ação').selectOption('POST');

  const row = page.locator('.data-table tbody tr').first();
  await expect(row).toBeVisible({ timeout: 15_000 });
  await expect(row).toContainText('Criar');
  await expect(row).toContainText('sites');
  await expect(row).toContainText('201');
});
