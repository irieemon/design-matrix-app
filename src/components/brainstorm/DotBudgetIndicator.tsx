/**
 * DotBudgetIndicator — Phase 05.4a Wave 3, Unit 4
 *
 * Always-visible vote budget chip for the session header.
 * Shows "{votesUsed} / {total} votes used" with 5 decorative mini dots.
 *
 * Props:
 *   votesUsed — number of votes the current user has cast (0..total).
 *               When omitted, reads from DotVotingContext (session header usage).
 *   total     — max votes allowed per user (default: 5)
 *
 * Accessibility: chip aria-label + aria-live="polite" on text for SR updates.
 * Mini dots are aria-hidden (decorative).
 */

import React, { useContext } from 'react'
import { DotVotingContext } from '../../contexts/DotVotingContext'

export interface DotBudgetIndicatorProps {
  /** When provided, renders as a controlled display component (tests use this path). */
  votesUsed?: number
  total?: number
}

export function DotBudgetIndicator({
  votesUsed: votesUsedProp,
  total = 5,
}: DotBudgetIndicatorProps): React.ReactElement {
  // Read from context when prop is not provided (session header wire-up path).
  // useContext is safe to call unconditionally; returns null outside a provider.
  const ctx = useContext(DotVotingContext)
  const votesUsed = votesUsedProp ?? ctx?.votesUsed ?? 0

  const isFull = votesUsed >= total

  return (
    <div
      className={[
        'inline-flex items-center gap-2 px-3 py-1.5 rounded-full',
        isFull ? 'bg-graphite-200' : 'bg-graphite-100',
      ].join(' ')}
      aria-label={`Vote budget: ${votesUsed} of ${total} votes used`}
    >
      {/* Decorative mini dots — each span is aria-hidden (UX §2b: "decorative, aria-hidden") */}
      <div className="flex items-center gap-0.5">
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            aria-hidden="true"
            className={[
              'w-2 h-2 rounded-full',
              i < votesUsed ? 'bg-graphite-700' : 'bg-graphite-300',
            ].join(' ')}
          />
        ))}
      </div>

      {/* Text label — aria-live so SR hears updates on every vote */}
      <span
        aria-live="polite"
        className={[
          'text-sm font-semibold',
          isFull ? 'text-graphite-800' : 'text-graphite-700',
        ].join(' ')}
      >
        {votesUsed} / {total} votes used
      </span>
    </div>
  )
}

export default DotBudgetIndicator
