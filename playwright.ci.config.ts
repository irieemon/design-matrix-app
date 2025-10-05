import { defineConfig } from '@playwright/test';
import { baseConfig, browserProjects } from './playwright.base.config';

/**
 * CI-OPTIMIZED PLAYWRIGHT CONFIGURATION
 *
 * Optimized for SPEED and RELIABILITY in GitHub Actions
 *
 * USE FOR:
 * - GitHub Actions workflows
 * - CI/CD pipelines
 * - Pre-merge validation
 * - Automated testing
 *
 * CI-SPECIFIC OPTIMIZATIONS:
 * - Test sharding across multiple jobs
 * - Parallel execution within jobs
 * - Minimal artifact collection
 * - Fast failure detection
 * - Retry logic for flaky infrastructure
 * - Resource-aware worker configuration
 */

/**
 * CI Environment Detection
 * Playwright automatically sets CI=true in GitHub Actions
 */
const IS_CI = !!process.env.CI;

/**
 * Test Sharding Configuration
 * Split tests across multiple CI jobs for parallel execution
 *
 * USAGE IN GITHUB ACTIONS:
 * strategy:
 *   matrix:
 *     shard: [1, 2, 3, 4]
 * run: npx playwright test --shard=${{ matrix.shard }}/4
 */
const SHARD_INDEX = process.env.SHARD_INDEX ? parseInt(process.env.SHARD_INDEX) : undefined;
const SHARD_TOTAL = process.env.SHARD_TOTAL ? parseInt(process.env.SHARD_TOTAL) : undefined;

