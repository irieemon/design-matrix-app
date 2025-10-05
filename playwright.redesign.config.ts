import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for Card Redesign Visual Testing
 *
 * Optimized for:
 * - Visual regression testing
 * - Screenshot comparison
 * - Dimension validation
 * - Cross-browser testing
 */

export default defineConfig({
  testDir: './tests/visual',
  testMatch: '**/*.spec.ts',

  fullyParallel: false, // Sequential for consistent screenshots
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker for visual consistency

  reporter: [
    ['html', { outputFolder: 'playwright-report/redesign' }],
    ['json', { outputFile: 'test-results/redesign-results.json' }],
    ['list']
  ],

  use: {
    baseURL: 'http://localhost:3005',
    trace: 'on-first-retry',
    screenshot: 'on',
    video: 'retain-on-failure',

    // Visual testing settings
    actionTimeout: 10000,
    navigationTimeout: 30000,

    // Viewport for consistent screenshots
    viewport: { width: 1920, height: 1080 },
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3005',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});