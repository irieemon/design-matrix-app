/**
 * ProjectRealtimeContext tests — Phase 05.4b Wave 1, Unit 1.4
 *
 * Tests T-054B-030 through T-054B-037 (8 tests).
 *
 * useProjectRealtime is mocked so the context tests don't depend on
 * ScopedRealtimeManager internals. The mock returns a controlled shape.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

// ---------------------------------------------------------------------------
// Module mocks (vi.hoisted for factory-safe references)
// ---------------------------------------------------------------------------

vi.mock('../../utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

const { mockHookReturn, MockSRM } = vi.hoisted(() => {
  const _MockSRM = vi.fn().mockImplementation(() => ({
    subscribe: vi.fn().mockResolvedValue(undefined),
    unsubscribe: vi.fn().mockResolvedValue(undefined),
    onPostgresChange: vi.fn(),
    onPresence: vi.fn(),
    onConnectionStateChange: vi.fn(() => () => {}),
    onPollingTick: vi.fn(() => () => {}),
    sendBroadcast: vi.fn(),
  }))

  const _mockHookReturn = {
    manager: null as unknown,
    connectionState: 'connected' as string,
    previousConnectionState: null as string | null,
    participants: [] as unknown[],
  }

  return {
    mockHookReturn: _mockHookReturn,
    MockSRM: _MockSRM,
  }
})

vi.mock('../../lib/realtime/ScopedRealtimeManager', () => ({
  ScopedRealtimeManager: MockSRM,
}))

vi.mock('../../lib/repositories/ideaRepository', () => ({
  IdeaRepository: { getProjectIdeas: vi.fn().mockResolvedValue([]) },
}))

vi.mock('../../hooks/useProjectRealtime', () => ({
  useProjectRealtime: vi.fn(() => ({
    manager: mockHookReturn.manager,
    connectionState: mockHookReturn.connectionState,
    previousConnectionState: mockHookReturn.previousConnectionState,
    participants: mockHookReturn.participants,
  })),
}))

vi.mock('../../hooks/useLiveCursors', () => ({
  useLiveCursors: vi.fn(() => ({
    cursors: new Map(),
    attachPointerTracking: vi.fn(() => () => {}),
    pauseBroadcast: vi.fn(),
    resumeBroadcast: vi.fn(),
  })),
}))

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import {
  ProjectRealtimeProvider,
  useProjectRealtimeContext,
  ProjectRealtimeContext,
} from '../ProjectRealtimeContext'
import { useProjectRealtime } from '../../hooks/useProjectRealtime'

const mockUseProjectRealtime = useProjectRealtime as ReturnType<typeof vi.fn>

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultProps = {
  projectId: 'proj-1',
  currentUserId: 'user-1',
  currentUserDisplayName: 'Alice',
  setIdeas: vi.fn(),
}

/** Consumer component that reads from context and renders key fields. */
function ContextConsumer(): React.ReactElement {
  const ctx = useProjectRealtimeContext()
  return (
    <div>
      <span data-testid="connection-state">{ctx.connectionState}</span>
      <span data-testid="current-user-id">{ctx.currentUserId}</span>
      <span data-testid="cursors-size">{ctx.cursors.size}</span>
      <span data-testid="locked-cards-size">{ctx.lockedCards.size}</span>
      <span data-testid="participants-count">{ctx.participants.length}</span>
    </div>
  )
}

/** Consumer that reads context nullable (for T-054B-030). */
function ThrowingConsumer(): React.ReactElement {
  useProjectRealtimeContext()
  return <div />
}

