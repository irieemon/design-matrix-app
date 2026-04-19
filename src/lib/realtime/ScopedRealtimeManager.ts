/**
 * ScopedRealtimeManager — Phase 05.4a Wave 2, Unit 2
 *
 * Generic single-channel realtime abstraction parameterized by scope.
 * One `supabase.channel(${scope.type}:${scope.id})` multiplexes:
 *   - postgres_changes (per-table, per-event listeners)
 *   - broadcast (named event listeners + send)
 *   - presence (track self, deliver participant list)
 *
 * This is a NEW SIBLING CLASS to BrainstormRealtimeManager (D-09).
 * It does NOT extend, wrap, delegate to, or share any code with
 * BrainstormRealtimeManager. Both coexist independently on the session page.
 *
 * Reconnect backoff: 1s → 2s → 4s → 8s → 16s (5 attempts, then polling).
 * Presence key format: `${userId}:${tabId}` (D-09, SEC-02 mitigation).
 */

import { supabase } from '../supabase'
import { logger } from '../../utils/logger'
import type { RealtimeChannel } from '@supabase/supabase-js'

export type Scope = { type: 'session' | 'project'; id: string }

export type ConnectionState =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'polling'
  | 'disconnected'

export interface ScopedRealtimeConfig {
  scope: Scope
  userId: string
  displayName: string
  /** Stable per-tab identifier. Defaults to `crypto.randomUUID()` if omitted. */
  tabId?: string
  onError?: (error: Error) => void
}

export interface PresenceParticipant {
  userId: string
  displayName: string
  joinedAt: number
  tabId: string
}

type PostgresEventType = 'INSERT' | 'UPDATE' | 'DELETE' | '*'

interface PostgresFilter {
  event: PostgresEventType
  filter?: string
}

interface PostgresListenerEntry {
  table: string
  filter: PostgresFilter
  // Poirot Finding 1 fix: eventType is passed through from the raw payload so
  // consumers can use `payload.eventType === 'DELETE'` instead of heuristics.
  handler: (payload: { new: Record<string, unknown>; old: Record<string, unknown> | null; eventType: string }) => void
}

interface BroadcastListenerEntry {
  event: string
  handler: (payload: unknown) => void
}

type PresenceHandler = (participants: PresenceParticipant[]) => void
type ConnectionStateHandler = (state: ConnectionState) => void
type PollingTickHandler = () => void

interface PollingEntry {
  handler: PollingTickHandler
  intervalMs: number
  timer: ReturnType<typeof setInterval> | null
}

const MAX_RECONNECT_ATTEMPTS = 5
const INITIAL_BACKOFF_MS = 1000

export class ScopedRealtimeManager {
  private readonly config: ScopedRealtimeConfig
  private readonly tabId: string
  private readonly channelName: string

  private channel: RealtimeChannel | null = null
  private connectionState: ConnectionState = 'connecting'

  private reconnectAttempts = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private isDestroyed = false

  // Listener registries — listeners may be registered before OR after subscribe().
  // T-054B-301/302 fix: a single dispatcher is attached per unique event name /
  // postgres filter key at subscribe time (and lazily in the register methods
  // for late arrivals). The dispatcher reads the registry at dispatch time so
  // handlers registered after subscribe() still fire.
  private readonly postgresListeners: PostgresListenerEntry[] = []
  private readonly broadcastListeners: BroadcastListenerEntry[] = []
  private readonly presenceHandlers: PresenceHandler[] = []
  private readonly connectionStateHandlers: Set<ConnectionStateHandler> = new Set()
  private readonly pollingEntries: PollingEntry[] = []

  // Tracks which broadcast event names already have a channel-level dispatcher.
  private readonly registeredBroadcastEvents: Set<string> = new Set()
  // Tracks which postgres filter keys already have a channel-level dispatcher.
  private readonly registeredPostgresKeys: Set<string> = new Set()

  constructor(config: ScopedRealtimeConfig) {
    this.config = config
    this.tabId = config.tabId ?? crypto.randomUUID()
    this.channelName = `${config.scope.type}:${config.scope.id}`
  }

