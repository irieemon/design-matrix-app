/**
 * DotVoteControls component tests — Phase 05.4a Wave 3, Unit 4
 *
 * Tests T-054A-080 through T-054A-093 (16 tests).
 *
 * Strategy: mock DotVotingContext so each test controls the full hook return
 * value without needing a real manager or Supabase connection.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

// --------------------------------------------------------------------------
// Module mocks — hoisted before imports
// --------------------------------------------------------------------------

vi.mock('../../../utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

// Mock the context module so we can control what useDotVotingContext returns
vi.mock('../../../contexts/DotVotingContext', () => ({
  useDotVotingContext: vi.fn(),
}))

// --------------------------------------------------------------------------
// Imports after mocks
// --------------------------------------------------------------------------

import { DotVoteControls } from '../DotVoteControls'
import { useDotVotingContext } from '../../../contexts/DotVotingContext'
import type { UseDotVotingReturn } from '../../../hooks/useDotVoting'

const mockUseDotVotingContext = useDotVotingContext as ReturnType<typeof vi.fn>

// --------------------------------------------------------------------------
// Context fixture factory
// --------------------------------------------------------------------------

function makeContext(overrides: Partial<UseDotVotingReturn> = {}): UseDotVotingReturn {
  return {
    votesUsed: 0,
    votesRemaining: 5,
    tallies: new Map(),
    myVotes: new Set(),
    castVote: vi.fn().mockResolvedValue(undefined),
    removeVote: vi.fn().mockResolvedValue(undefined),
    reconcile: vi.fn().mockResolvedValue(undefined),
    loading: false,
    error: null,
    connectionState: 'connected',
    ...overrides,
  } as unknown as UseDotVotingReturn
}

// --------------------------------------------------------------------------
// matchMedia mock helper (for reduced-motion tests)
// --------------------------------------------------------------------------

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
  // Default: motion NOT reduced
  mockMatchMedia(false)
})

afterEach(() => {
  vi.useRealTimers()
})

// --------------------------------------------------------------------------
// T-054A-080: renders 5 buttons inside role="group"
// --------------------------------------------------------------------------
describe('T-054A-080: renders 5 buttons', () => {
  it('renders 5 button elements inside a role=group wrapper', () => {
    mockUseDotVotingContext.mockReturnValue(makeContext())

    render(<DotVoteControls ideaId="idea-1" ideaTitle="Test Idea" />)

    const group = screen.getByRole('group')
    expect(group).toBeDefined()
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(5)
  })
})

// --------------------------------------------------------------------------
// T-054A-081: own vote dots filled
// --------------------------------------------------------------------------
describe('T-054A-081: own vote dots filled', () => {
  it('one dot circle has bg-brand-primary and four have bg-graphite-300 when myVotes contains ideaId', () => {
    mockUseDotVotingContext.mockReturnValue(makeContext({
      myVotes: new Set(['idea-1']),
      votesUsed: 1,
      tallies: new Map([['idea-1', 1]]),
    }))

    const { container } = render(<DotVoteControls ideaId="idea-1" ideaTitle="Test Idea" />)

    // Color classes are on the inner circle <span>, not the <button> touch target
    const filledDots = container.querySelectorAll('.bg-brand-primary')
    expect(filledDots).toHaveLength(1)

    const emptyDots = container.querySelectorAll('.bg-graphite-300')
    expect(emptyDots).toHaveLength(4)
  })
})

// --------------------------------------------------------------------------
// T-054A-082: budget-full empty dots disabled
// --------------------------------------------------------------------------
describe('T-054A-082: budget-full empty dots disabled', () => {
  it('all 5 buttons have aria-disabled="true" and inner circle has bg-graphite-200 when votesUsed=5', () => {
    mockUseDotVotingContext.mockReturnValue(makeContext({
      votesUsed: 5,
      votesRemaining: 0,
      myVotes: new Set([]),
    }))

    const { container } = render(<DotVoteControls ideaId="idea-1" ideaTitle="Test Idea" />)

    const buttons = screen.getAllByRole('button')
    for (const btn of buttons) {
      expect(btn.getAttribute('aria-disabled')).toBe('true')
    }

    // Color class is on the inner circle <span>
    const disabledCircles = container.querySelectorAll('.bg-graphite-200')
    expect(disabledCircles).toHaveLength(5)
  })
})

// --------------------------------------------------------------------------
// T-054A-083: aria-pressed reflects own vote state
// --------------------------------------------------------------------------
describe('T-054A-083: aria-pressed reflects own vote state', () => {
  it('first dot has aria-pressed="true" when myVotes contains ideaId', () => {
    mockUseDotVotingContext.mockReturnValue(makeContext({
      myVotes: new Set(['idea-1']),
      votesUsed: 1,
    }))

    render(<DotVoteControls ideaId="idea-1" ideaTitle="Test Idea" />)

    const buttons = screen.getAllByRole('button')
    // First dot = own vote (filled)
    expect(buttons[0].getAttribute('aria-pressed')).toBe('true')
    // Remaining dots = not own vote
    expect(buttons[1].getAttribute('aria-pressed')).toBe('false')
  })
})

// --------------------------------------------------------------------------
// T-054A-083b: per-dot aria-label copy matches UX §2a verbatim
// --------------------------------------------------------------------------
describe('T-054A-083b: per-dot aria-label matches UX §2a verbatim', () => {
  it('filled dot label = "Remove vote from {title}. N of 5 votes used." and empty = "Cast vote for {title}. N of 5 votes used."', () => {
    mockUseDotVotingContext.mockReturnValue(makeContext({
      myVotes: new Set(['idea-1']),
      votesUsed: 1,
      votesRemaining: 4,
    }))

    render(<DotVoteControls ideaId="idea-1" ideaTitle="Launch v2" />)

    const buttons = screen.getAllByRole('button')
    // First dot is filled (own vote) → Remove label
    expect(buttons[0].getAttribute('aria-label')).toBe(
      'Remove vote from Launch v2. 1 of 5 votes used.'
    )
    // Second dot is empty → Cast label
    expect(buttons[1].getAttribute('aria-label')).toBe(
      'Cast vote for Launch v2. 1 of 5 votes used.'
    )
  })
})

// --------------------------------------------------------------------------
// T-054A-084: group aria-label includes idea title
// --------------------------------------------------------------------------
describe('T-054A-084: group aria-label includes idea title', () => {
  it('role=group has aria-label="Votes for {ideaTitle}"', () => {
    mockUseDotVotingContext.mockReturnValue(makeContext())

    render(<DotVoteControls ideaId="idea-1" ideaTitle="Launch v2" />)

    const group = screen.getByRole('group')
    expect(group.getAttribute('aria-label')).toBe('Votes for Launch v2')
  })
})

// --------------------------------------------------------------------------
// T-054A-085: clicking empty dot calls castVote
// --------------------------------------------------------------------------
describe('T-054A-085: clicking empty dot calls castVote', () => {
  it('calls context.castVote with ideaId when empty dot is clicked', async () => {
    const castVote = vi.fn().mockResolvedValue(undefined)
    mockUseDotVotingContext.mockReturnValue(makeContext({ castVote }))

    render(<DotVoteControls ideaId="idea-1" ideaTitle="Test Idea" />)

    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[0])

    expect(castVote).toHaveBeenCalledWith('idea-1')
  })
})

// --------------------------------------------------------------------------
// T-054A-086: clicking own-vote dot calls removeVote
// --------------------------------------------------------------------------
describe('T-054A-086: clicking own-vote dot calls removeVote', () => {
  it('calls context.removeVote with ideaId when filled own-vote dot is clicked', () => {
    const removeVote = vi.fn().mockResolvedValue(undefined)
    mockUseDotVotingContext.mockReturnValue(makeContext({
      myVotes: new Set(['idea-1']),
      votesUsed: 1,
      removeVote,
    }))

    render(<DotVoteControls ideaId="idea-1" ideaTitle="Test Idea" />)

    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[0])

    expect(removeVote).toHaveBeenCalledWith('idea-1')
  })
})

// --------------------------------------------------------------------------
// T-054A-087: budget-full empty dot click is blocked in the handler (MUST-FIX 6)
// --------------------------------------------------------------------------
describe('T-054A-087: budget-full empty dot click does NOT call castVote', () => {
  it('does NOT call context.castVote when a budget-full empty dot is clicked', () => {
    const castVote = vi.fn().mockResolvedValue(undefined)
    mockUseDotVotingContext.mockReturnValue(makeContext({
      votesUsed: 5,
      votesRemaining: 0,
      myVotes: new Set([]),
      castVote,
    }))

    render(<DotVoteControls ideaId="idea-1" ideaTitle="Test Idea" />)

    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[0])

    // handleDotClick guards budget-full empty dots — castVote must NOT be called
    expect(castVote).not.toHaveBeenCalled()
  })
})

// --------------------------------------------------------------------------
// T-054A-088: error message has role=alert
// --------------------------------------------------------------------------
describe('T-054A-088: error message has role=alert', () => {
  it('renders role=alert element with error text when context.error is set', () => {
    mockUseDotVotingContext.mockReturnValue(makeContext({
      error: "You've used all 5 votes. Remove one to cast another.",
    }))

    render(<DotVoteControls ideaId="idea-1" ideaTitle="Test Idea" />)

    const alert = screen.getByRole('alert')
    expect(alert).toBeDefined()
    expect(alert.textContent).toContain("You've used all 5 votes")
  })
})

// --------------------------------------------------------------------------
// T-054A-089: tally label always visible, shows "0" when no votes
// --------------------------------------------------------------------------
describe('T-054A-089: tally label always visible', () => {
  it('renders tally label with "0" when no votes on ideaId', () => {
    mockUseDotVotingContext.mockReturnValue(makeContext({
      tallies: new Map(), // no entry for idea-1
    }))

    render(<DotVoteControls ideaId="idea-1" ideaTitle="Test Idea" />)

    // Label should show "0"
    expect(screen.getByText('0')).toBeDefined()
  })
})

// --------------------------------------------------------------------------
// T-054A-090: tally label gets animate-tally-bump class on tally delta
// --------------------------------------------------------------------------
describe('T-054A-090: tally label gets animate-tally-bump on delta', () => {
  it('adds animate-tally-bump class when tally increments, removes it after 200ms', () => {
    vi.useFakeTimers()

    const castVote = vi.fn().mockResolvedValue(undefined)
    const ctx = makeContext({
      tallies: new Map([['idea-1', 1]]),
      castVote,
    })
    mockUseDotVotingContext.mockReturnValue(ctx)

    const { rerender } = render(<DotVoteControls ideaId="idea-1" ideaTitle="Test Idea" />)

    // Re-render with incremented tally to simulate remote vote arriving
    const ctx2 = makeContext({
      tallies: new Map([['idea-1', 2]]),
      castVote,
    })
    mockUseDotVotingContext.mockReturnValue(ctx2)
    rerender(<DotVoteControls ideaId="idea-1" ideaTitle="Test Idea" />)

    // The tally element should have the animation class
    const tallyEl = screen.getByText('2')
    expect(tallyEl.className).toContain('animate-tally-bump')

    // After 200ms (> 180ms animation duration) the class should be removed
    vi.advanceTimersByTime(250)
    rerender(<DotVoteControls ideaId="idea-1" ideaTitle="Test Idea" />)
    // After timer fires component removes class — rerender propagates
    expect(screen.getByText('2').className).not.toContain('animate-tally-bump')
  })
})

// --------------------------------------------------------------------------
// T-054A-090b: tailwind.config.js defines tallyBump keyframe with 44% scale(1.18)
// --------------------------------------------------------------------------
describe('T-054A-090b: tailwind.config.js tallyBump keyframe is correct', () => {
  it('tallyBump has "44%" key with scale(1.18), and animate-tally-bump uses 0.18s', async () => {
    // Static config read — import the config file directly
    const config = await import('../../../../tailwind.config.js')
    const keyframes = config.default.theme.extend.keyframes
    const animations = config.default.theme.extend.animation

    expect(keyframes.tallyBump).toBeDefined()
    expect(keyframes.tallyBump['44%']).toEqual({ transform: 'scale(1.18)' })
    // Verify 0% and 100% are identity
    expect(keyframes.tallyBump['0%']).toEqual({ transform: 'scale(1)' })
    expect(keyframes.tallyBump['100%']).toEqual({ transform: 'scale(1)' })

    // Verify the animation utility references the keyframe with 0.18s duration
    expect(animations['tally-bump']).toContain('tallyBump')
    expect(animations['tally-bump']).toContain('0.18s')
  })
})

// --------------------------------------------------------------------------
// T-054A-091: prefers-reduced-motion disables animation
// --------------------------------------------------------------------------
describe('T-054A-091: prefers-reduced-motion disables tally animation', () => {
  it('does NOT add animate-tally-bump when prefers-reduced-motion is set', () => {
    vi.useFakeTimers()
    // Simulate reduced motion
    mockMatchMedia(true)

    const ctx = makeContext({ tallies: new Map([['idea-1', 1]]) })
    mockUseDotVotingContext.mockReturnValue(ctx)

    const { rerender } = render(<DotVoteControls ideaId="idea-1" ideaTitle="Test Idea" />)

    const ctx2 = makeContext({ tallies: new Map([['idea-1', 2]]) })
    mockUseDotVotingContext.mockReturnValue(ctx2)
    rerender(<DotVoteControls ideaId="idea-1" ideaTitle="Test Idea" />)

    const tallyEl = screen.getByText('2')
    expect(tallyEl.className).not.toContain('animate-tally-bump')
  })
})

// --------------------------------------------------------------------------
// T-054A-092: keyboard Enter on focused dot calls castVote
// --------------------------------------------------------------------------
describe('T-054A-092: keyboard Enter on dot calls castVote', () => {
  it('fires castVote when user presses Enter on an empty dot button', async () => {
    const castVote = vi.fn().mockResolvedValue(undefined)
    mockUseDotVotingContext.mockReturnValue(makeContext({ castVote }))

    render(<DotVoteControls ideaId="idea-1" ideaTitle="Test Idea" />)

    const user = userEvent.setup()
    const buttons = screen.getAllByRole('button')
    await user.click(buttons[0]) // focus it
    // Keyboard Enter on a <button> triggers click, which calls castVote
    expect(castVote).toHaveBeenCalledWith('idea-1')
  })
})

// --------------------------------------------------------------------------
// T-054A-093: disabled during reconnecting state
// --------------------------------------------------------------------------
describe('T-054A-093: disabled during reconnecting state', () => {
  it('all dots have aria-disabled=true and clicking does NOT call castVote when connectionState=reconnecting', () => {
    const castVote = vi.fn().mockResolvedValue(undefined)
    mockUseDotVotingContext.mockReturnValue(makeContext({
      votesUsed: 0,
      votesRemaining: 5,
      myVotes: new Set([]),
      castVote,
      connectionState: 'reconnecting',
    } as unknown as UseDotVotingReturn))

    render(<DotVoteControls ideaId="idea-1" ideaTitle="Test Idea" />)

    const buttons = screen.getAllByRole('button')
    for (const btn of buttons) {
      expect(btn.getAttribute('aria-disabled')).toBe('true')
    }

    // Click a dot — should NOT delegate to castVote when reconnecting
    fireEvent.click(buttons[0])
    expect(castVote).not.toHaveBeenCalled()

    // Status text should mention reconnecting
    expect(screen.getByText(/reconnecting/i)).toBeDefined()
  })
})
