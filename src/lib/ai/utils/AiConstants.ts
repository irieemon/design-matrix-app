/**
 * AI Service Constants
 * Centralized configuration and constants for AI services
 */

/**
 * API Endpoints
 */
export const AI_ENDPOINTS = {
  GENERATE_IDEAS: '/api/ai/generate-ideas',
  GENERATE_INSIGHTS: '/api/ai/generate-insights',
  GENERATE_ROADMAP: '/api/ai/generate-roadmap-v2',
  ANALYZE_FILE: '/api/ai/analyze-file',
  ANALYZE_IMAGE: '/api/ai/analyze-image',
  TRANSCRIBE_AUDIO: '/api/ai/transcribe-audio'
} as const

/**
 * Cache Configuration
 */
export const CACHE_CONFIG = {
  // Cache bucket duration in milliseconds (5 minutes)
  BUCKET_DURATION: 5 * 60 * 1000,

  // Max cache age in milliseconds (30 minutes)
  MAX_AGE: 30 * 60 * 1000,

  // Enable/disable caching
  ENABLED: true
} as const

/**
 * Rate Limiting Configuration
 */
export const RATE_LIMITS = {
  // Ideas generation
  IDEAS_PER_MINUTE: 10,
  IDEAS_PER_HOUR: 50,

  // Insights generation
  INSIGHTS_PER_MINUTE: 5,
  INSIGHTS_PER_HOUR: 20,

  // Roadmap generation
  ROADMAP_PER_MINUTE: 3,
  ROADMAP_PER_HOUR: 10
} as const

/**
 * Default Values
 */
export const DEFAULTS = {
  PROJECT_TYPE: 'General',
  IDEAS_COUNT: 8,
  TOLERANCE: 50,
  TIMEOUT_MS: 30000, // 30 seconds
  MAX_RETRIES: 3
} as const

/**
 * Quadrant Definitions
 */
export const QUADRANTS = {
  QUICK_WINS: 'Quick Wins',
  BIG_BETS: 'Big Bets',
  FILL_INS: 'Fill-ins',
  MONEY_PIT: 'Money Pit'
} as const

/**
 * Impact Levels
 */
export const IMPACT_LEVELS = {
  VERY_HIGH: 'Very High',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low'
} as const

/**
 * Effort Levels
 */
export const EFFORT_LEVELS = {
  VERY_HIGH: 'Very High',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low'
} as const

/**
 * Priority Levels
 */
export const PRIORITY_LEVELS = {
  STRATEGIC: 'strategic',
  INNOVATION: 'innovation',
  HIGH: 'high',
  MODERATE: 'moderate',
  LOW: 'low'
} as const

/**
 * Error Messages
 */
export const ERROR_MESSAGES = {
  RATE_LIMIT: 'Rate limit exceeded. Please wait a moment before trying again.',
  SERVER_ERROR: 'Server error occurred',
  NETWORK_ERROR: 'Network error - please check your connection',
  TIMEOUT: 'Request timed out - please try again',
  INVALID_RESPONSE: 'Invalid response from server',
  NO_SESSION: 'No active session - please sign in'
} as const

/**
 * Mock Data Flags
 */
export const MOCK_FLAGS = {
  ENABLE_MOCK_IDEAS: false,
  ENABLE_MOCK_INSIGHTS: false,
  ENABLE_MOCK_ROADMAP: false
} as const
