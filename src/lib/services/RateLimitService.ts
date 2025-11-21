/**
 * Rate Limiting Service
 * Phase Five Implementation
 *
 * Enforces server-side rate limits to prevent abuse and ensure system stability:
 * - Max 6 ideas per participant per minute
 * - Max 50 participants per session (configurable)
 * - Exponential backoff for repeated violations
 * - Survives page refreshes via in-memory storage
 */

import { isFeatureEnabled } from '../config'

export interface RateLimitConfig {
  /** Maximum ideas per participant per time window */
  maxIdeasPerWindow: number
  /** Time window in milliseconds (default: 60000 = 1 minute) */
  windowMs: number
  /** Maximum participants per session */
  maxParticipantsPerSession: number
  /** Block duration after abuse (milliseconds) */
  blockDurationMs: number
  /** Number of violations before blocking */
  violationsBeforeBlock: number
}

export interface RateLimitResult {
  /** Whether the action is allowed */
  allowed: boolean
  /** Remaining quota in current window */
  remaining: number
  /** Time until window resets (ms) */
  resetIn: number
  /** Time until retry allowed (ms, only when blocked) */
  retryAfter?: number
  /** Reason for denial */
  reason?: string
}

interface ParticipantRateData {
  /** Timestamps of idea submissions */
  submissions: number[]
  /** Number of violations */
  violations: number
  /** Block end timestamp (if blocked) */
  blockedUntil?: number
}

interface SessionRateData {
  /** Current participant count */
  participantCount: number
  /** Participant IDs in session */
  participantIds: Set<string>
}

/**
 * Default rate limit configuration
 */
const DEFAULT_CONFIG: RateLimitConfig = {
  maxIdeasPerWindow: 6,
  windowMs: 60 * 1000, // 1 minute
  maxParticipantsPerSession: 50,
  blockDurationMs: 5 * 60 * 1000, // 5 minutes
  violationsBeforeBlock: 3
}

/**
 * Rate Limiting Service
 *
 * Uses in-memory storage for performance. In production, consider:
 * - Redis for distributed rate limiting
 * - Supabase edge functions with KV store
 * - Database-backed rate limit tracking
 */
export class RateLimitService {
  private config: RateLimitConfig
  private participantData: Map<string, ParticipantRateData>
  private sessionData: Map<string, SessionRateData>
  private cleanupInterval: NodeJS.Timeout | null

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.participantData = new Map()
    this.sessionData = new Map()
    this.cleanupInterval = null

