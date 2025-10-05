import { defineConfig, devices } from '@playwright/test';

/**
 * Enhanced Playwright Configuration for E2E Performance & Cross-Browser Testing
 *
 * Features:
 * - Network throttling configurations (3G, 4G, slow WiFi)
 * - Performance budgets enforcement
 * - Cross-browser testing (Chromium, Firefox, WebKit)
 * - Mobile device emulation (iOS, Android)
 * - Lighthouse CI integration ready
 * - Memory leak detection
 * - Core Web Vitals monitoring
 */

export default defineConfig({
  testDir: './tests/e2e',

  fullyParallel: false, // Sequential for accurate performance measurement

  forbidOnly: !!process.env.CI,

  retries: process.env.CI ? 2 : 0,

  workers: process.env.CI ? 1 : 2, // Limited workers for performance testing

  timeout: 60 * 1000, // 60 second timeout for performance tests

  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/e2e-results.json' }],
    ['junit', { outputFile: 'test-results/e2e-results.xml' }],
    ['list'],
  ],

  use: {
    baseURL: 'http://localhost:3003',

    trace: 'on-first-retry',

    screenshot: 'only-on-failure',

    video: process.env.CI ? 'retain-on-failure' : 'off',

    actionTimeout: 15 * 1000,
    navigationTimeout: 30 * 1000,

    // Collect performance metrics
    contextOptions: {
      recordVideo: process.env.RECORD_VIDEO ? {
        dir: 'test-results/videos/',
        size: { width: 1280, height: 720 }
      } : undefined,
    },
  },

  projects: [
    // Visual Regression Testing - Default Project
    {
      name: 'visual-regression',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
      testMatch: /visual-regression-comprehensive\.spec\.ts/,
    },

    // Desktop Browsers - Performance Testing
    {
      name: 'chromium-performance',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        launchOptions: {
          args: [
            '--enable-precise-memory-info',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
          ],
        },
      },
      testMatch: /performance-benchmarks-e2e\.spec\.ts/,
    },

    // Desktop Browsers - Cross-Browser Testing
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
      testMatch: /cross-browser-compatibility\.spec\.ts/,
    },

    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 1440, height: 900 },
      },
      testMatch: /cross-browser-compatibility\.spec\.ts/,
    },

    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        viewport: { width: 1440, height: 900 },
      },
      testMatch: /cross-browser-compatibility\.spec\.ts/,
    },

    // Mobile Browsers
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
      },
      testMatch: /cross-browser-compatibility\.spec\.ts/,
    },

    {
      name: 'mobile-safari',
      use: {
        ...devices['iPhone 12'],
      },
      testMatch: /cross-browser-compatibility\.spec\.ts/,
    },

    // Network Throttling Tests
    {
      name: 'chromium-3g',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        launchOptions: {
          args: [
            '--enable-precise-memory-info',
          ],
        },
        // 3G network simulation will be done via context.route in tests
      },
      testMatch: /.*PNP-001.*/, // Tests with 3G network tag
    },

    {
      name: 'chromium-slow-wifi',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        launchOptions: {
          args: [
            '--enable-precise-memory-info',
          ],
        },
      },
      testMatch: /.*PNP-002.*/, // Tests with slow WiFi tag
    },

    // High-end device testing
    {
      name: 'chromium-high-end',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 2560, height: 1440 },
        deviceScaleFactor: 2,
      },
      testMatch: /performance-benchmarks-e2e\.spec\.ts/,
    },

    // Low-end mobile device simulation
    {
      name: 'mobile-chrome-low-end',
      use: {
        ...devices['Pixel 5'],
        launchOptions: {
          args: [
            '--enable-precise-memory-info',
            '--disable-gpu',
            '--disable-dev-shm-usage',
          ],
        },
      },
      testMatch: /.*CBM-005.*/, // Mobile performance tests
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3003',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    stdout: 'ignore',
    stderr: 'pipe',
  },

  expect: {
    timeout: 10 * 1000,

    toHaveScreenshot: {
      threshold: 0.2,
      maxDiffPixels: 100,
    },

    toMatchSnapshot: {
      threshold: 0.2,
    },
  },

  // Global setup for performance monitoring
  // Temporarily disabled - runs before webServer starts causing timeout
  // globalSetup: './tests/e2e/global-setup-e2e.ts',
});
