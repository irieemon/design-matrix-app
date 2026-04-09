/**
 * ProjectRealtimeContext — Phase 05.4b Wave 1, Unit 1.4
 *
 * Provides the single ScopedRealtimeManager for the project scope to all
 * descendants without prop-drilling (D-32).
 *
 * Wave 1: cursors and lockedCards are empty Maps (populated in Waves 2 & 3).
 * The context shape is stable across waves — consumers added in later waves
 * read from the same context without a provider refactor.
 *
 * Nullable pattern: context value is null outside the provider.
 * useProjectRealtimeContext() throws on null — fail-fast in development.
 * DesignMatrix uses useContext(ProjectRealtimeContext) directly so it can
 * return null when rendered outside the provider (non-fullscreen path, D-27).
 */

import React, { createContext, useContext } from 'react'
import { useProjectRealtime } from '../hooks/useProjectRealtime'
import type { UseProjectRealtimeReturn } from '../hooks/useProjectRealtime'
import type { ScopedRealtimeManager } from '../lib/realtime/ScopedRealtimeManager'
import type { ConnectionState, PresenceParticipant } from '../lib/realtime/ScopedRealtimeManager'
import type { IdeaCard } from '../types'

// Wave 2 will add: CursorState, attachPointerTracking
// Wave 3 will add: LockEntry, dragLock methods
export interface CursorState {
  x: number
  y: number
  displayName: string
  color: string
  lastSeenAt: number
}

export interface LockEntry {
  userId: string
  displayName: string
  acquiredAt: number
}

export interface ProjectRealtimeContextValue {
  manager: ScopedRealtimeManager | null
  connectionState: ConnectionState
  previousConnectionState: ConnectionState | null
  participants: PresenceParticipant[]
  /** Wave 1: always empty Map. Wave 2 populates this. */
  cursors: Map<string, CursorState>
  /** Wave 1: always empty Map. Wave 3 populates this. */
  lockedCards: Map<string, LockEntry>
  currentUserId: string
  currentUserDisplayName: string
  /** Wave 2: wires pointer-tracking. No-op in Wave 1. */
  attachPointerTracking: (el: HTMLElement | null) => void
  /** Wave 3: drag lock methods. No-ops in Wave 1. */
  dragLock: {
    acquire: (ideaId: string) => boolean
    release: (ideaId: string) => void
    isLockedByOther: (ideaId: string) => boolean
  }
}

export const ProjectRealtimeContext =
  createContext<ProjectRealtimeContextValue | null>(null)

export interface ProjectRealtimeProviderProps {
  projectId: string
  currentUserId: string
  currentUserDisplayName: string
  setIdeas: React.Dispatch<React.SetStateAction<IdeaCard[]>>
  children: React.ReactNode
}

// Empty Map singletons — stable references avoid re-renders in Wave 1.
const EMPTY_CURSORS = new Map<string, CursorState>()
const EMPTY_LOCKED_CARDS = new Map<string, LockEntry>()

// No-op drag lock — Wave 3 replaces this by passing real methods.
const NOOP_DRAG_LOCK: ProjectRealtimeContextValue['dragLock'] = {
  acquire: () => true,
  release: () => undefined,
  isLockedByOther: () => false,
}

export function ProjectRealtimeProvider({
  projectId,
  currentUserId,
  currentUserDisplayName,
  setIdeas,
  children,
}: ProjectRealtimeProviderProps): React.ReactElement {
  const {
    manager,
    connectionState,
    previousConnectionState,
    participants,
  }: UseProjectRealtimeReturn = useProjectRealtime({
    projectId,
    currentUserId,
    currentUserDisplayName,
    setIdeas,
  })

  const value: ProjectRealtimeContextValue = {
    manager,
    connectionState,
    previousConnectionState,
    participants,
    cursors: EMPTY_CURSORS,
    lockedCards: EMPTY_LOCKED_CARDS,
    currentUserId,
    currentUserDisplayName,
    attachPointerTracking: () => undefined,
    dragLock: NOOP_DRAG_LOCK,
  }

  return (
    <ProjectRealtimeContext.Provider value={value}>
      {children}
    </ProjectRealtimeContext.Provider>
  )
}

/**
 * Consume the project realtime context.
 * Throws if called outside a ProjectRealtimeProvider — fail-fast in dev.
 */
export function useProjectRealtimeContext(): ProjectRealtimeContextValue {
  const ctx = useContext(ProjectRealtimeContext)
  if (ctx === null) {
    throw new Error(
      'useProjectRealtimeContext must be used inside ProjectRealtimeProvider'
    )
  }
  return ctx
}