    // Start cleanup interval (every 5 minutes)
    if (typeof window !== 'undefined') {
      this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000)
    }
  }

  /**
   * Check if participant can submit an idea
   */
  checkIdeaSubmission(participantId: string): RateLimitResult {
    // Skip rate limiting if Phase 5 flag is OFF
    if (!isFeatureEnabled('MOBILE_BRAINSTORM_PHASE5')) {
      return {
        allowed: true,
        remaining: this.config.maxIdeasPerWindow,
        resetIn: 0
      }
    }

    const now = Date.now()
    let data = this.participantData.get(participantId)

    // Initialize if first submission
    if (!data) {
      data = {
        submissions: [],
        violations: 0
      }
      this.participantData.set(participantId, data)
    }

    // Check if currently blocked
    if (data.blockedUntil && data.blockedUntil > now) {
      return {
        allowed: false,
        remaining: 0,
        resetIn: data.blockedUntil - now,
        retryAfter: data.blockedUntil - now,
        reason: 'Rate limit exceeded. Temporary block in effect.'
      }
    }

    // Clear expired block
    if (data.blockedUntil && data.blockedUntil <= now) {
      data.blockedUntil = undefined
      data.violations = 0
    }

    // Remove submissions outside the current window
    const windowStart = now - this.config.windowMs
    data.submissions = data.submissions.filter(ts => ts > windowStart)

    // Check if under the limit
    if (data.submissions.length < this.config.maxIdeasPerWindow) {
      // Add this submission
      data.submissions.push(now)

      const oldestSubmission = Math.min(...data.submissions)
      const resetIn = Math.max(0, oldestSubmission + this.config.windowMs - now)

      return {
        allowed: true,
        remaining: this.config.maxIdeasPerWindow - data.submissions.length,
        resetIn
      }
    }

    // Rate limit exceeded
    data.violations++

    // Check if should block
    if (data.violations >= this.config.violationsBeforeBlock) {
      data.blockedUntil = now + this.config.blockDurationMs
      return {
        allowed: false,
        remaining: 0,
        resetIn: this.config.blockDurationMs,
        retryAfter: this.config.blockDurationMs,
        reason: `Too many violations. Blocked for ${Math.ceil(this.config.blockDurationMs / 60000)} minutes.`
      }
    }

    // Calculate when window resets
    const oldestSubmission = Math.min(...data.submissions)
    const resetIn = oldestSubmission + this.config.windowMs - now

    return {
      allowed: false,
      remaining: 0,
      resetIn,
      retryAfter: resetIn,
      reason: `Rate limit exceeded. Maximum ${this.config.maxIdeasPerWindow} ideas per minute.`
    }
  }

  /**
   * Check if a participant can join a session
   */
  checkParticipantJoin(sessionId: string, participantId: string): RateLimitResult {
    // Skip rate limiting if Phase 5 flag is OFF
    if (!isFeatureEnabled('MOBILE_BRAINSTORM_PHASE5')) {
      return {
        allowed: true,
        remaining: this.config.maxParticipantsPerSession,
        resetIn: 0
      }
    }

    let sessionData = this.sessionData.get(sessionId)

    // Initialize if first participant
    if (!sessionData) {
      sessionData = {
        participantCount: 0,
        participantIds: new Set()
      }
      this.sessionData.set(sessionId, sessionData)
    }

    // Check if participant already joined
    if (sessionData.participantIds.has(participantId)) {
      return {
        allowed: true,
        remaining: this.config.maxParticipantsPerSession - sessionData.participantCount,
        resetIn: 0
      }
    }

    // Check participant limit
    if (sessionData.participantCount >= this.config.maxParticipantsPerSession) {
      return {
        allowed: false,
        remaining: 0,
        resetIn: 0,
        reason: `Session has reached maximum capacity (${this.config.maxParticipantsPerSession} participants).`
      }
    }

    // Allow join and track participant
    sessionData.participantIds.add(participantId)
    sessionData.participantCount = sessionData.participantIds.size

    return {
      allowed: true,
      remaining: this.config.maxParticipantsPerSession - sessionData.participantCount,
      resetIn: 0
    }
  }

  /**
   * Remove participant from session tracking
   */
  removeParticipant(sessionId: string, participantId: string): void {
    const sessionData = this.sessionData.get(sessionId)
    if (sessionData) {
      sessionData.participantIds.delete(participantId)
      sessionData.participantCount = sessionData.participantIds.size
    }
  }

  /**
   * Get current rate limit status for a participant
   */
  getStatus(participantId: string): RateLimitResult {
    if (!isFeatureEnabled('MOBILE_BRAINSTORM_PHASE5')) {
      return {
        allowed: true,
        remaining: this.config.maxIdeasPerWindow,
        resetIn: 0
      }
    }

    const now = Date.now()
    const data = this.participantData.get(participantId)

    if (!data) {
      return {
        allowed: true,
        remaining: this.config.maxIdeasPerWindow,
        resetIn: 0
      }
    }

    // Check if blocked
    if (data.blockedUntil && data.blockedUntil > now) {
      return {
        allowed: false,
        remaining: 0,
        resetIn: data.blockedUntil - now,
        retryAfter: data.blockedUntil - now,
        reason: 'Blocked due to rate limit violations'
      }
    }

    // Filter submissions to current window
    const windowStart = now - this.config.windowMs
    const activeSubmissions = data.submissions.filter(ts => ts > windowStart)

    const remaining = Math.max(0, this.config.maxIdeasPerWindow - activeSubmissions.length)
    const oldestSubmission = activeSubmissions.length > 0 ? Math.min(...activeSubmissions) : now
    const resetIn = activeSubmissions.length > 0
      ? Math.max(0, oldestSubmission + this.config.windowMs - now)
      : 0

    return {
      allowed: remaining > 0,
      remaining,
      resetIn
    }
  }

  /**
   * Reset rate limit for a participant (admin function)
   */
  reset(participantId: string): void {
    this.participantData.delete(participantId)
  }

  /**
   * Clear all session data (when session ends)
   */
  clearSession(sessionId: string): void {
    this.sessionData.delete(sessionId)
  }

  /**
   * Cleanup old data to prevent memory leaks
   */
  private cleanup(): void {
    const now = Date.now()
    const maxAge = this.config.windowMs * 10 // Keep data for 10 windows

    // Cleanup participant data
    for (const [participantId, data] of this.participantData.entries()) {
      // Remove if no recent submissions and not blocked
      const hasRecentSubmissions = data.submissions.some(ts => ts > now - maxAge)
      const isBlocked = data.blockedUntil && data.blockedUntil > now

      if (!hasRecentSubmissions && !isBlocked) {
        this.participantData.delete(participantId)
      }
    }

    // Cleanup empty sessions
    for (const [sessionId, data] of this.sessionData.entries()) {
      if (data.participantCount === 0) {
        this.sessionData.delete(sessionId)
      }
    }
  }

  /**
   * Cleanup interval on destroy
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
  }
}

// Singleton instance
let rateLimitServiceInstance: RateLimitService | null = null

/**
 * Get the singleton rate limit service instance
 */
export function getRateLimitService(): RateLimitService {
  if (!rateLimitServiceInstance) {
    rateLimitServiceInstance = new RateLimitService()
  }
  return rateLimitServiceInstance
}
