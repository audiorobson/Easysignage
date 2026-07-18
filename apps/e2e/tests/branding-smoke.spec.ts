import { test, expect } from '@playwright/test';

/**
 * Fase 6 — PR 6.6: branding por tenant. Cobre o formulário em
 * `/settings/branding` e a propagação do nome/cor customizados até ao
 * preview embutido (`apps/cms/src/app/embed/preview/[playlistId]`, usado
 * pelo modal de pré-visualização de playlists) — o mesmo endpoint
 * (`GET /settings/branding`) também alimenta o CMS e a tela de login.
 */
test('branding customizado guardado em /settings/branding aparece no preview embutido', async ({ page }) => {
  await page.goto('/login');
  await page.locator('input[type="password"]').fill('admin123');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(/\/dashboard/);

  const brandName = `Acme Signage ${Date.now()}`;
  const brandColor = '#ff6600';

  await page.goto('/settings/branding');
  await expect(page.getByRole('heading', { name: 'Identidade visual' })).toBeVisible();

  await page.getByPlaceholder('EasySignage').fill(brandName);
  await page.getByPlaceholder('#2563eb').fill(brandColor);
  await page.getByRole('button', { name: 'Guardar branding' }).click();
  await expect(page.getByText('Definições guardadas.')).toBeVisible();

  // Recarrega — os valores devem vir persistidos da API.
  await page.reload();
  await expect(page.getByPlaceholder('EasySignage')).toHaveValue(brandName);
  await expect(page.getByPlaceholder('#2563eb')).toHaveValue(brandColor);

  // O nome de marca deve também aparecer na barra lateral do CMS.
  await page.goto('/dashboard');
  await expect(page.getByText(brandName)).toBeVisible();

  const playlistName = `Playlist Branding E2E ${Date.now()}`;
  await page.goto('/playlists/new');
  await page.getByLabel('Nome').fill(playlistName);
  await page.getByRole('button', { name: 'Criar playlist' }).click();
  await page.waitForURL(/\/playlists\/[^/]+$/);

  await page.goto('/playlists');
  const row = page.locator('.data-table tbody tr', { hasText: playlistName });
  await expect(row).toBeVisible();
  await row.getByTitle('Modo teste — pré-visualizar').click();

  const frame = page.frameLocator('iframe[title="Pré-visualização da playlist"]');
  const watermark = frame.getByTestId('embed-brand-watermark');
  await expect(watermark).toBeVisible({ timeout: 15_000 });
  await expect(frame.getByTestId('embed-brand-name')).toHaveText(brandName);
  await expect(watermark).toHaveCSS('border-color', 'rgb(255, 102, 0)');

  // Limpa o branding para não afetar outras specs de E2E que partilham o tenant `demo`.
  await page.goto('/settings/branding');
  await page.getByRole('button', { name: 'Repor para EasySignage' }).click();
  await page.getByRole('button', { name: 'Guardar branding' }).click();
  await expect(page.getByText('Definições guardadas.')).toBeVisible();
});
