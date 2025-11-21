/**
 * RateLimitService Unit Tests
 * Phase Five Implementation
 *
 * Tests rate limiting logic:
 * - Idea submission rate limiting (6 per minute)
 * - Participant join rate limiting (50 per session)
 * - Exponential backoff and blocking
 * - Feature flag gating
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { RateLimitService, getRateLimitService } from '../RateLimitService'
import * as config from '../../config'

describe('RateLimitService', () => {
  let service: RateLimitService

  beforeEach(() => {
    service = new RateLimitService()
    vi.clearAllTimers()
    vi.useFakeTimers()
  })

  afterEach(() => {
    service.destroy()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('Feature Flag Gating', () => {
    it('should skip rate limiting when PHASE5 flag is OFF', () => {
      vi.spyOn(config, 'isFeatureEnabled').mockReturnValue(false)

      const result = service.checkIdeaSubmission('participant-1')

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(6) // Max ideas per window
      expect(result.resetIn).toBe(0)
    })

    it('should enforce rate limiting when PHASE5 flag is ON', () => {
      vi.spyOn(config, 'isFeatureEnabled').mockReturnValue(true)

      // Submit 6 ideas rapidly
      for (let i = 0; i < 6; i++) {
        service.checkIdeaSubmission('participant-1')
      }

      // 7th submission should be blocked
      const result = service.checkIdeaSubmission('participant-1')

      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
      expect(result.reason).toContain('Rate limit exceeded')
    })
  })

  describe('Idea Submission Rate Limiting', () => {
    beforeEach(() => {
      vi.spyOn(config, 'isFeatureEnabled').mockReturnValue(true)
    })

    it('should allow submissions under the limit', () => {
      const result1 = service.checkIdeaSubmission('participant-1')
      expect(result1.allowed).toBe(true)
      expect(result1.remaining).toBe(5) // 6 max - 1 used = 5 remaining

      const result2 = service.checkIdeaSubmission('participant-1')
      expect(result2.allowed).toBe(true)
      expect(result2.remaining).toBe(4)
    })

    it('should block submissions after exceeding limit', () => {
      // Submit 6 ideas (the max)
      for (let i = 0; i < 6; i++) {
        const result = service.checkIdeaSubmission('participant-1')
        expect(result.allowed).toBe(true)
      }

      // 7th submission should be blocked
      const result = service.checkIdeaSubmission('participant-1')
      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
      expect(result.retryAfter).toBeGreaterThan(0)
      expect(result.reason).toContain('Rate limit exceeded')
    })

    it('should reset quota after time window passes', () => {
      // Submit 6 ideas
      for (let i = 0; i < 6; i++) {
        service.checkIdeaSubmission('participant-1')
      }

      // 7th is blocked
      const blockedResult = service.checkIdeaSubmission('participant-1')
      expect(blockedResult.allowed).toBe(false)

      // Advance time by 61 seconds (past the 60-second window)
      vi.advanceTimersByTime(61 * 1000)

      // Now should be allowed again
      const allowedResult = service.checkIdeaSubmission('participant-1')
      expect(allowedResult.allowed).toBe(true)
      expect(allowedResult.remaining).toBe(5)
    })

    it('should track violations and apply blocking after 3 violations', () => {
      // Cause 3 violations by exceeding limit 3 times
      for (let violationCount = 0; violationCount < 3; violationCount++) {
        // Submit 6 ideas to hit limit
        for (let i = 0; i < 6; i++) {
          service.checkIdeaSubmission('participant-1')
        }

        // Exceed limit (violation)
        service.checkIdeaSubmission('participant-1')

        // Advance time slightly but not enough to reset window
        vi.advanceTimersByTime(10 * 1000) // 10 seconds
      }

      // After 3 violations, next submission should trigger 5-minute block
      const blockResult = service.checkIdeaSubmission('participant-1')
      expect(blockResult.allowed).toBe(false)
      expect(blockResult.reason).toContain('Too many violations')
      expect(blockResult.reason).toContain('5 minutes')
      expect(blockResult.retryAfter).toBeGreaterThan(0)
    })

    it('should enforce block duration', () => {
      // Trigger blocking (simplified: just call checkIdeaSubmission during block)
      // Manually set block state
      const participantData = {
        submissions: Array(6).fill(Date.now()),
        violations: 3,
        blockedUntil: Date.now() + 5 * 60 * 1000 // 5 minutes from now
      }
      ;(service as any).participantData.set('participant-1', participantData)

      // Try to submit during block
      const result1 = service.checkIdeaSubmission('participant-1')
      expect(result1.allowed).toBe(false)
      expect(result1.reason).toContain('Temporary block')

      // Advance time by 4 minutes (still blocked)
      vi.advanceTimersByTime(4 * 60 * 1000)
      const result2 = service.checkIdeaSubmission('participant-1')
      expect(result2.allowed).toBe(false)

      // Advance time by 2 more minutes (total 6, past 5-minute block)
      vi.advanceTimersByTime(2 * 60 * 1000)
      const result3 = service.checkIdeaSubmission('participant-1')
      expect(result3.allowed).toBe(true) // Block expired
    })

    it('should track different participants independently', () => {
      // Participant 1 submits 6 ideas
      for (let i = 0; i < 6; i++) {
        service.checkIdeaSubmission('participant-1')
      }

      // Participant 1 is now blocked
      expect(service.checkIdeaSubmission('participant-1').allowed).toBe(false)

      // Participant 2 should still be able to submit
      const result = service.checkIdeaSubmission('participant-2')
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(5)
    })
  })

  describe('Participant Join Rate Limiting', () => {
    beforeEach(() => {
      vi.spyOn(config, 'isFeatureEnabled').mockReturnValue(true)
    })

    it('should allow joins under session capacity', () => {
      for (let i = 0; i < 10; i++) {
        const result = service.checkParticipantJoin('session-1', `participant-${i}`)
        expect(result.allowed).toBe(true)
        expect(result.remaining).toBe(50 - (i + 1))
      }
    })

    it('should block joins after reaching max participants', () => {
      // Fill session to capacity (50 participants)
      for (let i = 0; i < 50; i++) {
        service.checkParticipantJoin('session-1', `participant-${i}`)
      }

      // 51st participant should be blocked
      const result = service.checkParticipantJoin('session-1', 'participant-51')
      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
      expect(result.reason).toContain('maximum capacity')
    })

    it('should allow rejoining with same participant ID', () => {
      service.checkParticipantJoin('session-1', 'participant-1')

      // Same participant joins again (rejoin scenario)
      const result = service.checkParticipantJoin('session-1', 'participant-1')
      expect(result.allowed).toBe(true)
    })

    it('should track different sessions independently', () => {
      // Fill session-1 to capacity
      for (let i = 0; i < 50; i++) {
        service.checkParticipantJoin('session-1', `participant-${i}`)
      }

      // Session-1 is full
      expect(service.checkParticipantJoin('session-1', 'participant-51').allowed).toBe(false)

      // Session-2 should still accept participants
      const result = service.checkParticipantJoin('session-2', 'participant-1')
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(49)
    })
  })

  describe('Participant Management', () => {
    beforeEach(() => {
      vi.spyOn(config, 'isFeatureEnabled').mockReturnValue(true)
    })

    it('should remove participant from session tracking', () => {
      service.checkParticipantJoin('session-1', 'participant-1')
      service.checkParticipantJoin('session-1', 'participant-2')

      // Remove participant-1
      service.removeParticipant('session-1', 'participant-1')

      // Session should now have 1 participant
      const result = service.checkParticipantJoin('session-1', 'participant-3')
      expect(result.remaining).toBe(48) // 50 - 2 (only participant-2 remains)
    })

    it('should clear all session data', () => {
      service.checkParticipantJoin('session-1', 'participant-1')
      service.checkParticipantJoin('session-1', 'participant-2')

      service.clearSession('session-1')

      // After clearing, session should accept 50 participants again
      const result = service.checkParticipantJoin('session-1', 'participant-1')
      expect(result.remaining).toBe(49)
    })
  })

  describe('Status Query', () => {
    beforeEach(() => {
      vi.spyOn(config, 'isFeatureEnabled').mockReturnValue(true)
    })

    it('should return current status for participant', () => {
      // Submit 3 ideas
      service.checkIdeaSubmission('participant-1')
      service.checkIdeaSubmission('participant-1')
      service.checkIdeaSubmission('participant-1')

      const status = service.getStatus('participant-1')
      expect(status.allowed).toBe(true)
      expect(status.remaining).toBe(3) // 6 - 3 = 3
      expect(status.resetIn).toBeGreaterThan(0)
    })

    it('should return status during block', () => {
      // Manually set block
      const participantData = {
        submissions: [],
        violations: 3,
        blockedUntil: Date.now() + 5 * 60 * 1000
      }
      ;(service as any).participantData.set('participant-1', participantData)

      const status = service.getStatus('participant-1')
      expect(status.allowed).toBe(false)
      expect(status.remaining).toBe(0)
      expect(status.reason).toContain('Blocked')
    })
  })

  describe('Reset and Cleanup', () => {
    beforeEach(() => {
      vi.spyOn(config, 'isFeatureEnabled').mockReturnValue(true)
    })

    it('should reset participant rate limit data', () => {
      // Submit ideas and get blocked
      for (let i = 0; i < 6; i++) {
        service.checkIdeaSubmission('participant-1')
      }
      expect(service.checkIdeaSubmission('participant-1').allowed).toBe(false)

      // Reset participant
      service.reset('participant-1')

      // Should be able to submit again
      const result = service.checkIdeaSubmission('participant-1')
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(5)
    })

    it('should cleanup stale data automatically', () => {
      service.checkIdeaSubmission('participant-1')

      // Fast-forward past cleanup threshold (10x window = 10 minutes)
      vi.advanceTimersByTime(11 * 60 * 1000)

      // Trigger cleanup (it runs every 5 minutes)
      vi.advanceTimersByTime(5 * 60 * 1000)
      ;(service as any).cleanup()

      // Participant data should be cleaned up
      const status = service.getStatus('participant-1')
      expect(status.remaining).toBe(6) // Fresh state
    })
  })

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = getRateLimitService()
      const instance2 = getRateLimitService()

      expect(instance1).toBe(instance2)
    })
  })
})
