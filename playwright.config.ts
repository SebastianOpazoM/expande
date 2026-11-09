import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:3099', trace: 'retain-on-failure' },
  webServer: {
    command: 'node --experimental-transform-types server/index.ts',
    url: 'http://127.0.0.1:3099/api/health',
    reuseExistingServer: false,
    env: {
      PORT: '3099',
      HOST: '127.0.0.1',
      DATABASE_PATH: './.local/e2e.sqlite',
      NODE_ENV: 'test',
      DEMO_ACCESS_PASSWORD: '',
      COOKIE_SECRET: 'test-cookie-secret-at-least-32-characters',
    },
  },
});
