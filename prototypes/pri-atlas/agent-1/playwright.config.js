import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  reporter: [['list']],
  timeout: 30000,
  use: { baseURL: 'http://127.0.0.1:4391', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], channel: 'chrome' } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:4391',
    reuseExistingServer: true,
    timeout: 30000
  }
});
