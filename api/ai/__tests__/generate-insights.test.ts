import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import handler from '../generate-insights'

// Mock external APIs
global.fetch = vi.fn()

describe('generate-insights API endpoint', () => {
  let mockRequest: Partial<VercelRequest>
  let mockResponse: Partial<VercelResponse>
  let statusMock: ReturnType<typeof vi.fn>
  let jsonMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()

    // Setup fetch mock (must be after clearAllMocks)
    global.fetch = vi.fn()

    // Setup response mocks
    statusMock = vi.fn().mockReturnThis()
    jsonMock = vi.fn().mockReturnThis()

    mockResponse = {
      status: statusMock,
      json: jsonMock
    }

    // Setup environment variables
    process.env.OPENAI_API_KEY = 'test-openai-key-12345'
    delete process.env.ANTHROPIC_API_KEY
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
          ideas: [{ title: 'Test', quadrant: 'quick-wins' }],
          projectName: 'Test Project',
          projectType: 'software'
        },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{
            message: { content: JSON.stringify({ executiveSummary: 'Test' }) }
          }]
        })
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).not.toHaveBeenCalledWith(405)
    })
  })

  describe('Rate Limiting', () => {
    it('should allow 8 requests per minute per IP', async () => {
      mockRequest = {
        method: 'POST',
        body: {
          ideas: [{ title: 'Test', quadrant: 'quick-wins' }],
          projectName: 'Test',
          projectType: 'software'
        },
        headers: { 'x-forwarded-for': '192.168.1.100' },
        socket: { remoteAddress: '127.0.0.1' }
      }

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ executiveSummary: 'Test' }) } }]
        })
      })

      // Make 8 requests - all should succeed
      for (let i = 0; i < 8; i++) {
        vi.clearAllMocks()
        await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)
        expect(statusMock).not.toHaveBeenCalledWith(429)
      }
    })

    it('should return 429 on 9th request within rate limit window', async () => {
      mockRequest = {
        method: 'POST',
        body: {
          ideas: [{ title: 'Test', quadrant: 'quick-wins' }],
          projectName: 'Test',
          projectType: 'software'
        },
        headers: { 'x-forwarded-for': '192.168.1.101' },
        socket: { remoteAddress: '127.0.0.1' }
      }

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ executiveSummary: 'Test' }) } }]
        })
      })

      // Make 8 successful requests
      for (let i = 0; i < 8; i++) {
        vi.clearAllMocks()
        await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)
      }

      // 9th request should be rate limited
      vi.clearAllMocks()
      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(429)
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Rate limit exceeded. Please try again later.'
      })
    })

    it('should use x-forwarded-for header for rate limiting', async () => {
      const ip1 = '10.0.0.1'
      const ip2 = '10.0.0.2'

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ executiveSummary: 'Test' }) } }]
        })
      })

      // Make 8 requests from IP1
      for (let i = 0; i < 8; i++) {
        vi.clearAllMocks()
        mockRequest = {
          method: 'POST',
          body: { ideas: [{ title: 'Test', quadrant: 'quick-wins' }], projectName: 'Test', projectType: 'software' },
          headers: { 'x-forwarded-for': ip1 },
          socket: { remoteAddress: '127.0.0.1' }
        }
        await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)
      }

      // 9th request from IP1 should be rate limited
      vi.clearAllMocks()
      mockRequest = {
        method: 'POST',
        body: { ideas: [{ title: 'Test', quadrant: 'quick-wins' }], projectName: 'Test', projectType: 'software' },
        headers: { 'x-forwarded-for': ip1 },
        socket: { remoteAddress: '127.0.0.1' }
      }
      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)
      expect(statusMock).toHaveBeenCalledWith(429)

      // But IP2 should still have full quota
      vi.clearAllMocks()
      mockRequest = {
        method: 'POST',
        body: { ideas: [{ title: 'Test', quadrant: 'quick-wins' }], projectName: 'Test', projectType: 'software' },
        headers: { 'x-forwarded-for': ip2 },
        socket: { remoteAddress: '127.0.0.1' }
      }
      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)
      expect(statusMock).not.toHaveBeenCalledWith(429)
    })

    it('should use socket.remoteAddress when x-forwarded-for missing', async () => {
      mockRequest = {
        method: 'POST',
        body: {
          ideas: [{ title: 'Test', quadrant: 'quick-wins' }],
          projectName: 'Test',
          projectType: 'software'
        },
        headers: {},
        socket: { remoteAddress: '192.168.5.5' }
      }

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ executiveSummary: 'Test' }) } }]
        })
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).not.toHaveBeenCalledWith(429)
    })
  })

  describe('Request Validation', () => {
    beforeEach(() => {
      mockRequest = {
        method: 'POST',
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }
    })

    it('should return 400 when ideas is missing', async () => {
      mockRequest.body = {
        projectName: 'Test Project',
        projectType: 'software'
      }

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(400)
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Ideas array is required' })
    })

    it('should return 400 when ideas is not an array', async () => {
      mockRequest.body = {
        ideas: 'not-an-array',
        projectName: 'Test Project',
        projectType: 'software'
      }

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(400)
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Ideas array is required' })
    })

    it('should return 400 when ideas is null', async () => {
      mockRequest.body = {
        ideas: null,
        projectName: 'Test Project',
        projectType: 'software'
      }

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(400)
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Ideas array is required' })
    })

    it('should return 400 when ideas is an empty object', async () => {
      mockRequest.body = {
        ideas: {},
        projectName: 'Test Project',
        projectType: 'software'
      }

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(400)
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Ideas array is required' })
    })

    it('should return 500 when no AI service keys configured', async () => {
      delete process.env.OPENAI_API_KEY
      delete process.env.ANTHROPIC_API_KEY

      mockRequest.body = {
        ideas: [{ title: 'Test', quadrant: 'quick-wins' }],
        projectName: 'Test Project',
        projectType: 'software'
      }

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(500)
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'No AI service configured. Please set OPENAI_API_KEY or ANTHROPIC_API_KEY environment variable.'
      })
    })

    it('should accept empty ideas array', async () => {
      mockRequest.body = {
        ideas: [],
        projectName: 'Test Project',
        projectType: 'software'
      }

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ executiveSummary: 'Test' }) } }]
        })
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).not.toHaveBeenCalledWith(400)
    })
  })

  describe('OpenAI API Integration', () => {
    beforeEach(() => {
      mockRequest = {
        method: 'POST',
        body: {
          ideas: [
            { title: 'Feature A', description: 'Description A', quadrant: 'quick-wins' },
            { title: 'Feature B', description: 'Description B', quadrant: 'major-projects' }
          ],
          projectName: 'Test Project',
          projectType: 'software'
        },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }
    })

    it('should call OpenAI API with correct parameters', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ executiveSummary: 'Test' }) } }]
        })
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect((global.fetch as any)).toHaveBeenCalledWith(
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

    it('should use GPT-5 model by default', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ executiveSummary: 'Test' }) } }]
        })
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      const callArgs = (global.fetch as any).mock.calls[0][1]
      const body = JSON.parse(callArgs.body)
      expect(body.model).toBe('gpt-5')
    })

    it('should use custom model when specified in modelSelection', async () => {
      mockRequest.body.modelSelection = {
        model: 'gpt-5-mini',
        temperature: 0.7,
        maxTokens: 3000
      }

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ executiveSummary: 'Test' }) } }]
        })
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      const callArgs = (global.fetch as any).mock.calls[0][1]
      const body = JSON.parse(callArgs.body)
      expect(body.model).toBe('gpt-5-mini')
    })

    it('should use max_completion_tokens for GPT-5 models', async () => {
      mockRequest.body.modelSelection = {
        model: 'gpt-5',
        maxTokens: 5000
      }

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ executiveSummary: 'Test' }) } }]
        })
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      const callArgs = (global.fetch as any).mock.calls[0][1]
      const body = JSON.parse(callArgs.body)
      expect(body.max_completion_tokens).toBe(5000)
      expect(body.max_tokens).toBeUndefined()
    })

    it('should omit temperature for GPT-5 models', async () => {
      mockRequest.body.modelSelection = {
        model: 'gpt-5',
        temperature: 0.8
      }

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ executiveSummary: 'Test' }) } }]
        })
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      const callArgs = (global.fetch as any).mock.calls[0][1]
      const body = JSON.parse(callArgs.body)
      expect(body.temperature).toBeUndefined()
    })

    it('should include temperature for GPT-4 models', async () => {
      mockRequest.body.modelSelection = {
        model: 'gpt-4o-mini',
        temperature: 0.7
      }

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ executiveSummary: 'Test' }) } }]
        })
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      const callArgs = (global.fetch as any).mock.calls[0][1]
      const body = JSON.parse(callArgs.body)
      expect(body.temperature).toBe(0.7)
    })

    it('should include seed parameter for reproducibility', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ executiveSummary: 'Test' }) } }]
        })
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      const callArgs = (global.fetch as any).mock.calls[0][1]
      const body = JSON.parse(callArgs.body)
      expect(body.seed).toBeDefined()
      expect(typeof body.seed).toBe('number')
    })

    it('should return 500 when OpenAI API returns error status', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => 'Rate limit exceeded'
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(500)
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('Failed to generate insights')
        })
      )
    })

    it('should return 500 on network error', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Network error'))

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(500)
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('Failed to generate insights')
        })
      )
    })
  })

  describe('Response Processing', () => {
    beforeEach(() => {
      mockRequest = {
        method: 'POST',
        body: {
          ideas: [{ title: 'Test', quadrant: 'quick-wins' }],
          projectName: 'Test',
          projectType: 'software'
        },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }
    })

    it('should parse valid JSON response', async () => {
      const mockInsights = {
        executiveSummary: 'Test summary',
        keyInsights: [{ insight: 'Test insight', impact: 'High' }]
      }

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(mockInsights) } }]
        })
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(200)
      expect(jsonMock).toHaveBeenCalledWith({ insights: mockInsights })
    })

    it('should handle JSON wrapped in markdown code blocks', async () => {
      const mockInsights = { executiveSummary: 'Test' }

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: `\`\`\`json\n${JSON.stringify(mockInsights)}\n\`\`\`` } }]
        })
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(200)
      expect(jsonMock).toHaveBeenCalledWith({ insights: mockInsights })
    })

    it('should handle response with generic markdown blocks', async () => {
      const mockInsights = { executiveSummary: 'Test' }

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: `\`\`\`\n${JSON.stringify(mockInsights)}\n\`\`\`` } }]
        })
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(200)
      expect(jsonMock).toHaveBeenCalledWith({ insights: mockInsights })
    })

    it('should return 500 when response content is invalid JSON', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'not valid json' } }]
        })
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(500)
    })

    it('should return 500 when response content is empty', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '' } }]
        })
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(500)
    })

    it('should return 500 when insights object is empty', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{}' } }]
        })
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(500)
    })

    it('should return 500 when choices array is empty', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: []
        })
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(500)
    })
  })

  describe('Document Context Integration', () => {
    beforeEach(() => {
      mockRequest = {
        method: 'POST',
        body: {
          ideas: [{ title: 'Test', quadrant: 'quick-wins' }],
          projectName: 'Test',
          projectType: 'software'
        },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }
    })

    it('should process cached file analysis', async () => {
      mockRequest.body.documentContext = [
        {
          name: 'test.txt',
          analysis_status: 'completed',
          ai_analysis: {
            summary: 'Test summary',
            key_insights: ['Insight 1', 'Insight 2']
          }
        }
      ]

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ executiveSummary: 'Test' }) } }]
        })
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(200)
    })

    it('should handle image analysis with visual description', async () => {
      mockRequest.body.documentContext = [
        {
          name: 'image.png',
          analysis_status: 'completed',
          ai_analysis: {
            content_type: 'image',
            visual_description: 'A red car',
            extracted_text: 'License plate: XYZ123'
          }
        }
      ]

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ executiveSummary: 'Test' }) } }]
        })
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(200)
    })

    it('should handle audio transcripts', async () => {
      mockRequest.body.documentContext = [
        {
          name: 'meeting.mp3',
          analysis_status: 'completed',
          ai_analysis: {
            content_type: 'audio',
            audio_transcript: 'Meeting transcript text'
          }
        }
      ]

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ executiveSummary: 'Test' }) } }]
        })
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(200)
    })

    it('should handle files without analysis', async () => {
      mockRequest.body.documentContext = [
        {
          name: 'file.txt',
          content: 'Raw file content'
        }
      ]

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ executiveSummary: 'Test' }) } }]
        })
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(200)
    })
  })

  describe('Focus Area Handling', () => {
    beforeEach(() => {
      mockRequest = {
        method: 'POST',
        body: {
          ideas: [{ title: 'Test', quadrant: 'quick-wins' }],
          projectName: 'Test',
          projectType: 'software'
        },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }
    })

    it('should handle comprehensive-risk-analysis focus area', async () => {
      mockRequest.body.focusArea = 'comprehensive-risk-analysis'

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ executiveSummary: 'Test' }) } }]
        })
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      const callArgs = (global.fetch as any).mock.calls[0][1]
      const body = JSON.parse(callArgs.body)
      expect(body.messages[0].content).toContain('ENHANCED RISK ANALYSIS MODE')
    })

    it('should handle standard focus area by default', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ executiveSummary: 'Test' }) } }]
        })
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(200)
    })
  })

  describe('Anthropic API Integration', () => {
    beforeEach(() => {
      delete process.env.OPENAI_API_KEY
      process.env.ANTHROPIC_API_KEY = 'test-anthropic-key'

      mockRequest = {
        method: 'POST',
        body: {
          ideas: [{ title: 'Test', quadrant: 'quick-wins' }],
          projectName: 'Test',
          projectType: 'software'
        },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }
    })

    it('should call Anthropic API when OpenAI key missing', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ text: JSON.stringify({ executiveSummary: 'Test' }) }]
        })
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect((global.fetch as any)).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-anthropic-key',
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01'
          })
        })
      )
    })

    it('should use Claude model for Anthropic', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ text: JSON.stringify({ executiveSummary: 'Test' }) }]
        })
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      const callArgs = (global.fetch as any).mock.calls[0][1]
      const body = JSON.parse(callArgs.body)
      expect(body.model).toBe('claude-3-5-sonnet-20241022')
    })

    it('should return 500 when Anthropic API fails', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 500
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(500)
    })

    it('should handle Anthropic response with markdown code blocks', async () => {
      const mockInsights = { executiveSummary: 'Test' }

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ text: `\`\`\`json\n${JSON.stringify(mockInsights)}\n\`\`\`` }]
        })
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(200)
      expect(jsonMock).toHaveBeenCalledWith({ insights: mockInsights })
    })
  })

  describe('Edge Cases', () => {
    beforeEach(() => {
      mockRequest = {
        method: 'POST',
        body: {
          ideas: [{ title: 'Test', quadrant: 'quick-wins' }],
          projectName: 'Test',
          projectType: 'software'
        },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }
    })

    it('should handle large ideas array', async () => {
      mockRequest.body.ideas = Array.from({ length: 100 }, (_, i) => ({
        title: `Idea ${i}`,
        description: `Description ${i}`,
        quadrant: 'quick-wins'
      }))

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ executiveSummary: 'Test' }) } }]
        })
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(200)
    })

    it('should handle special characters in project name', async () => {
      mockRequest.body.projectName = 'Test Project <>&"\''

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ executiveSummary: 'Test' }) } }]
        })
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(200)
    })

    it('should handle missing projectName gracefully', async () => {
      delete mockRequest.body.projectName

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ executiveSummary: 'Test' }) } }]
        })
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(200)
    })

    it('should handle missing projectType gracefully', async () => {
      delete mockRequest.body.projectType

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ executiveSummary: 'Test' }) } }]
        })
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(200)
    })

    it('should handle malformed documentContext gracefully', async () => {
      mockRequest.body.documentContext = [null, undefined, 'not-an-object']

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ executiveSummary: 'Test' }) } }]
        })
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(200)
    })
  })
})
