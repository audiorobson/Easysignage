import { test, expect } from '@playwright/test';

/**
 * Fase 5.E — PR 5.18: notificações de alerta (webhook/e-mail) configuráveis
 * por tenant em `/settings`. Cobre o formulário na UI; o disparo real de
 * webhook/e-mail (best-effort, com mocks) já tem cobertura unitária em
 * `apps/api/src/notifications/alert-notifications.service.spec.ts`.
 */
test('configura webhook e e-mails de notificação de alerta em /settings', async ({ page }) => {
  await page.goto('/login');
  await page.locator('input[type="password"]').fill('admin123');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(/\/dashboard/);

  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'Notificações de alerta' })).toBeVisible();

  const webhookUrl = `https://hooks.example.com/e2e-${Date.now()}`;
  const emails = 'ops@e2e.local, gestor@e2e.local';

  await page.getByPlaceholder('https://hooks.exemplo.com/easysignage-alerts').fill(webhookUrl);
  await page.getByPlaceholder('ops@empresa.com, gestor@empresa.com').fill(emails);
  await page.getByRole('button', { name: 'Guardar notificações' }).click();

  await expect(page.getByText('Definições guardadas.')).toBeVisible();

  // Recarrega a página — os valores devem vir persistidos da API, não só do estado local.
  await page.reload();
  await expect(page.getByPlaceholder('https://hooks.exemplo.com/easysignage-alerts')).toHaveValue(webhookUrl);
  await expect(page.getByPlaceholder('ops@empresa.com, gestor@empresa.com')).toHaveValue(emails);
});
