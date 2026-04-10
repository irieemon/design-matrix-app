/**
 * LiveCursorsLayer component tests — Phase 05.4b Wave 2, Unit 2.3
 *
 * Tests T-054B-140 through T-054B-149 (10 tests).
 *
 * Renders the layer with a mocked ProjectRealtimeContext providing
 * a cursors Map. All assertions are scoped within the layer element.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import React from 'react'

vi.mock('../../../utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { LiveCursorsLayer } from '../LiveCursorsLayer'
import type { CursorState } from '../../../contexts/ProjectRealtimeContext'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CURRENT_USER_ID = 'self-user'

function makeCursor(
  userId: string,
  overrides: Partial<CursorState> = {}
): CursorState {
  return {
    x: 30,
    y: 40,
    displayName: userId === 'u1' ? 'Alice' : 'Bob',
    color: `hsl(100, 55%, 65%)`,
    lastSeenAt: Date.now(),
    ...overrides,
  }
}

function renderLayer(
  cursors: Map<string, CursorState>,
  currentUserId = CURRENT_USER_ID
) {
  render(
    <LiveCursorsLayer cursors={cursors} currentUserId={currentUserId} />
  )
}

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockMatchMedia(false)
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LiveCursorsLayer', () => {
  it('T-054B-140: returns empty when no cursors', () => {
    renderLayer(new Map())

    const layer = screen.getByTestId('live-cursors-layer')
    expect(within(layer).queryAllByTestId(/^live-cursor-/)).toHaveLength(0)
  })

  it('T-054B-141: renders cursor per entry in cursors map', () => {
    const cursors = new Map([
      ['u1', makeCursor('u1')],
      ['u2', makeCursor('u2')],
    ])
    renderLayer(cursors)

    const layer = screen.getByTestId('live-cursors-layer')
    expect(within(layer).queryAllByTestId(/^live-cursor-/)).toHaveLength(2)
  })

  it('T-054B-142: cursor label matches displayName', () => {
    const cursors = new Map([['u1', makeCursor('u1', { displayName: 'Alice' })]])
    renderLayer(cursors)

    const layer = screen.getByTestId('live-cursors-layer')
    expect(within(layer).getByText('Alice')).toBeInTheDocument()
  })

  it('T-054B-143: cursor positioned via inline style left/top %', () => {
    const cursors = new Map([
      ['u1', makeCursor('u1', { x: 30, y: 40 })],
    ])
    renderLayer(cursors)

    const layer = screen.getByTestId('live-cursors-layer')
    const cursorEl = within(layer).getByTestId('live-cursor-u1')
    expect(cursorEl).toHaveStyle({ left: '30%', top: '40%' })
  })

  it('T-054B-144: cursor color applied via inline style on SVG', () => {
    const color = 'hsl(120, 55%, 65%)'
    const cursors = new Map([['u1', makeCursor('u1', { color })]])
    renderLayer(cursors)

    const layer = screen.getByTestId('live-cursors-layer')
    const cursorEl = within(layer).getByTestId('live-cursor-u1')
    // Color is applied as fill on the SVG or color on the wrapper
    expect(cursorEl.querySelector('svg') ?? cursorEl).toHaveAttribute(
      'style',
      expect.stringContaining(color)
    )
  })

  it('T-054B-145: layer has pointer-events: none', () => {
    renderLayer(new Map())

    const layer = screen.getByTestId('live-cursors-layer')
    // Either inline style or Tailwind class
    const hasPointerEventsNone =
      layer.style.pointerEvents === 'none' ||
      layer.className.includes('pointer-events-none')
    expect(hasPointerEventsNone).toBe(true)
  })

  it('T-054B-146: layer has aria-hidden true', () => {
    renderLayer(new Map())

    const layer = screen.getByTestId('live-cursors-layer')
    expect(layer.getAttribute('aria-hidden')).toBe('true')
  })

  it('T-054B-147: z-index is 15 via data-attribute', () => {
    renderLayer(new Map())

    const layer = screen.getByTestId('live-cursors-layer')
    expect(layer.getAttribute('data-z-index')).toBe('15')
  })

  it('T-054B-148: reduced-motion disables CSS transition', () => {
    mockMatchMedia(true) // prefers-reduced-motion: reduce

    const cursors = new Map([['u1', makeCursor('u1')]])
    renderLayer(cursors)

    const layer = screen.getByTestId('live-cursors-layer')
    const cursorEl = within(layer).getByTestId('live-cursor-u1')
    // Under reduced motion, transition should be 'none' or not set
    expect(cursorEl).toHaveStyle({ transition: 'none' })
  })

  it('T-054B-149: self cursor never rendered', () => {
    // If the Map somehow contains currentUserId (defensive guard in layer)
    const cursors = new Map([
      [CURRENT_USER_ID, makeCursor(CURRENT_USER_ID, { displayName: 'Self' })],
      ['u2', makeCursor('u2', { displayName: 'Other' })],
    ])
    renderLayer(cursors, CURRENT_USER_ID)

    const layer = screen.getByTestId('live-cursors-layer')
    // Self should NOT be rendered
    expect(within(layer).queryByTestId(`live-cursor-${CURRENT_USER_ID}`)).not.toBeInTheDocument()
    // Other user still renders
    expect(within(layer).getByTestId('live-cursor-u2')).toBeInTheDocument()
  })
})
