/**
 * SessionPresenceStack — Phase 05.4a Wave 3, Unit 4
 *
 * Compact avatar stack showing who is currently in the brainstorm session.
 * Uses Supabase Presence via a ScopedRealtimeManager instance.
 *
 * Props:
 *   scope                   — { type: 'session' | 'project', id: string }
 *   currentUserId           — authenticated user's ID
 *   currentUserDisplayName  — display name for self
 *   manager?                — optional shared ScopedRealtimeManager. When
 *                             provided the component subscribes to its presence
 *                             stream without creating a second channel (MUST-FIX 4).
 *                             When absent a local instance is created (standalone use).
 *   className?              — optional wrapper class
 *
 * Presence key format: `${userId}:${tabId}` (SEC-02 mitigation).
 * ScopedRealtimeManager.deliverPresence already extracts userId from the key,
 * so participants received here are already SEC-02 safe.
 *
 * Ordering: self always first, others by joinedAt ascending (D-14).
 * Dedup: one avatar per userId — keep entry with largest joinedAt (OQ-5, D-14).
 * Overflow: +N chip when total > 5 (5 visible max including self).
 */

import React, { useEffect, useRef, useState } from 'react'
import { ScopedRealtimeManager } from '../../lib/realtime/ScopedRealtimeManager'
import type { PresenceParticipant, Scope } from '../../lib/realtime/ScopedRealtimeManager'
import { userIdToHsl, toInitials } from '../../utils/userColor'

export type { PresenceParticipant }

/** Slide-in animation duration in ms — matches UX §1e (200ms). */
const SLIDE_IN_DURATION_MS = 200

export interface SessionPresenceStackProps {
  scope: Scope
  currentUserId: string
  currentUserDisplayName: string
  /** Shared manager from parent — skips creating a second channel when provided. */
  manager?: ScopedRealtimeManager
  className?: string
}

const MAX_VISIBLE = 5

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// ---------------------------------------------------------------------------
// Dedup participants by userId — keep entry with largest joinedAt (OQ-5)
// ---------------------------------------------------------------------------
function deduplicateByUserId(participants: PresenceParticipant[]): PresenceParticipant[] {
  const byUser = new Map<string, PresenceParticipant>()
  for (const p of participants) {
    const existing = byUser.get(p.userId)
    if (!existing || p.joinedAt > existing.joinedAt) {
      byUser.set(p.userId, p)
    }
  }
  return Array.from(byUser.values())
}

// ---------------------------------------------------------------------------
// Sort: self first, then others by joinedAt ascending
// ---------------------------------------------------------------------------
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
// Avatar component
// ---------------------------------------------------------------------------
interface AvatarProps {
  participant: PresenceParticipant
  isSelf: boolean
  isNew: boolean
}

