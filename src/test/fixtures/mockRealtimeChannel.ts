/**
 * mockRealtimeChannel — shared Supabase Realtime channel test fixture
 *
 * Emulates the subset of `supabase.channel(...)` used by Phase 5 code:
 *   .on('postgres_changes', filter, handler)
 *   .on('broadcast',        { event }, handler)
 *   .on('presence',         { event }, handler)
 *   .subscribe(cb)
 *   .send({ type, event, payload })
 *   .track(state)
 *   .presenceState()
 *
 * Plus test-only helpers:
 *   .emitPostgresChange({ table, event, new, old })
 *   .removeAllChannels()  (no-op stub for parity with supabase.removeChannel)
 *
 * Used by Wave 0 stubs across plans 02–04. Downstream tests will replace
 * `vi.mock('@supabase/supabase-js', ...)` to return channels created here.
 */

export type PostgresEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*'
export type ChannelStatus = 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED'

export interface PostgresChangeFilter {
  event: PostgresEvent
  schema?: string
  table: string
  filter?: string
}

export interface PostgresChangePayload<T = Record<string, unknown>> {
  schema: string
  table: string
  eventType: Exclude<PostgresEvent, '*'>
  new: T
  old: T | null
}

export interface BroadcastMessage<T = unknown> {
  type: 'broadcast'
  event: string
  payload: T
}

export type PresenceEvent = 'sync' | 'join' | 'leave'

interface PostgresHandler {
  filter: PostgresChangeFilter
  handler: (payload: PostgresChangePayload) => void
}
interface BroadcastHandler {
  event: string
  handler: (msg: BroadcastMessage) => void
}
interface PresenceHandler {
  event: PresenceEvent
  handler: (payload: unknown) => void
}

export interface MockChannel {
  on(
    type: 'postgres_changes',
    filter: PostgresChangeFilter,
    handler: (payload: PostgresChangePayload) => void
  ): MockChannel
  on(
    type: 'broadcast',
    opts: { event: string },
    handler: (msg: BroadcastMessage) => void
  ): MockChannel
  on(
    type: 'presence',
    opts: { event: PresenceEvent },
    handler: (payload: unknown) => void
  ): MockChannel
  subscribe(cb?: (status: ChannelStatus) => void): MockChannel
  send(msg: BroadcastMessage): MockChannel
  track(state: Record<string, unknown>): Promise<'ok'>
  presenceState(): Record<string, Array<Record<string, unknown>>>
  emitPostgresChange(input: {
    table: string
    event: Exclude<PostgresEvent, '*'>
    new?: Record<string, unknown>
    old?: Record<string, unknown> | null
    schema?: string
  }): void
  removeAllChannels(): void
}

export interface CreateMockChannelOptions {
  topic?: string
  presenceKey?: string
}

export function createMockChannel(options: CreateMockChannelOptions = {}): MockChannel {
  const postgresHandlers: PostgresHandler[] = []
  const broadcastHandlers: BroadcastHandler[] = []
  const presenceHandlers: PresenceHandler[] = []
  const presence: Record<string, Array<Record<string, unknown>>> = {}
  const presenceKey = options.presenceKey ?? 'mock-key'

  const channel: MockChannel = {
    on(type: string, filterOrOpts: unknown, handler: unknown): MockChannel {
      if (type === 'postgres_changes') {
        postgresHandlers.push({
          filter: filterOrOpts as PostgresChangeFilter,
          handler: handler as (p: PostgresChangePayload) => void,
        })
      } else if (type === 'broadcast') {
        broadcastHandlers.push({
          event: (filterOrOpts as { event: string }).event,
          handler: handler as (m: BroadcastMessage) => void,
        })
      } else if (type === 'presence') {
        presenceHandlers.push({
          event: (filterOrOpts as { event: PresenceEvent }).event,
          handler: handler as (p: unknown) => void,
        })
      }
      return channel
    },
    subscribe(cb) {
      cb?.('SUBSCRIBED')
      return channel
    },
    send(msg) {
      // Synchronously deliver to matching broadcast handlers (loopback).
      for (const h of broadcastHandlers) {
        if (h.event === msg.event) h.handler(msg)
      }
      return channel
    },
    async track(state) {
      presence[presenceKey] = [state]
      for (const h of presenceHandlers) {
        if (h.event === 'sync') h.handler({})
        if (h.event === 'join') h.handler({ key: presenceKey, newPresences: [state] })
      }
      return 'ok'
    },
    presenceState() {
      return { ...presence }
    },
    emitPostgresChange({ table, event, new: newRow = {}, old = null, schema = 'public' }) {
      const payload: PostgresChangePayload = {
        schema,
        table,
        eventType: event,
        new: newRow,
        old,
      }
      for (const h of postgresHandlers) {
        if (h.filter.table !== table) continue
        if (h.filter.event !== '*' && h.filter.event !== event) continue
        h.handler(payload)
      }
    },
    removeAllChannels() {
      postgresHandlers.length = 0
      broadcastHandlers.length = 0
      presenceHandlers.length = 0
    },
  }

  return channel
}
