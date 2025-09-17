import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useIdeas } from '../useIdeas'
import { mockUser, mockProject, mockIdea, mockIdeas, createMockDragEndEvent } from '../../test/utils/test-utils'

// Mock the database service
const mockDatabaseService = {
  getProjectIdeas: vi.fn(() => Promise.resolve(mockIdeas)),
  createIdea: vi.fn(() => Promise.resolve({ success: true, data: mockIdea })),
  updateIdea: vi.fn(() => Promise.resolve(mockIdea)),
  deleteIdea: vi.fn(() => Promise.resolve(true)),
  subscribeToIdeas: vi.fn(() => vi.fn()) // Returns unsubscribe function
}

vi.mock('../../lib/database', () => ({
  DatabaseService: mockDatabaseService
}))

// Mock the optimistic updates hook
const mockOptimisticUpdates = {
  optimisticData: mockIdeas,
  createIdeaOptimistic: vi.fn(),
  updateIdeaOptimistic: vi.fn(),
  deleteIdeaOptimistic: vi.fn(),
  moveIdeaOptimistic: vi.fn()
}

vi.mock('../useOptimisticUpdates', () => ({
  useOptimisticUpdates: vi.fn(() => mockOptimisticUpdates)
}))

// Mock logger
vi.mock('../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
}))

