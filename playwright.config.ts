import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './automation/tests',
  timeout: 30_000,
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    headless: true,
  },
  webServer: {
    command: 'node demo-app/server.js',
    port: 4173,
    reuseExistingServer: !process.env.CI,
  },
});
