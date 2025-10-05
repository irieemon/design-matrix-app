import { defineConfig, devices, PlaywrightTestConfig } from '@playwright/test';

/**
 * BASE PLAYWRIGHT CONFIGURATION
 *
 * Shared configuration for all Playwright test suites.
 * Extended by specific configs: functional, performance, visual, ci
 *
 * OPTIMIZATION PRINCIPLES:
 * - DRY: All common settings in one place
 * - Flexibility: Environment-aware settings via process.env
 * - Performance: Optimized for both local development and CI
 * - Reliability: Conservative defaults, override where needed
 */

// ============================================================================
// ENVIRONMENT DETECTION
// ============================================================================

const IS_CI = !!process.env.CI;
const IS_DEBUG = !!process.env.DEBUG;
const IS_LOCAL = !IS_CI;

// ============================================================================
// PORT CONFIGURATION
// ============================================================================

/**
 * CRITICAL: Use consistent port across all test configs
 * Previous issue: Different configs used ports 3001, 3003, 3005, 5173
 * Solution: Single source of truth for port configuration
 */
const TEST_PORT = process.env.TEST_PORT ? parseInt(process.env.TEST_PORT) : 3003;
const BASE_URL = process.env.BASE_URL || `http://localhost:${TEST_PORT}`;

// ============================================================================
// BROWSER CONFIGURATIONS
// ============================================================================

/**
 * Reusable browser project configurations
 * Used by extending configs to maintain consistency
 */
export const browserProjects = {
  // Primary browser for most testing
  chromium: {
    name: 'chromium',
    use: {
      ...devices['Desktop Chrome'],
      viewport: { width: 1440, height: 900 },
      // Chromium performance optimizations
      launchOptions: {
        args: [
          '--disable-dev-shm-usage',           // Prevent /dev/shm resource exhaustion
          '--disable-blink-features=AutomationControlled', // Avoid detection as automated
          '--disable-background-timer-throttling', // Consistent timing
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
        ],
      },
    },
  },

  // Firefox cross-browser testing
  firefox: {
    name: 'firefox',
    use: {
      ...devices['Desktop Firefox'],
      viewport: { width: 1440, height: 900 },
    },
  },

  // WebKit/Safari cross-browser testing
  webkit: {
    name: 'webkit',
    use: {
      ...devices['Desktop Safari'],
      viewport: { width: 1440, height: 900 },
    },
  },

  // Mobile Chrome testing
  mobileChrome: {
    name: 'mobile-chrome',
    use: {
      ...devices['Pixel 5'],
    },
  },

  // Mobile Safari testing
  mobileSafari: {
    name: 'mobile-safari',
    use: {
      ...devices['iPhone 12'],
    },
  },

  // Tablet testing
  tablet: {
    name: 'tablet',
    use: {
      ...devices['iPad Pro'],
    },
  },
};

/**
 * Performance-optimized Chromium for performance benchmarking
 * Enables precise memory info and disables throttling
 */
export const performanceChromium = {
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
        '--disable-hang-monitor',
        '--disable-prompt-on-repost',
        '--no-first-run',
        '--disable-dev-shm-usage',
      ],
    },
  },
};

// ============================================================================
// SHARED BASE CONFIGURATION
// ============================================================================

