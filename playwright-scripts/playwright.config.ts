import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

export default defineConfig({
  testDir: './specs',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  workers: 4,
  retries: 0,
  timeout: 300_000,
  globalTimeout: 3_600_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: BASE_URL,
    headless: true,
    viewport: { width: 1440, height: 900 },
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
    actionTimeout: 30_000,
    navigationTimeout: 30_000,
    launchOptions: {
      // VPS runs as root — chromium refuses to sandbox for root.
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    },
    contextOptions: { ignoreHTTPSErrors: true },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