describe('useIdeas', () => {
  const mockSetShowAddModal = vi.fn()
  const mockSetShowAIModal = vi.fn()
  const mockSetEditingIdea = vi.fn()

  const defaultOptions = {
    currentUser: mockUser,
    currentProject: mockProject,
    setShowAddModal: mockSetShowAddModal,
    setShowAIModal: mockSetShowAIModal,
    setEditingIdea: mockSetEditingIdea
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // Reset mock implementations
    mockOptimisticUpdates.optimisticData = mockIdeas
    mockDatabaseService.getProjectIdeas.mockResolvedValue(mockIdeas)
    mockDatabaseService.createIdea.mockResolvedValue({ success: true, data: mockIdea })
    mockDatabaseService.updateIdea.mockResolvedValue(mockIdea)
    mockDatabaseService.deleteIdea.mockResolvedValue(true)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('initialization', () => {
    it('should return optimistic data as ideas', () => {
      const { result } = renderHook(() => useIdeas(defaultOptions))

      expect(result.current.ideas).toEqual(mockIdeas)
    })

    it('should load ideas when project changes', async () => {
      const { rerender } = renderHook(
        (props) => useIdeas(props),
        { initialProps: defaultOptions }
      )

      expect(mockDatabaseService.getProjectIdeas).toHaveBeenCalledWith(mockProject.id)

      // Change project
      const newProject = { ...mockProject, id: 'new-project-id', name: 'New Project' }
      rerender({ ...defaultOptions, currentProject: newProject })

      await waitFor(() => {
        expect(mockDatabaseService.getProjectIdeas).toHaveBeenCalledWith('new-project-id')
      })
    })

    it('should clear ideas when no project is selected', async () => {
      const { result, rerender } = renderHook(
        (props) => useIdeas(props),
        { initialProps: defaultOptions }
      )

      // Remove project
      rerender({ ...defaultOptions, currentProject: null })

      await waitFor(() => {
        expect(result.current.ideas).toEqual([])
      })
    })

    it('should skip database calls for demo users', () => {
      const demoUser = { ...mockUser, id: '00000000-0000-0000-0000-000000000001' }

      renderHook(() => useIdeas({
        ...defaultOptions,
        currentUser: demoUser
      }))

      expect(mockDatabaseService.getProjectIdeas).toHaveBeenCalledWith(mockProject.id)
    })

    it('should set up real-time subscription for non-demo users', () => {
      const mockUnsubscribe = vi.fn()
      mockDatabaseService.subscribeToIdeas.mockReturnValue(mockUnsubscribe)

      const { unmount } = renderHook(() => useIdeas(defaultOptions))

      expect(mockDatabaseService.subscribeToIdeas).toHaveBeenCalledWith(
        expect.any(Function),
        mockProject.id
      )

      unmount()
      expect(mockUnsubscribe).toHaveBeenCalled()
    })

    it('should not set up subscription for demo users', () => {
      const demoUser = { ...mockUser, id: '00000000-0000-0000-0000-000000000001' }

      renderHook(() => useIdeas({
        ...defaultOptions,
        currentUser: demoUser
      }))

      expect(mockDatabaseService.subscribeToIdeas).not.toHaveBeenCalled()
    })
  })

  describe('idea operations', () => {
    describe('addIdea', () => {
      it('should add a new idea with optimistic update', async () => {
        const { result } = renderHook(() => useIdeas(defaultOptions))

        const newIdea = {
          content: 'New Test Idea',
          details: 'Test details',
          x: 300,
          y: 200,
          priority: 'high' as const
        }

        await act(async () => {
          await result.current.addIdea(newIdea)
        })

        expect(mockOptimisticUpdates.createIdeaOptimistic).toHaveBeenCalledWith(
          expect.objectContaining({
            ...newIdea,
            created_by: mockUser.id,
            project_id: mockProject.id
          }),
          expect.any(Function)
        )

        expect(mockSetShowAddModal).toHaveBeenCalledWith(false)
        expect(mockSetShowAIModal).toHaveBeenCalledWith(false)
      })

      it('should handle successful idea creation', async () => {
        const { result } = renderHook(() => useIdeas(defaultOptions))

        // Simulate the optimistic update callback being called
        let creationCallback: Function
        mockOptimisticUpdates.createIdeaOptimistic.mockImplementation((idea, callback) => {
          creationCallback = callback
        })

        const newIdea = {
          content: 'New Test Idea',
          details: 'Test details',
          x: 300,
          y: 200,
          priority: 'high' as const
        }

        await act(async () => {
          await result.current.addIdea(newIdea)
          // Execute the creation callback
          await creationCallback()
        })

        expect(mockDatabaseService.createIdea).toHaveBeenCalledWith(
          expect.objectContaining({
            ...newIdea,
            created_by: mockUser.id,
            project_id: mockProject.id
          })
        )
      })

      it('should handle idea creation failure', async () => {
        mockDatabaseService.createIdea.mockResolvedValue({
          success: false,
          error: { type: 'database', message: 'Creation failed', code: 'CREATE_ERROR' }
        })

        const { result } = renderHook(() => useIdeas(defaultOptions))

        let creationCallback: Function
        mockOptimisticUpdates.createIdeaOptimistic.mockImplementation((idea, callback) => {
          creationCallback = callback
        })

        const newIdea = {
          content: 'Failed Idea',
          details: 'This will fail',
          x: 300,
          y: 200,
          priority: 'high' as const
        }

        await act(async () => {
          await result.current.addIdea(newIdea)

          // Creation callback should throw an error
          await expect(creationCallback()).rejects.toThrow('Creation failed')
        })
      })
    })

    describe('updateIdea', () => {
      it('should update an idea with optimistic update', async () => {
        const { result } = renderHook(() => useIdeas(defaultOptions))

        const updatedIdea = {
          ...mockIdea,
          content: 'Updated Content',
          details: 'Updated details'
        }

        await act(async () => {
          await result.current.updateIdea(updatedIdea)
        })

        expect(mockOptimisticUpdates.updateIdeaOptimistic).toHaveBeenCalledWith(
          updatedIdea,
          expect.any(Function)
        )

        expect(mockSetEditingIdea).toHaveBeenCalledWith(null)
      })

      it('should handle successful idea update', async () => {
        const { result } = renderHook(() => useIdeas(defaultOptions))

        let updateCallback: Function
        mockOptimisticUpdates.updateIdeaOptimistic.mockImplementation((idea, callback) => {
          updateCallback = callback
        })

        const updatedIdea = {
          ...mockIdea,
          content: 'Updated Content'
        }

        await act(async () => {
          await result.current.updateIdea(updatedIdea)
          await updateCallback()
        })

        expect(mockDatabaseService.updateIdea).toHaveBeenCalledWith(
          mockIdea.id,
          expect.objectContaining({
            content: 'Updated Content',
            details: mockIdea.details,
            x: mockIdea.x,
            y: mockIdea.y,
            priority: mockIdea.priority
          })
        )
      })

      it('should handle idea update failure', async () => {
        mockDatabaseService.updateIdea.mockResolvedValue(null)

        const { result } = renderHook(() => useIdeas(defaultOptions))

        let updateCallback: Function
        mockOptimisticUpdates.updateIdeaOptimistic.mockImplementation((idea, callback) => {
          updateCallback = callback
        })

        await act(async () => {
          await result.current.updateIdea(mockIdea)
          await expect(updateCallback()).rejects.toThrow('Failed to update idea')
        })
      })
    })

    describe('deleteIdea', () => {
      it('should delete an idea with optimistic update', async () => {
        const { result } = renderHook(() => useIdeas(defaultOptions))

        await act(async () => {
          await result.current.deleteIdea(mockIdea.id)
        })

        expect(mockOptimisticUpdates.deleteIdeaOptimistic).toHaveBeenCalledWith(
          mockIdea.id,
          expect.any(Function)
        )

        expect(mockSetEditingIdea).toHaveBeenCalledWith(null)
      })

      it('should handle successful idea deletion', async () => {
        const { result } = renderHook(() => useIdeas(defaultOptions))

        let deleteCallback: Function
        mockOptimisticUpdates.deleteIdeaOptimistic.mockImplementation((id, callback) => {
          deleteCallback = callback
        })

        await act(async () => {
          await result.current.deleteIdea(mockIdea.id)
          await deleteCallback()
        })

        expect(mockDatabaseService.deleteIdea).toHaveBeenCalledWith(mockIdea.id)
      })

      it('should handle idea deletion failure', async () => {
        mockDatabaseService.deleteIdea.mockResolvedValue(false)

        const { result } = renderHook(() => useIdeas(defaultOptions))

        let deleteCallback: Function
        mockOptimisticUpdates.deleteIdeaOptimistic.mockImplementation((id, callback) => {
          deleteCallback = callback
        })

        await act(async () => {
          await result.current.deleteIdea(mockIdea.id)
          await expect(deleteCallback()).rejects.toThrow('Failed to delete idea')
        })
      })
    })

    describe('toggleCollapse', () => {
      it('should toggle idea collapse state', async () => {
        const { result } = renderHook(() => useIdeas(defaultOptions))

        // Mock setIdeas to capture the update
        let setIdeasCallback: Function
        const mockSetIdeas = vi.fn((callback) => {
          if (typeof callback === 'function') {
            setIdeasCallback = callback
          }
        })

        result.current.setIdeas = mockSetIdeas

        await act(async () => {
          await result.current.toggleCollapse(mockIdea.id)
        })

        expect(mockSetIdeas).toHaveBeenCalled()
        expect(mockDatabaseService.updateIdea).toHaveBeenCalledWith(
          mockIdea.id,
          { is_collapsed: !mockIdea.is_collapsed }
        )
      })

      it('should set specific collapse state when provided', async () => {
        const { result } = renderHook(() => useIdeas(defaultOptions))

        result.current.setIdeas = vi.fn()

        await act(async () => {
          await result.current.toggleCollapse(mockIdea.id, true)
        })

        expect(mockDatabaseService.updateIdea).toHaveBeenCalledWith(
          mockIdea.id,
          { is_collapsed: true }
        )
      })

      it('should handle non-existent idea gracefully', async () => {
        const { result } = renderHook(() => useIdeas(defaultOptions))

        await act(async () => {
          await result.current.toggleCollapse('non-existent-id')
        })

        expect(mockDatabaseService.updateIdea).not.toHaveBeenCalled()
      })
    })

    describe('handleDragEnd', () => {
      it('should handle idea movement with optimistic update', async () => {
        const { result } = renderHook(() => useIdeas(defaultOptions))

        const dragEvent = createMockDragEndEvent(mockIdea.id, 50, 30)

        await act(async () => {
          await result.current.handleDragEnd(dragEvent)
        })

        expect(mockOptimisticUpdates.moveIdeaOptimistic).toHaveBeenCalledWith(
          mockIdea.id,
          { x: mockIdea.x + 50, y: mockIdea.y + 30 },
          expect.any(Function)
        )
      })

      it('should handle successful position update', async () => {
        const { result } = renderHook(() => useIdeas(defaultOptions))

        let moveCallback: Function
        mockOptimisticUpdates.moveIdeaOptimistic.mockImplementation((id, position, callback) => {
          moveCallback = callback
        })

        const dragEvent = createMockDragEndEvent(mockIdea.id, 50, 30)

        await act(async () => {
          await result.current.handleDragEnd(dragEvent)
          await moveCallback()
        })

        expect(mockDatabaseService.updateIdea).toHaveBeenCalledWith(
          mockIdea.id,
          {
            x: mockIdea.x + 50,
            y: mockIdea.y + 30
          }
        )
      })

      it('should ignore drag events with no movement', async () => {
        const { result } = renderHook(() => useIdeas(defaultOptions))

        const dragEvent = createMockDragEndEvent(mockIdea.id, 0, 0)

        await act(async () => {
          await result.current.handleDragEnd(dragEvent)
        })

        expect(mockOptimisticUpdates.moveIdeaOptimistic).not.toHaveBeenCalled()
      })

      it('should apply bounds to idea positions', async () => {
        const { result } = renderHook(() => useIdeas(defaultOptions))

        let capturedPosition: { x: number; y: number }
        mockOptimisticUpdates.moveIdeaOptimistic.mockImplementation((id, position) => {
          capturedPosition = position
        })

        // Test movement that exceeds bounds
        const dragEvent = createMockDragEndEvent(mockIdea.id, 2000, 1000)

        await act(async () => {
          await result.current.handleDragEnd(dragEvent)
        })

        expect(capturedPosition!.x).toBeLessThanOrEqual(1400)
        expect(capturedPosition!.y).toBeLessThanOrEqual(650)
      })

      it('should handle non-existent idea gracefully', async () => {
        const { result } = renderHook(() => useIdeas(defaultOptions))

        const dragEvent = createMockDragEndEvent('non-existent-id', 50, 30)

        await act(async () => {
          await result.current.handleDragEnd(dragEvent)
        })

        expect(mockOptimisticUpdates.moveIdeaOptimistic).not.toHaveBeenCalled()
      })
    })
  })

  describe('loadIdeas', () => {
    it('should load ideas for a specific project', async () => {
      const { result } = renderHook(() => useIdeas(defaultOptions))

      await act(async () => {
        await result.current.loadIdeas('test-project-id')
      })

      expect(mockDatabaseService.getProjectIdeas).toHaveBeenCalledWith('test-project-id')
    })

    it('should clear ideas when no project ID provided', async () => {
      const { result } = renderHook(() => useIdeas(defaultOptions))

      result.current.setIdeas = vi.fn()

      await act(async () => {
        await result.current.loadIdeas()
      })

      expect(result.current.setIdeas).toHaveBeenCalledWith([])
    })
  })

  describe('cleanup', () => {
    it('should unsubscribe from real-time updates on unmount', () => {
      const mockUnsubscribe = vi.fn()
      mockDatabaseService.subscribeToIdeas.mockReturnValue(mockUnsubscribe)

      const { unmount } = renderHook(() => useIdeas(defaultOptions))

      unmount()

      expect(mockUnsubscribe).toHaveBeenCalled()
    })

    it('should not set up subscription when no user', () => {
      renderHook(() => useIdeas({
        ...defaultOptions,
        currentUser: null
      }))

      expect(mockDatabaseService.subscribeToIdeas).not.toHaveBeenCalled()
    })
  })
})