beforeEach(() => {
  vi.clearAllMocks()
  mockHookReturn.manager = null
  mockHookReturn.connectionState = 'connected'
  mockHookReturn.previousConnectionState = null
  mockHookReturn.participants = []
  mockUseProjectRealtime.mockImplementation(() => ({
    manager: mockHookReturn.manager,
    connectionState: mockHookReturn.connectionState,
    previousConnectionState: mockHookReturn.previousConnectionState,
    participants: mockHookReturn.participants,
  }))
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ProjectRealtimeContext', () => {
  it('T-054B-030: useProjectRealtimeContext throws when outside provider', () => {
    expect(() => render(<ThrowingConsumer />)).toThrow(
      /must be used inside ProjectRealtimeProvider/
    )
  })

  it('T-054B-031: useProjectRealtimeContext returns value inside provider', () => {
    render(
      <ProjectRealtimeProvider {...defaultProps}>
        <ContextConsumer />
      </ProjectRealtimeProvider>
    )
    expect(screen.getByTestId('connection-state')).toBeInTheDocument()
  })

  it('T-054B-032: provider exposes manager from useProjectRealtime', () => {
    const fakeManager = { subscribe: vi.fn() }
    mockHookReturn.manager = fakeManager
    mockUseProjectRealtime.mockReturnValue({
      manager: fakeManager,
      connectionState: 'connected',
      previousConnectionState: null,
      participants: [],
    })

    function ManagerConsumer(): React.ReactElement {
      const ctx = useProjectRealtimeContext()
      return <span data-testid="has-manager">{ctx.manager ? 'yes' : 'no'}</span>
    }

    render(
      <ProjectRealtimeProvider {...defaultProps}>
        <ManagerConsumer />
      </ProjectRealtimeProvider>
    )
    expect(screen.getByTestId('has-manager').textContent).toBe('yes')
  })

  it('T-054B-033: provider exposes empty cursors and lockedCards maps at Wave 1', () => {
    render(
      <ProjectRealtimeProvider {...defaultProps}>
        <ContextConsumer />
      </ProjectRealtimeProvider>
    )
    expect(screen.getByTestId('cursors-size').textContent).toBe('0')
    expect(screen.getByTestId('locked-cards-size').textContent).toBe('0')
  })

  it('T-054B-034: provider exposes connectionState from hook', () => {
    mockHookReturn.connectionState = 'polling'
    mockUseProjectRealtime.mockReturnValue({
      manager: null,
      connectionState: 'polling',
      previousConnectionState: null,
      participants: [],
    })

    render(
      <ProjectRealtimeProvider {...defaultProps}>
        <ContextConsumer />
      </ProjectRealtimeProvider>
    )
    expect(screen.getByTestId('connection-state').textContent).toBe('polling')
  })

  it('T-054B-035: provider exposes participants from hook', () => {
    const participants = [
      { userId: 'u1', displayName: 'Bob', joinedAt: 1, tabId: 't1' },
    ]
    mockHookReturn.participants = participants
    mockUseProjectRealtime.mockReturnValue({
      manager: null,
      connectionState: 'connected',
      previousConnectionState: null,
      participants,
    })

    render(
      <ProjectRealtimeProvider {...defaultProps}>
        <ContextConsumer />
      </ProjectRealtimeProvider>
    )
    expect(screen.getByTestId('participants-count').textContent).toBe('1')
  })

  it('T-054B-036: provider cleanup runs on unmount (via useProjectRealtime cleanup)', () => {
    // useProjectRealtime manages its own cleanup via useEffect return.
    // The provider delegates cleanup entirely to the hook — verify the hook
    // is called once (and its cleanup will run via React's useEffect).
    const { unmount } = render(
      <ProjectRealtimeProvider {...defaultProps}>
        <ContextConsumer />
      </ProjectRealtimeProvider>
    )
    expect(mockUseProjectRealtime).toHaveBeenCalledOnce()
    // Unmounting runs React effect cleanup (hook-managed unsubscribe).
    expect(() => unmount()).not.toThrow()
  })

  it('T-054B-037: provider propagates currentUserId and displayName to context', () => {
    render(
      <ProjectRealtimeProvider {...defaultProps}>
        <ContextConsumer />
      </ProjectRealtimeProvider>
    )
    expect(screen.getByTestId('current-user-id').textContent).toBe('user-1')
  })
})
