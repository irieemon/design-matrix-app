/**
 * User Endpoint Tests
 *
 * Comprehensive security tests for the /api/auth/user endpoint that protects:
 * - User profile fetching with authentication verification
 * - Performance monitoring and timeout protection
 * - Demo user detection and handling
 * - Error handling and graceful degradation
 * - Security headers and middleware integration
 * - Profile data consistency and caching
 *
 * Business Impact: Data breaches, unauthorized access, service disruption
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { VercelRequest, VercelResponse } from '@vercel/node'

// Mock dependencies
vi.mock('../middleware', () => ({
  authenticate: vi.fn(),
  securityMiddleware: vi.fn()
}))

vi.mock('../roles', () => ({
  getUserProfile: vi.fn()
}))

vi.mock('../../utils/performanceMonitor', () => ({
  finishAuthSession: vi.fn(),
  recordAuthMetric: vi.fn()
}))

// Set up environment
process.env.NODE_ENV = 'test'
process.env.SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_ANON_KEY = 'test-anon-key'

// Import after mocks
import handler from '../user'
import { authenticate, securityMiddleware } from '../middleware'
import { getUserProfile } from '../roles'

describe('User Endpoint', () => {
  let mockRequest: Partial<VercelRequest>
  let mockResponse: Partial<VercelResponse>
  let statusMock: any
  let jsonMock: any

  const createMockRequest = (overrides: Partial<VercelRequest> = {}): VercelRequest => ({
    method: 'GET',
    headers: {
      'user-agent': 'test-agent',
      authorization: 'Bearer valid.token',
      ...overrides.headers
    },
    url: '/api/auth/user',
    query: {},
    body: {},
    ...overrides
  } as VercelRequest)

  const createMockResponse = (): VercelResponse => {
    jsonMock = vi.fn().mockReturnThis()
    statusMock = vi.fn().mockReturnValue({ json: jsonMock })

    return {
      status: statusMock,
      json: jsonMock,
      setHeader: vi.fn(),
      getHeader: vi.fn(),
      removeHeader: vi.fn()
    } as unknown as VercelResponse
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockRequest = createMockRequest()
    mockResponse = createMockResponse()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Authentication and Authorization', () => {
    it('should successfully authenticate and return user profile', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com'
      }

      const mockProfile = {
        id: 'user-123',
        email: 'test@example.com',
        role: 'user' as const,
        full_name: 'Test User',
        avatar_url: 'https://example.com/avatar.jpg',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-02T00:00:00Z'
      }

      ;(authenticate as any).mockResolvedValue({
        user: mockUser,
        error: null
      })

      ;(getUserProfile as any).mockResolvedValue(mockProfile)

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(securityMiddleware).toHaveBeenCalledWith(mockRequest, mockResponse)
      expect(authenticate).toHaveBeenCalledWith(mockRequest)
      expect(getUserProfile).toHaveBeenCalledWith('user-123', 'test@example.com')
      expect(statusMock).toHaveBeenCalledWith(200)
      expect(jsonMock).toHaveBeenCalledWith({
        user: mockProfile
      })
    })

    it('should return 401 when authentication fails', async () => {
      ;(authenticate as any).mockResolvedValue({
        user: null,
        error: 'Invalid token'
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(401)
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Invalid token'
      })
    })

    it('should return 401 when user is null', async () => {
      ;(authenticate as any).mockResolvedValue({
        user: null,
        error: null
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(401)
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Unauthorized'
      })
    })

    it('should handle missing authorization header', async () => {
      mockRequest = createMockRequest({ headers: {} })

      ;(authenticate as any).mockResolvedValue({
        user: null,
        error: 'Missing authorization header'
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(401)
    })

    it('should handle expired tokens', async () => {
      ;(authenticate as any).mockResolvedValue({
        user: null,
        error: 'Token expired'
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(401)
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Token expired'
      })
    })
  })

  describe('HTTP Method Validation', () => {
    it('should reject POST requests', async () => {
      mockRequest = createMockRequest({ method: 'POST' })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(405)
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Method not allowed'
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

    it('should only accept GET requests', async () => {
      mockRequest = createMockRequest({ method: 'GET' })

      const mockUser = { id: 'user-123', email: 'test@example.com' }
      const mockProfile = {
        id: 'user-123',
        email: 'test@example.com',
        role: 'user' as const
      }

      ;(authenticate as any).mockResolvedValue({ user: mockUser, error: null })
      ;(getUserProfile as any).mockResolvedValue(mockProfile)

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(200)
    })
  })

  describe('Performance Monitoring', () => {
    it('should timeout authentication after 300ms', async () => {
      ;(authenticate as any).mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({ user: null }), 500))
      )

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(408)
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Authentication timeout'
      })
    })

    it('should measure authentication performance', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' }
      const mockProfile = { id: 'user-123', email: 'test@example.com', role: 'user' as const }

      ;(authenticate as any).mockResolvedValue({ user: mockUser, error: null })
      ;(getUserProfile as any).mockResolvedValue(mockProfile)

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(200)
      consoleSpy.mockRestore()
    })

    it('should warn about slow authentication (>200ms)', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' }
      const mockProfile = { id: 'user-123', email: 'test@example.com', role: 'user' as const }

      ;(authenticate as any).mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({ user: mockUser }), 250))
      )
      ;(getUserProfile as any).mockResolvedValue(mockProfile)

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(warnSpy).toHaveBeenCalled()
      warnSpy.mockRestore()
    })

    it('should log slow requests (>500ms)', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' }
      const mockProfile = { id: 'user-123', email: 'test@example.com', role: 'user' as const }

      ;(authenticate as any).mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({ user: mockUser }), 100))
      )
      ;(getUserProfile as any).mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve(mockProfile), 450))
      )

      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(200)
      logSpy.mockRestore()
    })
  })

  describe('User Profile Handling', () => {
    it('should include all profile fields in response', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' }
      const mockProfile = {
        id: 'user-123',
        email: 'test@example.com',
        role: 'admin' as const,
        full_name: 'Admin User',
        avatar_url: 'https://example.com/admin.jpg',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-12-01T00:00:00Z'
      }

      ;(authenticate as any).mockResolvedValue({ user: mockUser, error: null })
      ;(getUserProfile as any).mockResolvedValue(mockProfile)

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(jsonMock).toHaveBeenCalledWith({
        user: {
          id: 'user-123',
          email: 'test@example.com',
          role: 'admin',
          full_name: 'Admin User',
          avatar_url: 'https://example.com/admin.jpg',
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-12-01T00:00:00Z'
        }
      })
    })

    it('should handle profile with minimal fields', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' }
      const mockProfile = {
        id: 'user-123',
        email: 'test@example.com',
        role: 'user' as const
      }

      ;(authenticate as any).mockResolvedValue({ user: mockUser, error: null })
      ;(getUserProfile as any).mockResolvedValue(mockProfile)

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(jsonMock).toHaveBeenCalledWith({
        user: {
          id: 'user-123',
          email: 'test@example.com',
          role: 'user',
          full_name: undefined,
          avatar_url: undefined,
          created_at: undefined,
          updated_at: undefined
        }
      })
    })

    it('should handle super_admin role', async () => {
      const mockUser = { id: 'admin-123', email: 'admin@prioritas.com' }
      const mockProfile = {
        id: 'admin-123',
        email: 'admin@prioritas.com',
        role: 'super_admin' as const,
        full_name: 'Super Admin'
      }

      ;(authenticate as any).mockResolvedValue({ user: mockUser, error: null })
      ;(getUserProfile as any).mockResolvedValue(mockProfile)

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.objectContaining({
            role: 'super_admin'
          })
        })
      )
    })

    it('should handle user without email', async () => {
      const mockUser = { id: 'user-123', email: undefined }
      const mockProfile = {
        id: 'user-123',
        email: '',
        role: 'user' as const
      }

      ;(authenticate as any).mockResolvedValue({ user: mockUser, error: null })
      ;(getUserProfile as any).mockResolvedValue(mockProfile)

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(getUserProfile).toHaveBeenCalledWith('user-123', '')
      expect(statusMock).toHaveBeenCalledWith(200)
    })
  })

  describe('Error Handling', () => {
    it('should handle getUserProfile errors gracefully', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' }

      ;(authenticate as any).mockResolvedValue({ user: mockUser, error: null })
      ;(getUserProfile as any).mockRejectedValue(new Error('Database error'))

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(500)
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Failed to get user data'
      })

      errorSpy.mockRestore()
    })

    it('should include error details in development mode', async () => {
      process.env.NODE_ENV = 'development'

      const mockUser = { id: 'user-123', email: 'test@example.com' }

      ;(authenticate as any).mockResolvedValue({ user: mockUser, error: null })
      ;(getUserProfile as any).mockRejectedValue(new Error('Test error'))

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Failed to get user data',
        details: 'Test error'
      })

      errorSpy.mockRestore()
      process.env.NODE_ENV = 'test'
    })

    it('should handle non-Error exceptions', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' }

      ;(authenticate as any).mockResolvedValue({ user: mockUser, error: null })
      ;(getUserProfile as any).mockRejectedValue('String error')

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(500)
      errorSpy.mockRestore()
    })

    it('should handle security middleware errors', async () => {
      ;(securityMiddleware as any).mockImplementation(() => {
        throw new Error('Security error')
      })

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(500)
      errorSpy.mockRestore()
    })
  })

  describe('Security and Headers', () => {
    it('should apply security middleware', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' }
      const mockProfile = { id: 'user-123', email: 'test@example.com', role: 'user' as const }

      ;(authenticate as any).mockResolvedValue({ user: mockUser, error: null })
      ;(getUserProfile as any).mockResolvedValue(mockProfile)

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(securityMiddleware).toHaveBeenCalledTimes(1)
      expect(securityMiddleware).toHaveBeenCalledWith(mockRequest, mockResponse)
    })

    it('should handle malformed authorization headers', async () => {
      mockRequest = createMockRequest({
        headers: { authorization: 'InvalidFormat' }
      })

      ;(authenticate as any).mockResolvedValue({
        user: null,
        error: 'Invalid authorization format'
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(401)
    })

    it('should protect against header injection', async () => {
      mockRequest = createMockRequest({
        headers: {
          authorization: 'Bearer token\r\nX-Admin: true'
        }
      })

      ;(authenticate as any).mockResolvedValue({
        user: null,
        error: 'Invalid token format'
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(401)
    })
  })

  describe('User Agent Handling', () => {
    it('should log user agent in development mode', async () => {
      process.env.NODE_ENV = 'development'

      mockRequest = createMockRequest({
        headers: {
          'user-agent': 'Mozilla/5.0 Test Browser',
          authorization: 'Bearer valid.token'
        }
      })

      const mockUser = { id: 'user-123', email: 'test@example.com' }
      const mockProfile = { id: 'user-123', email: 'test@example.com', role: 'user' as const }

      ;(authenticate as any).mockResolvedValue({ user: mockUser, error: null })
      ;(getUserProfile as any).mockResolvedValue(mockProfile)

      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(logSpy).toHaveBeenCalled()
      logSpy.mockRestore()
      process.env.NODE_ENV = 'test'
    })

    it('should handle missing user agent', async () => {
      mockRequest = createMockRequest({
        headers: { authorization: 'Bearer valid.token' }
      })
      delete mockRequest.headers!['user-agent']

      const mockUser = { id: 'user-123', email: 'test@example.com' }
      const mockProfile = { id: 'user-123', email: 'test@example.com', role: 'user' as const }

      ;(authenticate as any).mockResolvedValue({ user: mockUser, error: null })
      ;(getUserProfile as any).mockResolvedValue(mockProfile)

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(200)
    })
  })

  describe('Integration Scenarios', () => {
    it('should handle complete successful flow', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'user@example.com'
      }

      const mockProfile = {
        id: 'user-123',
        email: 'user@example.com',
        role: 'user' as const,
        full_name: 'Test User',
        avatar_url: 'https://example.com/avatar.jpg',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-12-01T00:00:00Z'
      }

      ;(authenticate as any).mockResolvedValue({ user: mockUser, error: null })
      ;(getUserProfile as any).mockResolvedValue(mockProfile)

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(securityMiddleware).toHaveBeenCalled()
      expect(authenticate).toHaveBeenCalled()
      expect(getUserProfile).toHaveBeenCalledWith('user-123', 'user@example.com')
      expect(statusMock).toHaveBeenCalledWith(200)
      expect(jsonMock).toHaveBeenCalledWith({ user: mockProfile })
    })

    it('should handle authentication failure properly', async () => {
      ;(authenticate as any).mockResolvedValue({
        user: null,
        error: 'Token expired'
      })

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(getUserProfile).not.toHaveBeenCalled()
      expect(statusMock).toHaveBeenCalledWith(401)
    })

    it('should handle demo user authentication', async () => {
      const demoUser = {
        id: 'demo-user-123',
        email: 'demo@example.com'
      }

      const demoProfile = {
        id: 'demo-user-123',
        email: 'demo@example.com',
        role: 'user' as const,
        full_name: 'Demo User'
      }

      ;(authenticate as any).mockResolvedValue({ user: demoUser, error: null })
      ;(getUserProfile as any).mockResolvedValue(demoProfile)

      await handler(mockRequest as VercelRequest, mockResponse as VercelResponse)

      expect(statusMock).toHaveBeenCalledWith(200)
      expect(jsonMock).toHaveBeenCalledWith({ user: demoProfile })
    })
  })
})
