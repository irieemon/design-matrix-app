/**
 * T-054A-157 — DesignMatrix nullable context regression guard
 *
 * Proves that DesignMatrix renders safely with no DotVotingProvider in the
 * tree. useContext(DotVotingContext) returns null → no DotVoteControls render.
 * If someone changes DesignMatrix to call useDotVotingContext() (which throws),
 * this test fails immediately.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

// --------------------------------------------------------------------------
// Module mocks
// --------------------------------------------------------------------------

vi.mock('../../utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@dnd-kit/core', () => ({
  useDroppable: () => ({ setNodeRef: vi.fn() }),
}))

vi.mock('../matrix/OptimizedIdeaCard', () => ({
  OptimizedIdeaCard: ({ idea }: { idea: { id: string; content: string } }) => (
    <div data-testid={`idea-card-${idea.id}`}>{idea.content}</div>
  ),
}))

vi.mock('../ui', () => ({
  SkeletonMatrix: () => <div data-testid="skeleton-matrix" />,
}))

vi.mock('../../hooks/useComponentState', () => ({
  useComponentState: () => ({
    state: 'idle',
    isLoading: false,
    hasError: false,
    variant: 'matrix-safe',
    size: 'md',
    className: '',
    config: { errorMessage: undefined },
    setState: vi.fn(),
    setError: vi.fn(),
    setSuccess: vi.fn(),
    reset: vi.fn(),
    executeAction: vi.fn(),
  }),
}))

vi.mock('../../contexts/ComponentStateProvider', () => ({
  useComponentStateContext: () => null,
}))

vi.mock('../../hooks/useMatrixPerformance', () => ({
  useMatrixPerformance: () => ({ matrixRef: { current: null } }),
}))

// --------------------------------------------------------------------------
// Import after mocks
// --------------------------------------------------------------------------

import DesignMatrix from '../DesignMatrix'
import type { IdeaCard, User } from '../../types'

// --------------------------------------------------------------------------
// Fixtures
// --------------------------------------------------------------------------

const mockIdeas: IdeaCard[] = [
  { id: 'i1', content: 'Alpha', project_id: 'p1', x: 100, y: 100 } as IdeaCard,
  { id: 'i2', content: 'Beta', project_id: 'p1', x: 200, y: 200 } as IdeaCard,
]

const mockUser = {
  id: 'u1',
  email: 'test@example.com',
  role: 'user',
  name: 'Tester',
} as unknown as User

// --------------------------------------------------------------------------
// T-054A-157
// --------------------------------------------------------------------------

describe('T-054A-157: DesignMatrix nullable DotVotingContext', () => {
  it('renders with no DotVotingProvider and no vote groups', () => {
    // No DotVotingProvider wrapping — useContext returns null, must not throw.
    render(
      <DesignMatrix
        ideas={mockIdeas}
        currentUser={mockUser}
        onEditIdea={vi.fn()}
        onDeleteIdea={vi.fn()}
        onToggleCollapse={vi.fn()}
      />
    )

    // Ideas render normally (wrapper + card both carry the testid, so use getAllBy)
    expect(screen.getAllByTestId('idea-card-i1').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByTestId('idea-card-i2').length).toBeGreaterThanOrEqual(1)

    // No vote controls — null context path suppresses DotVoteControls entirely
    const voteGroups = screen.queryAllByRole('group', { name: /Votes for/i })
    expect(voteGroups).toHaveLength(0)
  })
})
