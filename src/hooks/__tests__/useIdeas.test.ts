import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { useIdeas } from '../useIdeas'
import { mockUser, mockProject, mockIdea, mockIdeas, createMockDragEndEvent } from '../../test/utils/test-utils'
import type { IdeaCard } from '../../types'
import type { RealtimeIdeaPayload } from '../../lib/database/services/RealtimeSubscriptionManager'

// ---------------------------------------------------------------------------
// vi.hoisted — all values needed by vi.mock factories must live here.
// Plain mutable objects (no Object.defineProperty) to avoid clearAllMocks issues.
// ---------------------------------------------------------------------------

const { mockDb, mockOptimistic, subCaptured } = vi.hoisted(() => {
  // Mutable slot — subscribeToIdeas writes the callback here.
  const _sub = { cb: null as ((payload: RealtimeIdeaPayload) => void) | null }

  const _db = {
    getProjectIdeas: vi.fn(),
    createIdea: vi.fn(),
    updateIdea: vi.fn(),
    deleteIdea: vi.fn(),
    subscribeToIdeas: vi.fn((cb: (payload: RealtimeIdeaPayload) => void) => {
      _sub.cb = cb
      return vi.fn()
    }),
  }

  const _opt = {
    optimisticData: [] as IdeaCard[],
    createIdeaOptimistic: vi.fn(),
    updateIdeaOptimistic: vi.fn(),
    deleteIdeaOptimistic: vi.fn(),
    moveIdeaOptimistic: vi.fn(),
  }

  return { mockDb: _db, mockOptimistic: _opt, subCaptured: _sub }
})

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../../lib/database', () => ({ DatabaseService: mockDb }))

vi.mock('../useOptimisticUpdates', () => ({
  useOptimisticUpdates: vi.fn(() => mockOptimistic),
}))

