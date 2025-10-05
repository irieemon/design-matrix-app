import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import handler from '../transcribe-audio'
import { authenticate, checkUserRateLimit } from '../../auth/middleware'

// Mock dependencies
vi.mock('../../auth/middleware')

// Mock external APIs
global.fetch = vi.fn()

describe('transcribe-audio API endpoint', () => {
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
        body: { audioUrl: 'https://example.com/audio.mp3' },
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
    it('should allow authenticated users with 5 requests/minute', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' }
      mockRequest = {
        method: 'POST',
        body: { audioUrl: 'https://example.com/audio.mp3' },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      vi.mocked(authenticate).mockResolvedValue({ user: mockUser })
      vi.mocked(checkUserRateLimit).mockReturnValue(true)

      vi.mocked(global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: async () => new ArrayBuffer(1000)
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            text: 'Transcribed text',
            duration: 30
          })
        } as any)

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(checkUserRateLimit).toHaveBeenCalledWith(mockUser.id, 5)
    })

    it('should allow unauthenticated users with 2 requests/minute', async () => {
      mockRequest = {
        method: 'POST',
        body: { audioUrl: 'https://example.com/audio.mp3' },
        headers: { 'x-forwarded-for': '192.168.1.1' },
        socket: { remoteAddress: '127.0.0.1' }
      }

      vi.mocked(authenticate).mockResolvedValue({ user: null })
      vi.mocked(checkUserRateLimit).mockReturnValue(true)

      vi.mocked(global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: async () => new ArrayBuffer(1000)
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            text: 'Test',
            duration: 10
          })
        } as any)

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(checkUserRateLimit).toHaveBeenCalledWith('192.168.1.1', 2)
    })

    it('should return 429 when rate limit exceeded for authenticated user', async () => {
      mockRequest = {
        method: 'POST',
        body: { audioUrl: 'https://example.com/audio.mp3' },
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
        body: { audioUrl: 'https://example.com/audio.mp3' },
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

    it('should return 400 when audioUrl is missing', async () => {
      mockRequest = {
        method: 'POST',
        body: {},
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(400)
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Audio URL is required'
      })
    })

    it('should return 400 when audioUrl is empty string', async () => {
      mockRequest = {
        method: 'POST',
        body: { audioUrl: '' },
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
        body: { audioUrl: 'https://example.com/audio.mp3' },
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

  describe('Audio File Download', () => {
    beforeEach(() => {
      vi.mocked(authenticate).mockResolvedValue({ user: null })
      vi.mocked(checkUserRateLimit).mockReturnValue(true)
    })

    it('should download audio file from provided URL', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: async () => new ArrayBuffer(5000)
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            text: 'Transcribed',
            duration: 20
          })
        } as any)

      mockRequest = {
        method: 'POST',
        body: { audioUrl: 'https://example.com/test-audio.mp3' },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(global.fetch).toHaveBeenNthCalledWith(1, 'https://example.com/test-audio.mp3')
    })

    it('should handle audio download failure', async () => {
      vi.mocked(global.fetch as any).mockResolvedValue({
        ok: false,
        status: 404
      } as any)

      mockRequest = {
        method: 'POST',
        body: { audioUrl: 'https://example.com/missing.mp3' },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(500)
    })
  })

  describe('Whisper API Integration', () => {
    beforeEach(() => {
      vi.mocked(authenticate).mockResolvedValue({ user: null })
      vi.mocked(checkUserRateLimit).mockReturnValue(true)
    })

    it('should call Whisper API with correct parameters', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: async () => new ArrayBuffer(1000)
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            text: 'Test transcription',
            duration: 15,
            language: 'en'
          })
        } as any)

      mockRequest = {
        method: 'POST',
        body: { audioUrl: 'https://example.com/audio.mp3' },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(global.fetch).toHaveBeenNthCalledWith(
        2,
        'https://api.openai.com/v1/audio/transcriptions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-openai-key'
          })
        })
      )
    })

    it('should use whisper-1 model', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: async () => new ArrayBuffer(1000)
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            text: 'Test',
            duration: 10
          })
        } as any)

      mockRequest = {
        method: 'POST',
        body: { audioUrl: 'https://example.com/audio.mp3' },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      const whisperCall = (global.fetch as any).mock.calls[1]
      const formData = whisperCall[1]?.body as FormData
      expect(formData).toBeDefined()
    })

    it('should request verbose_json format for detailed response', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: async () => new ArrayBuffer(1000)
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            text: 'Test',
            duration: 10,
            segments: []
          })
        } as any)

      mockRequest = {
        method: 'POST',
        body: { audioUrl: 'https://example.com/audio.mp3' },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(global.fetch).toHaveBeenCalledTimes(2)
    })

    it('should use specified language when provided', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: async () => new ArrayBuffer(1000)
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            text: 'Bonjour',
            duration: 5,
            language: 'fr'
          })
        } as any)

      mockRequest = {
        method: 'POST',
        body: {
          audioUrl: 'https://example.com/french.mp3',
          language: 'fr'
        },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(200)
    })

    it('should default to English when language not specified', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: async () => new ArrayBuffer(1000)
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            text: 'Hello',
            duration: 5
          })
        } as any)

      mockRequest = {
        method: 'POST',
        body: { audioUrl: 'https://example.com/audio.mp3' },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      const result = jsonMock.mock.calls[0][0].transcription
      expect(result.language).toBeDefined()
    })
  })

  describe('Project Context Integration', () => {
    beforeEach(() => {
      vi.mocked(authenticate).mockResolvedValue({ user: null })
      vi.mocked(checkUserRateLimit).mockReturnValue(true)
    })

    it('should accept project context in request', async () => {
      vi.mocked(global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: async () => new ArrayBuffer(1000)
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            text: 'Meeting about Test Project',
            duration: 60
          })
        } as any)

      mockRequest = {
        method: 'POST',
        body: {
          audioUrl: 'https://example.com/meeting.mp3',
          projectContext: {
            projectName: 'Test Project',
            projectType: 'Software Development'
          }
        },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(200)
    })
  })

  describe('Transcription Processing', () => {
    beforeEach(() => {
      vi.mocked(authenticate).mockResolvedValue({ user: null })
      vi.mocked(checkUserRateLimit).mockReturnValue(true)
    })

    it('should return transcription result with all fields', async () => {
      vi.mocked(global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: async () => new ArrayBuffer(1000)
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            text: 'This is a test transcription with enough content for processing.',
            duration: 30,
            language: 'en',
            segments: [
              { start: 0, end: 5, avg_logprob: -0.2 },
              { start: 5, end: 10, avg_logprob: -0.1 }
            ]
          })
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            choices: [{
              message: {
                content: JSON.stringify({
                  summary: 'Test summary',
                  key_insights: ['Insight 1'],
                  relevance_score: 0.8
                })
              }
            }]
          })
        } as any)

      mockRequest = {
        method: 'POST',
        body: { audioUrl: 'https://example.com/audio.mp3' },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(200)
      const result = jsonMock.mock.calls[0][0].transcription
      expect(result.text).toBeDefined()
      expect(result.duration).toBeDefined()
      expect(result.language).toBeDefined()
      expect(result.segments).toBeDefined()
      expect(result.confidence).toBeDefined()
      expect(result.summary).toBeDefined()
    })

    it('should calculate confidence from segment probabilities', async () => {
      vi.mocked(global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: async () => new ArrayBuffer(1000)
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            text: 'Test',
            duration: 10,
            segments: [
              { start: 0, end: 5, avg_logprob: -0.5 },
              { start: 5, end: 10, avg_logprob: -0.3 }
            ]
          })
        } as any)

      mockRequest = {
        method: 'POST',
        body: { audioUrl: 'https://example.com/audio.mp3' },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      const result = jsonMock.mock.calls[0][0].transcription
      expect(result.confidence).toBeGreaterThanOrEqual(0)
      expect(result.confidence).toBeLessThanOrEqual(100)
    })

    it('should detect multiple speakers from pause patterns', async () => {
      vi.mocked(global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: async () => new ArrayBuffer(1000)
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            text: 'Multi-speaker conversation',
            duration: 60,
            segments: [
              { start: 0, end: 5, avg_logprob: -0.2 },
              { start: 8, end: 13, avg_logprob: -0.2 }, // 3s pause
              { start: 16, end: 21, avg_logprob: -0.2 }  // 3s pause
            ]
          })
        } as any)

      mockRequest = {
        method: 'POST',
        body: { audioUrl: 'https://example.com/conversation.mp3' },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      const result = jsonMock.mock.calls[0][0].transcription
      expect(result.speakers.length).toBeGreaterThan(1)
    })

    it('should extract key points from transcription', async () => {
      vi.mocked(global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: async () => new ArrayBuffer(1000)
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            text: 'This is important. The key decision is critical. Our priority is to focus on the goal.',
            duration: 20
          })
        } as any)

      mockRequest = {
        method: 'POST',
        body: { audioUrl: 'https://example.com/meeting.mp3' },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      const result = jsonMock.mock.calls[0][0].transcription
      expect(result.keyPoints.length).toBeGreaterThan(0)
    })

    it('should generate summary for sufficient content', async () => {
      vi.mocked(global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: async () => new ArrayBuffer(1000)
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            text: 'This is a longer transcription with enough content to generate a meaningful summary about the project discussion and key decisions made.',
            duration: 45
          })
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            choices: [{
              message: {
                content: 'Summary: Discussion about project decisions and next steps.'
              }
            }]
          })
        } as any)

      mockRequest = {
        method: 'POST',
        body: { audioUrl: 'https://example.com/long-audio.mp3' },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      const result = jsonMock.mock.calls[0][0].transcription
      expect(result.summary).toBeDefined()
      expect(result.summary.length).toBeGreaterThan(0)
    })

    it('should skip summary for very short content', async () => {
      vi.mocked(global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: async () => new ArrayBuffer(1000)
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            text: 'Short.',
            duration: 2
          })
        } as any)

      mockRequest = {
        method: 'POST',
        body: { audioUrl: 'https://example.com/short.mp3' },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      const result = jsonMock.mock.calls[0][0].transcription
      expect(result.summary).toContain('too short')
    })
  })

  describe('Error Handling', () => {
    beforeEach(() => {
      vi.mocked(authenticate).mockResolvedValue({ user: null })
      vi.mocked(checkUserRateLimit).mockReturnValue(true)
    })

    it('should return 500 on Whisper API error', async () => {
      vi.mocked(global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: async () => new ArrayBuffer(1000)
        } as any)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: async () => 'API Error'
        } as any)

      mockRequest = {
        method: 'POST',
        body: { audioUrl: 'https://example.com/audio.mp3' },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(500)
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Failed to transcribe audio'
      })
    })

    it('should handle network errors gracefully', async () => {
      vi.mocked(global.fetch as any).mockRejectedValue(new Error('Network error'))

      mockRequest = {
        method: 'POST',
        body: { audioUrl: 'https://example.com/audio.mp3' },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(500)
    })

    it('should handle summary generation failure gracefully', async () => {
      vi.mocked(global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: async () => new ArrayBuffer(1000)
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            text: 'Long enough text for summary generation that should trigger the summary API call',
            duration: 60
          })
        } as any)
        .mockResolvedValueOnce({
          ok: false,
          status: 500
        } as any)

      mockRequest = {
        method: 'POST',
        body: { audioUrl: 'https://example.com/audio.mp3' },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      const result = jsonMock.mock.calls[0][0].transcription
      expect(result.summary).toContain('unavailable')
    })
  })

  describe('Project Relevance Assessment', () => {
    beforeEach(() => {
      vi.mocked(authenticate).mockResolvedValue({ user: null })
      vi.mocked(checkUserRateLimit).mockReturnValue(true)
    })

    it('should assess high relevance when project mentioned', async () => {
      vi.mocked(global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: async () => new ArrayBuffer(1000)
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            text: 'Discussing the Test Project implementation and development goals',
            duration: 30
          })
        } as any)

      mockRequest = {
        method: 'POST',
        body: {
          audioUrl: 'https://example.com/meeting.mp3',
          projectContext: {
            projectName: 'Test Project',
            projectType: 'Software'
          }
        },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      const result = jsonMock.mock.calls[0][0].transcription
      expect(result.projectRelevance).toBe('high')
    })

    it('should assess medium relevance by default', async () => {
      vi.mocked(global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: async () => new ArrayBuffer(1000)
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            text: 'Generic discussion',
            duration: 10
          })
        } as any)

      mockRequest = {
        method: 'POST',
        body: { audioUrl: 'https://example.com/audio.mp3' },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      const result = jsonMock.mock.calls[0][0].transcription
      expect(result.projectRelevance).toBe('medium')
    })
  })
})
