/**
 * useProjectRealtime — Phase 05.4b Wave 1, Unit 1.3
 *
 * Owns the single ScopedRealtimeManager for the project scope (D-25).
 * The manager is cached at MODULE level to survive React mount/unmount
 * cycles (StrictMode double-mount AND fullscreen transitions).
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
  setIdeas: React.Dispatch<React.SetStateAction<IdeaCard[]>>
}

export interface UseProjectRealtimeReturn {
  manager: ScopedRealtimeManager | null
  connectionState: ConnectionState
  previousConnectionState: ConnectionState | null
  participants: PresenceParticipant[]
}

// ---------------------------------------------------------------------------
// Module-level manager cache — survives ALL React lifecycle events
// ---------------------------------------------------------------------------

interface CachedManager {
  manager: ScopedRealtimeManager
  refCount: number
  teardownTimer: ReturnType<typeof setTimeout> | null
}

const managerCache = new Map<string, CachedManager>()

/** Grace period before tearing down an unreferenced manager. */
const TEARDOWN_GRACE_MS = 2000

function acquireManager(
  projectId: string,
  userId: string,
  displayName: string
): ScopedRealtimeManager {
  const key = `project:${projectId}:${userId}`
  const existing = managerCache.get(key)

  if (existing) {
    // Cancel any pending teardown
    if (existing.teardownTimer !== null) {
      clearTimeout(existing.teardownTimer)
      existing.teardownTimer = null
    }
    existing.refCount++
    return existing.manager
  }

  const manager = new ScopedRealtimeManager({
    scope: { type: 'project', id: projectId },
    userId,
    displayName,
  })
  managerCache.set(key, { manager, refCount: 1, teardownTimer: null })
  void manager.subscribe()
  return manager
}

function releaseManager(projectId: string, userId: string): void {
  const key = `project:${projectId}:${userId}`
  const entry = managerCache.get(key)
  if (!entry || entry.refCount <= 0) return

  entry.refCount--
  if (entry.refCount <= 0) {
    // Schedule teardown after grace period
    entry.teardownTimer = setTimeout(() => {
      void entry.manager.unsubscribe()
      managerCache.delete(key)
    }, TEARDOWN_GRACE_MS)
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useProjectRealtime(
  opts: UseProjectRealtimeOptions
): UseProjectRealtimeReturn {
  const { projectId, currentUserId, currentUserDisplayName, setIdeas } = opts

  const [manager, setManager] = useState<ScopedRealtimeManager | null>(null)
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting')
  const [participants, setParticipants] = useState<PresenceParticipant[]>([])

  const previousConnectionStateRef = useRef<ConnectionState | null>(null)
  const [previousConnectionState, setPreviousConnectionState] =
    useState<ConnectionState | null>(null)

  const setIdeasRef = useRef(setIdeas)
  useEffect(() => {
    setIdeasRef.current = setIdeas
  })

  useEffect(() => {
    const mgr = acquireManager(projectId, currentUserId, currentUserDisplayName)

    const unsubPresence = mgr.onPresence((incoming) => {
      setParticipants(incoming)
    })

    const unsubConnectionState = mgr.onConnectionStateChange((state) => {
      setPreviousConnectionState(previousConnectionStateRef.current)
      previousConnectionStateRef.current = state as ConnectionState
      setConnectionState(state as ConnectionState)
    })

    const unsubPolling = mgr.onPollingTick(async () => {
      const ideas = await IdeaRepository.getProjectIdeas(projectId)
      setIdeasRef.current(ideas)
    }, 10000)

    setManager(mgr)

    return () => {
      unsubPresence()
      unsubConnectionState()
      unsubPolling()
      releaseManager(projectId, currentUserId)
      setManager(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, currentUserId, currentUserDisplayName])

  return { manager, connectionState, previousConnectionState, participants }
}