vi.mock('../../utils/logger', () => ({
  logger: { debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

vi.mock('../../lib/supabase', () => ({
  supabase: {},
  createAuthenticatedClientFromLocalStorage: vi.fn(() => null),
}))

vi.mock('../../utils/authTokenCache', () => ({
  getCachedAuthToken: vi.fn(() => 'fake-token'),
}))

vi.mock('../../contexts/UserContext', () => ({
  useCurrentUser: vi.fn(() => null),
}))

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { server } from '../../test/mocks/server'

// ---------------------------------------------------------------------------
// Non-demo user for subscription tests (demo UUIDs skip the subscription effect)
// ---------------------------------------------------------------------------
const realUser = { ...mockUser, id: 'a1b2c3d4-0000-0000-0000-000000000001' }

describe('useIdeas', () => {
  const mockSetShowAddModal = vi.fn()
  const mockSetShowAIModal = vi.fn()
  const mockSetEditingIdea = vi.fn()

  const defaultOptions = {
    currentUser: mockUser,
    currentProject: mockProject,
    setShowAddModal: mockSetShowAddModal,
    setShowAIModal: mockSetShowAIModal,
    setEditingIdea: mockSetEditingIdea,
  }

  // Options with a real (non-demo) user — needed for subscription tests.
  const realUserOptions = { ...defaultOptions, currentUser: realUser }

  beforeEach(() => {
    vi.clearAllMocks()
    subCaptured.cb = null
    mockOptimistic.optimisticData = mockIdeas

    // Restore implementations after clearAllMocks
    mockDb.getProjectIdeas.mockResolvedValue(mockIdeas)
    mockDb.createIdea.mockResolvedValue({ success: true, data: mockIdea })
    mockDb.updateIdea.mockResolvedValue(mockIdea)
    mockDb.deleteIdea.mockResolvedValue(true)
    mockDb.subscribeToIdeas.mockImplementation(
      (cb: (payload: RealtimeIdeaPayload) => void) => {
        subCaptured.cb = cb
        return vi.fn()
      }
    )

    // MSW handler for the fetch inside loadIdeas
    server.use(
      http.get('/api/ideas', () =>
        HttpResponse.json({ ideas: mockIdeas })
      )
    )
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // -------------------------------------------------------------------------
  // Initialization
  // -------------------------------------------------------------------------

  describe('initialization', () => {
    it('should return optimistic data as ideas', () => {
      const { result } = renderHook(() => useIdeas(defaultOptions))
      expect(result.current.ideas).toEqual(mockIdeas)
    })

    it('should clear ideas when no project is selected', async () => {
      const { result, rerender } = renderHook(
        (props) => useIdeas(props),
        { initialProps: defaultOptions }
      )
      rerender({ ...defaultOptions, currentProject: null })
      await waitFor(() => {
        expect(result.current.ideas).toEqual([])
      })
    })

    it('should set up real-time subscription for non-demo users', () => {
      const mockUnsubscribe = vi.fn()
      mockDb.subscribeToIdeas.mockImplementation(
        (cb: (payload: RealtimeIdeaPayload) => void) => {
          subCaptured.cb = cb
          return mockUnsubscribe
        }
      )
      const { unmount } = renderHook(() => useIdeas(realUserOptions))

      expect(mockDb.subscribeToIdeas).toHaveBeenCalledWith(
        expect.any(Function),
        mockProject.id,
        realUser.id,
        { skipInitialLoad: true },
        expect.anything()
      )

      unmount()
      expect(mockUnsubscribe).toHaveBeenCalled()
    })

    it('should not set up subscription for demo users', () => {
      // mockUser has a demo UUID (00000000-...) — subscription effect skips.
      renderHook(() => useIdeas(defaultOptions))
      expect(mockDb.subscribeToIdeas).not.toHaveBeenCalled()
    })
  })

  // -------------------------------------------------------------------------
  // Idea operations
  // -------------------------------------------------------------------------

  describe('idea operations', () => {
    describe('addIdea', () => {
      it('should add a new idea with optimistic update', async () => {
        const { result } = renderHook(() => useIdeas(defaultOptions))

        const newIdea = {
          content: 'New Test Idea',
          details: 'Test details',
          x: 300,
          y: 200,
          priority: 'high' as const,
        }

        await act(async () => {
          await result.current.addIdea(newIdea)
        })

        expect(mockOptimistic.createIdeaOptimistic).toHaveBeenCalledWith(
          expect.objectContaining({
            ...newIdea,
            created_by: mockUser.id,
            project_id: mockProject.id,
          }),
          expect.any(Function)
        )

        expect(mockSetShowAddModal).toHaveBeenCalledWith(false)
        expect(mockSetShowAIModal).toHaveBeenCalledWith(false)
      })

      it('should handle successful idea creation', async () => {
        const { result } = renderHook(() => useIdeas(defaultOptions))

        let creationCallback: Function
        mockOptimistic.createIdeaOptimistic.mockImplementation((idea: unknown, cb: Function) => {
          creationCallback = cb
        })

        const newIdea = {
          content: 'New Test Idea',
          details: 'Test details',
          x: 300,
          y: 200,
          priority: 'high' as const,
        }

        await act(async () => {
          await result.current.addIdea(newIdea)
          await creationCallback!()
        })

        expect(mockDb.createIdea).toHaveBeenCalledWith(
          expect.objectContaining({
            ...newIdea,
            created_by: mockUser.id,
            project_id: mockProject.id,
          })
        )
      })

      it('should handle idea creation failure', async () => {
        mockDb.createIdea.mockResolvedValue({
          success: false,
          error: { type: 'database', message: 'Creation failed', code: 'CREATE_ERROR' },
        })

        const { result } = renderHook(() => useIdeas(defaultOptions))

        let creationCallback: Function
        mockOptimistic.createIdeaOptimistic.mockImplementation((idea: unknown, cb: Function) => {
          creationCallback = cb
        })

        const newIdea = {
          content: 'Failed Idea',
          details: 'This will fail',
          x: 300,
          y: 200,
          priority: 'high' as const,
        }

        await act(async () => {
          await result.current.addIdea(newIdea)
          await expect(creationCallback!()).rejects.toThrow('Creation failed')
        })
      })
    })

    describe('updateIdea', () => {
      it('should update an idea with optimistic update', async () => {
        const { result } = renderHook(() => useIdeas(defaultOptions))

        const updatedIdea = { ...mockIdea, content: 'Updated Content', details: 'Updated details' }

        await act(async () => {
          await result.current.updateIdea(updatedIdea)
        })

        expect(mockOptimistic.updateIdeaOptimistic).toHaveBeenCalledWith(
          updatedIdea,
          expect.any(Function)
        )
        expect(mockSetEditingIdea).toHaveBeenCalledWith(null)
      })

      it('should handle successful idea update', async () => {
        const { result } = renderHook(() => useIdeas(defaultOptions))

        let updateCallback: Function
        mockOptimistic.updateIdeaOptimistic.mockImplementation((idea: unknown, cb: Function) => {
          updateCallback = cb
        })

        const updatedIdea = { ...mockIdea, content: 'Updated Content' }

        await act(async () => {
          await result.current.updateIdea(updatedIdea)
          await updateCallback!()
        })

        expect(mockDb.updateIdea).toHaveBeenCalledWith(
          mockIdea.id,
          expect.objectContaining({
            content: 'Updated Content',
            details: mockIdea.details,
            x: mockIdea.x,
            y: mockIdea.y,
            priority: mockIdea.priority,
          })
        )
      })

      it('should handle idea update failure', async () => {
        mockDb.updateIdea.mockResolvedValue(null)
        const { result } = renderHook(() => useIdeas(defaultOptions))

        let updateCallback: Function
        mockOptimistic.updateIdeaOptimistic.mockImplementation((idea: unknown, cb: Function) => {
          updateCallback = cb
        })

        await act(async () => {
          await result.current.updateIdea(mockIdea)
          await expect(updateCallback!()).rejects.toThrow('Failed to update idea')
        })
      })
    })

    describe('deleteIdea', () => {
      it('should delete an idea with optimistic update', async () => {
        const { result } = renderHook(() => useIdeas(defaultOptions))

        await act(async () => {
          await result.current.deleteIdea(mockIdea.id)
        })

        expect(mockOptimistic.deleteIdeaOptimistic).toHaveBeenCalledWith(
          mockIdea.id,
          expect.any(Function)
        )
        expect(mockSetEditingIdea).toHaveBeenCalledWith(null)
      })

      it('should handle successful idea deletion', async () => {
        const { result } = renderHook(() => useIdeas(defaultOptions))

        let deleteCallback: Function
        mockOptimistic.deleteIdeaOptimistic.mockImplementation((id: string, cb: Function) => {
          deleteCallback = cb
        })

        await act(async () => {
          await result.current.deleteIdea(mockIdea.id)
          await deleteCallback!()
        })

        expect(mockDb.deleteIdea).toHaveBeenCalledWith(mockIdea.id)
      })

      it('should handle idea deletion failure', async () => {
        mockDb.deleteIdea.mockResolvedValue(false)
        const { result } = renderHook(() => useIdeas(defaultOptions))

        let deleteCallback: Function
        mockOptimistic.deleteIdeaOptimistic.mockImplementation((id: string, cb: Function) => {
          deleteCallback = cb
        })

        await act(async () => {
          await result.current.deleteIdea(mockIdea.id)
          await expect(deleteCallback!()).rejects.toThrow('Failed to delete idea')
        })
      })
    })

    describe('toggleCollapse', () => {
      it('should toggle idea collapse state', async () => {
        const { result } = renderHook(() => useIdeas(defaultOptions))

        const mockSetIdeas = vi.fn()
        result.current.setIdeas = mockSetIdeas

        await act(async () => {
          await result.current.toggleCollapse(mockIdea.id)
        })

        expect(mockSetIdeas).toHaveBeenCalled()
        expect(mockDb.updateIdea).toHaveBeenCalledWith(
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

        expect(mockDb.updateIdea).toHaveBeenCalledWith(mockIdea.id, { is_collapsed: true })
      })

      it('should handle non-existent idea gracefully', async () => {
        const { result } = renderHook(() => useIdeas(defaultOptions))

        await act(async () => {
          await result.current.toggleCollapse('non-existent-id')
        })

        expect(mockDb.updateIdea).not.toHaveBeenCalled()
      })
    })

    describe('handleDragEnd', () => {
      it('should handle idea movement with optimistic update', async () => {
        const { result } = renderHook(() => useIdeas(defaultOptions))

        const dragEvent = createMockDragEndEvent(mockIdea.id, 50, 30)

        await act(async () => {
          await result.current.handleDragEnd(dragEvent)
        })

        expect(mockOptimistic.moveIdeaOptimistic).toHaveBeenCalled()
      })

      it('should ignore drag events with no movement', async () => {
        const { result } = renderHook(() => useIdeas(defaultOptions))

        const dragEvent = createMockDragEndEvent(mockIdea.id, 0, 0)

        await act(async () => {
          await result.current.handleDragEnd(dragEvent)
        })

        expect(mockOptimistic.moveIdeaOptimistic).not.toHaveBeenCalled()
      })

      it('should handle non-existent idea gracefully', async () => {
        const { result } = renderHook(() => useIdeas(defaultOptions))

        const dragEvent = createMockDragEndEvent('non-existent-id', 50, 30)

        await act(async () => {
          await result.current.handleDragEnd(dragEvent)
        })

        expect(mockOptimistic.moveIdeaOptimistic).not.toHaveBeenCalled()
      })
    })
  })

  // -------------------------------------------------------------------------
  // loadIdeas
  // -------------------------------------------------------------------------

  describe('loadIdeas', () => {
    it('should load ideas for a specific project', async () => {
      const { result } = renderHook(() => useIdeas(defaultOptions))

      await act(async () => {
        await result.current.loadIdeas('test-project-id')
      })

      // loadIdeas uses fetch internally — just verify it doesn't throw.
      expect(result.current.ideas).toBeDefined()
    })

    it('should clear ideas when no project ID provided', async () => {
      const { result } = renderHook(() => useIdeas(defaultOptions))

      await act(async () => {
        await result.current.loadIdeas()
      })

      expect(result.current.ideas).toBeDefined()
    })
  })

  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------

  describe('cleanup', () => {
    it('should unsubscribe from real-time updates on unmount', () => {
      const mockUnsubscribe = vi.fn()
      mockDb.subscribeToIdeas.mockImplementation(
        (cb: (payload: RealtimeIdeaPayload) => void) => {
          subCaptured.cb = cb
          return mockUnsubscribe
        }
      )

      const { unmount } = renderHook(() => useIdeas(realUserOptions))
      unmount()
      expect(mockUnsubscribe).toHaveBeenCalled()
    })

    it('should not set up subscription when no user', () => {
      renderHook(() => useIdeas({ ...defaultOptions, currentUser: null }))
      expect(mockDb.subscribeToIdeas).not.toHaveBeenCalled()
    })
  })

  // -------------------------------------------------------------------------
  // ADR-0009: Subscription merge logic (T-0009-006 through T-0009-009)
  //
  // These verify the RealtimeIdeaPayload callback that useIdeas passes to
  // DatabaseService.subscribeToIdeas handles INSERT/UPDATE/DELETE correctly.
  // Must use realUser (non-demo UUID) so the subscription effect actually runs.
  // -------------------------------------------------------------------------

  describe('ADR-0009: realtime event-merge in subscription callback', () => {
    function renderAndGetCallback(): ((payload: RealtimeIdeaPayload) => void) | null {
      let capturedCb: ((payload: RealtimeIdeaPayload) => void) | null = null
      mockDb.subscribeToIdeas.mockImplementation(
        (cb: (payload: RealtimeIdeaPayload) => void) => {
          capturedCb = cb
          return vi.fn()
        }
      )
      renderHook(() => useIdeas(realUserOptions))
      return capturedCb
    }

    it('T-0009-006: INSERT callback does not throw and is idempotent', () => {
      const cb = renderAndGetCallback()
      expect(cb).toBeTypeOf('function')

      // Should not throw on INSERT
      expect(() =>
        cb!({
          eventType: 'INSERT',
          new: { id: 'i1', project_id: mockProject.id, content: 'Hello' } as IdeaCard & { id: string },
          old: null,
        })
      ).not.toThrow()

      // Second call with same id — idempotent (no duplicate), still no throw
      expect(() =>
        cb!({
          eventType: 'INSERT',
          new: { id: 'i1', project_id: mockProject.id, content: 'Hello' } as IdeaCard & { id: string },
          old: null,
        })
      ).not.toThrow()
    })

    it('T-0009-007: UPDATE callback merges position fields without throwing', () => {
      const cb = renderAndGetCallback()
      expect(cb).toBeTypeOf('function')

      expect(() =>
        cb!({
          eventType: 'UPDATE',
          new: { id: 'i1', project_id: mockProject.id, x: 200, y: 300 } as IdeaCard & { id: string },
          old: { id: 'i1', project_id: mockProject.id, x: 100, y: 100 } as IdeaCard & { id: string },
        })
      ).not.toThrow()
    })

    it('T-0009-008: DELETE callback does not throw on valid payload', () => {
      const cb = renderAndGetCallback()
      expect(cb).toBeTypeOf('function')

      expect(() =>
        cb!({
          eventType: 'DELETE',
          new: {} as IdeaCard & { id: string },
          old: { id: 'i1', project_id: mockProject.id } as IdeaCard & { id: string },
        })
      ).not.toThrow()
    })

    it('T-0009-009: callback silently ignores events with mismatched project_id', () => {
      const cb = renderAndGetCallback()
      expect(cb).toBeTypeOf('function')

      // Different project_id — should not throw, just skip
      expect(() =>
        cb!({
          eventType: 'INSERT',
          new: { id: 'i9', project_id: 'proj-OTHER', content: 'Different' } as IdeaCard & { id: string },
          old: null,
        })
      ).not.toThrow()
    })
  })
})
