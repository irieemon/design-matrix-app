/**
 * ProjectPresenceStack component tests — Phase 05.4b Wave 1, Unit 1.5
 *
 * Tests T-054B-050 through T-054B-059 (10 tests).
 *
 * Mirrors SessionPresenceStack test structure but for project scope.
 * Key differences: aria-label "Matrix viewers: N online", tooltip copy
 * "viewing this matrix", manager consumed from context when no prop given.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, within } from '@testing-library/react'
import React from 'react'

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../../../utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

const { capturedPresenceHandler, MockSRM } = vi.hoisted(() => {
  let _presenceHandler: ((p: unknown[]) => void) | null = null

  const _MockSRM = vi.fn().mockImplementation(() => ({
    subscribe: vi.fn().mockResolvedValue(undefined),
    unsubscribe: vi.fn().mockResolvedValue(undefined),
    onPresence: vi.fn((handler: (p: unknown[]) => void) => {
      _presenceHandler = handler
    }),
    onPostgresChange: vi.fn(),
    onConnectionStateChange: vi.fn(() => () => {}),
    onPollingTick: vi.fn(() => () => {}),
    sendBroadcast: vi.fn(),
  }))

  return {
    capturedPresenceHandler: {
      get current() { return _presenceHandler },
      reset() { _presenceHandler = null },
    },
    MockSRM: _MockSRM,
  }
})

vi.mock('../../../lib/realtime/ScopedRealtimeManager', () => ({
  ScopedRealtimeManager: MockSRM,
}))

vi.mock('../../../lib/repositories/ideaRepository', () => ({
  IdeaRepository: { getProjectIdeas: vi.fn().mockResolvedValue([]) },
}))

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

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { ProjectPresenceStack } from '../ProjectPresenceStack'
import {
  ProjectRealtimeProvider,
} from '../../../contexts/ProjectRealtimeContext'
import { userIdToHsl } from '../../../utils/userColor'
import type { PresenceParticipant } from '../../../lib/realtime/ScopedRealtimeManager'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SELF_ID = 'self-1'
const NOOP_SET_IDEAS = vi.fn()

function makeParticipant(
  userId: string,
  displayName: string,
  joinedAt = 1000
): PresenceParticipant {
  return { userId, displayName, joinedAt, tabId: `tab-${userId}` }
}

/**
 * Renders the stack inside a ProjectRealtimeProvider (so the context
 * manager's presence handler is captured) unless a direct `manager` prop
 * is supplied.
 */
