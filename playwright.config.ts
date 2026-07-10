import { defineConfig } from '@playwright/test';

// 실행 대상 사이트.
// - 기본값(설정 없음): lomastore.com 실제 운영 사이트
// - DEMO=1 환경변수: 로컬 demo-app(뼈대 시연용 가짜 로그인 화면)을 띄워서 실행
//   예) DEMO=1 npx playwright test testcases/login 대응 러너 확인용
const isDemo = process.env.DEMO === '1';

export default defineConfig({
  testDir: './automation/tests',
  timeout: 30_000,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: isDemo ? 'http://localhost:4173' : 'https://lomastore.com',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  ...(isDemo
    ? {
        webServer: {
          command: 'node demo-app/server.js',
          port: 4173,
          reuseExistingServer: !process.env.CI,
        },
      }
    : {}),
});
