import { defineConfig } from '@playwright/test';

/**
 * E2E smoke suite (Fase 5 — PR 5.2).
 *
 * Assume que a API e o CMS já estão a correr (dev: `pnpm dev`; CI: ver
 * `.github/workflows/e2e.yml`, que faz migrate + seed + start antes de
 * chamar `pnpm --filter @easysignage/e2e test`).
 */
export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: process.env.CMS_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'api-smoke',
      testMatch: /api-smoke\.spec\.ts/,
    },
    {
      name: 'cms-smoke',
      testMatch: /cms-smoke\.spec\.ts/,
      use: {
        baseURL: process.env.CMS_URL ?? 'http://localhost:3000',
      },
    },
    {
      name: 'cms-reports',
      testMatch: /reports-smoke\.spec\.ts/,
      use: {
        baseURL: process.env.CMS_URL ?? 'http://localhost:3000',
      },
    },
    {
      name: 'cms-assets',
      testMatch: /assets-smoke\.spec\.ts/,
      use: {
        baseURL: process.env.CMS_URL ?? 'http://localhost:3000',
      },
    },
    {
      name: 'cms-settings',
      testMatch: /settings-notifications-smoke\.spec\.ts/,
      use: {
        baseURL: process.env.CMS_URL ?? 'http://localhost:3000',
      },
    },
  ],
});
