/**
 * LockedCardOverlay — Phase 05.4b Wave 3, Unit 3.2
 *
 * Tests T-054B-230..241 (12 tests)
 *
 * Coverage:
 *   - Returns null when no lock in context
 *   - Returns null when lock is for self
 *   - Renders ring + tint + badge when locked by other
 *   - displayName truncated at 18 chars
 *   - aria-live announcements on acquire and release
 *   - ring-sapphire-300 class
 *   - bg-white/10 class
 *   - Lock icon badge
 *   - prefers-reduced-motion disables transition
 *   - Safe outside provider (nullable pattern)
 *   - 150ms dismiss animation class
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import React from 'react'
import type { LockEntry } from '../../../hooks/useDragLock'
import type { ProjectRealtimeContextValue } from '../../../contexts/ProjectRealtimeContext'
import {
  ProjectRealtimeContext,
} from '../../../contexts/ProjectRealtimeContext'

// ---------------------------------------------------------------------------
// Mock lucide-react Lock icon
// ---------------------------------------------------------------------------

vi.mock('lucide-react', () => ({
  Lock: ({ 'data-testid': testId, ...props }: { 'data-testid'?: string }) =>
    React.createElement('svg', { 'data-testid': testId ?? 'lock-badge-icon', ...props }),
}))

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { LockedCardOverlay } from '../LockedCardOverlay'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SELF_USER_ID = 'user-alice'
const OTHER_USER_ID = 'user-bob'

function buildContext(
  lockedCards: Map<string, LockEntry>,
  currentUserId = SELF_USER_ID
): ProjectRealtimeContextValue {
  return {
    manager: null,
    connectionState: 'connected',
    previousConnectionState: null,
    participants: [],
    cursors: new Map(),
    lockedCards,
    currentUserId,
    currentUserDisplayName: 'Alice',
    attachPointerTracking: () => () => undefined,
    pauseBroadcast: vi.fn(),
    resumeBroadcast: vi.fn(),
    dragLock: {
      acquire: vi.fn(() => true),
      release: vi.fn(),
      isLockedByOther: (ideaId: string) => {
        const entry = lockedCards.get(ideaId)
        return !!entry && entry.userId !== currentUserId
      },
    },
  }
}

function renderWithContext(
  ui: React.ReactElement,
  ctx: ProjectRealtimeContextValue | null
) {
  if (ctx === null) {
    return render(ui)
  }
  return render(
    <ProjectRealtimeContext.Provider value={ctx}>
      {ui}
    </ProjectRealtimeContext.Provider>
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LockedCardOverlay', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset matchMedia to default (no reduced motion)
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
  })

  it('T-054B-230: returns null when no lock in context', () => {
    const ctx = buildContext(new Map())
    const { container } = renderWithContext(
      <LockedCardOverlay ideaId="i1" ideaTitle="Ship it" />,
      ctx
    )
    expect(container.firstChild).toBeNull()
  })

  it('T-054B-231: returns null when lock is for self (isLockedByOther false)', () => {
    const lockedCards = new Map<string, LockEntry>([
      ['i1', { userId: SELF_USER_ID, displayName: 'Alice', acquiredAt: Date.now() }],
    ])
    const ctx = buildContext(lockedCards, SELF_USER_ID)
    const { container } = renderWithContext(
      <LockedCardOverlay ideaId="i1" ideaTitle="Ship it" />,
      ctx
    )
    expect(container.firstChild).toBeNull()
  })

  it('T-054B-232: renders ring + tint + badge when locked by other', () => {
    const lockedCards = new Map<string, LockEntry>([
      ['i1', { userId: OTHER_USER_ID, displayName: 'Bob', acquiredAt: Date.now() }],
    ])
    const ctx = buildContext(lockedCards)
    renderWithContext(
      <LockedCardOverlay ideaId="i1" ideaTitle="Ship it" />,
      ctx
    )

    const overlay = screen.getByTestId('locked-card-overlay-i1')
    expect(overlay).toBeInTheDocument()
    expect(overlay.textContent).toContain('Bob is moving this')
  })

  it('T-054B-233: displayName truncated at 18 chars with ellipsis', () => {
    const longName = 'AVeryLongDisplayNameIndeed'
    expect(longName.length).toBeGreaterThan(18)

    const lockedCards = new Map<string, LockEntry>([
      ['i1', { userId: OTHER_USER_ID, displayName: longName, acquiredAt: Date.now() }],
    ])
    const ctx = buildContext(lockedCards)
    renderWithContext(
      <LockedCardOverlay ideaId="i1" ideaTitle="Ship it" />,
      ctx
    )

    const overlay = screen.getByTestId('locked-card-overlay-i1')
    // Badge text should be truncated: 18 chars + '…' = 19 max chars visible
    const badgeText = overlay.textContent ?? ''
    // Should contain the truncated name with ellipsis
    expect(badgeText).toContain(`${longName.slice(0, 18)}\u2026`)
  })

  it('T-054B-234: aria-live announcement on lock acquire', async () => {
    const lockedCards = new Map<string, LockEntry>([
      ['i1', { userId: OTHER_USER_ID, displayName: 'Bob', acquiredAt: Date.now() }],
    ])
    const ctx = buildContext(lockedCards)
    const { container } = renderWithContext(
      <LockedCardOverlay ideaId="i1" ideaTitle="Ship it" />,
      ctx
    )

    const liveRegion = container.querySelector('[aria-live="polite"]')
    expect(liveRegion).not.toBeNull()
    expect(liveRegion?.textContent).toMatch(/Bob is moving 'Ship it'/)
    expect(liveRegion?.textContent).toMatch(/It will be available again shortly/)
  })

  it('T-054B-235: aria-live announcement on lock release', async () => {
    const lockedCards = new Map<string, LockEntry>([
      ['i1', { userId: OTHER_USER_ID, displayName: 'Bob', acquiredAt: Date.now() }],
    ])
    const ctx = buildContext(lockedCards)
    const { rerender } = renderWithContext(
      <LockedCardOverlay ideaId="i1" ideaTitle="Ship it" />,
      ctx
    )

    // Release the lock
    const emptyCtx = buildContext(new Map())
    await act(async () => {
      rerender(
        <ProjectRealtimeContext.Provider value={emptyCtx}>
          <LockedCardOverlay ideaId="i1" ideaTitle="Ship it" />
        </ProjectRealtimeContext.Provider>
      )
    })

    // The live region should now announce release
    // We check the live region text on the component
    const liveRegions = document.querySelectorAll('[aria-live="polite"]')
    const releaseRegion = Array.from(liveRegions).find(
      (el) => el.textContent?.includes("'Ship it' is available")
    )
    expect(releaseRegion).not.toBeUndefined()
  })

  it('T-054B-236: ring class is ring-sapphire-300', () => {
    const lockedCards = new Map<string, LockEntry>([
      ['i1', { userId: OTHER_USER_ID, displayName: 'Bob', acquiredAt: Date.now() }],
    ])
    const ctx = buildContext(lockedCards)
    renderWithContext(
      <LockedCardOverlay ideaId="i1" ideaTitle="Ship it" />,
      ctx
    )

    const overlay = screen.getByTestId('locked-card-overlay-i1')
    expect(overlay.className).toContain('ring-sapphire-300')
  })

  it('T-054B-237: tint class is bg-white/10', () => {
    const lockedCards = new Map<string, LockEntry>([
      ['i1', { userId: OTHER_USER_ID, displayName: 'Bob', acquiredAt: Date.now() }],
    ])
    const ctx = buildContext(lockedCards)
    renderWithContext(
      <LockedCardOverlay ideaId="i1" ideaTitle="Ship it" />,
      ctx
    )

    const overlay = screen.getByTestId('locked-card-overlay-i1')
    expect(overlay.className).toContain('bg-white/10')
  })

  it('T-054B-238: lock badge contains Lock icon', () => {
    const lockedCards = new Map<string, LockEntry>([
      ['i1', { userId: OTHER_USER_ID, displayName: 'Bob', acquiredAt: Date.now() }],
    ])
    const ctx = buildContext(lockedCards)
    renderWithContext(
      <LockedCardOverlay ideaId="i1" ideaTitle="Ship it" />,
      ctx
    )

    expect(screen.getByTestId('lock-badge-icon')).toBeInTheDocument()
  })

  it('T-054B-239: reduced-motion disables fade-out transition', () => {
    // Mock prefers-reduced-motion: reduce
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })

    const lockedCards = new Map<string, LockEntry>([
      ['i1', { userId: OTHER_USER_ID, displayName: 'Bob', acquiredAt: Date.now() }],
    ])
    const ctx = buildContext(lockedCards)
    renderWithContext(
      <LockedCardOverlay ideaId="i1" ideaTitle="Ship it" />,
      ctx
    )

    const overlay = screen.getByTestId('locked-card-overlay-i1')
    // With reduced motion, transition class should not be present
    expect(overlay.className).not.toContain('transition')
  })

  it('T-054B-240: consumes context via nullable pattern (safe outside provider)', () => {
    // Render without any provider — should not throw and should return null
    expect(() => {
      const { container } = render(
        <LockedCardOverlay ideaId="i1" ideaTitle="Ship it" />
      )
      expect(container.firstChild).toBeNull()
    }).not.toThrow()
  })

  it('T-054B-241: dismiss animation is 150ms (class check)', () => {
    const lockedCards = new Map<string, LockEntry>([
      ['i1', { userId: OTHER_USER_ID, displayName: 'Bob', acquiredAt: Date.now() }],
    ])
    const ctx = buildContext(lockedCards)
    renderWithContext(
      <LockedCardOverlay ideaId="i1" ideaTitle="Ship it" />,
      ctx
    )

    const overlay = screen.getByTestId('locked-card-overlay-i1')
    // Should have a duration-150 Tailwind class
    expect(overlay.className).toContain('duration-150')
  })
})
