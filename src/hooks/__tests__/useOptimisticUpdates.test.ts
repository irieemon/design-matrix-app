import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useOptimisticUpdates } from '../useOptimisticUpdates'
import { mockIdea, mockIdeas } from '../../test/utils/test-utils'
import { IdeaCard } from '../../types'

describe('useOptimisticUpdates', () => {
  let baseData: IdeaCard[]
  let setBaseData: vi.Mock
  let onSuccess: vi.Mock
  let onError: vi.Mock
  let onRevert: vi.Mock

  beforeEach(() => {
    vi.useFakeTimers()
    baseData = [...mockIdeas]
    setBaseData = vi.fn()
    onSuccess = vi.fn()
    onError = vi.fn()
    onRevert = vi.fn()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe('initialization', () => {
    it('should initialize with empty pending updates', () => {
      const { result } = renderHook(() =>
        useOptimisticUpdates(baseData, setBaseData)
      )

      const state = result.current.getOptimisticState()
      expect(state.hasPendingUpdates).toBe(false)
      expect(state.pendingCount).toBe(0)
      expect(state.pendingUpdates).toHaveLength(0)
    })

    it('should sync optimistic data with base data on initialization', () => {
      const { result } = renderHook(() =>
        useOptimisticUpdates(baseData, setBaseData)
      )

      expect(result.current.optimisticData).toEqual(baseData)
    })

    it('should update optimistic data when base data changes', () => {
      const { result, rerender } = renderHook(
        ({ data }) => useOptimisticUpdates(data, setBaseData),
        { initialProps: { data: baseData } }
      )

      const newData = [...mockIdeas, { ...mockIdea, id: 'new-id' }]
      rerender({ data: newData })

      expect(result.current.optimisticData).toEqual(newData)
    })
  })

  describe('create operations', () => {
    it('should apply create optimistically', async () => {
      const { result } = renderHook(() =>
        useOptimisticUpdates(baseData, setBaseData, { onSuccess })
      )

      const newIdea = {
        content: 'New Idea',
        details: 'New Details',
        x: 100,
        y: 200,
        priority: 'high' as const,
        project_id: 'test-project'
      }

      const actualCreate = vi.fn().mockResolvedValue({
        ...newIdea,
        id: 'server-id',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })

      let tempId: string
      await act(async () => {
        tempId = result.current.createIdeaOptimistic(newIdea, actualCreate)
      })

      // Should have optimistic data immediately
      expect(result.current.optimisticData).toHaveLength(baseData.length + 1)
      expect(result.current.optimisticData.some(idea => idea.id === tempId!)).toBe(true)

      // Should have pending update
      const state = result.current.getOptimisticState()
      expect(state.hasPendingUpdates).toBe(true)
      expect(state.pendingCount).toBe(1)
    })

    it('should confirm create with server data', async () => {
      const { result } = renderHook(() =>
        useOptimisticUpdates(baseData, setBaseData, { onSuccess })
      )

      const newIdea = {
        content: 'New Idea',
        details: 'New Details',
        x: 100,
        y: 200,
        priority: 'high' as const,
        project_id: 'test-project'
      }

      const serverIdea = {
        ...newIdea,
        id: 'server-id',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      const actualCreate = vi.fn().mockResolvedValue(serverIdea)

      await act(async () => {
        result.current.createIdeaOptimistic(newIdea, actualCreate)
      })

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledWith(expect.any(String), serverIdea)
      })

      // Should update base data with server response
      expect(setBaseData).toHaveBeenCalled()

      // Should clear pending updates
      const state = result.current.getOptimisticState()
      expect(state.hasPendingUpdates).toBe(false)
    })

    it('should revert create on failure', async () => {
      const { result } = renderHook(() =>
        useOptimisticUpdates(baseData, setBaseData, { onError, onRevert })
      )

      const newIdea = {
        content: 'New Idea',
        details: 'New Details',
        x: 100,
        y: 200,
        priority: 'high' as const,
        project_id: 'test-project'
      }

      const error = new Error('Create failed')
      const actualCreate = vi.fn().mockRejectedValue(error)

      await act(async () => {
        result.current.createIdeaOptimistic(newIdea, actualCreate)
      })

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(expect.any(String), error)
      })

      // Should revert optimistic data
      expect(result.current.optimisticData).toHaveLength(baseData.length)
    })

    it('should auto-revert create after timeout', async () => {
      const { result } = renderHook(() =>
        useOptimisticUpdates(baseData, setBaseData, { onRevert })
      )

      const newIdea = {
        content: 'New Idea',
        details: 'New Details',
        x: 100,
        y: 200,
        priority: 'high' as const,
        project_id: 'test-project'
      }

      // Never resolving promise
      const actualCreate = vi.fn().mockImplementation(() => new Promise(() => {}))

      await act(async () => {
        result.current.createIdeaOptimistic(newIdea, actualCreate)
      })

      // Fast-forward past timeout
      act(() => {
        vi.advanceTimersByTime(10000)
      })

      await waitFor(() => {
        expect(onRevert).toHaveBeenCalled()
      })

      // Should revert optimistic data
      expect(result.current.optimisticData).toHaveLength(baseData.length)
    })
  })

  describe('update operations', () => {
    it('should apply update optimistically', async () => {
      const { result } = renderHook(() =>
        useOptimisticUpdates(baseData, setBaseData)
      )

      const updatedIdea = {
        ...mockIdeas[0],
        content: 'Updated Content'
      }

      const actualUpdate = vi.fn().mockResolvedValue(updatedIdea)

      await act(async () => {
        result.current.updateIdeaOptimistic(updatedIdea, actualUpdate)
      })

      // Should update optimistic data immediately
      const updated = result.current.optimisticData.find(i => i.id === mockIdeas[0].id)
      expect(updated?.content).toBe('Updated Content')

      // Should have pending update
      const state = result.current.getOptimisticState()
      expect(state.hasPendingUpdates).toBe(true)
    })

    it('should confirm update with server data', async () => {
      const { result } = renderHook(() =>
        useOptimisticUpdates(baseData, setBaseData, { onSuccess })
      )

      const updatedIdea = {
        ...mockIdeas[0],
        content: 'Updated Content',
        updated_at: new Date().toISOString()
      }

      const actualUpdate = vi.fn().mockResolvedValue(updatedIdea)

      await act(async () => {
        result.current.updateIdeaOptimistic(updatedIdea, actualUpdate)
      })

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled()
      })

      // Should update base data
      expect(setBaseData).toHaveBeenCalled()
    })

    it('should revert update on failure', async () => {
      const { result } = renderHook(() =>
        useOptimisticUpdates(baseData, setBaseData, { onError, onRevert })
      )

      const originalContent = mockIdeas[0].content
      const updatedIdea = {
        ...mockIdeas[0],
        content: 'Updated Content'
      }

      const error = new Error('Update failed')
      const actualUpdate = vi.fn().mockRejectedValue(error)

      await act(async () => {
        result.current.updateIdeaOptimistic(updatedIdea, actualUpdate)
      })

      await waitFor(() => {
        expect(onError).toHaveBeenCalled()
      })

      // Should revert to original content
      const reverted = result.current.optimisticData.find(i => i.id === mockIdeas[0].id)
      expect(reverted?.content).toBe(originalContent)
    })

    it('should return null when updating non-existent idea', async () => {
      const { result } = renderHook(() =>
        useOptimisticUpdates(baseData, setBaseData)
      )

      const nonExistentIdea = {
        ...mockIdea,
        id: 'non-existent-id',
        content: 'Updated'
      }

      const actualUpdate = vi.fn()

      let updateId: string | null
      await act(async () => {
        updateId = result.current.updateIdeaOptimistic(nonExistentIdea, actualUpdate)
      })

      expect(updateId!).toBeNull()
      expect(actualUpdate).not.toHaveBeenCalled()
    })
  })

  describe('delete operations', () => {
    it('should apply delete optimistically', async () => {
      const { result } = renderHook(() =>
        useOptimisticUpdates(baseData, setBaseData)
      )

      const actualDelete = vi.fn().mockResolvedValue(true)

      await act(async () => {
        result.current.deleteIdeaOptimistic(mockIdeas[0].id, actualDelete)
      })

      // Should remove from optimistic data immediately
      expect(result.current.optimisticData).toHaveLength(baseData.length - 1)
      expect(result.current.optimisticData.some(i => i.id === mockIdeas[0].id)).toBe(false)
    })

    it('should confirm delete', async () => {
      const { result } = renderHook(() =>
        useOptimisticUpdates(baseData, setBaseData, { onSuccess })
      )

      const actualDelete = vi.fn().mockResolvedValue(true)

      await act(async () => {
        result.current.deleteIdeaOptimistic(mockIdeas[0].id, actualDelete)
      })

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled()
      })

      // Should update base data
      expect(setBaseData).toHaveBeenCalled()
    })

    it('should revert delete on failure', async () => {
      const { result } = renderHook(() =>
        useOptimisticUpdates(baseData, setBaseData, { onError, onRevert })
      )

      const error = new Error('Delete failed')
      const actualDelete = vi.fn().mockRejectedValue(error)

      await act(async () => {
        result.current.deleteIdeaOptimistic(mockIdeas[0].id, actualDelete)
      })

      await waitFor(() => {
        expect(onError).toHaveBeenCalled()
      })

      // Should restore the idea
      expect(result.current.optimisticData).toHaveLength(baseData.length)
      expect(result.current.optimisticData.some(i => i.id === mockIdeas[0].id)).toBe(true)
    })

    it('should revert delete when server returns false', async () => {
      const { result } = renderHook(() =>
        useOptimisticUpdates(baseData, setBaseData, { onError })
      )

      const actualDelete = vi.fn().mockResolvedValue(false)

      await act(async () => {
        result.current.deleteIdeaOptimistic(mockIdeas[0].id, actualDelete)
      })

      await waitFor(() => {
        expect(onError).toHaveBeenCalled()
      })

      // Should restore the idea
      expect(result.current.optimisticData).toHaveLength(baseData.length)
    })

    it('should return null when deleting non-existent idea', async () => {
      const { result } = renderHook(() =>
        useOptimisticUpdates(baseData, setBaseData)
      )

      const actualDelete = vi.fn()

      let updateId: string | null
      await act(async () => {
        updateId = result.current.deleteIdeaOptimistic('non-existent-id', actualDelete)
      })

      expect(updateId!).toBeNull()
      expect(actualDelete).not.toHaveBeenCalled()
    })
  })

  describe('move operations', () => {
    it('should apply move optimistically', async () => {
      const { result } = renderHook(() =>
        useOptimisticUpdates(baseData, setBaseData)
      )

      const newPosition = { x: 500, y: 600 }
      const actualMove = vi.fn().mockResolvedValue({
        ...mockIdeas[0],
        ...newPosition
      })

      await act(async () => {
        result.current.moveIdeaOptimistic(mockIdeas[0].id, newPosition, actualMove)
      })

      // Should update position immediately
      const moved = result.current.optimisticData.find(i => i.id === mockIdeas[0].id)
      expect(moved?.x).toBe(500)
      expect(moved?.y).toBe(600)
    })

    it('should confirm move with server data', async () => {
      const { result } = renderHook(() =>
        useOptimisticUpdates(baseData, setBaseData, { onSuccess })
      )

      const newPosition = { x: 500, y: 600 }
      const serverResponse = {
        ...mockIdeas[0],
        ...newPosition,
        updated_at: new Date().toISOString()
      }

      const actualMove = vi.fn().mockResolvedValue(serverResponse)

      await act(async () => {
        result.current.moveIdeaOptimistic(mockIdeas[0].id, newPosition, actualMove)
      })

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled()
      })

      // Should update base data
      expect(setBaseData).toHaveBeenCalled()
    })

    it('should revert move on failure', async () => {
      const { result } = renderHook(() =>
        useOptimisticUpdates(baseData, setBaseData, { onError, onRevert })
      )

      const originalX = mockIdeas[0].x
      const originalY = mockIdeas[0].y
      const newPosition = { x: 500, y: 600 }

      const error = new Error('Move failed')
      const actualMove = vi.fn().mockRejectedValue(error)

      await act(async () => {
        result.current.moveIdeaOptimistic(mockIdeas[0].id, newPosition, actualMove)
      })

      await waitFor(() => {
        expect(onError).toHaveBeenCalled()
      })

      // Should revert to original position
      const reverted = result.current.optimisticData.find(i => i.id === mockIdeas[0].id)
      expect(reverted?.x).toBe(originalX)
      expect(reverted?.y).toBe(originalY)
    })

    it('should return null when moving non-existent idea', async () => {
      const { result } = renderHook(() =>
        useOptimisticUpdates(baseData, setBaseData)
      )

      const actualMove = vi.fn()

      let updateId: string | null
      await act(async () => {
        updateId = result.current.moveIdeaOptimistic('non-existent-id', { x: 100, y: 100 }, actualMove)
      })

      expect(updateId!).toBeNull()
      expect(actualMove).not.toHaveBeenCalled()
    })
  })

  describe('manual control', () => {
    it('should manually confirm update', async () => {
      const { result } = renderHook(() =>
        useOptimisticUpdates(baseData, setBaseData, { onSuccess })
      )

      const newIdea = {
        content: 'New',
        details: '',
        x: 0,
        y: 0,
        priority: 'high' as const,
        project_id: 'test'
      }

      const serverIdea = {
        ...newIdea,
        id: 'server-id',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      // Manually control the update
      const actualCreate = vi.fn().mockImplementation(() => new Promise(() => {}))

      let tempId: string
      await act(async () => {
        tempId = result.current.createIdeaOptimistic(newIdea, actualCreate)
      })

      // Manually confirm
      act(() => {
        result.current.confirmUpdate(tempId!, serverIdea)
      })

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled()
      })
    })

    it('should manually revert update', async () => {
      const { result } = renderHook(() =>
        useOptimisticUpdates(baseData, setBaseData, { onRevert })
      )

      const newIdea = {
        content: 'New',
        details: '',
        x: 0,
        y: 0,
        priority: 'high' as const,
        project_id: 'test'
      }

      const actualCreate = vi.fn().mockImplementation(() => new Promise(() => {}))

      let tempId: string
      await act(async () => {
        tempId = result.current.createIdeaOptimistic(newIdea, actualCreate)
      })

      // Manually revert
      act(() => {
        result.current.revertUpdate(tempId!)
      })

      await waitFor(() => {
        expect(onRevert).toHaveBeenCalled()
      })

      // Should remove from optimistic data
      expect(result.current.optimisticData).toHaveLength(baseData.length)
    })
  })

  describe('state management', () => {
    it('should track multiple pending updates', async () => {
      const { result } = renderHook(() =>
        useOptimisticUpdates(baseData, setBaseData)
      )

      const actualOp = vi.fn().mockImplementation(() => new Promise(() => {}))

      // Create multiple pending updates
      await act(async () => {
        result.current.createIdeaOptimistic({
          content: 'New 1',
          details: '',
          x: 0,
          y: 0,
          priority: 'high' as const,
          project_id: 'test'
        }, actualOp)

        result.current.updateIdeaOptimistic({
          ...mockIdeas[0],
          content: 'Updated'
        }, actualOp)
      })

      const state = result.current.getOptimisticState()
      expect(state.pendingCount).toBe(2)
      expect(state.hasPendingUpdates).toBe(true)
      expect(state.pendingUpdates).toHaveLength(2)
    })

    it('should provide correct optimistic state info', () => {
      const { result } = renderHook(() =>
        useOptimisticUpdates(baseData, setBaseData)
      )

      const state = result.current.getOptimisticState()
      expect(state.data).toEqual(baseData)
      expect(state.hasPendingUpdates).toBe(false)
      expect(state.pendingCount).toBe(0)
      expect(Array.isArray(state.pendingUpdates)).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('should handle rapid successive updates', async () => {
      const { result } = renderHook(() =>
        useOptimisticUpdates(baseData, setBaseData)
      )

      const actualUpdate = vi.fn().mockResolvedValue(mockIdeas[0])

      // Rapid updates
      await act(async () => {
        result.current.updateIdeaOptimistic({ ...mockIdeas[0], content: 'Update 1' }, actualUpdate)
        result.current.updateIdeaOptimistic({ ...mockIdeas[0], content: 'Update 2' }, actualUpdate)
        result.current.updateIdeaOptimistic({ ...mockIdeas[0], content: 'Update 3' }, actualUpdate)
      })

      await waitFor(() => {
        expect(actualUpdate).toHaveBeenCalledTimes(3)
      })
    })

    it('should handle empty base data', () => {
      const { result } = renderHook(() =>
        useOptimisticUpdates([], setBaseData)
      )

      expect(result.current.optimisticData).toEqual([])

      const state = result.current.getOptimisticState()
      expect(state.data).toEqual([])
    })

    it('should handle missing callbacks gracefully', async () => {
      const { result } = renderHook(() =>
        useOptimisticUpdates(baseData, setBaseData)
      )

      const actualCreate = vi.fn().mockResolvedValue({ ...mockIdea, id: 'new' })

      await act(async () => {
        result.current.createIdeaOptimistic({
          content: 'New',
          details: '',
          x: 0,
          y: 0,
          priority: 'high' as const,
          project_id: 'test'
        }, actualCreate)
      })

      // Should not throw when callbacks are missing
      await waitFor(() => {
        expect(actualCreate).toHaveBeenCalled()
      })
    })
  })
})