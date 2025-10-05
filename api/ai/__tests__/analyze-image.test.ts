import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import handler from '../analyze-image'
import { authenticate, checkUserRateLimit } from '../../auth/middleware'

// Mock dependencies
vi.mock('../../auth/middleware')

// Mock external APIs
global.fetch = vi.fn()

describe('analyze-image API endpoint', () => {
  let mockRequest: Partial<VercelRequest>
  let mockResponse: Partial<VercelResponse>
  let statusMock: ReturnType<typeof vi.fn>
  let jsonMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup fetch mock (must be after clearAllMocks)
    global.fetch = vi.fn()

    statusMock = vi.fn().mockReturnThis()
    jsonMock = vi.fn().mockReturnThis()

    mockResponse = {
      status: statusMock,
      json: jsonMock
    }

    process.env.OPENAI_API_KEY = 'test-openai-key'
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('HTTP Method Validation', () => {
    it('should return 405 for GET requests', async () => {
      mockRequest = { method: 'GET' }

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(405)
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Method not allowed' })
    })

    it('should return 405 for PUT requests', async () => {
      mockRequest = { method: 'PUT' }

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(405)
    })

    it('should return 405 for DELETE requests', async () => {
      mockRequest = { method: 'DELETE' }

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(405)
    })

    it('should accept POST requests', async () => {
      mockRequest = {
        method: 'POST',
        body: { imageUrl: 'https://example.com/image.jpg' },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      vi.mocked(authenticate).mockResolvedValue({ user: null })
      vi.mocked(checkUserRateLimit).mockReturnValue(false)

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).not.toHaveBeenCalledWith(405)
    })
  })

  describe('Authentication & Rate Limiting', () => {
    it('should allow authenticated users with 10 requests/minute', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' }
      mockRequest = {
        method: 'POST',
        body: { imageUrl: 'https://example.com/image.jpg' },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      vi.mocked(authenticate).mockResolvedValue({ user: mockUser })
      vi.mocked(checkUserRateLimit).mockReturnValue(true)

      vi.mocked(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Image analysis result' } }]
        })
      } as any)

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(checkUserRateLimit).toHaveBeenCalledWith(mockUser.id, 10)
    })

    it('should allow unauthenticated users with 3 requests/minute', async () => {
      mockRequest = {
        method: 'POST',
        body: { imageUrl: 'https://example.com/image.jpg' },
        headers: { 'x-forwarded-for': '192.168.1.1' },
        socket: { remoteAddress: '127.0.0.1' }
      }

      vi.mocked(authenticate).mockResolvedValue({ user: null })
      vi.mocked(checkUserRateLimit).mockReturnValue(true)

      vi.mocked(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Analysis' } }]
        })
      } as any)

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(checkUserRateLimit).toHaveBeenCalledWith('192.168.1.1', 3)
    })

    it('should return 429 when rate limit exceeded for authenticated user', async () => {
      mockRequest = {
        method: 'POST',
        body: { imageUrl: 'https://example.com/image.jpg' },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      vi.mocked(authenticate).mockResolvedValue({ user: { id: 'user-123' } })
      vi.mocked(checkUserRateLimit).mockReturnValue(false)

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(429)
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Rate limit exceeded. Please try again later.',
        suggestion: 'Try again in a minute.'
      })
    })

    it('should return 429 with sign-in suggestion for unauthenticated user', async () => {
      mockRequest = {
        method: 'POST',
        body: { imageUrl: 'https://example.com/image.jpg' },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      vi.mocked(authenticate).mockResolvedValue({ user: null })
      vi.mocked(checkUserRateLimit).mockReturnValue(false)

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(429)
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Rate limit exceeded. Please try again later.',
        suggestion: 'Sign in for higher rate limits.'
      })
    })
  })

  describe('Request Validation', () => {
    beforeEach(() => {
      vi.mocked(authenticate).mockResolvedValue({ user: null })
      vi.mocked(checkUserRateLimit).mockReturnValue(true)
    })

    it('should return 400 when imageUrl is missing', async () => {
      mockRequest = {
        method: 'POST',
        body: {},
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(400)
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Image URL is required'
      })
    })

    it('should return 400 when imageUrl is empty string', async () => {
      mockRequest = {
        method: 'POST',
        body: { imageUrl: '' },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(400)
    })

    it('should return 500 when OpenAI API key is missing', async () => {
      delete process.env.OPENAI_API_KEY

      mockRequest = {
        method: 'POST',
        body: { imageUrl: 'https://example.com/image.jpg' },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(500)
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'No AI service configured'
      })
    })
  })

  describe('Analysis Type Handling', () => {
    beforeEach(async () => {
      vi.mocked(authenticate).mockResolvedValue({ user: null })
      vi.mocked(checkUserRateLimit).mockReturnValue(true)

      vi.mocked(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Analysis result' } }]
        })
      } as any)
    })

    it('should handle general analysis type (default)', async () => {
      mockRequest = {
        method: 'POST',
        body: { imageUrl: 'https://example.com/image.jpg' },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(200)
      expect(jsonMock).toHaveBeenCalledWith({
        analysis: expect.objectContaining({
          type: 'general'
        })
      })
    })

    it('should handle ui_design analysis type', async () => {
      mockRequest = {
        method: 'POST',
        body: {
          imageUrl: 'https://example.com/image.jpg',
          analysisType: 'ui_design'
        },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(200)
      expect(jsonMock).toHaveBeenCalledWith({
        analysis: expect.objectContaining({
          type: 'ui_design'
        })
      })
    })

    it('should handle data_visualization analysis type', async () => {
      mockRequest = {
        method: 'POST',
        body: {
          imageUrl: 'https://example.com/image.jpg',
          analysisType: 'data_visualization'
        },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      const call = jsonMock.mock.calls[0][0]
      expect(call.analysis.type).toBe('data_visualization')
    })

    it('should handle process_diagram analysis type', async () => {
      mockRequest = {
        method: 'POST',
        body: {
          imageUrl: 'https://example.com/image.jpg',
          analysisType: 'process_diagram'
        },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      const call = jsonMock.mock.calls[0][0]
      expect(call.analysis.type).toBe('process_diagram')
    })

    it('should handle document_screenshot analysis type', async () => {
      mockRequest = {
        method: 'POST',
        body: {
          imageUrl: 'https://example.com/image.jpg',
          analysisType: 'document_screenshot'
        },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      const call = jsonMock.mock.calls[0][0]
      expect(call.analysis.type).toBe('document_screenshot')
    })
  })

  describe('Project Context Integration', () => {
    beforeEach(async () => {
      vi.mocked(authenticate).mockResolvedValue({ user: null })
      vi.mocked(checkUserRateLimit).mockReturnValue(true)

      vi.mocked(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Analysis with project context' } }]
        })
      } as any)
    })

    it('should accept project context in request', async () => {
      mockRequest = {
        method: 'POST',
        body: {
          imageUrl: 'https://example.com/image.jpg',
          projectContext: {
            projectName: 'Test Project',
            projectType: 'Web Application',
            description: 'A test web application'
          }
        },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(200)
    })

    it('should work without project context', async () => {
      mockRequest = {
        method: 'POST',
        body: { imageUrl: 'https://example.com/image.jpg' },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(200)
    })
  })

  describe('GPT-4V API Integration', () => {
    beforeEach(() => {
      vi.mocked(authenticate).mockResolvedValue({ user: null })
      vi.mocked(checkUserRateLimit).mockReturnValue(true)
    })

    it('should call OpenAI API with correct parameters', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Analysis' } }]
        })
      } as any)

      mockRequest = {
        method: 'POST',
        body: { imageUrl: 'https://example.com/image.jpg' },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-openai-key',
            'Content-Type': 'application/json'
          })
        })
      )
    })

    it('should use gpt-4o model for image analysis', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Analysis' } }]
        })
      } as any)

      mockRequest = {
        method: 'POST',
        body: { imageUrl: 'https://example.com/image.jpg' },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      const callArgs = (global.fetch as any).mock.calls[0][1]
      const body = JSON.parse(callArgs?.body as string)
      expect(body.model).toBe('gpt-4o')
    })

    it('should use high detail for image analysis', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Analysis' } }]
        })
      } as any)

      mockRequest = {
        method: 'POST',
        body: { imageUrl: 'https://example.com/test.jpg' },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      const callArgs = (global.fetch as any).mock.calls[0][1]
      const body = JSON.parse(callArgs?.body as string)
      expect(body.messages[0].content[1].image_url.detail).toBe('high')
    })

    it('should use temperature 0.3 for consistent analysis', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Analysis' } }]
        })
      } as any)

      mockRequest = {
        method: 'POST',
        body: { imageUrl: 'https://example.com/image.jpg' },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      const callArgs = (global.fetch as any).mock.calls[0][1]
      const body = JSON.parse(callArgs?.body as string)
      expect(body.temperature).toBe(0.3)
    })
  })

  describe('Response Parsing', () => {
    beforeEach(() => {
      vi.mocked(authenticate).mockResolvedValue({ user: null })
      vi.mocked(checkUserRateLimit).mockReturnValue(true)
    })

    it('should parse JSON response from GPT-4V', async () => {
      vi.mocked(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                description: 'Test image',
                insights: ['Insight 1', 'Insight 2'],
                relevance: 'high'
              })
            }
          }]
        })
      } as any)

      mockRequest = {
        method: 'POST',
        body: { imageUrl: 'https://example.com/image.jpg' },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(200)
      const result = jsonMock.mock.calls[0][0].analysis
      expect(result.description).toBe('Test image')
      expect(result.insights).toEqual(['Insight 1', 'Insight 2'])
    })

    it('should handle text response (non-JSON)', async () => {
      vi.mocked(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: 'This is a plain text analysis of the image.'
            }
          }]
        })
      } as any)

      mockRequest = {
        method: 'POST',
        body: { imageUrl: 'https://example.com/image.jpg' },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(200)
      const result = jsonMock.mock.calls[0][0].analysis
      expect(result.description).toBe('This is a plain text analysis of the image.')
      expect(result.type).toBe('general')
    })

    it('should extract text from quoted content', async () => {
      vi.mocked(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: 'The image shows "Hello World" and "Test Text".'
            }
          }]
        })
      } as any)

      mockRequest = {
        method: 'POST',
        body: { imageUrl: 'https://example.com/image.jpg' },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      const result = jsonMock.mock.calls[0][0].analysis
      expect(result.extractedText).toContain('Hello World')
      expect(result.extractedText).toContain('Test Text')
    })
  })

  describe('Error Handling', () => {
    beforeEach(() => {
      vi.mocked(authenticate).mockResolvedValue({ user: null })
      vi.mocked(checkUserRateLimit).mockReturnValue(true)
    })

    it('should return 500 on OpenAI API error', async () => {
      vi.mocked(global.fetch as any).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      } as any)

      mockRequest = {
        method: 'POST',
        body: { imageUrl: 'https://example.com/image.jpg' },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(500)
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Failed to analyze image'
      })
    })

    it('should handle network errors', async () => {
      vi.mocked(global.fetch as any).mockRejectedValue(new Error('Network error'))

      mockRequest = {
        method: 'POST',
        body: { imageUrl: 'https://example.com/image.jpg' },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(500)
    })

    it('should handle malformed JSON responses', async () => {
      vi.mocked(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: '{ invalid json'
            }
          }]
        })
      } as any)

      mockRequest = {
        method: 'POST',
        body: { imageUrl: 'https://example.com/image.jpg' },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(200)
      const result = jsonMock.mock.calls[0][0].analysis
      expect(result.description).toBeDefined()
    })

    it('should handle missing response choices', async () => {
      vi.mocked(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [] })
      } as any)

      mockRequest = {
        method: 'POST',
        body: { imageUrl: 'https://example.com/image.jpg' },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(200)
      const result = jsonMock.mock.calls[0][0].analysis
      expect(result.description).toBe('Unable to analyze image')
    })
  })

  describe('Relevance Assessment', () => {
    beforeEach(() => {
      vi.mocked(authenticate).mockResolvedValue({ user: null })
      vi.mocked(checkUserRateLimit).mockReturnValue(true)
    })

    it('should assess high relevance when project name mentioned', async () => {
      vi.mocked(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: 'This image shows the Test Project dashboard with various features.'
            }
          }]
        })
      } as any)

      mockRequest = {
        method: 'POST',
        body: {
          imageUrl: 'https://example.com/image.jpg',
          projectContext: {
            projectName: 'Test Project',
            projectType: 'Web App'
          }
        },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      const result = jsonMock.mock.calls[0][0].analysis
      expect(result.relevance).toBe('high')
    })

    it('should assess medium relevance by default', async () => {
      vi.mocked(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{
            message: { content: 'This is a generic image.' }
          }]
        })
      } as any)

      mockRequest = {
        method: 'POST',
        body: { imageUrl: 'https://example.com/image.jpg' },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      const result = jsonMock.mock.calls[0][0].analysis
      expect(result.relevance).toBe('medium')
    })
  })
})
