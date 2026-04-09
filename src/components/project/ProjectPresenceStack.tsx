/**
 * ProjectPresenceStack — Phase 05.4b Wave 1, Unit 1.5
 *
 * Compact avatar stack showing who is currently viewing the project matrix.
 * Mirrors SessionPresenceStack structure (D-33) but uses project-scope labels:
 *   - aria-label: "Matrix viewers: N online"
 *   - tooltip:    "{name} — viewing this matrix"
 *   - self label: "You (viewing this matrix)"
 *
 * Manager resolution (D-25):
 *   - When `manager` prop is provided → use it directly (same pattern as
 *     SessionPresenceStack standalone mode).
 *   - When absent → read the manager from ProjectRealtimeContext. This is the
 *     normal path inside MatrixFullScreenView.
 *
 * Color derivation uses userColor.ts (D-33 — same hash as SessionPresenceStack).
 */

import React, { useContext, useEffect, useRef, useState } from 'react'
import { ScopedRealtimeManager } from '../../lib/realtime/ScopedRealtimeManager'
import type { PresenceParticipant, Scope } from '../../lib/realtime/ScopedRealtimeManager'
import { userIdToHsl, toInitials } from '../../utils/userColor'
import { ProjectRealtimeContext } from '../../contexts/ProjectRealtimeContext'

export interface ProjectPresenceStackProps {
  scope: Scope
  currentUserId: string
  currentUserDisplayName: string
  /** Optional shared manager — uses context manager when omitted (D-25). */
  manager?: ScopedRealtimeManager
  className?: string
}

const MAX_VISIBLE = 5
/** Matches SessionPresenceStack animation duration (UX §1e). */
const SLIDE_IN_DURATION_MS = 200

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function deduplicateByUserId(
  participants: PresenceParticipant[]
): PresenceParticipant[] {
  const byUser = new Map<string, PresenceParticipant>()
  for (const p of participants) {
    const existing = byUser.get(p.userId)
    if (!existing || p.joinedAt > existing.joinedAt) {
      byUser.set(p.userId, p)
    }
  }
  return Array.from(byUser.values())
}

function sortParticipants(
  participants: PresenceParticipant[],
  currentUserId: string
): PresenceParticipant[] {
  const self = participants.filter((p) => p.userId === currentUserId)
  const others = participants
    .filter((p) => p.userId !== currentUserId)
    .sort((a, b) => a.joinedAt - b.joinedAt)
  return [...self, ...others]
}

// ---------------------------------------------------------------------------
// Avatar sub-component
// ---------------------------------------------------------------------------

interface AvatarProps {
  participant: PresenceParticipant
  isSelf: boolean
  isNew: boolean
}

