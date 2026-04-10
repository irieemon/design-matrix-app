/**
 * ReconnectingBadge component tests — Phase 05.4b Wave 1, Unit 1.6
 *
 * Tests T-054B-070 through T-054B-078 (9 tests).
 *
 * Uses fake timers for the 1.5s delay and 3s toast dismiss.
 * Context is mocked by rendering the component inside a wrapper that
 * provides a controlled ProjectRealtimeContext value.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import React, { useState } from 'react'

vi.mock('../../../utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('../../../lib/realtime/ScopedRealtimeManager', () => ({
  ScopedRealtimeManager: vi.fn(),
}))

vi.mock('../../../lib/repositories/ideaRepository', () => ({
  IdeaRepository: { getProjectIdeas: vi.fn().mockResolvedValue([]) },
}))

vi.mock('../../../hooks/useProjectRealtime', () => ({
  useProjectRealtime: vi.fn(() => ({
    manager: null,
    connectionState: 'connected',
    previousConnectionState: null,
    participants: [],
  })),
}))

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { ReconnectingBadge } from '../ReconnectingBadge'
import {
  ProjectRealtimeContext,
  type ProjectRealtimeContextValue,
} from '../../../contexts/ProjectRealtimeContext'
import type { ConnectionState } from '../../../lib/realtime/ScopedRealtimeManager'

// ---------------------------------------------------------------------------
// Helper: wrapper that lets tests control connectionState + previousConnectionState
// ---------------------------------------------------------------------------

function makeContextValue(
  connectionState: ConnectionState,
  previousConnectionState: ConnectionState | null
): ProjectRealtimeContextValue {
  return {
    manager: null,
    connectionState,
    previousConnectionState,
    participants: [],
    cursors: new Map(),
    lockedCards: new Map(),
    currentUserId: 'user-1',
    currentUserDisplayName: 'Me',
    attachPointerTracking: () => () => {},
    dragLock: {
      acquire: () => true,
      release: () => undefined,
      isLockedByOther: () => false,
    },
  }
}

interface WrapperProps {
  initialState?: ConnectionState
  initialPrev?: ConnectionState | null
}

/** Controllable wrapper: exposes setState so tests can rerender with new state. */
function ControlledWrapper({
  initialState = 'connected',
  initialPrev = null,
}: WrapperProps): React.ReactElement {
  const [state, setState] = useState<ConnectionState>(initialState)
  const [prev, setPrev] = useState<ConnectionState | null>(initialPrev)

  // Expose control via data attributes so tests can interact
  return (
    <ProjectRealtimeContext.Provider value={makeContextValue(state, prev)}>
      <ReconnectingBadge />
      {/* Hidden controls for test manipulation */}
      <button
        data-testid="set-reconnecting"
        onClick={() => { setPrev(state); setState('reconnecting') }}
      />
      <button
        data-testid="set-polling"
        onClick={() => { setPrev(state); setState('polling') }}
      />
      <button
        data-testid="set-connected"
        onClick={() => { setPrev(state); setState('connected') }}
      />
    </ProjectRealtimeContext.Provider>
  )
}

/** Simple static context wrapper for tests that don't need state changes. */
function StaticWrapper({
  connectionState,
  previousConnectionState = null,
}: {
  connectionState: ConnectionState
  previousConnectionState?: ConnectionState | null
}): React.ReactElement {
  return (
    <ProjectRealtimeContext.Provider
      value={makeContextValue(connectionState, previousConnectionState)}
    >
      <ReconnectingBadge />
    </ProjectRealtimeContext.Provider>
  )
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.runOnlyPendingTimers()
  vi.useRealTimers()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ReconnectingBadge', () => {
  it('T-054B-070: renders null when connected', () => {
    render(<StaticWrapper connectionState="connected" />)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('T-054B-071: renders null during first 1.5s of disconnect', () => {
    render(<StaticWrapper connectionState="reconnecting" />)
    act(() => { vi.advanceTimersByTime(1499) })
    expect(screen.queryByRole('status', { name: /Reconnecting/i })).toBeNull()
  })

  it('T-054B-072: renders reconnecting badge after 1.5s', () => {
    render(<StaticWrapper connectionState="reconnecting" />)
    act(() => { vi.advanceTimersByTime(1501) })
    const status = screen.getByRole('status')
    expect(status.textContent).toMatch(/Reconnecting/i)
  })

  it('T-054B-073: shows spinner in reconnecting state', () => {
    render(<StaticWrapper connectionState="reconnecting" />)
    act(() => { vi.advanceTimersByTime(1501) })
    expect(screen.getByTestId('reconnecting-spinner')).toBeInTheDocument()
  })

  it('T-054B-074: shows WifiOff icon in polling state (not spinner)', () => {
    render(<StaticWrapper connectionState="polling" />)
    act(() => { vi.advanceTimersByTime(1501) })
    expect(screen.getByTestId('polling-wifi-off')).toBeInTheDocument()
    expect(screen.queryByTestId('reconnecting-spinner')).toBeNull()
  })

  it('T-054B-075: shows polling copy', () => {
    render(<StaticWrapper connectionState="polling" />)
    act(() => { vi.advanceTimersByTime(1501) })
    const status = screen.getByRole('status')
    expect(status.textContent).toMatch(/Working offline/i)
  })

  it('T-054B-076: recovery toast fires on reconnecting→connected', () => {
    render(
      <StaticWrapper
        connectionState="connected"
        previousConnectionState="reconnecting"
      />
    )
    expect(
      screen.getByRole('status', { name: /Back online. Synced./i })
    ).toBeInTheDocument()
  })

  it('T-054B-077: recovery toast does NOT fire on polling→connected', () => {
    render(
      <StaticWrapper
        connectionState="connected"
        previousConnectionState="polling"
      />
    )
    expect(
      screen.queryByRole('status', { name: /Back online/i })
    ).toBeNull()
  })

  it('T-054B-078: recovery toast auto-dismisses after 3s', () => {
    render(
      <StaticWrapper
        connectionState="connected"
        previousConnectionState="reconnecting"
      />
    )
    expect(
      screen.getByRole('status', { name: /Back online/i })
    ).toBeInTheDocument()

    act(() => { vi.advanceTimersByTime(3001) })

    expect(
      screen.queryByRole('status', { name: /Back online/i })
    ).toBeNull()
  })
})
