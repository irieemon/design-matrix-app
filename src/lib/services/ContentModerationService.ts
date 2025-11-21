/**
 * Content Moderation Service
 * Phase One + Phase Five Enhancements
 *
 * Input validation and spam prevention for brainstorm submissions
 * Phase Five adds stricter limits and enhanced detection
 */

import { isFeatureEnabled } from '../config'

export interface ModerationResult {
  valid: boolean
  error?: string
  sanitizedContent?: string
}

export class ContentModerationService {
  // Phase Five: Stricter length limits (when flag enabled)
  // Phase One: 500 chars for content, 2000 for details
  // Phase Five: 200 chars for content, 500 for details
  private static readonly MAX_CONTENT_LENGTH_PHASE5 = 200
  private static readonly MAX_CONTENT_LENGTH_PHASE1 = 500
  private static readonly MAX_DETAILS_LENGTH_PHASE5 = 500
  private static readonly MAX_DETAILS_LENGTH_PHASE1 = 2000

  // Minimum length for idea content
  private static readonly MIN_CONTENT_LENGTH = 3

  // Basic profanity filter (can be expanded)
  private static readonly PROFANITY_PATTERNS = [
    /\b(fuck|shit|damn|crap|hell|ass|bitch)\b/gi
    // Add more patterns as needed
  ]

  // Spam patterns (enhanced in Phase Five)
  private static readonly SPAM_PATTERNS = [
    /(.)\1{10,}/, // Repeated characters (more than 10 times)
    /https?:\/\/[^\s]+/gi, // URLs
    /\b[A-Z]{10,}\b/g, // Excessive caps (10+ consecutive uppercase letters)
    /\b\d{10,}\b/g // Long number sequences (potential phone numbers)
  ]

  // Phase Five: Emoji-only detection pattern
  private static readonly EMOJI_ONLY_PATTERN = /^[\p{Emoji}\s]+$/u

  // Phase Five: Wall-of-text detection (no punctuation or spacing)
  private static readonly WALL_OF_TEXT_PATTERN = /^[^\s.!?,;:]{50,}$/

  /**
   * Validate and sanitize idea content
   */
  static validateIdeaContent(content: string): ModerationResult {
    // Check if content exists
    if (!content || typeof content !== 'string') {
      return {
        valid: false,
        error: 'Content is required'
      }
    }

    // Trim whitespace
    const trimmedContent = content.trim()

    // Check minimum length
    if (trimmedContent.length < this.MIN_CONTENT_LENGTH) {
      return {
        valid: false,
        error: `Content must be at least ${this.MIN_CONTENT_LENGTH} characters`
      }
    }

    // Phase Five: Stricter length limits
    const maxLength = isFeatureEnabled('MOBILE_BRAINSTORM_PHASE5')
      ? this.MAX_CONTENT_LENGTH_PHASE5
      : this.MAX_CONTENT_LENGTH_PHASE1

    // Check maximum length
    if (trimmedContent.length > maxLength) {
      return {
        valid: false,
        error: `Content must not exceed ${maxLength} characters`
      }
    }

    // Phase Five: Check for emoji-only content
    if (isFeatureEnabled('MOBILE_BRAINSTORM_PHASE5')) {
      if (this.EMOJI_ONLY_PATTERN.test(trimmedContent)) {
        return {
          valid: false,
          error: 'Content cannot consist only of emojis'
        }
      }

      // Phase Five: Check for wall-of-text (no spacing/punctuation)
      if (this.WALL_OF_TEXT_PATTERN.test(trimmedContent)) {
        return {
          valid: false,
          error: 'Content must include proper spacing and punctuation'
        }
      }
    }

    // Check for spam patterns
    for (const pattern of this.SPAM_PATTERNS) {
      if (pattern.test(trimmedContent)) {
        return {
          valid: false,
          error: 'Content contains spam-like patterns'
        }
      }
    }

    // Sanitize HTML tags
    const sanitized = this.sanitizeHtml(trimmedContent)

    // Check for profanity (optional - can be made configurable)
    const hasProfanity = this.containsProfanity(sanitized)
    if (hasProfanity) {
      return {
        valid: false,
        error: 'Content contains inappropriate language'
      }
    }

    return {
      valid: true,
      sanitizedContent: sanitized
    }
  }

