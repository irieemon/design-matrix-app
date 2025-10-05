import { defineConfig } from '@playwright/test';
import { baseConfig, browserProjects } from './playwright.base.config';

/**
 * VISUAL REGRESSION TESTING CONFIGURATION
 *
 * Optimized for CONSISTENCY and PIXEL-PERFECT COMPARISON
 *
 * USE FOR:
 * - Screenshot comparison
 * - Visual regression detection
 * - Design system validation
 * - Cross-browser rendering
 * - Responsive design testing
 *
 * DO NOT USE FOR:
 * - Functional tests (use playwright.functional.config.ts)
 * - Performance tests (use playwright.performance.config.ts)
 *
 * VISUAL TESTING PRINCIPLES:
 * - Sequential execution (consistent rendering)
 * - Single worker (no GPU contention)
 * - Animations disabled (stable screenshots)
 * - Consistent viewport (reproducible captures)
 * - Lenient thresholds (account for font rendering differences)
 */

const IS_CI = !!process.env.CI;
const UPDATE_SNAPSHOTS = !!process.env.UPDATE_SNAPSHOTS;

export default defineConfig({
  ...baseConfig,

  // ============================================================================
  // TEST SELECTION
  // ============================================================================

  /**
   * Test directory for visual tests
   */
  testDir: './tests',

  /**
   * Test pattern matching
   * Match visual regression test files
   */
  testMatch: [
    '**/*visual*.spec.ts',
    '**/*regression*.spec.ts',
    'tests/visual/**/*.spec.ts',
    'tests/e2e/visual-*.spec.ts',
  ],

  /**
   * Ignore performance tests
   */
  testIgnore: [
    '**/*performance*.spec.ts',
    '**/*benchmark*.spec.ts',
  ],

  // ============================================================================
  // SEQUENTIAL EXECUTION: CRITICAL FOR CONSISTENCY
  // ============================================================================

  /**
   * fullyParallel: false
   * Run visual tests sequentially for consistent rendering
   *
   * REASONING:
   * - Parallel GPU usage causes rendering variations
   * - Screenshot timing must be precise
   * - System load affects rendering performance
   * - Sequential execution = reproducible screenshots
   */
  fullyParallel: false,

  /**
   * Workers: 1 (CRITICAL)
   * Single worker ensures consistent GPU/rendering state
   *
   * IMPACT:
   * - No GPU contention
   * - Consistent font rendering
   * - Stable animation timing
   * - Reproducible pixel output
   */
  workers: 1,

  // ============================================================================
  // BROWSER PROJECTS: CROSS-BROWSER VISUAL TESTING
  // ============================================================================

  /**
   * Browser selection for visual testing
   *
   * STRATEGY:
   * - Test all browsers (rendering engines differ significantly)
   * - Use consistent viewport sizes
   * - Disable animations for stable captures
   *
   * OVERRIDE for faster local testing:
   * npx playwright test --project=chromium
   */
  projects: [
    // Desktop browsers
    {
      ...browserProjects.chromium,
      use: {
        ...browserProjects.chromium.use,
        // Visual-specific Chromium settings
        launchOptions: {
          args: [
            '--font-render-hinting=none',         // Consistent font rendering
            '--disable-lcd-text',                 // Avoid subpixel rendering
            '--disable-font-subpixel-positioning',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
          ],
        },
      },
    },

    // Firefox (different rendering engine)
    {
      ...browserProjects.firefox,
      use: {
        ...browserProjects.firefox.use,
        launchOptions: {
          firefoxUserPrefs: {
            'ui.prefersReducedMotion': 1,         // Disable animations
            'gfx.webrender.all': true,            // Consistent rendering
          },
        },
      },
    },

    // WebKit (Safari rendering)
    browserProjects.webkit,

    // Mobile browsers (responsive testing)
    browserProjects.mobileChrome,
    browserProjects.mobileSafari,

    // Tablet
    browserProjects.tablet,
  ],

  // ============================================================================
  // TIMEOUT CONFIGURATION
  // ============================================================================

  /**
   * Test timeout: 60s for visual tests
   * REASONING:
   * - Screenshot comparison is fast
   * - But allow time for page stabilization
   * - Complex pages may need animations to complete
   */
  timeout: 60 * 1000,

  /**
   * Visual comparison configuration and browser context
   */
  expect: {
    timeout: 10 * 1000,

    /**
     * Screenshot comparison thresholds
     *
     * CRITICAL TUNING:
     * - threshold: Percentage of pixels that can differ (0.0 - 1.0)
     * - maxDiffPixels: Absolute number of pixels that can differ
     *
     * REASONING:
     * - Font rendering varies across OS/browsers (anti-aliasing)
     * - Subpixel rendering causes minor differences
     * - Threshold 0.15 (15%) is lenient but catches real regressions
     * - maxDiffPixels catches small UI element changes
     *
     * TUNING GUIDELINES:
     * - Too strict (< 0.05): False positives from font rendering
     * - Too lenient (> 0.25): Misses real visual bugs
     * - Adjust per test if needed: expect(page).toHaveScreenshot({ threshold: 0.05 })
     */
    toHaveScreenshot: {
      threshold: 0.15,                // 15% pixel difference allowed
      maxDiffPixels: 1000,            // Max 1000 pixels different
      animations: 'disabled',         // CRITICAL: Disable CSS animations
      scale: 'css',                   // Use CSS pixels (not device pixels)
    },

    toMatchSnapshot: {
      threshold: 0.15,
      maxDiffPixelRatio: 0.15,
    },
  },

  /**
   * Browser context settings for visual consistency
   */
  use: {
    ...baseConfig.use,
    navigationTimeout: 30 * 1000,
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
    colorScheme: 'light',
    video: 'off',
    screenshot: UPDATE_SNAPSHOTS ? 'on' : 'only-on-failure',
    timezoneId: 'America/Los_Angeles',
    locale: 'en-US',
  },

  // ============================================================================
  // REPORTER CONFIGURATION
  // ============================================================================

  reporter: IS_CI
    ? [
        ['list', { printSteps: false }],
        ['json', { outputFile: 'test-results/visual-results.json' }],
        ['junit', { outputFile: 'test-results/visual-results.xml' }],
        ['html', {
          open: 'never',
          outputFolder: 'test-results/visual-report',
        }],
      ]
    : [
        ['list', { printSteps: true }],
        ['html', {
          open: 'on-failure',
          outputFolder: 'test-results/visual-report',
        }],
      ],

  // ============================================================================
  // RETRY STRATEGY
  // ============================================================================

  /**
   * Retries: 0 (even in CI)
   *
   * REASONING:
   * - Visual tests should be deterministic
   * - Retry hides rendering inconsistencies
   * - Failing visual test = investigate, don't retry
   *
   * If visual tests fail:
   * 1. Check if real visual regression
   * 2. Check if threshold too strict
   * 3. Update baseline if intentional change
   */
  retries: 0,

  // ============================================================================
  // SNAPSHOT PATH CONFIGURATION
  // ============================================================================

  /**
   * Snapshot path strategy
   * Store snapshots separately per browser/platform
   *
   * Path format: tests/visual/__snapshots__/{testFile}/{platform}/{browser}/snapshot.png
   */
  snapshotPathTemplate: '{testDir}/__snapshots__/{testFilePath}/{arg}{-projectName}{ext}',

  // ============================================================================
  // UPDATE BASELINE MODE
  // ============================================================================

  /**
   * Update snapshots mode
   * Set UPDATE_SNAPSHOTS=true to update all baselines
   *
   * USAGE:
   * UPDATE_SNAPSHOTS=true npx playwright test --config playwright.visual-regression.config.ts
   *
   * WARNING: Review all changes before committing updated snapshots
   */
  updateSnapshots: UPDATE_SNAPSHOTS ? 'all' : 'missing',

  // ============================================================================
  // VISUAL TESTING BEST PRACTICES
  // ============================================================================

  /**
   * BEST PRACTICES (enforce in tests):
   *
   * 1. WAIT FOR STABILITY:
   *    - await page.waitForLoadState('networkidle')
   *    - await page.waitForTimeout(500) // Allow animations to complete
   *    - await expect(page.locator('selector')).toBeVisible()
   *
   * 2. HIDE DYNAMIC CONTENT:
   *    - Mask timestamps, user-specific data
   *    - await page.addStyleTag({ content: '.timestamp { display: none }' })
   *
   * 3. CONSISTENT VIEWPORT:
   *    - Don't resize viewport in tests
   *    - Create separate tests for responsive views
   *
   * 4. BASELINE MANAGEMENT:
   *    - Review visual diff before updating baselines
   *    - Document intentional visual changes
   *    - Use descriptive snapshot names
   *
   * 5. CROSS-BROWSER DIFFERENCES:
   *    - Accept minor font rendering differences
   *    - Use lenient thresholds (0.1 - 0.2)
   *    - Investigate large differences (> 0.3)
   *
   * 6. ANIMATION HANDLING:
   *    - Disable CSS animations in test
   *    - Use reducedMotion: 'reduce'
   *    - Or wait for animations: await page.waitForTimeout(500)
   */

  // ============================================================================
  // METADATA
  // ============================================================================

  metadata: {
    type: 'visual-regression',
    optimizedFor: 'consistency',
    parallelization: 'none (sequential execution)',
    workers: 1,
    browsers: 'all (chromium, firefox, webkit, mobile)',
    snapshotThreshold: '15%',
    updateMode: UPDATE_SNAPSHOTS ? 'update-all' : 'missing-only',
  },
});
