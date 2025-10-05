import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useOptimizedMatrix } from '../useOptimizedMatrix'
import { mockUser, mockProject, mockIdea, mockIdeas, createMockDragEndEvent } from '../../test/utils/test-utils'
import { DatabaseService } from '../../lib/database'

// Mock dependencies
vi.mock('../../lib/database')
vi.mock('../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
}))

vi.mock('../../lib/matrix/performance', () => ({
  useBatchedUpdates: vi.fn(() => ({
    addUpdate: vi.fn(),
    flush: vi.fn()
  })),
  performanceMonitor: {
    startMeasurement: vi.fn(() => vi.fn()),
    recordMeasurement: vi.fn()
  }
}))

describe('useOptimizedMatrix', () => {
  const setShowAddModal = vi.fn()
  const setShowAIModal = vi.fn()
  const setEditingIdea = vi.fn()

  const defaultOptions = {
    currentUser: mockUser,
    currentProject: mockProject,
    setShowAddModal,
    setShowAIModal,
    setEditingIdea
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()

    // Mock DatabaseService methods
    vi.mocked(DatabaseService.getProjectIdeas).mockResolvedValue(mockIdeas)
    vi.mocked(DatabaseService.createIdea).mockResolvedValue({
      success: true,
      data: { ...mockIdea, id: 'new-id' }
    })
    vi.mocked(DatabaseService.updateIdea).mockResolvedValue({ ...mockIdea })
    vi.mocked(DatabaseService.deleteIdea).mockResolvedValue(true)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('initialization', () => {
    it('should initialize with empty ideas and no loading state', () => {
      const { result } = renderHook(() => useOptimizedMatrix(defaultOptions))

      expect(result.current.ideas).toEqual([])
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('should provide all required functions', () => {
      const { result } = renderHook(() => useOptimizedMatrix(defaultOptions))

      expect(typeof result.current.loadIdeas).toBe('function')
      expect(typeof result.current.addIdea).toBe('function')
      expect(typeof result.current.updateIdea).toBe('function')
      expect(typeof result.current.deleteIdea).toBe('function')
      expect(typeof result.current.toggleCollapse).toBe('function')
      expect(typeof result.current.handleDragEnd).toBe('function')
      expect(typeof result.current.refreshIdeas).toBe('function')
      expect(typeof result.current.clearError).toBe('function')
    })
  })

  describe('loadIdeas', () => {
    it('should load ideas for a project', async () => {
      const { result } = renderHook(() => useOptimizedMatrix(defaultOptions))

      await act(async () => {
        await result.current.loadIdeas(mockProject.id)
      })

      expect(DatabaseService.getProjectIdeas).toHaveBeenCalledWith(mockProject.id)
      expect(result.current.ideas).toEqual(mockIdeas)
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('should clear ideas when no projectId is provided', async () => {
      const { result } = renderHook(() => useOptimizedMatrix(defaultOptions))

      // First load some ideas
      await act(async () => {
        await result.current.loadIdeas(mockProject.id)
      })

      expect(result.current.ideas).toEqual(mockIdeas)

      // Then clear by loading without projectId
      await act(async () => {
        await result.current.loadIdeas()
      })

      expect(result.current.ideas).toEqual([])
    })

    it('should handle demo data', async () => {
      const demoProjectId = 'demo-project-123'
      const demoIdeas = [{ ...mockIdea, project_id: demoProjectId }]
      ;(globalThis as any).demoIdeas = demoIdeas

      const { result } = renderHook(() => useOptimizedMatrix(defaultOptions))

      await act(async () => {
        await result.current.loadIdeas(demoProjectId)
      })

      expect(result.current.ideas).toEqual(demoIdeas)
      expect(DatabaseService.getProjectIdeas).not.toHaveBeenCalled()

      // Cleanup
      delete (globalThis as any).demoIdeas
    })

    it('should handle loading errors', async () => {
      vi.mocked(DatabaseService.getProjectIdeas).mockRejectedValue(new Error('Load failed'))

      const { result } = renderHook(() => useOptimizedMatrix(defaultOptions))

      await act(async () => {
        await result.current.loadIdeas(mockProject.id)
      })

      expect(result.current.error).toBe('Load failed')
      expect(result.current.ideas).toEqual([])
      expect(result.current.isLoading).toBe(false)
    })

    it('should set loading state during load', async () => {
      let resolveLoad: any
      vi.mocked(DatabaseService.getProjectIdeas).mockImplementation(
        () => new Promise(resolve => { resolveLoad = resolve })
      )

      const { result } = renderHook(() => useOptimizedMatrix(defaultOptions))

      act(() => {
        result.current.loadIdeas(mockProject.id)
      })

      expect(result.current.isLoading).toBe(true)

      await act(async () => {
        resolveLoad(mockIdeas)
      })

      expect(result.current.isLoading).toBe(false)
    })
  })

  describe('addIdea', () => {
    it('should add idea with optimistic update', async () => {
      const { result } = renderHook(() => useOptimizedMatrix(defaultOptions))

      const newIdea = {
        content: 'New Idea',
        details: 'New Details',
        x: 100,
        y: 200,
        priority: 'high' as const,
        project_id: mockProject.id
      }

      await act(async () => {
        await result.current.addIdea(newIdea)
      })

      expect(DatabaseService.createIdea).toHaveBeenCalledWith(
        expect.objectContaining({
          ...newIdea,
          created_by: mockUser.id,
          project_id: mockProject.id
        })
      )
    })

    it('should close modals after successful add', async () => {
      const { result } = renderHook(() => useOptimizedMatrix(defaultOptions))

      const newIdea = {
        content: 'New Idea',
        details: '',
        x: 0,
        y: 0,
        priority: 'high' as const,
        project_id: mockProject.id
      }

      await act(async () => {
        await result.current.addIdea(newIdea)
      })

      expect(setShowAddModal).toHaveBeenCalledWith(false)
      expect(setShowAIModal).toHaveBeenCalledWith(false)
    })

    it('should handle add errors', async () => {
      vi.mocked(DatabaseService.createIdea).mockResolvedValue({
        success: false,
        error: 'Create failed'
      })

      const { result } = renderHook(() => useOptimizedMatrix(defaultOptions))

      const newIdea = {
        content: 'New',
        details: '',
        x: 0,
        y: 0,
        priority: 'high' as const,
        project_id: mockProject.id
      }

      await act(async () => {
        await result.current.addIdea(newIdea)
      })

      expect(result.current.error).toBe('Create failed')
    })

    it('should show optimistic update then replace with server data', async () => {
      const serverIdea = { ...mockIdea, id: 'server-id', content: 'Server Content' }
      vi.mocked(DatabaseService.createIdea).mockResolvedValue({
        success: true,
        data: serverIdea
      })

      const { result } = renderHook(() => useOptimizedMatrix(defaultOptions))

      const newIdea = {
        content: 'New Idea',
        details: '',
        x: 0,
        y: 0,
        priority: 'high' as const,
        project_id: mockProject.id
      }

      await act(async () => {
        await result.current.addIdea(newIdea)
      })

      // Should have the server idea
      expect(result.current.ideas.some(idea => idea.id === 'server-id')).toBe(true)
    })
  })

  describe('updateIdea', () => {
    it('should update idea with optimistic update', async () => {
      const { result } = renderHook(() => useOptimizedMatrix(defaultOptions))

      // Load initial ideas
      await act(async () => {
        await result.current.loadIdeas(mockProject.id)
      })

      const updatedIdea = {
        ...mockIdeas[0],
        content: 'Updated Content'
      }

      await act(async () => {
        await result.current.updateIdea(updatedIdea)
      })

      expect(DatabaseService.updateIdea).toHaveBeenCalledWith(
        updatedIdea.id,
        expect.objectContaining({
          content: 'Updated Content'
        })
      )
    })

    it('should close editing modal after update', async () => {
      const { result } = renderHook(() => useOptimizedMatrix(defaultOptions))

      await act(async () => {
        await result.current.loadIdeas(mockProject.id)
      })

      await act(async () => {
        await result.current.updateIdea(mockIdeas[0])
      })

      expect(setEditingIdea).toHaveBeenCalledWith(null)
    })

    it('should handle update errors and revert', async () => {
      vi.mocked(DatabaseService.updateIdea).mockResolvedValue(null)

      const { result } = renderHook(() => useOptimizedMatrix(defaultOptions))

      await act(async () => {
        await result.current.loadIdeas(mockProject.id)
      })

      const originalContent = mockIdeas[0].content

      await act(async () => {
        await result.current.updateIdea({
          ...mockIdeas[0],
          content: 'Updated'
        })
      })

      expect(result.current.error).toBeTruthy()

      // Should trigger refresh to revert
      expect(DatabaseService.getProjectIdeas).toHaveBeenCalledTimes(2)
    })

    it('should update multiple fields', async () => {
      const { result } = renderHook(() => useOptimizedMatrix(defaultOptions))

      await act(async () => {
        await result.current.loadIdeas(mockProject.id)
      })

      const updatedIdea = {
        ...mockIdeas[0],
        content: 'New Content',
        details: 'New Details',
        priority: 'low' as const,
        x: 500,
        y: 600
      }

      await act(async () => {
        await result.current.updateIdea(updatedIdea)
      })

      expect(DatabaseService.updateIdea).toHaveBeenCalledWith(
        updatedIdea.id,
        expect.objectContaining({
          content: 'New Content',
          details: 'New Details',
          priority: 'low',
          x: 500,
          y: 600
        })
      )
    })
  })

  describe('deleteIdea', () => {
    it('should delete idea with optimistic update', async () => {
      const { result } = renderHook(() => useOptimizedMatrix(defaultOptions))

      await act(async () => {
        await result.current.loadIdeas(mockProject.id)
      })

      const ideaToDelete = mockIdeas[0].id

      await act(async () => {
        await result.current.deleteIdea(ideaToDelete)
      })

      expect(DatabaseService.deleteIdea).toHaveBeenCalledWith(ideaToDelete)
    })

    it('should close editing modal after delete', async () => {
      const { result } = renderHook(() => useOptimizedMatrix(defaultOptions))

      await act(async () => {
        await result.current.loadIdeas(mockProject.id)
      })

      await act(async () => {
        await result.current.deleteIdea(mockIdeas[0].id)
      })

      expect(setEditingIdea).toHaveBeenCalledWith(null)
    })

    it('should handle delete errors and rollback', async () => {
      vi.mocked(DatabaseService.deleteIdea).mockResolvedValue(false)

      const { result } = renderHook(() => useOptimizedMatrix(defaultOptions))

      await act(async () => {
        await result.current.loadIdeas(mockProject.id)
      })

      const initialCount = result.current.ideas.length

      await act(async () => {
        await result.current.deleteIdea(mockIdeas[0].id)
      })

      expect(result.current.error).toBeTruthy()

      // Should rollback the deletion
      await waitFor(() => {
        expect(result.current.ideas.length).toBe(initialCount)
      })
    })
  })

  describe('toggleCollapse', () => {
    it('should toggle collapse state', async () => {
      const { result } = renderHook(() => useOptimizedMatrix(defaultOptions))

      await act(async () => {
        await result.current.loadIdeas(mockProject.id)
      })

      const ideaId = mockIdeas[0].id

      await act(async () => {
        await result.current.toggleCollapse(ideaId)
      })

      expect(DatabaseService.updateIdea).toHaveBeenCalledWith(
        ideaId,
        expect.objectContaining({
          is_collapsed: expect.any(Boolean)
        })
      )
    })

    it('should set specific collapse state', async () => {
      const { result } = renderHook(() => useOptimizedMatrix(defaultOptions))

      await act(async () => {
        await result.current.loadIdeas(mockProject.id)
      })

      await act(async () => {
        await result.current.toggleCollapse(mockIdeas[0].id, true)
      })

      expect(DatabaseService.updateIdea).toHaveBeenCalledWith(
        mockIdeas[0].id,
        { is_collapsed: true }
      )
    })

    it('should handle non-existent idea gracefully', async () => {
      const { result } = renderHook(() => useOptimizedMatrix(defaultOptions))

      await act(async () => {
        await result.current.loadIdeas(mockProject.id)
      })

      await act(async () => {
        await result.current.toggleCollapse('non-existent-id')
      })

      // Should not throw or call database
      expect(DatabaseService.updateIdea).not.toHaveBeenCalled()
    })

    it('should revert on error', async () => {
      vi.mocked(DatabaseService.updateIdea).mockRejectedValue(new Error('Update failed'))

      const { result } = renderHook(() => useOptimizedMatrix(defaultOptions))

      await act(async () => {
        await result.current.loadIdeas(mockProject.id)
      })

      const originalCollapsed = mockIdeas[0].is_collapsed

      await act(async () => {
        await result.current.toggleCollapse(mockIdeas[0].id)
      })

      // Should revert to original state
      const idea = result.current.ideas.find(i => i.id === mockIdeas[0].id)
      await waitFor(() => {
        expect(idea?.is_collapsed).toBe(originalCollapsed)
      })
    })
  })

  describe('handleDragEnd', () => {
    it('should handle drag end and update position', async () => {
      const { result } = renderHook(() => useOptimizedMatrix(defaultOptions))

      await act(async () => {
        await result.current.loadIdeas(mockProject.id)
      })

      const dragEvent = createMockDragEndEvent(mockIdeas[0].id, 50, 100)

      await act(async () => {
        await result.current.handleDragEnd(dragEvent)
      })

      // Should update idea position
      const movedIdea = result.current.ideas.find(i => i.id === mockIdeas[0].id)
      expect(movedIdea).toBeTruthy()
    })

    it('should handle zero delta gracefully', async () => {
      const { result } = renderHook(() => useOptimizedMatrix(defaultOptions))

      await act(async () => {
        await result.current.loadIdeas(mockProject.id)
      })

      const dragEvent = createMockDragEndEvent(mockIdeas[0].id, 0, 0)

      await act(async () => {
        await result.current.handleDragEnd(dragEvent)
      })

      // Should not update anything
      expect(DatabaseService.updateIdea).not.toHaveBeenCalled()
    })

    it('should handle non-existent idea during drag', async () => {
      const { result } = renderHook(() => useOptimizedMatrix(defaultOptions))

      await act(async () => {
        await result.current.loadIdeas(mockProject.id)
      })

      const dragEvent = createMockDragEndEvent('non-existent-id', 50, 100)

      await act(async () => {
        await result.current.handleDragEnd(dragEvent)
      })

      // Should not throw
      expect(result.current.error).toBeNull()
    })

    it('should handle drag errors', async () => {
      const { result } = renderHook(() => useOptimizedMatrix(defaultOptions))

      await act(async () => {
        await result.current.loadIdeas(mockProject.id)
      })

      // Create a drag event with invalid data
      const invalidEvent = { active: { id: mockIdeas[0].id } } as any

      await act(async () => {
        await result.current.handleDragEnd(invalidEvent)
      })

      // Should handle gracefully without crashing
      expect(result.current.ideas).toBeTruthy()
    })
  })

  describe('refreshIdeas', () => {
    it('should reload ideas from database', async () => {
      const { result } = renderHook(() => useOptimizedMatrix(defaultOptions))

      await act(async () => {
        await result.current.loadIdeas(mockProject.id)
      })

      vi.clearAllMocks()

      await act(async () => {
        await result.current.refreshIdeas()
      })

      expect(DatabaseService.getProjectIdeas).toHaveBeenCalledWith(mockProject.id)
    })

    it('should not refresh without current project', async () => {
      const { result } = renderHook(() => useOptimizedMatrix({
        ...defaultOptions,
        currentProject: null
      }))

      await act(async () => {
        await result.current.refreshIdeas()
      })

      expect(DatabaseService.getProjectIdeas).not.toHaveBeenCalled()
    })
  })

  describe('clearError', () => {
    it('should clear error state', async () => {
      vi.mocked(DatabaseService.getProjectIdeas).mockRejectedValue(new Error('Test error'))

      const { result } = renderHook(() => useOptimizedMatrix(defaultOptions))

      await act(async () => {
        await result.current.loadIdeas(mockProject.id)
      })

      expect(result.current.error).toBeTruthy()

      act(() => {
        result.current.clearError()
      })

      expect(result.current.error).toBeNull()
    })
  })

  describe('edge cases', () => {
    it('should handle rapid successive operations', async () => {
      const { result } = renderHook(() => useOptimizedMatrix(defaultOptions))

      await act(async () => {
        await result.current.loadIdeas(mockProject.id)
      })

      // Rapid operations
      await act(async () => {
        await Promise.all([
          result.current.updateIdea({ ...mockIdeas[0], content: 'Update 1' }),
          result.current.updateIdea({ ...mockIdeas[1], content: 'Update 2' }),
          result.current.toggleCollapse(mockIdeas[2].id)
        ])
      })

      // Should handle all operations
      expect(DatabaseService.updateIdea).toHaveBeenCalledTimes(3)
    })

    it('should handle null user gracefully', async () => {
      const { result } = renderHook(() => useOptimizedMatrix({
        ...defaultOptions,
        currentUser: null
      }))

      const newIdea = {
        content: 'New',
        details: '',
        x: 0,
        y: 0,
        priority: 'high' as const,
        project_id: mockProject.id
      }

      await act(async () => {
        await result.current.addIdea(newIdea)
      })

      expect(DatabaseService.createIdea).toHaveBeenCalledWith(
        expect.objectContaining({
          created_by: null
        })
      )
    })

    it('should handle null project gracefully', async () => {
      const { result } = renderHook(() => useOptimizedMatrix({
        ...defaultOptions,
        currentProject: null
      }))

      const newIdea = {
        content: 'New',
        details: '',
        x: 0,
        y: 0,
        priority: 'high' as const
      }

      await act(async () => {
        await result.current.addIdea(newIdea as any)
      })

      expect(DatabaseService.createIdea).toHaveBeenCalledWith(
        expect.objectContaining({
          project_id: undefined
        })
      )
    })
  })
})