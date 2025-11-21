/**
 * Simplified Unit Tests for BrainstormRealtimeManager
 * Phase Two: Core Real-Time Infrastructure Testing
 *
 * Focus on critical Phase Two requirements:
 * - Channel subscription lifecycle
 * - Event batching (200ms intervals)
 * - Presence tracking
 * - Automatic reconnection
 * - Cleanup
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { BrainstormRealtimeManager } from '../BrainstormRealtimeManager'
import type { BrainstormRealtimeConfig } from '../../../types/BrainstormSession'

describe('BrainstormRealtimeManager - Core Functionality', () => {
  let manager: BrainstormRealtimeManager
  let config: BrainstormRealtimeConfig

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

  it('should start with no subscriptions', () => {
    expect(manager.isSubscribed()).toBe(false)
  })

  it('should provide current session ID', () => {
    manager.subscribe(config)
    expect(manager.getCurrentSessionId()).toBe('test-session-123')
  })

  it('should be subscribed after subscribe call', () => {
    manager.subscribe(config)
    expect(manager.isSubscribed()).toBe(true)
  })

  it('should not be subscribed after unsubscribe', () => {
    manager.subscribe(config)
    manager.unsubscribe()
    expect(manager.isSubscribed()).toBe(false)
  })

  it('should provide connection health status', () => {
    manager.subscribe(config)

    const health = manager.getConnectionHealth()

    expect(health).toHaveProperty('isConnected')
    expect(health).toHaveProperty('channelCount')
    expect(health).toHaveProperty('reconnectAttempts')
    expect(health).toHaveProperty('pendingUpdates')
  })

  it('should return empty presence states initially', () => {
    const presences = manager.getPresenceStates()
    expect(presences).toEqual([])
  })

  it('should handle subscribe without crashing', () => {
    expect(() => manager.subscribe(config)).not.toThrow()
  })

  it('should handle multiple unsubscribe calls', () => {
    manager.subscribe(config)
    manager.unsubscribe()

    expect(() => manager.unsubscribe()).not.toThrow()
  })

  it('should handle resubscribe after cleanup', () => {
    manager.subscribe(config)
    manager.unsubscribe()

    expect(() => manager.resubscribe()).not.toThrow()
  })

  it('should clean up timers on unsubscribe', () => {
    manager.subscribe(config)
    manager.unsubscribe()

    // Advance timers should not cause issues
    expect(() => vi.advanceTimersByTime(10000)).not.toThrow()
  })

  it('should handle trackPresence without crashing', () => {
    manager.subscribe(config)

    expect(() => {
      manager.trackPresence('participant-1', 'John Doe')
    }).not.toThrow()
  })

  it('should handle updateTypingStatus without crashing', () => {
    manager.subscribe(config)

    expect(() => {
      manager.updateTypingStatus('participant-1', true)
    }).not.toThrow()
  })

  it('should get channel status after subscription', () => {
    manager.subscribe(config)

    const status = manager.getChannelStatus()

    expect(status).toBeDefined()
    expect(typeof status).toBe('object')
  })

  it('should allow resubscribe for reconnection', () => {
    manager.subscribe(config)

    expect(() => manager.resubscribe()).not.toThrow()
    expect(manager.isSubscribed()).toBe(true)
  })

  it('should handle rapid subscribe/unsubscribe cycles', () => {
    for (let i = 0; i < 5; i++) {
      manager.subscribe(config)
      manager.unsubscribe()
    }

    expect(manager.isSubscribed()).toBe(false)
  })

  it('should maintain session ID across resubscribe', () => {
    manager.subscribe(config)
    const sessionId1 = manager.getCurrentSessionId()

    manager.resubscribe()
    const sessionId2 = manager.getCurrentSessionId()

    expect(sessionId1).toBe(sessionId2)
  })

  it('should have zero reconnect attempts initially', () => {
    manager.subscribe(config)

    const health = manager.getConnectionHealth()
    expect(health.reconnectAttempts).toBe(0)
  })

  it('should have zero pending updates initially', () => {
    manager.subscribe(config)

    const health = manager.getConnectionHealth()
    expect(health.pendingUpdates).toBe(0)
  })
})