  /**
   * Validate idea details (optional field)
   */
  static validateIdeaDetails(details?: string): ModerationResult {
    // Details are optional
    if (!details) {
      return {
        valid: true,
        sanitizedContent: undefined
      }
    }

    // Trim whitespace
    const trimmedDetails = details.trim()

    // Phase Five: Stricter length limits
    const maxLength = isFeatureEnabled('MOBILE_BRAINSTORM_PHASE5')
      ? this.MAX_DETAILS_LENGTH_PHASE5
      : this.MAX_DETAILS_LENGTH_PHASE1

    // Check maximum length
    if (trimmedDetails.length > maxLength) {
      return {
        valid: false,
        error: `Details must not exceed ${maxLength} characters`
      }
    }

    // Check for spam patterns
    for (const pattern of this.SPAM_PATTERNS) {
      if (pattern.test(trimmedDetails)) {
        return {
          valid: false,
          error: 'Details contain spam-like patterns'
        }
      }
    }

    // Sanitize HTML tags
    const sanitized = this.sanitizeHtml(trimmedDetails)

    return {
      valid: true,
      sanitizedContent: sanitized
    }
  }

  /**
   * Validate participant name
   */
  static validateParticipantName(name: string): ModerationResult {
    if (!name || typeof name !== 'string') {
      return {
        valid: false,
        error: 'Participant name is required'
      }
    }

    const trimmedName = name.trim()

    if (trimmedName.length < 2) {
      return {
        valid: false,
        error: 'Participant name must be at least 2 characters'
      }
    }

    if (trimmedName.length > 50) {
      return {
        valid: false,
        error: 'Participant name must not exceed 50 characters'
      }
    }

    // Sanitize
    const sanitized = this.sanitizeHtml(trimmedName)

    // Check for profanity
    if (this.containsProfanity(sanitized)) {
      return {
        valid: false,
        error: 'Participant name contains inappropriate language'
      }
    }

    return {
      valid: true,
      sanitizedContent: sanitized
    }
  }

  /**
   * Remove HTML tags and potentially harmful characters
   */
  private static sanitizeHtml(input: string): string {
    // Remove HTML tags
    let sanitized = input.replace(/<[^>]*>/g, '')

    // Remove script content
    sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')

    // Remove potentially harmful characters
    sanitized = sanitized.replace(/[<>\"'&]/g, '')

    return sanitized.trim()
  }

  /**
   * Check for profanity
   */
  private static containsProfanity(text: string): boolean {
    for (const pattern of this.PROFANITY_PATTERNS) {
      if (pattern.test(text)) {
        return true
      }
    }
    return false
  }

  /**
   * Detect potential spam based on submission patterns
   */
  static detectSpam(submissions: { content: string; timestamp: number }[]): boolean {
    if (submissions.length < 3) {
      return false
    }

    // Check for identical or very similar content
    const recentSubmissions = submissions.slice(-5)
    const contents = recentSubmissions.map((s) => s.content.toLowerCase())

    // Check for duplicate content
    const uniqueContents = new Set(contents)
    if (uniqueContents.size < contents.length * 0.5) {
      return true // More than 50% duplicates
    }

    // Check submission rate (more than 3 in 10 seconds)
    const now = Date.now()
    const recentCount = submissions.filter((s) => now - s.timestamp < 10000).length
    if (recentCount > 3) {
      return true
    }

    return false
  }

  /**
   * Validate priority value
   */
  static validatePriority(
    priority?: 'low' | 'moderate' | 'high'
  ): { valid: boolean; error?: string } {
    if (!priority) {
      return { valid: true } // Priority is optional
    }

    const validPriorities = ['low', 'moderate', 'high']
    if (!validPriorities.includes(priority)) {
      return {
        valid: false,
        error: 'Priority must be one of: low, moderate, high'
      }
    }

    return { valid: true }
  }
}
