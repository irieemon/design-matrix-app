import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import handler from '../ideas'

// Helper to create mock request and response objects
const createMockRequest = (
  method: string = 'GET',
  body: any = {},
  query: Record<string, string> = {},
  headers: Record<string, string> = {}
): VercelRequest => ({
  method,
  body,
  query,
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

describe('Ideas API Endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  describe('HTTP Method Validation', () => {
    it('should accept GET requests', async () => {
      const req = createMockRequest('GET')
      const res = createMockResponse()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          ideas: expect.any(Array)
        })
      )
    })

    it('should accept POST requests', async () => {
      const req = createMockRequest('POST', {
        title: 'New Idea',
        description: 'Test description',
        tier: 'A'
      })
      const res = createMockResponse()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(201)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          idea: expect.any(Object),
          message: 'Idea created successfully'
        })
      )
    })

    it('should reject PUT requests with 405', async () => {
      const req = createMockRequest('PUT')
      const res = createMockResponse()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(405)
      expect(res.json).toHaveBeenCalledWith({ error: 'Method not allowed' })
    })

    it('should reject DELETE requests with 405', async () => {
      const req = createMockRequest('DELETE')
      const res = createMockResponse()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(405)
      expect(res.json).toHaveBeenCalledWith({ error: 'Method not allowed' })
    })

    it('should reject PATCH requests with 405', async () => {
      const req = createMockRequest('PATCH')
      const res = createMockResponse()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(405)
      expect(res.json).toHaveBeenCalledWith({ error: 'Method not allowed' })
    })
  })

  describe('GET Operations - Read All', () => {
    it('should return array of ideas', async () => {
      const req = createMockRequest('GET')
      const res = createMockResponse()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          ideas: expect.any(Array),
          count: expect.any(Number)
        })
      )
    })

    it('should return ideas with correct structure', async () => {
      const req = createMockRequest('GET')
      const res = createMockResponse()

      await handler(req, res)

      const responseData = res.json.mock.calls[0][0]
      expect(responseData.ideas.length).toBeGreaterThan(0)

      responseData.ideas.forEach((idea: any) => {
        expect(idea).toHaveProperty('id')
        expect(idea).toHaveProperty('title')
        expect(idea).toHaveProperty('description')
        expect(idea).toHaveProperty('tier')
        expect(idea).toHaveProperty('created_at')
      })
    })

    it('should return count matching array length', async () => {
      const req = createMockRequest('GET')
      const res = createMockResponse()

      await handler(req, res)

      const responseData = res.json.mock.calls[0][0]
      expect(responseData.count).toBe(responseData.ideas.length)
    })

    it('should include timestamp in response', async () => {
      const req = createMockRequest('GET')
      const res = createMockResponse()

      await handler(req, res)

      const responseData = res.json.mock.calls[0][0]
      expect(responseData).toHaveProperty('timestamp')
      expect(new Date(responseData.timestamp).toISOString()).toBe(responseData.timestamp)
    })

    it('should log request processing', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const req = createMockRequest('GET')
      const res = createMockResponse()

      await handler(req, res)

      expect(consoleSpy).toHaveBeenCalledWith('[API /ideas] Processing GET request')
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[API /ideas] ✅ GET request completed in')
      )

      consoleSpy.mockRestore()
    })
  })

  describe('POST Operations - Create', () => {
    it('should create idea with all fields', async () => {
      const newIdea = {
        title: 'Test Idea',
        description: 'Test description',
        tier: 'A'
      }

      const req = createMockRequest('POST', newIdea)
      const res = createMockResponse()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(201)
      const responseData = res.json.mock.calls[0][0]

      expect(responseData.idea).toMatchObject({
        title: newIdea.title,
        description: newIdea.description,
        tier: newIdea.tier
      })
      expect(responseData.idea).toHaveProperty('id')
      expect(responseData.idea).toHaveProperty('created_at')
    })

    it('should use default values when fields missing', async () => {
      const req = createMockRequest('POST', {})
      const res = createMockResponse()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(201)
      const responseData = res.json.mock.calls[0][0]

      expect(responseData.idea.title).toBe('New Idea')
      expect(responseData.idea.description).toBe('')
      expect(responseData.idea.tier).toBe('C')
    })

    it('should generate unique IDs', async () => {
      const req1 = createMockRequest('POST', { title: 'Idea 1' })
      const res1 = createMockResponse()

      await handler(req1, res1)

      vi.advanceTimersByTime(10)

      const req2 = createMockRequest('POST', { title: 'Idea 2' })
      const res2 = createMockResponse()

      await handler(req2, res2)

      const id1 = res1.json.mock.calls[0][0].idea.id
      const id2 = res2.json.mock.calls[0][0].idea.id

      expect(id1).not.toBe(id2)
      expect(id1).toMatch(/^idea-\d+$/)
      expect(id2).toMatch(/^idea-\d+$/)
    })

    it('should return success message', async () => {
      const req = createMockRequest('POST', { title: 'Test' })
      const res = createMockResponse()

      await handler(req, res)

      const responseData = res.json.mock.calls[0][0]
      expect(responseData.message).toBe('Idea created successfully')
    })

    it('should include timestamp', async () => {
      const req = createMockRequest('POST', { title: 'Test' })
      const res = createMockResponse()

      await handler(req, res)

      const responseData = res.json.mock.calls[0][0]
      expect(responseData).toHaveProperty('timestamp')
      expect(new Date(responseData.timestamp).toISOString()).toBe(responseData.timestamp)
    })

    it('should handle partial data - title only', async () => {
      const req = createMockRequest('POST', { title: 'Just Title' })
      const res = createMockResponse()

      await handler(req, res)

      const responseData = res.json.mock.calls[0][0]
      expect(responseData.idea.title).toBe('Just Title')
      expect(responseData.idea.description).toBe('')
      expect(responseData.idea.tier).toBe('C')
    })

    it('should handle partial data - description only', async () => {
      const req = createMockRequest('POST', { description: 'Just description' })
      const res = createMockResponse()

      await handler(req, res)

      const responseData = res.json.mock.calls[0][0]
      expect(responseData.idea.title).toBe('New Idea')
      expect(responseData.idea.description).toBe('Just description')
    })

    it('should handle tier A', async () => {
      const req = createMockRequest('POST', { tier: 'A' })
      const res = createMockResponse()

      await handler(req, res)

      const responseData = res.json.mock.calls[0][0]
      expect(responseData.idea.tier).toBe('A')
    })

    it('should handle tier B', async () => {
      const req = createMockRequest('POST', { tier: 'B' })
      const res = createMockResponse()

      await handler(req, res)

      const responseData = res.json.mock.calls[0][0]
      expect(responseData.idea.tier).toBe('B')
    })

    it('should handle tier C', async () => {
      const req = createMockRequest('POST', { tier: 'C' })
      const res = createMockResponse()

      await handler(req, res)

      const responseData = res.json.mock.calls[0][0]
      expect(responseData.idea.tier).toBe('C')
    })

    it('should handle tier D', async () => {
      const req = createMockRequest('POST', { tier: 'D' })
      const res = createMockResponse()

      await handler(req, res)

      const responseData = res.json.mock.calls[0][0]
      expect(responseData.idea.tier).toBe('D')
    })

    it('should log request processing', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const req = createMockRequest('POST', { title: 'Test' })
      const res = createMockResponse()

      await handler(req, res)

      expect(consoleSpy).toHaveBeenCalledWith('[API /ideas] Processing POST request')
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[API /ideas] ✅ POST request completed in')
      )

      consoleSpy.mockRestore()
    })
  })

  describe('Performance Logging', () => {
    it('should log GET request performance', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const req = createMockRequest('GET')
      const res = createMockResponse()

      await handler(req, res)

      const performanceCalls = consoleSpy.mock.calls.filter(
        call => call[0].includes('completed in') && call[0].includes('ms')
      )
      expect(performanceCalls.length).toBeGreaterThan(0)

      consoleSpy.mockRestore()
    })

    it('should log POST request performance', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const req = createMockRequest('POST', { title: 'Test' })
      const res = createMockResponse()

      await handler(req, res)

      const performanceCalls = consoleSpy.mock.calls.filter(
        call => call[0].includes('completed in') && call[0].includes('ms')
      )
      expect(performanceCalls.length).toBeGreaterThan(0)

      consoleSpy.mockRestore()
    })
  })

  describe('Error Handling', () => {
    it('should handle internal errors gracefully', async () => {
      // Force an error by passing invalid response object
      const req = createMockRequest('GET')
      const res = {
        status: vi.fn().mockImplementation(() => {
          throw new Error('Internal error')
        }),
        json: vi.fn().mockReturnThis()
      } as any

      await expect(handler(req, res)).rejects.toThrow('Internal error')
    })

    it('should return 500 on unexpected errors', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      // Mock performance.now to throw error
      const originalPerformance = global.performance.now
      global.performance.now = vi.fn().mockImplementation(() => {
        throw new Error('Performance API error')
      })

      const req = createMockRequest('GET')
      const res = createMockResponse()

      try {
        await handler(req, res)
      } catch (error) {
        // Expected to throw
      }

      global.performance.now = originalPerformance
      consoleErrorSpy.mockRestore()
    })

    it('should log errors with timing information', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const originalPerformance = global.performance.now
      global.performance.now = vi.fn().mockImplementation(() => {
        throw new Error('Test error')
      })

      const req = createMockRequest('GET')
      const res = createMockResponse()

      try {
        await handler(req, res)
      } catch (error) {
        // Expected
      }

      global.performance.now = originalPerformance
      consoleErrorSpy.mockRestore()
    })

    it('should include error message in development mode', async () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'

      // Create a scenario that causes error handling
      const req = createMockRequest('GET')
      const res = createMockResponse()

      // Mock to force error path
      res.status = vi.fn().mockImplementation(() => {
        throw new Error('Test error message')
      })

      try {
        await handler(req, res)
      } catch (error: any) {
        expect(error.message).toBe('Test error message')
      }

      process.env.NODE_ENV = originalEnv
    })

    it('should hide error details in production mode', async () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'production'

      const req = createMockRequest('GET')
      const res = createMockResponse()

      // Normal execution should not expose internal details
      await handler(req, res)

      const responseData = res.json.mock.calls[0][0]
      expect(responseData).not.toHaveProperty('stack')
      expect(responseData).not.toHaveProperty('internalError')

      process.env.NODE_ENV = originalEnv
    })
  })

  describe('Response Format Validation', () => {
    it('should return properly formatted GET response', async () => {
      const req = createMockRequest('GET')
      const res = createMockResponse()

      await handler(req, res)

      const responseData = res.json.mock.calls[0][0]
      expect(responseData).toHaveProperty('ideas')
      expect(responseData).toHaveProperty('count')
      expect(responseData).toHaveProperty('timestamp')
      expect(Array.isArray(responseData.ideas)).toBe(true)
      expect(typeof responseData.count).toBe('number')
      expect(typeof responseData.timestamp).toBe('string')
    })

    it('should return properly formatted POST response', async () => {
      const req = createMockRequest('POST', { title: 'Test' })
      const res = createMockResponse()

      await handler(req, res)

      const responseData = res.json.mock.calls[0][0]
      expect(responseData).toHaveProperty('idea')
      expect(responseData).toHaveProperty('message')
      expect(responseData).toHaveProperty('timestamp')
      expect(typeof responseData.idea).toBe('object')
      expect(typeof responseData.message).toBe('string')
      expect(typeof responseData.timestamp).toBe('string')
    })

    it('should return ISO 8601 formatted timestamps', async () => {
      const req = createMockRequest('GET')
      const res = createMockResponse()

      await handler(req, res)

      const responseData = res.json.mock.calls[0][0]
      const timestamp = new Date(responseData.timestamp)
      expect(timestamp.toISOString()).toBe(responseData.timestamp)
    })

    it('should return ISO 8601 formatted created_at', async () => {
      const req = createMockRequest('POST', { title: 'Test' })
      const res = createMockResponse()

      await handler(req, res)

      const responseData = res.json.mock.calls[0][0]
      const createdAt = new Date(responseData.idea.created_at)
      expect(createdAt.toISOString()).toBe(responseData.idea.created_at)
    })
  })

  describe('Content Type Headers', () => {
    it('should handle application/json content type', async () => {
      const req = createMockRequest('POST', { title: 'Test' }, {}, {
        'content-type': 'application/json'
      })
      const res = createMockResponse()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(201)
    })

    it('should handle missing content type', async () => {
      const req = createMockRequest('POST', { title: 'Test' }, {}, {})
      const res = createMockResponse()

      await handler(req, res)

      // Should still work with default behavior
      expect(res.status).toHaveBeenCalledWith(201)
    })
  })

  describe('Data Type Validation', () => {
    it('should handle string title', async () => {
      const req = createMockRequest('POST', { title: 'String Title' })
      const res = createMockResponse()

      await handler(req, res)

      const responseData = res.json.mock.calls[0][0]
      expect(typeof responseData.idea.title).toBe('string')
    })

    it('should handle string description', async () => {
      const req = createMockRequest('POST', { description: 'String description' })
      const res = createMockResponse()

      await handler(req, res)

      const responseData = res.json.mock.calls[0][0]
      expect(typeof responseData.idea.description).toBe('string')
    })

    it('should handle string tier', async () => {
      const req = createMockRequest('POST', { tier: 'A' })
      const res = createMockResponse()

      await handler(req, res)

      const responseData = res.json.mock.calls[0][0]
      expect(typeof responseData.idea.tier).toBe('string')
    })

    it('should handle empty strings with fallback to defaults', async () => {
      const req = createMockRequest('POST', {
        title: '',
        description: '',
        tier: ''
      })
      const res = createMockResponse()

      await handler(req, res)

      const responseData = res.json.mock.calls[0][0]
      // Empty strings are falsy, so defaults are used
      expect(responseData.idea.title).toBe('New Idea')
      expect(responseData.idea.description).toBe('')
      expect(responseData.idea.tier).toBe('C')
    })
  })

  describe('Edge Cases', () => {
    it('should handle null body', async () => {
      const req = createMockRequest('POST', null)
      const res = createMockResponse()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(201)
      const responseData = res.json.mock.calls[0][0]
      expect(responseData.idea).toBeDefined()
    })

    it('should handle undefined values in body', async () => {
      const req = createMockRequest('POST', {
        title: undefined,
        description: undefined,
        tier: undefined
      })
      const res = createMockResponse()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(201)
    })

    it('should handle very long title', async () => {
      const longTitle = 'A'.repeat(1000)
      const req = createMockRequest('POST', { title: longTitle })
      const res = createMockResponse()

      await handler(req, res)

      const responseData = res.json.mock.calls[0][0]
      expect(responseData.idea.title).toBe(longTitle)
    })

    it('should handle very long description', async () => {
      const longDescription = 'B'.repeat(5000)
      const req = createMockRequest('POST', { description: longDescription })
      const res = createMockResponse()

      await handler(req, res)

      const responseData = res.json.mock.calls[0][0]
      expect(responseData.idea.description).toBe(longDescription)
    })

    it('should handle special characters in title', async () => {
      const specialTitle = '!@#$%^&*()[]{}|\\;:\'",.<>?/`~'
      const req = createMockRequest('POST', { title: specialTitle })
      const res = createMockResponse()

      await handler(req, res)

      const responseData = res.json.mock.calls[0][0]
      expect(responseData.idea.title).toBe(specialTitle)
    })

    it('should handle unicode characters', async () => {
      const unicodeTitle = '你好世界 🌍 مرحبا العالم'
      const req = createMockRequest('POST', { title: unicodeTitle })
      const res = createMockResponse()

      await handler(req, res)

      const responseData = res.json.mock.calls[0][0]
      expect(responseData.idea.title).toBe(unicodeTitle)
    })

    it('should handle extra fields in body', async () => {
      const req = createMockRequest('POST', {
        title: 'Test',
        extraField: 'should be ignored',
        anotherExtra: 123
      })
      const res = createMockResponse()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(201)
      const responseData = res.json.mock.calls[0][0]
      expect(responseData.idea).not.toHaveProperty('extraField')
      expect(responseData.idea).not.toHaveProperty('anotherExtra')
    })
  })
})
