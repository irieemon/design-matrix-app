/**
 * useProjectRealtime — Phase 05.4b Wave 1, Unit 1.3
 *
 * Owns the single ScopedRealtimeManager for the project scope (D-25).
 * Wires postgres_changes listeners that MERGE payloads into the injected
 * setIdeas setter (D-34 — avoids the broken RealtimeSubscriptionManager path).
 * Tracks previousConnectionState via ref for recovery toast gating (D-24).
 * Registers a 10s polling-tick reconcile handler (D-22).
 *
 * Consumed by ProjectRealtimeContext.Provider (D-32). Not used directly
 * inside components — use useProjectRealtimeContext() instead.
 */

import { useEffect, useRef, useState } from 'react'
import { ScopedRealtimeManager } from '../lib/realtime/ScopedRealtimeManager'
import type { ConnectionState, PresenceParticipant } from '../lib/realtime/ScopedRealtimeManager'
import { IdeaRepository } from '../lib/repositories/ideaRepository'
import type { IdeaCard } from '../types'

export interface UseProjectRealtimeOptions {
  projectId: string
  currentUserId: string
  currentUserDisplayName: string
  /** Injected from useIdeas — receives merged updates from remote clients (D-34). */
  setIdeas: React.Dispatch<React.SetStateAction<IdeaCard[]>>
}

export interface UseProjectRealtimeReturn {
  manager: ScopedRealtimeManager | null
  connectionState: ConnectionState
  /** The state prior to the current one — used by ReconnectingBadge to gate recovery toast (D-24). */
  previousConnectionState: ConnectionState | null
  participants: PresenceParticipant[]
}

export function useProjectRealtime(
  opts: UseProjectRealtimeOptions
): UseProjectRealtimeReturn {
  const { projectId, currentUserId, currentUserDisplayName, setIdeas } = opts

  const [manager, setManager] = useState<ScopedRealtimeManager | null>(null)
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting')
  const [participants, setParticipants] = useState<PresenceParticipant[]>([])

  // D-24: track prior connection state via ref so transition detection is
  // synchronous inside the state-change handler without stale closure risk.
  const previousConnectionStateRef = useRef<ConnectionState | null>(null)
  const [previousConnectionState, setPreviousConnectionState] =
    useState<ConnectionState | null>(null)

  // Keep setIdeas stable via ref so the postgres_changes handlers always see
  // the latest setter without needing it in the effect dep array.
  const setIdeasRef = useRef(setIdeas)
  useEffect(() => {
    setIdeasRef.current = setIdeas
  })

  useEffect(() => {
    const mgr = new ScopedRealtimeManager({
      scope: { type: 'project', id: projectId },
      userId: currentUserId,
      displayName: currentUserDisplayName,
    })

    // -----------------------------------------------------------------------
    // D-34: postgres_changes listeners — merge payloads, do NOT clear state.
    // -----------------------------------------------------------------------
    const filter = `project_id=eq.${projectId}`

    mgr.onPostgresChange<IdeaCard>(
      'ideas',
      { event: 'UPDATE', filter },
      (payload) => {
        setIdeasRef.current((prev) =>
          prev.map((idea) =>
            idea.id === (payload.new as IdeaCard).id
              ? { ...idea, ...payload.new }
              : idea
          )
        )
      }
    )

    mgr.onPostgresChange<IdeaCard>(
      'ideas',
      { event: 'INSERT', filter },
      (payload) => {
        const incoming = payload.new as IdeaCard
        setIdeasRef.current((prev) =>
          prev.some((i) => i.id === incoming.id) ? prev : [...prev, incoming]
        )
      }
    )

    mgr.onPostgresChange<IdeaCard>(
      'ideas',
      { event: 'DELETE', filter },
      (payload) => {
        // DELETE payloads carry the deleted row in `old`; `new` is empty.
        const deletedId =
          (payload.old as IdeaCard | null)?.id ??
          (payload.new as IdeaCard | null)?.id
        if (deletedId) {
          setIdeasRef.current((prev) => prev.filter((i) => i.id !== deletedId))
        }
      }
    )

    // -----------------------------------------------------------------------
    // Presence
    // -----------------------------------------------------------------------
    mgr.onPresence((incoming) => {
      setParticipants(incoming)
    })

    // -----------------------------------------------------------------------
    // Connection state — track previous for D-24 recovery toast gating.
    // -----------------------------------------------------------------------
    const unsubscribeConnectionState = mgr.onConnectionStateChange((state) => {
      setPreviousConnectionState(previousConnectionStateRef.current)
      previousConnectionStateRef.current = state as ConnectionState
      setConnectionState(state as ConnectionState)
    })

    // -----------------------------------------------------------------------
    // D-22: 10s polling-tick reconcile
    // -----------------------------------------------------------------------
    const unsubscribePolling = mgr.onPollingTick(async () => {
      const ideas = await IdeaRepository.getProjectIdeas(projectId)
      setIdeasRef.current(ideas)
    }, 10000)

    void mgr.subscribe()
    setManager(mgr)

    return () => {
      unsubscribeConnectionState()
      unsubscribePolling()
      void mgr.unsubscribe()
      setManager(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, currentUserId, currentUserDisplayName])

  return { manager, connectionState, previousConnectionState, participants }
}
