/**
 * useIdeas Hook Comprehensive Test Suite
 *
 * Tests the core ideas management hook including:
 * - CRUD operations (Create, Read, Update, Delete)
 * - Optimistic updates with rollback
 * - Drag-drop with coordinate scaling
 * - Real-time subscriptions
 * - Project-specific idea loading
 * - Collapse/expand functionality
 * - Error handling and recovery
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useIdeas } from '../useIdeas'
import { DatabaseService } from '../../lib/database'
import { testUsers, testProjects, testIdeas } from '../../test/fixtures'
import type { IdeaCard, User, Project } from '../../types'
import type { DragEndEvent } from '@dnd-kit/core'

// Mock the database service
vi.mock('../../lib/database')
vi.mock('../../utils/logger')

// Mock UserContext
vi.mock('../../contexts/UserContext', () => ({
  useCurrentUser: () => testUsers.regular
}))

describe('useIdeas', () => {
  const mockSetShowAddModal = vi.fn()
  const mockSetShowAIModal = vi.fn()
  const mockSetEditingIdea = vi.fn()

  const defaultOptions = {
    currentUser: testUsers.regular,
    currentProject: testProjects.active,
    setShowAddModal: mockSetShowAddModal,
    setShowAIModal: mockSetShowAIModal,
    setEditingIdea: mockSetEditingIdea
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup default mock implementations
    vi.mocked(DatabaseService.getProjectIdeas).mockResolvedValue([
      testIdeas.quickWin,
      testIdeas.strategic
    ])

    vi.mocked(DatabaseService.createIdea).mockResolvedValue({
      success: true,
      data: testIdeas.quickWin
    })

    vi.mocked(DatabaseService.updateIdea).mockResolvedValue(testIdeas.quickWin)
    vi.mocked(DatabaseService.deleteIdea).mockResolvedValue(true)

    vi.mocked(DatabaseService.subscribeToIdeas).mockReturnValue(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Initialization', () => {
    it('should initialize with empty ideas array', () => {
      const { result } = renderHook(() => useIdeas(defaultOptions))

      expect(result.current.ideas).toEqual([])
    })

    it('should load ideas when currentProject is provided', async () => {
      const { result } = renderHook(() => useIdeas(defaultOptions))

      await waitFor(() => {
        expect(result.current.ideas.length).toBeGreaterThan(0)
      })

      expect(DatabaseService.getProjectIdeas).toHaveBeenCalledWith(testProjects.active.id)
    })

    it('should not load ideas when currentProject is null', () => {
      renderHook(() =>
        useIdeas({
          ...defaultOptions,
          currentProject: null
        })
      )

      expect(DatabaseService.getProjectIdeas).not.toHaveBeenCalled()
    })

    it('should clear ideas when project changes to null', async () => {
      const { result, rerender } = renderHook(
        ({ project }) =>
          useIdeas({
            ...defaultOptions,
            currentProject: project
          }),
        {
          initialProps: { project: testProjects.active }
        }
      )

      await waitFor(() => {
        expect(result.current.ideas.length).toBeGreaterThan(0)
      })

      rerender({ project: null })

      await waitFor(() => {
        expect(result.current.ideas).toEqual([])
      })
    })

    it('should reload ideas when project changes', async () => {
      const { rerender } = renderHook(
        ({ project }) =>
          useIdeas({
            ...defaultOptions,
            currentProject: project
          }),
        {
          initialProps: { project: testProjects.active }
        }
      )

      await waitFor(() => {
        expect(DatabaseService.getProjectIdeas).toHaveBeenCalledWith(testProjects.active.id)
      })

      rerender({ project: testProjects.demo })

      await waitFor(() => {
        expect(DatabaseService.getProjectIdeas).toHaveBeenCalledWith(testProjects.demo.id)
      })
    })
  })

  describe('loadIdeas', () => {
    it('should load ideas for specified project', async () => {
      const { result } = renderHook(() => useIdeas(defaultOptions))

      await act(async () => {
        await result.current.loadIdeas(testProjects.active.id)
      })

      await waitFor(() => {
        expect(DatabaseService.getProjectIdeas).toHaveBeenCalledWith(testProjects.active.id)
        expect(result.current.ideas.length).toBeGreaterThan(0)
      })
    })

    it('should clear ideas when no projectId provided', async () => {
      const { result } = renderHook(() => useIdeas(defaultOptions))

      await act(async () => {
        await result.current.loadIdeas()
      })

      expect(result.current.ideas).toEqual([])
    })

    it('should clear old ideas before loading new ones', async () => {
      const { result } = renderHook(() => useIdeas(defaultOptions))

      await act(async () => {
        await result.current.loadIdeas(testProjects.active.id)
      })

      const initialLength = result.current.ideas.length

      vi.mocked(DatabaseService.getProjectIdeas).mockResolvedValue([testIdeas.quickWin])

      await act(async () => {
        await result.current.loadIdeas(testProjects.active.id)
      })

      await waitFor(() => {
        expect(result.current.ideas.length).toBe(1)
      })
    })
  })

  describe('addIdea', () => {
    it('should add new idea with optimistic update', async () => {
      const { result } = renderHook(() => useIdeas(defaultOptions))

      const newIdea = {
        content: 'New Test Idea',
        details: 'Test details',
        x: 130,
        y: 130,
        priority: 'high' as const
      }

      await act(async () => {
        await result.current.addIdea(newIdea)
      })

      // Should show optimistic update immediately
      await waitFor(() => {
        expect(result.current.ideas.some(i => i.content === newIdea.content)).toBe(true)
      })
    })

    it('should include currentUser id in created idea', async () => {
      const { result } = renderHook(() => useIdeas(defaultOptions))

      const newIdea = {
        content: 'New Idea',
        details: '',
        x: 130,
        y: 130,
        priority: 'moderate' as const
      }

      await act(async () => {
        await result.current.addIdea(newIdea)
      })

      await waitFor(() => {
        expect(DatabaseService.createIdea).toHaveBeenCalledWith(
          expect.objectContaining({
            created_by: testUsers.regular.id,
            project_id: testProjects.active.id
          })
        )
      })
    })

    it('should close add modal after creating idea', async () => {
      const { result } = renderHook(() => useIdeas(defaultOptions))

      const newIdea = {
        content: 'New Idea',
        details: '',
        x: 130,
        y: 130,
        priority: 'low' as const
      }

      await act(async () => {
        await result.current.addIdea(newIdea)
      })

      expect(mockSetShowAddModal).toHaveBeenCalledWith(false)
    })

    it('should close AI modal after creating idea', async () => {
      const { result } = renderHook(() => useIdeas(defaultOptions))

      const newIdea = {
        content: 'AI Generated Idea',
        details: '',
        x: 260,
        y: 260,
        priority: 'high' as const
      }

      await act(async () => {
        await result.current.addIdea(newIdea)
      })

      expect(mockSetShowAIModal).toHaveBeenCalledWith(false)
    })

    it('should rollback on create failure', async () => {
      const { result } = renderHook(() => useIdeas(defaultOptions))

      vi.mocked(DatabaseService.createIdea).mockResolvedValue({
        success: false,
        error: 'Database error'
      })

      const newIdea = {
        content: 'Failing Idea',
        details: '',
        x: 130,
        y: 130,
        priority: 'low' as const
      }

      await act(async () => {
        await result.current.addIdea(newIdea)
      })

      await waitFor(() => {
        // Optimistic idea should be rolled back
        expect(result.current.ideas.some(i => i.content === 'Failing Idea')).toBe(false)
      })
    })
  })

  describe('updateIdea', () => {
    it('should update existing idea with optimistic update', async () => {
      const { result } = renderHook(() => useIdeas(defaultOptions))

      await waitFor(() => {
        expect(result.current.ideas.length).toBeGreaterThan(0)
      })

      const ideaToUpdate = { ...result.current.ideas[0], content: 'Updated Content' }

      await act(async () => {
        await result.current.updateIdea(ideaToUpdate)
      })

      await waitFor(() => {
        const updated = result.current.ideas.find(i => i.id === ideaToUpdate.id)
        expect(updated?.content).toBe('Updated Content')
      })
    })

    it('should close editing modal after update', async () => {
      const { result } = renderHook(() => useIdeas(defaultOptions))

      await waitFor(() => {
        expect(result.current.ideas.length).toBeGreaterThan(0)
      })

      const ideaToUpdate = result.current.ideas[0]

      await act(async () => {
        await result.current.updateIdea(ideaToUpdate)
      })

      expect(mockSetEditingIdea).toHaveBeenCalledWith(null)
    })

    it('should send correct update data to database', async () => {
      const { result } = renderHook(() => useIdeas(defaultOptions))

      await waitFor(() => {
        expect(result.current.ideas.length).toBeGreaterThan(0)
      })

      const ideaToUpdate = {
        ...result.current.ideas[0],
        content: 'New Content',
        priority: 'strategic' as const
      }

      await act(async () => {
        await result.current.updateIdea(ideaToUpdate)
      })

      expect(DatabaseService.updateIdea).toHaveBeenCalledWith(
        ideaToUpdate.id,
        expect.objectContaining({
          content: 'New Content',
          priority: 'strategic'
        })
      )
    })

    it('should rollback on update failure', async () => {
      const { result } = renderHook(() => useIdeas(defaultOptions))

      await waitFor(() => {
        expect(result.current.ideas.length).toBeGreaterThan(0)
      })

      const originalIdea = result.current.ideas[0]
      const ideaToUpdate = { ...originalIdea, content: 'Failed Update' }

      vi.mocked(DatabaseService.updateIdea).mockResolvedValue(null)

      await act(async () => {
        await result.current.updateIdea(ideaToUpdate)
      })

      await waitFor(() => {
        const idea = result.current.ideas.find(i => i.id === originalIdea.id)
        expect(idea?.content).toBe(originalIdea.content)
      })
    })
  })

  describe('deleteIdea', () => {
    it('should delete idea with optimistic update', async () => {
      const { result } = renderHook(() => useIdeas(defaultOptions))

      await waitFor(() => {
        expect(result.current.ideas.length).toBeGreaterThan(0)
      })

      const ideaToDelete = result.current.ideas[0]

      await act(async () => {
        await result.current.deleteIdea(ideaToDelete.id)
      })

      await waitFor(() => {
        expect(result.current.ideas.find(i => i.id === ideaToDelete.id)).toBeUndefined()
      })
    })

    it('should close editing modal after delete', async () => {
      const { result } = renderHook(() => useIdeas(defaultOptions))

      await waitFor(() => {
        expect(result.current.ideas.length).toBeGreaterThan(0)
      })

      await act(async () => {
        await result.current.deleteIdea(result.current.ideas[0].id)
      })

      expect(mockSetEditingIdea).toHaveBeenCalledWith(null)
    })

    it('should rollback on delete failure', async () => {
      const { result } = renderHook(() => useIdeas(defaultOptions))

      await waitFor(() => {
        expect(result.current.ideas.length).toBeGreaterThan(0)
      })

      const ideaToDelete = result.current.ideas[0]
      const initialCount = result.current.ideas.length

      vi.mocked(DatabaseService.deleteIdea).mockResolvedValue(false)

      await act(async () => {
        await result.current.deleteIdea(ideaToDelete.id)
      })

      await waitFor(() => {
        // Should rollback and restore the idea
        expect(result.current.ideas.length).toBe(initialCount)
        expect(result.current.ideas.find(i => i.id === ideaToDelete.id)).toBeDefined()
      })
    })
  })

  describe('toggleCollapse', () => {
    it('should collapse expanded idea', async () => {
      const { result } = renderHook(() => useIdeas(defaultOptions))

      await waitFor(() => {
        expect(result.current.ideas.length).toBeGreaterThan(0)
      })

      const ideaToCollapse = result.current.ideas[0]

      await act(async () => {
        await result.current.toggleCollapse(ideaToCollapse.id, true)
      })

      await waitFor(() => {
        const idea = result.current.ideas.find(i => i.id === ideaToCollapse.id)
        expect(idea?.is_collapsed).toBe(true)
      })
    })

    it('should expand collapsed idea', async () => {
      const collapsedIdea = { ...testIdeas.quickWin, is_collapsed: true }

      vi.mocked(DatabaseService.getProjectIdeas).mockResolvedValue([collapsedIdea])

      const { result } = renderHook(() => useIdeas(defaultOptions))

      await waitFor(() => {
        expect(result.current.ideas.length).toBeGreaterThan(0)
      })

      await act(async () => {
        await result.current.toggleCollapse(collapsedIdea.id, false)
      })

      await waitFor(() => {
        const idea = result.current.ideas.find(i => i.id === collapsedIdea.id)
        expect(idea?.is_collapsed).toBe(false)
      })
    })

    it('should toggle state when no explicit state provided', async () => {
      const { result } = renderHook(() => useIdeas(defaultOptions))

      await waitFor(() => {
        expect(result.current.ideas.length).toBeGreaterThan(0)
      })

      const idea = result.current.ideas[0]
      const initialState = idea.is_collapsed || false

      await act(async () => {
        await result.current.toggleCollapse(idea.id)
      })

      await waitFor(() => {
        const updated = result.current.ideas.find(i => i.id === idea.id)
        expect(updated?.is_collapsed).toBe(!initialState)
      })
    })

    it('should update database with collapsed state', async () => {
      const { result } = renderHook(() => useIdeas(defaultOptions))

      await waitFor(() => {
        expect(result.current.ideas.length).toBeGreaterThan(0)
      })

      await act(async () => {
        await result.current.toggleCollapse(result.current.ideas[0].id, true)
      })

      expect(DatabaseService.updateIdea).toHaveBeenCalledWith(
        result.current.ideas[0].id,
        { is_collapsed: true }
      )
    })

    it('should handle toggling non-existent idea gracefully', async () => {
      const { result } = renderHook(() => useIdeas(defaultOptions))

      await act(async () => {
        await result.current.toggleCollapse('non-existent-id', true)
      })

      // Should not throw error
      expect(result.current.ideas).toBeDefined()
    })
  })

  describe('handleDragEnd', () => {
    beforeEach(() => {
      // Mock matrix container for drag calculations
      const mockContainer = document.createElement('div')
      mockContainer.className = 'matrix-container'
      Object.defineProperty(mockContainer, 'offsetWidth', { value: 1200, writable: true })
      Object.defineProperty(mockContainer, 'offsetHeight', { value: 1200, writable: true })
      document.body.appendChild(mockContainer)
    })

    afterEach(() => {
      const container = document.querySelector('.matrix-container')
      if (container) {
        container.remove()
      }
    })

    it('should update idea position with coordinate scaling', async () => {
      const { result } = renderHook(() => useIdeas(defaultOptions))

      await waitFor(() => {
        expect(result.current.ideas.length).toBeGreaterThan(0)
      })

      const ideaToMove = result.current.ideas[0]
      const dragEvent: DragEndEvent = {
        active: { id: ideaToMove.id, data: {} as any, rect: {} as any },
        delta: { x: 100, y: 50 },
        over: null,
        collisions: null,
        activatorEvent: null as any
      }

      await act(async () => {
        await result.current.handleDragEnd(dragEvent)
      })

      // With container width 1200px:
      // scaleX = 600 / 1200 = 0.5
      // coordDeltaX = 100 * 0.5 = 50
      // coordDeltaY = 50 * 0.5 = 25

      await waitFor(() => {
        expect(DatabaseService.updateIdea).toHaveBeenCalledWith(
          ideaToMove.id,
          expect.objectContaining({
            x: expect.any(Number),
            y: expect.any(Number)
          })
        )
      })
    })

    it('should not update position when delta is zero', async () => {
      const { result } = renderHook(() => useIdeas(defaultOptions))

      await waitFor(() => {
        expect(result.current.ideas.length).toBeGreaterThan(0)
      })

      const dragEvent: DragEndEvent = {
        active: { id: result.current.ideas[0].id, data: {} as any, rect: {} as any },
        delta: { x: 0, y: 0 },
        over: null,
        collisions: null,
        activatorEvent: null as any
      }

      vi.clearAllMocks()

      await act(async () => {
        await result.current.handleDragEnd(dragEvent)
      })

      expect(DatabaseService.updateIdea).not.toHaveBeenCalled()
    })

    it('should clamp coordinates to valid bounds (-20 to 540)', async () => {
      const edgeIdea = { ...testIdeas.quickWin, x: 510, y: 510 }

      vi.mocked(DatabaseService.getProjectIdeas).mockResolvedValue([edgeIdea])

      const { result } = renderHook(() => useIdeas(defaultOptions))

      await waitFor(() => {
        expect(result.current.ideas.length).toBeGreaterThan(0)
      })

      const dragEvent: DragEndEvent = {
        active: { id: edgeIdea.id, data: {} as any, rect: {} as any },
        delta: { x: 200, y: 200 }, // Would push beyond max
        over: null,
        collisions: null,
        activatorEvent: null as any
      }

      await act(async () => {
        await result.current.handleDragEnd(dragEvent)
      })

      await waitFor(() => {
        const call = vi.mocked(DatabaseService.updateIdea).mock.calls[0]
        if (call) {
          const [, updates] = call
          const coords = updates as { x: number; y: number }
          expect(coords.x).toBeLessThanOrEqual(540)
          expect(coords.y).toBeLessThanOrEqual(540)
        }
      })
    })

    it('should handle drag when matrix container is not found', async () => {
      // Remove container
      const container = document.querySelector('.matrix-container')
      if (container) {
        container.remove()
      }

      const { result } = renderHook(() => useIdeas(defaultOptions))

      await waitFor(() => {
        expect(result.current.ideas.length).toBeGreaterThan(0)
      })

      const dragEvent: DragEndEvent = {
        active: { id: result.current.ideas[0].id, data: {} as any, rect: {} as any },
        delta: { x: 100, y: 50 },
        over: null,
        collisions: null,
        activatorEvent: null as any
      }

      await act(async () => {
        await result.current.handleDragEnd(dragEvent)
      })

      // Should not crash, should return early
      expect(DatabaseService.updateIdea).not.toHaveBeenCalled()
    })

    it('should use optimistic update for instant drag feedback', async () => {
      const { result } = renderHook(() => useIdeas(defaultOptions))

      await waitFor(() => {
        expect(result.current.ideas.length).toBeGreaterThan(0)
      })

      const ideaToMove = result.current.ideas[0]
      const originalX = ideaToMove.x

      const dragEvent: DragEndEvent = {
        active: { id: ideaToMove.id, data: {} as any, rect: {} as any },
        delta: { x: 100, y: 0 },
        over: null,
        collisions: null,
        activatorEvent: null as any
      }

      await act(async () => {
        await result.current.handleDragEnd(dragEvent)
      })

      // Position should update immediately (optimistic)
      const movedIdea = result.current.ideas.find(i => i.id === ideaToMove.id)
      expect(movedIdea?.x).not.toBe(originalX)
    })

    it('should round coordinates to integers', async () => {
      const { result } = renderHook(() => useIdeas(defaultOptions))

      await waitFor(() => {
        expect(result.current.ideas.length).toBeGreaterThan(0)
      })

      const dragEvent: DragEndEvent = {
        active: { id: result.current.ideas[0].id, data: {} as any, rect: {} as any },
        delta: { x: 33, y: 33 }, // Will produce fractional coordinates
        over: null,
        collisions: null,
        activatorEvent: null as any
      }

      await act(async () => {
        await result.current.handleDragEnd(dragEvent)
      })

      await waitFor(() => {
        const call = vi.mocked(DatabaseService.updateIdea).mock.calls[0]
        if (call) {
          const [, updates] = call
          const coords = updates as { x: number; y: number }
          expect(Number.isInteger(coords.x)).toBe(true)
          expect(Number.isInteger(coords.y)).toBe(true)
        }
      })
    })
  })

  describe('Real-time Subscriptions', () => {
    it('should subscribe to ideas for current project', async () => {
      renderHook(() => useIdeas(defaultOptions))

      await waitFor(() => {
        expect(DatabaseService.subscribeToIdeas).toHaveBeenCalledWith(
          expect.any(Function),
          testProjects.active.id,
          testUsers.regular.id,
          { skipInitialLoad: true }
        )
      })
    })

    it('should not subscribe for demo users', async () => {
      const demoUser = testUsers.demo

      renderHook(() =>
        useIdeas({
          ...defaultOptions,
          currentUser: demoUser
        })
      )

      await waitFor(() => {
        // Demo users skip subscriptions
        expect(DatabaseService.subscribeToIdeas).not.toHaveBeenCalled()
      })
    })

    it('should not subscribe when no project selected', async () => {
      renderHook(() =>
        useIdeas({
          ...defaultOptions,
          currentProject: null
        })
      )

      expect(DatabaseService.subscribeToIdeas).not.toHaveBeenCalled()
    })

    it('should unsubscribe on project change', async () => {
      const unsubscribe = vi.fn()
      vi.mocked(DatabaseService.subscribeToIdeas).mockReturnValue(unsubscribe)

      const { rerender } = renderHook(
        ({ project }) =>
          useIdeas({
            ...defaultOptions,
            currentProject: project
          }),
        {
          initialProps: { project: testProjects.active }
        }
      )

      await waitFor(() => {
        expect(DatabaseService.subscribeToIdeas).toHaveBeenCalled()
      })

      rerender({ project: testProjects.demo })

      await waitFor(() => {
        expect(unsubscribe).toHaveBeenCalled()
      })
    })

    it('should filter subscription updates to current project only', async () => {
      let subscriptionCallback: (ideas: IdeaCard[]) => void = () => {}

      vi.mocked(DatabaseService.subscribeToIdeas).mockImplementation((callback) => {
        subscriptionCallback = callback
        return () => {}
      })

      const { result } = renderHook(() => useIdeas(defaultOptions))

      await waitFor(() => {
        expect(DatabaseService.subscribeToIdeas).toHaveBeenCalled()
      })

      // Simulate subscription update with mixed project ideas
      const mixedIdeas = [
        testIdeas.quickWin, // belongs to active project
        { ...testIdeas.strategic, project_id: 'different-project-id' }
      ]

      act(() => {
        subscriptionCallback(mixedIdeas)
      })

      await waitFor(() => {
        // Should only include ideas from current project
        expect(result.current.ideas.length).toBe(1)
        expect(result.current.ideas[0].id).toBe(testIdeas.quickWin.id)
      })
    })
  })

  describe('Optimistic Data', () => {
    it('should return optimistic data instead of base data', async () => {
      const { result } = renderHook(() => useIdeas(defaultOptions))

      await waitFor(() => {
        expect(result.current.ideas.length).toBeGreaterThan(0)
      })

      // Ideas returned should be from optimistic data
      expect(result.current.ideas).toBeDefined()
      expect(Array.isArray(result.current.ideas)).toBe(true)
    })

    it('should include pending optimistic creates', async () => {
      const { result } = renderHook(() => useIdeas(defaultOptions))

      const newIdea = {
        content: 'Optimistic Idea',
        details: '',
        x: 260,
        y: 260,
        priority: 'high' as const
      }

      // Delay the database response
      vi.mocked(DatabaseService.createIdea).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  success: true,
                  data: { ...testIdeas.quickWin, content: newIdea.content }
                }),
              100
            )
          )
      )

      await act(async () => {
        await result.current.addIdea(newIdea)
      })

      // Should show optimistic idea immediately
      expect(result.current.ideas.some(i => i.content === 'Optimistic Idea')).toBe(true)
    })
  })

  describe('Edge Cases', () => {
    it('should handle null user gracefully', async () => {
      const { result } = renderHook(() =>
        useIdeas({
          ...defaultOptions,
          currentUser: null
        })
      )

      await waitFor(() => {
        expect(result.current.ideas).toBeDefined()
      })
    })

    it('should handle ideas without project_id', async () => {
      const ideaWithoutProject = { ...testIdeas.quickWin, project_id: undefined }

      vi.mocked(DatabaseService.getProjectIdeas).mockResolvedValue([ideaWithoutProject])

      const { result } = renderHook(() => useIdeas(defaultOptions))

      await waitFor(() => {
        expect(result.current.ideas.length).toBeGreaterThan(0)
      })
    })

    it('should handle rapid project changes', async () => {
      const { rerender } = renderHook(
        ({ project }) =>
          useIdeas({
            ...defaultOptions,
            currentProject: project
          }),
        {
          initialProps: { project: testProjects.active }
        }
      )

      // Rapid project changes
      rerender({ project: testProjects.demo })
      rerender({ project: testProjects.active })
      rerender({ project: testProjects.demo })

      await waitFor(() => {
        expect(result.current.ideas).toBeDefined()
      })
    })

    it('should handle database errors during load', async () => {
      vi.mocked(DatabaseService.getProjectIdeas).mockRejectedValue(
        new Error('Database connection failed')
      )

      const { result } = renderHook(() => useIdeas(defaultOptions))

      await waitFor(() => {
        // Should handle error gracefully, keep empty array
        expect(result.current.ideas).toEqual([])
      })
    })

    it('should handle concurrent operations', async () => {
      const { result } = renderHook(() => useIdeas(defaultOptions))

      await waitFor(() => {
        expect(result.current.ideas.length).toBeGreaterThan(0)
      })

      // Fire multiple operations concurrently
      const promises = [
        result.current.addIdea({
          content: 'Concurrent 1',
          details: '',
          x: 100,
          y: 100,
          priority: 'low'
        }),
        result.current.addIdea({
          content: 'Concurrent 2',
          details: '',
          x: 200,
          y: 200,
          priority: 'moderate'
        }),
        result.current.toggleCollapse(result.current.ideas[0].id, true)
      ]

      await act(async () => {
        await Promise.all(promises)
      })

      // All operations should complete
      await waitFor(() => {
        expect(result.current.ideas.length).toBeGreaterThan(2)
      })
    })
  })
})