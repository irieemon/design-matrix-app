/**
 * Centralized timeout constants for E2E tests
 * All values in milliseconds
 *
 * Based on E2E Wait Strategy Design v1.0
 * @see claudedocs/E2E_WAIT_STRATEGY_DESIGN.md
 */

const IS_CI = !!process.env.CI;
const CI_MULTIPLIER = 2;

/**
 * Base timeout values optimized for local and CI environments
 *
 * Usage guidelines:
 * - INSTANT: Element state checks, hover effects (100ms)
 * - ANIMATION: CSS animations, modal transitions (500ms)
 * - QUICK: DOM updates, form validation, route changes (1000ms)
 * - NORMAL: Form submissions, simple API calls (3000ms)
 * - SLOW: Complex API calls, file uploads (5000ms)
 * - NETWORK: AI operations, large data loads (10000ms)
 * - VERY_SLOW: AI analysis, audio transcription, batch operations (20000ms)
 */
export const TIMEOUTS = {
  /** Very fast operations (100ms) - Element state checks */
  INSTANT: 100,

  /** CSS animation duration (500ms) - Modal animations, transitions */
  ANIMATION: 500,

  /** Quick operations (1000ms) - DOM updates, form validation */
  QUICK: 1000,

  /** Normal operations (3000ms) - Form submissions, simple API calls */
  NORMAL: 3000,

  /** Slow operations (5000ms) - Complex API calls, file uploads */
  SLOW: 5000,

  /** Network operations (10000ms) - AI operations, large data loads */
  NETWORK: 10000,

  /** Very slow operations (20000ms) - AI analysis, batch operations */
  VERY_SLOW: 20000,

  /**
   * Get timeout value adjusted for CI environment
   *
   * @param baseTimeout - Base timeout value
   * @returns Timeout multiplied by CI_MULTIPLIER if in CI
   *
   * @example
   * ```typescript
   * // Local: 1000ms, CI: 2000ms
   * await expect(element).toBeVisible({ timeout: TIMEOUTS.ci(TIMEOUTS.QUICK) });
   * ```
   */
  ci: (baseTimeout: number): number => {
    return IS_CI ? baseTimeout * CI_MULTIPLIER : baseTimeout;
  }
} as const;

export type TimeoutKey = keyof Omit<typeof TIMEOUTS, 'ci'>;

/**
 * Operation-specific timeout configurations
 *
 * These provide semantic timeouts for specific operation types,
 * making test code more readable and maintainable.
 */
export const OPERATION_TIMEOUTS = {
  /** Authentication operation timeouts */
  auth: {
    /** Full login flow (5000ms) */
    login: TIMEOUTS.SLOW,
    /** Logout operation (3000ms) */
    logout: TIMEOUTS.NORMAL,
    /** Signup operation (5000ms) */
    signup: TIMEOUTS.SLOW,
    /** Demo user quick login (1000ms) */
    demoUser: TIMEOUTS.QUICK,
    /** Password reset (3000ms) */
    passwordReset: TIMEOUTS.NORMAL,
    /** Field validation (500ms) */
    validation: TIMEOUTS.ANIMATION
  },

  /** Modal operation timeouts */
  modal: {
    /** Modal open animation (500ms) */
    open: TIMEOUTS.ANIMATION,
    /** Modal close animation (500ms) */
    close: TIMEOUTS.ANIMATION,
    /** Modal form ready state (1000ms) */
    formReady: TIMEOUTS.QUICK,
    /** Modal form submission (3000ms) */
    submit: TIMEOUTS.NORMAL
  },

  /** Idea management operation timeouts */
  idea: {
    /** Create idea (3000ms) */
    create: TIMEOUTS.NORMAL,
    /** Update idea (3000ms) */
    update: TIMEOUTS.NORMAL,
    /** Delete idea (1000ms) */
    delete: TIMEOUTS.QUICK,
    /** Drag operation (5000ms) */
    drag: TIMEOUTS.SLOW,
    /** Load ideas (10000ms) */
    load: TIMEOUTS.NETWORK
  },

  /** Navigation operation timeouts */
  navigation: {
    /** Full page load (10000ms) */
    pageLoad: TIMEOUTS.NETWORK,
    /** SPA route change (1000ms) */
    routeChange: TIMEOUTS.QUICK,
    /** Network idle wait (10000ms) */
    networkIdle: TIMEOUTS.NETWORK
  },

  /** API operation timeouts */
  api: {
    /** GET request (10000ms) */
    get: TIMEOUTS.NETWORK,
    /** POST request (10000ms) */
    post: TIMEOUTS.NETWORK,
    /** PUT request (10000ms) */
    put: TIMEOUTS.NETWORK,
    /** DELETE request (1000ms) */
    delete: TIMEOUTS.QUICK,
    /** File upload (10000ms) */
    upload: TIMEOUTS.NETWORK
  },

  /** AI operation timeouts (longer due to variable processing time) */
  ai: {
    /** AI idea generation (20000ms) */
    generate: TIMEOUTS.VERY_SLOW,
    /** Text file analysis (20000ms) */
    analyzeText: TIMEOUTS.VERY_SLOW,
    /** Image analysis (20000ms) */
    analyzeImage: TIMEOUTS.VERY_SLOW,
    /** Audio transcription (20000ms - may need more for long audio) */
    transcribeAudio: TIMEOUTS.VERY_SLOW,
    /** PDF document analysis (20000ms) */
    analyzePDF: TIMEOUTS.VERY_SLOW
  }
} as const;

