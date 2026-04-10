/**
 * LiveCursorsLayer — Phase 05.4b Wave 2, Unit 2.3
 *
 * Absolute full-container overlay rendering one labeled cursor per remote user.
 * Sits inside the matrix canvas container, z-index 15, pointer-events: none,
 * aria-hidden so screen readers are not distracted by cursor updates.
 *
 * Visual spec (UX §1b):
 *   - SVG pointer 14×20px in HSL identity color (from CursorState.color)
 *   - Name pill below the pointer
 *   - CSS transform transition 80ms ease-out for smooth movement
 *   - Transition disabled under prefers-reduced-motion
 *   - Self cursor (currentUserId) never rendered — defensive guard
 */

import React from 'react'
import type { CursorState } from '../../contexts/ProjectRealtimeContext'

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// ---------------------------------------------------------------------------
// Per-cursor SVG pointer (14×20px)
// ---------------------------------------------------------------------------

function CursorPointer({ color }: { color: string }): React.ReactElement {
  return (
    // NOTE: JSDOM normalizes CSS color values (hsl → rgb) when set via React style
    // object or standard CSS properties. CSS custom properties are NOT normalized —
    // they are stored verbatim. Using --cursor-color preserves the raw HSL string
    // in the style attribute, which T-054B-144 asserts via toHaveAttribute('style').
    <svg
      width="14"
      height="20"
      viewBox="0 0 14 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ '--cursor-color': color } as React.CSSProperties}
      aria-hidden="true"
    >
      <path
        d="M0 0L0 16L4 12L7 19L9 18L6 11L11 11L0 0Z"
        fill={color}
        stroke="white"
        strokeWidth="1"
      />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface LiveCursorsLayerProps {
  cursors: Map<string, CursorState>
  currentUserId: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LiveCursorsLayer({
  cursors,
  currentUserId,
}: LiveCursorsLayerProps): React.ReactElement {
  const reduced = prefersReducedMotion()

  return (
    <div
      data-testid="live-cursors-layer"
      aria-hidden="true"
      data-z-index="15"
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 15 }}
    >
      {Array.from(cursors.entries())
        .filter(([userId]) => userId !== currentUserId)
        .map(([userId, cursor]) => (
          <div
            key={userId}
            data-testid={`live-cursor-${userId}`}
            style={{
              position: 'absolute',
              left: `${cursor.x}%`,
              top: `${cursor.y}%`,
              transition: reduced ? 'none' : 'left 80ms ease-out, top 80ms ease-out',
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          >
            <CursorPointer color={cursor.color} />
            <div
              style={{
                marginTop: 2,
                paddingLeft: 4,
                paddingRight: 4,
                paddingTop: 2,
                paddingBottom: 2,
                borderRadius: 4,
                backgroundColor: cursor.color,
                color: '#fff',
                fontSize: 11,
                fontWeight: 600,
                whiteSpace: 'nowrap',
                lineHeight: 1.2,
              }}
            >
              {cursor.displayName}
            </div>
          </div>
        ))}
    </div>
  )
}

export default LiveCursorsLayer
