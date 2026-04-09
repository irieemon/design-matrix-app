/**
 * DotVoteControls — Phase 05.4a Wave 3, Unit 4
 *
 * Per-idea voting UI. Renders 5 interactive dot buttons.
 * Reads state from DotVotingContext (D-11: single context per session page).
 *
 * Props:
 *   ideaId    — the idea being voted on
 *   ideaTitle — used in ARIA labels per UX §2a
 *
 * Accessibility:
 *   - Container: role="group" aria-label="Votes for {ideaTitle}"
 *   - Each dot: <button> with aria-pressed + aria-label per UX §2a verbatim copy
 *   - Error: role="alert" (assertive announcement)
 *   - Tally: min-w-[1.5rem] text-center, always visible (D-17)
 *   - Reconnecting: all dots aria-disabled, status text shown
 *
 * Animation:
 *   - animate-tally-bump class applied for 180ms on tally delta (D-16)
 *   - prefers-reduced-motion disables animation (UX §5)
 */

import React, { useRef, useEffect, useState } from 'react'
import { useDotVotingContext } from '../../contexts/DotVotingContext'

export interface DotVoteControlsProps {
  ideaId: string
  ideaTitle: string
}

const TALLY_BUMP_DURATION_MS = 200
const MAX_VOTES = 5

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function DotVoteControls({
  ideaId,
  ideaTitle,
}: DotVoteControlsProps): React.ReactElement {
  const ctx = useDotVotingContext()
  const { votesUsed, votesRemaining, tallies, myVotes, castVote, removeVote, error } = ctx

  // connectionState may not exist on all versions of the context type yet;
  // access via unknown cast so we don't break if field is absent.
  const connectionState = (ctx as unknown as { connectionState?: string }).connectionState
  const isReconnecting = connectionState === 'reconnecting'

  const tally = tallies.get(ideaId) ?? 0
  const prevTallyRef = useRef(tally)
  const [isBumping, setIsBumping] = useState(false)
  const bumpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Tally bump animation on delta (D-16)
  useEffect(() => {
    if (tally !== prevTallyRef.current && !prefersReducedMotion()) {
      prevTallyRef.current = tally
      setIsBumping(true)
      if (bumpTimerRef.current !== null) clearTimeout(bumpTimerRef.current)
      bumpTimerRef.current = setTimeout(() => {
        setIsBumping(false)
        bumpTimerRef.current = null
      }, TALLY_BUMP_DURATION_MS)
    } else {
      prevTallyRef.current = tally
    }
    return () => {
      if (bumpTimerRef.current !== null) {
        clearTimeout(bumpTimerRef.current)
      }
    }
  }, [tally])

  // Determine which dots are "filled" = own vote slots
  // myVotes is a Set<ideaId> — if this idea is in myVotes, the user has 1 vote here.
  // All 5 dots represent the user's OWN slot choices; filled = own vote on this idea.
  const ownVoteCount = myVotes.has(ideaId) ? 1 : 0

  function handleDotClick(dotIndex: number) {
    if (isReconnecting) return

    const isOwnVoteDot = dotIndex < ownVoteCount

    if (isOwnVoteDot) {
      void removeVote(ideaId)
    } else {
      void castVote(ideaId)
    }
  }

  function getDotAriaLabel(dotIndex: number): string {
    const isOwnVoteDot = dotIndex < ownVoteCount
    const n = votesUsed
    if (isOwnVoteDot) {
      return `Remove vote from ${ideaTitle}. ${n} of ${MAX_VOTES} votes used.`
    }
    return `Cast vote for ${ideaTitle}. ${n} of ${MAX_VOTES} votes used.`
  }

  function getDotClasses(dotIndex: number): string {
    const isOwnVoteDot = dotIndex < ownVoteCount
    const isBudgetFull = votesRemaining === 0 && !isOwnVoteDot
    const isDisabled = isReconnecting || isBudgetFull

    const base = 'w-3 h-3 rounded-full transition-transform duration-120'
    const colorClass = isOwnVoteDot
      ? 'bg-brand-primary'
      : isDisabled
        ? 'bg-graphite-200'
        : 'bg-graphite-300 hover:scale-110'

    return `${base} ${colorClass}`.trim()
  }

  function isDotDisabled(dotIndex: number): boolean {
    if (isReconnecting) return true
    const isOwnVoteDot = dotIndex < ownVoteCount
    return votesRemaining === 0 && !isOwnVoteDot
  }

  return (
    <div className="flex flex-col gap-1">
      {/* Reconnecting status (UX §2a disabled state) */}
      {isReconnecting && (
        <p className="text-xs text-graphite-500">Reconnecting…</p>
      )}

      {/* Dot row + tally */}
      <div
        role="group"
        aria-label={`Votes for ${ideaTitle}`}
        className="flex items-center gap-1 sm:gap-2"
      >
        {Array.from({ length: MAX_VOTES }, (_, i) => {
          const disabled = isDotDisabled(i)
          const isOwnVoteDot = i < ownVoteCount
          return (
            <button
              key={i}
              type="button"
              aria-label={getDotAriaLabel(i)}
              aria-pressed={isOwnVoteDot ? 'true' : 'false'}
              aria-disabled={disabled ? 'true' : 'false'}
              onClick={() => handleDotClick(i)}
              className={[
                // 44×44px touch target via padding (12px dot + 16px × 2 = 44px)
                'p-4 -m-4 flex items-center justify-center',
                'focus-visible:outline-none focus-visible:ring-2',
                'focus-visible:ring-sapphire-500 focus-visible:ring-offset-2',
                disabled ? 'cursor-not-allowed' : 'cursor-pointer',
              ].join(' ')}
            >
              <span className={getDotClasses(i)} />
            </button>
          )
        })}

        {/* Tally label — always visible (D-17), min-width prevents layout shift */}
        <span
          className={[
            'ml-2 text-xs text-graphite-500 min-w-[1.5rem] text-center',
            isBumping ? 'animate-tally-bump' : '',
          ].join(' ').trim()}
        >
          {tally}
        </span>
      </div>

      {/* Inline error — role=alert for immediate SR announcement (UX §4a) */}
      {error && (
        <p role="alert" className="text-xs text-error-600 mt-1.5">
          {error}
        </p>
      )}
    </div>
  )
}

export default DotVoteControls