function Avatar({ participant, isSelf, isNew }: AvatarProps): React.ReactElement {
  const reduced = prefersReducedMotion()
  const label = isSelf
    ? 'You (viewing this matrix)'
    : `${participant.displayName} — viewing this matrix`
  const initials = toInitials(participant.displayName)
  const bg = userIdToHsl(participant.userId)

  return (
    <div
      role="img"
      aria-label={label}
      title={
        isSelf
          ? `You (viewing this matrix)`
          : `${participant.displayName} — viewing this matrix`
      }
      className={[
        'w-7 h-7 rounded-full flex items-center justify-center',
        'text-xs font-semibold text-white',
        'ring-2 ring-white',
        isSelf ? 'ring-sapphire-400' : '',
        !reduced && isNew ? 'animate-slide-right' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ backgroundColor: bg }}
    >
      {initials}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ProjectPresenceStack({
  scope,
  currentUserId,
  currentUserDisplayName,
  manager: propManager,
  className,
}: ProjectPresenceStackProps): React.ReactElement {
  const [participants, setParticipants] = useState<PresenceParticipant[]>([])
  const [newlyJoinedIds, setNewlyJoinedIds] = useState<Set<string>>(new Set())
  const slideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const localManagerRef = useRef<ScopedRealtimeManager | null>(null)
  // Pending announcement text captured inside the presence updater (pure), then
  // consumed by a useEffect to avoid calling setAnnouncement inside a state updater
  // (which React may invoke multiple times in StrictMode/concurrent mode).
  const pendingAnnouncementRef = useRef<string | null>(null)

  // D-25: read manager from context when no prop is given.
  const ctx = useContext(ProjectRealtimeContext)
  const contextManager = ctx?.manager ?? null

  useEffect(() => {
    // Resolve manager: explicit prop wins, then context, then create locally.
    const manager =
      propManager ??
      contextManager ??
      new ScopedRealtimeManager({
        scope,
        userId: currentUserId,
        displayName: currentUserDisplayName,
      })

    const isOwnedLocally = !propManager && !contextManager
    if (isOwnedLocally) {
      localManagerRef.current = manager
    }

    manager.onPresence((incoming) => {
      setParticipants((prev) => {
        const prevIds = new Set(prev.map((p) => p.userId))
        const nextIds = new Set(incoming.map((p) => p.userId))

        const joined: string[] = []
        for (const p of incoming) {
          if (!prevIds.has(p.userId) && p.userId !== currentUserId) {
            // Store last join message — consumed by participants useEffect below.
            pendingAnnouncementRef.current = `${p.displayName} is now viewing this matrix.`
            joined.push(p.userId)
          }
        }
        for (const p of prev) {
          if (!nextIds.has(p.userId) && p.userId !== currentUserId) {
            pendingAnnouncementRef.current = `${p.displayName} stopped viewing this matrix.`
          }
        }

        if (joined.length > 0) {
          setNewlyJoinedIds(new Set(joined))
          if (slideTimerRef.current !== null) clearTimeout(slideTimerRef.current)
          slideTimerRef.current = setTimeout(() => {
            setNewlyJoinedIds(new Set())
            slideTimerRef.current = null
          }, SLIDE_IN_DURATION_MS)
        }

        return incoming
      })
    })

    if (isOwnedLocally) {
      void manager.subscribe()
    }

    return () => {
      if (isOwnedLocally) {
        void manager.unsubscribe()
        localManagerRef.current = null
      }
      if (slideTimerRef.current !== null) {
        clearTimeout(slideTimerRef.current)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope.type, scope.id, currentUserId, currentUserDisplayName, propManager, contextManager])

  // Flush any announcement captured by the presence updater. Running on
  // `participants` change (not inside the updater) keeps the updater pure and
  // safe under React StrictMode / concurrent re-invocations.
  useEffect(() => {
    if (pendingAnnouncementRef.current !== null) {
      setAnnouncement(pendingAnnouncementRef.current)
      pendingAnnouncementRef.current = null
    }
  }, [participants])

  const deduped = deduplicateByUserId(participants)
  const sorted = sortParticipants(deduped, currentUserId)
  const visibleParticipants = sorted.slice(0, MAX_VISIBLE)
  const overflowCount = sorted.length > MAX_VISIBLE ? sorted.length - MAX_VISIBLE : 0

  return (
    <div className={className}>
      {/* Aria-live region for join/leave announcements */}
      <p aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </p>

      <div
        role="group"
        aria-label={`Matrix viewers: ${sorted.length} online`}
        className="flex items-center"
      >
        {visibleParticipants.map((participant, idx) => (
          <div key={participant.userId} className={idx === 0 ? '' : '-ml-2'}>
            <Avatar
              participant={participant}
              isSelf={participant.userId === currentUserId}
              isNew={newlyJoinedIds.has(participant.userId)}
            />
          </div>
        ))}

        {overflowCount > 0 && (
          <div
            className="-ml-2 w-7 h-7 rounded-full bg-graphite-200 text-graphite-700 text-xs font-semibold flex items-center justify-center ring-2 ring-white"
            aria-label={`${overflowCount} more viewers`}
            title={`${overflowCount} more viewers`}
          >
            +{overflowCount}
          </div>
        )}
      </div>
    </div>
  )
}

export default ProjectPresenceStack
