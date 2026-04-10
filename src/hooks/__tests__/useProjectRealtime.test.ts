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
          return () => {}
        }
      ),
      onPresence: vi.fn((handler: PresenceHandler) => {
        _presenceHandler = handler
        return () => {}
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

  it('T-054B-014: does NOT register postgres_changes UPDATE listener for ideas (ADR-0009 D-34 removed)', () => {
    renderHook(() => useProjectRealtime(defaultOpts))
    const calls = mockManagerInstance.current!.onPostgresChange.mock.calls
    const ideasUpdateCall = calls.find(
      (c: unknown[]) => c[0] === 'ideas' && (c[1] as { event: string }).event === 'UPDATE'
    )
    expect(ideasUpdateCall).toBeUndefined()
  })

  it('T-054B-015: does NOT register postgres_changes INSERT listener for ideas (ADR-0009 D-34 removed)', () => {
    renderHook(() => useProjectRealtime(defaultOpts))
    const calls = mockManagerInstance.current!.onPostgresChange.mock.calls
    const ideasInsertCall = calls.find(
      (c: unknown[]) => c[0] === 'ideas' && (c[1] as { event: string }).event === 'INSERT'
    )
    expect(ideasInsertCall).toBeUndefined()
  })

  it('T-054B-016: does NOT register postgres_changes DELETE listener for ideas (ADR-0009 D-34 removed)', () => {
    renderHook(() => useProjectRealtime(defaultOpts))
    const calls = mockManagerInstance.current!.onPostgresChange.mock.calls
    const ideasDeleteCall = calls.find(
      (c: unknown[]) => c[0] === 'ideas' && (c[1] as { event: string }).event === 'DELETE'
    )
    expect(ideasDeleteCall).toBeUndefined()
  })

  // T-054B-017 through T-054B-020 removed — merge logic moved to useIdeas per ADR-0009.
  // New merge tests live in useIdeas tests (T-0009-006 through T-0009-009).

  it('T-0009-010: useProjectRealtime does NOT register onPostgresChange for ideas table at all', () => {
    renderHook(() => useProjectRealtime(defaultOpts))
    const calls = mockManagerInstance.current!.onPostgresChange.mock.calls
    const anyIdeasCall = calls.find((c: unknown[]) => c[0] === 'ideas')
    expect(anyIdeasCall).toBeUndefined()
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