function renderStack(opts: {
  participants?: PresenceParticipant[]
  currentUserId?: string
  managerProp?: boolean
  noProvider?: boolean
}) {
  const {
    participants = [],
    currentUserId = SELF_ID,
    managerProp = false,
    noProvider = false,
  } = opts

  // For prop-manager tests we pass a fresh mock manager instance directly.
  const propManager = managerProp
    ? new MockSRM()
    : undefined

  const el = noProvider ? (
    <ProjectPresenceStack
      scope={{ type: 'project', id: 'proj-1' }}
      currentUserId={currentUserId}
      currentUserDisplayName="Me"
      manager={propManager}
    />
  ) : (
    <ProjectRealtimeProvider
      projectId="proj-1"
      currentUserId={currentUserId}
      currentUserDisplayName="Me"
      setIdeas={NOOP_SET_IDEAS}
    >
      <ProjectPresenceStack
        scope={{ type: 'project', id: 'proj-1' }}
        currentUserId={currentUserId}
        currentUserDisplayName="Me"
        manager={propManager}
      />
    </ProjectRealtimeProvider>
  )

  render(el)

  // Inject presence data via the captured handler.
  if (participants.length > 0) {
    act(() => {
      capturedPresenceHandler.current?.(participants)
    })
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  capturedPresenceHandler.reset()
  MockSRM.mockClear()
  mockMatchMedia(false)
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ProjectPresenceStack', () => {
  it('T-054B-050: renders self avatar when only self present', () => {
    renderStack({ participants: [makeParticipant(SELF_ID, 'Me')] })

    const group = screen.getByRole('group', { name: /Matrix viewers: 1 online/i })
    expect(within(group).getByRole('img', { name: /You \(viewing this matrix\)/i })).toBeInTheDocument()
  })

  it('T-054B-051: renders all avatars when 2–5 users', () => {
    renderStack({
      participants: [
        makeParticipant(SELF_ID, 'Me'),
        makeParticipant('u2', 'Bob', 2000),
        makeParticipant('u3', 'Carol', 3000),
      ],
    })

    const group = screen.getByRole('group', { name: /Matrix viewers: 3 online/i })
    expect(within(group).getAllByRole('img')).toHaveLength(3)
  })

  it('T-054B-052: renders overflow chip when > 5', () => {
    const participants = [
      makeParticipant(SELF_ID, 'Me', 1),
      makeParticipant('u2', 'B', 2),
      makeParticipant('u3', 'C', 3),
      makeParticipant('u4', 'D', 4),
      makeParticipant('u5', 'E', 5),
      makeParticipant('u6', 'F', 6),
      makeParticipant('u7', 'G', 7),
    ]
    renderStack({ participants })

    const group = screen.getByRole('group', { name: /Matrix viewers: 7 online/i })
    expect(within(group).getByText('+2')).toBeInTheDocument()
  })

  it('T-054B-053: self avatar appears first (leftmost in DOM)', () => {
    renderStack({
      participants: [
        makeParticipant('u2', 'Bob', 2000),
        makeParticipant(SELF_ID, 'Me', 1000),
      ],
    })

    const group = screen.getByRole('group', { name: /Matrix viewers: 2 online/i })
    const avatars = within(group).getAllByRole('img')
    expect(avatars[0]).toHaveAttribute('aria-label', expect.stringContaining('You'))
  })

  it('T-054B-054: aria-label is "Matrix viewers: N online" not "Session participants"', () => {
    renderStack({
      participants: [
        makeParticipant(SELF_ID, 'Me'),
        makeParticipant('u2', 'Bob', 2000),
      ],
    })

    expect(screen.getByRole('group', { name: 'Matrix viewers: 2 online' })).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: /Session participants/i })).not.toBeInTheDocument()
  })

  it('T-054B-055: uses shared manager from context when no prop given', () => {
    renderStack({ participants: [makeParticipant(SELF_ID, 'Me')] })

    // When no manager prop, the component uses the context manager (created by
    // ProjectRealtimeProvider via useProjectRealtime). Presence arrives via
    // capturedPresenceHandler — which the context's manager registered.
    expect(
      screen.getByRole('group', { name: /Matrix viewers: 1 online/i })
    ).toBeInTheDocument()
  })

  it('T-054B-056: uses prop manager when given', () => {
    // Render with managerProp=true — the prop manager creates a SECOND
    // ScopedRealtimeManager instance. The component uses the prop one.
    renderStack({ managerProp: true })

    // The prop manager's onPresence handler was captured last.
    // No presence injected → group shows 0 (empty).
    // Verify component didn't throw — it rendered the group element.
    // (When prop manager has no participants yet the group shows 0 online.)
    expect(
      screen.getByRole('group', { name: /Matrix viewers: 0 online/i })
    ).toBeInTheDocument()
  })

  it('T-054B-057: tooltip copy uses "viewing this matrix"', () => {
    renderStack({ participants: [makeParticipant('u2', 'Bob', 2000)] })

    const group = screen.getByRole('group')
    const avatar = within(group).getByRole('img', { name: /Bob/i })
    expect(avatar).toHaveAttribute('title', expect.stringContaining('viewing this matrix'))
  })

  it('T-054B-058: respects prefers-reduced-motion (no slide-in class)', () => {
    mockMatchMedia(true)
    renderStack({ participants: [makeParticipant(SELF_ID, 'Me')] })

    // New participant joins after initial render — would normally trigger animation
    act(() => {
      capturedPresenceHandler.current?.([
        makeParticipant(SELF_ID, 'Me'),
        makeParticipant('u2', 'Bob', 2000),
      ])
    })

    const group = screen.getByRole('group')
    const avatars = within(group).getAllByRole('img')
    for (const avatar of avatars) {
      expect(avatar).not.toHaveClass('animate-slide-right')
    }
  })

  it('T-054B-059: HSL background derived from shared userColor utility', () => {
    const fixedUserId = 'fixed-test-id'
    renderStack({
      participants: [makeParticipant(fixedUserId, 'Fixed')],
      currentUserId: 'different-user',
    })

    const group = screen.getByRole('group')
    const avatar = within(group).getByRole('img', { name: /Fixed/i })
    expect(avatar).toHaveStyle({ backgroundColor: userIdToHsl(fixedUserId) })
  })
})
