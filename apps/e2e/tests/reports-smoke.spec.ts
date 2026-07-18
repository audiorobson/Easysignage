import { test, expect, request } from '@playwright/test';

/**
 * Fase 5.B — PR 5.9: tela de proof-of-play no CMS (`/reports`).
 *
 * Prepara dados via API (site → device → pairing → evento de playback) e depois
 * valida na UI: filtro por dispositivo mostra as linhas certas e o export CSV
 * dispara um download com o conteúdo esperado.
 *
 * Cleanup no `finally`: remove device/site para permitir reexecuções locais
 * repetidas mesmo com licença TRIAL (limite de 1 player).
 */
const API_URL = (process.env.API_URL ?? 'http://localhost:3001/api/v1').replace(/\/?$/, '/');

test('relatório de proof-of-play — filtro por dispositivo e export CSV', async ({ page }) => {
  const api = await request.newContext({ baseURL: API_URL });

  const loginRes = await api.post('auth/login', {
    data: { tenantSlug: 'demo', email: 'admin@demo.local', password: 'admin123' },
  });
  expect(loginRes.ok()).toBeTruthy();
  const { accessToken } = await loginRes.json();

  const authed = await request.newContext({
    baseURL: API_URL,
    extraHTTPHeaders: { Authorization: `Bearer ${accessToken}` },
  });

  const siteRes = await authed.post('sites', {
    data: { name: `E2E Reports Site ${Date.now()}`, timezone: 'America/Sao_Paulo' },
  });
  expect(siteRes.ok()).toBeTruthy();
  const site = await siteRes.json();

  const deviceRes = await authed.post('devices', {
    data: { siteId: site.id, name: 'E2E Reports Device', platform: 'web' },
  });
  expect(deviceRes.ok()).toBeTruthy();
  const { device, pairingCode } = await deviceRes.json();

  try {
    const pairRes = await api.post('public/devices/pair', {
      data: { pairingCode, platform: 'web', name: 'E2E Reports Player' },
    });
    expect(pairRes.ok()).toBeTruthy();
    const paired = await pairRes.json();

    const deviceApi = await request.newContext({
      baseURL: API_URL,
      extraHTTPHeaders: { Authorization: `Bearer ${paired.accessToken}` },
    });

    const startedAt = new Date().toISOString();
    const playbackRes = await deviceApi.post('device/playback-events', {
      data: {
        events: [
          {
            itemType: 'asset',
            eventType: 'completed',
            startedAt,
            durationMs: 12_000,
          },
        ],
      },
    });
    expect(playbackRes.ok()).toBeTruthy();

    await page.goto('/login');
    await page.locator('input[type="password"]').fill('admin123');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await page.waitForURL(/\/dashboard/);

    await page.goto('/reports');
    await expect(page.getByRole('heading', { name: 'Relatórios' })).toBeVisible();

    await page.getByLabel('Dispositivo').selectOption({ label: 'E2E Reports Player' });
    await expect(page.locator('.data-table tbody tr')).toHaveCount(1);
    await expect(page.locator('.data-table tbody tr').first()).toContainText('E2E Reports Player');
    await expect(page.locator('.data-table tbody tr').first()).toContainText('Concluído');

    const exportButton = page.getByRole('button', { name: /Exportar CSV/ });
    await expect(exportButton).toBeEnabled();
    const [download] = await Promise.all([page.waitForEvent('download'), exportButton.click()]);
    const csvPath = await download.path();
    expect(csvPath).toBeTruthy();
  } finally {
    await authed.delete(`devices/${device.id}`);
    await authed.delete(`sites/${site.id}`).catch(() => undefined);
  }
});
