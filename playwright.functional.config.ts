import { defineConfig } from '@playwright/test';
import { baseConfig, browserProjects } from './playwright.base.config';

/**
 * FUNCTIONAL TESTING CONFIGURATION
 *
 * Optimized for SPEED and PARALLELIZATION
 *
 * USE FOR:
 * - Integration tests
 * - Feature tests
 * - E2E user journeys
 * - Cross-browser compatibility tests
 * - Accessibility tests
 *
 * DO NOT USE FOR:
 * - Performance benchmarks (use playwright.performance.config.ts)
 * - Visual regression (use playwright.visual.config.ts)
 *
 * PERFORMANCE OPTIMIZATIONS:
 * - Maximum parallelization (fullyParallel: true)
 * - Multiple workers (CPU cores / 2)
 * - Chromium-only by default (add browsers via --project flag)
 * - Fast failure detection
 * - Minimal artifact collection
 */

const IS_CI = !!process.env.CI;

export default defineConfig({
  ...baseConfig,

  // ============================================================================
  // TEST SELECTION
  // ============================================================================

  /**
   * Test directory for functional tests
   * Includes: e2e/, integration/, functional/, auth/
   * Excludes: visual/, matrix/ (have separate configs)
   */
  testDir: './tests',

  /**
   * Test pattern matching
   * Match .spec.ts files in functional test directories
   */
  testMatch: [
    'tests/e2e/**/*.spec.ts',
    'tests/integration/**/*.spec.ts',
    'tests/functional/**/*.spec.ts',
    'tests/auth/**/*.spec.ts',
    'tests/*.spec.ts', // Root level tests
  ],

  /**
   * Ignore performance and visual tests
   * These have dedicated configs
   */
  testIgnore: [
    '**/*performance*.spec.ts',
    '**/*visual*.spec.ts',
    '**/*benchmark*.spec.ts',
    'tests/matrix/**',
    'tests/visual/**',
  ],

  // ============================================================================
  // PARALLELIZATION: MAXIMUM SPEED
  // ============================================================================

  /**
   * fullyParallel: true
   * Run all tests in parallel, even within a single file
   * IMPACT: 3-5x faster test execution
   */
  fullyParallel: true,

  /**
   * Workers: Maximize parallelization
   * - Local: undefined = auto-detect (typically CPU cores / 2)
   * - CI: 4 (higher than base config for functional tests)
   *
   * REASONING:
   * - Functional tests are I/O bound (network, rendering)
   * - More workers = better CPU utilization
   * - GitHub Actions runners have 2-4 cores
   *
   * OVERRIDE: Set WORKERS env var for custom worker count
   * Example: WORKERS=8 npm run test:functional
   */
  workers: process.env.WORKERS
    ? parseInt(process.env.WORKERS)
    : IS_CI
    ? 4
    : undefined,

  // ============================================================================
  // BROWSER PROJECTS: SMART DEFAULTS
  // ============================================================================

  /**
   * Default: Chromium only for speed
   *
   * STRATEGY:
   * - Local development: Test in Chromium only (90% of bugs)
   * - CI: Test cross-browser via separate jobs
   *
   * Run specific browsers:
   * - npx playwright test --project=firefox
   * - npx playwright test --project=webkit
   * - npx playwright test --project=mobile-chrome
   *
   * Run all browsers:
   * - npx playwright test --project=chromium --project=firefox --project=webkit
   */
  projects: [
    // Primary browser: Chromium
    browserProjects.chromium,

    // Uncomment for local cross-browser testing
    // browserProjects.firefox,
    // browserProjects.webkit,

    // Mobile browsers (on-demand via --project flag)
    // browserProjects.mobileChrome,
    // browserProjects.mobileSafari,
  ],

  // ============================================================================
  // TIMEOUT OPTIMIZATION
  // ============================================================================

  /**
   * Test timeout: 30s for functional tests
   * REASONING:
   * - Functional tests should be fast
   * - 30s catches hanging tests quickly
   * - Slower than unit tests, faster than performance tests
   *
   * OVERRIDE in test file for slow tests:
   * test.setTimeout(60000);
   */
  timeout: 30 * 1000,

  /**
   * Action timeout: 8s
   * Faster than base config (10s) for quick failure detection
   */
  use: {
    ...baseConfig.use,
    actionTimeout: 8 * 1000,
  },

  // ============================================================================
  // REPORTER OPTIMIZATION
  // ============================================================================

  /**
   * Reporter optimization for functional tests
   * - CI: Minimal output for speed
   * - Local: Rich output for debugging
   */
  reporter: IS_CI
    ? [
        // CI: Fast, compact reporting
        ['list', { printSteps: false }],
        ['json', { outputFile: 'test-results/functional-results.json' }],
        ['junit', { outputFile: 'test-results/functional-results.xml' }],
        ['html', { open: 'never', outputFolder: 'test-results/functional-report' }],
      ]
    : [
        // Local: Rich, interactive reporting
        ['list', { printSteps: true }],
        ['html', { open: 'on-failure', outputFolder: 'test-results/functional-report' }],
      ],

  // ============================================================================
  // RETRY STRATEGY
  // ============================================================================

  /**
   * Retry configuration for functional tests
   * - Local: 0 retries (fail fast)
   * - CI: 1 retry (less than base config's 2)
   *
   * REASONING:
   * - Functional tests should be stable
   * - 1 retry catches transient network issues
   * - 2+ retries hide flaky tests
   */
  retries: IS_CI ? 1 : 0,

  // ============================================================================
  // ARTIFACT COLLECTION
  // ============================================================================

  /**
   * Minimal artifact collection for speed
   * Override in baseConfig.use
   */
  // Already configured in baseConfig

  // ============================================================================
  // TEST SHARDING FOR CI
  // ============================================================================

  /**
   * Test sharding: Split tests across multiple CI jobs
   *
   * USAGE IN GITHUB ACTIONS:
   * strategy:
   *   matrix:
   *     shard: [1, 2, 3, 4]
   * run: npx playwright test --shard=${{ matrix.shard }}/4
   *
   * IMPACT:
   * - 4 shards = 4x faster CI (parallel jobs)
   * - Each shard runs 1/4 of tests
   * - Results combined in CI
   */
  // No config needed here, controlled via CLI flag

  // ============================================================================
  // METADATA
  // ============================================================================

  metadata: {
    type: 'functional',
    optimizedFor: 'speed',
    parallelization: 'maximum',
    browsers: 'chromium (default), others via --project flag',
    ciOptimized: true,
  },
});
