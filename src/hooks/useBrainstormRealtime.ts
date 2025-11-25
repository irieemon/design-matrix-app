/**
 * useBrainstormRealtime Hook
 * Phase Two Implementation
 *
 * React hook for managing real-time brainstorm session subscriptions
 * - Maintains local state for ideas and participants
 * - Responds to real-time database changes
 * - Handles connection lifecycle
 */

import { useEffect, useState, useRef, useCallback } from 'react'
import { BrainstormRealtimeManager, type PresenceState } from '../lib/realtime/BrainstormRealtimeManager'
import type { SessionParticipant, SessionState } from '../types/BrainstormSession'

export interface IdeaCard {
  id: string
  content: string
  details?: string
  priority?: 'low' | 'moderate' | 'high'
  x_position: number
  y_position: number
  created_at: string
  updated_at?: string
  participant_id?: string
  session_id?: string
}

export interface BrainstormRealtimeState {
  ideas: IdeaCard[]
  participants: SessionParticipant[]
  sessionState: SessionState | null
  presenceStates: PresenceState[]
  connectionHealth: {
    isConnected: boolean
    channelCount: number
    reconnectAttempts: number
    pendingUpdates: number
  }
  isSubscribed: boolean
}

export interface UseBrainstormRealtimeOptions {
  onIdeaCreated?: (idea: IdeaCard) => void
  onIdeaUpdated?: (idea: IdeaCard) => void
  onIdeaDeleted?: (ideaId: string) => void
  onParticipantJoined?: (participant: SessionParticipant) => void
  onParticipantLeft?: (participantId: string) => void
  /** Called when participant data is updated (e.g., contribution_count changes) */
  onParticipantUpdated?: (participant: SessionParticipant) => void
  onSessionStateChanged?: (state: SessionState) => void
  onConnectionChange?: (isConnected: boolean) => void
  /** Called when realtime connection fails after max reconnect attempts - use to activate polling fallback */
  onConnectionFailed?: () => void
}

export function useBrainstormRealtime(
  sessionId: string | null,
  options: UseBrainstormRealtimeOptions = {}
): BrainstormRealtimeState & {
  trackPresence: (participantId: string, participantName: string) => void
  updateTypingStatus: (participantId: string, isTyping: boolean) => void
  resubscribe: () => void
} {
  const [ideas, setIdeas] = useState<IdeaCard[]>([])
  const [participants, setParticipants] = useState<SessionParticipant[]>([])
  const [sessionState, setSessionState] = useState<SessionState | null>(null)
  const [presenceStates, setPresenceStates] = useState<PresenceState[]>([])
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [connectionHealth, setConnectionHealth] = useState({
    isConnected: false,
    channelCount: 0,
    reconnectAttempts: 0,
    pendingUpdates: 0
  })

  const managerRef = useRef<BrainstormRealtimeManager | null>(null)
  const healthCheckIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Store callbacks in refs to avoid dependency array issues
  // This prevents the infinite resubscribe loop caused by options changing every render
  const optionsRef = useRef(options)
  optionsRef.current = options

  // Initialize manager
  useEffect(() => {
    if (!managerRef.current) {
      managerRef.current = new BrainstormRealtimeManager()
    }
    return () => {
      if (managerRef.current) {
        managerRef.current.unsubscribe()
        managerRef.current = null
      }
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current)
      }
    }
  }, [])

  // Subscribe to session
  // NOTE: options is NOT in dependency array - we use optionsRef to avoid infinite resubscribe loop
  useEffect(() => {
    if (!sessionId || !managerRef.current) {
      setIsSubscribed(false)
      return
    }

    const manager = managerRef.current

    manager.subscribe({
      sessionId,
      onIdeaCreated: (idea: any) => {
        setIdeas((prev) => {
          // Prevent duplicates
          if (prev.some((i) => i.id === idea.id)) {
            return prev
          }
          const newIdeas = [...prev, idea as IdeaCard]
          optionsRef.current.onIdeaCreated?.(idea as IdeaCard)
          return newIdeas
        })
      },
      onIdeaUpdated: (idea: any) => {
        setIdeas((prev) => {
          const updated = prev.map((i) => (i.id === idea.id ? (idea as IdeaCard) : i))
          optionsRef.current.onIdeaUpdated?.(idea as IdeaCard)
          return updated
        })
      },
      onIdeaDeleted: (ideaId: string) => {
        setIdeas((prev) => {
          const filtered = prev.filter((i) => i.id !== ideaId)
          optionsRef.current.onIdeaDeleted?.(ideaId)
          return filtered
        })
      },
      onParticipantJoined: (participant: any) => {
        setParticipants((prev) => {
          // Prevent duplicates
          if (prev.some((p) => p.id === participant.id)) {
            return prev
          }
          const newParticipants = [...prev, participant as SessionParticipant]
          optionsRef.current.onParticipantJoined?.(participant as SessionParticipant)
          return newParticipants
        })
      },
      onParticipantLeft: (participantId: string) => {
        setParticipants((prev) => {
          const filtered = prev.filter((p) => p.id !== participantId)
          optionsRef.current.onParticipantLeft?.(participantId)
          return filtered
        })
      },
      onParticipantUpdated: (participant: any) => {
        console.log('📊 useBrainstormRealtime: Participant updated', {
          id: participant.id,
          contribution_count: participant.contribution_count
        })
        setParticipants((prev) => {
          const updated = prev.map((p) =>
            p.id === participant.id ? (participant as SessionParticipant) : p
          )
          optionsRef.current.onParticipantUpdated?.(participant as SessionParticipant)
          return updated
        })
      },
      onSessionStateChanged: (state: SessionState) => {
        setSessionState(state)
        optionsRef.current.onSessionStateChanged?.(state)
      },
      onConnectionFailed: () => {
        console.log('📡 useBrainstormRealtime: Connection failed - triggering polling fallback')
        optionsRef.current.onConnectionFailed?.()
      }
    })

    setIsSubscribed(true)

    // Start health check interval
    healthCheckIntervalRef.current = setInterval(() => {
      if (manager) {
        const health = manager.getConnectionHealth()
        setConnectionHealth((prev) => {
          if (prev.isConnected !== health.isConnected) {
            optionsRef.current.onConnectionChange?.(health.isConnected)
          }
          return health
        })

        // Update presence states
        setPresenceStates(manager.getPresenceStates())
      }
    }, 1000) // Check every second

    return () => {
      manager.unsubscribe()
      setIsSubscribed(false)
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current)
      }
    }
  }, [sessionId]) // Only resubscribe when sessionId changes, NOT when options changes

  // Wrapper functions for manager methods
  const trackPresence = useCallback((participantId: string, participantName: string) => {
    managerRef.current?.trackPresence(participantId, participantName)
  }, [])

  const updateTypingStatus = useCallback((participantId: string, isTyping: boolean) => {
    managerRef.current?.updateTypingStatus(participantId, isTyping)
  }, [])

  const resubscribe = useCallback(() => {
    managerRef.current?.resubscribe()
  }, [])

  return {
    ideas,
    participants,
    sessionState,
    presenceStates,
    connectionHealth,
    isSubscribed,
    trackPresence,
    updateTypingStatus,
    resubscribe
  }
}
