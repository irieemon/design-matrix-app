/**
 * Unit Tests for BrainstormRealtimeManager
 * Phase Two: Real-Time Infrastructure Testing
 *
 * Tests cover:
 * - Channel subscription lifecycle
 * - Event batching (200ms intervals)
 * - Presence tracking
 * - Automatic reconnection with exponential backoff
 * - Error handling and cleanup
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { BrainstormRealtimeManager, type PresenceState } from '../BrainstormRealtimeManager'
import type { BrainstormRealtimeConfig, SessionState } from '../../../types/BrainstormSession'

// Mock Supabase - use factory function to avoid hoisting issues
vi.mock('../../supabase', () => {
  const mockChannel = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn((callback: any) => {
      // Immediately call with SUBSCRIBED status
      callback('SUBSCRIBED', null)
      return mockChannel
    }),
    track: vi.fn(),
    send: vi.fn(),
    presenceState: vi.fn(() => ({})),
    state: 'joined',
    unsubscribe: vi.fn()
  }

  return {
    supabase: {
      channel: vi.fn(() => mockChannel),
      removeChannel: vi.fn()
    }
  }
})

describe('BrainstormRealtimeManager', () => {
  let manager: BrainstormRealtimeManager
  let config: BrainstormRealtimeConfig

  // Helper to get mocked channel
  const getMockChannel = () => {
    const { supabase } = require('../../supabase')
    return supabase.channel()
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()

    manager = new BrainstormRealtimeManager()
    config = {
      sessionId: 'test-session-123',
      onIdeaCreated: vi.fn(),
      onIdeaUpdated: vi.fn(),
      onIdeaDeleted: vi.fn(),
      onParticipantJoined: vi.fn(),
      onParticipantLeft: vi.fn(),
      onSessionStateChanged: vi.fn()
    }
  })

  afterEach(() => {
    manager.unsubscribe()
    vi.useRealTimers()
  })

  describe('Channel Subscription', () => {
    it('should create three channels on subscribe', () => {
      const { supabase } = require('../../supabase')

      manager.subscribe(config)

      // Should create ideas, participants, and session channels
      expect(supabase.channel).toHaveBeenCalledTimes(3)
      expect(supabase.channel).toHaveBeenCalledWith(
        `ideas:test-session-123`,
        expect.objectContaining({
          config: {
            broadcast: { self: false },
            presence: { key: 'test-session-123' }
          }
        })
      )
      expect(supabase.channel).toHaveBeenCalledWith(`participants:test-session-123`)
      expect(supabase.channel).toHaveBeenCalledWith(`session:test-session-123`)
    })

    it('should register postgres_changes listeners for ideas', () => {
      const mockChannel = getMockChannel()

      manager.subscribe(config)

      // Verify INSERT, UPDATE, DELETE listeners registered
      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({
          event: 'INSERT',
          schema: 'public',
          table: 'ideas',
          filter: `session_id=eq.test-session-123`
        }),
        expect.any(Function)
      )

      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({
          event: 'UPDATE',
          schema: 'public',
          table: 'ideas'
        }),
        expect.any(Function)
      )

      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({
          event: 'DELETE',
          schema: 'public',
          table: 'ideas'
        }),
        expect.any(Function)
      )
    })

    it('should subscribe to all channels', () => {
      const mockChannel = getMockChannel()

      manager.subscribe(config)

      expect(mockChannel.subscribe).toHaveBeenCalledTimes(3)
    })

    it('should be subscribed after successful subscription', () => {
      manager.subscribe(config)

      expect(manager.isSubscribed()).toBe(true)
    })

    it('should unsubscribe from all channels on cleanup', () => {
      const { supabase } = require('../../supabase')

      manager.subscribe(config)
      manager.unsubscribe()

      expect(supabase.removeChannel).toHaveBeenCalledTimes(3)
      expect(manager.isSubscribed()).toBe(false)
    })
  })

  describe('Event Handling - Idea Created', () => {
    it('should call onIdeaCreated immediately for INSERT events', () => {
      const mockChannel = getMockChannel()

      manager.subscribe(config)

      // Find the INSERT handler
      const insertCall = mockChannel.on.mock.calls.find(
        (call) => call[0] === 'postgres_changes' && call[1].event === 'INSERT'
      )
      const insertHandler = insertCall?.[2]

      const newIdea = {
        id: 'idea-1',
        content: 'Test Idea',
        session_id: 'test-session-123',
        x_position: 50,
        y_position: 50
      }

      insertHandler?.({ new: newIdea })

      // Should call immediately (no batching for INSERT)
      expect(config.onIdeaCreated).toHaveBeenCalledWith(newIdea)
      expect(config.onIdeaCreated).toHaveBeenCalledTimes(1)
    })
  })

  describe('Event Batching - Idea Updated', () => {
    it('should batch UPDATE events and flush after 200ms', () => {
      const mockChannel = getMockChannel()

      manager.subscribe(config)

      // Find the UPDATE handler
      const updateCall = mockChannel.on.mock.calls.find(
        (call) => call[0] === 'postgres_changes' && call[1].event === 'UPDATE'
      )
      const updateHandler = updateCall?.[2]

      const updatedIdea1 = {
        id: 'idea-1',
        content: 'Updated Idea 1',
        session_id: 'test-session-123'
      }

      const updatedIdea2 = {
        id: 'idea-2',
        content: 'Updated Idea 2',
        session_id: 'test-session-123'
      }

      // Trigger two updates
      updateHandler?.({ new: updatedIdea1 })
      updateHandler?.({ new: updatedIdea2 })

      // Should NOT call immediately
      expect(config.onIdeaUpdated).not.toHaveBeenCalled()

      // Advance timer by 200ms
      vi.advanceTimersByTime(200)

      // Should have flushed both updates
      expect(config.onIdeaUpdated).toHaveBeenCalledTimes(2)
      expect(config.onIdeaUpdated).toHaveBeenCalledWith(updatedIdea1)
      expect(config.onIdeaUpdated).toHaveBeenCalledWith(updatedIdea2)
    })

    it('should handle multiple UPDATE events for same idea', () => {
      manager.subscribe(config)

      const updateCall = mockChannel.on.mock.calls.find(
        (call) => call[0] === 'postgres_changes' && call[1].event === 'UPDATE'
      )
      const updateHandler = updateCall?.[2]

      // Update same idea multiple times
      updateHandler?.({ new: { id: 'idea-1', content: 'Version 1' } })
      updateHandler?.({ new: { id: 'idea-1', content: 'Version 2' } })
      updateHandler?.({ new: { id: 'idea-1', content: 'Version 3' } })

      vi.advanceTimersByTime(200)

      // Should only call once with the latest version (batching deduplication)
      expect(config.onIdeaUpdated).toHaveBeenCalledTimes(1)
      expect(config.onIdeaUpdated).toHaveBeenCalledWith({
        id: 'idea-1',
        content: 'Version 3'
      })
    })

    it('should flush pending updates on cleanup', () => {
      manager.subscribe(config)

      const updateCall = mockChannel.on.mock.calls.find(
        (call) => call[0] === 'postgres_changes' && call[1].event === 'UPDATE'
      )
      const updateHandler = updateCall?.[2]

      updateHandler?.({ new: { id: 'idea-1', content: 'Test' } })

      // Cleanup before timer expires
      manager.unsubscribe()

      // Should have flushed immediately
      expect(config.onIdeaUpdated).toHaveBeenCalledTimes(1)
    })
  })

  describe('Event Handling - Idea Deleted', () => {
    it('should call onIdeaDeleted with idea ID', () => {
      manager.subscribe(config)

      const deleteCall = mockChannel.on.mock.calls.find(
        (call) => call[0] === 'postgres_changes' && call[1].event === 'DELETE'
      )
      const deleteHandler = deleteCall?.[2]

      deleteHandler?.({ old: { id: 'idea-1' } })

      expect(config.onIdeaDeleted).toHaveBeenCalledWith('idea-1')
    })
  })

  describe('Presence Tracking', () => {
    it('should track presence when called', () => {
      manager.subscribe(config)

      manager.trackPresence('participant-1', 'John Doe')

      expect(mockChannel.track).toHaveBeenCalledWith({
        participantId: 'participant-1',
        participantName: 'John Doe',
        lastActive: expect.any(Number),
        isTyping: false
      })
    })

    it('should update typing status', () => {
      manager.subscribe(config)

      manager.updateTypingStatus('participant-1', true)

      expect(mockChannel.send).toHaveBeenCalledWith({
        type: 'broadcast',
        event: 'typing',
        payload: { participantId: 'participant-1', isTyping: true }
      })
    })

    it('should handle presence sync', () => {
      manager.subscribe(config)

      // Find presence sync handler
      const syncCall = mockChannel.on.mock.calls.find(
        (call) => call[0] === 'presence' && call[1].event === 'sync'
      )
      const syncHandler = syncCall?.[2]

      // Mock presence state
      mockChannel.presenceState.mockReturnValue({
        'participant-1': [
          {
            participantId: 'participant-1',
            participantName: 'John Doe',
            isTyping: false,
            lastActive: Date.now()
          }
        ]
      })

      syncHandler?.()

      const presences = manager.getPresenceStates()
      expect(presences).toHaveLength(1)
      expect(presences[0].participantId).toBe('participant-1')
    })
  })

  describe('Automatic Reconnection', () => {
    it('should attempt reconnection on channel error', () => {
      const subscribeSpy = vi.spyOn(manager, 'subscribe')

      manager.subscribe(config)

      // Simulate channel error
      const subscribeCall = mockChannel.subscribe.mock.calls[0]
      const subscribeCallback = subscribeCall[0]

      subscribeCallback('CHANNEL_ERROR', new Error('Connection lost'))

      // Advance timer to trigger first reconnection attempt (1s delay)
      vi.advanceTimersByTime(1000)

      expect(subscribeSpy).toHaveBeenCalledTimes(2)
    })

    it('should use exponential backoff for reconnection', () => {
      const subscribeSpy = vi.spyOn(manager, 'subscribe')

      manager.subscribe(config)

      const subscribeCallback = mockChannel.subscribe.mock.calls[0][0]

      // First attempt: 1s delay
      subscribeCallback('CHANNEL_ERROR', new Error('Connection lost'))
      vi.advanceTimersByTime(1000)
      expect(subscribeSpy).toHaveBeenCalledTimes(2)

      // Second attempt: 2s delay (exponential backoff)
      subscribeCallback('CHANNEL_ERROR', new Error('Connection lost'))
      vi.advanceTimersByTime(2000)
      expect(subscribeSpy).toHaveBeenCalledTimes(3)

      // Third attempt: 4s delay
      subscribeCallback('CHANNEL_ERROR', new Error('Connection lost'))
      vi.advanceTimersByTime(4000)
      expect(subscribeSpy).toHaveBeenCalledTimes(4)
    })

    it('should stop reconnecting after max attempts (5)', () => {
      const subscribeSpy = vi.spyOn(manager, 'subscribe')

      manager.subscribe(config)

      const subscribeCallback = mockChannel.subscribe.mock.calls[0][0]

      // Trigger 5 reconnection attempts
      for (let i = 0; i < 5; i++) {
        subscribeCallback('CHANNEL_ERROR', new Error('Connection lost'))
        vi.advanceTimersByTime(Math.pow(2, i) * 1000)
      }

      // Attempt 6th reconnection
      subscribeCallback('CHANNEL_ERROR', new Error('Connection lost'))
      vi.advanceTimersByTime(32000)

      // Should not exceed 6 total calls (1 initial + 5 reconnects)
      expect(subscribeSpy).toHaveBeenCalledTimes(6)
    })

    it('should reset reconnect attempts on successful subscription', () => {
      manager.subscribe(config)

      const subscribeCallback = mockChannel.subscribe.mock.calls[0][0]

      // Trigger error
      subscribeCallback('CHANNEL_ERROR', new Error('Connection lost'))
      vi.advanceTimersByTime(1000)

      // Simulate successful reconnection
      subscribeCallback('SUBSCRIBED', null)

      const health = manager.getConnectionHealth()
      expect(health.reconnectAttempts).toBe(0)
    })
  })

  describe('Connection Health', () => {
    it('should report connected when all channels joined', () => {
      manager.subscribe(config)

      const health = manager.getConnectionHealth()

      expect(health.isConnected).toBe(true)
      expect(health.channelCount).toBe(3)
      expect(health.reconnectAttempts).toBe(0)
      expect(health.pendingUpdates).toBe(0)
    })

    it('should track pending updates count', () => {
      manager.subscribe(config)

      const updateCall = mockChannel.on.mock.calls.find(
        (call) => call[0] === 'postgres_changes' && call[1].event === 'UPDATE'
      )
      const updateHandler = updateCall?.[2]

      // Add 3 pending updates
      updateHandler?.({ new: { id: 'idea-1', content: 'Test' } })
      updateHandler?.({ new: { id: 'idea-2', content: 'Test' } })
      updateHandler?.({ new: { id: 'idea-3', content: 'Test' } })

      const health = manager.getConnectionHealth()
      expect(health.pendingUpdates).toBe(3)

      // Flush updates
      vi.advanceTimersByTime(200)

      const healthAfter = manager.getConnectionHealth()
      expect(healthAfter.pendingUpdates).toBe(0)
    })
  })

  describe('Session State Updates', () => {
    it('should handle session state changes', () => {
      manager.subscribe(config)

      const sessionUpdateCall = mockChannel.on.mock.calls.find(
        (call) =>
          call[0] === 'postgres_changes' &&
          call[1].table === 'brainstorm_sessions' &&
          call[1].event === 'UPDATE'
      )
      const sessionUpdateHandler = sessionUpdateCall?.[2]

      const updatedSession = {
        id: 'test-session-123',
        status: 'active',
        expires_at: new Date(Date.now() + 3600000).toISOString() // 1 hour from now
      }

      sessionUpdateHandler?.({ new: updatedSession })

      expect(config.onSessionStateChanged).toHaveBeenCalledWith({
        status: 'active',
        timeRemaining: expect.any(Number)
      })

      const call = config.onSessionStateChanged.mock.calls[0][0] as SessionState
      expect(call.timeRemaining).toBeGreaterThan(0)
    })
  })

  describe('Cleanup and Lifecycle', () => {
    it('should clear all timers on unsubscribe', () => {
      manager.subscribe(config)

      // Trigger some batched updates
      const updateCall = mockChannel.on.mock.calls.find(
        (call) => call[0] === 'postgres_changes' && call[1].event === 'UPDATE'
      )
      const updateHandler = updateCall?.[2]
      updateHandler?.({ new: { id: 'idea-1', content: 'Test' } })

      manager.unsubscribe()

      // Should not throw when timers advance
      expect(() => vi.advanceTimersByTime(1000)).not.toThrow()
    })

    it('should not allow resubscription after cleanup', () => {
      manager.subscribe(config)
      manager.unsubscribe()

      // Attempt to resubscribe
      manager.subscribe(config)

      expect(manager.isSubscribed()).toBe(false)
    })

    it('should provide resubscribe method for reconnection', () => {
      manager.subscribe(config)

      const { supabase } = require('../../supabase')
      vi.clearAllMocks()

      manager.resubscribe()

      // Should unsubscribe old channels and create new ones
      expect(mockRemoveChannel).toHaveBeenCalledTimes(3)
      expect(supabase.channel).toHaveBeenCalledTimes(3)
    })
  })

  describe('Participant Events', () => {
    it('should handle participant joined', () => {
      manager.subscribe(config)

      const participantInsertCall = mockChannel.on.mock.calls.find(
        (call) =>
          call[0] === 'postgres_changes' &&
          call[1].table === 'session_participants' &&
          call[1].event === 'INSERT'
      )
      const participantInsertHandler = participantInsertCall?.[2]

      const newParticipant = {
        id: 'participant-1',
        participant_name: 'John Doe',
        session_id: 'test-session-123'
      }

      participantInsertHandler?.({ new: newParticipant })

      expect(config.onParticipantJoined).toHaveBeenCalledWith(newParticipant)
    })

    it('should handle participant left via disconnected_at', () => {
      manager.subscribe(config)

      const participantUpdateCall = mockChannel.on.mock.calls.find(
        (call) =>
          call[0] === 'postgres_changes' &&
          call[1].table === 'session_participants' &&
          call[1].event === 'UPDATE'
      )
      const participantUpdateHandler = participantUpdateCall?.[2]

      const disconnectedParticipant = {
        id: 'participant-1',
        disconnected_at: new Date().toISOString()
      }

      participantUpdateHandler?.({ new: disconnectedParticipant })

      expect(config.onParticipantLeft).toHaveBeenCalledWith('participant-1')
    })
  })
})
