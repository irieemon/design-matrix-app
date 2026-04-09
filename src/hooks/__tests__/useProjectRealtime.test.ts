/**
 * useProjectRealtime hook tests — Phase 05.4b Wave 1, Unit 1.3
 *
 * Tests T-054B-010 through T-054B-025 (16 tests).
 *
 * ScopedRealtimeManager is mocked via vi.hoisted so the constructor spy is
 * available both inside the factory and in the test body.
 * IdeaRepository is mocked so the polling-tick test can verify the call.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { IdeaCard } from '../../types'

// ---------------------------------------------------------------------------
// vi.hoisted — shared mutable state available inside vi.mock factories
// ---------------------------------------------------------------------------

type PostgresHandler = (payload: {
  new: Record<string, unknown>
  old: Record<string, unknown> | null
  eventType: string
}) => void
type ConnectionStateHandler = (state: string) => void
type PresenceHandler = (participants: unknown[]) => void
type PollingTickHandler = () => void | Promise<void>

const {
  mockManagerInstance,
  capturedPostgresHandlers,
  capturedConnectionHandler,
  capturedPresenceHandler,
  capturedPollingHandler,
  MockSRM,
  mockGetProjectIdeas,
} = vi.hoisted(() => {
  // Mutable containers — tests read/write these directly.
  let _instance: {
    subscribe: ReturnType<typeof vi.fn>
    unsubscribe: ReturnType<typeof vi.fn>
    onPostgresChange: ReturnType<typeof vi.fn>
    onPresence: ReturnType<typeof vi.fn>
    onConnectionStateChange: ReturnType<typeof vi.fn>
    onPollingTick: ReturnType<typeof vi.fn>
    sendBroadcast: ReturnType<typeof vi.fn>
  } | null = null

  const _handlers = new Map<string, PostgresHandler>()
  let _connectionHandler: ConnectionStateHandler | null = null
  let _presenceHandler: PresenceHandler | null = null
  let _pollingHandler: PollingTickHandler | null = null

  const _mockGetProjectIdeas = vi.fn().mockResolvedValue([])

  const _MockSRM = vi.fn().mockImplementation(() => {
    const inst = {
      subscribe: vi.fn().mockResolvedValue(undefined),
      unsubscribe: vi.fn().mockResolvedValue(undefined),
      onPostgresChange: vi.fn(
        (table: string, filter: { event: string }, handler: PostgresHandler) => {
          _handlers.set(`${table}:${filter.event}`, handler)
        }
      ),
      onPresence: vi.fn((handler: PresenceHandler) => {
        _presenceHandler = handler
      }),
      onConnectionStateChange: vi.fn((handler: ConnectionStateHandler) => {
        _connectionHandler = handler
        return () => {}
      }),
      onPollingTick: vi.fn((handler: PollingTickHandler, _ms: number) => {
        _pollingHandler = handler
        return () => {}
      }),
      sendBroadcast: vi.fn(),
    }
    _instance = inst
    return inst
  })

  return {
    // Accessors — test code reads these to get the current value
    mockManagerInstance: {
      get current() { return _instance },
      reset() { _instance = null },
    },
    capturedPostgresHandlers: {
      get(key: string) { return _handlers.get(key) },
      reset() { _handlers.clear() },
    },
    capturedConnectionHandler: {
      get current() { return _connectionHandler },
      reset() { _connectionHandler = null },
    },
    capturedPresenceHandler: {
      get current() { return _presenceHandler },
      reset() { _presenceHandler = null },
    },
    capturedPollingHandler: {
      get current() { return _pollingHandler },
      reset() { _pollingHandler = null },
    },
    MockSRM: _MockSRM,
    mockGetProjectIdeas: _mockGetProjectIdeas,
  }
})

// ---------------------------------------------------------------------------
// Module mocks — use hoisted values in factories
// ---------------------------------------------------------------------------

vi.mock('../../utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('../../lib/realtime/ScopedRealtimeManager', () => ({
  ScopedRealtimeManager: MockSRM,
}))

vi.mock('../../lib/repositories/ideaRepository', () => ({
  IdeaRepository: {
    getProjectIdeas: (...args: unknown[]) => mockGetProjectIdeas(...args),
  },
}))

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { useProjectRealtime } from '../useProjectRealtime'

// ---------------------------------------------------------------------------
// Default render options
// ---------------------------------------------------------------------------

const defaultSetIdeas = vi.fn() as unknown as React.Dispatch<React.SetStateAction<IdeaCard[]>>

const defaultOpts = {
  projectId: 'proj-1',
  currentUserId: 'user-1',
  currentUserDisplayName: 'Alice',
  setIdeas: defaultSetIdeas,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockManagerInstance.reset()
  capturedPostgresHandlers.reset()
  capturedConnectionHandler.reset()
  capturedPresenceHandler.reset()
  capturedPollingHandler.reset()
  mockGetProjectIdeas.mockResolvedValue([])
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useProjectRealtime', () => {
  it('T-054B-010: instantiates ScopedRealtimeManager with project scope', () => {
    renderHook(() => useProjectRealtime(defaultOpts))
    expect(MockSRM).toHaveBeenCalledOnce()
    expect(MockSRM).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: { type: 'project', id: 'proj-1' },
        userId: 'user-1',
        displayName: 'Alice',
      })
    )
  })

  it('T-054B-011: subscribes on mount', () => {
    renderHook(() => useProjectRealtime(defaultOpts))
    expect(mockManagerInstance.current!.subscribe).toHaveBeenCalledOnce()
  })

  it('T-054B-012: unsubscribes on unmount', () => {
    const { unmount } = renderHook(() => useProjectRealtime(defaultOpts))
    const inst = mockManagerInstance.current!
    unmount()
    expect(inst.unsubscribe).toHaveBeenCalledOnce()
  })

  it('T-054B-013: re-instantiates on projectId change', () => {
    const { rerender } = renderHook(
      ({ projectId }: { projectId: string }) =>
        useProjectRealtime({ ...defaultOpts, projectId }),
      { initialProps: { projectId: 'p1' } }
    )
    const firstInstance = mockManagerInstance.current!
    rerender({ projectId: 'p2' })
    expect(MockSRM).toHaveBeenCalledTimes(2)
    expect(firstInstance.unsubscribe).toHaveBeenCalledOnce()
  })

  it('T-054B-014: registers postgres_changes UPDATE listener for ideas filtered by project', () => {
    renderHook(() => useProjectRealtime(defaultOpts))
    expect(mockManagerInstance.current!.onPostgresChange).toHaveBeenCalledWith(
      'ideas',
      { event: 'UPDATE', filter: 'project_id=eq.proj-1' },
      expect.any(Function)
    )
  })

  it('T-054B-015: registers postgres_changes INSERT listener for ideas', () => {
    renderHook(() => useProjectRealtime(defaultOpts))
    expect(mockManagerInstance.current!.onPostgresChange).toHaveBeenCalledWith(
      'ideas',
      { event: 'INSERT', filter: 'project_id=eq.proj-1' },
      expect.any(Function)
    )
  })

  it('T-054B-016: registers postgres_changes DELETE listener for ideas', () => {
    renderHook(() => useProjectRealtime(defaultOpts))
    expect(mockManagerInstance.current!.onPostgresChange).toHaveBeenCalledWith(
      'ideas',
      { event: 'DELETE', filter: 'project_id=eq.proj-1' },
      expect.any(Function)
    )
  })

  it('T-054B-017: UPDATE handler merges payload into setIdeas (D-34)', () => {
    const setIdeas = vi.fn()
    renderHook(() =>
      useProjectRealtime({
        ...defaultOpts,
        setIdeas: setIdeas as unknown as React.Dispatch<React.SetStateAction<IdeaCard[]>>,
      })
    )

    const handler = capturedPostgresHandlers.get('ideas:UPDATE')
    expect(handler).toBeDefined()

    act(() => {
      handler!({
        new: { id: 'i1', x: 200, y: 300, content: 'Updated' },
        old: { id: 'i1', x: 100, y: 100, content: 'Old' },
        eventType: 'UPDATE',
      })
    })

    expect(setIdeas).toHaveBeenCalledOnce()
    const updater = setIdeas.mock.calls[0][0] as (prev: IdeaCard[]) => IdeaCard[]
    const initial = [{ id: 'i1', x: 0, y: 0, content: 'Old' }] as IdeaCard[]
    const result = updater(initial)
    expect(result).toHaveLength(1)
    expect(result[0].x).toBe(200)
    expect(result[0].y).toBe(300)
  })

  it('T-054B-018: INSERT handler appends idea when not already present', () => {
    const setIdeas = vi.fn()
    renderHook(() =>
      useProjectRealtime({
        ...defaultOpts,
        setIdeas: setIdeas as unknown as React.Dispatch<React.SetStateAction<IdeaCard[]>>,
      })
    )

    const handler = capturedPostgresHandlers.get('ideas:INSERT')
    expect(handler).toBeDefined()

    act(() => {
      handler!({
        new: { id: 'i2', content: 'New idea', x: 50, y: 50 },
        old: null,
        eventType: 'INSERT',
      })
    })

    expect(setIdeas).toHaveBeenCalledOnce()
    const updater = setIdeas.mock.calls[0][0] as (prev: IdeaCard[]) => IdeaCard[]
    const result = updater([] as IdeaCard[])
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('i2')
  })

  it('T-054B-019: INSERT handler is idempotent (no duplicate on re-receive)', () => {
    const setIdeas = vi.fn()
    renderHook(() =>
      useProjectRealtime({
        ...defaultOpts,
        setIdeas: setIdeas as unknown as React.Dispatch<React.SetStateAction<IdeaCard[]>>,
      })
    )

    const handler = capturedPostgresHandlers.get('ideas:INSERT')!
    act(() => {
      handler({
        new: { id: 'i1', content: 'Existing', x: 0, y: 0 },
        old: null,
        eventType: 'INSERT',
      })
    })

    const updater = setIdeas.mock.calls[0][0] as (prev: IdeaCard[]) => IdeaCard[]
    const initial = [{ id: 'i1', content: 'Existing' }] as IdeaCard[]
    const result = updater(initial)
    expect(result).toHaveLength(1)
  })

  it('T-054B-020: DELETE handler removes idea by id', () => {
    const setIdeas = vi.fn()
    renderHook(() =>
      useProjectRealtime({
        ...defaultOpts,
        setIdeas: setIdeas as unknown as React.Dispatch<React.SetStateAction<IdeaCard[]>>,
      })
    )

    const handler = capturedPostgresHandlers.get('ideas:DELETE')!
    act(() => {
      handler({
        new: {} as Record<string, unknown>,
        old: { id: 'i1' },
        eventType: 'DELETE',
      })
    })

    const updater = setIdeas.mock.calls[0][0] as (prev: IdeaCard[]) => IdeaCard[]
    const initial = [{ id: 'i1' }, { id: 'i2' }] as IdeaCard[]
    const result = updater(initial)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('i2')
  })

  it('T-054B-021: connectionState reflects manager onConnectionStateChange', () => {
    const { result } = renderHook(() => useProjectRealtime(defaultOpts))

    expect(result.current.connectionState).toBe('connecting')

    act(() => {
      capturedConnectionHandler.current!('reconnecting')
    })

    expect(result.current.connectionState).toBe('reconnecting')
  })

  it('T-054B-022: previousConnectionState tracks prior state', () => {
    const { result } = renderHook(() => useProjectRealtime(defaultOpts))

    act(() => { capturedConnectionHandler.current!('connecting') })
    act(() => { capturedConnectionHandler.current!('connected') })
    act(() => { capturedConnectionHandler.current!('reconnecting') })

    expect(result.current.connectionState).toBe('reconnecting')
    expect(result.current.previousConnectionState).toBe('connected')
  })

  it('T-054B-023: participants reflect manager onPresence payload', () => {
    const { result } = renderHook(() => useProjectRealtime(defaultOpts))

    act(() => {
      capturedPresenceHandler.current!([
        { userId: 'u1', displayName: 'Alice', joinedAt: 1000, tabId: 't1' },
      ])
    })

    expect(result.current.participants).toHaveLength(1)
    expect(result.current.participants[0].userId).toBe('u1')
  })

  it('T-054B-024: onPollingTick registered with 10000ms interval', () => {
    renderHook(() => useProjectRealtime(defaultOpts))
    expect(mockManagerInstance.current!.onPollingTick).toHaveBeenCalledWith(
      expect.any(Function),
      10000
    )
  })

  it('T-054B-025: polling tick calls IdeaRepository.getProjectIdeas and setIdeas', async () => {
    const setIdeas = vi.fn()
    const ideas = [{ id: 'i1' }] as IdeaCard[]
    mockGetProjectIdeas.mockResolvedValueOnce(ideas)

    renderHook(() =>
      useProjectRealtime({
        ...defaultOpts,
        setIdeas: setIdeas as unknown as React.Dispatch<React.SetStateAction<IdeaCard[]>>,
      })
    )

    await act(async () => {
      await capturedPollingHandler.current!()
    })

    expect(mockGetProjectIdeas).toHaveBeenCalledWith('proj-1')
    expect(setIdeas).toHaveBeenCalledWith(ideas)
  })
})
