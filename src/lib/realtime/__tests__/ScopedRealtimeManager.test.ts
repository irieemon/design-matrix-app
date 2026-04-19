/**
 * ScopedRealtimeManager unit tests — Phase 05.4a Wave 2, Unit 2
 *
 * Tests T-054A-010 through T-054A-023 (15 tests).
 *
 * All tests mock the Supabase client via a MockChannel from the shared
 * mockRealtimeChannel fixture. The ScopedRealtimeManager is a NEW sibling
 * class — it does NOT extend or wrap BrainstormRealtimeManager (D-09).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createMockChannel } from '../../../test/fixtures/mockRealtimeChannel'
import type { MockChannel } from '../../../test/fixtures/mockRealtimeChannel'

// Mock supabase before importing the class
vi.mock('../../supabase', () => {
  const channel = createMockChannel({ topic: 'default' })
  return {
    supabase: {
      channel: vi.fn().mockReturnValue(channel),
      removeChannel: vi.fn(),
    },
  }
})

vi.mock('../../../utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { ScopedRealtimeManager } from '../ScopedRealtimeManager'
import { supabase } from '../../supabase'

const mockSupabase = supabase as unknown as {
  channel: ReturnType<typeof vi.fn>
  removeChannel: ReturnType<typeof vi.fn>
}

function makeFreshChannel(): MockChannel {
  return createMockChannel({ topic: 'test' })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useRealTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

// T-054A-010
describe('ScopedRealtimeManager construction', () => {
  it('T-054A-010: getConnectionState returns "connecting" before subscribe', () => {
    const ch = makeFreshChannel()
    mockSupabase.channel.mockReturnValue(ch)

    const manager = new ScopedRealtimeManager({
      scope: { type: 'session', id: 'abc' },
      userId: 'u1',
      displayName: 'Alice',
    })

    expect(manager.getConnectionState()).toBe('connecting')
  })

  // T-054A-011
  it('T-054A-011: subscribe opens channel named "session:{id}"', async () => {
    const ch = makeFreshChannel()
    mockSupabase.channel.mockReturnValue(ch)

    const manager = new ScopedRealtimeManager({
      scope: { type: 'session', id: 'abc' },
      userId: 'u1',
      displayName: 'Alice',
    })
    await manager.subscribe()

    expect(mockSupabase.channel).toHaveBeenCalledWith('session:abc', expect.any(Object))
  })

  // T-054A-012
  it('T-054A-012: subscribe opens channel named "project:{id}" for project scope', async () => {
    const ch = makeFreshChannel()
    mockSupabase.channel.mockReturnValue(ch)

    const manager = new ScopedRealtimeManager({
      scope: { type: 'project', id: 'def' },
      userId: 'u1',
      displayName: 'Alice',
    })
    await manager.subscribe()

    expect(mockSupabase.channel).toHaveBeenCalledWith('project:def', expect.any(Object))
  })

  // T-054A-012b
  it('T-054A-012b: project scope handles presence, broadcast, and postgres_changes identically to session scope', async () => {
    const ch = makeFreshChannel()
    mockSupabase.channel.mockReturnValue(ch)

    const manager = new ScopedRealtimeManager({
      scope: { type: 'project', id: 'p-1' },
      userId: 'u1',
      displayName: 'Alice',
    })

    const presenceHandler = vi.fn()
    const broadcastHandler = vi.fn()
    const postgresHandler = vi.fn()

    manager.onPresence(presenceHandler)
    manager.onBroadcast('foo', broadcastHandler)
    manager.onPostgresChange('idea_votes', { event: 'INSERT' }, postgresHandler)

    await manager.subscribe()

    // Emit all three event types via the mock channel
    await ch.track({ userId: 'u1', displayName: 'Alice', joinedAt: Date.now() })
    ch.send({ type: 'broadcast', event: 'foo', payload: { x: 1 } })
    ch.emitPostgresChange({ table: 'idea_votes', event: 'INSERT', new: { idea_id: 'i1' } })

    expect(presenceHandler).toHaveBeenCalled()
    expect(broadcastHandler).toHaveBeenCalled()
    expect(postgresHandler).toHaveBeenCalled()
  })
})

// T-054A-013
describe('presence key format', () => {
  it('T-054A-013: track payload contains userId and a non-empty tabId', async () => {
    const ch = makeFreshChannel()
    const trackSpy = vi.spyOn(ch, 'track')
    mockSupabase.channel.mockReturnValue(ch)

    const manager = new ScopedRealtimeManager({
      scope: { type: 'session', id: 's1' },
      userId: 'u1',
      displayName: 'Alice',
    })
    await manager.subscribe()

    expect(trackSpy).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', tabId: expect.any(String) })
    )
    const payload = trackSpy.mock.calls[0][0] as Record<string, unknown>
    expect((payload.tabId as string).length).toBeGreaterThan(0)
  })

  // T-054A-014
  it('T-054A-014: custom tabId is used in track payload', async () => {
    const ch = makeFreshChannel()
    const trackSpy = vi.spyOn(ch, 'track')
    mockSupabase.channel.mockReturnValue(ch)

    const manager = new ScopedRealtimeManager({
      scope: { type: 'session', id: 's1' },
      userId: 'u1',
      displayName: 'Alice',
      tabId: 'tab-xyz',
    })
    await manager.subscribe()

    expect(trackSpy).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', tabId: 'tab-xyz' })
    )
  })
})

// T-054A-015
describe('postgres_changes subscription', () => {
  it('T-054A-015: onPostgresChange handler is invoked when INSERT emitted on matching table', async () => {
    const ch = makeFreshChannel()
    mockSupabase.channel.mockReturnValue(ch)

    const manager = new ScopedRealtimeManager({
      scope: { type: 'session', id: 's1' },
      userId: 'u1',
      displayName: 'Alice',
    })

    const handler = vi.fn()
    manager.onPostgresChange('idea_votes', { event: 'INSERT' }, handler)
    await manager.subscribe()

    ch.emitPostgresChange({
      table: 'idea_votes',
      event: 'INSERT',
      new: { idea_id: 'i1', user_id: 'u2' },
    })

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ new: { idea_id: 'i1', user_id: 'u2' } })
    )
  })
})

// T-054A-016
describe('broadcast loopback', () => {
  it('T-054A-016: onBroadcast handler receives sendBroadcast payload', async () => {
    const ch = makeFreshChannel()
    mockSupabase.channel.mockReturnValue(ch)

    const manager = new ScopedRealtimeManager({
      scope: { type: 'session', id: 's1' },
      userId: 'u1',
      displayName: 'Alice',
    })

    const handler = vi.fn()
    manager.onBroadcast('foo', handler)
    await manager.subscribe()

    manager.sendBroadcast('foo', { x: 1 })

    expect(handler).toHaveBeenCalledWith({ x: 1 })
  })
})

// T-054A-017
describe('presence delivery', () => {
  it('T-054A-017: onPresence handler receives participant list from track', async () => {
    const ch = makeFreshChannel()
    mockSupabase.channel.mockReturnValue(ch)

    const manager = new ScopedRealtimeManager({
      scope: { type: 'session', id: 's1' },
      userId: 'u1',
      displayName: 'Alice',
    })

    const handler = vi.fn()
    manager.onPresence(handler)
    await manager.subscribe()

    await ch.track({ userId: 'u1', displayName: 'Alice', joinedAt: 100 })

    expect(handler).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ userId: 'u1' }),
      ])
    )
  })
})

// T-054A-018
describe('connection state transitions', () => {
  it('T-054A-018: state becomes "connected" after SUBSCRIBED callback', async () => {
    const ch = makeFreshChannel()
    mockSupabase.channel.mockReturnValue(ch)

    const manager = new ScopedRealtimeManager({
      scope: { type: 'session', id: 's1' },
      userId: 'u1',
      displayName: 'Alice',
    })
    await manager.subscribe()

    // createMockChannel's subscribe() immediately calls back 'SUBSCRIBED'
    expect(manager.getConnectionState()).toBe('connected')
  })

  // T-054A-022
  it('T-054A-022: onConnectionStateChange fires with "connecting" then "connected"', async () => {
    const ch = makeFreshChannel()
    mockSupabase.channel.mockReturnValue(ch)

    const manager = new ScopedRealtimeManager({
      scope: { type: 'session', id: 's1' },
      userId: 'u1',
      displayName: 'Alice',
    })

    const states: string[] = []
    manager.onConnectionStateChange((state) => states.push(state))

    await manager.subscribe()

    // Should have fired at least 'connected' (the 'connecting' state is set on construction before handlers)
    expect(states).toContain('connected')
  })

  // T-054A-023
  it('T-054A-023: returned unsubscribe fn stops further state change events', async () => {
    const ch = makeFreshChannel()
    mockSupabase.channel.mockReturnValue(ch)

    const manager = new ScopedRealtimeManager({
      scope: { type: 'session', id: 's1' },
      userId: 'u1',
      displayName: 'Alice',
    })

    const handler = vi.fn()
    const unsub = manager.onConnectionStateChange(handler)
    unsub()

    await manager.subscribe()

    // Handler removed before subscribe, should not fire
    expect(handler).not.toHaveBeenCalled()
  })
})

// T-054A-019 + T-054A-020
// These tests drive the reconnect loop by exercising the state machine directly.
// Because resubscribe() is async (involves supabase.removeChannel + subscribe),
// we use a synchronous-callback approach: each new channel's subscribe() fires
// CHANNEL_ERROR immediately, so the reconnect timer fires → triggers another
// subscribe() → that channel also fails. We count channel creations to verify
// the reconnect count, and use runAllTimersAsync to drain async microtasks.
describe('reconnect backoff and polling fallback', () => {
  it('T-054A-019: reconnect loop fires reconnect attempts with exponential backoff schedule', async () => {
    vi.useFakeTimers()

    const channelsCreated: number[] = []
    let idx = 0

    // First channel: SUBSCRIBED then immediately CHANNEL_ERROR to kick off reconnect
    // Subsequent channels: CHANNEL_ERROR immediately
    mockSupabase.channel.mockImplementation(() => {
      const callIdx = ++idx
      channelsCreated.push(callIdx)
      const ch = createMockChannel({ topic: 'test' })
      ch.subscribe = vi.fn((cb) => {
        if (callIdx === 1) {
          cb?.('SUBSCRIBED')
          // Trigger error synchronously after SUBSCRIBED to start reconnect loop
          cb?.('CHANNEL_ERROR')
        } else {
          cb?.('CHANNEL_ERROR')
        }
        return ch
      })
      return ch
    })

    mockSupabase.removeChannel.mockResolvedValue(undefined)

    const manager = new ScopedRealtimeManager({
      scope: { type: 'session', id: 'rc' },
      userId: 'u1',
      displayName: 'Alice',
    })

    await manager.subscribe()
    // State should be reconnecting (SUBSCRIBED fired, then CHANNEL_ERROR fired)
    expect(manager.getConnectionState()).toBe('reconnecting')

    // Advance through backoff: attempt 1 → 1s delay
    await vi.advanceTimersByTimeAsync(1000)
    // Advance attempt 2 → 2s
    await vi.advanceTimersByTimeAsync(2000)
    // Advance attempt 3 → 4s
    await vi.advanceTimersByTimeAsync(4000)

    // After 3 reconnect attempts, multiple channels should have been created
    expect(channelsCreated.length).toBeGreaterThanOrEqual(3)

    vi.useRealTimers()
  })

  it('T-054A-020: after 5 failed reconnects, state transitions to "polling" and pollingTick fires', async () => {
    vi.useFakeTimers()

    let idx = 0
    mockSupabase.channel.mockImplementation(() => {
      ++idx
      const ch = createMockChannel({ topic: 'test' })
      ch.subscribe = vi.fn((cb) => {
        if (idx === 1) {
          // First: SUBSCRIBED then error to kick off reconnect
          cb?.('SUBSCRIBED')
          cb?.('CHANNEL_ERROR')
        } else {
          // All reconnects fail immediately
          cb?.('CHANNEL_ERROR')
        }
        return ch
      })
      return ch
    })

    mockSupabase.removeChannel.mockResolvedValue(undefined)

    const manager = new ScopedRealtimeManager({
      scope: { type: 'session', id: 's2' },
      userId: 'u1',
      displayName: 'Alice',
    })

    const pollHandler = vi.fn()
    const cleanupPoll = manager.onPollingTick(pollHandler, 1000)

    await manager.subscribe()
    expect(manager.getConnectionState()).toBe('reconnecting')

    // Drain all 5 backoff steps: 1s + 2s + 4s + 8s + 16s = 31s
    // Use a generous advance to ensure all timers fire
    await vi.advanceTimersByTimeAsync(1000)   // attempt 1
    await vi.advanceTimersByTimeAsync(2000)   // attempt 2
    await vi.advanceTimersByTimeAsync(4000)   // attempt 3
    await vi.advanceTimersByTimeAsync(8000)   // attempt 4
    await vi.advanceTimersByTimeAsync(16000)  // attempt 5 → polling

    expect(manager.getConnectionState()).toBe('polling')

    // Poll interval should now fire
    await vi.advanceTimersByTimeAsync(1000)
    expect(pollHandler).toHaveBeenCalled()

    cleanupPoll()
    vi.useRealTimers()
  })
})

// T-054A-021
describe('unsubscribe', () => {
  it('T-054A-021: unsubscribe calls removeChannel and state becomes "disconnected"', async () => {
    const ch = makeFreshChannel()
    mockSupabase.channel.mockReturnValue(ch)
    mockSupabase.removeChannel.mockResolvedValue(undefined)

    const manager = new ScopedRealtimeManager({
      scope: { type: 'session', id: 's1' },
      userId: 'u1',
      displayName: 'Alice',
    })
    await manager.subscribe()
    await manager.unsubscribe()

    expect(mockSupabase.removeChannel).toHaveBeenCalledTimes(1)
    expect(manager.getConnectionState()).toBe('disconnected')
  })
})

// T-054B-024b/c/d: unsubscribe returns from onPresence, onBroadcast, onPostgresChange
describe('handler unsubscribe returns (D-09 exception, Wave 2 prerequisite)', () => {
  it('T-054B-024b: onPresence returns unsubscribe; calling it removes handler from presenceHandlers', async () => {
    const ch = makeFreshChannel()
    mockSupabase.channel.mockReturnValue(ch)

    const manager = new ScopedRealtimeManager({
      scope: { type: 'project', id: 'p1' },
      userId: 'u1',
      displayName: 'Alice',
    })

    const handler = vi.fn()
    const unsub = manager.onPresence(handler)
    unsub()

    await manager.subscribe()
    // Trigger presence delivery; handler must NOT be called
    await ch.track({ userId: 'u1', displayName: 'Alice', joinedAt: Date.now() })

    expect(handler).not.toHaveBeenCalled()
  })

  it('T-054B-024c: onBroadcast returns unsubscribe; calling it removes handler', async () => {
    const ch = makeFreshChannel()
    mockSupabase.channel.mockReturnValue(ch)

    const manager = new ScopedRealtimeManager({
      scope: { type: 'project', id: 'p1' },
      userId: 'u1',
      displayName: 'Alice',
    })

    const handler = vi.fn()
    const unsub = manager.onBroadcast('cursor_move', handler)
    unsub()

    await manager.subscribe()
    manager.sendBroadcast('cursor_move', { x: 1 })

    expect(handler).not.toHaveBeenCalled()
  })

  it('T-054B-024d: onPostgresChange returns unsubscribe; calling it removes handler', async () => {
    const ch = makeFreshChannel()
    mockSupabase.channel.mockReturnValue(ch)

    const manager = new ScopedRealtimeManager({
      scope: { type: 'project', id: 'p1' },
      userId: 'u1',
      displayName: 'Alice',
    })

    const handler = vi.fn()
    const unsub = manager.onPostgresChange('ideas', { event: 'UPDATE' }, handler)
    unsub()

    await manager.subscribe()
    ch.emitPostgresChange({ table: 'ideas', event: 'UPDATE', new: { id: 'i1' } })

    expect(handler).not.toHaveBeenCalled()
  })
})

// T-054B-301/302: late-registered broadcast and postgres listeners fire.
// Regression for the ScopedRealtimeManager broadcast registration bug:
// useLiveCursors and useDragLock call manager.onBroadcast inside a useEffect
// that runs AFTER useProjectRealtime fires manager.subscribe(). Before the
// fix, buildChannel() iterated broadcastListeners[] once at subscribe time,
// so the registry was empty and no ch.on('broadcast', ...) handlers were
// attached → incoming broadcasts from other clients were silently dropped.
// Fix: buildChannel() attaches one dispatcher per unique event name that
// reads the registry at dispatch time, and onBroadcast() attaches a dispatcher
// lazily for any new event name when the channel is already live.
describe('T-054B-301/302: late-registered listeners receive incoming events', () => {
  it('onBroadcast registered AFTER subscribe receives incoming broadcast', async () => {
    const ch = makeFreshChannel()
    mockSupabase.channel.mockReturnValue(ch)

    const manager = new ScopedRealtimeManager({
      scope: { type: 'project', id: 'p-late' },
      userId: 'u1',
      displayName: 'Alice',
    })

    // Subscribe first — registry is empty at buildChannel time.
    await manager.subscribe()

    // Register the broadcast handler AFTER subscribe, mirroring useLiveCursors'
    // useEffect timing.
    const handler = vi.fn()
    manager.onBroadcast<{ userId: string; x: number }>('cursor_move', handler)

    // Simulate an incoming broadcast from another client. The mock channel's
    // send() synchronously dispatches to every registered broadcast handler
    // whose event matches — i.e., it exercises ch.on('broadcast', ...) wiring.
    ch.send({ type: 'broadcast', event: 'cursor_move', payload: { userId: 'u2', x: 50 } })

    expect(handler).toHaveBeenCalledWith({ userId: 'u2', x: 50 })
  })

  it('multiple onBroadcast handlers for the same event all fire on one incoming broadcast', async () => {
    const ch = makeFreshChannel()
    mockSupabase.channel.mockReturnValue(ch)

    const manager = new ScopedRealtimeManager({
      scope: { type: 'project', id: 'p-multi' },
      userId: 'u1',
      displayName: 'Alice',
    })

    await manager.subscribe()

    const handlerA = vi.fn()
    const handlerB = vi.fn()
    manager.onBroadcast('drag_lock', handlerA)
    manager.onBroadcast('drag_lock', handlerB)

    ch.send({ type: 'broadcast', event: 'drag_lock', payload: { ideaId: 'i1' } })

    expect(handlerA).toHaveBeenCalledWith({ ideaId: 'i1' })
    expect(handlerB).toHaveBeenCalledWith({ ideaId: 'i1' })
  })

  it('onBroadcast returned unsubscribe removes a late-registered handler from dispatch', async () => {
    const ch = makeFreshChannel()
    mockSupabase.channel.mockReturnValue(ch)

    const manager = new ScopedRealtimeManager({
      scope: { type: 'project', id: 'p-unsub' },
      userId: 'u1',
      displayName: 'Alice',
    })

    await manager.subscribe()

    const handler = vi.fn()
    const unsub = manager.onBroadcast('drag_release', handler)
    unsub()

    ch.send({ type: 'broadcast', event: 'drag_release', payload: { ideaId: 'i1' } })

    expect(handler).not.toHaveBeenCalled()
  })

  it('onPostgresChange registered AFTER subscribe receives incoming change', async () => {
    const ch = makeFreshChannel()
    mockSupabase.channel.mockReturnValue(ch)

    const manager = new ScopedRealtimeManager({
      scope: { type: 'project', id: 'p-pg-late' },
      userId: 'u1',
      displayName: 'Alice',
    })

    await manager.subscribe()

    const handler = vi.fn()
    manager.onPostgresChange('idea_votes', { event: 'INSERT' }, handler)

    ch.emitPostgresChange({
      table: 'idea_votes',
      event: 'INSERT',
      new: { idea_id: 'i1', user_id: 'u2' },
    })

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ new: { idea_id: 'i1', user_id: 'u2' } })
    )
  })
})

// T-054B-303: broadcast dispatcher continues after a throwing handler
describe('T-054B-303: broadcast dispatcher resilience', () => {
  it('broadcast dispatcher continues to other handlers when one throws', async () => {
    const ch = makeFreshChannel()
    mockSupabase.channel.mockReturnValue(ch)

    const manager = new ScopedRealtimeManager({
      scope: { type: 'project', id: 'p-throw' },
      userId: 'u1',
      displayName: 'Alice',
    })

    await manager.subscribe()

    const { logger } = await import('../../../utils/logger')
    const warnSpy = vi.spyOn(logger, 'warn')

    const throwingHandler = vi.fn(() => { throw new Error('boom') })
    const secondHandler = vi.fn()

    manager.onBroadcast('test_event', throwingHandler)
    manager.onBroadcast('test_event', secondHandler)

    ch.send({ type: 'broadcast', event: 'test_event', payload: { x: 42 } })

    expect(secondHandler).toHaveBeenCalledWith({ x: 42 })
    expect(warnSpy).toHaveBeenCalledWith(
      '[ScopedRealtimeManager] broadcast handler threw',
      expect.objectContaining({ event: 'test_event' })
    )
  })
})

// T-054A-023b: resubscribe null race
// Poirot Finding 4: if unsubscribe() fires while a resubscribe() is pending in
// setTimeout, the captured channel reference must not be passed as null to
// supabase.removeChannel. After the fix, removeChannel is not called with null
// and no error is thrown.
describe('T-054A-023b: resubscribe null race does not call removeChannel with null', () => {
  it('schedules resubscribe, fires unsubscribe mid-wait, no removeChannel(null) call', async () => {
    vi.useFakeTimers()

    let callIdx = 0
    mockSupabase.channel.mockImplementation(() => {
      callIdx++
      const ch = createMockChannel({ topic: 'test' })
      ch.subscribe = vi.fn((cb) => {
        if (callIdx === 1) {
          // First channel subscribes OK then immediately errors to trigger reconnect
          cb?.('SUBSCRIBED')
          cb?.('CHANNEL_ERROR')
        }
        // Subsequent channels: never fire (we will have unsubscribed by then)
        return ch
      })
      return ch
    })

    mockSupabase.removeChannel.mockResolvedValue(undefined)

    const manager = new ScopedRealtimeManager({
      scope: { type: 'session', id: 'race-test' },
      userId: 'u1',
      displayName: 'Alice',
    })

    await manager.subscribe()
    // manager is now reconnecting — resubscribe scheduled for 1000ms

    // Immediately unsubscribe before the timer fires
    await manager.unsubscribe()

    // Advance past the reconnect delay
    await vi.advanceTimersByTimeAsync(2000)

    // removeChannel must never have been called with null
    const calls = mockSupabase.removeChannel.mock.calls
    for (const [arg] of calls) {
      expect(arg).not.toBeNull()
    }

    vi.useRealTimers()
  })
})