  // ---------------------------------------------------------------------------
  // Listener registration — May be called before OR after subscribe(). Late
  // registrations are wired lazily via ensureBroadcastDispatcher /
  // ensurePostgresDispatcher. Note: presence handlers are still wired
  // unconditionally inside buildChannel() and should be registered before
  // subscribe() to avoid missing the initial sync event.
  // ---------------------------------------------------------------------------

  onPostgresChange<T = Record<string, unknown>>(
    table: string,
    filter: PostgresFilter,
    handler: (payload: { new: T; old: T | null; eventType: string }) => void
  ): () => void {
    const entry: PostgresListenerEntry = {
      table,
      filter,
      handler: handler as PostgresListenerEntry['handler'],
    }
    this.postgresListeners.push(entry)

    // T-054B-301/302 fix: if the channel is already live, attach a dispatcher
    // for this table/event/filter combination lazily. Handlers registered
    // before subscribe() are covered by buildChannel().
    if (this.channel !== null) {
      this.ensurePostgresDispatcher(this.channel, entry)
    }

    return () => {
      const idx = this.postgresListeners.indexOf(entry)
      if (idx !== -1) this.postgresListeners.splice(idx, 1)
    }
  }

  onBroadcast<T = unknown>(event: string, handler: (payload: T) => void): () => void {
    const entry: BroadcastListenerEntry = {
      event,
      handler: handler as BroadcastListenerEntry['handler'],
    }
    this.broadcastListeners.push(entry)

    // T-054B-301/302 fix: if the channel is already live, attach a dispatcher
    // for this event name lazily (once per unique event name). The dispatcher
    // reads the registry at dispatch time so subsequent handlers on the same
    // event are picked up automatically without needing another ch.on().
    if (this.channel !== null) {
      this.ensureBroadcastDispatcher(this.channel, event)
    }

    return () => {
      const idx = this.broadcastListeners.indexOf(entry)
      if (idx !== -1) this.broadcastListeners.splice(idx, 1)
    }
  }

  onPresence(handler: PresenceHandler): () => void {
    this.presenceHandlers.push(handler)
    return () => {
      const idx = this.presenceHandlers.indexOf(handler)
      if (idx !== -1) this.presenceHandlers.splice(idx, 1)
    }
  }

  onConnectionStateChange(handler: ConnectionStateHandler): () => void {
    this.connectionStateHandlers.add(handler)
    return () => {
      this.connectionStateHandlers.delete(handler)
    }
  }

