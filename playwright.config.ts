import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './automation/tests',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['json', { outputFile: process.env.PLAYWRIGHT_JSON_OUTPUT_FILE ?? 'test-results/results.json' }],
  ],
  use: {
    baseURL: process.env.BASE_URL ?? 'https://lomastore.com',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
