/**
 * MatrixFullScreenView — Project Realtime Integration Tests
 * Phase 05.4b Wave 1, Unit 1.8
 *
 * Tests T-054B-090 through T-054B-096 (7 tests).
 *
 * All integration assertions use within(getAllByTestId(...)[0]) for StrictMode
 * compatibility — React StrictMode double-invokes effects so there can be
 * multiple mounted instances in the DOM. We assert on the first one consistently.
 *
 * No fallback branches. No .toBeDefined() on assertion targets.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, act } from '@testing-library/react'
import React from 'react'

// ---------------------------------------------------------------------------
// vi.hoisted — shared state for mock factories
// ---------------------------------------------------------------------------

type ConnectionHandler = (state: string) => void
type PresenceHandler = (p: unknown[]) => void
type PostgresHandler = (payload: {
  new: Record<string, unknown>
  old: Record<string, unknown> | null
  eventType: string
}) => void

const {
  capturedConnectionHandler,
  capturedPresenceHandler,
  capturedPostgresHandlers,
  MockSRM,
} = vi.hoisted(() => {
  let _connHandler: ConnectionHandler | null = null
  let _presHandler: PresenceHandler | null = null
  const _postgresHandlers = new Map<string, PostgresHandler>()

  const _MockSRM = vi.fn().mockImplementation(() => ({
    subscribe: vi.fn().mockResolvedValue(undefined),
    unsubscribe: vi.fn().mockResolvedValue(undefined),
    onPresence: vi.fn((handler: PresenceHandler) => {
      _presHandler = handler
    }),
    onPostgresChange: vi.fn(
      (table: string, filter: { event: string }, handler: PostgresHandler) => {
        _postgresHandlers.set(`${table}:${filter.event}`, handler)
      }
    ),
    onConnectionStateChange: vi.fn((handler: ConnectionHandler) => {
      _connHandler = handler
      return () => {}
    }),
    onPollingTick: vi.fn(() => () => {}),
    sendBroadcast: vi.fn(),
  }))

  return {
    capturedConnectionHandler: {
      get current() { return _connHandler },
      reset() { _connHandler = null },
    },
    capturedPresenceHandler: {
      get current() { return _presHandler },
      reset() { _presHandler = null },
    },
    capturedPostgresHandlers: {
      get(key: string) { return _postgresHandlers.get(key) },
      reset() { _postgresHandlers.clear() },
    },
    MockSRM: _MockSRM,
  }
})

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../../../utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('../../../lib/config', () => ({
  isFeatureEnabled: vi.fn().mockReturnValue(false),
}))

vi.mock('../../../hooks/useBrainstormRealtime', () => ({
  useBrainstormRealtime: vi.fn().mockReturnValue({
    participants: [],
    ideas: [],
    sessionState: null,
    connectionStatus: 'connected',
  }),
}))

vi.mock('../../../lib/services/BrainstormSessionService', () => ({
  BrainstormSessionService: { createSession: vi.fn() },
}))

vi.mock('../../../lib/realtime/ScopedRealtimeManager', () => ({
  ScopedRealtimeManager: MockSRM,
}))

vi.mock('../../../lib/repositories/ideaRepository', () => ({
  IdeaRepository: { getProjectIdeas: vi.fn().mockResolvedValue([]) },
}))

vi.mock('../../../lib/repositories/voteRepository', () => ({
  castVote: vi.fn().mockResolvedValue({ ok: true }),
  removeVote: vi.fn().mockResolvedValue(undefined),
  listVotesForSession: vi.fn().mockResolvedValue([]),
  reconcileTallies: vi.fn().mockResolvedValue(new Map()),
  VoteRepositoryError: class VoteRepositoryError extends Error {
    override readonly name = 'VoteRepositoryError'
  },
}))

vi.mock('../../brainstorm/SessionQRCode', () => ({ default: () => null }))
vi.mock('../../brainstorm/SessionControls', () => ({ default: () => null }))
vi.mock('../../brainstorm/DesktopParticipantPanel', () => ({ default: () => null }))

vi.mock('../../../contexts/DotVotingContext', () => {
  const { createContext, createElement } = require('react')
  const DotVotingContext = createContext(null)
  return {
    DotVotingContext,
    DotVotingProvider: ({ children }: { children: unknown }) =>
      createElement(DotVotingContext.Provider, { value: null }, children),
    useDotVotingContext: () => {
      throw new Error('useDotVotingContext must be used inside DotVotingProvider')
    },
  }
})

vi.mock('../../DesignMatrix', () => ({
  default: () => <div data-testid="design-matrix" />,
}))

vi.mock('../OptimizedIdeaCard', () => ({
  OptimizedIdeaCard: () => <div data-testid="idea-card" />,
}))

vi.mock('../../AddIdeaModal', () => ({ default: () => null }))
vi.mock('../../AIIdeaModal', () => ({ default: () => null }))
vi.mock('../../EditIdeaModal', () => ({ default: () => null }))

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { MatrixFullScreenView } from '../MatrixFullScreenView'
import type { IdeaCard, User, Project } from '../../../types'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockUser: User = {
  id: 'u1',
  email: 'alice@example.com',
  role: 'user',
  full_name: 'Alice',
} as unknown as User

const mockProject: Project = {
  id: 'proj-1',
  name: 'Test Project',
} as unknown as Project

const mockIdeas: IdeaCard[] = [
  { id: 'i1', content: 'Idea 1', project_id: 'proj-1' } as IdeaCard,
]

const baseProps = {
  isActive: true,
  onExit: vi.fn(),
  currentUser: mockUser,
  currentProject: mockProject,
  ideas: mockIdeas,
  onEditIdea: vi.fn(),
  onDeleteIdea: vi.fn().mockResolvedValue(undefined),
  onToggleCollapse: vi.fn().mockResolvedValue(undefined),
  onDragEnd: vi.fn().mockResolvedValue(undefined),
  setIdeas: vi.fn(),
}

// Helper: get the first instance of a potentially double-rendered testid
// (React StrictMode mounts twice in dev; we assert on the first found element)
function getFirst(testId: string): HTMLElement {
  const els = screen.getAllByTestId(testId)
  return els[0]
}

beforeEach(() => {
  vi.clearAllMocks()
  MockSRM.mockClear()
  capturedConnectionHandler.reset()
  capturedPresenceHandler.reset()
  capturedPostgresHandlers.reset()

  Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
    writable: true,
    value: vi.fn().mockResolvedValue(undefined),
  })
  Object.defineProperty(document, 'fullscreenElement', {
    writable: true,
    value: null,
  })
  Object.defineProperty(document, 'exitFullscreen', {
    writable: true,
    value: vi.fn().mockResolvedValue(undefined),
  })
})

afterEach(() => {
  // Only flush pending timers if fake timers are active
  if (vi.isFakeTimers?.()) {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  }
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MatrixFullScreenView — project realtime integration', () => {
  it('T-054B-090: presence stack renders in action bar with 2 participants', async () => {
    vi.useFakeTimers()
    render(<MatrixFullScreenView {...baseProps} />)

    await act(async () => {
      capturedPresenceHandler.current?.([
        { userId: 'u1', displayName: 'Alice', joinedAt: 1, tabId: 't1' },
        { userId: 'u2', displayName: 'Bob', joinedAt: 2, tabId: 't2' },
      ])
    })

    const actionBar = getFirst('matrix-action-bar')
    expect(
      within(actionBar).getByRole('group', { name: /Matrix viewers: 2 online/i })
    ).toBeInTheDocument()
  })

  it('T-054B-091: presence stack coexists with session presence stack', () => {
    render(
      <MatrixFullScreenView
        {...baseProps}
        activeSessionId="session-1"
        sessionUserId="u1"
      />
    )

    const actionBar = getFirst('matrix-action-bar')
    expect(
      within(actionBar).getByRole('group', { name: /Matrix viewers/i })
    ).toBeInTheDocument()
    expect(
      within(actionBar).getByRole('group', { name: /Session participants/i })
    ).toBeInTheDocument()
  })

  it('T-054B-092: ReconnectingBadge appears after disconnect + 1.5s', () => {
    vi.useFakeTimers()
    render(<MatrixFullScreenView {...baseProps} />)

    act(() => {
      capturedConnectionHandler.current?.('reconnecting')
    })

    act(() => {
      vi.advanceTimersByTime(1501)
    })

    const view = getFirst('fullscreen-view')
    expect(
      within(view).getByRole('status', { name: /Reconnecting/i })
    ).toBeInTheDocument()
  })

  it('T-054B-093: postgres_changes UPDATE merges into setIdeas', () => {
    const setIdeas = vi.fn()
    render(<MatrixFullScreenView {...baseProps} setIdeas={setIdeas} />)

    const updateHandler = capturedPostgresHandlers.get('ideas:UPDATE')

    act(() => {
      updateHandler!({
        new: { id: 'i1', x: 200, y: 250 },
        old: { id: 'i1', x: 0, y: 0 },
        eventType: 'UPDATE',
      })
    })

    expect(setIdeas).toHaveBeenCalledTimes(1)
    const updater = setIdeas.mock.calls[0][0] as (prev: IdeaCard[]) => IdeaCard[]
    const result = updater([{ id: 'i1', x: 0, y: 0 } as IdeaCard])
    expect(result[0].x).toBe(200)
    expect(result[0].y).toBe(250)
  })

  it('T-054B-094: session and project managers have distinct scope types', () => {
    render(
      <MatrixFullScreenView
        {...baseProps}
        activeSessionId="session-1"
        sessionUserId="u1"
      />
    )

    // Extract all scope types from constructor calls
    const scopeTypes = MockSRM.mock.calls.map(
      (call: [{ scope: { type: string } }]) => call[0].scope.type
    )
    // Both scope types must be present (one session, one project)
    expect(scopeTypes).toContain('session')
    expect(scopeTypes).toContain('project')
    // Under StrictMode + local-fallback: 2 (provider effect × 2 StrictMode invocations)
    // + 2 (ProjectPresenceStack local fallback × StrictMode) = 4.
    // A double-provider regression would produce 6 or 8 — lock the baseline here.
    expect(MockSRM.mock.calls.filter((c: any) => c[0]?.scope?.type === 'project')).toHaveLength(4)
  })

  it('T-054B-095: project realtime provider wraps design-matrix (ancestor check)', () => {
    render(<MatrixFullScreenView {...baseProps} />)
    const provider = getFirst('project-realtime-provider')
    const matrix = screen.getByTestId('design-matrix')
    expect(provider).toContainElement(matrix)
  })

  it('T-054B-096: SessionPresenceStack still renders with voting manager (no break from userColor refactor)', () => {
    render(
      <MatrixFullScreenView
        {...baseProps}
        activeSessionId="session-1"
        sessionUserId="u1"
      />
    )
    const actionBar = getFirst('matrix-action-bar')
    expect(
      within(actionBar).getByRole('group', { name: /Session participants/i })
    ).toBeInTheDocument()
  })
})
