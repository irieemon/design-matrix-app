import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import MilestoneTimeline from '../MilestoneTimeline'
import { Milestone } from '../types'

const mockMilestones: Milestone[] = [
  {
    milestone: 'MVP Launch',
    timeline: 'Month 3',
    description: 'Launch the minimum viable product with core features'
  },
  {
    milestone: 'Beta Release',
    timeline: 'Month 5',
    description: 'Release beta version for testing and feedback'
  },
  {
    milestone: 'Production Launch',
    timeline: 'Month 8',
    description: 'Full production release with all planned features'
  },
  {
    milestone: 'Performance Optimization',
    timeline: 'Month 10',
    description: 'Optimize performance and scalability'
  }
]

const emptyMilestones: Milestone[] = []

const customTeamRecommendations = 'Agile development team with dedicated DevOps engineer and UX designer.'

const defaultProps = {
  milestones: mockMilestones,
  teamRecommendations: undefined
}

describe('MilestoneTimeline', () => {
  describe('basic rendering', () => {
    it('should render the execution strategy header', () => {
      render(<MilestoneTimeline {...defaultProps} />)

      expect(screen.getByText('Execution Strategy')).toBeInTheDocument()
    })

    it('should render team recommendations section', () => {
      render(<MilestoneTimeline {...defaultProps} />)

      expect(screen.getByText('Team Recommendations')).toBeInTheDocument()
    })

    it('should render key milestones section', () => {
      render(<MilestoneTimeline {...defaultProps} />)

      expect(screen.getByTestId('milestones-title')).toHaveTextContent('Key Milestones')
    })

    it('should have proper section layout with grid', () => {
      render(<MilestoneTimeline {...defaultProps} />)

      const gridContainer = screen.getByTestId('team-recommendations').closest('.grid')
      expect(gridContainer).toHaveClass('grid-cols-1', 'md:grid-cols-2', 'gap-6')
    })
  })

  describe('team recommendations', () => {
    it('should display default team recommendations when none provided', () => {
      render(<MilestoneTimeline {...defaultProps} />)

      expect(screen.getByTestId('team-recommendations')).toHaveTextContent(
        'Cross-functional team structure recommended for optimal collaboration.'
      )
    })

    it('should display custom team recommendations when provided', () => {
      render(<MilestoneTimeline {...defaultProps} teamRecommendations={customTeamRecommendations} />)

      expect(screen.getByTestId('team-recommendations')).toHaveTextContent(customTeamRecommendations)
    })

    it('should have proper styling for team recommendations', () => {
      render(<MilestoneTimeline {...defaultProps} />)

      const recommendations = screen.getByTestId('team-recommendations')
      expect(recommendations).toHaveClass('text-slate-700', 'text-sm', 'leading-relaxed')
    })
  })

  describe('milestones rendering', () => {
    it('should render all milestones', () => {
      render(<MilestoneTimeline {...defaultProps} />)

      expect(screen.getByTestId('milestone-0')).toBeInTheDocument()
      expect(screen.getByTestId('milestone-1')).toBeInTheDocument()
      expect(screen.getByTestId('milestone-2')).toBeInTheDocument()
      expect(screen.getByTestId('milestone-3')).toBeInTheDocument()
    })

    it('should display milestone titles correctly', () => {
      render(<MilestoneTimeline {...defaultProps} />)

      expect(screen.getByTestId('milestone-title-0')).toHaveTextContent('MVP Launch')
      expect(screen.getByTestId('milestone-title-1')).toHaveTextContent('Beta Release')
      expect(screen.getByTestId('milestone-title-2')).toHaveTextContent('Production Launch')
      expect(screen.getByTestId('milestone-title-3')).toHaveTextContent('Performance Optimization')
    })

    it('should display milestone timelines correctly', () => {
      render(<MilestoneTimeline {...defaultProps} />)

      expect(screen.getByTestId('milestone-timeline-0')).toHaveTextContent('Month 3')
      expect(screen.getByTestId('milestone-timeline-1')).toHaveTextContent('Month 5')
      expect(screen.getByTestId('milestone-timeline-2')).toHaveTextContent('Month 8')
      expect(screen.getByTestId('milestone-timeline-3')).toHaveTextContent('Month 10')
    })

    it('should display milestone descriptions correctly', () => {
      render(<MilestoneTimeline {...defaultProps} />)

      expect(screen.getByTestId('milestone-description-0')).toHaveTextContent(
        'Launch the minimum viable product with core features'
      )
      expect(screen.getByTestId('milestone-description-1')).toHaveTextContent(
        'Release beta version for testing and feedback'
      )
      expect(screen.getByTestId('milestone-description-2')).toHaveTextContent(
        'Full production release with all planned features'
      )
      expect(screen.getByTestId('milestone-description-3')).toHaveTextContent(
        'Optimize performance and scalability'
      )
    })

    it('should display milestone numbers correctly', () => {
      render(<MilestoneTimeline {...defaultProps} />)

      expect(screen.getByTestId('milestone-number-0')).toHaveTextContent('1')
      expect(screen.getByTestId('milestone-number-1')).toHaveTextContent('2')
      expect(screen.getByTestId('milestone-number-2')).toHaveTextContent('3')
      expect(screen.getByTestId('milestone-number-3')).toHaveTextContent('4')
    })
  })

  describe('milestone styling', () => {
    it('should have proper styling for milestone numbers', () => {
      render(<MilestoneTimeline {...defaultProps} />)

      const milestoneNumber = screen.getByTestId('milestone-number-0')
      expect(milestoneNumber).toHaveClass('text-purple-600', 'text-xs', 'font-bold')

      const numberContainer = milestoneNumber.closest('div')
      expect(numberContainer).toHaveClass(
        'flex-shrink-0', 'w-8', 'h-8', 'bg-purple-100', 'rounded-full',
        'flex', 'items-center', 'justify-center'
      )
    })

    it('should have proper styling for milestone timelines', () => {
      render(<MilestoneTimeline {...defaultProps} />)

      const timeline = screen.getByTestId('milestone-timeline-0')
      expect(timeline).toHaveClass(
        'text-purple-600', 'text-xs', 'bg-purple-100', 'px-2', 'py-1', 'rounded'
      )
    })

    it('should have proper styling for milestone titles', () => {
      render(<MilestoneTimeline {...defaultProps} />)

      const title = screen.getByTestId('milestone-title-0')
      expect(title).toHaveClass('font-medium', 'text-slate-900', 'text-sm')
    })

    it('should have proper styling for milestone descriptions', () => {
      render(<MilestoneTimeline {...defaultProps} />)

      const description = screen.getByTestId('milestone-description-0')
      expect(description).toHaveClass('text-slate-600', 'text-xs', 'mt-1')
    })
  })

  describe('empty states', () => {
    it('should show "No key milestones defined" when no milestones provided', () => {
      render(<MilestoneTimeline milestones={emptyMilestones} />)

      expect(screen.getByTestId('no-milestones')).toHaveTextContent('No key milestones defined')
    })

    it('should have proper styling for empty state', () => {
      render(<MilestoneTimeline milestones={emptyMilestones} />)

      const emptyState = screen.getByTestId('no-milestones')
      expect(emptyState).toHaveClass(
        'text-slate-500', 'text-sm', 'italic', 'text-center', 'py-4'
      )
    })

    it('should not render milestone items when array is empty', () => {
      render(<MilestoneTimeline milestones={emptyMilestones} />)

      expect(screen.queryByTestId('milestone-0')).not.toBeInTheDocument()
    })

    it('should still show team recommendations when milestones are empty', () => {
      render(<MilestoneTimeline milestones={emptyMilestones} teamRecommendations={customTeamRecommendations} />)

      expect(screen.getByTestId('team-recommendations')).toHaveTextContent(customTeamRecommendations)
    })
  })

  describe('accessibility', () => {
    it('should have proper heading structure', () => {
      render(<MilestoneTimeline {...defaultProps} />)

      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Execution Strategy')

      const h3Headings = screen.getAllByRole('heading', { level: 3 })
      expect(h3Headings).toHaveLength(2)
      expect(h3Headings[0]).toHaveTextContent('Team Recommendations')
      expect(h3Headings[1]).toHaveTextContent('Key Milestones')
    })

    it('should have proper heading structure for milestone titles', () => {
      render(<MilestoneTimeline {...defaultProps} />)

      const h4Headings = screen.getAllByRole('heading', { level: 4 })
      expect(h4Headings).toHaveLength(4)
      expect(h4Headings[0]).toHaveTextContent('MVP Launch')
    })

    it('should have semantic list structure', () => {
      render(<MilestoneTimeline {...defaultProps} />)

      const milestonesList = screen.getByTestId('milestones-list')
      expect(milestonesList).toBeInTheDocument()
    })
  })

  describe('single milestone', () => {
    it('should handle single milestone correctly', () => {
      const singleMilestone: Milestone[] = [
        {
          milestone: 'Single Goal',
          timeline: 'Month 1',
          description: 'Complete the only goal'
        }
      ]

      render(<MilestoneTimeline milestones={singleMilestone} />)

      expect(screen.getByTestId('milestone-0')).toBeInTheDocument()
      expect(screen.getByTestId('milestone-number-0')).toHaveTextContent('1')
      expect(screen.getByTestId('milestone-title-0')).toHaveTextContent('Single Goal')
      expect(screen.queryByTestId('milestone-1')).not.toBeInTheDocument()
    })
  })

  describe('props handling', () => {
    it('should handle undefined milestones prop gracefully', () => {
      render(<MilestoneTimeline milestones={undefined as any} />)

      expect(screen.getByTestId('no-milestones')).toHaveTextContent('No key milestones defined')
    })

    it('should handle missing timeline or description gracefully', () => {
      const incompleteMilestone: Milestone[] = [
        {
          milestone: 'Incomplete Milestone',
          timeline: '',
          description: ''
        }
      ]

      render(<MilestoneTimeline milestones={incompleteMilestone} />)

      expect(screen.getByTestId('milestone-title-0')).toHaveTextContent('Incomplete Milestone')
      expect(screen.getByTestId('milestone-timeline-0')).toHaveTextContent('')
      expect(screen.getByTestId('milestone-description-0')).toHaveTextContent('')
    })
  })

  describe('component structure', () => {
    it('should have proper container structure', () => {
      render(<MilestoneTimeline {...defaultProps} />)

      const container = screen.getByText('Execution Strategy').closest('.bg-white')
      expect(container).toHaveClass(
        'bg-white', 'rounded-2xl', 'border', 'border-slate-200/60', 'shadow-sm', 'overflow-hidden'
      )
    })

    it('should have proper header styling', () => {
      render(<MilestoneTimeline {...defaultProps} />)

      const header = screen.getByText('Execution Strategy').closest('.bg-gradient-to-r')
      expect(header).toHaveClass(
        'bg-gradient-to-r', 'from-purple-50', 'to-blue-50', 'px-6', 'py-4', 'border-b', 'border-slate-200'
      )
    })
  })
})