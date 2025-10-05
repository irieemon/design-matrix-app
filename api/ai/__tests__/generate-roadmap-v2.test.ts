import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import handler from '../generate-roadmap-v2'
import { authenticate, checkUserRateLimit } from '../../auth/middleware'

// Mock dependencies
vi.mock('../../auth/middleware')

// Mock external APIs
global.fetch = vi.fn()

describe('generate-roadmap-v2 API endpoint', () => {
  let mockRequest: Partial<VercelRequest>
  let mockResponse: Partial<VercelResponse>
  let statusMock: ReturnType<typeof vi.fn>
  let jsonMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()

    // Setup response mocks
    statusMock = vi.fn().mockReturnThis()
    jsonMock = vi.fn().mockReturnThis()

    mockResponse = {
      status: statusMock,
      json: jsonMock
    }

    // Setup fetch mock (must be after clearAllMocks)
    global.fetch = vi.fn()

    // Setup environment variables
    process.env.OPENAI_API_KEY = 'test-openai-key-12345'
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
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Method not allowed' })
    })

    it('should return 405 for DELETE requests', async () => {
      mockRequest = { method: 'DELETE' }

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(405)
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Method not allowed' })
    })

    it('should return 405 for PATCH requests', async () => {
      mockRequest = { method: 'PATCH' }

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(405)
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Method not allowed' })
    })

    it('should accept POST requests', async () => {
      mockRequest = {
        method: 'POST',
        body: {
          projectName: 'Test Project',
          projectType: 'software',
          ideas: [{ title: 'Feature 1', description: 'Desc 1' }]
        },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      vi.mocked(authenticate).mockResolvedValue({ user: null })
      vi.mocked(checkUserRateLimit).mockReturnValue(true)

      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{
            message: { content: JSON.stringify({ roadmapAnalysis: { totalDuration: '12 weeks', phases: [] } }) }
          }]
        })
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).not.toHaveBeenCalledWith(405)
    })
  })

  describe('Authentication & Rate Limiting', () => {
    it('should allow authenticated users with 8 requests/minute', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' }
      mockRequest = {
        method: 'POST',
        body: {
          projectName: 'Test',
          projectType: 'software',
          ideas: []
        },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      vi.mocked(authenticate).mockResolvedValue({ user: mockUser })
      vi.mocked(checkUserRateLimit).mockReturnValue(true)

      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ roadmapAnalysis: { phases: [] } }) } }]
        })
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(checkUserRateLimit).toHaveBeenCalledWith(mockUser.id, 8)
    })

    it('should allow unauthenticated users with 3 requests/minute', async () => {
      mockRequest = {
        method: 'POST',
        body: {
          projectName: 'Test',
          projectType: 'software',
          ideas: []
        },
        headers: { 'x-forwarded-for': '192.168.1.1' },
        socket: { remoteAddress: '127.0.0.1' }
      }

      vi.mocked(authenticate).mockResolvedValue({ user: null })
      vi.mocked(checkUserRateLimit).mockReturnValue(true)

      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ roadmapAnalysis: { phases: [] } }) } }]
        })
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(checkUserRateLimit).toHaveBeenCalledWith('192.168.1.1', 3)
    })

    it('should return 429 when rate limit exceeded for authenticated user', async () => {
      mockRequest = {
        method: 'POST',
        body: {
          projectName: 'Test',
          projectType: 'software',
          ideas: []
        },
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
        body: {
          projectName: 'Test',
          projectType: 'software',
          ideas: []
        },
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

    it('should use remote address when x-forwarded-for header missing', async () => {
      mockRequest = {
        method: 'POST',
        body: {
          projectName: 'Test',
          projectType: 'software',
          ideas: []
        },
        headers: {},
        socket: { remoteAddress: '10.0.0.1' }
      }

      vi.mocked(authenticate).mockResolvedValue({ user: null })
      vi.mocked(checkUserRateLimit).mockReturnValue(true)

      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ roadmapAnalysis: { phases: [] } }) } }]
        })
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(checkUserRateLimit).toHaveBeenCalledWith('10.0.0.1', 3)
    })

    it('should use unknown as fallback when no IP available', async () => {
      mockRequest = {
        method: 'POST',
        body: {
          projectName: 'Test',
          projectType: 'software',
          ideas: []
        },
        headers: {},
        socket: {}
      }

      vi.mocked(authenticate).mockResolvedValue({ user: null })
      vi.mocked(checkUserRateLimit).mockReturnValue(true)

      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ roadmapAnalysis: { phases: [] } }) } }]
        })
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(checkUserRateLimit).toHaveBeenCalledWith('unknown', 3)
    })
  })

  describe('Request Validation', () => {
    beforeEach(() => {
      vi.mocked(authenticate).mockResolvedValue({ user: null })
      vi.mocked(checkUserRateLimit).mockReturnValue(true)
    })

    it('should return 400 when projectName is missing', async () => {
      mockRequest = {
        method: 'POST',
        body: {
          projectType: 'software',
          ideas: []
        },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(400)
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Project name and ideas array are required'
      })
    })

    it('should return 400 when ideas is missing', async () => {
      mockRequest = {
        method: 'POST',
        body: {
          projectName: 'Test',
          projectType: 'software'
        },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(400)
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Project name and ideas array are required'
      })
    })

    it('should return 400 when ideas is not an array', async () => {
      mockRequest = {
        method: 'POST',
        body: {
          projectName: 'Test',
          projectType: 'software',
          ideas: 'not-an-array'
        },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(400)
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Project name and ideas array are required'
      })
    })

    it('should return 400 when projectName is empty string', async () => {
      mockRequest = {
        method: 'POST',
        body: {
          projectName: '',
          projectType: 'software',
          ideas: []
        },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(400)
    })

    it('should return 500 when OpenAI key is missing', async () => {
      delete process.env.OPENAI_API_KEY

      mockRequest = {
        method: 'POST',
        body: {
          projectName: 'Test',
          projectType: 'software',
          ideas: []
        },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(500)
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'No AI service configured'
      })
    })

    it('should accept empty ideas array', async () => {
      mockRequest = {
        method: 'POST',
        body: {
          projectName: 'Test',
          projectType: 'software',
          ideas: []
        },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ roadmapAnalysis: { phases: [] } }) } }]
        })
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).not.toHaveBeenCalledWith(400)
    })
  })

  describe('OpenAI API Integration', () => {
    beforeEach(() => {
      vi.mocked(authenticate).mockResolvedValue({ user: null })
      vi.mocked(checkUserRateLimit).mockReturnValue(true)

      mockRequest = {
        method: 'POST',
        body: {
          projectName: 'E-commerce Platform',
          projectType: 'software',
          ideas: [
            { title: 'User Authentication', description: 'JWT-based auth' },
            { title: 'Payment Integration', description: 'Stripe integration' }
          ]
        },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }
    })

    it('should call OpenAI API with correct endpoint', async () => {
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ roadmapAnalysis: { phases: [] } }) } }]
        })
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-openai-key-12345',
            'Content-Type': 'application/json'
          })
        })
      )
    })

    it('should use GPT-4O-mini model', async () => {
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ roadmapAnalysis: { phases: [] } }) } }]
        })
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      const callArgs = (global.fetch as any).mock.calls[0][1]
      const body = JSON.parse(callArgs.body)
      expect(body.model).toBe('gpt-4o-mini')
    })

    it('should use temperature of 0.3 for consistent results', async () => {
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ roadmapAnalysis: { phases: [] } }) } }]
        })
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      const callArgs = (global.fetch as any).mock.calls[0][1]
      const body = JSON.parse(callArgs.body)
      expect(body.temperature).toBe(0.3)
    })

    it('should use max_tokens of 4000', async () => {
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ roadmapAnalysis: { phases: [] } }) } }]
        })
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      const callArgs = (global.fetch as any).mock.calls[0][1]
      const body = JSON.parse(callArgs.body)
      expect(body.max_tokens).toBe(4000)
    })

    it('should use JSON response format', async () => {
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ roadmapAnalysis: { phases: [] } }) } }]
        })
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      const callArgs = (global.fetch as any).mock.calls[0][1]
      const body = JSON.parse(callArgs.body)
      expect(body.response_format).toEqual({ type: 'json_object' })
    })

    it('should include project context in the prompt', async () => {
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ roadmapAnalysis: { phases: [] } }) } }]
        })
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      const callArgs = (global.fetch as any).mock.calls[0][1]
      const body = JSON.parse(callArgs.body)
      expect(body.messages[1].content).toContain('E-commerce Platform')
      expect(body.messages[1].content).toContain('User Authentication')
    })

    it('should return 500 when OpenAI API returns error status', async () => {
      ;(global.fetch as any).mockResolvedValue({
        ok: false,
        status: 429
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(500)
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Failed to generate roadmap'
      })
    })

    it('should return 500 on network error', async () => {
      ;(global.fetch as any).mockRejectedValue(new Error('Network error'))

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(500)
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Failed to generate roadmap'
      })
    })
  })

  describe('Project Type Context Handling', () => {
    beforeEach(() => {
      vi.mocked(authenticate).mockResolvedValue({ user: null })
      vi.mocked(checkUserRateLimit).mockReturnValue(true)
    })

    it('should use operations approach for operations projects', async () => {
      mockRequest = {
        method: 'POST',
        body: {
          projectName: 'Process Improvement',
          projectType: 'operations',
          ideas: []
        },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ roadmapAnalysis: { phases: [] } }) } }]
        })
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      const callArgs = (global.fetch as any).mock.calls[0][1]
      const body = JSON.parse(callArgs.body)
      expect(body.messages[0].content).toContain('Operations Strategy Consultant')
    })

    it('should use technical approach for software projects', async () => {
      mockRequest = {
        method: 'POST',
        body: {
          projectName: 'Mobile App',
          projectType: 'software',
          ideas: []
        },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ roadmapAnalysis: { phases: [] } }) } }]
        })
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      const callArgs = (global.fetch as any).mock.calls[0][1]
      const body = JSON.parse(callArgs.body)
      expect(body.messages[0].content).toContain('Software Engineering Manager')
    })

    it('should use marketing approach for marketing projects', async () => {
      mockRequest = {
        method: 'POST',
        body: {
          projectName: 'Brand Launch',
          projectType: 'marketing',
          ideas: []
        },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ roadmapAnalysis: { phases: [] } }) } }]
        })
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      const callArgs = (global.fetch as any).mock.calls[0][1]
      const body = JSON.parse(callArgs.body)
      expect(body.messages[0].content).toContain('VP of Marketing')
    })

    it('should use business strategy approach for consulting projects', async () => {
      mockRequest = {
        method: 'POST',
        body: {
          projectName: 'Digital Transformation',
          projectType: 'consulting',
          ideas: []
        },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ roadmapAnalysis: { phases: [] } }) } }]
        })
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      const callArgs = (global.fetch as any).mock.calls[0][1]
      const body = JSON.parse(callArgs.body)
      expect(body.messages[0].content).toContain('strategy consulting')
    })

    it('should use generic approach for unknown project types', async () => {
      mockRequest = {
        method: 'POST',
        body: {
          projectName: 'Custom Project',
          projectType: 'other',
          ideas: []
        },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ roadmapAnalysis: { phases: [] } }) } }]
        })
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      const callArgs = (global.fetch as any).mock.calls[0][1]
      const body = JSON.parse(callArgs.body)
      expect(body.messages[0].content).toContain('Program Manager')
    })

    it('should include relevant focus areas based on project type', async () => {
      mockRequest = {
        method: 'POST',
        body: {
          projectName: 'App Development',
          projectType: 'platform',
          ideas: []
        },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ roadmapAnalysis: { phases: [] } }) } }]
        })
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      const callArgs = (global.fetch as any).mock.calls[0][1]
      const body = JSON.parse(callArgs.body)
      expect(body.messages[1].content).toContain('PLATFORM/INFRASTRUCTURE')
      expect(body.messages[1].content).toContain('FRONTEND/WEB')
    })
  })

  describe('Response Processing', () => {
    beforeEach(() => {
      vi.mocked(authenticate).mockResolvedValue({ user: null })
      vi.mocked(checkUserRateLimit).mockReturnValue(true)

      mockRequest = {
        method: 'POST',
        body: {
          projectName: 'Test',
          projectType: 'software',
          ideas: []
        },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }
    })

    it('should return valid roadmap structure', async () => {
      const mockRoadmap = {
        roadmapAnalysis: {
          totalDuration: '12-16 weeks',
          phases: [
            {
              phase: 'Foundation',
              duration: '4 weeks',
              description: 'Setup phase',
              epics: [],
              risks: [],
              successCriteria: []
            }
          ]
        },
        executionStrategy: {
          methodology: 'Agile',
          sprintLength: '2 weeks',
          teamRecommendations: 'Team structure',
          keyMilestones: []
        }
      }

      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(mockRoadmap) } }]
        })
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(200)
      expect(jsonMock).toHaveBeenCalledWith({ roadmap: mockRoadmap })
    })

    it('should handle JSON wrapped in markdown code blocks', async () => {
      const mockRoadmap = { roadmapAnalysis: { phases: [] } }

      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: `\`\`\`json\n${JSON.stringify(mockRoadmap)}\n\`\`\`` } }]
        })
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(200)
      expect(jsonMock).toHaveBeenCalledWith({ roadmap: mockRoadmap })
    })

    it('should handle generic markdown blocks', async () => {
      const mockRoadmap = { roadmapAnalysis: { phases: [] } }

      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: `\`\`\`\n${JSON.stringify(mockRoadmap)}\n\`\`\`` } }]
        })
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(200)
      expect(jsonMock).toHaveBeenCalledWith({ roadmap: mockRoadmap })
    })

    it('should return empty roadmap on invalid JSON', async () => {
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'invalid json' } }]
        })
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(200)
      expect(jsonMock).toHaveBeenCalledWith({ roadmap: {} })
    })

    it('should return empty roadmap when content is missing', async () => {
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: {} }]
        })
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(200)
      expect(jsonMock).toHaveBeenCalledWith({ roadmap: {} })
    })

    it('should return empty roadmap when choices array is empty', async () => {
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: []
        })
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(200)
      expect(jsonMock).toHaveBeenCalledWith({ roadmap: {} })
    })
  })

  describe('Clarifying Questions Generation', () => {
    beforeEach(() => {
      vi.mocked(authenticate).mockResolvedValue({ user: null })
      vi.mocked(checkUserRateLimit).mockReturnValue(true)
    })

    it('should include operations questions for operations projects', async () => {
      mockRequest = {
        method: 'POST',
        body: {
          projectName: 'Test',
          projectType: 'improvement',
          ideas: []
        },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ roadmapAnalysis: { phases: [] } }) } }]
        })
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      const callArgs = (global.fetch as any).mock.calls[0][1]
      const body = JSON.parse(callArgs.body)
      expect(body.messages[0].content).toContain('operational pain points')
    })

    it('should include software questions for software projects', async () => {
      mockRequest = {
        method: 'POST',
        body: {
          projectName: 'Test',
          projectType: 'app',
          ideas: []
        },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ roadmapAnalysis: { phases: [] } }) } }]
        })
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      const callArgs = (global.fetch as any).mock.calls[0][1]
      const body = JSON.parse(callArgs.body)
      expect(body.messages[0].content).toContain('technical constraints')
    })

    it('should include event questions for event projects', async () => {
      mockRequest = {
        method: 'POST',
        body: {
          projectName: 'Test',
          projectType: 'event',
          ideas: []
        },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ roadmapAnalysis: { phases: [] } }) } }]
        })
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      const callArgs = (global.fetch as any).mock.calls[0][1]
      const body = JSON.parse(callArgs.body)
      expect(body.messages[0].content).toContain('target attendee')
    })

    it('should include research questions for research projects', async () => {
      mockRequest = {
        method: 'POST',
        body: {
          projectName: 'Test',
          projectType: 'research',
          ideas: []
        },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ roadmapAnalysis: { phases: [] } }) } }]
        })
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      const callArgs = (global.fetch as any).mock.calls[0][1]
      const body = JSON.parse(callArgs.body)
      expect(body.messages[0].content).toContain('research questions')
    })
  })

  describe('Industry Insights Integration', () => {
    beforeEach(() => {
      vi.mocked(authenticate).mockResolvedValue({ user: null })
      vi.mocked(checkUserRateLimit).mockReturnValue(true)
    })

    it('should include operations insights for operations projects', async () => {
      mockRequest = {
        method: 'POST',
        body: {
          projectName: 'Test',
          projectType: 'process',
          ideas: []
        },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ roadmapAnalysis: { phases: [] } }) } }]
        })
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      const callArgs = (global.fetch as any).mock.calls[0][1]
      const body = JSON.parse(callArgs.body)
      expect(body.messages[0].content).toContain('stakeholder engagement')
    })

    it('should include software insights for software projects', async () => {
      mockRequest = {
        method: 'POST',
        body: {
          projectName: 'Test',
          projectType: 'system',
          ideas: []
        },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ roadmapAnalysis: { phases: [] } }) } }]
        })
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      const callArgs = (global.fetch as any).mock.calls[0][1]
      const body = JSON.parse(callArgs.body)
      expect(body.messages[0].content).toContain('user-centric development')
    })

    it('should include marketing insights for marketing projects', async () => {
      mockRequest = {
        method: 'POST',
        body: {
          projectName: 'Test',
          projectType: 'campaign',
          ideas: []
        },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ roadmapAnalysis: { phases: [] } }) } }]
        })
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      const callArgs = (global.fetch as any).mock.calls[0][1]
      const body = JSON.parse(callArgs.body)
      expect(body.messages[0].content).toContain('integrated campaign strategy')
    })

    it('should include business insights for business projects', async () => {
      mockRequest = {
        method: 'POST',
        body: {
          projectName: 'Test',
          projectType: 'business',
          ideas: []
        },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ roadmapAnalysis: { phases: [] } }) } }]
        })
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      const callArgs = (global.fetch as any).mock.calls[0][1]
      const body = JSON.parse(callArgs.body)
      expect(body.messages[0].content).toContain('strategic clarity')
    })
  })

  describe('Edge Cases', () => {
    beforeEach(() => {
      vi.mocked(authenticate).mockResolvedValue({ user: null })
      vi.mocked(checkUserRateLimit).mockReturnValue(true)
    })

    it('should handle very long project names', async () => {
      mockRequest = {
        method: 'POST',
        body: {
          projectName: 'A'.repeat(500),
          projectType: 'software',
          ideas: []
        },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ roadmapAnalysis: { phases: [] } }) } }]
        })
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(200)
    })

    it('should handle special characters in project name', async () => {
      mockRequest = {
        method: 'POST',
        body: {
          projectName: 'Test <>&"\'',
          projectType: 'software',
          ideas: []
        },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ roadmapAnalysis: { phases: [] } }) } }]
        })
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(200)
    })

    it('should handle large ideas array', async () => {
      mockRequest = {
        method: 'POST',
        body: {
          projectName: 'Test',
          projectType: 'software',
          ideas: Array.from({ length: 100 }, (_, i) => ({
            title: `Idea ${i}`,
            description: `Description ${i}`
          }))
        },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ roadmapAnalysis: { phases: [] } }) } }]
        })
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(200)
    })

    it('should handle missing projectType gracefully', async () => {
      mockRequest = {
        method: 'POST',
        body: {
          projectName: 'Test',
          ideas: []
        },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ roadmapAnalysis: { phases: [] } }) } }]
        })
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(200)
    })

    it('should handle authentication errors gracefully', async () => {
      mockRequest = {
        method: 'POST',
        body: {
          projectName: 'Test',
          projectType: 'software',
          ideas: []
        },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      vi.mocked(authenticate).mockRejectedValue(new Error('Auth error'))
      vi.mocked(checkUserRateLimit).mockReturnValue(true)

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(500)
    })

    it('should handle unexpected error objects', async () => {
      mockRequest = {
        method: 'POST',
        body: {
          projectName: 'Test',
          projectType: 'software',
          ideas: []
        },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      vi.mocked(authenticate).mockResolvedValue({ user: null })
      vi.mocked(checkUserRateLimit).mockReturnValue(true)

      ;(global.fetch as any).mockRejectedValue({ weird: 'error object' })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(500)
    })
  })
})
