/**
 * Cache Clearing Endpoint Tests
 *
 * Comprehensive security tests for the /api/auth/clear-cache endpoint:
 * - Bearer token authentication and validation
 * - Rate limiting to prevent abuse (10 requests per minute)
 * - Input sanitization and validation
 * - Security headers enforcement
 * - Cache clearing operations and error handling
 * - Audit logging for security monitoring
 * - Content-Type validation
 * - Token format and length validation
 *
 * Business Impact: DoS attacks, cache poisoning, unauthorized system manipulation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { VercelRequest, VercelResponse } from '@vercel/node'

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn()
    }
  }))
}))

// Set up environment
process.env.SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_ANON_KEY = 'test-anon-key'
process.env.NODE_ENV = 'test'

// Import after mocks
import handler from '../clear-cache'
import { createClient } from '@supabase/supabase-js'

describe('Clear Cache Endpoint', () => {
  let mockRequest: Partial<VercelRequest>
  let mockResponse: Partial<VercelResponse>
  let statusMock: any
  let jsonMock: any
  let setHeaderMock: any
  let mockGetUser: any

  const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.valid.token'
  const validUserId = '12345678-1234-1234-1234-123456789abc'

  const createMockRequest = (overrides: Partial<VercelRequest> = {}): VercelRequest => ({
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${validToken}`,
      ...overrides.headers
    },
    url: '/api/auth/clear-cache',
    query: {},
    body: {},
    ...overrides
  } as VercelRequest)

  const createMockResponse = (): VercelResponse => {
    jsonMock = vi.fn().mockReturnThis()
    statusMock = vi.fn().mockReturnValue({ json: jsonMock })
    setHeaderMock = vi.fn()

    return {
      status: statusMock,
      json: jsonMock,
      setHeader: setHeaderMock,
      getHeader: vi.fn(),
      removeHeader: vi.fn()
    } as unknown as VercelResponse
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    mockRequest = createMockRequest()
    mockResponse = createMockResponse()

    // Set up mock Supabase client
    const mockCreateClient = createClient as any
    const mockSupabase = mockCreateClient()
    mockGetUser = mockSupabase.auth.getUser

    // Default successful auth response
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: validUserId,
          email: 'test@example.com'
        }
      },
      error: null
    })

    // Reset global cache objects
    global.queryOptimizerCache = new Map()
    global.userProfileCache = new Map()
  })

  afterEach(() => {
    vi.resetAllMocks()
    vi.useRealTimers()
    delete global.queryOptimizerCache
    delete global.userProfileCache
  })

  describe('Security Headers', () => {
    it('should set all security headers', async () => {
      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(setHeaderMock).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff')
      expect(setHeaderMock).toHaveBeenCalledWith('X-Frame-Options', 'DENY')
      expect(setHeaderMock).toHaveBeenCalledWith('X-XSS-Protection', '1; mode=block')
      expect(setHeaderMock).toHaveBeenCalledWith('Referrer-Policy', 'strict-origin-when-cross-origin')
      expect(setHeaderMock).toHaveBeenCalledWith('Cache-Control', 'no-store, no-cache, must-revalidate')
    })

    it('should apply headers before processing request', async () => {
      let headersApplied = false
      setHeaderMock.mockImplementation(() => {
        headersApplied = true
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(headersApplied).toBe(true)
    })

    it('should apply headers even on error', async () => {
      mockRequest = createMockRequest({ method: 'GET' })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(setHeaderMock).toHaveBeenCalled()
      expect(statusMock).toHaveBeenCalledWith(405)
    })
  })

  describe('HTTP Method Validation', () => {
    it('should accept POST requests', async () => {
      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(200)
    })

    it('should reject GET requests', async () => {
      mockRequest = createMockRequest({ method: 'GET' })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(405)
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Method not allowed',
        allowed: ['POST']
      })
    })

    it('should reject PUT requests', async () => {
      mockRequest = createMockRequest({ method: 'PUT' })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(405)
    })

    it('should reject DELETE requests', async () => {
      mockRequest = createMockRequest({ method: 'DELETE' })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(405)
    })

    it('should reject PATCH requests', async () => {
      mockRequest = createMockRequest({ method: 'PATCH' })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(405)
    })
  })

  describe('Content-Type Validation', () => {
    it('should accept application/json content type', async () => {
      mockRequest = createMockRequest({
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${validToken}`
        }
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(200)
    })

    it('should accept application/json with charset', async () => {
      mockRequest = createMockRequest({
        headers: {
          'content-type': 'application/json; charset=utf-8',
          authorization: `Bearer ${validToken}`
        }
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(200)
    })

    it('should reject missing content-type', async () => {
      mockRequest = createMockRequest({
        headers: { authorization: `Bearer ${validToken}` }
      })
      delete mockRequest.headers!['content-type']

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(400)
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Invalid Content-Type',
        expected: 'application/json'
      })
    })

    it('should reject wrong content-type', async () => {
      mockRequest = createMockRequest({
        headers: {
          'content-type': 'text/plain',
          authorization: `Bearer ${validToken}`
        }
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(400)
    })

    it('should reject form data content-type', async () => {
      mockRequest = createMockRequest({
        headers: {
          'content-type': 'multipart/form-data',
          authorization: `Bearer ${validToken}`
        }
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(400)
    })
  })

  describe('Authentication', () => {
    it('should authenticate valid Bearer token', async () => {
      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(mockGetUser).toHaveBeenCalledWith(validToken)
      expect(statusMock).toHaveBeenCalledWith(200)
    })

    it('should reject missing authorization header', async () => {
      mockRequest = createMockRequest({
        headers: { 'content-type': 'application/json' }
      })
      delete mockRequest.headers!.authorization

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(401)
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Authentication failed',
        details: 'Invalid or missing Bearer token'
      })
    })

    it('should reject authorization without Bearer prefix', async () => {
      mockRequest = createMockRequest({
        headers: {
          'content-type': 'application/json',
          authorization: 'Basic dXNlcjpwYXNz'
        }
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(401)
    })

    it('should reject empty Bearer token', async () => {
      mockRequest = createMockRequest({
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer '
        }
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(401)
    })

    it('should reject invalid token from Supabase', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid token' }
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(401)
    })

    it('should reject expired tokens', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Token expired' }
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(401)
    })

    it('should handle Supabase authentication errors', async () => {
      mockGetUser.mockRejectedValue(new Error('Network error'))

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(401)
    })
  })

  describe('Token Validation', () => {
    it('should reject tokens that are too short', async () => {
      mockRequest = createMockRequest({
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer short'
        }
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(401)
    })

    it('should reject tokens that are too long', async () => {
      const longToken = 'A'.repeat(2001)
      mockRequest = createMockRequest({
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${longToken}`
        }
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(401)
    })

    it('should reject tokens with invalid characters', async () => {
      const invalidTokens = [
        'Bearer token<script>',
        'Bearer token;drop table',
        'Bearer ../../../etc/passwd',
        'Bearer token\r\nX-Admin: true'
      ]

      for (const auth of invalidTokens) {
        mockRequest = createMockRequest({
          headers: {
            'content-type': 'application/json',
            authorization: auth
          }
        })

        await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

        expect(statusMock).toHaveBeenCalledWith(401)
      }
    })

    it('should accept valid JWT token format', async () => {
      mockRequest = createMockRequest({
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdef123456'
        }
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(200)
    })

    it('should reject invalid user ID format', async () => {
      mockGetUser.mockResolvedValue({
        data: {
          user: {
            id: 'not-a-uuid',
            email: 'test@example.com'
          }
        },
        error: null
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(401)
    })

    it('should validate UUID format strictly', async () => {
      mockGetUser.mockResolvedValue({
        data: {
          user: {
            id: '12345678-1234-1234-1234-12345678912G', // Invalid character
            email: 'test@example.com'
          }
        },
        error: null
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(401)
    })

    it('should handle authentication timeout', async () => {
      mockGetUser.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({ data: { user: null } }), 3000))
      )

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(401)
    })
  })

  describe('Rate Limiting', () => {
    it('should allow requests within rate limit', async () => {
      for (let i = 0; i < 10; i++) {
        await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)
        expect(statusMock).toHaveBeenCalledWith(200)
        vi.clearAllMocks()
        mockResponse = createMockResponse()
      }
    })

    it('should reject requests exceeding rate limit', async () => {
      // Make 10 requests (the limit)
      for (let i = 0; i < 10; i++) {
        await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)
        mockResponse = createMockResponse()
      }

      // 11th request should be rate limited
      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(429)
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Rate limit exceeded',
        retryAfter: 60
      })
    })

    it('should reset rate limit after time window', async () => {
      // Hit rate limit
      for (let i = 0; i < 10; i++) {
        await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)
        mockResponse = createMockResponse()
      }

      // Should be rate limited
      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)
      expect(statusMock).toHaveBeenCalledWith(429)

      // Advance time past window (60 seconds)
      vi.advanceTimersByTime(61000)
      mockResponse = createMockResponse()

      // Should work again
      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)
      expect(statusMock).toHaveBeenCalledWith(200)
    })

    it('should track rate limits per user independently', async () => {
      const user1Token = 'user1.token.here'
      const user2Token = 'user2.token.here'

      // User 1 hits rate limit
      mockRequest = createMockRequest({
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${user1Token}`
        }
      })

      mockGetUser.mockResolvedValue({
        data: {
          user: {
            id: '11111111-1111-1111-1111-111111111111',
            email: 'user1@example.com'
          }
        },
        error: null
      })

      for (let i = 0; i < 10; i++) {
        await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)
        mockResponse = createMockResponse()
      }

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)
      expect(statusMock).toHaveBeenCalledWith(429)

      // User 2 should still be allowed
      mockRequest = createMockRequest({
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${user2Token}`
        }
      })

      mockGetUser.mockResolvedValue({
        data: {
          user: {
            id: '22222222-2222-2222-2222-222222222222',
            email: 'user2@example.com'
          }
        },
        error: null
      })

      mockResponse = createMockResponse()
      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(200)
    })
  })

  describe('Cache Clearing Operations', () => {
    it('should clear query optimizer cache', async () => {
      global.queryOptimizerCache = new Map([
        ['key1', 'value1'],
        ['key2', 'value2']
      ])

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(global.queryOptimizerCache.size).toBe(0)
    })

    it('should clear user profile cache', async () => {
      global.userProfileCache = new Map([
        ['user1', { profile: {}, timestamp: Date.now() }],
        ['user2', { profile: {}, timestamp: Date.now() }]
      ])

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(global.userProfileCache.size).toBe(0)
    })

    it('should handle missing cache objects gracefully', async () => {
      delete global.queryOptimizerCache
      delete global.userProfileCache

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(200)
    })

    it('should trigger garbage collection if available', async () => {
      const mockGC = vi.fn()
      global.gc = mockGC

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(mockGC).toHaveBeenCalled()

      delete global.gc
    })

    it('should handle cache clearing errors gracefully', async () => {
      global.queryOptimizerCache = {
        clear: vi.fn(() => {
          throw new Error('Clear failed')
        })
      } as any

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(200)
      warnSpy.mockRestore()
    })

    it('should return cleared entry counts', async () => {
      global.queryOptimizerCache = new Map([
        ['key1', 'value1'],
        ['key2', 'value2'],
        ['key3', 'value3']
      ])
      global.userProfileCache = new Map([
        ['user1', {}],
        ['user2', {}]
      ])

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          cleared: expect.objectContaining({
            totalEntries: 5
          })
        })
      )
    })
  })

  describe('Response Format', () => {
    it('should return success response with metadata', async () => {
      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        message: 'Server-side caches cleared successfully',
        cleared: expect.objectContaining({
          totalEntries: expect.any(Number),
          operations: expect.any(Array),
          timestamp: expect.any(String),
          userId: validUserId
        }),
        performance: expect.objectContaining({
          duration: expect.stringMatching(/\d+\.\d+ms/),
          timestamp: expect.any(String)
        })
      })
    })

    it('should include timestamp in ISO format', async () => {
      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      const response = jsonMock.mock.calls[0][0]
      expect(response.cleared.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
      expect(response.performance.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })

    it('should include user ID in response', async () => {
      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      const response = jsonMock.mock.calls[0][0]
      expect(response.cleared.userId).toBe(validUserId)
    })
  })

  describe('Error Handling', () => {
    it('should handle unexpected errors gracefully', async () => {
      mockGetUser.mockRejectedValue(new Error('Unexpected error'))

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(401)
      errorSpy.mockRestore()
    })

    it('should return 500 on unhandled exceptions', async () => {
      setHeaderMock.mockImplementation(() => {
        throw new Error('Header error')
      })

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(500)
      errorSpy.mockRestore()
    })

    it('should include error details in development mode', async () => {
      process.env.NODE_ENV = 'development'

      setHeaderMock.mockImplementation(() => {
        throw new Error('Test error')
      })

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          debug: expect.objectContaining({
            message: 'Test error'
          })
        })
      )

      errorSpy.mockRestore()
      process.env.NODE_ENV = 'test'
    })

    it('should not leak error details in production', async () => {
      process.env.NODE_ENV = 'production'

      setHeaderMock.mockImplementation(() => {
        throw new Error('Sensitive error')
      })

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      const response = jsonMock.mock.calls[0][0]
      expect(response).not.toHaveProperty('debug')
      expect(response.message).toBe('Cache clearing operation failed')

      errorSpy.mockRestore()
      process.env.NODE_ENV = 'test'
    })
  })

  describe('Logging and Audit Trail', () => {
    it('should log cache clear requests', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('[SECURITY] Cache clear request from user:')
      )

      logSpy.mockRestore()
    })

    it('should log completion with operations', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('[SECURITY] Cache clearing completed'),
        expect.any(Array)
      )

      logSpy.mockRestore()
    })

    it('should log errors with details', async () => {
      setHeaderMock.mockImplementation(() => {
        throw new Error('Test error')
      })

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[SECURITY] Cache clear error'),
        expect.any(Object)
      )

      errorSpy.mockRestore()
    })
  })

  describe('Security Attack Scenarios', () => {
    it('should prevent token injection attacks', async () => {
      const injectionAttempts = [
        'Bearer token\r\nX-Admin: true',
        'Bearer token\nAuthorization: Bearer admin',
        'Bearer token\0admin',
        'Bearer token; DROP TABLE users;'
      ]

      for (const auth of injectionAttempts) {
        mockRequest = createMockRequest({
          headers: {
            'content-type': 'application/json',
            authorization: auth
          }
        })

        await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

        expect(statusMock).toHaveBeenCalledWith(401)
        mockResponse = createMockResponse()
      }
    })

    it('should prevent denial of service through rate limiting', async () => {
      // Attempt 20 requests rapidly
      for (let i = 0; i < 20; i++) {
        await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)
        mockResponse = createMockResponse()
      }

      // Should have been rate limited
      expect(statusMock).toHaveBeenCalledWith(429)
    })

    it('should handle malformed requests without crashing', async () => {
      const malformedRequests = [
        { method: 'POST', headers: {} }, // Missing everything
        { method: 'POST', headers: { authorization: 'Bearer' } }, // Missing content-type
        { method: 'GET', headers: { 'content-type': 'application/json' } } // Wrong method
      ]

      for (const req of malformedRequests) {
        mockRequest = createMockRequest(req)
        await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)
        expect(statusMock).toHaveBeenCalled()
        mockResponse = createMockResponse()
      }
    })
  })
})
