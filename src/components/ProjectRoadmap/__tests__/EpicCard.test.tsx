import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import EpicCard from '../EpicCard'
import { Epic } from '../types'

const mockEpic: Epic = {
  title: 'User Authentication System',
  description: 'Implement secure user authentication with JWT tokens',
  userStories: [
    'As a user, I want to create an account',
    'As a user, I want to log in securely'
  ],
  deliverables: [
    'User registration API',
    'Login/logout functionality',
    'JWT token management'
  ],
  priority: 'high',
  complexity: 'medium',
  relatedIdeas: ['User Management', 'Security Framework'],
  startMonth: 1,
  duration: 2,
  status: 'in-progress',
  team: 'Backend Team'
}

const minimalEpic: Epic = {
  title: 'Simple Feature',
  description: 'A basic feature',
  userStories: [],
  deliverables: [],
  priority: '',
  complexity: '',
  relatedIdeas: []
}

describe('EpicCard', () => {
  describe('basic rendering', () => {
    it('should render epic title and description', () => {
      render(<EpicCard epic={mockEpic} epicIndex={0} />)

      expect(screen.getByText('User Authentication System')).toBeInTheDocument()
      expect(screen.getByText('Implement secure user authentication with JWT tokens')).toBeInTheDocument()
    })

    it('should have correct data-testid', () => {
      render(<EpicCard epic={mockEpic} epicIndex={0} />)

      expect(screen.getByTestId('epic-card-0')).toBeInTheDocument()
    })

    it('should display priority badge with correct styling', () => {
      render(<EpicCard epic={mockEpic} epicIndex={0} />)

      const priorityBadge = screen.getByTestId('priority-high')
      expect(priorityBadge).toBeInTheDocument()
      expect(priorityBadge).toHaveTextContent('high')
      expect(priorityBadge).toHaveClass('bg-red-100', 'text-red-800', 'border-red-200')
    })

    it('should display complexity badge with correct styling', () => {
      render(<EpicCard epic={mockEpic} epicIndex={0} />)

      const complexityBadge = screen.getByTestId('complexity-medium')
      expect(complexityBadge).toBeInTheDocument()
      expect(complexityBadge).toHaveTextContent('medium')
      expect(complexityBadge).toHaveClass('bg-blue-100', 'text-blue-800', 'border-blue-200')
    })
  })

  describe('priority colors', () => {
    it('should show red color for high priority', () => {
      const highPriorityEpic = { ...mockEpic, priority: 'high' }
      render(<EpicCard epic={highPriorityEpic} epicIndex={0} />)

      const badge = screen.getByTestId('priority-high')
      expect(badge).toHaveClass('bg-red-100', 'text-red-800', 'border-red-200')
    })

    it('should show amber color for medium priority', () => {
      const mediumPriorityEpic = { ...mockEpic, priority: 'medium' }
      render(<EpicCard epic={mediumPriorityEpic} epicIndex={0} />)

      const badge = screen.getByTestId('priority-medium')
      expect(badge).toHaveClass('bg-amber-100', 'text-amber-800', 'border-amber-200')
    })

    it('should show green color for low priority', () => {
      const lowPriorityEpic = { ...mockEpic, priority: 'low' }
      render(<EpicCard epic={lowPriorityEpic} epicIndex={0} />)

      const badge = screen.getByTestId('priority-low')
      expect(badge).toHaveClass('bg-green-100', 'text-green-800', 'border-green-200')
    })

    it('should show default color for unknown priority', () => {
      const unknownPriorityEpic = { ...mockEpic, priority: '' }
      render(<EpicCard epic={unknownPriorityEpic} epicIndex={0} />)

      const badge = screen.getByTestId('priority-unknown')
      expect(badge).toHaveClass('bg-slate-100', 'text-slate-800', 'border-slate-200')
      expect(badge).toHaveTextContent('Unknown')
    })
  })

  describe('complexity colors', () => {
    it('should show purple color for high complexity', () => {
      const highComplexityEpic = { ...mockEpic, complexity: 'high' }
      render(<EpicCard epic={highComplexityEpic} epicIndex={0} />)

      const badge = screen.getByTestId('complexity-high')
      expect(badge).toHaveClass('bg-purple-100', 'text-purple-800', 'border-purple-200')
    })

    it('should show emerald color for low complexity', () => {
      const lowComplexityEpic = { ...mockEpic, complexity: 'low' }
      render(<EpicCard epic={lowComplexityEpic} epicIndex={0} />)

      const badge = screen.getByTestId('complexity-low')
      expect(badge).toHaveClass('bg-emerald-100', 'text-emerald-800', 'border-emerald-200')
    })
  })

  describe('user stories', () => {
    it('should render user stories when present', () => {
      render(<EpicCard epic={mockEpic} epicIndex={0} />)

      expect(screen.getByText('User Stories:')).toBeInTheDocument()
      expect(screen.getByTestId('user-story-0')).toHaveTextContent('As a user, I want to create an account')
      expect(screen.getByTestId('user-story-1')).toHaveTextContent('As a user, I want to log in securely')
    })

    it('should not render user stories section when empty', () => {
      render(<EpicCard epic={minimalEpic} epicIndex={0} />)

      expect(screen.queryByText('User Stories:')).not.toBeInTheDocument()
    })
  })

  describe('deliverables', () => {
    it('should render deliverables when present', () => {
      render(<EpicCard epic={mockEpic} epicIndex={0} />)

      expect(screen.getByText('Deliverables:')).toBeInTheDocument()
      expect(screen.getByTestId('deliverable-0')).toHaveTextContent('User registration API')
      expect(screen.getByTestId('deliverable-1')).toHaveTextContent('Login/logout functionality')
      expect(screen.getByTestId('deliverable-2')).toHaveTextContent('JWT token management')
    })

    it('should not render deliverables section when empty', () => {
      render(<EpicCard epic={minimalEpic} epicIndex={0} />)

      expect(screen.queryByText('Deliverables:')).not.toBeInTheDocument()
    })
  })

  describe('related ideas', () => {
    it('should render related ideas when present', () => {
      render(<EpicCard epic={mockEpic} epicIndex={0} />)

      expect(screen.getByText('Related Ideas:')).toBeInTheDocument()
      expect(screen.getByTestId('related-idea-0')).toHaveTextContent('User Management')
      expect(screen.getByTestId('related-idea-1')).toHaveTextContent('Security Framework')
    })

    it('should not render related ideas section when empty', () => {
      render(<EpicCard epic={minimalEpic} epicIndex={0} />)

      expect(screen.queryByText('Related Ideas:')).not.toBeInTheDocument()
    })
  })

  describe('timeline information', () => {
    it('should render timeline info when available', () => {
      render(<EpicCard epic={mockEpic} epicIndex={0} />)

      expect(screen.getByTestId('epic-start-month')).toHaveTextContent('Start: Month 1')
      expect(screen.getByTestId('epic-duration')).toHaveTextContent('Duration: 2 months')
      expect(screen.getByTestId('epic-team')).toHaveTextContent('Team: Backend Team')
      expect(screen.getByTestId('epic-status-in-progress')).toHaveTextContent('In-progress')
    })

    it('should not render timeline section when no timeline data', () => {
      render(<EpicCard epic={minimalEpic} epicIndex={0} />)

      expect(screen.queryByTestId('epic-start-month')).not.toBeInTheDocument()
      expect(screen.queryByTestId('epic-duration')).not.toBeInTheDocument()
      expect(screen.queryByTestId('epic-team')).not.toBeInTheDocument()
    })

    it('should show correct status styling', () => {
      const completedEpic = { ...mockEpic, status: 'completed' as const }
      render(<EpicCard epic={completedEpic} epicIndex={0} />)

      const statusBadge = screen.getByTestId('epic-status-completed')
      expect(statusBadge).toHaveClass('bg-green-100', 'text-green-700')
      expect(statusBadge).toHaveTextContent('Completed')
    })

    it('should show planned status styling', () => {
      const plannedEpic = { ...mockEpic, status: 'planned' as const }
      render(<EpicCard epic={plannedEpic} epicIndex={0} />)

      const statusBadge = screen.getByTestId('epic-status-planned')
      expect(statusBadge).toHaveClass('bg-gray-100', 'text-gray-700')
      expect(statusBadge).toHaveTextContent('Planned')
    })
  })

  describe('accessibility', () => {
    it('should have proper semantic structure', () => {
      render(<EpicCard epic={mockEpic} epicIndex={0} />)

      // Should have a heading for the epic title
      expect(screen.getByRole('heading', { level: 4 })).toHaveTextContent('User Authentication System')
    })

    it('should have proper list structure for user stories and deliverables', () => {
      render(<EpicCard epic={mockEpic} epicIndex={0} />)

      const lists = screen.getAllByRole('list')
      expect(lists).toHaveLength(2) // User stories and deliverables
    })
  })

  describe('edge cases', () => {
    it('should handle epic with only title and description', () => {
      const basicEpic: Epic = {
        title: 'Basic Epic',
        description: 'Basic description',
        userStories: [],
        deliverables: [],
        priority: '',
        complexity: '',
        relatedIdeas: []
      }

      render(<EpicCard epic={basicEpic} epicIndex={0} />)

      expect(screen.getByText('Basic Epic')).toBeInTheDocument()
      expect(screen.getByText('Basic description')).toBeInTheDocument()
      expect(screen.getByTestId('priority-unknown')).toHaveTextContent('Unknown')
    })

    it('should handle different epic index correctly', () => {
      render(<EpicCard epic={mockEpic} epicIndex={5} />)

      expect(screen.getByTestId('epic-card-5')).toBeInTheDocument()
    })
  })
})