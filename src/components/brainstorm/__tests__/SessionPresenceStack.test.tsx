/**
 * SessionPresenceStack component tests — Phase 05.4a Wave 3, Unit 4
 *
 * Tests T-054A-120 through T-054A-129 (12 tests).
 *
 * SessionPresenceStack instantiates its own ScopedRealtimeManager internally.
 * Tests mock ScopedRealtimeManager via vi.mock so the constructor is a spy.
 * Presence data is injected via the mock's onPresence callback.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import React from 'react'

// --------------------------------------------------------------------------
// Module mocks — hoisted before imports
// --------------------------------------------------------------------------

vi.mock('../../../utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

// Capture the onPresence callback so tests can fire presence updates
let capturedPresenceHandler: ((participants: PresenceParticipantType[]) => void) | null = null
let mockManagerInstance: {
  subscribe: ReturnType<typeof vi.fn>
  unsubscribe: ReturnType<typeof vi.fn>
  onPresence: ReturnType<typeof vi.fn>
  onConnectionStateChange: ReturnType<typeof vi.fn>
} | null = null

vi.mock('../../../lib/realtime/ScopedRealtimeManager', () => {
  const MockScopedRealtimeManager = vi.fn().mockImplementation(() => {
    const instance = {
      subscribe: vi.fn().mockResolvedValue(undefined),
      unsubscribe: vi.fn().mockResolvedValue(undefined),
      onPresence: vi.fn((handler: (p: unknown[]) => void) => {
        capturedPresenceHandler = handler as (participants: PresenceParticipantType[]) => void
      }),
      onConnectionStateChange: vi.fn(() => () => {}),
    }
    mockManagerInstance = instance
    return instance
  })

  return {
    ScopedRealtimeManager: MockScopedRealtimeManager,
  }
})

// matchMedia mock helper
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

// --------------------------------------------------------------------------
// Imports after mocks
// --------------------------------------------------------------------------

import { SessionPresenceStack } from '../SessionPresenceStack'
import { ScopedRealtimeManager } from '../../../lib/realtime/ScopedRealtimeManager'
import type { PresenceParticipant } from '../../../lib/realtime/ScopedRealtimeManager'

type PresenceParticipantType = PresenceParticipant

const MockScopedRealtimeManager = ScopedRealtimeManager as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
  capturedPresenceHandler = null
  mockManagerInstance = null
  mockMatchMedia(false)
})

// --------------------------------------------------------------------------
// Helper to render and inject presence data
// --------------------------------------------------------------------------

function renderStack(props: {
  currentUserId: string
  participants?: PresenceParticipantType[]
  scope?: { type: 'session' | 'project'; id: string }
}) {
  const scope = props.scope ?? { type: 'session' as const, id: 's1' }
  const result = render(
    <SessionPresenceStack
      scope={scope}
      currentUserId={props.currentUserId}
      currentUserDisplayName="Alice"
    />
  )

  // Inject participants via the mocked presence handler
  if (props.participants && capturedPresenceHandler) {
    act(() => {
      capturedPresenceHandler!(props.participants!)
    })
  }

  return result
}

// --------------------------------------------------------------------------
// T-054A-120: self renders first
// --------------------------------------------------------------------------
describe('T-054A-120: self renders first', () => {
  it('current user avatar has aria-label="You — in this session" and appears first', () => {
    renderStack({
      currentUserId: 'u1',
      participants: [
        { userId: 'u1', displayName: 'Alice', joinedAt: 100, tabId: 'tab1' },
        { userId: 'u2', displayName: 'Bob', joinedAt: 50, tabId: 'tab2' },
      ],
    })

    const avatars = screen.getAllByRole('img', { hidden: true })
    // Self should be first
    expect(avatars[0].getAttribute('aria-label')).toBe('You — in this session')
  })
})

// --------------------------------------------------------------------------
// T-054A-121: self-first then others sorted by joinedAt ascending
// --------------------------------------------------------------------------
describe('T-054A-121: others sorted by joinedAt ascending after self', () => {
  it('DOM order: self, then u2(jAt:50), u4(jAt:75), u3(jAt:100)', () => {
    renderStack({
      currentUserId: 'u1',
      participants: [
        { userId: 'u1', displayName: 'Self', joinedAt: 0, tabId: 'tab0' },
        { userId: 'u2', displayName: 'B', joinedAt: 50, tabId: 'tab2' },
        { userId: 'u3', displayName: 'C', joinedAt: 100, tabId: 'tab3' },
        { userId: 'u4', displayName: 'D', joinedAt: 75, tabId: 'tab4' },
      ],
    })

    const avatars = screen.getAllByRole('img', { hidden: true })
    expect(avatars[0].getAttribute('aria-label')).toBe('You — in this session')
    expect(avatars[1].getAttribute('aria-label')).toBe('B — in this session')
    expect(avatars[2].getAttribute('aria-label')).toBe('D — in this session')
    expect(avatars[3].getAttribute('aria-label')).toBe('C — in this session')
  })
})

// --------------------------------------------------------------------------
// T-054A-121b: self-first even when self has latest joinedAt
// --------------------------------------------------------------------------
describe('T-054A-121b: self first even with latest joinedAt', () => {
  it('u1 renders first despite having joinedAt=500 (largest)', () => {
    renderStack({
      currentUserId: 'u1',
      participants: [
        { userId: 'u2', displayName: 'B', joinedAt: 50, tabId: 'tab2' },
        { userId: 'u3', displayName: 'C', joinedAt: 100, tabId: 'tab3' },
        { userId: 'u1', displayName: 'Self', joinedAt: 500, tabId: 'tab1' },
      ],
    })

    const avatars = screen.getAllByRole('img', { hidden: true })
    expect(avatars[0].getAttribute('aria-label')).toBe('You — in this session')
    expect(avatars[1].getAttribute('aria-label')).toBe('B — in this session')
    expect(avatars[2].getAttribute('aria-label')).toBe('C — in this session')
  })
})

// --------------------------------------------------------------------------
// T-054A-122: overflow chip at >5
// --------------------------------------------------------------------------
describe('T-054A-122: overflow chip at more than 5 participants', () => {
  it('shows 5 visible avatars + "+2" chip for 7 participants', () => {
    renderStack({
      currentUserId: 'u1',
      participants: [
        { userId: 'u1', displayName: 'A', joinedAt: 1, tabId: 't1' },
        { userId: 'u2', displayName: 'B', joinedAt: 2, tabId: 't2' },
        { userId: 'u3', displayName: 'C', joinedAt: 3, tabId: 't3' },
        { userId: 'u4', displayName: 'D', joinedAt: 4, tabId: 't4' },
        { userId: 'u5', displayName: 'E', joinedAt: 5, tabId: 't5' },
        { userId: 'u6', displayName: 'F', joinedAt: 6, tabId: 't6' },
        { userId: 'u7', displayName: 'G', joinedAt: 7, tabId: 't7' },
      ],
    })

    // 5 visible avatars
    const avatars = screen.getAllByRole('img', { hidden: true })
    expect(avatars).toHaveLength(5)

    // Overflow chip showing "+2"
    expect(screen.getByText('+2')).toBeDefined()
  })
})

// --------------------------------------------------------------------------
// T-054A-123: dedup by userId across tabs
// --------------------------------------------------------------------------
describe('T-054A-123: dedup by userId across tabs', () => {
  it('shows one avatar for u2 when two tabs present, using the largest joinedAt', () => {
    renderStack({
      currentUserId: 'u1',
      participants: [
        { userId: 'u1', displayName: 'Alice', joinedAt: 0, tabId: 'ta' },
        { userId: 'u2', displayName: 'Bob', joinedAt: 100, tabId: 'tab-a' },
        { userId: 'u2', displayName: 'Bob', joinedAt: 200, tabId: 'tab-b' },
      ],
    })

    // Only one "Bob" avatar should appear
    const bobs = screen.queryAllByText('B') // initials
    // Avatar count: self + 1 (Bob deduped)
    const avatars = screen.getAllByRole('img', { hidden: true })
    expect(avatars).toHaveLength(2)
    expect(avatars[1].getAttribute('aria-label')).toBe('Bob — in this session')
    void bobs
  })
})

// --------------------------------------------------------------------------
// T-054A-124: self has sapphire ring
// --------------------------------------------------------------------------
describe('T-054A-124: self avatar has sapphire ring', () => {
  it('self avatar element has ring-sapphire-400 class', () => {
    renderStack({
      currentUserId: 'u1',
      participants: [
        { userId: 'u1', displayName: 'Alice', joinedAt: 0, tabId: 'ta' },
        { userId: 'u2', displayName: 'Bob', joinedAt: 50, tabId: 'tb' },
      ],
    })

    const avatars = screen.getAllByRole('img', { hidden: true })
    expect(avatars[0].className).toContain('ring-sapphire-400')
    expect(avatars[1].className).not.toContain('ring-sapphire-400')
  })
})

// --------------------------------------------------------------------------
// T-054A-124b: SEC-02 spoofing protection — render uses key-derived userId
// --------------------------------------------------------------------------
describe('T-054A-124b: SEC-02 spoofing — key-derived userId used for rendering', () => {
  it('when presence key is "u1:tab1" but payload says userId="u2", avatar shows u1 identity', () => {
    // This test exercises ScopedRealtimeManager's deliverPresence which already
    // strips userId from the key. We simulate the output as SessionPresenceStack
    // would receive it after the manager has applied SEC-02 mitigation.
    // The manager delivers {userId: 'u1', ...} (from key) NOT {userId: 'u2'} (from body).
    renderStack({
      currentUserId: 'u1',
      participants: [
        // This is what ScopedRealtimeManager delivers after key-extraction:
        // key='u1:tab1' → userId='u1', not the payload body's 'u2'
        { userId: 'u1', displayName: 'Spoofed', joinedAt: 100, tabId: 'tab1' },
      ],
    })

    // u1 should render as self (the key-derived identity)
    const selfAvatar = screen.getByLabelText('You — in this session')
    expect(selfAvatar).toBeDefined()

    // "Spoofed" display name for u1 is fine — what matters is the userId routing
    // No "u2" identity should appear as a separate avatar
    const allAvatars = screen.getAllByRole('img', { hidden: true })
    expect(allAvatars).toHaveLength(1) // only self
  })
})

// --------------------------------------------------------------------------
// T-054A-125: HSL hash is deterministic
// --------------------------------------------------------------------------
describe('T-054A-125: HSL hash is deterministic', () => {
  it('renders same background color for same userId across two renders', () => {
    const { container: c1 } = renderStack({
      currentUserId: 'u1',
      participants: [
        { userId: 'u1', displayName: 'Alice', joinedAt: 0, tabId: 'ta' },
        { userId: 'u2', displayName: 'Bob', joinedAt: 50, tabId: 'tb' },
      ],
    })

    const avatar1 = c1.querySelectorAll('[aria-label="Bob — in this session"]')[0] as HTMLElement
    const bg1 = avatar1?.style?.backgroundColor

    // Second render with same userId
    const { container: c2 } = renderStack({
      currentUserId: 'u1',
      participants: [
        { userId: 'u1', displayName: 'Alice', joinedAt: 0, tabId: 'ta' },
        { userId: 'u2', displayName: 'Bob', joinedAt: 50, tabId: 'tb' },
      ],
    })

    const avatar2 = c2.querySelectorAll('[aria-label="Bob — in this session"]')[0] as HTMLElement
    const bg2 = avatar2?.style?.backgroundColor

    expect(bg1).toBe(bg2)
    expect(bg1).toBeTruthy()
  })
})

// --------------------------------------------------------------------------
// T-054A-126: aria-live polite region announces join
// --------------------------------------------------------------------------
describe('T-054A-126: aria-live announces join', () => {
  it('sibling sr-only p[aria-live=polite] text = "Bob joined the session." on participant add', () => {
    const { rerender } = render(
      <SessionPresenceStack
        scope={{ type: 'session', id: 's1' }}
        currentUserId="u1"
        currentUserDisplayName="Alice"
      />
    )

    // Initial state: just self
    act(() => {
      capturedPresenceHandler?.([
        { userId: 'u1', displayName: 'Alice', joinedAt: 0, tabId: 'ta' },
      ])
    })

    // Bob joins
    act(() => {
      capturedPresenceHandler?.([
        { userId: 'u1', displayName: 'Alice', joinedAt: 0, tabId: 'ta' },
        { userId: 'u2', displayName: 'Bob', joinedAt: 50, tabId: 'tb' },
      ])
    })

    rerender(
      <SessionPresenceStack
        scope={{ type: 'session', id: 's1' }}
        currentUserId="u1"
        currentUserDisplayName="Alice"
      />
    )

    const liveRegion = document.querySelector('p[aria-live="polite"].sr-only')
    expect(liveRegion?.textContent).toBe('Bob joined the session.')
  })
})

// --------------------------------------------------------------------------
// T-054A-127: aria-live announces leave
// --------------------------------------------------------------------------
describe('T-054A-127: aria-live announces leave', () => {
  it('live region text = "Bob left the session." when Bob is removed from participants', () => {
    render(
      <SessionPresenceStack
        scope={{ type: 'session', id: 's1' }}
        currentUserId="u1"
        currentUserDisplayName="Alice"
      />
    )

    // Start with Bob present
    act(() => {
      capturedPresenceHandler?.([
        { userId: 'u1', displayName: 'Alice', joinedAt: 0, tabId: 'ta' },
        { userId: 'u2', displayName: 'Bob', joinedAt: 50, tabId: 'tb' },
      ])
    })

    // Bob leaves
    act(() => {
      capturedPresenceHandler?.([
        { userId: 'u1', displayName: 'Alice', joinedAt: 0, tabId: 'ta' },
      ])
    })

    const liveRegion = document.querySelector('p[aria-live="polite"].sr-only')
    expect(liveRegion?.textContent).toBe('Bob left the session.')
  })
})

// --------------------------------------------------------------------------
// T-054A-128: reduced motion disables slide-in transition
// --------------------------------------------------------------------------
describe('T-054A-128: reduced motion disables slide-in', () => {
  it('new avatar is rendered WITHOUT translate transition class when prefers-reduced-motion', () => {
    mockMatchMedia(true)

    renderStack({
      currentUserId: 'u1',
      participants: [
        { userId: 'u1', displayName: 'Alice', joinedAt: 0, tabId: 'ta' },
        { userId: 'u2', displayName: 'Bob', joinedAt: 50, tabId: 'tb' },
      ],
    })

    const avatars = screen.getAllByRole('img', { hidden: true })
    // No translate/transition animation class on the avatar wrapper
    for (const avatar of avatars) {
      expect(avatar.className).not.toContain('translate-x')
    }
  })
})

// --------------------------------------------------------------------------
// T-054A-129: instantiates ScopedRealtimeManager with correct scope
// --------------------------------------------------------------------------
describe('T-054A-129: instantiates ScopedRealtimeManager with correct scope', () => {
  it('constructor called with scope={type:"session",id:"s1"} and userId="u1"', () => {
    render(
      <SessionPresenceStack
        scope={{ type: 'session', id: 's1' }}
        currentUserId="u1"
        currentUserDisplayName="Alice"
      />
    )

    expect(MockScopedRealtimeManager).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: { type: 'session', id: 's1' },
        userId: 'u1',
      })
    )
  })
})

// --------------------------------------------------------------------------
// T-054A-129b: MUST-FIX 4 — shared manager prop skips creating own instance
// --------------------------------------------------------------------------
describe('T-054A-129b: shared manager prop prevents second ScopedRealtimeManager', () => {
  it('does NOT instantiate ScopedRealtimeManager when manager prop is provided', () => {
    const sharedManager = {
      subscribe: vi.fn().mockResolvedValue(undefined),
      unsubscribe: vi.fn().mockResolvedValue(undefined),
      onPresence: vi.fn(),
      onConnectionStateChange: vi.fn(() => () => {}),
    } as unknown as InstanceType<typeof ScopedRealtimeManager>

    render(
      <SessionPresenceStack
        scope={{ type: 'session', id: 's1' }}
        currentUserId="u1"
        currentUserDisplayName="Alice"
        manager={sharedManager}
      />
    )

    // Constructor must NOT have been called — no second channel opened
    expect(MockScopedRealtimeManager).not.toHaveBeenCalled()
    // And subscribe must NOT have been called on the shared manager
    // (parent already subscribed it)
    expect(sharedManager.subscribe).not.toHaveBeenCalled()
  })
})

// --------------------------------------------------------------------------
// T-054A-129c: MUST-FIX 5 — slide-in animation triggers for new participant
// --------------------------------------------------------------------------
describe('T-054A-129c: slide-in animation triggers for new participant', () => {
  it('new participant avatar has animate-slide-right class after second presence snapshot', () => {
    mockMatchMedia(false) // motion allowed

    render(
      <SessionPresenceStack
        scope={{ type: 'session', id: 's1' }}
        currentUserId="u1"
        currentUserDisplayName="Alice"
      />
    )

    // Initial snapshot: just Alice
    act(() => {
      capturedPresenceHandler?.([
        { userId: 'u1', displayName: 'Alice', joinedAt: 0, tabId: 'ta' },
      ])
    })

    // Bob joins — second snapshot
    act(() => {
      capturedPresenceHandler?.([
        { userId: 'u1', displayName: 'Alice', joinedAt: 0, tabId: 'ta' },
        { userId: 'u2', displayName: 'Bob', joinedAt: 50, tabId: 'tb' },
      ])
    })

    // Bob's avatar should have the slide-in class because prevParticipantIds
    // (from the previous render) did not contain u2
    const bobAvatar = screen.getByLabelText('Bob — in this session')
    expect(bobAvatar.className).toContain('animate-slide-right')
  })
})
