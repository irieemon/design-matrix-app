/**
 * useLiveCursors hook unit tests — Phase 05.4b Wave 2, Unit 2.2
 *
 * Tests T-054B-110 through T-054B-123 (14 tests).
 *
 * ScopedRealtimeManager is mocked. The hook is exercised via renderHook.
 * Fake timers drive inactivity timer tests.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { userIdToHsl } from '../../utils/userColor'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

// Stable mock for cursorThrottle — returns the fn directly (no throttling in tests)
// so broadcasts fire synchronously on every pointermove.
// Declared via vi.hoisted so it is available before vi.mock factory runs.
const { mockThrottleByFrameInterval } = vi.hoisted(() => ({
  mockThrottleByFrameInterval: vi.fn((fn: (arg: unknown) => void, _ms: number) => fn),
}))
vi.mock('../../utils/cursorThrottle', () => ({
  throttleByFrameInterval: mockThrottleByFrameInterval,
}))

type BroadcastHandler = (payload: unknown) => void

const {
  capturedBroadcastHandlers,
  mockManagerInstance,
  MockSRM,
} = vi.hoisted(() => {
  const _broadcastHandlers = new Map<string, BroadcastHandler>()
  let _instance: {
    onBroadcast: ReturnType<typeof vi.fn>
    sendBroadcast: ReturnType<typeof vi.fn>
    subscribe: ReturnType<typeof vi.fn>
    unsubscribe: ReturnType<typeof vi.fn>
  } | null = null

  const _MockSRM = vi.fn().mockImplementation(() => {
    const inst = {
      subscribe: vi.fn().mockResolvedValue(undefined),
      unsubscribe: vi.fn().mockResolvedValue(undefined),
      onBroadcast: vi.fn((event: string, handler: BroadcastHandler) => {
        _broadcastHandlers.set(event, handler)
        return () => { _broadcastHandlers.delete(event) }
      }),
      sendBroadcast: vi.fn(),
    }
    _instance = inst
    return inst
  })

  return {
    capturedBroadcastHandlers: {
      get(event: string) { return _broadcastHandlers.get(event) },
      reset() { _broadcastHandlers.clear() },
    },
    mockManagerInstance: {
      get current() { return _instance },
      reset() { _instance = null },
    },
    MockSRM: _MockSRM,
  }
})

vi.mock('../../lib/realtime/ScopedRealtimeManager', () => ({
  ScopedRealtimeManager: MockSRM,
}))

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { useLiveCursors } from '../useLiveCursors'
import type { ScopedRealtimeManager } from '../../lib/realtime/ScopedRealtimeManager'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CURRENT_USER_ID = 'current-user'

function makeManager(): ScopedRealtimeManager {
  return new MockSRM() as unknown as ScopedRealtimeManager
}

/** Dispatch a synthetic pointermove on an element with a given bounding rect. */
function dispatchPointerMove(
  el: HTMLElement,
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number }
) {
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
    right: rect.left + rect.width,
    bottom: rect.top + rect.height,
    x: rect.left,
    y: rect.top,
    toJSON: () => ({}),
  } as DOMRect)
  el.dispatchEvent(
    new MouseEvent('pointermove', {
      bubbles: true,
      clientX,
      clientY,
    })
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  capturedBroadcastHandlers.reset()
  mockManagerInstance.reset()
  MockSRM.mockClear()
  vi.useRealTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useLiveCursors', () => {
  it('T-054B-110: registers cursor_move broadcast handler on mount', () => {
    const manager = makeManager()
    renderHook(() => useLiveCursors({ manager, currentUserId: CURRENT_USER_ID, currentUserDisplayName: 'Me' }))

    expect(mockManagerInstance.current!.onBroadcast).toHaveBeenCalledWith(
      'cursor_move',
      expect.any(Function)
    )
  })

  it('T-054B-111: cursors map updates on remote broadcast', () => {
    const manager = makeManager()
    const { result } = renderHook(() =>
      useLiveCursors({ manager, currentUserId: CURRENT_USER_ID, currentUserDisplayName: 'Me' })
    )

    act(() => {
      capturedBroadcastHandlers.get('cursor_move')?.({
        userId: 'u1',
        x: 50,
        y: 50,
        displayName: 'Alice',
      })
    })

    const cursor = result.current.cursors.get('u1')
    expect(cursor).toBeDefined()
    expect(cursor!.x).toBe(50)
    expect(cursor!.y).toBe(50)
    expect(cursor!.displayName).toBe('Alice')
  })

  it('T-054B-112: own broadcast is filtered (self excluded)', () => {
    const manager = makeManager()
    const { result } = renderHook(() =>
      useLiveCursors({ manager, currentUserId: CURRENT_USER_ID, currentUserDisplayName: 'Me' })
    )

    act(() => {
      capturedBroadcastHandlers.get('cursor_move')?.({
        userId: CURRENT_USER_ID,
        x: 10,
        y: 20,
        displayName: 'Me',
      })
    })

    expect(result.current.cursors.get(CURRENT_USER_ID)).toBeUndefined()
  })

  it('T-054B-113: color is computed via userIdToHsl', () => {
    const manager = makeManager()
    const { result } = renderHook(() =>
      useLiveCursors({ manager, currentUserId: CURRENT_USER_ID, currentUserDisplayName: 'Me' })
    )

    const userId = 'u-color-test'
    act(() => {
      capturedBroadcastHandlers.get('cursor_move')?.({
        userId,
        x: 10,
        y: 20,
        displayName: 'ColorUser',
      })
    })

    expect(result.current.cursors.get(userId)!.color).toBe(userIdToHsl(userId))
  })

  it('T-054B-114: attachPointerTracking wires pointermove listener', () => {
    const manager = makeManager()
    const { result } = renderHook(() =>
      useLiveCursors({ manager, currentUserId: CURRENT_USER_ID, currentUserDisplayName: 'Me' })
    )

    const el = document.createElement('div')

    act(() => {
      result.current.attachPointerTracking(el)
    })

    dispatchPointerMove(el, 200, 100, { left: 0, top: 0, width: 400, height: 400 })

    expect(mockManagerInstance.current!.sendBroadcast).toHaveBeenCalledWith(
      'cursor_move',
      expect.any(Object)
    )
  })

  it('T-054B-115: broadcast coordinates are logical % of container', () => {
    const manager = makeManager()
    const { result } = renderHook(() =>
      useLiveCursors({ manager, currentUserId: CURRENT_USER_ID, currentUserDisplayName: 'Me' })
    )

    const el = document.createElement('div')

    act(() => {
      result.current.attachPointerTracking(el)
    })

    // Element rect: 400×400 starting at (0,0)
    // Pointer at clientX=200, clientY=100 → x=50%, y=25%
    dispatchPointerMove(el, 200, 100, { left: 0, top: 0, width: 400, height: 400 })

    const call = (mockManagerInstance.current!.sendBroadcast as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(call[0]).toBe('cursor_move')
    expect(call[1].x).toBe(50)
    expect(call[1].y).toBe(25)
  })

  it('T-054B-116: broadcasts are throttled to 50ms', () => {
    mockThrottleByFrameInterval.mockClear()

    const manager = makeManager()
    const { result } = renderHook(() =>
      useLiveCursors({ manager, currentUserId: CURRENT_USER_ID, currentUserDisplayName: 'Me' })
    )

    // attachPointerTracking is where throttleByFrameInterval is called — must invoke it.
    const el = document.createElement('div')
    act(() => { result.current.attachPointerTracking(el) })

    // Verify the hook wires throttleByFrameInterval with the correct 50ms interval.
    // Real throttle behavior is exercised in cursorThrottle.test.ts.
    expect(mockThrottleByFrameInterval).toHaveBeenCalledWith(expect.any(Function), 50)
  })

  it('T-054B-117: pauseBroadcast prevents sendBroadcast', () => {
    const manager = makeManager()
    const { result } = renderHook(() =>
      useLiveCursors({ manager, currentUserId: CURRENT_USER_ID, currentUserDisplayName: 'Me' })
    )

    const el = document.createElement('div')
    act(() => {
      result.current.attachPointerTracking(el)
      result.current.pauseBroadcast()
    })

    dispatchPointerMove(el, 100, 100, { left: 0, top: 0, width: 400, height: 400 })

    expect(mockManagerInstance.current!.sendBroadcast).not.toHaveBeenCalled()
  })

  it('T-054B-118: resumeBroadcast re-enables after pause', () => {
    const manager = makeManager()
    const { result } = renderHook(() =>
      useLiveCursors({ manager, currentUserId: CURRENT_USER_ID, currentUserDisplayName: 'Me' })
    )

    const el = document.createElement('div')
    act(() => {
      result.current.attachPointerTracking(el)
      result.current.pauseBroadcast()
      result.current.resumeBroadcast()
    })

    dispatchPointerMove(el, 100, 100, { left: 0, top: 0, width: 400, height: 400 })

    expect(mockManagerInstance.current!.sendBroadcast).toHaveBeenCalledOnce()
  })

  it('T-054B-119: cursor fades out after 5s of inactivity', () => {
    vi.useFakeTimers()

    const manager = makeManager()
    const { result } = renderHook(() =>
      useLiveCursors({ manager, currentUserId: CURRENT_USER_ID, currentUserDisplayName: 'Me' })
    )

    act(() => {
      capturedBroadcastHandlers.get('cursor_move')?.({
        userId: 'u1',
        x: 10,
        y: 20,
        displayName: 'Alice',
      })
    })

    expect(result.current.cursors.get('u1')).toBeDefined()

    act(() => {
      vi.advanceTimersByTime(5001)
    })

    expect(result.current.cursors.get('u1')).toBeUndefined()
  })

  it('T-054B-120: cursor inactivity timer resets on new broadcast', () => {
    vi.useFakeTimers()

    const manager = makeManager()
    const { result } = renderHook(() =>
      useLiveCursors({ manager, currentUserId: CURRENT_USER_ID, currentUserDisplayName: 'Me' })
    )

    // First broadcast at t=0
    act(() => {
      capturedBroadcastHandlers.get('cursor_move')?.({
        userId: 'u1', x: 10, y: 20, displayName: 'Alice',
      })
    })

    // Advance 4000ms (almost expired)
    act(() => { vi.advanceTimersByTime(4000) })

    // Second broadcast resets the timer
    act(() => {
      capturedBroadcastHandlers.get('cursor_move')?.({
        userId: 'u1', x: 15, y: 25, displayName: 'Alice',
      })
    })

    // Advance 2000ms (total 6000ms since first, but only 2000ms since second)
    act(() => { vi.advanceTimersByTime(2000) })

    // Cursor still present (timer reset)
    expect(result.current.cursors.get('u1')).toBeDefined()
  })

  it('T-054B-121: caps cursors map at 8 most-recently active', () => {
    vi.useFakeTimers()

    const manager = makeManager()
    const { result } = renderHook(() =>
      useLiveCursors({ manager, currentUserId: CURRENT_USER_ID, currentUserDisplayName: 'Me' })
    )

    // Fire 9 broadcasts from 9 different users at increasing timestamps
    for (let i = 1; i <= 9; i++) {
      act(() => {
        vi.advanceTimersByTime(10) // ensure distinct lastSeenAt
        capturedBroadcastHandlers.get('cursor_move')?.({
          userId: `user-${i}`,
          x: i,
          y: i,
          displayName: `User ${i}`,
        })
      })
    }

    expect(result.current.cursors.size).toBe(8)
    // The oldest (user-1, lowest lastSeenAt) should be dropped
    expect(result.current.cursors.has('user-1')).toBe(false)
    // The newest (user-9) should be present
    expect(result.current.cursors.has('user-9')).toBe(true)
  })

  it('T-054B-122: cleanup removes broadcast listener on unmount', () => {
    const manager = makeManager()
    const { unmount } = renderHook(() =>
      useLiveCursors({ manager, currentUserId: CURRENT_USER_ID, currentUserDisplayName: 'Me' })
    )

    // The onBroadcast call returned an unsubscribe fn; unmount should call it.
    // After unmount, firing the broadcast handler should NOT update any state.
    unmount()

    // handler removed from capturedBroadcastHandlers map by the unsubscribe fn
    expect(capturedBroadcastHandlers.get('cursor_move')).toBeUndefined()
  })

  it('T-054B-123: detach pointer tracking by calling returned cleanup', () => {
    const manager = makeManager()
    const { result } = renderHook(() =>
      useLiveCursors({ manager, currentUserId: CURRENT_USER_ID, currentUserDisplayName: 'Me' })
    )

    const el = document.createElement('div')
    let detach: (() => void) | undefined

    act(() => {
      detach = result.current.attachPointerTracking(el)
    })

    // Detach the listener
    act(() => {
      detach?.()
    })

    // Dispatching after detach should not call sendBroadcast
    dispatchPointerMove(el, 100, 100, { left: 0, top: 0, width: 400, height: 400 })

    expect(mockManagerInstance.current!.sendBroadcast).not.toHaveBeenCalled()
  })
})
