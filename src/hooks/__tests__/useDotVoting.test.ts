/**
 * useDotVoting hook unit tests — Phase 05.4a Wave 2, Unit 3
 *
 * Tests T-054A-050 through T-054A-063 (15 tests).
 *
 * Mocks: voteRepository (all functions) + a stub ScopedRealtimeManager
 * that exposes `emitVoteEvent(payload)` for test-driven postgres_changes injection.
 *
 * Hook contract (frozen per D-01):
 *   { votesUsed, votesRemaining, tallies, myVotes, castVote, removeVote, reconcile, loading, error }
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import React from 'react'

// --------------------------------------------------------------------------
// Module mocks — hoisted before imports
// --------------------------------------------------------------------------

vi.mock('../../lib/repositories/voteRepository', () => ({
  castVote: vi.fn(),
  removeVote: vi.fn(),
  listVotesForSession: vi.fn(),
  reconcileTallies: vi.fn(),
  VoteRepositoryError: class VoteRepositoryError extends Error {
    override readonly name = 'VoteRepositoryError'
    readonly cause: unknown
    constructor(message: string, options?: { cause?: unknown }) {
      super(message)
      this.cause = options?.cause
      Object.setPrototypeOf(this, new.target.prototype)
    }
  },
}))

vi.mock('../../utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

// --------------------------------------------------------------------------
// Imports after mocks
// --------------------------------------------------------------------------

import { useDotVoting } from '../useDotVoting'
import { DotVotingProvider, useDotVotingContext } from '../../contexts/DotVotingContext'
import * as voteRepo from '../../lib/repositories/voteRepository'
import { VoteRepositoryError } from '../../lib/repositories/voteRepository'
import type { ScopedRealtimeManager, PresenceParticipant } from '../../lib/realtime/ScopedRealtimeManager'
import type { ConnectionState } from '../../lib/realtime/ScopedRealtimeManager'

// --------------------------------------------------------------------------
// Stub ScopedRealtimeManager
// Creates a minimal interface-compatible stub with a test helper `emitVoteEvent`
// --------------------------------------------------------------------------

type PostgresPayload = {
  new: Record<string, unknown>
  old: Record<string, unknown> | null
  // Poirot Finding 1: eventType must flow through so handler can use it
  eventType: string
}

interface ManagerStub {
  manager: ScopedRealtimeManager
  emitVoteEvent(payload: PostgresPayload): void
  fireConnectionState(state: ConnectionState): void
  firePollingTick(): void
}

function createManagerStub(): ManagerStub {
  let postgresHandler: ((p: PostgresPayload) => void) | null = null
  const connectionStateHandlers: Set<(s: ConnectionState) => void> = new Set()
  let pollingTickHandler: (() => void) | null = null

  const manager = {
    onPostgresChange: vi.fn((_table: string, _filter: unknown, handler: (p: PostgresPayload) => void) => {
      postgresHandler = handler
      return () => {}
    }),
    onBroadcast: vi.fn(),
    onPresence: vi.fn(),
    onConnectionStateChange: vi.fn((handler: (s: ConnectionState) => void) => {
      connectionStateHandlers.add(handler)
      return () => connectionStateHandlers.delete(handler)
    }),
    onPollingTick: vi.fn((handler: () => void) => {
      pollingTickHandler = handler
      return () => { pollingTickHandler = null }
    }),
    sendBroadcast: vi.fn(),
    subscribe: vi.fn().mockResolvedValue(undefined),
    unsubscribe: vi.fn().mockResolvedValue(undefined),
    isSubscribed: vi.fn().mockReturnValue(true),
    getConnectionState: vi.fn().mockReturnValue('connected' as ConnectionState),
    // Presence-related (not used by useDotVoting directly)
    track: vi.fn(),
  } as unknown as ScopedRealtimeManager

  return {
    manager,
    emitVoteEvent(payload) {
      postgresHandler?.(payload)
    },
    fireConnectionState(state) {
      for (const h of connectionStateHandlers) h(state)
    },
    firePollingTick() {
      pollingTickHandler?.()
    },
  }
}

// --------------------------------------------------------------------------
// Typed mock helpers
// --------------------------------------------------------------------------

const mockCastVote = voteRepo.castVote as ReturnType<typeof vi.fn>
const mockRemoveVote = voteRepo.removeVote as ReturnType<typeof vi.fn>
const mockListVotes = voteRepo.listVotesForSession as ReturnType<typeof vi.fn>
const mockReconcile = voteRepo.reconcileTallies as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
  // Sensible defaults
  mockReconcile.mockResolvedValue(new Map())
  mockListVotes.mockResolvedValue([])
  mockCastVote.mockResolvedValue({ ok: true })
  mockRemoveVote.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.useRealTimers()
})

// --------------------------------------------------------------------------
// T-054A-050: Initial reconcile populates tallies and myVotes
// --------------------------------------------------------------------------
describe('T-054A-050: initial reconcile populates tallies and myVotes', () => {
  it('populates tallies from reconcileTallies and myVotes from listVotesForSession', async () => {
    mockReconcile.mockResolvedValue(new Map([['a', 2], ['b', 1]]))
    mockListVotes.mockResolvedValue([{ user_id: 'u1', idea_id: 'a' }])

    const { stub } = (() => {
      const stub = createManagerStub()
      return { stub }
    })()

    const { result } = renderHook(() =>
      useDotVoting('session-1', 'u1', stub.manager)
    )

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.tallies.get('a')).toBe(2)
    expect(result.current.tallies.get('b')).toBe(1)
    expect(result.current.myVotes.has('a')).toBe(true)
    expect(result.current.votesUsed).toBe(1)
  })
})

// --------------------------------------------------------------------------
// T-054A-051: castVote optimistic increment fires synchronously
// --------------------------------------------------------------------------
describe('T-054A-051: castVote optimistic increment', () => {
  it('increments votesUsed and tallies synchronously before repo resolves', async () => {
    mockReconcile.mockResolvedValue(new Map([['a', 0]]))
    mockListVotes.mockResolvedValue([])

    // Repo resolves after 50ms
    let resolveVote!: () => void
    mockCastVote.mockReturnValue(
      new Promise<{ ok: true }>((res) => { resolveVote = () => res({ ok: true }) })
    )

    const stub = createManagerStub()
    const { result } = renderHook(() => useDotVoting('session-1', 'u1', stub.manager))

    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      void result.current.castVote('a')
    })

    // Synchronous optimistic state — no await needed
    expect(result.current.votesUsed).toBe(1)
    expect(result.current.myVotes.has('a')).toBe(true)

    // Resolve the repo call to avoid unresolved promise warnings
    resolveVote()
  })
})

// --------------------------------------------------------------------------
// T-054A-052: castVote rollback on budget_exceeded
// --------------------------------------------------------------------------
describe('T-054A-052: castVote rollback on budget_exceeded', () => {
  it('rolls back votesUsed and sets error copy on budget_exceeded', async () => {
    mockReconcile.mockResolvedValue(new Map([['a', 4]]))
    mockListVotes.mockResolvedValue([
      { user_id: 'u1', idea_id: 'i1' },
      { user_id: 'u1', idea_id: 'i2' },
      { user_id: 'u1', idea_id: 'i3' },
      { user_id: 'u1', idea_id: 'i4' },
    ])
    mockCastVote.mockResolvedValue({ ok: false, reason: 'budget_exceeded' })

    const stub = createManagerStub()
    const { result } = renderHook(() => useDotVoting('session-1', 'u1', stub.manager))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.votesUsed).toBe(4)

    await act(async () => {
      await result.current.castVote('a')
    })

    expect(result.current.votesUsed).toBe(4)
    expect(result.current.error).toBe("You've used all 5 votes. Remove one to cast another.")
  })
})

// --------------------------------------------------------------------------
// T-054A-053: castVote rollback on unknown error
// --------------------------------------------------------------------------
describe('T-054A-053: castVote rollback on unknown error', () => {
  it('rolls back and sets "Couldn\'t save your vote" error copy', async () => {
    mockReconcile.mockResolvedValue(new Map())
    mockListVotes.mockResolvedValue([])
    mockCastVote.mockResolvedValue({ ok: false, reason: 'unknown' })

    const stub = createManagerStub()
    const { result } = renderHook(() => useDotVoting('session-1', 'u1', stub.manager))

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.castVote('a')
    })

    expect(result.current.votesUsed).toBe(0)
    expect(result.current.error).toBe("Couldn't save your vote. Check your connection and try again.")
  })
})

// --------------------------------------------------------------------------
// T-054A-054: castVote blocked at 5/5 without repo call
// --------------------------------------------------------------------------
describe('T-054A-054: castVote blocked at budget 5/5', () => {
  it('does not call repository and sets error synchronously when votesRemaining === 0', async () => {
    mockReconcile.mockResolvedValue(new Map())
    mockListVotes.mockResolvedValue([
      { user_id: 'u1', idea_id: 'i1' },
      { user_id: 'u1', idea_id: 'i2' },
      { user_id: 'u1', idea_id: 'i3' },
      { user_id: 'u1', idea_id: 'i4' },
      { user_id: 'u1', idea_id: 'i5' },
    ])

    const stub = createManagerStub()
    const { result } = renderHook(() => useDotVoting('session-1', 'u1', stub.manager))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.votesUsed).toBe(5)

    await act(async () => {
      await result.current.castVote('new-idea')
    })

    expect(mockCastVote).not.toHaveBeenCalled()
    expect(result.current.error).toBe("You've used all 5 votes. Remove one to cast another.")
  })
})

// --------------------------------------------------------------------------
// T-054A-054b: concurrent castVote race blocks the 6th optimistic vote
// --------------------------------------------------------------------------
describe('T-054A-054b: concurrent castVote race protection', () => {
  it('second concurrent castVote is blocked when first already consumed the last dot', async () => {
    mockReconcile.mockResolvedValue(new Map())
    mockListVotes.mockResolvedValue([
      { user_id: 'u1', idea_id: 'i1' },
      { user_id: 'u1', idea_id: 'i2' },
      { user_id: 'u1', idea_id: 'i3' },
      { user_id: 'u1', idea_id: 'i4' },
    ])

    // Make castVote slow so both calls race
    let resolveA!: () => void
    let resolveB!: () => void
    mockCastVote
      .mockReturnValueOnce(new Promise<{ ok: true }>((r) => { resolveA = () => r({ ok: true }) }))
      .mockReturnValueOnce(new Promise<{ ok: true }>((r) => { resolveB = () => r({ ok: true }) }))

    const stub = createManagerStub()
    const { result } = renderHook(() => useDotVoting('session-1', 'u1', stub.manager))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.votesUsed).toBe(4)

    // Fire both concurrently in the same act — optimistic state must gate the second
    act(() => {
      void result.current.castVote('a')
      void result.current.castVote('b')
    })

    // First call consumed the last dot → second should see votesRemaining === 0
    // castVote repo should only be called once (for 'a')
    expect(mockCastVote).toHaveBeenCalledTimes(1)
    expect(result.current.votesUsed).toBe(5)
    expect(result.current.error).toBe("You've used all 5 votes. Remove one to cast another.")

    resolveA()
    resolveB()
  })
})

// --------------------------------------------------------------------------
// T-054A-055: removeVote optimistic decrement
// --------------------------------------------------------------------------
describe('T-054A-055: removeVote optimistic decrement', () => {
  it('decrements votesUsed and removes from myVotes synchronously', async () => {
    mockReconcile.mockResolvedValue(new Map([['a', 2]]))
    mockListVotes.mockResolvedValue([
      { user_id: 'u1', idea_id: 'a' },
      { user_id: 'u1', idea_id: 'b' },
    ])

    let resolveRemove!: () => void
    mockRemoveVote.mockReturnValue(
      new Promise<void>((r) => { resolveRemove = () => r() })
    )

    const stub = createManagerStub()
    const { result } = renderHook(() => useDotVoting('session-1', 'u1', stub.manager))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.votesUsed).toBe(2)

    act(() => {
      void result.current.removeVote('a')
    })

    // Synchronous optimistic decrement
    expect(result.current.votesUsed).toBe(1)
    expect(result.current.myVotes.has('a')).toBe(false)

    resolveRemove()
  })
})

// --------------------------------------------------------------------------
// T-054A-056: removeVote rollback on VoteRepositoryError throw
// --------------------------------------------------------------------------
describe('T-054A-056: removeVote rollback on throw', () => {
  it('restores state and sets error copy when removeVote throws VoteRepositoryError', async () => {
    mockReconcile.mockResolvedValue(new Map([['a', 1]]))
    mockListVotes.mockResolvedValue([{ user_id: 'u1', idea_id: 'a' }])
    mockRemoveVote.mockRejectedValue(new VoteRepositoryError('removeVote failed'))

    const stub = createManagerStub()
    const { result } = renderHook(() => useDotVoting('session-1', 'u1', stub.manager))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.votesUsed).toBe(1)

    await act(async () => {
      await result.current.removeVote('a')
    })

    // Rolled back
    expect(result.current.votesUsed).toBe(1)
    expect(result.current.myVotes.has('a')).toBe(true)
    expect(result.current.error).toBe("Couldn't remove your vote. Try again.")
  })
})

// --------------------------------------------------------------------------
// T-054A-057: remote INSERT by other user increments tally but not myVotes
// --------------------------------------------------------------------------
describe('T-054A-057: remote INSERT by other user', () => {
  it('increments tallies[ideaId] but does not touch myVotes or votesUsed', async () => {
    mockReconcile.mockResolvedValue(new Map())
    mockListVotes.mockResolvedValue([])

    const stub = createManagerStub()
    const { result } = renderHook(() => useDotVoting('session-1', 'u1', stub.manager))

    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      stub.emitVoteEvent({
        new: { user_id: 'u2', idea_id: 'x', session_id: 'session-1' },
        old: null,
        eventType: 'INSERT',
      })
    })

    expect(result.current.tallies.get('x')).toBe(1)
    expect(result.current.myVotes.has('x')).toBe(false)
    expect(result.current.votesUsed).toBe(0)
  })
})

// --------------------------------------------------------------------------
// T-054A-058: remote INSERT by self is deduped when myVotes already has ideaId
// --------------------------------------------------------------------------
describe('T-054A-058: remote INSERT by self deduped', () => {
  it('does not double-count when own INSERT arrives after optimistic update', async () => {
    mockReconcile.mockResolvedValue(new Map())
    mockListVotes.mockResolvedValue([])
    mockCastVote.mockResolvedValue({ ok: true })

    const stub = createManagerStub()
    const { result } = renderHook(() => useDotVoting('session-1', 'u1', stub.manager))

    await waitFor(() => expect(result.current.loading).toBe(false))

    // Optimistically cast vote for 'a'
    await act(async () => {
      await result.current.castVote('a')
    })

    expect(result.current.votesUsed).toBe(1)
    expect(result.current.tallies.get('a')).toBe(1)

    // Now remote INSERT arrives for same user + idea (own round-trip)
    act(() => {
      stub.emitVoteEvent({
        new: { user_id: 'u1', idea_id: 'a', session_id: 'session-1' },
        old: null,
        eventType: 'INSERT',
      })
    })

    // Must NOT double-count
    expect(result.current.votesUsed).toBe(1)
    expect(result.current.tallies.get('a')).toBe(1)
  })
})

// --------------------------------------------------------------------------
// T-054A-059: remote DELETE decrements tally
// --------------------------------------------------------------------------
describe('T-054A-059: remote DELETE decrements tally', () => {
  it('decrements tallies[ideaId] on incoming DELETE event', async () => {
    mockReconcile.mockResolvedValue(new Map([['a', 2]]))
    mockListVotes.mockResolvedValue([])

    const stub = createManagerStub()
    const { result } = renderHook(() => useDotVoting('session-1', 'u1', stub.manager))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.tallies.get('a')).toBe(2)

    act(() => {
      stub.emitVoteEvent({
        new: {},
        old: { user_id: 'u2', idea_id: 'a', session_id: 'session-1' },
        eventType: 'DELETE',
      })
    })

    expect(result.current.tallies.get('a')).toBe(1)
  })
})

// --------------------------------------------------------------------------
// T-054A-060: error auto-dismisses after 4000ms
// --------------------------------------------------------------------------
describe('T-054A-060: error auto-dismisses after 4000ms', () => {
  it('clears error === null after 4001ms via fake timers', async () => {
    // Use real timers for initial reconcile to avoid waitFor deadlock,
    // then switch to fake timers to control the 4s dismiss window.
    mockReconcile.mockResolvedValue(new Map())
    mockListVotes.mockResolvedValue([])
    mockCastVote.mockResolvedValue({ ok: false, reason: 'unknown' })

    const stub = createManagerStub()
    const { result } = renderHook(() => useDotVoting('session-1', 'u1', stub.manager))

    // Wait for initial reconcile with real timers
    await waitFor(() => expect(result.current.loading).toBe(false))

    // Now switch to fake timers to control the dismiss setTimeout
    vi.useFakeTimers()

    await act(async () => {
      await result.current.castVote('a')
    })

    expect(result.current.error).not.toBeNull()

    act(() => {
      vi.advanceTimersByTime(4001)
    })

    expect(result.current.error).toBeNull()
  })
})

// --------------------------------------------------------------------------
// T-054A-061: reconcile() re-fetches tallies
// --------------------------------------------------------------------------
describe('T-054A-061: reconcile re-fetches tallies', () => {
  it('calls reconcileTallies again when reconcile() is called', async () => {
    mockReconcile
      .mockResolvedValueOnce(new Map([['a', 1]]))
      .mockResolvedValueOnce(new Map([['a', 3]]))
    mockListVotes.mockResolvedValue([])

    const stub = createManagerStub()
    const { result } = renderHook(() => useDotVoting('session-1', 'u1', stub.manager))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.tallies.get('a')).toBe(1)

    await act(async () => {
      await result.current.reconcile()
    })

    expect(mockReconcile).toHaveBeenCalledTimes(2)
    expect(result.current.tallies.get('a')).toBe(3)
  })
})

// --------------------------------------------------------------------------
// T-054A-062: reconnecting → connected triggers reconcile
// --------------------------------------------------------------------------
describe('T-054A-062: reconnect triggers reconcile', () => {
  it('calls reconcileTallies again when connection transitions reconnecting → connected', async () => {
    mockReconcile
      .mockResolvedValueOnce(new Map([['a', 1]]))
      .mockResolvedValueOnce(new Map([['a', 5]]))
    mockListVotes.mockResolvedValue([])

    const stub = createManagerStub()
    const { result } = renderHook(() => useDotVoting('session-1', 'u1', stub.manager))

    await waitFor(() => expect(result.current.loading).toBe(false))

    // Simulate reconnect sequence
    act(() => {
      stub.fireConnectionState('reconnecting')
    })
    await act(async () => {
      stub.fireConnectionState('connected')
      await Promise.resolve() // flush microtasks
    })

    await waitFor(() => expect(mockReconcile).toHaveBeenCalledTimes(2))
    expect(result.current.tallies.get('a')).toBe(5)
  })
})

// --------------------------------------------------------------------------
// T-054A-062b: polling tick triggers reconcile when manager degrades to polling
// --------------------------------------------------------------------------
describe('T-054A-062b: polling tick triggers reconcile', () => {
  it('calls reconcileTallies when onPollingTick fires after manager degrades to polling state', async () => {
    mockReconcile
      .mockResolvedValueOnce(new Map([['a', 1]]))
      .mockResolvedValueOnce(new Map([['a', 7]]))
    mockListVotes.mockResolvedValue([])

    const stub = createManagerStub()
    const { result } = renderHook(() => useDotVoting('session-1', 'u1', stub.manager))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(mockReconcile).toHaveBeenCalledTimes(1)

    // Simulate polling tick (manager has degraded to polling after 5 failed reconnects)
    await act(async () => {
      stub.firePollingTick()
      await Promise.resolve()
    })

    await waitFor(() => expect(mockReconcile).toHaveBeenCalledTimes(2))
    expect(result.current.tallies.get('a')).toBe(7)
  })
})

// --------------------------------------------------------------------------
// T-054A-063: DotVotingProvider context delivers hook state
// --------------------------------------------------------------------------
describe('T-054A-063: DotVotingProvider context delivers hook state', () => {
  it('useDotVotingContext returns useDotVoting return value inside provider', async () => {
    mockReconcile.mockResolvedValue(new Map([['idea-1', 3]]))
    mockListVotes.mockResolvedValue([])

    const stub = createManagerStub()

    function Wrapper({ children }: { children: React.ReactNode }) {
      return React.createElement(
        DotVotingProvider,
        { sessionId: 'session-1', currentUserId: 'u1', manager: stub.manager },
        children
      )
    }

    function Consumer() {
      const ctx = useDotVotingContext()
      return React.createElement('div', {
        'data-testid': 'tally',
        'data-value': ctx.tallies.get('idea-1') ?? 0,
      })
    }

    const { result } = renderHook(() => useDotVotingContext(), {
      wrapper: ({ children }) =>
        React.createElement(
          DotVotingProvider,
          { sessionId: 'session-1', currentUserId: 'u1', manager: stub.manager },
          children
        ),
    })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.tallies.get('idea-1')).toBe(3)
    expect(typeof result.current.castVote).toBe('function')
    expect(typeof result.current.removeVote).toBe('function')
    void Consumer
  })
})

// --------------------------------------------------------------------------
// T-054A-055b: two rapid removeVote calls produce correct final state
// Poirot Finding 3: removeVote must sync votesUsedRef immediately so the
// second concurrent call sees the already-decremented value.
// --------------------------------------------------------------------------
describe('T-054A-055b: two rapid removeVotes produce correct final state', () => {
  it('final votesUsed is 0 after two rapid removeVote calls from votesUsed=2', async () => {
    mockReconcile.mockResolvedValue(new Map([['a', 2], ['b', 1]]))
    mockListVotes.mockResolvedValue([
      { user_id: 'u1', idea_id: 'a' },
      { user_id: 'u1', idea_id: 'b' },
    ])

    let resolveA!: () => void
    let resolveB!: () => void
    mockRemoveVote
      .mockReturnValueOnce(new Promise<void>((r) => { resolveA = () => r() }))
      .mockReturnValueOnce(new Promise<void>((r) => { resolveB = () => r() }))

    const stub = createManagerStub()
    const { result } = renderHook(() => useDotVoting('session-1', 'u1', stub.manager))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.votesUsed).toBe(2)

    // Fire both concurrently in the same act — ref must track decrements
    act(() => {
      void result.current.removeVote('a')
      void result.current.removeVote('b')
    })

    // Both optimistic decrements applied: 2 → 1 → 0
    expect(result.current.votesUsed).toBe(0)
    expect(result.current.myVotes.has('a')).toBe(false)
    expect(result.current.myVotes.has('b')).toBe(false)

    resolveA()
    resolveB()
  })
})

// --------------------------------------------------------------------------
// T-054A-057b: UPDATE event does NOT decrement tally
// Poirot Finding 1: old heuristic would misroute UPDATE events as DELETE.
// The eventType-based classifier must ignore UPDATE entirely.
// --------------------------------------------------------------------------
describe('T-054A-057b: UPDATE event does NOT decrement tally', () => {
  it('emitting an UPDATE event leaves tallies unchanged', async () => {
    mockReconcile.mockResolvedValue(new Map([['a', 3]]))
    mockListVotes.mockResolvedValue([])

    const stub = createManagerStub()
    const { result } = renderHook(() => useDotVoting('session-1', 'u1', stub.manager))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.tallies.get('a')).toBe(3)

    act(() => {
      // UPDATE event — old heuristic would have treated this as DELETE
      stub.emitVoteEvent({
        new: { user_id: 'u2', idea_id: 'a', session_id: 'session-1' },
        old: { user_id: 'u2', idea_id: 'a', session_id: 'session-1' },
        eventType: 'UPDATE',
      })
    })

    // Tally must be unchanged — UPDATE events are not insert or delete
    expect(result.current.tallies.get('a')).toBe(3)
    expect(result.current.votesUsed).toBe(0)
  })
})