function Avatar({ participant, isSelf, isNew }: AvatarProps): React.ReactElement {
  const reduced = prefersReducedMotion()
  const label = isSelf ? 'You — in this session' : `${participant.displayName} — in this session`
  const initials = toInitials(participant.displayName)
  const bg = userIdToHsl(participant.userId)

  return (
    <div
      role="img"
      aria-label={label}
      title={participant.displayName}
      className={[
        'w-7 h-7 rounded-full flex items-center justify-center',
        'text-xs font-semibold text-white',
        'ring-2 ring-white',
        // NIT 8: self avatar — sapphire ring with white offset ring.
        // ring-2 ring-white provides the white gap; ring-sapphire-400 is the
        // colored outer ring. ring-offset-* is not used to avoid Tailwind
        // utility conflicts. Order matters: last ring-color wins, so sapphire
        // must follow white — but we use an inner border trick via ring-offset-2.
        // Simplified: just add ring-sapphire-400 to visually identify self;
        // the existing ring-2 ring-white gives the offset appearance.
        isSelf ? 'ring-sapphire-400' : '',
        // Slide-in animation for newly joined avatars (UX §1e, 200ms).
        // isNew is derived from newlyJoinedIds state, which is populated when
        // the participant first appears and cleared after SLIDE_IN_DURATION_MS
        // — so the class is present for one full animation cycle (MUST-FIX 5).
        !reduced && isNew ? 'animate-slide-right' : '',
      ].filter(Boolean).join(' ')}
      style={{ backgroundColor: bg }}
    >
      {initials}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SessionPresenceStack({
  scope,
  currentUserId,
  currentUserDisplayName,
  manager: externalManager,
  className,
}: SessionPresenceStackProps): React.ReactElement {
  const [participants, setParticipants] = useState<PresenceParticipant[]>([])
  // newlyJoinedIds tracks userIds that just arrived so isNew=true for exactly
  // one animation cycle. Populated immediately when participants update;
  // cleared after SLIDE_IN_DURATION_MS via setTimeout (MUST-FIX 5).
  const [newlyJoinedIds, setNewlyJoinedIds] = useState<Set<string>>(new Set())
  const slideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const localManagerRef = useRef<ScopedRealtimeManager | null>(null)

  useEffect(() => {
    // Use the shared manager when provided; otherwise create a local one.
    const manager = externalManager ?? new ScopedRealtimeManager({
      scope,
      userId: currentUserId,
      displayName: currentUserDisplayName,
    })

    if (!externalManager) {
      localManagerRef.current = manager
    }

    manager.onPresence((incoming) => {
      setParticipants((prev) => {
        const prevIds = new Set(prev.map((p) => p.userId))
        const nextIds = new Set(incoming.map((p) => p.userId))

        // Detect join / leave for aria-live announcement
        const joined: string[] = []
        for (const p of incoming) {
          if (!prevIds.has(p.userId) && p.userId !== currentUserId) {
            setAnnouncement(`${p.displayName} joined the session.`)
            joined.push(p.userId)
          }
        }
        for (const p of prev) {
          if (!nextIds.has(p.userId) && p.userId !== currentUserId) {
            setAnnouncement(`${p.displayName} left the session.`)
          }
        }

        // Populate newlyJoinedIds for slide-in animation, then clear after duration.
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

    // Only subscribe when we own the manager (external manager is already subscribed).
    if (!externalManager) {
      void manager.subscribe()
    }

    return () => {
      if (!externalManager) {
        void manager.unsubscribe()
        localManagerRef.current = null
      }
      if (slideTimerRef.current !== null) {
        clearTimeout(slideTimerRef.current)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope.type, scope.id, currentUserId, currentUserDisplayName, externalManager])

  // Deduplicate and sort
  const deduped = deduplicateByUserId(participants)
  const sorted = sortParticipants(deduped, currentUserId)

  const visibleParticipants = sorted.slice(0, MAX_VISIBLE)
  const overflowCount = sorted.length > MAX_VISIBLE ? sorted.length - MAX_VISIBLE : 0

  return (
    <div className={className}>
      {/* Aria-live region for join/leave announcements (UX §5, §2c) */}
      <p aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </p>

      {/* Avatar stack */}
      <div
        role="group"
        aria-label={`Session participants: ${sorted.length} online`}
        className="flex items-center"
      >
        {visibleParticipants.map((participant, idx) => {
          const isSelf = participant.userId === currentUserId
          const isNew = newlyJoinedIds.has(participant.userId)
          return (
            <div
              key={participant.userId}
              className={idx === 0 ? '' : '-ml-2'}
            >
              <Avatar
                participant={participant}
                isSelf={isSelf}
                isNew={isNew}
              />
            </div>
          )
        })}

        {/* Overflow chip */}
        {overflowCount > 0 && (
          <div
            className="-ml-2 w-7 h-7 rounded-full bg-graphite-200 text-graphite-700 text-xs font-semibold flex items-center justify-center ring-2 ring-white"
            aria-label={`${overflowCount} more participants in this session`}
            title={`${overflowCount} more participants in this session`}
          >
            +{overflowCount}
          </div>
        )}
      </div>
    </div>
  )
}

export default SessionPresenceStack
