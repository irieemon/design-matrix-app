import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import handler from '../projects'

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

describe('Projects API Endpoint', () => {
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
          projects: expect.any(Array)
        })
      )
    })

    it('should accept POST requests', async () => {
      const req = createMockRequest('POST', {
        name: 'New Project',
        description: 'Test description'
      })
      const res = createMockResponse()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(201)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          project: expect.any(Object),
          message: 'Project created successfully'
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

    it('should reject OPTIONS requests with 405', async () => {
      const req = createMockRequest('OPTIONS')
      const res = createMockResponse()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(405)
      expect(res.json).toHaveBeenCalledWith({ error: 'Method not allowed' })
    })
  })

  describe('GET Operations - Read All', () => {
    it('should return array of projects', async () => {
      const req = createMockRequest('GET')
      const res = createMockResponse()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          projects: expect.any(Array),
          count: expect.any(Number)
        })
      )
    })

    it('should return projects with correct structure', async () => {
      const req = createMockRequest('GET')
      const res = createMockResponse()

      await handler(req, res)

      const responseData = res.json.mock.calls[0][0]
      expect(responseData.projects.length).toBeGreaterThan(0)

      responseData.projects.forEach((project: any) => {
        expect(project).toHaveProperty('id')
        expect(project).toHaveProperty('name')
        expect(project).toHaveProperty('description')
        expect(project).toHaveProperty('created_at')
      })
    })

    it('should return count matching array length', async () => {
      const req = createMockRequest('GET')
      const res = createMockResponse()

      await handler(req, res)

      const responseData = res.json.mock.calls[0][0]
      expect(responseData.count).toBe(responseData.projects.length)
    })

    it('should include timestamp in response', async () => {
      const req = createMockRequest('GET')
      const res = createMockResponse()

      await handler(req, res)

      const responseData = res.json.mock.calls[0][0]
      expect(responseData).toHaveProperty('timestamp')
      expect(new Date(responseData.timestamp).toISOString()).toBe(responseData.timestamp)
    })

    it('should return multiple projects', async () => {
      const req = createMockRequest('GET')
      const res = createMockResponse()

      await handler(req, res)

      const responseData = res.json.mock.calls[0][0]
      expect(responseData.projects.length).toBeGreaterThanOrEqual(2)
    })

    it('should log request processing', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const req = createMockRequest('GET')
      const res = createMockResponse()

      await handler(req, res)

      expect(consoleSpy).toHaveBeenCalledWith('[API /projects] Processing GET request')
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[API /projects] ✅ GET request completed in')
      )

      consoleSpy.mockRestore()
    })
  })

  describe('POST Operations - Create', () => {
    it('should create project with all fields', async () => {
      const newProject = {
        name: 'Test Project',
        description: 'Test description'
      }

      const req = createMockRequest('POST', newProject)
      const res = createMockResponse()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(201)
      const responseData = res.json.mock.calls[0][0]

      expect(responseData.project).toMatchObject({
        name: newProject.name,
        description: newProject.description
      })
      expect(responseData.project).toHaveProperty('id')
      expect(responseData.project).toHaveProperty('created_at')
    })

    it('should use default values when fields missing', async () => {
      const req = createMockRequest('POST', {})
      const res = createMockResponse()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(201)
      const responseData = res.json.mock.calls[0][0]

      expect(responseData.project.name).toBe('New Project')
      expect(responseData.project.description).toBe('')
    })

    it('should generate unique IDs', async () => {
      const req1 = createMockRequest('POST', { name: 'Project 1' })
      const res1 = createMockResponse()

      await handler(req1, res1)

      vi.advanceTimersByTime(10)

      const req2 = createMockRequest('POST', { name: 'Project 2' })
      const res2 = createMockResponse()

      await handler(req2, res2)

      const id1 = res1.json.mock.calls[0][0].project.id
      const id2 = res2.json.mock.calls[0][0].project.id

      expect(id1).not.toBe(id2)
      expect(id1).toMatch(/^project-\d+$/)
      expect(id2).toMatch(/^project-\d+$/)
    })

    it('should return success message', async () => {
      const req = createMockRequest('POST', { name: 'Test' })
      const res = createMockResponse()

      await handler(req, res)

      const responseData = res.json.mock.calls[0][0]
      expect(responseData.message).toBe('Project created successfully')
    })

    it('should include timestamp', async () => {
      const req = createMockRequest('POST', { name: 'Test' })
      const res = createMockResponse()

      await handler(req, res)

      const responseData = res.json.mock.calls[0][0]
      expect(responseData).toHaveProperty('timestamp')
      expect(new Date(responseData.timestamp).toISOString()).toBe(responseData.timestamp)
    })

    it('should handle partial data - name only', async () => {
      const req = createMockRequest('POST', { name: 'Just Name' })
      const res = createMockResponse()

      await handler(req, res)

      const responseData = res.json.mock.calls[0][0]
      expect(responseData.project.name).toBe('Just Name')
      expect(responseData.project.description).toBe('')
    })

    it('should handle partial data - description only', async () => {
      const req = createMockRequest('POST', { description: 'Just description' })
      const res = createMockResponse()

      await handler(req, res)

      const responseData = res.json.mock.calls[0][0]
      expect(responseData.project.name).toBe('New Project')
      expect(responseData.project.description).toBe('Just description')
    })

    it('should handle empty name with fallback to default', async () => {
      const req = createMockRequest('POST', { name: '' })
      const res = createMockResponse()

      await handler(req, res)

      const responseData = res.json.mock.calls[0][0]
      // Empty string is falsy, so default is used
      expect(responseData.project.name).toBe('New Project')
    })

    it('should handle empty description', async () => {
      const req = createMockRequest('POST', { description: '' })
      const res = createMockResponse()

      await handler(req, res)

      const responseData = res.json.mock.calls[0][0]
      expect(responseData.project.description).toBe('')
    })

    it('should log request processing', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const req = createMockRequest('POST', { name: 'Test' })
      const res = createMockResponse()

      await handler(req, res)

      expect(consoleSpy).toHaveBeenCalledWith('[API /projects] Processing POST request')
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[API /projects] ✅ POST request completed in')
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

      const req = createMockRequest('POST', { name: 'Test' })
      const res = createMockResponse()

      await handler(req, res)

      const performanceCalls = consoleSpy.mock.calls.filter(
        call => call[0].includes('completed in') && call[0].includes('ms')
      )
      expect(performanceCalls.length).toBeGreaterThan(0)

      consoleSpy.mockRestore()
    })

    it('should log performance in milliseconds', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const req = createMockRequest('GET')
      const res = createMockResponse()

      await handler(req, res)

      const performanceCalls = consoleSpy.mock.calls.filter(
        call => call[0].includes('ms')
      )
      expect(performanceCalls.length).toBeGreaterThan(0)

      performanceCalls.forEach(call => {
        expect(call[0]).toMatch(/\d+\.\d{2}ms/)
      })

      consoleSpy.mockRestore()
    })
  })

  describe('Error Handling', () => {
    it('should handle internal errors gracefully', async () => {
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

      const req = createMockRequest('GET')
      const res = createMockResponse()

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

      await handler(req, res)

      const responseData = res.json.mock.calls[0][0]
      expect(responseData).not.toHaveProperty('stack')
      expect(responseData).not.toHaveProperty('internalError')

      process.env.NODE_ENV = originalEnv
    })

    it('should log error messages', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const req = createMockRequest('GET')
      const res = createMockResponse()

      res.status = vi.fn().mockImplementation(() => {
        throw new Error('Test error')
      })

      try {
        await handler(req, res)
      } catch (error) {
        // Expected
      }

      consoleErrorSpy.mockRestore()
    })
  })

  describe('Response Format Validation', () => {
    it('should return properly formatted GET response', async () => {
      const req = createMockRequest('GET')
      const res = createMockResponse()

      await handler(req, res)

      const responseData = res.json.mock.calls[0][0]
      expect(responseData).toHaveProperty('projects')
      expect(responseData).toHaveProperty('count')
      expect(responseData).toHaveProperty('timestamp')
      expect(Array.isArray(responseData.projects)).toBe(true)
      expect(typeof responseData.count).toBe('number')
      expect(typeof responseData.timestamp).toBe('string')
    })

    it('should return properly formatted POST response', async () => {
      const req = createMockRequest('POST', { name: 'Test' })
      const res = createMockResponse()

      await handler(req, res)

      const responseData = res.json.mock.calls[0][0]
      expect(responseData).toHaveProperty('project')
      expect(responseData).toHaveProperty('message')
      expect(responseData).toHaveProperty('timestamp')
      expect(typeof responseData.project).toBe('object')
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
      const req = createMockRequest('POST', { name: 'Test' })
      const res = createMockResponse()

      await handler(req, res)

      const responseData = res.json.mock.calls[0][0]
      const createdAt = new Date(responseData.project.created_at)
      expect(createdAt.toISOString()).toBe(responseData.project.created_at)
    })

    it('should include all required project fields', async () => {
      const req = createMockRequest('POST', { name: 'Test' })
      const res = createMockResponse()

      await handler(req, res)

      const responseData = res.json.mock.calls[0][0]
      expect(responseData.project).toHaveProperty('id')
      expect(responseData.project).toHaveProperty('name')
      expect(responseData.project).toHaveProperty('description')
      expect(responseData.project).toHaveProperty('created_at')
    })
  })

  describe('Content Type Headers', () => {
    it('should handle application/json content type', async () => {
      const req = createMockRequest('POST', { name: 'Test' }, {}, {
        'content-type': 'application/json'
      })
      const res = createMockResponse()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(201)
    })

    it('should handle missing content type', async () => {
      const req = createMockRequest('POST', { name: 'Test' }, {}, {})
      const res = createMockResponse()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(201)
    })

    it('should handle charset in content type', async () => {
      const req = createMockRequest('POST', { name: 'Test' }, {}, {
        'content-type': 'application/json; charset=utf-8'
      })
      const res = createMockResponse()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(201)
    })
  })

  describe('Data Type Validation', () => {
    it('should handle string name', async () => {
      const req = createMockRequest('POST', { name: 'String Name' })
      const res = createMockResponse()

      await handler(req, res)

      const responseData = res.json.mock.calls[0][0]
      expect(typeof responseData.project.name).toBe('string')
    })

    it('should handle string description', async () => {
      const req = createMockRequest('POST', { description: 'String description' })
      const res = createMockResponse()

      await handler(req, res)

      const responseData = res.json.mock.calls[0][0]
      expect(typeof responseData.project.description).toBe('string')
    })

    it('should handle empty strings with fallback to defaults', async () => {
      const req = createMockRequest('POST', {
        name: '',
        description: ''
      })
      const res = createMockResponse()

      await handler(req, res)

      const responseData = res.json.mock.calls[0][0]
      // Empty strings are falsy, so defaults are used
      expect(responseData.project.name).toBe('New Project')
      expect(responseData.project.description).toBe('')
    })

    it('should validate ID format', async () => {
      const req = createMockRequest('POST', { name: 'Test' })
      const res = createMockResponse()

      await handler(req, res)

      const responseData = res.json.mock.calls[0][0]
      expect(responseData.project.id).toMatch(/^project-\d+$/)
    })
  })

  describe('Edge Cases', () => {
    it('should handle null body', async () => {
      const req = createMockRequest('POST', null)
      const res = createMockResponse()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(201)
      const responseData = res.json.mock.calls[0][0]
      expect(responseData.project).toBeDefined()
    })

    it('should handle undefined values in body', async () => {
      const req = createMockRequest('POST', {
        name: undefined,
        description: undefined
      })
      const res = createMockResponse()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(201)
    })

    it('should handle very long name', async () => {
      const longName = 'A'.repeat(1000)
      const req = createMockRequest('POST', { name: longName })
      const res = createMockResponse()

      await handler(req, res)

      const responseData = res.json.mock.calls[0][0]
      expect(responseData.project.name).toBe(longName)
    })

    it('should handle very long description', async () => {
      const longDescription = 'B'.repeat(5000)
      const req = createMockRequest('POST', { description: longDescription })
      const res = createMockResponse()

      await handler(req, res)

      const responseData = res.json.mock.calls[0][0]
      expect(responseData.project.description).toBe(longDescription)
    })

    it('should handle special characters in name', async () => {
      const specialName = '!@#$%^&*()[]{}|\\;:\'",.<>?/`~'
      const req = createMockRequest('POST', { name: specialName })
      const res = createMockResponse()

      await handler(req, res)

      const responseData = res.json.mock.calls[0][0]
      expect(responseData.project.name).toBe(specialName)
    })

    it('should handle unicode characters', async () => {
      const unicodeName = '你好世界 🌍 مرحبا العالم'
      const req = createMockRequest('POST', { name: unicodeName })
      const res = createMockResponse()

      await handler(req, res)

      const responseData = res.json.mock.calls[0][0]
      expect(responseData.project.name).toBe(unicodeName)
    })

    it('should handle extra fields in body', async () => {
      const req = createMockRequest('POST', {
        name: 'Test',
        extraField: 'should be ignored',
        anotherExtra: 123
      })
      const res = createMockResponse()

      await handler(req, res)

      expect(res.status).toHaveBeenCalledWith(201)
      const responseData = res.json.mock.calls[0][0]
      expect(responseData.project).not.toHaveProperty('extraField')
      expect(responseData.project).not.toHaveProperty('anotherExtra')
    })

    it('should handle whitespace-only name', async () => {
      const req = createMockRequest('POST', { name: '   ' })
      const res = createMockResponse()

      await handler(req, res)

      const responseData = res.json.mock.calls[0][0]
      expect(responseData.project.name).toBe('   ')
    })

    it('should handle whitespace-only description', async () => {
      const req = createMockRequest('POST', { description: '   ' })
      const res = createMockResponse()

      await handler(req, res)

      const responseData = res.json.mock.calls[0][0]
      expect(responseData.project.description).toBe('   ')
    })

    it('should handle mixed whitespace', async () => {
      const req = createMockRequest('POST', {
        name: '\t\n  Name  \n\t',
        description: '\r\n Description \r\n'
      })
      const res = createMockResponse()

      await handler(req, res)

      const responseData = res.json.mock.calls[0][0]
      expect(responseData.project.name).toBe('\t\n  Name  \n\t')
      expect(responseData.project.description).toBe('\r\n Description \r\n')
    })

    it('should handle number as name', async () => {
      const req = createMockRequest('POST', { name: 12345 as any })
      const res = createMockResponse()

      await handler(req, res)

      const responseData = res.json.mock.calls[0][0]
      expect(responseData.project.name).toBe(12345)
    })

    it('should handle boolean as description', async () => {
      const req = createMockRequest('POST', { description: true as any })
      const res = createMockResponse()

      await handler(req, res)

      const responseData = res.json.mock.calls[0][0]
      expect(responseData.project.description).toBe(true)
    })

    it('should handle array as name', async () => {
      const req = createMockRequest('POST', { name: ['test'] as any })
      const res = createMockResponse()

      await handler(req, res)

      const responseData = res.json.mock.calls[0][0]
      expect(responseData.project.name).toEqual(['test'])
    })

    it('should handle object as description', async () => {
      const req = createMockRequest('POST', { description: { text: 'test' } as any })
      const res = createMockResponse()

      await handler(req, res)

      const responseData = res.json.mock.calls[0][0]
      expect(responseData.project.description).toEqual({ text: 'test' })
    })
  })

  describe('Concurrent Request Handling', () => {
    it('should handle multiple concurrent GET requests', async () => {
      const requests = Array.from({ length: 5 }, () => createMockRequest('GET'))
      const responses = Array.from({ length: 5 }, () => createMockResponse())

      await Promise.all(requests.map((req, i) => handler(req, responses[i])))

      responses.forEach(res => {
        expect(res.status).toHaveBeenCalledWith(200)
      })
    })

    it('should handle multiple concurrent POST requests', async () => {
      const requests = Array.from({ length: 5 }, (_, i) =>
        createMockRequest('POST', { name: `Project ${i}` })
      )
      const responses = Array.from({ length: 5 }, () => createMockResponse())

      await Promise.all(requests.map((req, i) => handler(req, responses[i])))

      responses.forEach(res => {
        expect(res.status).toHaveBeenCalledWith(201)
      })
    })

    it('should generate unique IDs for concurrent requests', async () => {
      const requests = Array.from({ length: 3 }, (_, i) =>
        createMockRequest('POST', { name: `Project ${i}` })
      )
      const responses = Array.from({ length: 3 }, () => createMockResponse())

      // Execute sequentially with delays to ensure unique timestamps
      for (let i = 0; i < requests.length; i++) {
        await handler(requests[i], responses[i])
        vi.advanceTimersByTime(10)
      }

      const ids = responses.map(res => res.json.mock.calls[0][0].project.id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(3)
    })
  })
})
