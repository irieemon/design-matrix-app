import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useBrowserHistory } from '../useBrowserHistory'
import { BrowserRouter } from 'react-router-dom'
import React from 'react'

// Mock react-router-dom
const mockNavigate = vi.fn()
const mockLocation = {
  pathname: '/',
  search: '',
  hash: '',
  state: null,
  key: 'default'
}

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => mockLocation
  }
})

// Mock uuid utility
vi.mock('../../utils/uuid', () => ({
  sanitizeProjectId: vi.fn((id) => id)
}))

describe('useBrowserHistory', () => {
  let mockOnPageChange: ReturnType<typeof vi.fn>
  let mockOnProjectRestore: ReturnType<typeof vi.fn>

  const defaultProps = {
    currentPage: 'matrix',
    onPageChange: mockOnPageChange,
    currentProject: null,
    onProjectRestore: mockOnProjectRestore
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()

    mockOnPageChange = vi.fn()
    mockOnProjectRestore = vi.fn()

    // Reset location mock
    mockLocation.pathname = '/'
    mockLocation.search = ''

    // Clear document title
    document.title = ''
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(BrowserRouter, null, children)

  describe('initialization', () => {
    it('should initialize with correct state', () => {
      const { result } = renderHook(
        () => useBrowserHistory(defaultProps),
        { wrapper }
      )

      expect(result.current.isRestoringProject).toBe(false)
    })

    it('should not restore project if no project in URL', () => {
      const { result } = renderHook(
        () => useBrowserHistory({
          ...defaultProps,
          onProjectRestore: mockOnProjectRestore
        }),
        { wrapper }
      )

      expect(mockOnProjectRestore).not.toHaveBeenCalled()
      expect(result.current.isRestoringProject).toBe(false)
    })

    it('should restore project from URL on initial load', async () => {
      mockLocation.search = '?project=test-project-123'

      const { result } = renderHook(
        () => useBrowserHistory({
          ...defaultProps,
          onProjectRestore: mockOnProjectRestore
        }),
        { wrapper }
      )

      await waitFor(() => {
        expect(mockOnProjectRestore).toHaveBeenCalledWith('test-project-123')
      })

      expect(result.current.isRestoringProject).toBe(true)
    })
  })

  describe('project restoration', () => {
    it('should set isRestoringProject to true during restoration', async () => {
      mockLocation.search = '?project=test-project-123'

      const { result } = renderHook(
        () => useBrowserHistory({
          ...defaultProps,
          onProjectRestore: mockOnProjectRestore
        }),
        { wrapper }
      )

      expect(result.current.isRestoringProject).toBe(true)
    })

    it('should clear restoration state when project is loaded', async () => {
      mockLocation.search = '?project=test-project-123'

      const { result, rerender } = renderHook(
        (props) => useBrowserHistory(props),
        {
          wrapper,
          initialProps: {
            ...defaultProps,
            onProjectRestore: mockOnProjectRestore
          }
        }
      )

      expect(result.current.isRestoringProject).toBe(true)

      // Simulate project loaded
      rerender({
        ...defaultProps,
        currentProject: { id: 'test-project-123', name: 'Test Project' },
        onProjectRestore: mockOnProjectRestore
      })

      await waitFor(() => {
        expect(result.current.isRestoringProject).toBe(false)
      })
    })

    it('should timeout restoration after 2 seconds', async () => {
      mockLocation.search = '?project=test-project-123'

      const { result } = renderHook(
        () => useBrowserHistory({
          ...defaultProps,
          onProjectRestore: mockOnProjectRestore
        }),
        { wrapper }
      )

      expect(result.current.isRestoringProject).toBe(true)

      await act(async () => {
        vi.advanceTimersByTime(2000)
      })

      await waitFor(() => {
        expect(result.current.isRestoringProject).toBe(false)
      })
    })

    it('should not retry restoration for failed project', async () => {
      mockLocation.search = '?project=failed-project'

      const { result, rerender } = renderHook(
        (props) => useBrowserHistory(props),
        {
          wrapper,
          initialProps: {
            ...defaultProps,
            onProjectRestore: mockOnProjectRestore
          }
        }
      )

      // Let restoration timeout
      await act(async () => {
        vi.advanceTimersByTime(2000)
      })

      await waitFor(() => {
        expect(result.current.isRestoringProject).toBe(false)
      })

      const callCount = mockOnProjectRestore.mock.calls.length

      // Try to trigger restoration again
      rerender({
        ...defaultProps,
        currentProject: null,
        onProjectRestore: mockOnProjectRestore
      })

      // Should not call restore again for the same failed project
      expect(mockOnProjectRestore).toHaveBeenCalledTimes(callCount)
    })

    it('should handle fresh parameter to skip restoration', () => {
      mockLocation.search = '?project=test-project-123&fresh=true'

      const { result } = renderHook(
        () => useBrowserHistory({
          ...defaultProps,
          onProjectRestore: mockOnProjectRestore
        }),
        { wrapper }
      )

      // Should not restore with fresh=true
      expect(mockOnProjectRestore).not.toHaveBeenCalled()
      expect(result.current.isRestoringProject).toBe(false)
    })

    it('should cleanup timeout on unmount', async () => {
      mockLocation.search = '?project=test-project-123'

      const { unmount } = renderHook(
        () => useBrowserHistory({
          ...defaultProps,
          onProjectRestore: mockOnProjectRestore
        }),
        { wrapper }
      )

      unmount()

      // Advance timers after unmount
      await act(async () => {
        vi.advanceTimersByTime(2000)
      })

      // No errors should occur
    })
  })

  describe('document title updates', () => {
    it('should set document title for matrix page', () => {
      renderHook(
        () => useBrowserHistory({
          ...defaultProps,
          currentPage: 'matrix'
        }),
        { wrapper }
      )

      expect(document.title).toBe('Design Matrix | Prioritas')
    })

    it('should include project name in title', () => {
      renderHook(
        () => useBrowserHistory({
          ...defaultProps,
          currentPage: 'matrix',
          currentProject: { id: 'test-123', name: 'My Project' }
        }),
        { wrapper }
      )

      expect(document.title).toBe('Design Matrix - My Project | Prioritas')
    })

    it('should update title when page changes', () => {
      const { rerender } = renderHook(
        (props) => useBrowserHistory(props),
        {
          wrapper,
          initialProps: {
            ...defaultProps,
            currentPage: 'matrix'
          }
        }
      )

      expect(document.title).toContain('Design Matrix')

      rerender({
        ...defaultProps,
        currentPage: 'projects'
      })

      expect(document.title).toContain('Projects')
    })

    it('should update title when project changes', () => {
      const { rerender } = renderHook(
        (props) => useBrowserHistory(props),
        {
          wrapper,
          initialProps: {
            ...defaultProps,
            currentPage: 'matrix',
            currentProject: { id: 'test-1', name: 'Project 1' }
          }
        }
      )

      expect(document.title).toContain('Project 1')

      rerender({
        ...defaultProps,
        currentPage: 'matrix',
        currentProject: { id: 'test-2', name: 'Project 2' }
      })

      expect(document.title).toContain('Project 2')
    })

    it('should handle all page types correctly', () => {
      const pages = [
        { page: 'matrix', title: 'Design Matrix' },
        { page: 'projects', title: 'Projects' },
        { page: 'roadmap', title: 'Project Roadmap' },
        { page: 'management', title: 'Project Management' },
        { page: 'files', title: 'Project Files' },
        { page: 'data', title: 'Data Management' },
        { page: 'reports', title: 'Reports & Analytics' },
        { page: 'settings', title: 'User Settings' },
        { page: 'collaboration', title: 'Project Collaboration' }
      ]

      pages.forEach(({ page, title }) => {
        const { unmount } = renderHook(
          () => useBrowserHistory({
            ...defaultProps,
            currentPage: page
          }),
          { wrapper }
        )

        expect(document.title).toContain(title)
        unmount()
      })
    })
  })

  describe('URL synchronization', () => {
    it('should navigate when page changes programmatically', () => {
      const { rerender } = renderHook(
        (props) => useBrowserHistory(props),
        {
          wrapper,
          initialProps: {
            ...defaultProps,
            currentPage: 'matrix'
          }
        }
      )

      rerender({
        ...defaultProps,
        currentPage: 'projects'
      })

      expect(mockNavigate).toHaveBeenCalledWith('/projects', { replace: false })
    })

    it('should include project in URL when navigating', () => {
      const { rerender } = renderHook(
        (props) => useBrowserHistory(props),
        {
          wrapper,
          initialProps: {
            ...defaultProps,
            currentPage: 'matrix',
            currentProject: { id: 'test-123', name: 'Test Project' }
          }
        }
      )

      rerender({
        ...defaultProps,
        currentPage: 'roadmap',
        currentProject: { id: 'test-123', name: 'Test Project' }
      })

      expect(mockNavigate).toHaveBeenCalledWith(
        '/roadmap?project=test-123',
        { replace: false }
      )
    })

    it('should not navigate if page and URL match', () => {
      mockLocation.pathname = '/matrix'

      renderHook(
        () => useBrowserHistory({
          ...defaultProps,
          currentPage: 'matrix'
        }),
        { wrapper }
      )

      expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('should handle browser navigation (back/forward)', () => {
      mockLocation.pathname = '/projects'

      renderHook(
        () => useBrowserHistory({
          ...defaultProps,
          currentPage: 'matrix',
          onPageChange: mockOnPageChange
        }),
        { wrapper }
      )

      expect(mockOnPageChange).toHaveBeenCalledWith('projects')
    })

    it('should restore project from URL on browser navigation', () => {
      mockLocation.pathname = '/matrix'
      mockLocation.search = '?project=test-789'

      renderHook(
        () => useBrowserHistory({
          ...defaultProps,
          currentPage: 'matrix',
          onProjectRestore: mockOnProjectRestore
        }),
        { wrapper }
      )

      expect(mockOnProjectRestore).toHaveBeenCalledWith('test-789')
    })
  })

  describe('page routing', () => {
    it('should map matrix to root path', () => {
      const { rerender } = renderHook(
        (props) => useBrowserHistory(props),
        {
          wrapper,
          initialProps: {
            ...defaultProps,
            currentPage: 'projects'
          }
        }
      )

      rerender({
        ...defaultProps,
        currentPage: 'matrix'
      })

      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: false })
    })

    it('should handle unknown page types', () => {
      mockLocation.pathname = '/unknown-page'

      renderHook(
        () => useBrowserHistory({
          ...defaultProps,
          currentPage: 'unknown',
          onPageChange: mockOnPageChange
        }),
        { wrapper }
      )

      // Should default to matrix
      expect(mockOnPageChange).toHaveBeenCalledWith('matrix')
    })
  })

  describe('project context changes', () => {
    it('should update URL when project changes', () => {
      const { rerender } = renderHook(
        (props) => useBrowserHistory(props),
        {
          wrapper,
          initialProps: {
            ...defaultProps,
            currentPage: 'matrix',
            currentProject: null
          }
        }
      )

      rerender({
        ...defaultProps,
        currentPage: 'matrix',
        currentProject: { id: 'new-project', name: 'New Project' }
      })

      expect(mockNavigate).toHaveBeenCalledWith(
        '/?project=new-project',
        { replace: false }
      )
    })

    it('should remove project from URL when project is cleared', () => {
      const { rerender } = renderHook(
        (props) => useBrowserHistory(props),
        {
          wrapper,
          initialProps: {
            ...defaultProps,
            currentPage: 'matrix',
            currentProject: { id: 'test-123', name: 'Test' }
          }
        }
      )

      rerender({
        ...defaultProps,
        currentPage: 'matrix',
        currentProject: null
      })

      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: false })
    })
  })

  describe('edge cases', () => {
    it('should handle missing onProjectRestore callback', () => {
      mockLocation.search = '?project=test-123'

      const { result } = renderHook(
        () => useBrowserHistory({
          ...defaultProps,
          onProjectRestore: undefined
        }),
        { wrapper }
      )

      expect(result.current.isRestoringProject).toBe(false)
    })

    it('should handle empty project ID in URL', () => {
      mockLocation.search = '?project='

      const { result } = renderHook(
        () => useBrowserHistory({
          ...defaultProps,
          onProjectRestore: mockOnProjectRestore
        }),
        { wrapper }
      )

      expect(mockOnProjectRestore).not.toHaveBeenCalled()
      expect(result.current.isRestoringProject).toBe(false)
    })

    it('should handle malformed URL parameters', () => {
      mockLocation.search = '?project'

      const { result } = renderHook(
        () => useBrowserHistory({
          ...defaultProps,
          onProjectRestore: mockOnProjectRestore
        }),
        { wrapper }
      )

      expect(result.current.isRestoringProject).toBe(false)
    })

    it('should not navigate during restoration', () => {
      mockLocation.search = '?project=test-123'

      renderHook(
        () => useBrowserHistory({
          ...defaultProps,
          currentPage: 'matrix',
          onProjectRestore: mockOnProjectRestore
        }),
        { wrapper }
      )

      // Should not navigate while restoring
      expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('should handle rapid page changes', () => {
      const { rerender } = renderHook(
        (props) => useBrowserHistory(props),
        {
          wrapper,
          initialProps: {
            ...defaultProps,
            currentPage: 'matrix'
          }
        }
      )

      // Change page multiple times rapidly
      rerender({ ...defaultProps, currentPage: 'projects' })
      rerender({ ...defaultProps, currentPage: 'roadmap' })
      rerender({ ...defaultProps, currentPage: 'settings' })

      // Should have called navigate for each change
      expect(mockNavigate.mock.calls.length).toBeGreaterThan(0)
    })
  })

  describe('sanitization', () => {
    it('should sanitize legacy project IDs from URL', async () => {
      const { sanitizeProjectId } = await import('../../utils/uuid')

      mockLocation.search = '?project=legacy-id'

      renderHook(
        () => useBrowserHistory({
          ...defaultProps,
          onProjectRestore: mockOnProjectRestore
        }),
        { wrapper }
      )

      expect(sanitizeProjectId).toHaveBeenCalledWith('legacy-id')
    })

    it('should sanitize project IDs in URL parameters', async () => {
      const { sanitizeProjectId } = await import('../../utils/uuid')

      mockLocation.pathname = '/matrix'
      mockLocation.search = '?project=another-legacy-id'

      renderHook(
        () => useBrowserHistory({
          ...defaultProps,
          currentPage: 'matrix'
        }),
        { wrapper }
      )

      expect(sanitizeProjectId).toHaveBeenCalled()
    })
  })

  describe('performance', () => {
    it('should not cause infinite navigation loops', () => {
      mockLocation.pathname = '/matrix'
      mockLocation.search = '?project=test-123'

      const { rerender } = renderHook(
        (props) => useBrowserHistory(props),
        {
          wrapper,
          initialProps: {
            ...defaultProps,
            currentPage: 'matrix',
            currentProject: { id: 'test-123', name: 'Test' }
          }
        }
      )

      const initialCallCount = mockNavigate.mock.calls.length

      // Rerender with same props
      rerender({
        ...defaultProps,
        currentPage: 'matrix',
        currentProject: { id: 'test-123', name: 'Test' }
      })

      // Should not navigate again
      expect(mockNavigate).toHaveBeenCalledTimes(initialCallCount)
    })

    it('should handle multiple location changes efficiently', () => {
      const { rerender } = renderHook(
        (props) => useBrowserHistory(props),
        {
          wrapper,
          initialProps: {
            ...defaultProps,
            currentPage: 'matrix'
          }
        }
      )

      mockLocation.pathname = '/projects'
      rerender({ ...defaultProps, currentPage: 'matrix' })

      mockLocation.pathname = '/roadmap'
      rerender({ ...defaultProps, currentPage: 'matrix' })

      // Should handle location changes without errors
      expect(mockOnPageChange).toHaveBeenCalled()
    })
  })
})