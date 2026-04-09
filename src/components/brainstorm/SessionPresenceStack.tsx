/**
 * SessionPresenceStack — Phase 05.4a Wave 3, Unit 4
 *
 * Compact avatar stack showing who is currently in the brainstorm session.
 * Uses Supabase Presence via a self-managed ScopedRealtimeManager instance (D-14).
 *
 * Props:
 *   scope                   — { type: 'session' | 'project', id: string }
 *   currentUserId           — authenticated user's ID
 *   currentUserDisplayName  — display name for self
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

export type { PresenceParticipant }

export interface SessionPresenceStackProps {
  scope: Scope
  currentUserId: string
  currentUserDisplayName: string
  className?: string
}

const MAX_VISIBLE = 5

// ---------------------------------------------------------------------------
// HSL hash — deterministic per userId (UX §2c, same algorithm shared with 05.4b)
// hsl((hash(userId) % 360), 55%, 65%)
// ---------------------------------------------------------------------------
function hashString(s: string): number {
  let hash = 0
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) >>> 0
  }
  return hash
}

function userIdToHsl(userId: string): string {
  const hue = hashString(userId) % 360
  return `hsl(${hue}, 55%, 65%)`
}

// ---------------------------------------------------------------------------
// Derive initials from displayName (up to 2 chars, uppercased)
// ---------------------------------------------------------------------------
function toInitials(displayName: string): string {
  return displayName
    .split(' ')
    .map((w) => w[0] ?? '')
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

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
        isSelf ? 'ring-1 ring-sapphire-400' : '',
        // Slide-in animation for new avatars (UX §1e, 200ms)
        !reduced && isNew ? 'animate-slide-right' : '',
        // Overlap via negative margin — first avatar has no negative margin (applied via flex parent)
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
  className,
}: SessionPresenceStackProps): React.ReactElement {
  const [participants, setParticipants] = useState<PresenceParticipant[]>([])
  const prevParticipantIdsRef = useRef<Set<string>>(new Set())
  const [announcement, setAnnouncement] = useState('')
  const managerRef = useRef<ScopedRealtimeManager | null>(null)

  useEffect(() => {
    const manager = new ScopedRealtimeManager({
      scope,
      userId: currentUserId,
      displayName: currentUserDisplayName,
    })
    managerRef.current = manager

    manager.onPresence((incoming) => {
      setParticipants((prev) => {
        const prevIds = new Set(prev.map((p) => p.userId))
        const nextIds = new Set(incoming.map((p) => p.userId))

        // Detect join / leave for aria-live announcement
        for (const p of incoming) {
          if (!prevIds.has(p.userId) && p.userId !== currentUserId) {
            setAnnouncement(`${p.displayName} joined the session.`)
          }
        }
        for (const p of prev) {
          if (!nextIds.has(p.userId) && p.userId !== currentUserId) {
            setAnnouncement(`${p.displayName} left the session.`)
          }
        }

        prevParticipantIdsRef.current = nextIds
        return incoming
      })
    })

    void manager.subscribe()

    return () => {
      void manager.unsubscribe()
      managerRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope.type, scope.id, currentUserId, currentUserDisplayName])

  // Deduplicate and sort
  const deduped = deduplicateByUserId(participants)
  const sorted = sortParticipants(deduped, currentUserId)

  const visibleParticipants = sorted.slice(0, MAX_VISIBLE)
  const overflowCount = sorted.length > MAX_VISIBLE ? sorted.length - MAX_VISIBLE : 0

  // Track new arrivals for slide-in animation
  const prevIds = prevParticipantIdsRef.current

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
          const isNew = !prevIds.has(participant.userId)
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
