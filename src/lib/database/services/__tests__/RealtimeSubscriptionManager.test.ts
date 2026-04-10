/**
 * RealtimeSubscriptionManager tests — ADR-0009 BUG-01
 *
 * Tests T-0009-001 through T-0009-005.
 *
 * Verifies that subscribeToIdeas passes event payloads (not empty arrays) and
 * that project-id filtering guards the callback correctly.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RealtimeIdeaPayload } from '../RealtimeSubscriptionManager'

// ---------------------------------------------------------------------------
// All mock infrastructure inside vi.hoisted so it is available before any
// vi.mock factory runs.
// ---------------------------------------------------------------------------

type PostgresChangesHandler = (payload: {
  eventType: string
  new: Record<string, unknown>
  old: Record<string, unknown> | null
}) => void

type SubscribeCallback = (status: string, err?: Error) => void

const { captured, mockChannel, mockSupabase, wireChannelMocks } = vi.hoisted(() => {
  const _captured = {
    handler: null as PostgresChangesHandler | null,
    subscribeCb: null as SubscribeCallback | null,
  }

  // Channel methods written as regular functions (not arrow) so mockImplementation
  // can overwrite them cleanly after clearAllMocks.
  const _channel = {
    on: vi.fn((_type: string, _filter: unknown, handler: PostgresChangesHandler) => {
      _captured.handler = handler
      return _channel
    }),
    subscribe: vi.fn((cb: SubscribeCallback) => {
      _captured.subscribeCb = cb
      cb('SUBSCRIBED')
      return _channel
    }),
  }

  const _supabase = {
    channel: vi.fn().mockReturnValue(_channel),
    removeChannel: vi.fn(),
  }

  function _wire() {
    _captured.handler = null
    _captured.subscribeCb = null

    _channel.on.mockImplementation(
      (_type: string, _filter: unknown, handler: PostgresChangesHandler) => {
        _captured.handler = handler
        return _channel
      }
    )

    _channel.subscribe.mockImplementation((cb: SubscribeCallback) => {
      _captured.subscribeCb = cb
      cb('SUBSCRIBED')
      return _channel
    })

    _supabase.channel.mockReturnValue(_channel)
  }

  return {
    captured: _captured,
    mockChannel: _channel,
    mockSupabase: _supabase,
    wireChannelMocks: _wire,
  }
})

// ---------------------------------------------------------------------------
// Module mocks.
// NOTE: paths are relative to THIS test file's location:
//   src/lib/database/services/__tests__/
// - '../../../supabase'        → src/lib/supabase  (matches source import '../../supabase')
// - '../../../../utils/logger' → src/utils/logger
// - '../../utils/ValidationHelpers' → src/lib/database/utils/ValidationHelpers
// ---------------------------------------------------------------------------

vi.mock('../../../supabase', () => ({ supabase: mockSupabase }))

vi.mock('../../../../utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('../../utils/ValidationHelpers', () => ({
  ValidationHelpers: {
    validateProjectId: vi.fn((id: string) => id),
  },
}))

// ---------------------------------------------------------------------------
// Import under test — after mocks.
// ---------------------------------------------------------------------------

import { RealtimeSubscriptionManager } from '../RealtimeSubscriptionManager'

// ---------------------------------------------------------------------------
// Re-wire after each clearAllMocks (which wipes mockImplementation).
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  wireChannelMocks()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RealtimeSubscriptionManager.subscribeToIdeas — ADR-0009', () => {
  it('T-0009-001: passes INSERT payload to callback', () => {
    const callback = vi.fn<[RealtimeIdeaPayload], void>()
    RealtimeSubscriptionManager.subscribeToIdeas(callback, 'proj-1', undefined, { skipInitialLoad: true })

    expect(captured.handler).not.toBeNull()

    captured.handler!({
      eventType: 'INSERT',
      new: { id: 'i1', project_id: 'proj-1', content: 'Hello' },
      old: null,
    })

    expect(callback).toHaveBeenCalledOnce()
    const arg = callback.mock.calls[0][0]
    expect(arg.eventType).toBe('INSERT')
    expect(arg.new).toMatchObject({ id: 'i1', project_id: 'proj-1' })
    expect(arg.old).toBeNull()
  })

  it('T-0009-002: passes UPDATE payload to callback', () => {
    const callback = vi.fn<[RealtimeIdeaPayload], void>()
    RealtimeSubscriptionManager.subscribeToIdeas(callback, 'proj-1', undefined, { skipInitialLoad: true })

    expect(captured.handler).not.toBeNull()

    captured.handler!({
      eventType: 'UPDATE',
      new: { id: 'i1', project_id: 'proj-1', x: 200, y: 300 },
      old: { id: 'i1', project_id: 'proj-1', x: 100, y: 100 },
    })

    expect(callback).toHaveBeenCalledOnce()
    const arg = callback.mock.calls[0][0]
    expect(arg.eventType).toBe('UPDATE')
    expect(arg.new).toMatchObject({ id: 'i1', x: 200, y: 300 })
    expect(arg.old).toMatchObject({ id: 'i1', x: 100, y: 100 })
  })

  it('T-0009-003: passes DELETE payload to callback', () => {
    const callback = vi.fn<[RealtimeIdeaPayload], void>()
    RealtimeSubscriptionManager.subscribeToIdeas(callback, 'proj-1', undefined, { skipInitialLoad: true })

    expect(captured.handler).not.toBeNull()

    captured.handler!({
      eventType: 'DELETE',
      new: {},
      old: { id: 'i1', project_id: 'proj-1' },
    })

    expect(callback).toHaveBeenCalledOnce()
    const arg = callback.mock.calls[0][0]
    expect(arg.eventType).toBe('DELETE')
    expect(arg.new).toEqual({})
    expect(arg.old).toMatchObject({ id: 'i1' })
  })

  it('T-0009-004: does NOT call callback for events from a different project', () => {
    const callback = vi.fn<[RealtimeIdeaPayload], void>()
    RealtimeSubscriptionManager.subscribeToIdeas(callback, 'proj-1', undefined, { skipInitialLoad: true })

    expect(captured.handler).not.toBeNull()

    captured.handler!({
      eventType: 'INSERT',
      new: { id: 'i9', project_id: 'proj-OTHER', content: 'Different project' },
      old: null,
    })

    expect(callback).not.toHaveBeenCalled()
  })

  it('T-0009-005: subscribe error logs without calling callback', async () => {
    const { logger } = await import('../../../../utils/logger')
    const callback = vi.fn<[RealtimeIdeaPayload], void>()
    RealtimeSubscriptionManager.subscribeToIdeas(callback, 'proj-1', undefined, { skipInitialLoad: true })

    expect(captured.subscribeCb).not.toBeNull()
    captured.subscribeCb!('CHANNEL_ERROR', new Error('simulated error'))

    expect(callback).not.toHaveBeenCalled()
    const warnCalls = (logger.warn as ReturnType<typeof vi.fn>).mock.calls.length
    const errorCalls = (logger.error as ReturnType<typeof vi.fn>).mock.calls.length
    expect(warnCalls + errorCalls).toBeGreaterThan(0)
  })
})
