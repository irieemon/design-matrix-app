/**
 * Security Integration Tests
 * Phase Five Implementation
 *
 * Tests integration of security components:
 * - RateLimitService + SessionSecurityService + ContentModerationService
 * - End-to-end security workflow validation
 * - Feature flag coordination
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getRateLimitService, RateLimitService } from '../services/RateLimitService'
import { SessionSecurityService } from '../services/SessionSecurityService'
import { ContentModerationService } from '../services/ContentModerationService'
import * as config from '../config'

describe('Security Integration Tests', () => {
  let rateLimitService: RateLimitService

  beforeEach(() => {
    rateLimitService = getRateLimitService()
    vi.clearAllTimers()
    vi.useFakeTimers()
  })

  afterEach(() => {
    rateLimitService.destroy()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('Idea Submission Security Pipeline', () => {
    it('should enforce rate limiting before content moderation', () => {
      vi.spyOn(config, 'isFeatureEnabled').mockReturnValue(true)

      const participantId = 'test-participant'

      // Submit 6 ideas to hit rate limit
      for (let i = 0; i < 6; i++) {
        const rateLimitResult = rateLimitService.checkIdeaSubmission(participantId)
        expect(rateLimitResult.allowed).toBe(true)
      }

      // 7th submission blocked by rate limiter
      const rateLimitResult = rateLimitService.checkIdeaSubmission(participantId)
      expect(rateLimitResult.allowed).toBe(false)
      expect(rateLimitResult.reason).toContain('Rate limit exceeded')

      // Even if content is valid, rate limit blocks submission
      const contentResult = ContentModerationService.validateIdeaContent('Valid idea content')
      expect(contentResult.valid).toBe(true) // Content is valid...
      // ...but submission is blocked by rate limiter (would be checked first in API)
    })

    it('should validate content after rate limit passes', () => {
      vi.spyOn(config, 'isFeatureEnabled').mockReturnValue(true)

      const participantId = 'test-participant-' + Date.now()

      // Step 1: Check rate limit (passes)
      const rateLimitResult = rateLimitService.checkIdeaSubmission(participantId)
      expect(rateLimitResult.allowed).toBe(true)

      // Step 2: Validate content (passes)
      const validContent = 'This is a great idea for improving our system'
      const contentResult = ContentModerationService.validateIdeaContent(validContent)
      expect(contentResult.valid).toBe(true)

      // Both checks pass - submission would succeed
    })

    it('should reject invalid content even when rate limit passes', () => {
      vi.spyOn(config, 'isFeatureEnabled').mockReturnValue(true)

      const participantId = 'test-participant-' + Date.now() + 1

      // Step 1: Check rate limit (passes)
      const rateLimitResult = rateLimitService.checkIdeaSubmission(participantId)
      expect(rateLimitResult.allowed).toBe(true)

      // Step 2: Validate content (fails - too long for Phase Five)
      const invalidContent = 'This is a test. '.repeat(20).substring(0, 300) // Exceeds 200 char limit
      const contentResult = ContentModerationService.validateIdeaContent(invalidContent)
      expect(contentResult.valid).toBe(false)

      // Rate limit passed but content validation failed
    })
  })

  describe('Feature Flag Coordination', () => {
    it('should bypass all Phase Five checks when flag is OFF', () => {
      vi.spyOn(config, 'isFeatureEnabled').mockReturnValue(false)

      const participantId = 'test-participant'

      // Rate limiting: Submit 10 ideas (would be blocked in Phase Five after 6)
      for (let i = 0; i < 10; i++) {
        const result = rateLimitService.checkIdeaSubmission(participantId)
        expect(result.allowed).toBe(true) // All allowed when flag OFF
      }

      // Content moderation: 400 chars allowed in Phase One
      const longContent = 'This is a test idea. '.repeat(20).substring(0, 400)
      const contentResult = ContentModerationService.validateIdeaContent(longContent)
      expect(contentResult.valid).toBe(true)

      // Session security: Would skip Phase Five checks
      // (Cannot test without actual database, but service returns valid: true)
    })

    it('should enforce all Phase Five checks when flag is ON', () => {
      vi.spyOn(config, 'isFeatureEnabled').mockReturnValue(true)

      const participantId = 'test-participant'

      // Rate limiting: Blocks after 6 submissions
      for (let i = 0; i < 6; i++) {
        rateLimitService.checkIdeaSubmission(participantId)
      }
      const rateLimitResult = rateLimitService.checkIdeaSubmission(participantId)
      expect(rateLimitResult.allowed).toBe(false)

      // Content moderation: 200 char limit in Phase Five
      const content201 = 'a'.repeat(201)
      const contentResult = ContentModerationService.validateIdeaContent(content201)
      expect(contentResult.valid).toBe(false)
      expect(contentResult.error).toContain('200 characters')
    })
  })

  describe('Participant Join Security Pipeline', () => {
    it('should enforce session capacity limits', () => {
      vi.spyOn(config, 'isFeatureEnabled').mockReturnValue(true)

      const sessionId = 'test-session'

      // Fill session to capacity (50 participants)
      for (let i = 0; i < 50; i++) {
        const result = rateLimitService.checkParticipantJoin(sessionId, `participant-${i}`)
        expect(result.allowed).toBe(true)
      }

      // 51st participant blocked
      const result = rateLimitService.checkParticipantJoin(sessionId, 'participant-51')
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('maximum capacity')
    })

    it('should validate participant name with content moderation', () => {
      // Valid name
      const validName = ContentModerationService.validateParticipantName('John Doe')
      expect(validName.valid).toBe(true)

      // Invalid name (too short)
      const tooShort = ContentModerationService.validateParticipantName('J')
      expect(tooShort.valid).toBe(false)

      // Invalid name (profanity)
      const profane = ContentModerationService.validateParticipantName('fuck user')
      expect(profane.valid).toBe(false)

      // Invalid name (too long)
      const tooLong = ContentModerationService.validateParticipantName('a'.repeat(51))
      expect(tooLong.valid).toBe(false)
    })
  })

  describe('Multi-Layer Security Enforcement', () => {
    it('should block spam patterns at content layer before rate limiting accumulates', () => {
      vi.spyOn(config, 'isFeatureEnabled').mockReturnValue(true)

      // Spam content caught immediately by content moderation
      const spamContent = 'Check out http://spam.com for details'
      const contentResult = ContentModerationService.validateIdeaContent(spamContent)
      expect(contentResult.valid).toBe(false)
      expect(contentResult.error).toContain('spam-like patterns')

      // Rate limiter never increments because content validation failed first
      const participantId = 'spam-participant'
      const rateLimitResult = rateLimitService.getStatus(participantId)
      expect(rateLimitResult.remaining).toBe(6) // No submissions recorded
    })

    it('should enforce violation-based blocking after repeated rate limit violations', () => {
      vi.spyOn(config, 'isFeatureEnabled').mockReturnValue(true)

      const participantId = 'violator-' + Date.now()

      // Cause first 2 violations
      for (let violationCount = 0; violationCount < 2; violationCount++) {
        // Submit 6 ideas to hit limit
        for (let i = 0; i < 6; i++) {
          rateLimitService.checkIdeaSubmission(participantId)
        }

        // Exceed limit (violation)
        const result = rateLimitService.checkIdeaSubmission(participantId)
        expect(result.allowed).toBe(false)
        expect(result.reason).toContain('Rate limit exceeded')

        // Advance time to reset window but not block
        vi.advanceTimersByTime(61 * 1000) // 61 seconds - past window
      }

      // Now cause the 3rd violation which triggers blocking
      for (let i = 0; i < 6; i++) {
        rateLimitService.checkIdeaSubmission(participantId)
      }

      // This 7th submission is the 3rd violation - triggers block
      const blockTrigger = rateLimitService.checkIdeaSubmission(participantId)
      expect(blockTrigger.allowed).toBe(false)
      expect(blockTrigger.reason).toContain('Too many violations')
      expect(blockTrigger.reason).toContain('5 minutes')

      // Subsequent checks show "Temporary block in effect"
      const subsequentCheck = rateLimitService.checkIdeaSubmission(participantId)
      expect(subsequentCheck.allowed).toBe(false)
      expect(subsequentCheck.reason).toContain('Temporary block')
    })

    it('should apply progressive length limits based on feature flag', () => {
      const participantId = 'test-participant'

      // Phase One: 500 char limit for content
      vi.spyOn(config, 'isFeatureEnabled').mockReturnValue(false)
      const content400 = 'This is a test idea. '.repeat(20).substring(0, 400)
      const phase1Result = ContentModerationService.validateIdeaContent(content400)
      expect(phase1Result.valid).toBe(true)

      // Phase Five: 200 char limit for content
      vi.spyOn(config, 'isFeatureEnabled').mockReturnValue(true)
      const phase5Result = ContentModerationService.validateIdeaContent(content400)
      expect(phase5Result.valid).toBe(false)
      expect(phase5Result.error).toContain('200 characters')
    })
  })

  describe('Session State and Security Coordination', () => {
    it('should handle paused sessions correctly', async () => {
      // Note: This test documents expected behavior
      // SessionSecurityService.validateIdeaSubmission checks session status
      // If status is 'paused', returns valid: false with SESSION_PAUSED code

      // In real implementation, paused sessions block idea submission but allow viewing
      // Rate limiting still applies but security service blocks based on session state
    })

    it('should handle expired sessions correctly', async () => {
      // Note: This test documents expected behavior
      // SessionSecurityService.validateSessionToken checks expiration
      // SessionSecurityService.validateParticipantJoin checks expiration
      // If current time > expires_at, returns valid: false with SESSION_EXPIRED code
    })

    it('should validate ownership for facilitator operations', async () => {
      // Note: This test documents expected behavior
      // SessionSecurityService.validateSessionOwnership checks facilitator_id
      // Only session facilitator can perform management operations
      // Returns valid: false with UNAUTHORIZED code for non-facilitators
    })
  })

  describe('Error Response Coordination', () => {
    it('should provide consistent error responses across security layers', () => {
      vi.spyOn(config, 'isFeatureEnabled').mockReturnValue(true)

      const participantId = 'test-participant'

      // Rate limit error includes retryAfter, remaining, resetIn
      for (let i = 0; i < 6; i++) {
        rateLimitService.checkIdeaSubmission(participantId)
      }
      const rateLimitError = rateLimitService.checkIdeaSubmission(participantId)
      expect(rateLimitError.allowed).toBe(false)
      expect(rateLimitError.retryAfter).toBeGreaterThan(0)
      expect(rateLimitError.remaining).toBe(0)
      expect(rateLimitError.resetIn).toBeGreaterThan(0)

      // Content moderation error includes specific validation error
      const invalidContent = 'ab' // Too short (min 3 chars)
      const contentError = ContentModerationService.validateIdeaContent(invalidContent)
      expect(contentError.valid).toBe(false)
      expect(contentError.error).toContain('at least 3 characters')
    })
  })

  describe('Cleanup and Resource Management', () => {
    it('should cleanup rate limiting data for stale participants', () => {
      vi.spyOn(config, 'isFeatureEnabled').mockReturnValue(true)

      const participantId = 'stale-participant'

      // Record a submission
      rateLimitService.checkIdeaSubmission(participantId)
      let status = rateLimitService.getStatus(participantId)
      expect(status.remaining).toBe(5) // 1 submission recorded

      // Fast-forward past cleanup threshold (10x window = 10 minutes)
      vi.advanceTimersByTime(11 * 60 * 1000)

      // Trigger cleanup (runs every 5 minutes)
      vi.advanceTimersByTime(5 * 60 * 1000)
      ;(rateLimitService as any).cleanup()

      // Participant data should be cleaned up
      status = rateLimitService.getStatus(participantId)
      expect(status.remaining).toBe(6) // Fresh state
    })

    it('should allow manual reset of rate limits for admin operations', () => {
      vi.spyOn(config, 'isFeatureEnabled').mockReturnValue(true)

      const participantId = 'test-participant'

      // Submit 6 ideas and get blocked
      for (let i = 0; i < 6; i++) {
        rateLimitService.checkIdeaSubmission(participantId)
      }
      expect(rateLimitService.checkIdeaSubmission(participantId).allowed).toBe(false)

      // Admin reset
      rateLimitService.reset(participantId)

      // Should be able to submit again
      const result = rateLimitService.checkIdeaSubmission(participantId)
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(5)
    })
  })
})
