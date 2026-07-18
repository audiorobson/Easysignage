import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, expect } from '@playwright/test';

/**
 * Fase 5.D — PR 5.16: CMS exibe thumbnails reais em `/assets`.
 *
 * Faz upload de uma imagem PNG mínima pela UI e confirma que a
 * pré-visualização deixa de ser o ícone genérico de placeholder e passa a
 * renderizar a miniatura real (gerada de forma síncrona no upload — o
 * `apps/media-worker` reprocessa/confirma de forma assíncrona depois).
 */
const PNG_1X1_RED_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

test('upload de imagem exibe miniatura real em /assets', async ({ page }) => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'easysignage-e2e-'));
  const fileName = `thumb-test-${Date.now()}.png`;
  const filePath = join(tmpDir, fileName);
  await writeFile(filePath, Buffer.from(PNG_1X1_RED_BASE64, 'base64'));

  try {
    await page.goto('/login');
    await page.locator('input[type="password"]').fill('admin123');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await page.waitForURL(/\/dashboard/);

    await page.goto('/assets');
    await expect(page.getByRole('heading', { name: 'Biblioteca' })).toBeVisible();

    await page.locator('input[type="file"]').setInputFiles(filePath);

    const row = page.locator('.data-table tbody tr').filter({ hasText: fileName }).first();
    await expect(row).toBeVisible({ timeout: 15_000 });

    // A pré-visualização síncrona (API, upload) já grava thumbnailKey para
    // imagens; a UI busca `/assets/:id/thumbnail` e troca o placeholder por
    // um <img> real assim que o blob chega.
    await expect(row.locator('img')).toBeVisible({ timeout: 15_000 });

    await row.getByRole('button', { name: 'Remover' }).click();
    await page.getByRole('button', { name: 'Remover' }).last().click();
    await expect(page.locator('.data-table tbody tr').filter({ hasText: fileName })).toHaveCount(0);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});
