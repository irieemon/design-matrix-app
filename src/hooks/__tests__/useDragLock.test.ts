/**
 * useDragLock — Phase 05.4b Wave 3, Unit 3.1
 *
 * Tests T-054B-200..215 + T-054B-220 (17 tests)
 *
 * Coverage:
 *   - Broadcast handler registration
 *   - acquire / release lifecycle
 *   - Self-echo deduplication (D-29)
 *   - First-broadcast-wins remote lock (D-21b)
 *   - Auto-expire 8s timer (T-054B-211, T-054B-214)
 *   - isLockedByOther predicate
 *   - Forged drag_release from non-owner ignored (T-054B-220)
 *   - Handler re-registration on userId change (T-054B-215)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// ---------------------------------------------------------------------------
// vi.hoisted — shared broadcast handler capture
// ---------------------------------------------------------------------------

type BroadcastHandler = (payload: unknown) => void

const {
  capturedBroadcastHandlers,
  mockSendBroadcast,
  mockOnBroadcast,
  MockManager,
} = vi.hoisted(() => {
  const _handlers = new Map<string, BroadcastHandler>()
  const _send = vi.fn()
  const _onBroadcast = vi.fn((event: string, handler: BroadcastHandler) => {
    _handlers.set(event, handler)
    return () => { _handlers.delete(event) }
  })

  const _MockManager = {
    subscribe: vi.fn().mockResolvedValue(undefined),
    unsubscribe: vi.fn().mockResolvedValue(undefined),
    onBroadcast: _onBroadcast,
    sendBroadcast: _send,
    onPresence: vi.fn(() => () => {}),
    onPostgresChange: vi.fn(() => () => {}),
    onConnectionStateChange: vi.fn(() => () => {}),
    onPollingTick: vi.fn(() => () => {}),
  }

  return {
    capturedBroadcastHandlers: {
      get(event: string) { return _handlers.get(event) },
      reset() { _handlers.clear() },
    },
    mockSendBroadcast: _send,
    mockOnBroadcast: _onBroadcast,
    MockManager: _MockManager,
  }
})

// ---------------------------------------------------------------------------
// Imports after hoisted
// ---------------------------------------------------------------------------

import { useDragLock } from '../useDragLock'
import type { ScopedRealtimeManager } from '../../lib/realtime/ScopedRealtimeManager'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CURRENT_USER_ID = 'user-alice'
const CURRENT_DISPLAY_NAME = 'Alice'
const OTHER_USER_ID = 'user-bob'
const OTHER_DISPLAY_NAME = 'Bob'
const IDEA_ID = 'idea-1'

function makeOptions(overrides?: { currentUserId?: string; displayName?: string }) {
  return {
    manager: MockManager as unknown as ScopedRealtimeManager,
    currentUserId: overrides?.currentUserId ?? CURRENT_USER_ID,
    currentUserDisplayName: overrides?.displayName ?? CURRENT_DISPLAY_NAME,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  capturedBroadcastHandlers.reset()
  // Re-wire after clear so the Map is populated again
  mockOnBroadcast.mockImplementation((event: string, handler: BroadcastHandler) => {
    capturedBroadcastHandlers.get // read-only, registration is tracked via vi.fn
    // We need a fresh closure per call because vi.hoisted Map is shared
    // Delegate to underlying storage
    const key = event
    ;(capturedBroadcastHandlers as any)._map?.set?.(key, handler)
    return () => {}
  })
})

// Re-implement handler capture properly — use a fresh Map per test
let _testHandlers: Map<string, BroadcastHandler>

beforeEach(() => {
  _testHandlers = new Map()
  mockOnBroadcast.mockImplementation((event: string, handler: BroadcastHandler) => {
    _testHandlers.set(event, handler)
    return () => { _testHandlers.delete(event) }
  })
})

afterEach(() => {
  if (vi.isFakeTimers?.()) {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  }
})

function fireLockBroadcast(
  userId: string,
  ideaId: string,
  displayName: string
) {
  const handler = _testHandlers.get('drag_lock')
  handler?.({ userId, ideaId, displayName })
}

function fireReleaseBroadcast(userId: string, ideaId: string) {
  const handler = _testHandlers.get('drag_release')
  handler?.({ userId, ideaId })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useDragLock', () => {
  it('T-054B-200: registers drag_lock broadcast handler', () => {
    renderHook(() => useDragLock(makeOptions()))

    expect(mockOnBroadcast).toHaveBeenCalledWith(
      'drag_lock',
      expect.any(Function)
    )
  })

  it('T-054B-201: registers drag_release broadcast handler', () => {
    renderHook(() => useDragLock(makeOptions()))

    expect(mockOnBroadcast).toHaveBeenCalledWith(
      'drag_release',
      expect.any(Function)
    )
  })

  it('T-054B-202: acquire returns true when no existing lock', () => {
    const { result } = renderHook(() => useDragLock(makeOptions()))

    let returnValue: boolean | undefined
    act(() => {
      returnValue = result.current.acquire(IDEA_ID)
    })

    expect(returnValue).toBe(true)
  })

  it('T-054B-203: acquire calls sendBroadcast with drag_lock', () => {
    const { result } = renderHook(() => useDragLock(makeOptions()))

    act(() => { result.current.acquire(IDEA_ID) })

    expect(mockSendBroadcast).toHaveBeenCalledWith('drag_lock', {
      userId: CURRENT_USER_ID,
      ideaId: IDEA_ID,
      displayName: CURRENT_DISPLAY_NAME,
    })
  })

  it('T-054B-204: acquire stores lock in lockedCards map', () => {
    const { result } = renderHook(() => useDragLock(makeOptions()))

    act(() => { result.current.acquire(IDEA_ID) })

    const entry = result.current.lockedCards.get(IDEA_ID)
    expect(entry).toMatchObject({
      userId: CURRENT_USER_ID,
      displayName: CURRENT_DISPLAY_NAME,
      acquiredAt: expect.any(Number),
    })
  })

  it('T-054B-205: acquire returns false when locked by other user', () => {
    const { result } = renderHook(() => useDragLock(makeOptions()))

    // Simulate remote lock by other user
    act(() => {
      fireLockBroadcast(OTHER_USER_ID, IDEA_ID, OTHER_DISPLAY_NAME)
    })

    let returnValue: boolean | undefined
    act(() => {
      returnValue = result.current.acquire(IDEA_ID)
    })

    expect(returnValue).toBe(false)
    // sendBroadcast should NOT have been called (only called on successful acquire)
    expect(mockSendBroadcast).not.toHaveBeenCalled()
  })

  it('T-054B-206: acquire returns true when self-echo (idempotent)', () => {
    const { result } = renderHook(() => useDragLock(makeOptions()))

    // First acquire (local)
    act(() => { result.current.acquire(IDEA_ID) })
    const callCountAfterFirst = mockSendBroadcast.mock.calls.length

    // Simulate self-echo broadcast arriving
    act(() => {
      fireLockBroadcast(CURRENT_USER_ID, IDEA_ID, CURRENT_DISPLAY_NAME)
    })

    // Second acquire call (idempotent — lock owned by self)
    let returnValue: boolean | undefined
    act(() => {
      returnValue = result.current.acquire(IDEA_ID)
    })

    expect(returnValue).toBe(true)
    // sendBroadcast called only once total (the initial acquire) — idempotent doesn't re-broadcast
    expect(mockSendBroadcast.mock.calls.length).toBe(callCountAfterFirst)
  })

  it('T-054B-207: release removes entry and broadcasts drag_release', () => {
    const { result } = renderHook(() => useDragLock(makeOptions()))

    act(() => { result.current.acquire(IDEA_ID) })
    act(() => { result.current.release(IDEA_ID) })

    expect(result.current.lockedCards.get(IDEA_ID)).toBeUndefined()
    expect(mockSendBroadcast).toHaveBeenCalledWith('drag_release', {
      userId: CURRENT_USER_ID,
      ideaId: IDEA_ID,
    })
  })

  it('T-054B-208: remote drag_lock from other user populates state', () => {
    const { result } = renderHook(() => useDragLock(makeOptions()))

    act(() => {
      fireLockBroadcast(OTHER_USER_ID, 'i2', OTHER_DISPLAY_NAME)
    })

    const entry = result.current.lockedCards.get('i2')
    expect(entry?.userId).toBe(OTHER_USER_ID)
    expect(entry?.displayName).toBe(OTHER_DISPLAY_NAME)
  })

  it('T-054B-209: remote self-echo does NOT overwrite local state', () => {
    const { result } = renderHook(() => useDragLock(makeOptions()))

    // Acquire locally — captures acquiredAt
    act(() => { result.current.acquire(IDEA_ID) })
    const originalEntry = result.current.lockedCards.get(IDEA_ID)
    const originalAcquiredAt = originalEntry?.acquiredAt

    // Self-echo arrives
    act(() => {
      fireLockBroadcast(CURRENT_USER_ID, IDEA_ID, CURRENT_DISPLAY_NAME)
    })

    // acquiredAt must NOT have changed
    const entryAfterEcho = result.current.lockedCards.get(IDEA_ID)
    expect(entryAfterEcho?.acquiredAt).toBe(originalAcquiredAt)
  })

  it('T-054B-210: remote drag_release removes state entry', () => {
    const { result } = renderHook(() => useDragLock(makeOptions()))

    act(() => { fireLockBroadcast(OTHER_USER_ID, IDEA_ID, OTHER_DISPLAY_NAME) })
    act(() => { fireReleaseBroadcast(OTHER_USER_ID, IDEA_ID) })

    expect(result.current.lockedCards.get(IDEA_ID)).toBeUndefined()
  })

  it('T-054B-211: lock auto-expires after 8 seconds', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useDragLock(makeOptions()))

    act(() => { fireLockBroadcast(OTHER_USER_ID, IDEA_ID, OTHER_DISPLAY_NAME) })
    expect(result.current.lockedCards.has(IDEA_ID)).toBe(true)

    act(() => { vi.advanceTimersByTime(8001) })

    expect(result.current.lockedCards.has(IDEA_ID)).toBe(false)
  })

  it('T-054B-212: isLockedByOther true when different userId', () => {
    const { result } = renderHook(() => useDragLock(makeOptions()))

    act(() => { fireLockBroadcast(OTHER_USER_ID, IDEA_ID, OTHER_DISPLAY_NAME) })

    expect(result.current.isLockedByOther(IDEA_ID)).toBe(true)
  })

  it('T-054B-213: isLockedByOther false when self-locked', () => {
    const { result } = renderHook(() => useDragLock(makeOptions()))

    act(() => { result.current.acquire(IDEA_ID) })

    expect(result.current.isLockedByOther(IDEA_ID)).toBe(false)
  })

  it('T-054B-214: explicit release clears auto-expire timer (no leak)', () => {
    vi.useFakeTimers()
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')

    const { result } = renderHook(() => useDragLock(makeOptions()))

    // Remote lock schedules 8s auto-expire
    act(() => { fireLockBroadcast(OTHER_USER_ID, IDEA_ID, OTHER_DISPLAY_NAME) })

    // Explicit release should clear the timer
    act(() => { fireReleaseBroadcast(OTHER_USER_ID, IDEA_ID) })

    expect(clearTimeoutSpy).toHaveBeenCalled()

    // Advance past where auto-expire would have fired
    act(() => { vi.advanceTimersByTime(9000) })

    // lockedCards should still be empty — no stale resurface
    expect(result.current.lockedCards.has(IDEA_ID)).toBe(false)
  })

  it('T-054B-215: handlers re-register on currentUserId change (no stale closure)', () => {
    const { result, rerender } = renderHook(
      (props: { currentUserId: string }) =>
        useDragLock(makeOptions({ currentUserId: props.currentUserId })),
      { initialProps: { currentUserId: 'u1' } }
    )

    // Count registrations before rerender
    const callsBefore = mockOnBroadcast.mock.calls.length

    // Change userId — handlers should re-register
    rerender({ currentUserId: 'u2' })

    // More registrations happened (cleanup + re-register)
    expect(mockOnBroadcast.mock.calls.length).toBeGreaterThan(callsBefore)

    // Now fire a lock from 'u1' — from 'u2' perspective, that's "other"
    act(() => {
      fireLockBroadcast('u1', IDEA_ID, 'UserOne')
    })

    // With new userId 'u2', u1's lock should be treated as "by other"
    expect(result.current.isLockedByOther(IDEA_ID)).toBe(true)
  })

  it('T-054B-220: forged drag_release from non-owner is ignored', () => {
    const { result } = renderHook(() => useDragLock(makeOptions()))

    // Alice locks idea-1
    act(() => { fireLockBroadcast('alice', IDEA_ID, 'Alice') })
    expect(result.current.lockedCards.get(IDEA_ID)?.userId).toBe('alice')

    // Mallory attempts to forge a release
    act(() => { fireReleaseBroadcast('mallory', IDEA_ID) })

    // Lock must remain — mallory is not the owner
    const entry = result.current.lockedCards.get(IDEA_ID)
    expect(entry).toBeDefined()
    expect(entry?.userId).toBe('alice')
  })
})
