/**
 * Application configuration constants
 *
 * Centralized location for all hardcoded values to improve maintainability
 * and reduce duplication across the codebase.
 */

/** Supabase localStorage key for session storage */
export const SUPABASE_STORAGE_KEY = 'sb-vfovtgtjailvrphsgafv-auth-token' as const

/** Timeout durations in milliseconds */
export const TIMEOUTS = {
  /** Timeout for getSession() call during auth initialization */
  AUTH_GET_SESSION: 2000,
  /** Timeout for project restoration from URL */
  PROJECT_RESTORE: 5000,
  /** Timeout for fetching user profile data */
  PROFILE_FETCH: 10000,
  /** Timeout for checking if user has projects */
  PROJECT_CHECK: 10000
} as const

/** Cache durations in milliseconds */
export const CACHE_DURATIONS = {
  /** User profile cache duration (10 minutes) */
  USER_PROFILE: 10 * 60 * 1000,
  /** Session cache duration (2 minutes) */
  SESSION: 2 * 60 * 1000,
  /** Project existence check cache duration (5 minutes) */
  PROJECT_EXISTENCE: 5 * 60 * 1000,
  /** Profile data cache duration (2 minutes) */
  PROFILE: 2 * 60 * 1000
} as const

/**
 * Helper to get environment variable that works in both Vite (browser) and Node.js (serverless)
 * CRITICAL: This enables API routes to import from src/lib/* without crashing
 *
 * IMPORTANT: We cannot use `import.meta` directly because Vercel serverless functions
 * compile to CommonJS where import.meta is a syntax error at parse time.
 * We use eval to defer the syntax check to runtime where we can catch it.
 */
function getEnvVar(viteName: string, processName?: string): string {
  // Check process.env first (Node.js/Vercel serverless)
  if (typeof process !== 'undefined' && process.env) {
    const processValue = process.env[processName || viteName] || process.env[viteName]
    if (processValue) return processValue
  }
  // Fallback to import.meta.env (Vite/browser) using safe eval accessor
  try {
    // eslint-disable-next-line no-eval
    const env = eval('typeof import.meta !== "undefined" && import.meta.env')
    if (env && env[viteName]) {
      return env[viteName]
    }
  } catch {
    // import.meta not available (Node.js/CommonJS environment)
  }
  return ''
}

/**
 * Feature Flags
 *
 * Flags for progressive feature rollout and safe testing.
 * All flags default to OFF unless explicitly enabled via environment variables.
 */
export const FEATURE_FLAGS = {
  /**
   * Phase Two: Real-Time Collaborative Brainstorming Infrastructure
   *
   * Enables:
   * - Real-time channel subscriptions (ideas, participants, session state)
   * - Presence tracking (typing indicators, participant activity)
   * - Optimistic UI updates with deduplication
   * - Event batching and automatic reconnection
   *
   * When OFF: Phase One functionality remains stable (QR join, backend validation)
   * When ON: Full real-time collaboration features enabled
   *
   * @default false
   */
  MOBILE_BRAINSTORM_PHASE2: getEnvVar('VITE_MOBILE_BRAINSTORM_PHASE2', 'MOBILE_BRAINSTORM_PHASE2') === 'true',

  /**
   * Phase Three: UI Presentation Layer for Collaborative Brainstorming
   *
   * Enables:
   * - Mobile Join Flow UI with validation states
   * - Mobile Idea Submission Form with real-time feedback
   * - Desktop UI integrations (enhanced IdeaCard, ParticipantList, presence indicators)
   * - Real-time UI bindings to Phase Two hooks
   * - Animations and visual polish (scale-in, fade, blue pulse)
   *
   * When OFF: App behaves exactly as before (no UI changes)
   * When ON: Full collaborative mobile brainstorming UI becomes available
   *
   * @default false
   */
  MOBILE_BRAINSTORM_PHASE3: getEnvVar('VITE_MOBILE_BRAINSTORM_PHASE3', 'MOBILE_BRAINSTORM_PHASE3') === 'true',

  /**
   * Phase Four: Facilitator Desktop Integration Layer
   *
   * Enables:
   * - QR session activation flow in fullscreen matrix
   * - SessionQRCode overlay component with join instructions
   * - Facilitator session controls (pause/resume/end)
   * - Desktop participant panel with real-time updates
   * - Blue pulse indicator for mobile-submitted ideas
   * - Session status indicators and visual treatments
   * - Full integration of brainstorm features into matrix UI
   *
   * When OFF: Existing Idea Matrix behavior unchanged
   * When ON: Complete facilitator desktop experience available
   *
   * @default false
   */
  MOBILE_BRAINSTORM_PHASE4: getEnvVar('VITE_MOBILE_BRAINSTORM_PHASE4', 'MOBILE_BRAINSTORM_PHASE4') === 'true',

  /**
   * Phase Five: Security, Validation, Rate Limiting & Test Coverage
   *
   * Enables:
   * - Server-side rate limiting (6 ideas/min per participant, session limits)
   * - Content moderation service (spam, profanity, length validation)
   * - Session security enforcement (token validation, expiration, participant limits)
   * - RLS policy validation and testing
   * - Security logging and audit trails
   * - Comprehensive E2E test suite coverage
   * - Performance and load testing
   *
   * When OFF: System behaves exactly like Phase Four
   * When ON: Enhanced security, validation, and testing infrastructure active
   *
   * @default false
   */
  MOBILE_BRAINSTORM_PHASE5: getEnvVar('VITE_MOBILE_BRAINSTORM_PHASE5', 'MOBILE_BRAINSTORM_PHASE5') === 'true'
} as const

/**
 * Check if a feature flag is enabled
 * @param flag - Feature flag name from FEATURE_FLAGS
 * @returns boolean indicating if feature is enabled
 */
export function isFeatureEnabled(flag: keyof typeof FEATURE_FLAGS): boolean {
  return FEATURE_FLAGS[flag]
}
