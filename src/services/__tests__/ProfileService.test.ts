import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest'
import { ProfileService } from '../ProfileService'
import { User } from '../../types'
import { CACHE_DURATIONS } from '../../lib/config'

const originalFetch = global.fetch
let mockFetch: ReturnType<typeof vi.fn>

const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn()
      }))
    })),
    update: vi.fn(() => ({
      eq: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn()
        }))
      }))
    }))
  })),
  auth: {
    getSession: vi.fn(),
    refreshSession: vi.fn()
  }
}

const mockUser: User = {
  id: 'user-123',
  email: 'test@example.com',
  full_name: 'Test User',
  role: 'user',
  avatar_url: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z'
}

describe('ProfileService', () => {
  let service: ProfileService

  beforeAll(() => {
    mockFetch = vi.fn()
    global.fetch = mockFetch as any
  })

  afterAll(() => {
    global.fetch = originalFetch
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockClear()
    service = new ProfileService(mockSupabase as any)
  })

  afterEach(() => {
    service.destroy()
  })

  describe('getProfile', () => {
    it('should fetch profile from API with token', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { access_token: 'test-token' } }
      })

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ user: mockUser })
      })

      const result = await service.getProfile('user-123', 'test@example.com')

      expect(result).toEqual(mockUser)
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/auth?action=user',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
            'Content-Type': 'application/json'
          })
        })
      )
    })

    it('should return cached profile on subsequent calls', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { access_token: 'test-token' } }
      })

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ user: mockUser })
      })

      const result1 = await service.getProfile('user-123', 'test@example.com')
      const result2 = await service.getProfile('user-123', 'test@example.com')

      expect(result1).toEqual(mockUser)
      expect(result2).toEqual(mockUser)
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('should deduplicate concurrent requests', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { access_token: 'test-token' } }
      })

      mockFetch.mockImplementation(() =>
        new Promise(resolve =>
          setTimeout(() => resolve({
            ok: true,
            json: async () => ({ user: mockUser })
          }), 100)
        )
      )

      const [result1, result2, result3] = await Promise.all([
        service.getProfile('user-123', 'test@example.com'),
        service.getProfile('user-123', 'test@example.com'),
        service.getProfile('user-123', 'test@example.com')
      ])

      expect(result1).toEqual(mockUser)
      expect(result2).toEqual(mockUser)
      expect(result3).toEqual(mockUser)
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('should throw error when no auth token available', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null }
      })

      await expect(
        service.getProfile('user-123', 'test@example.com')
      ).rejects.toThrow('No auth token available')
    })

    it('should handle 401 error by refreshing token and retrying', async () => {
      mockSupabase.auth.getSession
        .mockResolvedValueOnce({
          data: { session: { access_token: 'expired-token' } }
        })
        .mockResolvedValueOnce({
          data: { session: { access_token: 'expired-token' } }
        })

      mockSupabase.auth.refreshSession.mockResolvedValue({
        data: { session: { access_token: 'fresh-token' } },
        error: null
      })

      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 401
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ user: mockUser })
        })

      const result = await service.getProfile('user-123', 'test@example.com')

      expect(result).toEqual(mockUser)
      expect(mockSupabase.auth.refreshSession).toHaveBeenCalled()
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('should handle 403 error by refreshing token and retrying', async () => {
      mockSupabase.auth.getSession
        .mockResolvedValueOnce({
          data: { session: { access_token: 'expired-token' } }
        })
        .mockResolvedValueOnce({
          data: { session: { access_token: 'expired-token' } }
        })

      mockSupabase.auth.refreshSession.mockResolvedValue({
        data: { session: { access_token: 'fresh-token' } },
        error: null
      })

      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 403
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ user: mockUser })
        })

      const result = await service.getProfile('user-123', 'test@example.com')

      expect(result).toEqual(mockUser)
      expect(mockSupabase.auth.refreshSession).toHaveBeenCalled()
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('should throw error when token refresh fails', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { access_token: 'expired-token' } }
      })

      mockSupabase.auth.refreshSession.mockResolvedValue({
        data: { session: null },
        error: { message: 'Refresh failed' }
      })

      mockFetch.mockResolvedValue({
        ok: false,
        status: 401
      })

      await expect(
        service.getProfile('user-123', 'test@example.com')
      ).rejects.toThrow('Authentication failed, please log in again')
    })

    it('should throw error when retry after refresh fails', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { access_token: 'expired-token' } }
      })

      mockSupabase.auth.refreshSession.mockResolvedValue({
        data: { session: { access_token: 'fresh-token' } },
        error: null
      })

      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 401
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500
        })

      await expect(
        service.getProfile('user-123', 'test@example.com')
      ).rejects.toThrow('Authentication failed, please log in again')
    })

    it('should throw error on non-401/403 API errors', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { access_token: 'test-token' } }
      })

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500
      })

      await expect(
        service.getProfile('user-123', 'test@example.com')
      ).rejects.toThrow('Profile fetch failed: 500')
    })

    it('should handle network errors', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { access_token: 'test-token' } }
      })

      mockFetch.mockRejectedValue(new Error('Network error'))

      await expect(
        service.getProfile('user-123', 'test@example.com')
      ).rejects.toThrow('Network error')
    })

    it('should use correct cache key format', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { access_token: 'test-token' } }
      })

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ user: mockUser })
      })

      await service.getProfile('user-123', 'test@example.com')
      const result = await service.getProfile('user-123', 'test@example.com')

      expect(result).toEqual(mockUser)
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('updateProfile', () => {
    it('should update profile and clear cache', async () => {
      const mockUpdated = { ...mockUser, full_name: 'Updated User' }

      const selectMock = vi.fn(() => ({
        single: vi.fn().mockResolvedValue({ data: mockUpdated, error: null })
      }))
      const eqMock = vi.fn(() => ({ select: selectMock }))
      const updateMock = vi.fn(() => ({ eq: eqMock }))

      mockSupabase.from.mockReturnValue({
        update: updateMock
      })

      const result = await service.updateProfile('user-123', { full_name: 'Updated User' })

      expect(result).toEqual(mockUpdated)
      expect(mockSupabase.from).toHaveBeenCalledWith('user_profiles')
      expect(updateMock).toHaveBeenCalledWith({ full_name: 'Updated User' })
      expect(eqMock).toHaveBeenCalledWith('id', 'user-123')
    })

    it('should throw error on database update failure', async () => {
      const selectMock = vi.fn(() => ({
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' }
        })
      }))
      const eqMock = vi.fn(() => ({ select: selectMock }))
      const updateMock = vi.fn(() => ({ eq: eqMock }))

      mockSupabase.from.mockReturnValue({
        update: updateMock
      })

      await expect(
        service.updateProfile('user-123', { full_name: 'Updated User' })
      ).rejects.toThrow('Error updating user profile')
    })
  })

  describe('clearCache', () => {
    it('should clear all profile caches', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { access_token: 'test-token' } }
      })

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ user: mockUser })
      })

      await service.getProfile('user-123', 'test@example.com')
      service.clearCache()

      mockFetch.mockClear()
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ user: mockUser })
      })

      await service.getProfile('user-123', 'test@example.com')

      expect(mockFetch).toHaveBeenCalled()
    })

    it('should clear pending requests', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { access_token: 'test-token' } }
      })

      mockFetch.mockImplementation(() =>
        new Promise(resolve =>
          setTimeout(() => resolve({
            ok: true,
            json: async () => ({ user: mockUser })
          }), 100)
        )
      )

      const promise1 = service.getProfile('user-123', 'test@example.com')
      service.clearCache()

      await expect(promise1).rejects.toThrow()
    })
  })

  describe('cache expiration', () => {
    it('should fetch fresh data after cache expiration', async () => {
      const shortTtlService = new ProfileService(mockSupabase as any, 100)

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { access_token: 'test-token' } }
      })

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ user: mockUser })
      })

      await shortTtlService.getProfile('user-123', 'test@example.com')

      await new Promise(resolve => setTimeout(resolve, 150))

      mockFetch.mockClear()
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ user: { ...mockUser, full_name: 'New Name' } })
      })

      const result = await shortTtlService.getProfile('user-123', 'test@example.com')

      expect(mockFetch).toHaveBeenCalled()
      expect(result.full_name).toBe('New Name')

      shortTtlService.destroy()
    })
  })

  describe('destroy', () => {
    it('should cleanup resources', () => {
      const destroySpy = vi.spyOn(service as any, 'destroy')

      service.destroy()

      expect(destroySpy).toHaveBeenCalled()
    })
  })
})
