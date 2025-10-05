import { defineConfig, devices } from '@playwright/test';

/**
 * Matrix-specific Playwright configuration
 * Optimized for matrix validation testing with performance monitoring
 */
export default defineConfig({
  testDir: './tests/matrix',

  /* Test matching */
  testMatch: ['**/*.spec.ts'],

  /* Run tests in files in parallel */
  fullyParallel: true,

  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 1,

  /* Opt out of parallel tests on CI for stability */
  workers: process.env.CI ? 1 : 2,

  /* Reporter configuration for matrix tests */
  reporter: [
    ['html', { outputFolder: 'test-results/matrix-html-report' }],
    ['json', { outputFile: 'test-results/matrix-results.json' }],
    ['junit', { outputFile: 'test-results/matrix-results.xml' }],
    ['list']
  ],

  /* Shared settings for all matrix tests */
  use: {
    /* Base URL */
    baseURL: 'http://localhost:3001',

    /* Collect trace when retrying failed tests */
    trace: 'retain-on-failure',

    /* Screenshot on failure */
    screenshot: 'only-on-failure',

    /* Video recording for debugging */
    video: 'retain-on-failure',

    /* Timeouts optimized for matrix testing */
    actionTimeout: 15 * 1000,
    navigationTimeout: 30 * 1000,

    /* Extra HTTP headers for testing */
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
    },
  },

  /* Configure projects for matrix testing */
  projects: [
    {
      name: 'matrix-chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 }, // Optimal for matrix layout

        /* Enable performance monitoring */
        launchOptions: {
          args: [
            '--enable-gpu',
            '--enable-accelerated-2d-canvas',
            '--enable-accelerated-compositing',
            '--disable-web-security', // For localhost testing
            '--no-sandbox' // For CI environments
          ]
        }
      },
      testMatch: ['**/*.spec.ts']
    },

    /* Performance testing on different browsers */
    {
      name: 'matrix-firefox-performance',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 1440, height: 900 }
      },
      testMatch: ['**/matrix-performance-*.spec.ts']
    },

    {
      name: 'matrix-webkit-performance',
      use: {
        ...devices['Desktop Safari'],
        viewport: { width: 1440, height: 900 }
      },
      testMatch: ['**/matrix-performance-*.spec.ts']
    },

    /* Mobile testing for responsive validation */
    {
      name: 'matrix-mobile-chrome',
      use: {
        ...devices['Pixel 5'],
      },
      testMatch: ['**/matrix-visual-*.spec.ts', '**/matrix-comprehensive-*.spec.ts']
    },

    {
      name: 'matrix-mobile-safari',
      use: {
        ...devices['iPhone 12'],
      },
      testMatch: ['**/matrix-visual-*.spec.ts', '**/matrix-comprehensive-*.spec.ts']
    },

    /* Tablet testing */
    {
      name: 'matrix-tablet-chrome',
      use: {
        ...devices['iPad Pro'],
      },
      testMatch: ['**/matrix-visual-*.spec.ts']
    }
  ],

  /* Run local dev server before tests */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3001',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    stdout: 'ignore',
    stderr: 'pipe',
  },

  /* Test expectations */
  expect: {
    /* Assertion timeout */
    timeout: 10 * 1000,

    /* Visual comparison settings */
    toHaveScreenshot: {
      threshold: 0.15, // Slightly more lenient for cross-browser consistency
      mode: 'actual',
      animations: 'disabled' // Consistent screenshots
    },

    toMatchSnapshot: {
      threshold: 0.15,
      animations: 'disabled'
    }
  },

  /* Global test timeout */
  timeout: 60 * 1000,

  /* Metadata for reporting */
  metadata: {
    purpose: 'Matrix Comprehensive Validation',
    criticalIssues: [
      'React Component Crashes',
      'Performance Crisis (hover lag, frame drops)',
      'UI Layout Issues (card states, edit buttons)',
      'Interactive Behavior',
      'User Journey Testing'
    ],
    performanceThresholds: {
      hoverResponseMs: 16,
      minFrameRate: 58,
      maxLayoutShift: 0.1
    }
  }
});