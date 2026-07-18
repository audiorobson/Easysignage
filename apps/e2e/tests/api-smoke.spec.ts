import { test, expect, request } from '@playwright/test';

/**
 * Fluxo ponta-a-ponta pela API (determinístico, sem depender de seletores de UI):
 * login → site → device → pairing → asset → conteúdo de teste → device lê o estado.
 *
 * Espelha o "Teste manual sugerido" descrito em docs/estado-desenvolvimento.md.
 *
 * Nota: `baseURL` do Playwright resolve caminhos relativos como `new URL(path, baseURL)`.
 * Por isso o `baseURL` precisa terminar com `/` e os caminhos aqui NÃO devem começar com `/`
 * (caso contrário o segmento `/api/v1` do baseURL é descartado).
 */
const API_URL = (process.env.API_URL ?? 'http://localhost:3001/api/v1').replace(/\/?$/, '/');

// PNG 1x1 transparente, suficiente para validar o pipeline de upload/asset.
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

test('pareamento e publicação de conteúdo ponta-a-ponta', async () => {
  const api = await request.newContext({ baseURL: API_URL });

  const loginRes = await api.post('auth/login', {
    data: { tenantSlug: 'demo', email: 'admin@demo.local', password: 'admin123' },
  });
  expect(loginRes.ok()).toBeTruthy();
  const { accessToken } = await loginRes.json();
  expect(typeof accessToken).toBe('string');

  const authed = await request.newContext({
    baseURL: API_URL,
    extraHTTPHeaders: { Authorization: `Bearer ${accessToken}` },
  });

  const siteRes = await authed.post('sites', {
    data: { name: `E2E Site ${Date.now()}`, timezone: 'America/Sao_Paulo' },
  });
  expect(siteRes.ok()).toBeTruthy();
  const site = await siteRes.json();

  const deviceRes = await authed.post('devices', {
    data: { siteId: site.id, name: 'E2E Device', platform: 'web' },
  });
  expect(deviceRes.ok()).toBeTruthy();
  const { device, pairingCode } = await deviceRes.json();
  expect(pairingCode).toBeTruthy();

  const pairRes = await api.post('public/devices/pair', {
    data: { pairingCode, platform: 'web', name: 'E2E Player' },
  });
  expect(pairRes.ok()).toBeTruthy();
  const paired = await pairRes.json();
  expect(paired.accessToken).toBeTruthy();
  expect(paired.deviceId).toBe(device.id);

  const deviceApi = await request.newContext({
    baseURL: API_URL,
    extraHTTPHeaders: { Authorization: `Bearer ${paired.accessToken}` },
  });

  const assetRes = await authed.post('assets', {
    data: {
      name: 'E2E Asset',
      mimeType: 'image/png',
      dataBase64: TINY_PNG_BASE64,
    },
  });
  expect(assetRes.ok()).toBeTruthy();
  const asset = await assetRes.json();

  const assignRes = await authed.patch(`devices/${device.id}/test-content`, {
    data: { assetId: asset.id },
  });
  expect(assignRes.ok()).toBeTruthy();

  const stateRes = await deviceApi.get('device/state');
  expect(stateRes.ok()).toBeTruthy();
  const state = await stateRes.json();
  expect(state.currentItem?.type).toBe('asset');
  expect(state.currentItem?.assetId).toBe(asset.id);
});
