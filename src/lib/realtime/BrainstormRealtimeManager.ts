/**
 * Brainstorm Realtime Manager
 * Phase Two Implementation
 *
 * Enhanced WebSocket coordination with:
 * - Automatic reconnection
 * - Presence tracking
 * - Event batching and throttling
 * - Error handling and recovery
 * - Channel lifecycle management
 */

import { supabase } from '../supabase'
import type { BrainstormRealtimeConfig, SessionState } from '../../types/BrainstormSession'
import { RealtimeChannel, REALTIME_LISTEN_TYPES } from '@supabase/supabase-js'

export interface PresenceState {
  participantId: string
  participantName: string
  isTyping?: boolean
  lastActive: number
  cursorPosition?: { x: number; y: number }
}

export class BrainstormRealtimeManager {
  private channels: Map<string, RealtimeChannel> = new Map()
  private config: BrainstormRealtimeConfig | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000 // Start with 1 second
  private reconnectTimer: NodeJS.Timeout | null = null
  private eventBatchTimer: NodeJS.Timeout | null = null
  private pendingUpdates: Map<string, any> = new Map()
  private batchInterval = 200 // 200ms flush interval
  private presenceState: Map<string, PresenceState> = new Map()
  private isCleanedUp = false

  /**
   * Subscribe to all real-time events for a session
   */
  subscribe(config: BrainstormRealtimeConfig): void {
    if (this.isCleanedUp) {
      console.warn('Manager was cleaned up, cannot resubscribe')
      return
    }

    this.config = config
    const sessionId = config.sessionId

    // Unsubscribe from existing channels first
    // IMPORTANT: Pass false to avoid marking manager as permanently cleaned up
    // This allows subscribe() to be called again for new sessions or resubscriptions
    this.cleanup(false)

    // Reset reconnection state
    this.reconnectAttempts = 0
    this.reconnectDelay = 1000

    try {
      // Create ideas channel with error handling
      const ideasChannel = supabase
        .channel(`ideas:${sessionId}`, {
          config: {
            broadcast: { self: false }, // Don't receive own broadcasts
            presence: { key: sessionId }
          }
        })
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'ideas',
            filter: `session_id=eq.${sessionId}`
          },
          (payload) => {
            this.handleIdeaCreated(payload.new)
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'ideas',
            filter: `session_id=eq.${sessionId}`
          },
          (payload) => {
            this.handleIdeaUpdated(payload.new)
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'ideas',
            filter: `session_id=eq.${sessionId}`
          },
          (payload) => {
            config.onIdeaDeleted(payload.old.id)
          }
        )
        .subscribe((status, error) => {
          if (status === 'SUBSCRIBED') {
            console.log('Ideas channel subscribed')
            this.reconnectAttempts = 0
          } else if (status === 'CLOSED') {
            this.handleDisconnection('ideas')
          } else if (status === 'CHANNEL_ERROR') {
            console.error('Ideas channel error:', error)
            this.handleDisconnection('ideas')
          }
        })

      this.channels.set('ideas', ideasChannel)

