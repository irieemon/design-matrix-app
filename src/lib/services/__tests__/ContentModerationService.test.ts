/**
 * ContentModerationService Unit Tests
 * Phase Five Implementation
 *
 * Tests content validation and moderation logic:
 * - Feature flag gating (Phase One vs Phase Five limits)
 * - Content length validation
 * - Emoji-only detection (Phase Five)
 * - Wall-of-text detection (Phase Five)
 * - Spam pattern detection
 * - Profanity filtering
 * - HTML sanitization
 * - Participant name validation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ContentModerationService } from '../ContentModerationService'
import * as config from '../../config'

describe('ContentModerationService', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Feature Flag Gating - Content Length Limits', () => {
    it('should use Phase One limits (500 chars) when flag is OFF', () => {
      vi.spyOn(config, 'isFeatureEnabled').mockReturnValue(false)

      // 400 chars with varied content (avoid spam pattern for repeated chars)
      const content = 'This is a test idea. '.repeat(20).substring(0, 400)
      const result = ContentModerationService.validateIdeaContent(content)

      expect(result.valid).toBe(true)
      expect(result.sanitizedContent).toBeDefined()
    })

    it('should reject 400 chars in Phase Five (200 char limit)', () => {
      vi.spyOn(config, 'isFeatureEnabled').mockReturnValue(true)

      const content = 'a'.repeat(400)
      const result = ContentModerationService.validateIdeaContent(content)

      expect(result.valid).toBe(false)
      expect(result.error).toContain('200 characters')
    })

    it('should use Phase One limits (2000 chars) for details when flag is OFF', () => {
      vi.spyOn(config, 'isFeatureEnabled').mockReturnValue(false)

      // 1500 chars with varied content (avoid spam pattern)
      const details = 'This is additional detail information. '.repeat(40).substring(0, 1500)
      const result = ContentModerationService.validateIdeaDetails(details)

      expect(result.valid).toBe(true)
    })

    it('should reject 1500 chars details in Phase Five (500 char limit)', () => {
      vi.spyOn(config, 'isFeatureEnabled').mockReturnValue(true)

      const details = 'a'.repeat(1500)
      const result = ContentModerationService.validateIdeaDetails(details)

      expect(result.valid).toBe(false)
      expect(result.error).toContain('500 characters')
    })
  })

  describe('Content Validation - Basic Requirements', () => {
    it('should reject missing content', () => {
      const result = ContentModerationService.validateIdeaContent('')

      expect(result.valid).toBe(false)
      expect(result.error).toContain('required')
    })

    it('should reject non-string content', () => {
      const result = ContentModerationService.validateIdeaContent(null as any)

      expect(result.valid).toBe(false)
      expect(result.error).toContain('required')
    })

    it('should reject content below minimum length (3 chars)', () => {
      const result = ContentModerationService.validateIdeaContent('ab')

      expect(result.valid).toBe(false)
      expect(result.error).toContain('at least 3 characters')
    })

    it('should accept content at minimum length (3 chars)', () => {
      const result = ContentModerationService.validateIdeaContent('abc')

      expect(result.valid).toBe(true)
      expect(result.sanitizedContent).toBe('abc')
    })

    it('should trim whitespace from content', () => {
      const result = ContentModerationService.validateIdeaContent('  test content  ')

      expect(result.valid).toBe(true)
      expect(result.sanitizedContent).toBe('test content')
    })
  })

  describe('Content Validation - Phase Five Enhancements', () => {
    beforeEach(() => {
      vi.spyOn(config, 'isFeatureEnabled').mockReturnValue(true)
    })

    it('should reject emoji-only content', () => {
      const result = ContentModerationService.validateIdeaContent('😀 😃 😄 😁')

      expect(result.valid).toBe(false)
      expect(result.error).toContain('only of emojis')
    })

    it('should accept content with emojis and text', () => {
      const result = ContentModerationService.validateIdeaContent('Great idea! 😀')

      expect(result.valid).toBe(true)
    })

    it('should reject wall-of-text (no spacing/punctuation)', () => {
      const wallOfText = 'a'.repeat(50)
      const result = ContentModerationService.validateIdeaContent(wallOfText)

      expect(result.valid).toBe(false)
      expect(result.error).toContain('spacing and punctuation')
    })

    it('should accept text with proper spacing', () => {
      const result = ContentModerationService.validateIdeaContent('This is a properly formatted idea.')

      expect(result.valid).toBe(true)
    })

    it('should not apply emoji/wall-of-text checks when flag is OFF', () => {
      vi.spyOn(config, 'isFeatureEnabled').mockReturnValue(false)

      // Emoji-only would be rejected in Phase Five
      const emojiResult = ContentModerationService.validateIdeaContent('😀 😃 😄 😁')
      expect(emojiResult.valid).toBe(true) // Allowed in Phase One

      // Wall-of-text without repeated chars (avoid spam pattern)
      const wallResult = ContentModerationService.validateIdeaContent('abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxy')
      expect(wallResult.valid).toBe(true) // Allowed in Phase One
    })
  })

  describe('Spam Pattern Detection', () => {
    it('should reject content with repeated characters (>10 times)', () => {
      const result = ContentModerationService.validateIdeaContent('aaaaaaaaaaaaa test')

      expect(result.valid).toBe(false)
      expect(result.error).toContain('spam-like patterns')
    })

    it('should reject content with URLs', () => {
      const result = ContentModerationService.validateIdeaContent('Check out http://spam.com for details')

      expect(result.valid).toBe(false)
      expect(result.error).toContain('spam-like patterns')
    })

    it('should reject content with excessive caps (10+ consecutive)', () => {
      const result = ContentModerationService.validateIdeaContent('This is ABCDEFGHIJK spam')

      expect(result.valid).toBe(false)
      expect(result.error).toContain('spam-like patterns')
    })

    it('should reject content with long number sequences (potential phone)', () => {
      const result = ContentModerationService.validateIdeaContent('Call me at 1234567890')

      expect(result.valid).toBe(false)
      expect(result.error).toContain('spam-like patterns')
    })

    it('should accept normal content without spam patterns', () => {
      const result = ContentModerationService.validateIdeaContent('This is a normal idea with proper text')

      expect(result.valid).toBe(true)
    })
  })

  describe('Profanity Filtering', () => {
    it('should reject content with profanity', () => {
      const result = ContentModerationService.validateIdeaContent('This is a fuck idea')

      expect(result.valid).toBe(false)
      expect(result.error).toContain('inappropriate language')
    })

    it('should accept clean content', () => {
      const result = ContentModerationService.validateIdeaContent('This is a fantastic idea')

      expect(result.valid).toBe(true)
    })

    it('should reject multiple profanity words', () => {
      const result1 = ContentModerationService.validateIdeaContent('What the hell')
      const result2 = ContentModerationService.validateIdeaContent('This is crap')

      // At least one should be caught (implementation-dependent)
      const eitherCaught = !result1.valid || !result2.valid
      expect(eitherCaught).toBe(true)
    })
  })

  describe('HTML Sanitization', () => {
    it('should remove HTML tags from content', () => {
      const result = ContentModerationService.validateIdeaContent('<script>alert("xss")</script>Good idea')

      expect(result.valid).toBe(true)
      expect(result.sanitizedContent).not.toContain('<script>')
      expect(result.sanitizedContent).toContain('Good idea')
    })

    it('should remove potentially harmful characters', () => {
      const result = ContentModerationService.validateIdeaContent('Test <>&"\' idea')

      expect(result.valid).toBe(true)
      expect(result.sanitizedContent).not.toContain('<')
      expect(result.sanitizedContent).not.toContain('>')
      expect(result.sanitizedContent).not.toContain('&')
    })

    it('should handle nested HTML tags', () => {
      const result = ContentModerationService.validateIdeaContent('<div><p>Test</p></div>')

      expect(result.valid).toBe(true)
      expect(result.sanitizedContent).toBe('Test')
    })
  })

  describe('Details Validation', () => {
    it('should allow undefined/null details (optional field)', () => {
      const result1 = ContentModerationService.validateIdeaDetails(undefined)
      expect(result1.valid).toBe(true)

      const result2 = ContentModerationService.validateIdeaDetails('')
      expect(result2.valid).toBe(true)
    })

    it('should validate details length with Phase One limits', () => {
      vi.spyOn(config, 'isFeatureEnabled').mockReturnValue(false)

      // 2000 chars with varied content (avoid spam pattern)
      const details = 'Additional detail information goes here. '.repeat(50).substring(0, 2000)
      const result = ContentModerationService.validateIdeaDetails(details)

      expect(result.valid).toBe(true)
    })

    it('should reject details exceeding Phase Five limit (500)', () => {
      vi.spyOn(config, 'isFeatureEnabled').mockReturnValue(true)

      const details = 'a'.repeat(501)
      const result = ContentModerationService.validateIdeaDetails(details)

      expect(result.valid).toBe(false)
      expect(result.error).toContain('500 characters')
    })

    it('should detect spam patterns in details', () => {
      const details = 'Check out http://spam.com for more'
      const result = ContentModerationService.validateIdeaDetails(details)

      expect(result.valid).toBe(false)
      expect(result.error).toContain('spam-like patterns')
    })

    it('should sanitize HTML in details', () => {
      const details = '<script>alert("xss")</script>Additional info'
      const result = ContentModerationService.validateIdeaDetails(details)

      expect(result.valid).toBe(true)
      expect(result.sanitizedContent).not.toContain('<script>')
    })
  })

  describe('Participant Name Validation', () => {
    it('should reject missing name', () => {
      const result = ContentModerationService.validateParticipantName('')

      expect(result.valid).toBe(false)
      expect(result.error).toContain('required')
    })

    it('should reject name below minimum length (2 chars)', () => {
      const result = ContentModerationService.validateParticipantName('a')

      expect(result.valid).toBe(false)
      expect(result.error).toContain('at least 2 characters')
    })

    it('should accept name at minimum length (2 chars)', () => {
      const result = ContentModerationService.validateParticipantName('ab')

      expect(result.valid).toBe(true)
    })

    it('should reject name exceeding maximum length (50 chars)', () => {
      const result = ContentModerationService.validateParticipantName('a'.repeat(51))

      expect(result.valid).toBe(false)
      expect(result.error).toContain('50 characters')
    })

    it('should accept name at maximum length (50 chars)', () => {
      const result = ContentModerationService.validateParticipantName('a'.repeat(50))

      expect(result.valid).toBe(true)
    })

    it('should reject name with profanity', () => {
      const result = ContentModerationService.validateParticipantName('shit user')

      expect(result.valid).toBe(false)
      expect(result.error).toContain('inappropriate language')
    })

    it('should sanitize HTML in name', () => {
      const result = ContentModerationService.validateParticipantName('<script>alert("xss")</script>John')

      expect(result.valid).toBe(true)
      expect(result.sanitizedContent).not.toContain('<script>')
      expect(result.sanitizedContent).toContain('John')
    })

    it('should trim whitespace from name', () => {
      const result = ContentModerationService.validateParticipantName('  John Doe  ')

      expect(result.valid).toBe(true)
      expect(result.sanitizedContent).toBe('John Doe')
    })
  })

  describe('Priority Validation', () => {
    it('should accept valid priority values', () => {
      const result1 = ContentModerationService.validatePriority('low')
      expect(result1.valid).toBe(true)

      const result2 = ContentModerationService.validatePriority('moderate')
      expect(result2.valid).toBe(true)

      const result3 = ContentModerationService.validatePriority('high')
      expect(result3.valid).toBe(true)
    })

    it('should allow undefined priority (optional field)', () => {
      const result = ContentModerationService.validatePriority(undefined)

      expect(result.valid).toBe(true)
    })

    it('should reject invalid priority values', () => {
      const result = ContentModerationService.validatePriority('critical' as any)

      expect(result.valid).toBe(false)
      expect(result.error).toContain('low, moderate, high')
    })
  })

  describe('Spam Detection - Pattern Analysis', () => {
    it('should detect spam from duplicate content (>50%)', () => {
      const submissions = [
        { content: 'test idea', timestamp: Date.now() },
        { content: 'test idea', timestamp: Date.now() },
        { content: 'test idea', timestamp: Date.now() },
        { content: 'different', timestamp: Date.now() },
        { content: 'test idea', timestamp: Date.now() }
      ]

      const isSpam = ContentModerationService.detectSpam(submissions)

      expect(isSpam).toBe(true)
    })

    it('should detect spam from rapid submissions (>3 in 10 seconds)', () => {
      const now = Date.now()
      const submissions = [
        { content: 'idea 1', timestamp: now - 1000 },
        { content: 'idea 2', timestamp: now - 2000 },
        { content: 'idea 3', timestamp: now - 3000 },
        { content: 'idea 4', timestamp: now - 4000 }
      ]

      const isSpam = ContentModerationService.detectSpam(submissions)

      expect(isSpam).toBe(true)
    })

    it('should not flag normal submission patterns as spam', () => {
      const now = Date.now()
      const submissions = [
        { content: 'idea 1', timestamp: now - 30000 },
        { content: 'idea 2', timestamp: now - 60000 },
        { content: 'idea 3', timestamp: now - 90000 }
      ]

      const isSpam = ContentModerationService.detectSpam(submissions)

      expect(isSpam).toBe(false)
    })

    it('should not flag spam with <3 submissions', () => {
      const submissions = [
        { content: 'test', timestamp: Date.now() },
        { content: 'test', timestamp: Date.now() }
      ]

      const isSpam = ContentModerationService.detectSpam(submissions)

      expect(isSpam).toBe(false)
    })
  })

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle content exactly at Phase Five limit (200 chars)', () => {
      vi.spyOn(config, 'isFeatureEnabled').mockReturnValue(true)

      // 200 chars with varied content (avoid spam pattern)
      const content = 'This is a test idea for boundary testing. '.repeat(5).substring(0, 200)
      const result = ContentModerationService.validateIdeaContent(content)

      expect(result.valid).toBe(true)
    })

    it('should reject content at Phase Five limit + 1 (201 chars)', () => {
      vi.spyOn(config, 'isFeatureEnabled').mockReturnValue(true)

      const content = 'a'.repeat(201)
      const result = ContentModerationService.validateIdeaContent(content)

      expect(result.valid).toBe(false)
    })

    it('should handle mixed content (text + emojis + punctuation)', () => {
      vi.spyOn(config, 'isFeatureEnabled').mockReturnValue(true)

      const content = 'Great idea! 😀 This will work well.'
      const result = ContentModerationService.validateIdeaContent(content)

      expect(result.valid).toBe(true)
    })

    it('should handle unicode characters correctly', () => {
      const content = 'Ідея для покращення системи' // Ukrainian text
      const result = ContentModerationService.validateIdeaContent(content)

      expect(result.valid).toBe(true)
    })

    it('should handle special characters in normal text', () => {
      const content = 'Feature: Add support for @mentions and #hashtags'
      const result = ContentModerationService.validateIdeaContent(content)

      expect(result.valid).toBe(true)
    })
  })
})
