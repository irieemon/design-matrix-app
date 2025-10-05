import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import handler from '../ai/generate-ideas'

// Mock the auth middleware
const mockAuthenticate = vi.fn()
const mockCheckUserRateLimit = vi.fn()

vi.mock('../auth/middleware.ts', () => ({
  authenticate: mockAuthenticate,
  checkUserRateLimit: mockCheckUserRateLimit
}))

// Mock external APIs
global.fetch = vi.fn()

// Helper to create mock request and response objects
const createMockRequest = (
  method: string = 'POST',
  body: any = {},
  headers: Record<string, string> = {}
): VercelRequest => ({
  method,
  body,
  headers: {
    'content-type': 'application/json',
    ...headers
  },
  socket: { remoteAddress: '127.0.0.1' }
} as any)

const createMockResponse = (): VercelResponse => {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    end: vi.fn().mockReturnThis()
  }
  return res as any
}

describe('AI Generate Ideas API', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default successful authentication
    mockAuthenticate.mockResolvedValue({ user: { id: 'test-user' } })
    mockCheckUserRateLimit.mockReturnValue(true)

    // Default successful API response
    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        ideas: [
          {
            title: 'AI Generated Idea 1',
            description: 'First AI generated idea',
            impact: 'high',
            effort: 'low'
          },
          {
            title: 'AI Generated Idea 2',
            description: 'Second AI generated idea',
            impact: 'medium',
            effort: 'medium'
          }
        ]
      })
    })

    // Mock environment variables
    process.env.OPENAI_API_KEY = 'sk-test-key'
    process.env.ANTHROPIC_API_KEY = 'anthropic-test-key'
  })

  afterEach(() => {
    vi.clearAllMocks()
    delete process.env.OPENAI_API_KEY
    delete process.env.ANTHROPIC_API_KEY
  })

  describe('HTTP method validation', () => {
    it('should reject non-POST requests', async () => {
      const req = createMockRequest('GET')
      const res = createMockResponse()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(405)
      expect(res.json).toHaveBeenCalledWith({ error: 'Method not allowed' })
    })

    it('should accept POST requests', async () => {
      const req = createMockRequest('POST', {
        title: 'Test Project',
        description: 'Test description',
        projectType: 'Software'
      })
      const res = createMockResponse()

      await handler(req, res)

      expect(res.status).not.toHaveBeenCalledWith(405)
    })
  })

  describe('authentication and rate limiting', () => {
    it('should handle unauthenticated users with lower rate limits', async () => {
      mockAuthenticate.mockResolvedValue({ user: null })

      const req = createMockRequest('POST', {
        title: 'Test Project',
        description: 'Test description'
      })
      const res = createMockResponse()

      await handler(req, res)

      expect(mockCheckUserRateLimit).toHaveBeenCalledWith('127.0.0.1', 5)
    })

    it('should handle authenticated users with higher rate limits', async () => {
      mockAuthenticate.mockResolvedValue({ user: { id: 'test-user' } })

      const req = createMockRequest('POST', {
        title: 'Test Project',
        description: 'Test description'
      })
      const res = createMockResponse()

      await handler(req, res)

      expect(mockCheckUserRateLimit).toHaveBeenCalledWith('test-user', 20)
    })

    it('should return 429 when rate limit is exceeded', async () => {
      mockCheckUserRateLimit.mockReturnValue(false)

      const req = createMockRequest('POST', {
        title: 'Test Project',
        description: 'Test description'
      })
      const res = createMockResponse()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(429)
      expect(res.json).toHaveBeenCalledWith({
        error: 'Rate limit exceeded. Please try again later.',
        suggestion: 'Sign in for higher rate limits.'
      })
    })

    it('should provide different rate limit messages for authenticated users', async () => {
      mockAuthenticate.mockResolvedValue({ user: { id: 'test-user' } })
      mockCheckUserRateLimit.mockReturnValue(false)

      const req = createMockRequest('POST', {
        title: 'Test Project',
        description: 'Test description'
      })
      const res = createMockResponse()

      await handler(req, res)

      expect(res.json).toHaveBeenCalledWith({
        error: 'Rate limit exceeded. Please try again later.',
        suggestion: 'Try again in a minute.'
      })
    })
  })

  describe('input validation', () => {
    it('should require title and description', async () => {
      const req = createMockRequest('POST', {})
      const res = createMockResponse()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        error: 'Title and description are required'
      })
    })

    it('should require description even if title is provided', async () => {
      const req = createMockRequest('POST', {
        title: 'Test Project'
      })
      const res = createMockResponse()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        error: 'Title and description are required'
      })
    })

    it('should accept valid title and description', async () => {
      const req = createMockRequest('POST', {
        title: 'Test Project',
        description: 'Test description'
      })
      const res = createMockResponse()

      await handler(req, res)

      expect(res.status).not.toHaveBeenCalledWith(400)
    })
  })

  describe('API key validation', () => {
    it('should handle missing API keys gracefully', async () => {
      delete process.env.OPENAI_API_KEY
      delete process.env.ANTHROPIC_API_KEY

      const req = createMockRequest('POST', {
        title: 'Test Project',
        description: 'Test description'
      })
      const res = createMockResponse()

      await handler(req, res)

      // Should not fail immediately, but should handle the lack of API keys
      expect(res.status).not.toHaveBeenCalledWith(500)
    })

    it('should log API key status without exposing keys', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const req = createMockRequest('POST', {
        title: 'Test Project',
        description: 'Test description'
      })
      const res = createMockResponse()

      await handler(req, res)

      // Should log key status but not the actual keys
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('API Key status:'),
        expect.objectContaining({
          hasOpenAI: true,
          hasAnthropic: true,
          openAIPrefix: 'sk-test...'
        })
      )

      consoleSpy.mockRestore()
    })
  })

  describe('AI API integration', () => {
    it('should handle successful OpenAI API response', async () => {
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          ideas: [
            {
              title: 'AI Generated Idea',
              description: 'AI generated description',
              impact: 'high',
              effort: 'low'
            }
          ]
        })
      })

      const req = createMockRequest('POST', {
        title: 'Test Project',
        description: 'Test description',
        projectType: 'Software',
        count: 5
      })
      const res = createMockResponse()

      await handler(req, res)

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('openai.com'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer sk-test-key',
            'Content-Type': 'application/json'
          })
        })
      )
    })

    it('should handle OpenAI API rate limiting', async () => {
      ;(global.fetch as any).mockResolvedValue({
        ok: false,
        status: 429,
        json: () => Promise.resolve({
          error: { message: 'Rate limit exceeded' }
        })
      })

      const req = createMockRequest('POST', {
        title: 'Test Project',
        description: 'Test description'
      })
      const res = createMockResponse()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(429)
      expect(res.json).toHaveBeenCalledWith({
        error: 'Rate limit exceeded. Please wait before trying again.',
        retryAfter: expect.any(Number)
      })
    })

    it('should handle OpenAI API errors', async () => {
      ;(global.fetch as any).mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({
          error: { message: 'Internal server error' }
        })
      })

      const req = createMockRequest('POST', {
        title: 'Test Project',
        description: 'Test description'
      })
      const res = createMockResponse()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({
        error: 'AI service error',
        details: 'Internal server error'
      })
    })

    it('should fallback to Anthropic if OpenAI fails', async () => {
      // Mock OpenAI failure
      ;(global.fetch as any)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ error: { message: 'OpenAI error' } })
        })
        // Mock Anthropic success
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            ideas: [
              {
                title: 'Anthropic Generated Idea',
                description: 'Generated by Anthropic',
                impact: 'medium',
                effort: 'low'
              }
            ]
          })
        })

      const req = createMockRequest('POST', {
        title: 'Test Project',
        description: 'Test description'
      })
      const res = createMockResponse()

      await handler(req, res)

      expect(global.fetch).toHaveBeenCalledTimes(2)
      expect(global.fetch).toHaveBeenLastCalledWith(
        expect.stringContaining('anthropic.com'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-api-key': 'anthropic-test-key'
          })
        })
      )
    })

    it('should provide mock response when all AI services fail', async () => {
      ;(global.fetch as any).mockRejectedValue(new Error('Network error'))

      const req = createMockRequest('POST', {
        title: 'Test Project',
        description: 'Test description'
      })
      const res = createMockResponse()

      await handler(req, res)

      expect(res.json).toHaveBeenCalledWith({
        ideas: expect.arrayContaining([
          expect.objectContaining({
            title: expect.any(String),
            description: expect.any(String),
            impact: expect.any(String),
            effort: expect.any(String)
          })
        ]),
        source: 'mock',
        message: 'AI services unavailable, using sample ideas'
      })
    })
  })

  describe('request parameters', () => {
    it('should handle optional parameters with defaults', async () => {
      const req = createMockRequest('POST', {
        title: 'Test Project',
        description: 'Test description'
      })
      const res = createMockResponse()

      await handler(req, res)

      // Should use default values for count and tolerance
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"count":8')
        })
      )
    })

    it('should respect custom count parameter', async () => {
      const req = createMockRequest('POST', {
        title: 'Test Project',
        description: 'Test description',
        count: 12
      })
      const res = createMockResponse()

      await handler(req, res)

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"count":12')
        })
      )
    })

    it('should respect custom tolerance parameter', async () => {
      const req = createMockRequest('POST', {
        title: 'Test Project',
        description: 'Test description',
        tolerance: 75
      })
      const res = createMockResponse()

      await handler(req, res)

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"tolerance":75')
        })
      )
    })
  })

  describe('response formatting', () => {
    it('should return properly formatted ideas', async () => {
      const req = createMockRequest('POST', {
        title: 'Test Project',
        description: 'Test description'
      })
      const res = createMockResponse()

      await handler(req, res)

      expect(res.json).toHaveBeenCalledWith({
        ideas: expect.arrayContaining([
          expect.objectContaining({
            title: expect.any(String),
            description: expect.any(String),
            impact: expect.any(String),
            effort: expect.any(String)
          })
        ])
      })
    })

    it('should handle empty ideas response', async () => {
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ideas: [] })
      })

      const req = createMockRequest('POST', {
        title: 'Test Project',
        description: 'Test description'
      })
      const res = createMockResponse()

      await handler(req, res)

      expect(res.json).toHaveBeenCalledWith({
        ideas: expect.any(Array),
        source: expect.any(String)
      })
    })
  })

  describe('error handling', () => {
    it('should handle malformed request body', async () => {
      const req = {
        method: 'POST',
        body: 'invalid json',
        headers: { 'content-type': 'application/json' },
        socket: { remoteAddress: '127.0.0.1' }
      } as any

      const res = createMockResponse()

      await handler(req, res)

      // Should handle the error gracefully
      expect(res.status).toHaveBeenCalledWith(expect.any(Number))
    })

    it('should handle network timeouts', async () => {
      const timeoutError = new Error('Request timeout')
      timeoutError.name = 'TimeoutError'
      ;(global.fetch as any).mockRejectedValue(timeoutError)

      const req = createMockRequest('POST', {
        title: 'Test Project',
        description: 'Test description'
      })
      const res = createMockResponse()

      await handler(req, res)

      expect(res.json).toHaveBeenCalledWith({
        ideas: expect.any(Array),
        source: 'mock',
        message: expect.stringContaining('unavailable')
      })
    })

    it('should log errors for debugging', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      ;(global.fetch as any).mockRejectedValue(new Error('Test error'))

      const req = createMockRequest('POST', {
        title: 'Test Project',
        description: 'Test description'
      })
      const res = createMockResponse()

      await handler(req, res)

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error in generate-ideas'),
        expect.any(Error)
      )

      consoleErrorSpy.mockRestore()
    })
  })
})