      // Create participants channel
      const participantsChannel = supabase
        .channel(`participants:${sessionId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'session_participants',
            filter: `session_id=eq.${sessionId}`
          },
          (payload) => {
            config.onParticipantJoined(payload.new)
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'session_participants',
            filter: `session_id=eq.${sessionId}`
          },
          (payload) => {
            // Check if participant disconnected
            if (payload.new.disconnected_at) {
              config.onParticipantLeft(payload.new.id)
              this.removePresence(payload.new.id)
            } else {
              // Participant data was updated (e.g., contribution_count changed)
              // Propagate the update to the UI
              if (config.onParticipantUpdated) {
                console.log('📊 Participant updated:', {
                  id: payload.new.id,
                  contribution_count: payload.new.contribution_count,
                  last_active_at: payload.new.last_active_at
                })
                config.onParticipantUpdated(payload.new)
              }
            }
          }
        )
        .on(
          'presence',
          { event: 'sync' },
          () => {
            this.syncPresence(participantsChannel)
          }
        )
        .on(
          'presence',
          { event: 'join' },
          ({ key, newPresences }) => {
            this.handlePresenceJoin(newPresences)
          }
        )
        .on(
          'presence',
          { event: 'leave' },
          ({ key, leftPresences }) => {
            this.handlePresenceLeave(leftPresences)
          }
        )
        .on(
          'broadcast',
          { event: 'typing' },
          ({ payload }) => {
            this.handleTypingIndicator(payload)
          }
        )
        .subscribe((status, error) => {
          if (status === 'SUBSCRIBED') {
            console.log('Participants channel subscribed')
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            console.error('Participants channel error:', error)
            this.handleDisconnection('participants')
          }
        })

      this.channels.set('participants', participantsChannel)

      // Create session state channel
      const sessionChannel = supabase
        .channel(`session:${sessionId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'brainstorm_sessions',
            filter: `id=eq.${sessionId}`
          },
          (payload) => {
            const session = payload.new
            const timeRemaining = new Date(session.expires_at).getTime() - Date.now()

            const state: SessionState = {
              status: session.status,
              timeRemaining: Math.max(0, timeRemaining)
            }

            config.onSessionStateChanged(state)
          }
        )
        .subscribe((status, error) => {
          if (status === 'SUBSCRIBED') {
            console.log('Session channel subscribed')
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            console.error('Session channel error:', error)
            this.handleDisconnection('session')
          }
        })

      this.channels.set('session', sessionChannel)

