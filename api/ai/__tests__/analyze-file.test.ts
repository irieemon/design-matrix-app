import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import handler from '../analyze-file'
import { createClient } from '@supabase/supabase-js'
import { authenticate, checkUserRateLimit } from '../../auth/middleware'

// Mock dependencies
vi.mock('@supabase/supabase-js')
vi.mock('../../auth/middleware')

// Mock external APIs
global.fetch = vi.fn()

describe('analyze-file API endpoint', () => {
  let mockRequest: Partial<VercelRequest>
  let mockResponse: Partial<VercelResponse>
  let mockSupabase: any
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

    // Setup Supabase mock
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
      update: vi.fn().mockReturnThis(),
      storage: {
        from: vi.fn().mockReturnThis(),
        createSignedUrl: vi.fn()
      }
    }

    vi.mocked(createClient).mockReturnValue(mockSupabase)

    // Setup environment variables
    process.env.OPENAI_API_KEY = 'test-openai-key'
    process.env.VITE_SUPABASE_URL = 'https://test.supabase.co'
    process.env.VITE_SUPABASE_ANON_KEY = 'test-anon-key'
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

    it('should accept POST requests', async () => {
      mockRequest = {
        method: 'POST',
        body: { fileId: 'test-file', projectId: 'test-project' },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      vi.mocked(authenticate).mockResolvedValue({ user: null })
      vi.mocked(checkUserRateLimit).mockReturnValue(true)

      mockSupabase.single.mockResolvedValue({
        data: null,
        error: new Error('Not found')
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).not.toHaveBeenCalledWith(405)
    })
  })

  describe('Authentication & Rate Limiting', () => {
    it('should allow authenticated users with 20 requests/minute', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' }
      mockRequest = {
        method: 'POST',
        body: { fileId: 'file-1', projectId: 'project-1' },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      vi.mocked(authenticate).mockResolvedValue({ user: mockUser })
      vi.mocked(checkUserRateLimit).mockReturnValue(true)

      mockSupabase.single.mockResolvedValue({
        data: null,
        error: new Error('Not found')
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(checkUserRateLimit).toHaveBeenCalledWith(mockUser.id, 20)
    })

    it('should allow unauthenticated users with 5 requests/minute', async () => {
      mockRequest = {
        method: 'POST',
        body: { fileId: 'file-1', projectId: 'project-1' },
        headers: { 'x-forwarded-for': '192.168.1.1' },
        socket: { remoteAddress: '127.0.0.1' }
      }

      vi.mocked(authenticate).mockResolvedValue({ user: null })
      vi.mocked(checkUserRateLimit).mockReturnValue(true)

      mockSupabase.single.mockResolvedValue({
        data: null,
        error: new Error('Not found')
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(checkUserRateLimit).toHaveBeenCalledWith('192.168.1.1', 5)
    })

    it('should return 429 when rate limit exceeded for authenticated user', async () => {
      mockRequest = {
        method: 'POST',
        body: { fileId: 'file-1', projectId: 'project-1' },
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
        body: { fileId: 'file-1', projectId: 'project-1' },
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
        body: { fileId: 'file-1', projectId: 'project-1' },
        headers: {},
        socket: { remoteAddress: '10.0.0.1' }
      }

      vi.mocked(authenticate).mockResolvedValue({ user: null })
      vi.mocked(checkUserRateLimit).mockReturnValue(true)

      mockSupabase.single.mockResolvedValue({
        data: null,
        error: new Error('Not found')
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(checkUserRateLimit).toHaveBeenCalledWith('10.0.0.1', 5)
    })
  })

  describe('Request Validation', () => {
    beforeEach(() => {
      vi.mocked(authenticate).mockResolvedValue({ user: null })
      vi.mocked(checkUserRateLimit).mockReturnValue(true)
    })

    it('should return 400 when fileId is missing', async () => {
      mockRequest = {
        method: 'POST',
        body: { projectId: 'project-1' },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(400)
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'File ID and Project ID are required'
      })
    })

    it('should return 400 when projectId is missing', async () => {
      mockRequest = {
        method: 'POST',
        body: { fileId: 'file-1' },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(400)
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'File ID and Project ID are required'
      })
    })

    it('should return 400 when both fileId and projectId are missing', async () => {
      mockRequest = {
        method: 'POST',
        body: {},
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(400)
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'File ID and Project ID are required'
      })
    })

    it('should return 500 when Supabase URL is missing', async () => {
      delete process.env.VITE_SUPABASE_URL
      delete process.env.NEXT_PUBLIC_SUPABASE_URL
      delete process.env.SUPABASE_URL

      mockRequest = {
        method: 'POST',
        body: { fileId: 'file-1', projectId: 'project-1' },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(500)
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Supabase configuration missing'
      })
    })

    it('should return 500 when Supabase key is missing', async () => {
      delete process.env.VITE_SUPABASE_ANON_KEY
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      delete process.env.SUPABASE_ANON_KEY
      delete process.env.SUPABASE_KEY

      mockRequest = {
        method: 'POST',
        body: { fileId: 'file-1', projectId: 'project-1' },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(500)
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Supabase configuration missing'
      })
    })
  })

  describe('File Record Fetching', () => {
    beforeEach(() => {
      vi.mocked(authenticate).mockResolvedValue({ user: null })
      vi.mocked(checkUserRateLimit).mockReturnValue(true)

      mockRequest = {
        method: 'POST',
        body: { fileId: 'file-1', projectId: 'project-1' },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }
    })

    it('should fetch file record from Supabase with correct query', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: new Error('Not found')
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(mockSupabase.from).toHaveBeenCalledWith('project_files')
      expect(mockSupabase.select).toHaveBeenCalledWith('*')
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'file-1')
      expect(mockSupabase.eq).toHaveBeenCalledWith('project_id', 'project-1')
      expect(mockSupabase.single).toHaveBeenCalled()
    })

    it('should return 404 when file not found', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: new Error('Not found')
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(404)
      expect(jsonMock).toHaveBeenCalledWith({ error: 'File not found' })
    })

    it('should return 404 when file record is null', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: null
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(404)
      expect(jsonMock).toHaveBeenCalledWith({ error: 'File not found' })
    })
  })

  describe('Cached Results', () => {
    beforeEach(() => {
      vi.mocked(authenticate).mockResolvedValue({ user: null })
      vi.mocked(checkUserRateLimit).mockReturnValue(true)

      mockRequest = {
        method: 'POST',
        body: { fileId: 'file-1', projectId: 'project-1' },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }
    })

    it('should return cached analysis when already completed', async () => {
      const cachedAnalysis = {
        summary: 'Cached analysis',
        key_insights: ['Insight 1', 'Insight 2'],
        relevance_score: 0.8
      }

      mockSupabase.single.mockResolvedValue({
        data: {
          id: 'file-1',
          name: 'test.txt',
          mime_type: 'text/plain',
          analysis_status: 'completed',
          ai_analysis: cachedAnalysis
        },
        error: null
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(200)
      expect(jsonMock).toHaveBeenCalledWith({
        analysis: cachedAnalysis,
        cached: true
      })
    })

    it('should not call OpenAI API when returning cached results', async () => {
      vi.mocked(global.fetch as any)

      mockSupabase.single.mockResolvedValue({
        data: {
          id: 'file-1',
          name: 'test.txt',
          mime_type: 'text/plain',
          analysis_status: 'completed',
          ai_analysis: { summary: 'Cached' }
        },
        error: null
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(global.fetch).not.toHaveBeenCalled()
    })
  })

  describe('Analysis Status Updates', () => {
    beforeEach(() => {
      vi.mocked(authenticate).mockResolvedValue({ user: null })
      vi.mocked(checkUserRateLimit).mockReturnValue(true)

      mockRequest = {
        method: 'POST',
        body: { fileId: 'file-1', projectId: 'project-1' },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }
    })

    it('should update status to analyzing before processing', async () => {
      mockSupabase.single.mockResolvedValue({
        data: {
          id: 'file-1',
          name: 'test.txt',
          mime_type: 'text/plain',
          analysis_status: 'pending',
          content_preview: 'Test content'
        },
        error: null
      })

      vi.mocked(global.fetch as any)
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{
            message: { content: JSON.stringify({ summary: 'Test', key_insights: [] }) }
          }]
        })
      } as any)

      mockSupabase.update.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({
            data: [{ id: 'file-1', ai_analysis: { summary: 'Test' } }],
            error: null
          })
        })
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(mockSupabase.update).toHaveBeenCalledWith({
        analysis_status: 'analyzing'
      })
    })

    it('should update status to completed on success', async () => {
      mockSupabase.single.mockResolvedValue({
        data: {
          id: 'file-1',
          name: 'test.txt',
          mime_type: 'text/plain',
          analysis_status: 'pending',
          content_preview: 'Test content for analysis'
        },
        error: null
      })

      vi.mocked(global.fetch as any)
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{
            message: { content: JSON.stringify({ summary: 'Analysis complete', key_insights: ['Insight'] }) }
          }]
        })
      } as any)

      let completedCalled = false
      mockSupabase.update.mockImplementation((data: any) => {
        if (data.analysis_status === 'completed') {
          completedCalled = true
        }
        return {
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockResolvedValue({
              data: [{ id: 'file-1' }],
              error: null
            })
          })
        }
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(completedCalled).toBe(true)
    })

    it('should update status to skipped when OpenAI key missing', async () => {
      delete process.env.OPENAI_API_KEY

      mockSupabase.single.mockResolvedValue({
        data: {
          id: 'file-1',
          name: 'test.txt',
          mime_type: 'text/plain',
          analysis_status: 'pending'
        },
        error: null
      })

      let skippedCalled = false
      mockSupabase.update.mockImplementation((data: any) => {
        if (data.analysis_status === 'skipped') {
          skippedCalled = true
        }
        return {
          eq: vi.fn().mockResolvedValue({})
        }
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(skippedCalled).toBe(true)
      expect(statusMock).toHaveBeenCalledWith(500)
    })

    it('should update status to failed on analysis error', async () => {
      mockSupabase.single.mockResolvedValue({
        data: {
          id: 'file-1',
          name: 'test.txt',
          mime_type: 'text/plain',
          analysis_status: 'pending',
          content_preview: 'Test'
        },
        error: null
      })

      vi.mocked(global.fetch as any)
      (global.fetch as any).mockRejectedValue(new Error('OpenAI API error'))

      let failedCalled = false
      mockSupabase.update.mockImplementation((data: any) => {
        if (data.analysis_status === 'failed') {
          failedCalled = true
        }
        return {
          eq: vi.fn().mockResolvedValue({})
        }
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(failedCalled).toBe(true)
    })
  })

  describe('Error Handling', () => {
    beforeEach(() => {
      vi.mocked(authenticate).mockResolvedValue({ user: null })
      vi.mocked(checkUserRateLimit).mockReturnValue(true)

      mockRequest = {
        method: 'POST',
        body: { fileId: 'file-1', projectId: 'project-1' },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      }
    })

    it('should return 500 on database error', async () => {
      mockSupabase.single.mockRejectedValue(new Error('Database error'))

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(500)
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Failed to analyze file'
      })
    })

    it('should handle Supabase client creation failure', async () => {
      vi.mocked(createClient).mockImplementation(() => {
        throw new Error('Client creation failed')
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(500)
    })

    it('should update status to failed when save fails', async () => {
      mockSupabase.single.mockResolvedValue({
        data: {
          id: 'file-1',
          name: 'test.txt',
          mime_type: 'text/plain',
          content_preview: 'Test'
        },
        error: null
      })

      vi.mocked(global.fetch as any)
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ summary: 'Test' }) } }]
        })
      } as any)

      mockSupabase.update.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({
            data: null,
            error: new Error('Update failed')
          })
        })
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(500)
    })
  })
})