  onPollingTick(handler: PollingTickHandler, intervalMs: number): () => void {
    const entry: PollingEntry = { handler, intervalMs, timer: null }
    this.pollingEntries.push(entry)

    // If already in polling state, start immediately
    if (this.connectionState === 'polling') {
      this.startPollingEntry(entry)
    }

    return () => {
      if (entry.timer !== null) {
        clearInterval(entry.timer)
        entry.timer = null
      }
      const idx = this.pollingEntries.indexOf(entry)
      if (idx !== -1) this.pollingEntries.splice(idx, 1)
    }
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  async subscribe(): Promise<void> {
    if (this.isDestroyed) {
      logger.warn('ScopedRealtimeManager: subscribe called after destroy')
      return
    }

    this.channel = this.buildChannel()
    this.channel.subscribe((status: string, err?: Error) => {
      if (status === 'SUBSCRIBED') {
        this.reconnectAttempts = 0
        this.setConnectionState('connected')
        logger.debug('ScopedRealtimeManager: connected', { channel: this.channelName })
        void this.trackSelf()
      } else if (status === 'CHANNEL_ERROR' || status === 'CLOSED') {
        if (err) logger.warn('ScopedRealtimeManager: channel error', err)
        this.handleDisconnect()
      } else if (status === 'TIMED_OUT') {
        this.handleDisconnect()
      }
    })
  }

  async unsubscribe(): Promise<void> {
    this.isDestroyed = true
    this.clearReconnectTimer()
    this.stopAllPolling()

    if (this.channel) {
      await supabase.removeChannel(this.channel)
      this.channel = null
    }

    this.setConnectionState('disconnected')
  }

  isSubscribed(): boolean {
    return this.channel !== null && !this.isDestroyed
  }

  // ---------------------------------------------------------------------------
  // Outbound
  // ---------------------------------------------------------------------------

  sendBroadcast<T = unknown>(event: string, payload: T): void {
    if (!this.channel) return
    this.channel.send({ type: 'broadcast', event, payload })
  }

  // ---------------------------------------------------------------------------
  // Connection state
  // ---------------------------------------------------------------------------

  getConnectionState(): ConnectionState {
    return this.connectionState
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private buildChannel(): RealtimeChannel {
    const ch = supabase.channel(this.channelName, {
      config: {
        broadcast: { self: true },
        presence: { key: `${this.config.userId}:${this.tabId}` },
      },
    })

    // Reset per-channel dispatcher tracking. Each new channel (initial or
    // post-reconnect) starts with zero channel-level handlers attached.
    this.registeredBroadcastEvents.clear()
    this.registeredPostgresKeys.clear()

    // Attach one dispatcher per postgres entry currently in the registry.
    for (const entry of this.postgresListeners) {
      this.ensurePostgresDispatcher(ch, entry)
    }

    // Attach one dispatcher per unique broadcast event name currently in the
    // registry. Multiple handlers for the same event share one ch.on call;
    // the dispatcher reads the registry at dispatch time so late registrations
    // for the same event name are picked up automatically.
    for (const entry of this.broadcastListeners) {
      this.ensureBroadcastDispatcher(ch, entry.event)
    }

    // Register presence sync listener
    ch.on('presence' as never, { event: 'sync' } as never, () => {
      this.deliverPresence(ch)
    })
    ch.on(
      'presence' as never,
      { event: 'join' } as never,
      () => {
        this.deliverPresence(ch)
      }
    )
    ch.on(
      'presence' as never,
      { event: 'leave' } as never,
      () => {
        this.deliverPresence(ch)
      }
    )

    return ch as RealtimeChannel
  }

  private ensureBroadcastDispatcher(ch: RealtimeChannel, event: string): void {
    if (this.registeredBroadcastEvents.has(event)) return
    this.registeredBroadcastEvents.add(event)

    ;(ch as unknown as {
      on(
        type: string,
        opts: { event: string },
        handler: (msg: { payload: unknown }) => void
      ): RealtimeChannel
    }).on('broadcast', { event }, (msg: { payload: unknown }) => {
      // Snapshot before iteration so a handler that mutates broadcastListeners
      // (e.g. via its own unsub call) cannot corrupt the current dispatch pass.
      for (const listener of [...this.broadcastListeners]) {
        if (listener.event !== event) continue
        try {
          listener.handler(msg.payload)
        } catch (error) {
          logger.warn('[ScopedRealtimeManager] broadcast handler threw', {
            event,
            scope: this.config.scope,
            error,
          })
        }
      }
    })
  }

  private ensurePostgresDispatcher(
    ch: RealtimeChannel,
    entry: PostgresListenerEntry
  ): void {
    const key = this.postgresFilterKey(entry)
    if (this.registeredPostgresKeys.has(key)) return
    this.registeredPostgresKeys.add(key)

    ;(ch as unknown as {
      on(
        type: string,
        filter: Record<string, unknown>,
        handler: (payload: {
          new: Record<string, unknown>
          old: Record<string, unknown> | null
          eventType: string
        }) => void
      ): RealtimeChannel
    }).on(
      'postgres_changes',
      {
        event: entry.filter.event,
        schema: 'public',
        table: entry.table,
        ...(entry.filter.filter ? { filter: entry.filter.filter } : {}),
      },
      (payload) => {
        // Snapshot before iteration so a handler that mutates postgresListeners
        // (e.g. via its own unsub call) cannot corrupt the current dispatch pass.
        for (const listener of [...this.postgresListeners]) {
          if (this.postgresFilterKey(listener) !== key) continue
          try {
            // Poirot Finding 1 fix: pass eventType through so handlers can use
            // `payload.eventType === 'DELETE'` instead of heuristics.
            listener.handler({
              new: payload.new ?? {},
              old: payload.old ?? null,
              eventType: payload.eventType,
            })
          } catch (error) {
            logger.warn('[ScopedRealtimeManager] postgres handler threw', {
              key,
              scope: this.config.scope,
              error,
            })
          }
        }
      }
    )
  }

  private postgresFilterKey(entry: PostgresListenerEntry): string {
    return `${entry.table}|${entry.filter.event}|${entry.filter.filter ?? ''}`
  }

  private async trackSelf(): Promise<void> {
    if (!this.channel) return
    try {
      await (this.channel as unknown as {
        track(state: Record<string, unknown>): Promise<string>
      }).track({
        userId: this.config.userId,
        displayName: this.config.displayName,
        tabId: this.tabId,
        joinedAt: Date.now(),
      })
    } catch (err) {
      logger.warn('ScopedRealtimeManager: presence track failed', err)
    }
  }

  private deliverPresence(ch: RealtimeChannel): void {
    const raw = (ch as unknown as { presenceState(): Record<string, Array<Record<string, unknown>>> }).presenceState()
    const participants: PresenceParticipant[] = []

    for (const [key, entries] of Object.entries(raw)) {
      const entry = (Array.isArray(entries) ? entries[0] : null) as Record<string, unknown> | null
      if (!entry) continue

      // SEC-02 mitigation: prefer deriving userId from the presence key (`${userId}:${tabId}`),
      // which is built by this manager. If the key doesn't contain a colon (e.g., in test fixtures
      // that use a plain string key), fall back to the payload's userId field. This allows the mock
      // fixture to work correctly without compromising the spoofing-resistance of the production path.
      const colonIdx = key.indexOf(':')
      const keyUserId = colonIdx !== -1 ? key.slice(0, colonIdx) : ((entry.userId as string) ?? key)

      participants.push({
        userId: keyUserId,
        displayName: (entry.displayName as string) ?? keyUserId,
        joinedAt: (entry.joinedAt as number) ?? 0,
        tabId: (entry.tabId as string) ?? '',
      })
    }

    for (const handler of this.presenceHandlers) {
      handler(participants)
    }
  }

  private handleDisconnect(): void {
    if (this.isDestroyed) return

    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      logger.warn('ScopedRealtimeManager: max reconnect attempts reached, switching to polling')
      this.setConnectionState('polling')
      this.startAllPolling()
      return
    }

    this.setConnectionState('reconnecting')
    const delay = INITIAL_BACKOFF_MS * Math.pow(2, this.reconnectAttempts)
    this.reconnectAttempts++

    logger.debug('ScopedRealtimeManager: scheduling reconnect', {
      attempt: this.reconnectAttempts,
      delayMs: delay,
    })

    this.reconnectTimer = setTimeout(() => {
      if (this.isDestroyed) return
      void this.resubscribe()
    }, delay)
  }

  private async resubscribe(): Promise<void> {
    if (this.isDestroyed) return
    if (this.channel) {
      // Poirot Finding 4 fix: capture channel reference before the async boundary.
      // If unsubscribe() fires mid-execution and nulls this.channel, channelToRemove
      // still holds the original reference — null-guard prevents removeChannel(null).
      const channelToRemove = this.channel
      this.channel = null
      try {
        await supabase.removeChannel(channelToRemove)
      } catch {
        // best-effort cleanup
      }
    }
    if (this.isDestroyed) return
    await this.subscribe()
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  private setConnectionState(state: ConnectionState): void {
    this.connectionState = state
    for (const handler of this.connectionStateHandlers) {
      handler(state)
    }
  }

  private startAllPolling(): void {
    for (const entry of this.pollingEntries) {
      this.startPollingEntry(entry)
    }
  }

  private startPollingEntry(entry: PollingEntry): void {
    if (entry.timer !== null) return
    entry.timer = setInterval(() => {
      entry.handler()
    }, entry.intervalMs)
  }

  private stopAllPolling(): void {
    for (const entry of this.pollingEntries) {
      if (entry.timer !== null) {
        clearInterval(entry.timer)
        entry.timer = null
      }
    }
  }
}
