import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/auth',
  fullyParallel: false, // Run sequentially for debugging
  forbidOnly: !!process.env.CI,
  retries: 0, // No retries for debugging
  workers: 1, // Single worker for debugging

  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'], // Console output
    ['json', { outputFile: 'test-results/auth-results.json' }]
  ],

  use: {
    baseURL: 'http://localhost:3004',
    trace: 'on',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 30 * 1000,
    navigationTimeout: 60 * 1000,
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 }
      },
    }
  ],

  // Don't start dev server, assume it's already running
  webServer: undefined,

  expect: {
    timeout: 15 * 1000,
  }
});