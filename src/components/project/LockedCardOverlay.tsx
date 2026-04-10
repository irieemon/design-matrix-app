/**
 * LockedCardOverlay — Phase 05.4b Wave 3, Unit 3.2
 *
 * Renders an inset overlay on an idea card when it is locked by another user
 * during a drag operation. Returns null when:
 *   - The ProjectRealtimeContext is absent (nullable pattern — D-27).
 *   - No lock exists for this ideaId.
 *   - The lock is held by the current user (isLockedByOther === false).
 *
 * Visual spec (§2c):
 *   - ring-2 ring-sapphire-300 border ring around the card
 *   - bg-white/10 translucent tint
 *   - Top-right badge: Lock icon + "{Name} is moving this" (truncated at 18 chars)
 *   - 150ms fade-out dismiss animation
 *   - prefers-reduced-motion: no transition
 *
 * Accessibility:
 *   - aria-live="polite" announces lock acquire and release to screen readers.
 */

import React, { useContext, useEffect, useRef, useState } from 'react'
import { Lock } from 'lucide-react'
import { ProjectRealtimeContext } from '../../contexts/ProjectRealtimeContext'

const MAX_DISPLAY_NAME_LENGTH = 18

function truncateName(name: string): string {
  if (name.length <= MAX_DISPLAY_NAME_LENGTH) return name
  return `${name.slice(0, MAX_DISPLAY_NAME_LENGTH)}\u2026`
}

export interface LockedCardOverlayProps {
  ideaId: string
  ideaTitle: string
}

export function LockedCardOverlay({
  ideaId,
  ideaTitle,
}: LockedCardOverlayProps): React.ReactElement | null {
  // Nullable context read — returns null when outside provider (D-27).
  const ctx = useContext(ProjectRealtimeContext)

  // Detect prefers-reduced-motion once on mount.
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // Track whether a lock is active so we can announce release.
  const wasLockedRef = useRef(false)
  const [liveText, setLiveText] = useState('')

  const isLocked = ctx ? ctx.dragLock.isLockedByOther(ideaId) : false
  const lockEntry = ctx?.lockedCards.get(ideaId)
  const lockerName = lockEntry?.userId !== ctx?.currentUserId ? lockEntry?.displayName : undefined

  // aria-live announcements.
  useEffect(() => {
    if (!ctx) return

    const locked = ctx.dragLock.isLockedByOther(ideaId)

    if (locked && !wasLockedRef.current) {
      const name = ctx.lockedCards.get(ideaId)?.displayName ?? 'Someone'
      setLiveText(
        `${name} is moving '${ideaTitle}'. It will be available again shortly.`
      )
      wasLockedRef.current = true
    } else if (!locked && wasLockedRef.current) {
      setLiveText(`'${ideaTitle}' is available.`)
      wasLockedRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, ideaId, ideaTitle, isLocked])

  if (!ctx) return null
  if (!isLocked) {
    // Still render the live region for the "available" announcement
    if (liveText.includes('is available')) {
      return (
        <span
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
        >
          {liveText}
        </span>
      )
    }
    return null
  }

  const displayName = truncateName(lockerName ?? 'Someone')

  const transitionClasses = prefersReducedMotion
    ? ''
    : 'transition-opacity duration-150'

  return (
    <div
      data-testid={`locked-card-overlay-${ideaId}`}
      className={[
        'absolute inset-0',
        'ring-2 ring-sapphire-300',
        'bg-white/10',
        'rounded-xl',
        'pointer-events-none',
        'z-10',
        transitionClasses,
      ]
        .filter(Boolean)
        .join(' ')}
      role="status"
      aria-label={`${lockerName ?? 'Someone'} is moving this card`}
    >
      {/* Lock badge — top-right corner */}
      <div className="absolute top-1 right-1 flex items-center gap-1 bg-slate-800/80 text-white text-xs px-2 py-0.5 rounded-full pointer-events-none select-none">
        <Lock
          data-testid="lock-badge-icon"
          className="w-3 h-3 flex-shrink-0"
          aria-hidden="true"
        />
        <span>{displayName} is moving this</span>
      </div>

      {/* aria-live polite region for screen reader announcements */}
      <span
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {liveText}
      </span>
    </div>
  )
}
