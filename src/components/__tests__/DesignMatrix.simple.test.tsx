import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// Mock the IdeaCardComponent
vi.mock('../IdeaCardComponent', () => ({
  default: ({ idea }: any) => (
    <div data-testid={`idea-card-${idea.id}`}>
      {idea.content}
    </div>
  )
}))

// Mock @dnd-kit/core
vi.mock('@dnd-kit/core', () => ({
  useDroppable: () => ({
    setNodeRef: vi.fn()
  })
}))

import DesignMatrix from '../DesignMatrix'

const mockIdeas = [
  {
    id: 'idea-1',
    content: 'Test Idea 1',
    details: 'Test details',
    x: 100,
    y: 150,
    priority: 'high' as const,
    project_id: 'test-project',
    created_by: 'test-user',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
]

const mockUser = {
  id: 'test-user',
  email: 'test@example.com',
  full_name: 'Test User',
  role: 'user' as const,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
}

describe('DesignMatrix - Basic Tests', () => {
  const defaultProps = {
    ideas: mockIdeas,
    currentUser: mockUser,
    onEditIdea: vi.fn(),
    onDeleteIdea: vi.fn(),
    onToggleCollapse: vi.fn()
  }

  it('should render matrix header', () => {
    render(<DesignMatrix {...defaultProps} />)

    expect(screen.getByText('Interactive Priority Matrix')).toBeInTheDocument()
  })

  it('should render quadrant labels', () => {
    render(<DesignMatrix {...defaultProps} />)

    expect(screen.getAllByText('Quick Wins')).toHaveLength(2) // One in matrix, one in legend
    expect(screen.getAllByText('Strategic')).toHaveLength(2)
    expect(screen.getAllByText('Reconsider')).toHaveLength(2)
    expect(screen.getAllByText('Avoid')).toHaveLength(2)
  })

  it('should render idea cards', () => {
    render(<DesignMatrix {...defaultProps} />)

    expect(screen.getByTestId('idea-card-idea-1')).toBeInTheDocument()
    expect(screen.getByText('Test Idea 1')).toBeInTheDocument()
  })

  it('should handle empty ideas array', () => {
    render(<DesignMatrix {...defaultProps} ideas={[]} />)

    expect(screen.getByText('Interactive Priority Matrix')).toBeInTheDocument()
    expect(screen.queryByTestId(/idea-card-/)).not.toBeInTheDocument()
  })
})