      // Start batch processing timer
      this.startBatchProcessing()
    } catch (error) {
      console.error('Error subscribing to channels:', error)
      this.handleDisconnection('all')
    }
  }

  /**
   * Handle idea created with batching
   */
  private handleIdeaCreated(idea: any): void {
    if (!this.config) return

    // Immediate callback for new ideas (no batching for INSERT)
    this.config.onIdeaCreated(idea)
  }

  /**
   * Handle idea updated with batching
   */
  private handleIdeaUpdated(idea: any): void {
    if (!this.config) return

    // Batch UPDATE events to prevent excessive re-renders
    this.pendingUpdates.set(idea.id, idea)
  }

  /**
   * Start batch processing timer
   */
  private startBatchProcessing(): void {
    if (this.eventBatchTimer) {
      clearInterval(this.eventBatchTimer)
    }

    this.eventBatchTimer = setInterval(() => {
      this.flushPendingUpdates()
    }, this.batchInterval)
  }

  /**
   * Flush pending updates
   */
  private flushPendingUpdates(): void {
    if (!this.config || this.pendingUpdates.size === 0) return

    // Process all pending updates
    this.pendingUpdates.forEach((idea) => {
      this.config!.onIdeaUpdated(idea)
    })

    this.pendingUpdates.clear()
  }

  /**
   * Handle presence sync
   */
  private syncPresence(channel: RealtimeChannel): void {
    const presences = channel.presenceState()
    // Update local presence state
    Object.entries(presences).forEach(([key, presence]) => {
      if (Array.isArray(presence) && presence[0]) {
        this.presenceState.set(key, presence[0] as PresenceState)
      }
    })
  }

  /**
   * Handle presence join
   */
  private handlePresenceJoin(newPresences: any[]): void {
    newPresences.forEach((presence) => {
      if (presence.participantId) {
        this.presenceState.set(presence.participantId, presence as PresenceState)
      }
    })
  }

  /**
   * Handle presence leave
   */
  private handlePresenceLeave(leftPresences: any[]): void {
    leftPresences.forEach((presence) => {
      if (presence.participantId) {
        this.presenceState.delete(presence.participantId)
      }
    })
  }

  /**
   * Handle typing indicator
   */
  private handleTypingIndicator(payload: { participantId: string; isTyping: boolean }): void {
    const presence = this.presenceState.get(payload.participantId)
    if (presence) {
      presence.isTyping = payload.isTyping
      presence.lastActive = Date.now()
      this.presenceState.set(payload.participantId, presence)
    }
  }

  /**
   * Track presence for current participant
   */
  trackPresence(participantId: string, participantName: string): void {
    const participantsChannel = this.channels.get('participants')
    if (!participantsChannel) return

    participantsChannel.track({
      participantId,
      participantName,
      lastActive: Date.now(),
      isTyping: false
    })
  }

  /**
   * Update typing status
   */
  updateTypingStatus(participantId: string, isTyping: boolean): void {
    const participantsChannel = this.channels.get('participants')
    if (!participantsChannel) return

    // Broadcast typing status
    participantsChannel.send({
      type: 'broadcast',
      event: 'typing',
      payload: { participantId, isTyping }
    })

    // Update presence
    const presence = this.presenceState.get(participantId)
    if (presence) {
      presence.isTyping = isTyping
      presence.lastActive = Date.now()
      participantsChannel.track(presence)
    }
  }

  /**
   * Remove presence for a participant
   */
  private removePresence(participantId: string): void {
    this.presenceState.delete(participantId)
  }

  /**
   * Get all presence states
   */
  getPresenceStates(): PresenceState[] {
    return Array.from(this.presenceState.values())
  }

  /**
   * Handle disconnection and attempt reconnection
   * ENHANCED: Calls onConnectionFailed callback when max attempts reached to enable polling fallback
   */
  private handleDisconnection(channelType: string): void {
    if (this.isCleanedUp) return

    console.warn(`Channel ${channelType} disconnected, attempting reconnection...`)

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('📡 REALTIME: Max reconnection attempts reached - triggering polling fallback')
      // CRITICAL: Notify the UI that realtime has failed so polling can be activated
      if (this.config?.onConnectionFailed) {
        console.log('📡 REALTIME: Calling onConnectionFailed callback')
        this.config.onConnectionFailed()
      }
      return
    }

    // Clear existing timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
    }

    // Exponential backoff
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts)

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++
      console.log(`Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`)
      this.resubscribe()
    }, delay)
  }

  /**
   * Resubscribe (useful after connection loss)
   */
  resubscribe(): void {
    if (this.config && !this.isCleanedUp) {
      const config = this.config
      this.cleanup(false) // Don't mark as cleaned up
      this.subscribe(config)
    }
  }

  /**
   * Cleanup without unsubscribing (for internal use)
   */
  private cleanup(markAsCleanedUp = true): void {
    // Flush any pending updates before cleanup
    this.flushPendingUpdates()

    // Stop batch processing
    if (this.eventBatchTimer) {
      clearInterval(this.eventBatchTimer)
      this.eventBatchTimer = null
    }

    // Clear reconnection timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    // Unsubscribe from channels
    this.channels.forEach((channel) => {
      supabase.removeChannel(channel)
    })
    this.channels.clear()

    // Clear presence state
    this.presenceState.clear()

    // Clear pending updates
    this.pendingUpdates.clear()

    if (markAsCleanedUp) {
      this.isCleanedUp = true
      this.config = null
    }
  }

  /**
   * Unsubscribe from all channels and cleanup
   */
  unsubscribe(): void {
    this.cleanup(true)
  }

  /**
   * Check if currently subscribed
   */
  isSubscribed(): boolean {
    return this.channels.size > 0 && !this.isCleanedUp
  }

  /**
   * Get current session ID
   */
  getCurrentSessionId(): string | null {
    return this.config?.sessionId || null
  }

  /**
   * Get channel status
   */
  getChannelStatus(): Record<string, string> {
    const status: Record<string, string> = {}
    this.channels.forEach((channel, key) => {
      status[key] = channel.state
    })
    return status
  }

  /**
   * Get connection health
   */
  getConnectionHealth(): {
    isConnected: boolean
    channelCount: number
    reconnectAttempts: number
    pendingUpdates: number
  } {
    const allConnected = Array.from(this.channels.values()).every(
      (channel) => channel.state === 'joined'
    )

    return {
      isConnected: allConnected,
      channelCount: this.channels.size,
      reconnectAttempts: this.reconnectAttempts,
      pendingUpdates: this.pendingUpdates.size
    }
  }
}
