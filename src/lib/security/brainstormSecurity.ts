/**
 * Brainstorm Security Utilities
 * Phase One Implementation
 *
 * Cryptographically secure token generation and device fingerprinting
 */

import { v4 as uuidv4 } from 'uuid'

/**
 * Generate cryptographically secure access token (UUID v4)
 */
export function generateAccessToken(): string {
  return uuidv4()
}

/**
 * Generate human-readable join code (ABCD-1234 format)
 * Format: 4 uppercase letters + hyphen + 4 digits
 */
export function generateJoinCode(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ' // Exclude I, O for readability
  const digits = '0123456789'

  let code = ''

  // Generate 4 random letters
  for (let i = 0; i < 4; i++) {
    code += letters.charAt(Math.floor(Math.random() * letters.length))
  }

  code += '-'

  // Generate 4 random digits
  for (let i = 0; i < 4; i++) {
    code += digits.charAt(Math.floor(Math.random() * digits.length))
  }

  return code
}

/**
 * Generate device fingerprint from browser/device characteristics
 * Client-side only - combines canvas, user-agent, and screen size
 *
 * @param canvas Optional canvas element for fingerprinting
 * @param userAgent Browser user agent string
 * @param screenSize Screen dimensions
 * @returns SHA-256 hash of combined fingerprint data
 */
export async function generateDeviceFingerprint(
  canvas?: HTMLCanvasElement,
  userAgent?: string,
  screenSize?: { width: number; height: number }
): Promise<string> {
  const components: string[] = []

  // User agent
  if (userAgent) {
    components.push(userAgent)
  } else if (typeof navigator !== 'undefined') {
    components.push(navigator.userAgent)
  }

  // Screen size
  if (screenSize) {
    components.push(`${screenSize.width}x${screenSize.height}`)
  } else if (typeof window !== 'undefined') {
    components.push(`${window.screen.width}x${window.screen.height}`)
  }

  // Canvas fingerprint (optional, for higher uniqueness)
  if (canvas) {
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.textBaseline = 'top'
      ctx.font = '14px Arial'
      ctx.fillStyle = '#f60'
      ctx.fillRect(125, 1, 62, 20)
      ctx.fillStyle = '#069'
      ctx.fillText('Design Matrix', 2, 15)
      components.push(canvas.toDataURL())
    }
  }

  // Platform and language
  if (typeof navigator !== 'undefined') {
    components.push(navigator.platform || '')
    components.push(navigator.language || '')
  }

  // Combine all components
  const fingerprintString = components.join('|')

  // Hash using SHA-256
  return hashString(fingerprintString)
}

/**
 * Hash a string using SHA-256
 * Browser-compatible implementation
 */
async function hashString(str: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    // Browser environment with Web Crypto API
    const encoder = new TextEncoder()
    const data = encoder.encode(str)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
    return hashHex
  } else {
    // Fallback for environments without Web Crypto API
    // Simple hash function (not cryptographically secure, but sufficient for fingerprinting)
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16)
  }
}

/**
 * Validate access token format (UUID v4)
 */
export function isValidAccessToken(token: string): boolean {
  const uuidV4Regex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidV4Regex.test(token)
}

/**
 * Validate join code format (ABCD-1234)
 */
export function isValidJoinCode(code: string): boolean {
  const joinCodeRegex = /^[A-Z]{4}-\d{4}$/
  return joinCodeRegex.test(code)
}

/**
 * Sanitize participant name for security
 * Remove potentially harmful characters, limit length
 */
export function sanitizeParticipantName(name: string): string {
  // Remove HTML tags and script content
  let sanitized = name.replace(/<[^>]*>/g, '')

  // Remove special characters that could be problematic
  sanitized = sanitized.replace(/[<>\"'&]/g, '')

  // Trim whitespace
  sanitized = sanitized.trim()

  // Limit length to 50 characters
  if (sanitized.length > 50) {
    sanitized = sanitized.substring(0, 50)
  }

  // If empty after sanitization, return default
  if (!sanitized) {
    return `Participant ${Math.floor(Math.random() * 9000) + 1000}`
  }

  return sanitized
}

/**
 * Rate limiting helper
 * Tracks request timestamps per identifier
 */
export class RateLimiter {
  private requestLog: Map<string, number[]> = new Map()

  /**
   * Check if request is allowed under rate limit
   *
   * @param identifier Unique identifier (e.g., participantId, IP address)
   * @param maxRequests Maximum requests allowed in time window
   * @param windowMs Time window in milliseconds
   * @returns { allowed: boolean, retryAfter?: number }
   */
  checkLimit(
    identifier: string,
    maxRequests: number,
    windowMs: number
  ): { allowed: boolean; retryAfter?: number } {
    const now = Date.now()
    const requests = this.requestLog.get(identifier) || []

    // Remove requests outside the time window
    const recentRequests = requests.filter((timestamp) => now - timestamp < windowMs)

    if (recentRequests.length >= maxRequests) {
      // Rate limit exceeded
      const oldestRequest = recentRequests[0]
      const retryAfter = Math.ceil((oldestRequest + windowMs - now) / 1000) // seconds

      return {
        allowed: false,
        retryAfter
      }
    }

    // Allow request and log timestamp
    recentRequests.push(now)
    this.requestLog.set(identifier, recentRequests)

    return { allowed: true }
  }

  /**
   * Clear rate limit data for an identifier
   */
  clear(identifier: string): void {
    this.requestLog.delete(identifier)
  }

  /**
   * Clear all rate limit data
   */
  clearAll(): void {
    this.requestLog.clear()
  }

  /**
   * Get remaining requests for an identifier
   */
  getRemaining(identifier: string, maxRequests: number, windowMs: number): number {
    const now = Date.now()
    const requests = this.requestLog.get(identifier) || []
    const recentRequests = requests.filter((timestamp) => now - timestamp < windowMs)
    return Math.max(0, maxRequests - recentRequests.length)
  }
}

/**
 * Global rate limiter instance for idea submissions
 * 6 submissions per minute per participant
 */
export const ideaSubmissionRateLimiter = new RateLimiter()

/**
 * Validate session is not expired
 */
export function isSessionExpired(expiresAt: string): boolean {
  return new Date(expiresAt) < new Date()
}

/**
 * Calculate session time remaining in milliseconds
 */
export function getSessionTimeRemaining(expiresAt: string): number {
  const remaining = new Date(expiresAt).getTime() - Date.now()
  return Math.max(0, remaining)
}

/**
 * Format time remaining for display (e.g., "45:30")
 */
export function formatTimeRemaining(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}