export const baseConfig: PlaywrightTestConfig = {
  // Test directory - override in extending configs
  testDir: './tests',

  // -------------------------
  // TIMEOUT CONFIGURATION
  // -------------------------
  /**
   * Global test timeout: Maximum time a single test can run
   * - Local: 60s (generous for debugging)
   * - CI: 60s (same to catch real timeouts, not infra issues)
   */
  timeout: 60 * 1000,

  /**
   * Global setup timeout
   * Time allowed for globalSetup to complete
   */
  globalTimeout: 5 * 60 * 1000, // 5 minutes

  // -------------------------
  // PARALLELIZATION
  // -------------------------
  /**
   * fullyParallel: Run tests in parallel within a single file
   * - Default: true (override to false for performance tests)
   * - Dramatically speeds up test execution
   */
  fullyParallel: true,

  /**
   * Workers: Number of parallel worker processes
   * OPTIMIZATION STRATEGY:
   * - Local: undefined (Playwright auto-detects CPU cores, typically cores/2)
   * - CI: 2 (conservative for GitHub Actions runners with 2 cores)
   *
   * Override in specific configs:
   * - Performance tests: 1 (sequential for accurate measurements)
   * - Visual tests: 1 (consistent rendering)
   * - Functional tests: undefined/2+ (maximum parallelization)
   */
  workers: IS_CI ? 2 : undefined,

  // -------------------------
  // RETRY STRATEGY
  // -------------------------
  /**
   * Retries: Number of times to retry failed tests
   * - Local: 0 (fail fast for quick feedback)
   * - CI: 2 (account for flaky network/infrastructure)
   *
   * ANTI-PATTERN WARNING: High retry counts mask flaky tests
   * Better approach: Fix flaky tests, don't hide them
   */
  retries: IS_CI ? 2 : 0,

  // -------------------------
  // TEST QUALITY ENFORCEMENT
  // -------------------------
  /**
   * Fail build if test.only is accidentally committed
   * Prevents incomplete test runs in CI
   */
  forbidOnly: IS_CI,

  // -------------------------
  // REPORTER CONFIGURATION
  // -------------------------
  /**
   * Reporter optimization:
   * - Local: Rich HTML report for debugging
   * - CI: Compact list + JSON/JUnit for integration
   *
   * PERFORMANCE: Minimal console output reduces CI log size
   */
  reporter: IS_CI
    ? [
        ['list', { printSteps: false }],         // Compact console output
        ['json', { outputFile: 'test-results/results.json' }],
        ['junit', { outputFile: 'test-results/results.xml' }],
        ['html', { open: 'never', outputFolder: 'test-results/html-report' }],
      ]
    : [
        ['list', { printSteps: true }],          // Verbose local output
        ['html', { open: 'on-failure', outputFolder: 'test-results/html-report' }],
      ],

  // -------------------------
  // SHARED TEST SETTINGS
  // -------------------------
  use: {
    /**
     * Base URL for all tests
     * Allows tests to use relative paths: await page.goto('/')
     */
    baseURL: BASE_URL,

    /**
     * Action timeout: Maximum time for a single action
     * Covers: click, fill, select, etc.
     * - 10s is sufficient for most actions
     * - Override in specific tests if needed
     */
    actionTimeout: 10 * 1000,

    /**
     * Navigation timeout: Maximum time for page navigation
     * Covers: goto, reload, waitForNavigation
     * - 30s accounts for slow networks and large pages
     * - CI environments may have variable network speeds
     */
    navigationTimeout: 30 * 1000,

    /**
     * Trace collection strategy
     * OPTIMIZATION: Only collect traces on retry to save disk space
     * - 'on-first-retry': Collect trace only when test fails first time
     * - Traces are expensive (disk space, performance)
     * - Only needed for debugging failures
     */
    trace: IS_DEBUG ? 'on' : 'on-first-retry',

    /**
     * Screenshot strategy
     * OPTIMIZATION: Only capture on failure to save disk space
     * - Screenshots are cheap compared to videos
     * - Essential for debugging visual issues
     */
    screenshot: 'only-on-failure',

    /**
     * Video recording strategy
     * OPTIMIZATION: Only record on failure to save disk space and time
     * - Videos are expensive (disk space, encoding time)
     * - 'retain-on-failure': Delete video if test passes
     * - CI: Always enabled for debugging
     * - Local: Off unless debugging
     */
    video: IS_CI ? 'retain-on-failure' : (IS_DEBUG ? 'on' : 'off'),

    /**
     * Browser context options
     * Shared across all tests for consistency
     */
    contextOptions: {
      // Ignore HTTPS errors for localhost testing
      ignoreHTTPSErrors: true,
    },
  },

  // -------------------------
  // EXPECTATION CONFIGURATION
  // -------------------------
  expect: {
    /**
     * Assertion timeout: Maximum time for expect() assertions
     * - 5s for most assertions (toBeVisible, toHaveText, etc.)
     * - Long enough for React re-renders
     * - Short enough to fail fast
     */
    timeout: 5 * 1000,

    /**
     * Visual comparison defaults
     * Override in visual test configs for stricter comparison
     */
    toHaveScreenshot: {
      threshold: 0.2,        // 20% pixel difference allowed
      maxDiffPixels: 100,    // Max 100 pixels different
    },
    toMatchSnapshot: {
      threshold: 0.2,
    },
  },

  // -------------------------
  // OUTPUT DIRECTORY
  // -------------------------
  /**
   * Where to put test artifacts (screenshots, videos, traces)
   * Centralized for easy cleanup
   */
  outputDir: 'test-results/artifacts',

  // -------------------------
  // WEB SERVER CONFIGURATION
  // -------------------------
  /**
   * Automatically start dev server before tests
   * OPTIMIZATION: Reuse existing server in local development
   * - Local: reuseExistingServer = true (faster iteration)
   * - CI: reuseExistingServer = false (clean state)
   */
  webServer: {
    command: 'npm run dev',
    url: BASE_URL,
    reuseExistingServer: IS_LOCAL,
    timeout: 120 * 1000,      // 2 minutes to start
    stdout: 'ignore',          // Reduce log noise
    stderr: 'pipe',            // Show errors
  },
};

/**
 * Default export: base configuration
 * Use this directly or extend in specific configs
 */
export default defineConfig(baseConfig);
