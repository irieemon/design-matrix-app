import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useAuth } from '../useAuthTestBypass'
import type { Project } from '../../types'

// Mock logger
vi.mock('../../utils/logger', () => ({
  logger: {
    debug: vi.fn()
  }
}))

// Mock UUID utility
vi.mock('../../utils/uuid', () => ({
  ensureUUID: vi.fn((id) => id)
}))

describe('useAuthTestBypass', () => {
  let mockSetCurrentProject: ReturnType<typeof vi.fn>
  let mockSetIdeas: ReturnType<typeof vi.fn>
  let mockSetCurrentPage: ReturnType<typeof vi.fn>
  let mockOnProjectsCheck: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()

    // Clear localStorage and global state
    localStorage.clear()
    delete (window as any).__TEST_BYPASS_DATA__

    mockSetCurrentProject = vi.fn()
    mockSetIdeas = vi.fn()
    mockSetCurrentPage = vi.fn()
    mockOnProjectsCheck = vi.fn()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('initialization', () => {
    it('should start in loading state', () => {
      const { result } = renderHook(() => useAuth())

      expect(result.current.isLoading).toBe(true)
      expect(result.current.currentUser).toBeNull()
      expect(result.current.authUser).toBeNull()
    })

    it('should initialize test user after timeout', async () => {
      const { result } = renderHook(() => useAuth())

      expect(result.current.isLoading).toBe(true)

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.currentUser).toEqual(
        expect.objectContaining({
          email: 'test@matrix.bypass',
          full_name: 'Test Matrix User',
          role: 'user'
        })
      )
    })

    it('should create test auth user with correct properties', async () => {
      const { result } = renderHook(() => useAuth())

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      await waitFor(() => {
        expect(result.current.authUser).toBeTruthy()
      })

      expect(result.current.authUser).toEqual(
        expect.objectContaining({
          email: 'test@matrix.bypass',
          isDemoUser: true,
          user_metadata: {
            full_name: 'Test Matrix User'
          }
        })
      )
    })

    it('should create test project', async () => {
      const { result } = renderHook(() => useAuth())

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      await waitFor(() => {
        expect((window as any).__TEST_BYPASS_DATA__).toBeDefined()
      })

      const data = (window as any).__TEST_BYPASS_DATA__
      expect(data.project).toEqual(
        expect.objectContaining({
          id: 'demo-test-project-matrix',
          name: 'Test Matrix Project',
          description: 'Demo project for testing matrix functionality'
        })
      )
    })

    it('should create test ideas with different quadrants', async () => {
      const { result } = renderHook(() => useAuth())

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      await waitFor(() => {
        expect((window as any).__TEST_BYPASS_DATA__).toBeDefined()
      })

      const data = (window as any).__TEST_BYPASS_DATA__
      expect(data.ideas).toHaveLength(3)

      // Quick Win - high impact, low effort
      expect(data.ideas[0]).toEqual(
        expect.objectContaining({
          title: 'Quick Win',
          impact: 4,
          effort: 1
        })
      )

      // Major Project - high impact, high effort
      expect(data.ideas[1]).toEqual(
        expect.objectContaining({
          title: 'Major Project',
          impact: 4,
          effort: 4
        })
      )

      // Fill Task - low impact, low effort
      expect(data.ideas[2]).toEqual(
        expect.objectContaining({
          title: 'Fill Task',
          impact: 1,
          effort: 1
        })
      )
    })

    it('should store test data in global window object', async () => {
      const { result } = renderHook(() => useAuth())

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      await waitFor(() => {
        expect((window as any).__TEST_BYPASS_DATA__).toBeDefined()
      })

      const data = (window as any).__TEST_BYPASS_DATA__
      expect(data).toHaveProperty('project')
      expect(data).toHaveProperty('ideas')
      expect(data).toHaveProperty('user')
      expect(data).toHaveProperty('initialized')
      expect(typeof data.initialized).toBe('number')
    })

    it('should store test data in localStorage', async () => {
      const { result } = renderHook(() => useAuth())

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      await waitFor(() => {
        expect(localStorage.getItem('testBypassProject')).toBeTruthy()
      })

      const project = JSON.parse(localStorage.getItem('testBypassProject')!)
      expect(project.id).toBe('demo-test-project-matrix')

      const ideas = JSON.parse(localStorage.getItem('testBypassIdeas')!)
      expect(ideas).toHaveLength(3)

      const currentProjectId = localStorage.getItem('currentProjectId')
      expect(currentProjectId).toBe('demo-test-project-matrix')
    })
  })

  describe('callback integration', () => {
    it('should call setCurrentProject with test project', async () => {
      const { result } = renderHook(() => useAuth({
        setCurrentProject: mockSetCurrentProject
      }))

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      await waitFor(() => {
        expect(mockSetCurrentProject).toHaveBeenCalled()
      })

      expect(mockSetCurrentProject).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'demo-test-project-matrix',
          name: 'Test Matrix Project'
        })
      )
    })

    it('should call setIdeas with test ideas', async () => {
      const { result } = renderHook(() => useAuth({
        setIdeas: mockSetIdeas
      }))

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      await waitFor(() => {
        expect(mockSetIdeas).toHaveBeenCalled()
      })

      expect(mockSetIdeas).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ title: 'Quick Win' }),
          expect.objectContaining({ title: 'Major Project' }),
          expect.objectContaining({ title: 'Fill Task' })
        ])
      )
    })

    it('should handle missing setCurrentProject callback gracefully', async () => {
      const { result } = renderHook(() => useAuth({
        setIdeas: mockSetIdeas
      }))

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Should not throw, just skip the callback
      expect(mockSetIdeas).toHaveBeenCalled()
    })

    it('should handle missing setIdeas callback gracefully', async () => {
      const { result } = renderHook(() => useAuth({
        setCurrentProject: mockSetCurrentProject
      }))

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Should not throw, just skip the callback
      expect(mockSetCurrentProject).toHaveBeenCalled()
    })

    it('should not call onProjectsCheck callback', async () => {
      const { result } = renderHook(() => useAuth({
        onProjectsCheck: mockOnProjectsCheck
      }))

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Should not check projects in bypass mode
      expect(mockOnProjectsCheck).not.toHaveBeenCalled()
    })

    it('should not call setCurrentPage callback', async () => {
      const { result } = renderHook(() => useAuth({
        setCurrentPage: mockSetCurrentPage
      }))

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Should not change page in bypass mode
      expect(mockSetCurrentPage).not.toHaveBeenCalled()
    })
  })

  describe('handleAuthSuccess', () => {
    it('should be a no-op function', async () => {
      const { result } = renderHook(() => useAuth())

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      await waitFor(() => {
        expect(result.current.currentUser).toBeTruthy()
      })

      const userBefore = result.current.currentUser

      await act(async () => {
        await result.current.handleAuthSuccess({ id: 'new-user', email: 'new@test.com' })
      })

      // User should not change in bypass mode
      expect(result.current.currentUser).toEqual(userBefore)
    })

    it('should not throw when called', async () => {
      const { result } = renderHook(() => useAuth())

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      await expect(async () => {
        await result.current.handleAuthSuccess({})
      }).not.toThrow()
    })
  })

  describe('handleLogout', () => {
    it('should be a no-op function', async () => {
      const { result } = renderHook(() => useAuth())

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      await waitFor(() => {
        expect(result.current.currentUser).toBeTruthy()
      })

      const userBefore = result.current.currentUser

      await act(async () => {
        await result.current.handleLogout()
      })

      // User should not change in bypass mode
      expect(result.current.currentUser).toEqual(userBefore)
    })

    it('should not throw when called', async () => {
      const { result } = renderHook(() => useAuth())

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      await expect(async () => {
        await result.current.handleLogout()
      }).not.toThrow()
    })
  })

  describe('setCurrentUser', () => {
    it('should allow manual user updates', async () => {
      const { result } = renderHook(() => useAuth())

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      await waitFor(() => {
        expect(result.current.currentUser).toBeTruthy()
      })

      const newUser = {
        id: 'manual-user',
        email: 'manual@test.com',
        full_name: 'Manual User',
        role: 'user' as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      act(() => {
        result.current.setCurrentUser(newUser)
      })

      expect(result.current.currentUser).toEqual(newUser)
    })

    it('should allow clearing user', async () => {
      const { result } = renderHook(() => useAuth())

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      await waitFor(() => {
        expect(result.current.currentUser).toBeTruthy()
      })

      act(() => {
        result.current.setCurrentUser(null)
      })

      expect(result.current.currentUser).toBeNull()
    })
  })

  describe('setIsLoading', () => {
    it('should allow manual loading state updates', async () => {
      const { result } = renderHook(() => useAuth())

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      act(() => {
        result.current.setIsLoading(true)
      })

      expect(result.current.isLoading).toBe(true)

      act(() => {
        result.current.setIsLoading(false)
      })

      expect(result.current.isLoading).toBe(false)
    })
  })

  describe('cleanup', () => {
    it('should clear timeout on unmount', async () => {
      const { unmount } = renderHook(() => useAuth())

      // Unmount before timer fires
      unmount()

      // Advance time
      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      // Should not initialize after unmount
      expect((window as any).__TEST_BYPASS_DATA__).toBeUndefined()
    })

    it('should not leave hanging timers', async () => {
      const { unmount } = renderHook(() => useAuth())

      unmount()

      // Get count of pending timers
      const pendingTimers = vi.getTimerCount()
      expect(pendingTimers).toBe(0)
    })
  })

  describe('data consistency', () => {
    it('should have matching user IDs across all entities', async () => {
      const { result } = renderHook(() => useAuth())

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      await waitFor(() => {
        expect((window as any).__TEST_BYPASS_DATA__).toBeDefined()
      })

      const data = (window as any).__TEST_BYPASS_DATA__
      const userId = result.current.currentUser!.id

      expect(data.user.id).toBe(userId)
      expect(data.project.owner_id).toBe(userId)
      data.ideas.forEach((idea: any) => {
        expect(idea.owner_id).toBe(userId)
      })
    })

    it('should have matching project IDs across ideas', async () => {
      const { result } = renderHook(() => useAuth())

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      await waitFor(() => {
        expect((window as any).__TEST_BYPASS_DATA__).toBeDefined()
      })

      const data = (window as any).__TEST_BYPASS_DATA__
      const projectId = data.project.id

      data.ideas.forEach((idea: any) => {
        expect(idea.project_id).toBe(projectId)
      })
    })

    it('should have valid timestamps', async () => {
      const { result } = renderHook(() => useAuth())

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      await waitFor(() => {
        expect(result.current.currentUser).toBeTruthy()
      })

      const user = result.current.currentUser!
      expect(new Date(user.created_at).getTime()).toBeLessThanOrEqual(Date.now())
      expect(new Date(user.updated_at).getTime()).toBeLessThanOrEqual(Date.now())
    })
  })

  describe('multiple instances', () => {
    it('should share global state between instances', async () => {
      const { result: result1 } = renderHook(() => useAuth())
      const { result: result2 } = renderHook(() => useAuth())

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      await waitFor(() => {
        expect(result1.current.currentUser).toBeTruthy()
        expect(result2.current.currentUser).toBeTruthy()
      })

      // Both should see the same global data
      expect((window as any).__TEST_BYPASS_DATA__).toBeDefined()
      expect(result1.current.currentUser!.id).toBe(result2.current.currentUser!.id)
    })

    it('should not initialize multiple times', async () => {
      const { result: result1 } = renderHook(() => useAuth())
      const { result: result2 } = renderHook(() => useAuth())

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      await waitFor(() => {
        expect(result1.current.currentUser).toBeTruthy()
        expect(result2.current.currentUser).toBeTruthy()
      })

      const data = (window as any).__TEST_BYPASS_DATA__
      expect(data).toBeDefined()

      // Should have single initialization timestamp
      expect(typeof data.initialized).toBe('number')
    })
  })
})