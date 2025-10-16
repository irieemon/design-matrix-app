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