/**
 * Performance budgets for different test scenarios
 *
 * Tests should complete within these budgets. Exceeding indicates
 * performance regression or inefficient test patterns.
 *
 * @example
 * ```typescript
 * const startTime = Date.now();
 * await createIdea(page, 'Test Idea');
 * const duration = Date.now() - startTime;
 *
 * const budget = IS_CI
 *   ? PERFORMANCE_BUDGETS.ci.get('createIdea')
 *   : PERFORMANCE_BUDGETS.createIdea;
 *
 * expect(duration).toBeLessThan(budget);
 * ```
 */
export const PERFORMANCE_BUDGETS = {
  // Page loads
  /** Initial page load budget (3000ms) */
  initialPageLoad: 3000,
  /** Route transition budget (1000ms) */
  routeTransition: 1000,

  // User interactions
  /** Button click response (100ms) */
  buttonClick: 100,
  /** Form fill operation (500ms) */
  formFill: 500,
  /** Modal open (500ms) */
  modalOpen: 500,

  // Data operations
  /** Create single idea (2000ms) */
  createIdea: 2000,
  /** Delete idea (1000ms) */
  deleteIdea: 1000,
  /** Drag idea (1000ms) */
  dragIdea: 1000,

  // API calls
  /** API read operation (2000ms) */
  apiRead: 2000,
  /** API write operation (3000ms) */
  apiWrite: 3000,

  // Bulk operations
  /** Create 50 ideas (30000ms) */
  create50Ideas: 30000,
  /** Load matrix with 100 ideas (5000ms) */
  loadMatrix100Ideas: 5000,

  /** CI-adjusted budgets */
  ci: {
    multiplier: 1.5,
    /**
     * Get CI-adjusted performance budget
     * @param operation - Operation name
     * @returns Budget multiplied by CI multiplier
     */
    get(operation: keyof Omit<typeof PERFORMANCE_BUDGETS, 'ci'>): number {
      return PERFORMANCE_BUDGETS[operation] * this.multiplier;
    }
  }
} as const;

/**
 * Deprecated timeout constants (for backward compatibility)
 *
 * @deprecated Use TIMEOUTS instead
 * These will be removed in future versions.
 */
export const LEGACY_TIMEOUTS = {
  /** @deprecated Use TIMEOUTS.NETWORK */
  TEST_TIMEOUT: 30000,
  /** @deprecated Use state-based waits instead */
  ANIMATION_DELAY: 300,
  /** @deprecated Use state-based waits instead */
  SHORT_DELAY: 100,
  /** @deprecated Use TIMEOUTS.NETWORK */
  NETWORK_IDLE_TIMEOUT: 5000
} as const;
