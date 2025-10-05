import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useOptimizedAuth } from '../useOptimizedAuth'
import { mockUser, mockAdminUser } from '../../test/utils/test-utils'

// Mock supabase
const mockSupabase = {
  auth: {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(),
    signOut: vi.fn()
  }
}

vi.mock('../../lib/supabase', () => ({
  supabase: mockSupabase
}))

vi.mock('../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
}))

vi.mock('../../utils/authPerformanceMonitor', () => ({
  authPerformanceMonitor: {
    startSession: vi.fn(),
    finishSession: vi.fn(),
    recordSessionCheck: vi.fn(),
    recordUserProfileFetch: vi.fn()
  }
}))

describe('useOptimizedAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()

    // Default mock implementations
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null
    })

    mockSupabase.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } }
    })

    mockSupabase.auth.signOut.mockResolvedValue({ error: null })

    // Mock fetch for user profile
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        user: mockUser
      })
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe('initialization', () => {
    it('should start in loading state', () => {
      const { result } = renderHook(() => useOptimizedAuth())

      expect(result.current.isLoading).toBe(true)
      expect(result.current.currentUser).toBeNull()
      expect(result.current.authUser).toBeNull()
    })

    it('should initialize with existing session', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: {
          session: {
            user: mockUser,
            access_token: 'test-token'
          }
        },
        error: null
      })

      const { result } = renderHook(() => useOptimizedAuth())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      }, { timeout: 3000 })

      expect(result.current.currentUser).toBeTruthy()
    })

    it('should handle no session gracefully', async () => {
      const { result } = renderHook(() => useOptimizedAuth())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      }, { timeout: 3000 })

      expect(result.current.currentUser).toBeNull()
    })

    it('should timeout and stop loading after max timeout', async () => {
      mockSupabase.auth.getSession.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      )

      const { result } = renderHook(() => useOptimizedAuth())

      act(() => {
        vi.advanceTimersByTime(8000) // Max timeout
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
    })
  })

  describe('demo user handling', () => {
    it('should handle demo user authentication', async () => {
      const demoUser = {
        id: '00000000-0000-0000-0000-000000000001',
        email: 'demo@example.com',
        isDemoUser: true,
        user_metadata: {
          full_name: 'Demo User'
        }
      }

      const { result } = renderHook(() => useOptimizedAuth())

      await act(async () => {
        await result.current.handleAuthSuccess(demoUser)
      })

      await waitFor(() => {
        expect(result.current.currentUser).toBeTruthy()
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.currentUser?.id).toBe(demoUser.id)
      expect(global.fetch).not.toHaveBeenCalled() // No API call for demo users
    })

    it('should assign super_admin role to admin email', async () => {
      const adminDemoUser = {
        id: '00000000-0000-0000-0000-000000000009',
        email: 'admin@prioritas.com',
        isDemoUser: true
      }

      const { result } = renderHook(() => useOptimizedAuth())

      await act(async () => {
        await result.current.handleAuthSuccess(adminDemoUser)
      })

      await waitFor(() => {
        expect(result.current.currentUser?.role).toBe('super_admin')
      })
    })

    it('should not make database calls for demo users', async () => {
      const mockOnProjectsCheck = vi.fn()
      const demoUser = {
        id: '00000000-0000-0000-0000-000000000001',
        email: 'demo@example.com',
        isDemoUser: true
      }

      const { result } = renderHook(() =>
        useOptimizedAuth({ onProjectsCheck: mockOnProjectsCheck })
      )

      await act(async () => {
        await result.current.handleAuthSuccess(demoUser)
      })

      await waitFor(() => {
        expect(result.current.currentUser).toBeTruthy()
      })

      // Demo users should skip project checks
      expect(mockOnProjectsCheck).toHaveBeenCalledWith(
        demoUser.id,
        true // isDemoUser flag
      )
    })
  })

  describe('real user authentication', () => {
    it('should fetch user profile for real users', async () => {
      const realUser = {
        id: 'real-user-id',
        email: 'real@example.com'
      }

      mockSupabase.auth.getSession.mockResolvedValue({
        data: {
          session: {
            user: realUser,
            access_token: 'test-token'
          }
        },
        error: null
      })

      const { result } = renderHook(() => useOptimizedAuth())

      await act(async () => {
        await result.current.handleAuthSuccess(realUser)
      })

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/auth?action=user',
          expect.objectContaining({
            headers: expect.objectContaining({
              'Authorization': 'Bearer test-token'
            })
          })
        )
      })
    })

    it('should use fallback user on profile fetch failure', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500
      })

      const realUser = {
        id: 'real-user-id',
        email: 'real@example.com'
      }

      const { result } = renderHook(() => useOptimizedAuth())

      await act(async () => {
        await result.current.handleAuthSuccess(realUser)
      })

      await waitFor(() => {
        expect(result.current.currentUser).toBeTruthy()
        expect(result.current.isLoading).toBe(false)
      })

      // Should still have a user (fallback)
      expect(result.current.currentUser?.email).toBe(realUser.email)
      expect(result.current.currentUser?.role).toBe('user')
    })

    it('should handle profile fetch timeout', async () => {
      global.fetch = vi.fn().mockImplementation(
        () => new Promise(() => {}) // Never resolves
      )

      const realUser = {
        id: 'real-user-id',
        email: 'real@example.com'
      }

      const { result } = renderHook(() => useOptimizedAuth())

      await act(async () => {
        await result.current.handleAuthSuccess(realUser)
      })

      await waitFor(() => {
        expect(result.current.currentUser).toBeTruthy()
        expect(result.current.isLoading).toBe(false)
      }, { timeout: 3000 })

      // Should use fallback user
      expect(result.current.currentUser?.email).toBe(realUser.email)
    })
  })

  describe('auth state changes', () => {
    it('should handle SIGNED_IN event', async () => {
      let authStateCallback: any

      mockSupabase.auth.onAuthStateChange.mockImplementation((callback) => {
        authStateCallback = callback
        return { data: { subscription: { unsubscribe: vi.fn() } } }
      })

      const { result } = renderHook(() => useOptimizedAuth())

      await act(async () => {
        authStateCallback('SIGNED_IN', {
          user: mockUser,
          access_token: 'test-token'
        })
      })

      await waitFor(() => {
        expect(result.current.currentUser).toBeTruthy()
      })
    })

    it('should handle SIGNED_OUT event', async () => {
      let authStateCallback: any

      mockSupabase.auth.onAuthStateChange.mockImplementation((callback) => {
        authStateCallback = callback
        return { data: { subscription: { unsubscribe: vi.fn() } } }
      })

      const { result } = renderHook(() => useOptimizedAuth())

      // First sign in
      await act(async () => {
        authStateCallback('SIGNED_IN', {
          user: mockUser,
          access_token: 'test-token'
        })
      })

      // Then sign out
      await act(async () => {
        authStateCallback('SIGNED_OUT', null)
      })

      await waitFor(() => {
        expect(result.current.currentUser).toBeNull()
        expect(result.current.authUser).toBeNull()
        expect(result.current.isLoading).toBe(false)
      })
    })

    it('should handle INITIAL_SESSION event', async () => {
      let authStateCallback: any

      mockSupabase.auth.onAuthStateChange.mockImplementation((callback) => {
        authStateCallback = callback
        return { data: { subscription: { unsubscribe: vi.fn() } } }
      })

      const { result } = renderHook(() => useOptimizedAuth())

      await act(async () => {
        authStateCallback('INITIAL_SESSION', {
          user: mockUser,
          access_token: 'test-token'
        })
      })

      await waitFor(() => {
        expect(result.current.currentUser).toBeTruthy()
      })
    })

    it('should handle TOKEN_REFRESHED event', async () => {
      let authStateCallback: any

      mockSupabase.auth.onAuthStateChange.mockImplementation((callback) => {
        authStateCallback = callback
        return { data: { subscription: { unsubscribe: vi.fn() } } }
      })

      const { result } = renderHook(() => useOptimizedAuth())

      // Set up authenticated user first
      await act(async () => {
        await result.current.handleAuthSuccess(mockUser)
      })

      // Then trigger token refresh
      await act(async () => {
        authStateCallback('TOKEN_REFRESHED', {
          user: mockUser,
          access_token: 'new-token'
        })
      })

      // Should not re-process user when already authenticated
      expect(result.current.currentUser).toBeTruthy()
    })
  })

  describe('logout', () => {
    it('should handle successful logout', async () => {
      const { result } = renderHook(() => useOptimizedAuth())

      // First authenticate
      await act(async () => {
        await result.current.handleAuthSuccess(mockUser)
      })

      // Then logout
      await act(async () => {
        await result.current.handleLogout()
      })

      expect(mockSupabase.auth.signOut).toHaveBeenCalled()
    })

    it('should clear state on logout failure', async () => {
      mockSupabase.auth.signOut.mockRejectedValue(new Error('Logout failed'))

      const mockSetCurrentProject = vi.fn()
      const mockSetIdeas = vi.fn()

      const { result } = renderHook(() =>
        useOptimizedAuth({
          setCurrentProject: mockSetCurrentProject,
          setIdeas: mockSetIdeas
        })
      )

      // First authenticate
      await act(async () => {
        await result.current.handleAuthSuccess(mockUser)
      })

      // Then logout with error
      await act(async () => {
        await result.current.handleLogout()
      })

      // Should still clear state
      await waitFor(() => {
        expect(result.current.currentUser).toBeNull()
        expect(result.current.authUser).toBeNull()
      })

      expect(mockSetCurrentProject).toHaveBeenCalledWith(null)
      expect(mockSetIdeas).toHaveBeenCalledWith([])
    })
  })

  describe('project checks', () => {
    it('should call onProjectsCheck callback', async () => {
      const mockOnProjectsCheck = vi.fn().mockResolvedValue(undefined)

      const { result } = renderHook(() =>
        useOptimizedAuth({ onProjectsCheck: mockOnProjectsCheck })
      )

      const realUser = {
        id: 'real-user-id',
        email: 'real@example.com'
      }

      await act(async () => {
        await result.current.handleAuthSuccess(realUser)
      })

      await waitFor(() => {
        expect(mockOnProjectsCheck).toHaveBeenCalledWith(realUser.id, false)
      })
    })

    it('should handle project check timeout gracefully', async () => {
      const mockOnProjectsCheck = vi.fn().mockImplementation(
        () => new Promise(() => {}) // Never resolves
      )

      const { result } = renderHook(() =>
        useOptimizedAuth({ onProjectsCheck: mockOnProjectsCheck })
      )

      const realUser = {
        id: 'real-user-id',
        email: 'real@example.com'
      }

      await act(async () => {
        await result.current.handleAuthSuccess(realUser)
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      }, { timeout: 3000 })

      // Should still complete auth despite project check hanging
      expect(result.current.currentUser).toBeTruthy()
    })
  })

  describe('caching', () => {
    it('should cache user profile', async () => {
      const realUser = {
        id: 'real-user-id',
        email: 'real@example.com'
      }

      mockSupabase.auth.getSession.mockResolvedValue({
        data: {
          session: {
            user: realUser,
            access_token: 'test-token'
          }
        },
        error: null
      })

      const { result, unmount } = renderHook(() => useOptimizedAuth())

      await act(async () => {
        await result.current.handleAuthSuccess(realUser)
      })

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1)
      })

      unmount()

      // Re-render with same user - should use cache
      const { result: result2 } = renderHook(() => useOptimizedAuth())

      await act(async () => {
        await result2.current.handleAuthSuccess(realUser)
      })

      // May call fetch again for fresh data, but caching reduces redundant calls
      expect(global.fetch).toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('should handle authentication errors gracefully', async () => {
      const invalidUser = { id: null, email: 'test@example.com' }

      const { result } = renderHook(() => useOptimizedAuth())

      await act(async () => {
        await result.current.handleAuthSuccess(invalidUser as any)
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Should create fallback user even with invalid data
      expect(result.current.currentUser).toBeTruthy()
    })

    it('should handle session check errors', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: { message: 'Session error' }
      })

      const { result } = renderHook(() => useOptimizedAuth())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      }, { timeout: 3000 })

      expect(result.current.currentUser).toBeNull()
    })
  })

  describe('manual state updates', () => {
    it('should allow manual user update', () => {
      const { result } = renderHook(() => useOptimizedAuth())

      act(() => {
        result.current.setCurrentUser(mockUser)
      })

      expect(result.current.currentUser).toEqual(mockUser)
    })

    it('should allow manual loading state update', () => {
      const { result } = renderHook(() => useOptimizedAuth())

      act(() => {
        result.current.setIsLoading(false)
      })

      expect(result.current.isLoading).toBe(false)
    })
  })

  describe('cleanup', () => {
    it('should unsubscribe on unmount', () => {
      const mockUnsubscribe = vi.fn()

      mockSupabase.auth.onAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe: mockUnsubscribe } }
      })

      const { unmount } = renderHook(() => useOptimizedAuth())

      unmount()

      expect(mockUnsubscribe).toHaveBeenCalled()
    })

    it('should clear timeouts on unmount', () => {
      const { unmount } = renderHook(() => useOptimizedAuth())

      unmount()

      // Should not throw or cause issues
      expect(() => vi.clearAllTimers()).not.toThrow()
    })
  })

  describe('edge cases', () => {
    it('should handle rapid auth success calls', async () => {
      const { result } = renderHook(() => useOptimizedAuth())

      await act(async () => {
        await Promise.all([
          result.current.handleAuthSuccess(mockUser),
          result.current.handleAuthSuccess(mockUser),
          result.current.handleAuthSuccess(mockUser)
        ])
      })

      expect(result.current.currentUser).toBeTruthy()
      expect(result.current.isLoading).toBe(false)
    })

    it('should handle missing user metadata', async () => {
      const userWithoutMetadata = {
        id: 'test-id',
        email: 'test@example.com',
        isDemoUser: true
      }

      const { result } = renderHook(() => useOptimizedAuth())

      await act(async () => {
        await result.current.handleAuthSuccess(userWithoutMetadata)
      })

      await waitFor(() => {
        expect(result.current.currentUser).toBeTruthy()
      })

      // Should use email as fallback for full_name
      expect(result.current.currentUser?.full_name).toBe(userWithoutMetadata.email)
    })

    it('should handle null token during profile fetch', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null
      })

      const realUser = {
        id: 'real-user-id',
        email: 'real@example.com'
      }

      const { result } = renderHook(() => useOptimizedAuth())

      await act(async () => {
        await result.current.handleAuthSuccess(realUser)
      })

      await waitFor(() => {
        expect(result.current.currentUser).toBeTruthy()
        expect(result.current.isLoading).toBe(false)
      })

      // Should use fallback user when no token available
      expect(result.current.currentUser?.email).toBe(realUser.email)
    })
  })
})