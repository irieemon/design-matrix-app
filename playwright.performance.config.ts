import { defineConfig } from '@playwright/test';
import { baseConfig, performanceChromium } from './playwright.base.config';

/**
 * PERFORMANCE TESTING CONFIGURATION
 *
 * Optimized for ACCURACY and CONSISTENCY
 *
 * USE FOR:
 * - Performance benchmarks
 * - Core Web Vitals measurement
 * - Memory leak detection
 * - Network performance testing
 * - Frame rate monitoring
 * - Load time analysis
 *
 * DO NOT USE FOR:
 * - Functional tests (use playwright.functional.config.ts)
 * - Visual regression (use playwright.visual.config.ts)
 *
 * PERFORMANCE MEASUREMENT PRINCIPLES:
 * - Sequential execution (no parallelization)
 * - Single worker (no resource contention)
 * - Chromium only (consistent performance baseline)
 * - Extended timeouts (perf tests can be slow)
 * - Minimal interference (no videos, limited screenshots)
 */

const IS_CI = !!process.env.CI;

export default defineConfig({
  ...baseConfig,

  // ============================================================================
  // TEST SELECTION
  // ============================================================================

  /**
   * Test directory for performance tests
   */
  testDir: './tests',

  /**
   * Test pattern matching
   * Match performance-related test files
   */
  testMatch: [
    '**/*performance*.spec.ts',
    '**/*benchmark*.spec.ts',
    'tests/e2e/performance-*.spec.ts',
    'tests/matrix/matrix-performance-*.spec.ts',
  ],

  // ============================================================================
  // SEQUENTIAL EXECUTION: CRITICAL FOR ACCURACY
  // ============================================================================

  /**
   * fullyParallel: false
   * Run tests sequentially for accurate performance measurement
   *
   * REASONING:
   * - Parallel tests compete for CPU/memory/network
   * - Competition skews performance measurements
   * - Sequential execution = consistent baseline
   * - Accept slower test runs for accurate data
   */
  fullyParallel: false,

  /**
   * Workers: 1 (CRITICAL)
   * Single worker ensures no resource contention
   *
   * IMPACT:
   * - Consistent CPU availability
   * - Consistent memory availability
   * - Predictable network performance
   * - Reproducible results
   *
   * DO NOT CHANGE unless you understand the implications
   */
  workers: 1,

  // ============================================================================
  // BROWSER PROJECT: PERFORMANCE CHROMIUM
  // ============================================================================

  /**
   * Single browser: Performance-optimized Chromium
   *
   * REASONING:
   * - Performance tests need consistent baseline
   * - Chromium has best performance measurement APIs
   * - Cross-browser perf testing is separate concern
   *
   * Special flags enabled:
   * - --enable-precise-memory-info (memory leak detection)
   * - --disable-background-timer-throttling (consistent timing)
   * - --disable-backgrounding-occluded-windows (no throttling)
   * - --disable-renderer-backgrounding (consistent rendering)
   */
  projects: [performanceChromium],

  // ============================================================================
  // TIMEOUT CONFIGURATION
  // ============================================================================

  /**
   * Test timeout: 120s for performance tests
   * REASONING:
   * - Performance tests run longer (benchmarks, warm-up, multiple samples)
   * - Network throttling tests are inherently slow
   * - Memory leak detection requires multiple iterations
   *
   * OVERRIDE in test for specific benchmarks:
   * test.setTimeout(300000); // 5 minutes for extensive benchmarks
   */
  timeout: 120 * 1000,

  /**
   * Extended timeouts and minimal artifacts for performance testing
   */
  use: {
    ...baseConfig.use,
    actionTimeout: 20 * 1000,        // 20s for throttled actions
    navigationTimeout: 60 * 1000,    // 60s for throttled navigation
    video: 'off',                    // NEVER record video during perf tests
    screenshot: 'only-on-failure',   // Screenshots are cheap
    trace: 'on-first-retry',         // Traces only on failure
  },

  // ============================================================================
  // REPORTER CONFIGURATION
  // ============================================================================

  /**
   * Reporter optimization for performance tests
   * Include JSON for programmatic analysis of perf data
   */
  reporter: IS_CI
    ? [
        ['list', { printSteps: false }],
        ['json', { outputFile: 'test-results/performance-results.json' }],
        ['junit', { outputFile: 'test-results/performance-results.xml' }],
        ['html', {
          open: 'never',
          outputFolder: 'test-results/performance-report',
        }],
      ]
    : [
        ['list', { printSteps: true }],
        ['json', { outputFile: 'test-results/performance-results.json' }], // Local JSON for analysis
        ['html', {
          open: 'on-failure',
          outputFolder: 'test-results/performance-report',
        }],
      ],

  // ============================================================================
  // RETRY STRATEGY: NONE FOR PERFORMANCE
  // ============================================================================

  /**
   * Retries: 0 (even in CI)
   *
   * REASONING:
   * - Performance tests should be deterministic
   * - Retrying masks performance regressions
   * - Failing perf test indicates real issue
   * - Flaky perf tests need fixing, not retrying
   *
   * If performance tests fail in CI, investigate:
   * 1. Is CI environment consistent?
   * 2. Are performance budgets too strict?
   * 3. Is there a real performance regression?
   */
  retries: 0,

  // ============================================================================
  // PERFORMANCE TEST BEST PRACTICES
  // ============================================================================

  /**
   * BEST PRACTICES (enforce in tests):
   *
   * 1. WARM-UP:
   *    - Run operation 2-3 times before measuring
   *    - Discard first run (cold start)
   *    - Measure subsequent runs (warm cache)
   *
   * 2. MULTIPLE SAMPLES:
   *    - Take 5-10 measurements
   *    - Calculate median (not average)
   *    - Report p50, p95, p99
   *
   * 3. PERFORMANCE BUDGETS:
   *    - Set realistic thresholds
   *    - Allow 10-20% variance for CI
   *    - Document budget rationale
   *
   * 4. ISOLATION:
   *    - Clear state between tests
   *    - Avoid shared fixtures
   *    - Reset browser context
   *
   * 5. NETWORK CONDITIONS:
   *    - Test fast network (baseline)
   *    - Test slow 3G (worst case)
   *    - Test slow WiFi (common case)
   *
   * 6. CORE WEB VITALS:
   *    - LCP (Largest Contentful Paint) < 2.5s
   *    - FID (First Input Delay) < 100ms
   *    - CLS (Cumulative Layout Shift) < 0.1
   */

  // ============================================================================
  // METADATA
  // ============================================================================

  metadata: {
    type: 'performance',
    optimizedFor: 'accuracy',
    parallelization: 'none (sequential execution)',
    workers: 1,
    browsers: 'chromium-performance only',
    retries: 0,
    performanceBudgets: {
      LCP: '< 2.5s',
      FID: '< 100ms',
      CLS: '< 0.1',
      TTI: '< 3.8s',
      TBT: '< 200ms',
    },
  },
});
