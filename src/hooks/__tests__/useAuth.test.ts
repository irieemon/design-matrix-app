import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useAuth } from '../useAuth'
import { mockUser, mockAdminUser, mockProject } from '../../test/utils/test-utils'
import mockSupabaseClient from '../../test/mocks/supabase'

// Mock the supabase client
vi.mock('../../lib/supabase', () => ({
  supabase: mockSupabaseClient
}))

// Mock the database service
vi.mock('../../lib/database', () => ({
  DatabaseService: {
    getUserOwnedProjects: vi.fn(() => Promise.resolve([mockProject])),
    cleanupStaleLocks: vi.fn()
  }
}))

// Mock logger
vi.mock('../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
}))

describe('useAuth', () => {
  const mockSetCurrentProject = vi.fn()
  const mockSetIdeas = vi.fn()
  const mockSetCurrentPage = vi.fn()

  const defaultOptions = {
    setCurrentProject: mockSetCurrentProject,
    setIdeas: mockSetIdeas,
    setCurrentPage: mockSetCurrentPage
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()

    // Reset localStorage
    localStorage.clear()

    // Mock successful session by default
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null
    })

    // Mock auth state change subscription
    mockSupabaseClient.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } }
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe('initialization', () => {
    it('should start in loading state', () => {
      const { result } = renderHook(() => useAuth(defaultOptions))

      expect(result.current.isLoading).toBe(true)
      expect(result.current.currentUser).toBeNull()
      expect(result.current.authUser).toBeNull()
    })

    it('should initialize with existing session', async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: { user: mockUser, access_token: 'test-token' } },
        error: null
      })

      const { result } = renderHook(() => useAuth(defaultOptions))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.currentUser).toEqual(
        expect.objectContaining({
          id: mockUser.id,
          email: mockUser.email
        })
      )
    })

    it('should handle session initialization errors gracefully', async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: { message: 'Session error' }
      })

      const { result } = renderHook(() => useAuth(defaultOptions))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.currentUser).toBeNull()
    })

    it('should handle legacy localStorage user', async () => {
      localStorage.setItem('prioritasUser', 'legacy@example.com')

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null
      })

      const { result } = renderHook(() => useAuth(defaultOptions))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.currentUser).toEqual(
        expect.objectContaining({
          email: 'legacy@example.com',
          id: 'legacy-user'
        })
      )
    })

    it('should recognize admin users correctly', async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: { user: mockAdminUser, access_token: 'test-token' } },
        error: null
      })

      const { result } = renderHook(() => useAuth(defaultOptions))

      await waitFor(() => {
        expect(result.current.currentUser?.role).toBe('super_admin')
      })
    })
  })

  describe('authentication flow', () => {
    it('should handle successful authentication', async () => {
      const { result } = renderHook(() => useAuth(defaultOptions))

      await act(async () => {
        await result.current.handleAuthSuccess(mockUser)
      })

      await waitFor(() => {
        expect(result.current.currentUser).toEqual(
          expect.objectContaining({
            id: mockUser.id,
            email: mockUser.email
          })
        )
        expect(result.current.isLoading).toBe(false)
      })
    })

    it('should handle demo user authentication', async () => {
      const demoUser = {
        ...mockUser,
        id: '00000000-0000-0000-0000-000000000001',
        isDemoUser: true
      }

      const { result } = renderHook(() => useAuth(defaultOptions))

      await act(async () => {
        await result.current.handleAuthSuccess(demoUser)
      })

      await waitFor(() => {
        expect(result.current.currentUser).toEqual(
          expect.objectContaining({
            id: demoUser.id,
            email: demoUser.email
          })
        )
      })
    })

    it('should handle authentication errors gracefully', async () => {
      const invalidUser = { ...mockUser, id: null }

      const { result } = renderHook(() => useAuth(defaultOptions))

      await act(async () => {
        await result.current.handleAuthSuccess(invalidUser)
      })

      await waitFor(() => {
        // Should still create a fallback user even with errors
        expect(result.current.currentUser).toEqual(
          expect.objectContaining({
            email: mockUser.email
          })
        )
        expect(result.current.isLoading).toBe(false)
      })
    })
  })

  describe('logout', () => {
    it('should handle logout successfully', async () => {
      // First set up an authenticated state
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: { user: mockUser, access_token: 'test-token' } },
        error: null
      })

      const { result } = renderHook(() => useAuth(defaultOptions))

      await waitFor(() => {
        expect(result.current.currentUser).toBeTruthy()
      })

      // Mock successful sign out
      mockSupabaseClient.auth.signOut.mockResolvedValue({ error: null })

      await act(async () => {
        await result.current.handleLogout()
      })

      expect(mockSupabaseClient.auth.signOut).toHaveBeenCalled()
    })

    it('should handle logout errors gracefully', async () => {
      const { result } = renderHook(() => useAuth(defaultOptions))

      // Mock failed sign out
      mockSupabaseClient.auth.signOut.mockRejectedValue(new Error('Logout failed'))

      await act(async () => {
        await result.current.handleLogout()
      })

      // Should clear state manually on error
      await waitFor(() => {
        expect(result.current.currentUser).toBeNull()
        expect(result.current.authUser).toBeNull()
      })

      expect(mockSetCurrentProject).toHaveBeenCalledWith(null)
      expect(mockSetIdeas).toHaveBeenCalledWith([])
    })
  })

  describe('auth state changes', () => {
    it('should handle SIGNED_IN event', async () => {
      let authStateHandler: Function

      mockSupabaseClient.auth.onAuthStateChange.mockImplementation((callback) => {
        authStateHandler = callback
        return { data: { subscription: { unsubscribe: vi.fn() } } }
      })

      const { result } = renderHook(() => useAuth(defaultOptions))

      // Simulate SIGNED_IN event
      await act(async () => {
        authStateHandler('SIGNED_IN', { user: mockUser, access_token: 'test-token' })
      })

      await waitFor(() => {
        expect(result.current.currentUser).toEqual(
          expect.objectContaining({
            id: mockUser.id,
            email: mockUser.email
          })
        )
      })
    })

    it('should handle SIGNED_OUT event', async () => {
      let authStateHandler: Function

      mockSupabaseClient.auth.onAuthStateChange.mockImplementation((callback) => {
        authStateHandler = callback
        return { data: { subscription: { unsubscribe: vi.fn() } } }
      })

      const { result } = renderHook(() => useAuth(defaultOptions))

      // First sign in
      await act(async () => {
        authStateHandler('SIGNED_IN', { user: mockUser, access_token: 'test-token' })
      })

      // Then sign out
      await act(async () => {
        authStateHandler('SIGNED_OUT', null)
      })

      await waitFor(() => {
        expect(result.current.currentUser).toBeNull()
        expect(result.current.authUser).toBeNull()
        expect(result.current.isLoading).toBe(false)
      })

      expect(mockSetCurrentProject).toHaveBeenCalledWith(null)
      expect(mockSetIdeas).toHaveBeenCalledWith([])
    })

    it('should handle INITIAL_SESSION with no session', async () => {
      let authStateHandler: Function

      mockSupabaseClient.auth.onAuthStateChange.mockImplementation((callback) => {
        authStateHandler = callback
        return { data: { subscription: { unsubscribe: vi.fn() } } }
      })

      const { result } = renderHook(() => useAuth(defaultOptions))

      await act(async () => {
        authStateHandler('INITIAL_SESSION', null)
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.currentUser).toBeNull()
    })
  })

  describe('project checks and redirects', () => {
    it('should skip project checks for demo users', async () => {
      const { DatabaseService } = await import('../../lib/database')

      const demoUser = {
        ...mockUser,
        id: '00000000-0000-0000-0000-000000000001'
      }

      const { result } = renderHook(() => useAuth(defaultOptions))

      await act(async () => {
        await result.current.handleAuthSuccess(demoUser)
      })

      await waitFor(() => {
        expect(result.current.currentUser).toBeTruthy()
      })

      // Should not call getUserOwnedProjects for demo users
      expect(DatabaseService.getUserOwnedProjects).not.toHaveBeenCalled()
    })

    it('should check projects for real users', async () => {
      const { DatabaseService } = await import('../../lib/database')

      const { result } = renderHook(() => useAuth(defaultOptions))

      await act(async () => {
        await result.current.handleAuthSuccess(mockUser)
      })

      await waitFor(() => {
        expect(DatabaseService.getUserOwnedProjects).toHaveBeenCalledWith(mockUser.id)
      })
    })

    it('should handle project check timeouts gracefully', async () => {
      const { DatabaseService } = await import('../../lib/database')

      // Mock a hanging promise
      DatabaseService.getUserOwnedProjects.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      )

      const { result } = renderHook(() => useAuth(defaultOptions))

      await act(async () => {
        await result.current.handleAuthSuccess(mockUser)
      })

      // Fast-forward 3 seconds (timeout duration)
      act(() => {
        vi.advanceTimersByTime(3000)
      })

      await waitFor(() => {
        expect(result.current.currentUser).toBeTruthy()
      })
    })
  })

  describe('cleanup', () => {
    it('should clean up subscriptions on unmount', () => {
      const mockUnsubscribe = vi.fn()

      mockSupabaseClient.auth.onAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe: mockUnsubscribe } }
      })

      const { unmount } = renderHook(() => useAuth(defaultOptions))

      unmount()

      expect(mockUnsubscribe).toHaveBeenCalled()
    })

    it('should clean up timers on unmount', () => {
      const { DatabaseService } = require('../../lib/database')

      const { unmount } = renderHook(() => useAuth(defaultOptions))

      // Fast-forward to trigger the cleanup interval
      act(() => {
        vi.advanceTimersByTime(30000)
      })

      expect(DatabaseService.cleanupStaleLocks).toHaveBeenCalled()

      unmount()

      // Should not call cleanup after unmount
      DatabaseService.cleanupStaleLocks.mockClear()

      act(() => {
        vi.advanceTimersByTime(30000)
      })

      expect(DatabaseService.cleanupStaleLocks).not.toHaveBeenCalled()
    })
  })

  describe('user updates', () => {
    it('should allow setting current user', async () => {
      const { result } = renderHook(() => useAuth(defaultOptions))

      act(() => {
        result.current.setCurrentUser(mockUser)
      })

      expect(result.current.currentUser).toEqual(mockUser)
    })

    it('should allow setting loading state', async () => {
      const { result } = renderHook(() => useAuth(defaultOptions))

      act(() => {
        result.current.setIsLoading(false)
      })

      expect(result.current.isLoading).toBe(false)
    })
  })
})