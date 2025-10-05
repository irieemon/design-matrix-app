/**
 * Security Middleware Tests
 * Tests session validation, security headers, XSS prevention, and rate limiting
 * These tests don't require mocking Supabase
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { VercelRequest, VercelResponse } from '@vercel/node'
import {
  validateSession,
  securityMiddleware,
  sanitizeRequest,
  checkUserRateLimit
} from '../../../api/auth/middleware'

describe('Security Middleware Tests', () => {
  let mockReq: Partial<VercelRequest>
  let mockRes: Partial<VercelResponse>
  let nextFn: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockReq = {
      headers: {},
      body: {},
      method: 'GET'
    }

    nextFn = vi.fn()

    mockRes = {
      setHeader: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis()
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('validateSession() - Session Security', () => {
    it('should accept valid user agent', () => {
      mockReq.headers = {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }

      const result = validateSession(mockReq as VercelRequest)
      expect(result).toBe(true)
    })

    it('should reject missing user agent', () => {
      mockReq.headers = {}

      const result = validateSession(mockReq as VercelRequest)
      expect(result).toBe(false)
    })

    it('should reject short user agent (potential bot)', () => {
      mockReq.headers = {
        'user-agent': 'short'
      }

      const result = validateSession(mockReq as VercelRequest)
      expect(result).toBe(false)
    })

    it('should reject bot user agents', () => {
      const botUserAgents = [
        'Googlebot/2.1',
        'Mozilla/5.0 (compatible; bingbot/2.0)',
        'crawler-service/1.0',
        'spider-bot/1.0',
        'scraper-tool/2.0'
      ]

      botUserAgents.forEach(userAgent => {
        mockReq.headers = { 'user-agent': userAgent }
        const result = validateSession(mockReq as VercelRequest)
        expect(result).toBe(false)
      })
    })
  })

  describe('securityMiddleware() - Security Headers', () => {
    it('should set all required security headers', () => {
      securityMiddleware(mockReq as VercelRequest, mockRes as VercelResponse, nextFn)

      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff')
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY')
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-XSS-Protection', '1; mode=block')
      expect(mockRes.setHeader).toHaveBeenCalledWith('Referrer-Policy', 'strict-origin-when-cross-origin')
      expect(nextFn).toHaveBeenCalled()
    })

    it('should reject POST request without JSON content-type', () => {
      mockReq.method = 'POST'
      mockReq.headers = {
        'content-type': 'text/plain'
      }

      securityMiddleware(mockReq as VercelRequest, mockRes as VercelResponse)

      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Content-Type must be application/json' })
    })

    it('should accept POST request with JSON content-type', () => {
      mockReq.method = 'POST'
      mockReq.headers = {
        'content-type': 'application/json'
      }

      securityMiddleware(mockReq as VercelRequest, mockRes as VercelResponse, nextFn)

      expect(nextFn).toHaveBeenCalled()
      expect(mockRes.status).not.toHaveBeenCalledWith(400)
    })

    it('should accept PUT request with JSON content-type', () => {
      mockReq.method = 'PUT'
      mockReq.headers = {
        'content-type': 'application/json'
      }

      securityMiddleware(mockReq as VercelRequest, mockRes as VercelResponse, nextFn)

      expect(nextFn).toHaveBeenCalled()
      expect(mockRes.status).not.toHaveBeenCalledWith(400)
    })

    it('should accept PATCH request with JSON content-type', () => {
      mockReq.method = 'PATCH'
      mockReq.headers = {
        'content-type': 'application/json'
      }

      securityMiddleware(mockReq as VercelRequest, mockRes as VercelResponse, nextFn)

      expect(nextFn).toHaveBeenCalled()
      expect(mockRes.status).not.toHaveBeenCalledWith(400)
    })

    it('should reject request exceeding content-length limit', () => {
      mockReq.method = 'POST'
      mockReq.headers = {
        'content-type': 'application/json',
        'content-length': String(11 * 1024 * 1024) // 11MB (over 10MB limit)
      }

      securityMiddleware(mockReq as VercelRequest, mockRes as VercelResponse)

      expect(mockRes.status).toHaveBeenCalledWith(413)
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Request body too large' })
    })

    it('should accept request within content-length limit', () => {
      mockReq.method = 'POST'
      mockReq.headers = {
        'content-type': 'application/json',
        'content-length': String(5 * 1024 * 1024) // 5MB (under 10MB limit)
      }

      securityMiddleware(mockReq as VercelRequest, mockRes as VercelResponse, nextFn)

      expect(nextFn).toHaveBeenCalled()
      expect(mockRes.status).not.toHaveBeenCalledWith(413)
    })

    it('should accept GET request without content-type check', () => {
      mockReq.method = 'GET'
      mockReq.headers = {}

      securityMiddleware(mockReq as VercelRequest, mockRes as VercelResponse, nextFn)

      expect(nextFn).toHaveBeenCalled()
      expect(mockRes.status).not.toHaveBeenCalledWith(400)
    })
  })

  describe('sanitizeRequest() - XSS Prevention', () => {
    it('should remove script tags from request body', () => {
      mockReq.body = {
        title: '<script>alert("xss")</script>Legitimate Title',
        description: 'Safe description'
      }

      sanitizeRequest(mockReq as VercelRequest)

      expect(mockReq.body.title).toBe('Legitimate Title')
      expect(mockReq.body.description).toBe('Safe description')
    })

    it('should remove multiple script tags', () => {
      mockReq.body = {
        content: '<script>bad1()</script>Good<script>bad2()</script>'
      }

      sanitizeRequest(mockReq as VercelRequest)

      expect(mockReq.body.content).toBe('Good')
    })

    it('should remove javascript: protocol from request body', () => {
      mockReq.body = {
        url: 'javascript:alert("xss")',
        link: 'https://example.com'
      }

      sanitizeRequest(mockReq as VercelRequest)

      expect(mockReq.body.url).not.toContain('javascript:')
      expect(mockReq.body.link).toBe('https://example.com')
    })

    it('should remove inline event handlers from request body', () => {
      mockReq.body = {
        html: '<div onclick="alert(\'xss\')">Click me</div>',
        safe: '<div>Safe content</div>'
      }

      sanitizeRequest(mockReq as VercelRequest)

      expect(mockReq.body.html).not.toContain('onclick=')
      expect(mockReq.body.safe).toContain('Safe content')
    })

    it('should remove all common event handlers', () => {
      mockReq.body = {
        content: 'onload=bad onmouseover=bad onerror=bad onfocus=bad'
      }

      sanitizeRequest(mockReq as VercelRequest)

      expect(mockReq.body.content).not.toContain('onload=')
      expect(mockReq.body.content).not.toContain('onmouseover=')
      expect(mockReq.body.content).not.toContain('onerror=')
      expect(mockReq.body.content).not.toContain('onfocus=')
    })

    it('should handle nested objects in request body', () => {
      mockReq.body = {
        user: {
          name: '<script>alert("xss")</script>John',
          bio: 'Developer'
        }
      }

      sanitizeRequest(mockReq as VercelRequest)

      // Only top-level strings are sanitized in current implementation
      // This test documents current behavior
      expect(mockReq.body.user.name).toContain('<script>') // Not sanitized (nested)
    })

    it('should handle empty request body safely', () => {
      mockReq.body = {}

      expect(() => sanitizeRequest(mockReq as VercelRequest)).not.toThrow()
    })

    it('should handle null request body safely', () => {
      mockReq.body = null

      expect(() => sanitizeRequest(mockReq as VercelRequest)).not.toThrow()
    })
  })

  describe('checkUserRateLimit() - Rate Limiting', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should allow requests under rate limit', () => {
      const userId = `test-ratelimit-${Date.now()}-1`
      const limit = 10

      // Make 9 requests (under limit of 10)
      for (let i = 0; i < 9; i++) {
        const result = checkUserRateLimit(userId, limit, 60000)
        expect(result).toBe(true)
      }
    })

    it('should block requests over rate limit', () => {
      const userId = `test-ratelimit-${Date.now()}-2`
      const limit = 10

      // Make 10 requests (at limit)
      for (let i = 0; i < 10; i++) {
        const result = checkUserRateLimit(userId, limit, 60000)
        expect(result).toBe(true)
      }

      // 11th request should be blocked
      const result = checkUserRateLimit(userId, limit, 60000)
      expect(result).toBe(false)
    })

    it('should reset rate limit after window expiration', () => {
      const userId = `test-ratelimit-${Date.now()}-3`
      const limit = 5
      const windowMs = 60000 // 1 minute

      // Make 5 requests (at limit)
      for (let i = 0; i < 5; i++) {
        checkUserRateLimit(userId, limit, windowMs)
      }

      // 6th request should be blocked
      expect(checkUserRateLimit(userId, limit, windowMs)).toBe(false)

      // Fast-forward time beyond window
      vi.advanceTimersByTime(61000) // 61 seconds

      // Should allow requests again after reset
      expect(checkUserRateLimit(userId, limit, windowMs)).toBe(true)
    })

    it('should handle different users independently', () => {
      const timestamp = Date.now()
      const user1Id = `test-ratelimit-${timestamp}-4a`
      const user2Id = `test-ratelimit-${timestamp}-4b`
      const limit = 5

      // User 1 makes 5 requests
      for (let i = 0; i < 5; i++) {
        checkUserRateLimit(user1Id, limit, 60000)
      }

      // User 1 should be blocked
      expect(checkUserRateLimit(user1Id, limit, 60000)).toBe(false)

      // User 2 should still be allowed
      expect(checkUserRateLimit(user2Id, limit, 60000)).toBe(true)
    })

    it('should sanitize userId to prevent injection attacks', () => {
      const maliciousUserId = '<script>alert("xss")</script>'
      const limit = 10

      // Should not throw error and should handle safely
      const result = checkUserRateLimit(maliciousUserId, limit, 60000)
      expect(result).toBe(true)
    })

    it('should use default limit and window when not specified', () => {
      const userId = `test-ratelimit-${Date.now()}-5`

      // Should use default limit (10) and window (60000ms)
      const result = checkUserRateLimit(userId)
      expect(result).toBe(true)
    })

    it('should handle very short rate limit windows', () => {
      const userId = `test-ratelimit-${Date.now()}-6`
      const limit = 2
      const windowMs = 100 // 100ms

      // Make 2 requests
      expect(checkUserRateLimit(userId, limit, windowMs)).toBe(true)
      expect(checkUserRateLimit(userId, limit, windowMs)).toBe(true)

      // 3rd should be blocked
      expect(checkUserRateLimit(userId, limit, windowMs)).toBe(false)

      // Fast-forward past window
      vi.advanceTimersByTime(101)

      // Should allow again
      expect(checkUserRateLimit(userId, limit, windowMs)).toBe(true)
    })
  })
})