export default defineConfig({
  ...baseConfig,

  // ============================================================================
  // TEST SELECTION
  // ============================================================================

  /**
   * Test all functional tests in CI
   * Exclude performance and visual tests (separate jobs)
   */
  testDir: './tests',

  testMatch: [
    'tests/e2e/**/*.spec.ts',
    'tests/integration/**/*.spec.ts',
    'tests/functional/**/*.spec.ts',
    'tests/auth/**/*.spec.ts',
    'tests/*.spec.ts',
  ],

  testIgnore: [
    '**/*performance*.spec.ts',
    '**/*visual*.spec.ts',
    '**/*benchmark*.spec.ts',
  ],

  // ============================================================================
  // PARALLELIZATION: OPTIMIZED FOR GITHUB ACTIONS
  // ============================================================================

  /**
   * fullyParallel: true
   * Maximize parallelization within each CI job
   */
  fullyParallel: true,

  /**
   * Workers: 2 (GitHub Actions standard runners)
   *
   * REASONING:
   * - GitHub Actions standard runners: 2 cores, 7GB RAM
   * - Larger runners: 4 cores (need to update if using larger runners)
   * - Workers = cores for I/O-bound tests
   *
   * OVERRIDE for larger runners:
   * WORKERS=4 npx playwright test --config playwright.ci.config.ts
   */
  workers: process.env.WORKERS ? parseInt(process.env.WORKERS) : 2,

  // ============================================================================
  // BROWSER PROJECTS: CHROMIUM ONLY BY DEFAULT
  // ============================================================================

  /**
   * Default: Chromium only for speed
   *
   * STRATEGY:
   * - Main CI job: Chromium only (fast feedback)
   * - Separate CI jobs: Cross-browser testing
   *
   * GitHub Actions matrix strategy:
   * strategy:
   *   matrix:
   *     browser: [chromium, firefox, webkit]
   * run: npx playwright test --project=${{ matrix.browser }}
   */
  projects: [browserProjects.chromium],

  // ============================================================================
  // TIMEOUT CONFIGURATION: FAIL FAST
  // ============================================================================

  /**
   * Test timeout: 30s
   * REASONING:
   * - CI should fail fast on hanging tests
   * - Network in CI is usually fast
   * - Slower tests indicate real issues
   */
  timeout: 30 * 1000,

  /**
   * Global timeout: 30 minutes
   * Maximum time for entire test suite
   * Prevents runaway CI jobs
   */
  globalTimeout: 30 * 60 * 1000,

  /**
   * Retries: 2
   * Account for flaky CI infrastructure
   *
   * REASONING:
   * - CI network can be unreliable
   * - GitHub Actions runners can be slow on cold start
   * - 2 retries catches transient issues
   * - Still fails if test is truly broken
   *
   * MONITORING:
   * - Track retry rate in CI
   * - If retry rate > 10%, investigate flaky tests
   */
  retries: 2,

  /**
   * Reporter optimization for CI
   *
   * STRATEGY:
   * - Minimal console output (reduce log size)
   * - JSON/JUnit for integration (GitHub Actions annotations)
   * - HTML report (uploaded as artifact)
   *
   * GITHUB ACTIONS INTEGRATION:
   * - JUnit: Automatic test annotations on PR
   * - JSON: Programmatic analysis, trend tracking
   * - HTML: Upload as artifact for debugging
   */
  reporter: [
    // Minimal console output
    ['list', { printSteps: false }],

    // GitHub Actions annotations
    ['github'],

    // Test results for integration
    ['json', {
      outputFile: 'test-results/results.json',
    }],

    // JUnit for GitHub Actions test reporting
    ['junit', {
      outputFile: 'test-results/junit.xml',
      embedAnnotationsAsProperties: true,
      embedAttachmentsAsProperty: 'attachments',
    }],

    // HTML report for debugging
    ['html', {
      open: 'never',
      outputFolder: 'playwright-report',
    }],
  ],

  /**
   * Action/Navigation timeouts and artifact collection
   * Slightly more generous than local (account for CI cold start)
   */
  use: {
    ...baseConfig.use,
    actionTimeout: 10 * 1000,
    navigationTimeout: 30 * 1000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  // ============================================================================
  // WEB SERVER: CI-SPECIFIC CONFIGURATION
  // ============================================================================

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3003',
    reuseExistingServer: false,       // Always start fresh in CI
    timeout: 120 * 1000,              // 2 minutes to start (CI cold start)
    stdout: 'ignore',                 // Reduce log noise
    stderr: 'pipe',                   // Show errors

    /**
     * Environment variables for CI
     * Optimize dev server for CI environment
     */
    env: {
      NODE_ENV: 'test',
      CI: 'true',
    },
  },

  // ============================================================================
  // TEST SHARDING
  // ============================================================================

  /**
   * Test sharding configuration
   * Set via environment variables in GitHub Actions
   *
   * USAGE:
   * SHARD_INDEX=1 SHARD_TOTAL=4 npx playwright test
   *
   * IMPACT:
   * - 4 shards = 4x faster (4 parallel CI jobs)
   * - Each job runs 1/4 of tests
   * - Results merged by GitHub Actions
   */
  shard: SHARD_INDEX && SHARD_TOTAL
    ? { current: SHARD_INDEX, total: SHARD_TOTAL }
    : undefined,

  // ============================================================================
  // FAIL FAST CONFIGURATION
  // ============================================================================

  /**
   * Max failures before stopping
   * Fail fast on widespread breakage
   *
   * REASONING:
   * - If 10 tests fail, likely a fundamental issue
   * - Stop early to save CI minutes
   * - Still see enough failures to diagnose
   *
   * DISABLE for comprehensive test runs:
   * npx playwright test --max-failures=0
   */
  maxFailures: process.env.MAX_FAILURES
    ? parseInt(process.env.MAX_FAILURES)
    : 10,

  // ============================================================================
  // CI PERFORMANCE MONITORING
  // ============================================================================

  /**
   * GITHUB ACTIONS INTEGRATION:
   *
   * 1. Test Results Annotation:
   *    - JUnit reporter creates GitHub annotations
   *    - Failed tests shown directly on PR
   *
   * 2. Artifact Upload:
   *    - Upload HTML report as artifact
   *    - Upload screenshots/videos on failure
   *    - Upload traces on failure
   *
   * 3. Test Sharding:
   *    - Split tests across multiple jobs
   *    - Combine results in final step
   *
   * 4. Caching:
   *    - Cache npm dependencies
   *    - Cache Playwright browsers
   *
   * See .github/workflows/playwright.yml for implementation
   */

  // ============================================================================
  // METADATA
  // ============================================================================

  metadata: {
    type: 'ci',
    optimizedFor: 'speed and reliability',
    environment: 'GitHub Actions',
    runner: 'ubuntu-latest (2 cores, 7GB RAM)',
    parallelization: 'full within job, sharding across jobs',
    retries: 2,
    failFast: true,
    artifactStrategy: 'minimal (failures only)',
  },
});
