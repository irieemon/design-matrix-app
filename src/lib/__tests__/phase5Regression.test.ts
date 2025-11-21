/**
 * Phase Five Regression Tests
 *
 * Ensures Phase Five implementation does NOT break existing behavior
 * when MOBILE_BRAINSTORM_PHASE5 feature flag is OFF
 *
 * All tests run with flag OFF to verify backward compatibility
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getRateLimitService, RateLimitService } from '../services/RateLimitService'
import { ContentModerationService } from '../services/ContentModerationService'
import * as config from '../config'

describe('Phase Five Regression Tests (Flag OFF)', () => {
  let rateLimitService: RateLimitService

  beforeEach(() => {
    // ALWAYS ensure flag is OFF for these tests
    vi.spyOn(config, 'isFeatureEnabled').mockReturnValue(false)
    rateLimitService = getRateLimitService()
    vi.clearAllTimers()
    vi.useFakeTimers()
  })

  afterEach(() => {
    rateLimitService.destroy()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('Rate Limiting Bypass', () => {
    it('should allow unlimited idea submissions when flag is OFF', () => {
      const participantId = 'test-participant'

      // Submit 20 ideas (would be blocked at 6 in Phase Five)
      for (let i = 0; i < 20; i++) {
        const result = rateLimitService.checkIdeaSubmission(participantId)
        expect(result.allowed).toBe(true)
        expect(result.remaining).toBe(6) // Always reports max remaining
      }

      // No violations tracked
      const status = rateLimitService.getStatus(participantId)
      expect(status.allowed).toBe(true)
      expect(status.remaining).toBe(6)
    })

    it('should allow unlimited participants to join session when flag is OFF', () => {
      const sessionId = 'test-session'

      // Join 100 participants (would be blocked at 50 in Phase Five)
      for (let i = 0; i < 100; i++) {
        const result = rateLimitService.checkParticipantJoin(sessionId, `participant-${i}`)
        expect(result.allowed).toBe(true)
        expect(result.remaining).toBe(50) // Always reports max remaining
      }
    })

    it('should not track violations when flag is OFF', () => {
      const participantId = 'violator'

      // Rapid submissions (would cause violations in Phase Five)
      for (let i = 0; i < 30; i++) {
        const result = rateLimitService.checkIdeaSubmission(participantId)
        expect(result.allowed).toBe(true)
      }

      // No blocking
      const status = rateLimitService.getStatus(participantId)
      expect(status.allowed).toBe(true)
      // No retryAfter field when not rate limited
      expect(status.retryAfter).toBeUndefined()
    })
  })

  describe('Content Moderation - Phase One Limits', () => {
    it('should allow 500 character content (Phase One limit)', () => {
      const content = 'This is a test idea. '.repeat(24).substring(0, 500)
      const result = ContentModerationService.validateIdeaContent(content)

      expect(result.valid).toBe(true)
      expect(result.sanitizedContent).toBeDefined()
    })

    it('should allow 2000 character details (Phase One limit)', () => {
      const details = 'Additional details. '.repeat(100).substring(0, 2000)
      const result = ContentModerationService.validateIdeaDetails(details)

      expect(result.valid).toBe(true)
    })

    it('should NOT reject emoji-only content when flag is OFF', () => {
      const content = '😀 😃 😄 😁'
      const result = ContentModerationService.validateIdeaContent(content)

      expect(result.valid).toBe(true)
    })

    it('should NOT reject wall-of-text when flag is OFF', () => {
      // 50 chars with no spacing (would be rejected in Phase Five)
      const content = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'.substring(0, 50)
      const result = ContentModerationService.validateIdeaContent(content)

      expect(result.valid).toBe(true)
    })
  })

  describe('Core Validation Still Works', () => {
    it('should still enforce minimum content length (3 chars)', () => {
      const result = ContentModerationService.validateIdeaContent('ab')

      expect(result.valid).toBe(false)
      expect(result.error).toContain('at least 3 characters')
    })

    it('should still detect spam patterns', () => {
      const spamContent = 'Check out http://spam.com for details'
      const result = ContentModerationService.validateIdeaContent(spamContent)

      expect(result.valid).toBe(false)
      expect(result.error).toContain('spam-like patterns')
    })

    it('should still detect profanity', () => {
      const profaneContent = 'This is a fuck idea'
      const result = ContentModerationService.validateIdeaContent(profaneContent)

      expect(result.valid).toBe(false)
      expect(result.error).toContain('inappropriate language')
    })

    it('should still sanitize HTML', () => {
      const htmlContent = '<script>alert("xss")</script>Good idea'
      const result = ContentModerationService.validateIdeaContent(htmlContent)

      expect(result.valid).toBe(true)
      expect(result.sanitizedContent).not.toContain('<script>')
      expect(result.sanitizedContent).toContain('Good idea')
    })
  })

  describe('Participant Name Validation', () => {
    it('should still enforce name length limits (2-50 chars)', () => {
      const tooShort = ContentModerationService.validateParticipantName('J')
      expect(tooShort.valid).toBe(false)

      const tooLong = ContentModerationService.validateParticipantName('a'.repeat(51))
      expect(tooLong.valid).toBe(false)

      const justRight = ContentModerationService.validateParticipantName('John Doe')
      expect(justRight.valid).toBe(true)
    })

    it('should still reject profane participant names', () => {
      const result = ContentModerationService.validateParticipantName('fuck user')

      expect(result.valid).toBe(false)
      expect(result.error).toContain('inappropriate language')
    })
  })

  describe('Priority Validation', () => {
    it('should still accept valid priority values', () => {
      expect(ContentModerationService.validatePriority('low').valid).toBe(true)
      expect(ContentModerationService.validatePriority('moderate').valid).toBe(true)
      expect(ContentModerationService.validatePriority('high').valid).toBe(true)
      expect(ContentModerationService.validatePriority(undefined).valid).toBe(true)
    })

    it('should still reject invalid priority values', () => {
      const result = ContentModerationService.validatePriority('critical' as any)

      expect(result.valid).toBe(false)
      expect(result.error).toContain('low, moderate, high')
    })
  })

  describe('Service Instantiation', () => {
    it('should still support singleton pattern for RateLimitService', () => {
      const instance1 = getRateLimitService()
      const instance2 = getRateLimitService()

      expect(instance1).toBe(instance2)
    })

    it('should still support manual reset of rate limiter', () => {
      const participantId = 'test-participant'

      // Record some submissions (even though flag is OFF, should not fail)
      rateLimitService.checkIdeaSubmission(participantId)
      rateLimitService.checkIdeaSubmission(participantId)

      // Reset should not fail
      expect(() => rateLimitService.reset(participantId)).not.toThrow()
    })

    it('should still support session clearing', () => {
      const sessionId = 'test-session'

      // Add some participants
      rateLimitService.checkParticipantJoin(sessionId, 'participant-1')
      rateLimitService.checkParticipantJoin(sessionId, 'participant-2')

      // Clear session should not fail
      expect(() => rateLimitService.clearSession(sessionId)).not.toThrow()
    })
  })

  describe('Error Messages When Flag OFF', () => {
    it('should return consistent response structure even when bypassing limits', () => {
      const participantId = 'test-participant'

      // Even with flag OFF, response structure should be consistent
      const result = rateLimitService.checkIdeaSubmission(participantId)

      expect(result).toHaveProperty('allowed')
      expect(result).toHaveProperty('remaining')
      expect(result).toHaveProperty('resetIn')
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(6)
      expect(result.resetIn).toBe(0)
    })

    it('should not include violation-specific fields when flag is OFF', () => {
      const participantId = 'test-participant'

      // Submit many ideas
      for (let i = 0; i < 20; i++) {
        rateLimitService.checkIdeaSubmission(participantId)
      }

      const result = rateLimitService.checkIdeaSubmission(participantId)

      // Should not have violation/block fields
      expect(result.retryAfter).toBeUndefined()
      expect(result.reason).toBeUndefined()
    })
  })

  describe('Data Persistence Across Flag Toggle', () => {
    it('should handle flag being toggled from OFF to ON gracefully', () => {
      const participantId = 'test-participant'

      // Start with flag OFF - submit 10 ideas
      vi.spyOn(config, 'isFeatureEnabled').mockReturnValue(false)
      for (let i = 0; i < 10; i++) {
        const result = rateLimitService.checkIdeaSubmission(participantId)
        expect(result.allowed).toBe(true)
      }

      // Toggle flag ON
      vi.spyOn(config, 'isFeatureEnabled').mockReturnValue(true)

      // Now should enforce limits starting fresh
      const result = rateLimitService.checkIdeaSubmission(participantId)
      // First submission with flag ON should be allowed
      expect(result.allowed).toBe(true)
    })
  })
})
