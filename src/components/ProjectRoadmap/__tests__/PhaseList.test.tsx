import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PhaseList from '../PhaseList'
import { Phase } from '../types'

const mockPhases: Phase[] = [
  {
    phase: 'Phase 1: Foundation',
    duration: '4 weeks',
    description: 'Setting up the basic infrastructure and core components',
    epics: [
      {
        title: 'Authentication System',
        description: 'Implement user authentication and authorization',
        userStories: [
          'As a user, I want to create an account',
          'As a user, I want to log in securely'
        ],
        deliverables: [
          'User registration API',
          'Login/logout functionality'
        ],
        priority: 'high',
        complexity: 'medium',
        relatedIdeas: ['Security Framework', 'User Management'],
        startMonth: 1,
        duration: 2,
        status: 'in-progress',
        team: 'Backend Team'
      },
      {
        title: 'Database Setup',
        description: 'Configure database schema and connections',
        userStories: [
          'As a developer, I want a reliable database connection'
        ],
        deliverables: [
          'Database schema',
          'Connection pooling'
        ],
        priority: 'high',
        complexity: 'low',
        relatedIdeas: ['Data Architecture']
      }
    ],
    risks: [
      'Database migration complexity',
      'Authentication security vulnerabilities'
    ],
    successCriteria: [
      'All users can register and log in',
      'Database performance meets requirements'
    ]
  },
  {
    phase: 'Phase 2: Core Features',
    duration: '6 weeks',
    description: 'Implementing the main application features',
    epics: [
      {
        title: 'Project Management',
        description: 'Core project management functionality',
        userStories: [
          'As a user, I want to create projects',
          'As a user, I want to manage project tasks'
        ],
        deliverables: [
          'Project creation interface',
          'Task management system'
        ],
        priority: 'medium',
        complexity: 'high',
        relatedIdeas: ['Workflow Management']
      }
    ],
    risks: [
      'Feature scope creep',
      'Performance bottlenecks'
    ],
    successCriteria: [
      'Users can create and manage projects',
      'System handles 100+ concurrent users'
    ]
  },
  {
    phase: 'Phase 3: Polish',
    duration: '2 weeks',
    description: 'Final testing and deployment preparation',
    epics: [],
    risks: [],
    successCriteria: []
  }
]

const emptyPhases: Phase[] = []

const defaultProps = {
  phases: mockPhases,
  expandedPhases: new Set<number>(),
  onTogglePhaseExpansion: vi.fn()
}

describe('PhaseList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('basic rendering', () => {
    it('should render all phases', () => {
      render(<PhaseList {...defaultProps} />)

      expect(screen.getByText('Phase 1: Foundation')).toBeInTheDocument()
      expect(screen.getByText('Phase 2: Core Features')).toBeInTheDocument()
      expect(screen.getByText('Phase 3: Polish')).toBeInTheDocument()
    })

    it('should display phase numbers correctly', () => {
      render(<PhaseList {...defaultProps} />)

      expect(screen.getByText('1')).toBeInTheDocument()
      expect(screen.getByText('2')).toBeInTheDocument()
      expect(screen.getByText('3')).toBeInTheDocument()
    })

    it('should display phase durations', () => {
      render(<PhaseList {...defaultProps} />)

      expect(screen.getByTestId('phase-duration-0')).toHaveTextContent('4 weeks')
      expect(screen.getByTestId('phase-duration-1')).toHaveTextContent('6 weeks')
      expect(screen.getByTestId('phase-duration-2')).toHaveTextContent('2 weeks')
    })

    it('should display phase descriptions', () => {
      render(<PhaseList {...defaultProps} />)

      expect(screen.getByText('Setting up the basic infrastructure and core components')).toBeInTheDocument()
      expect(screen.getByText('Implementing the main application features')).toBeInTheDocument()
      expect(screen.getByText('Final testing and deployment preparation')).toBeInTheDocument()
    })

    it('should render timeline lines between phases', () => {
      render(<PhaseList {...defaultProps} />)

      const phaseElements = screen.getAllByTestId(/^phase-\d+$/)
      expect(phaseElements).toHaveLength(3)

      // Check that timeline lines exist (they have the specific classes)
      const timelineLines = document.querySelectorAll('.absolute.left-6.top-16.bottom-0.w-0\\.5.bg-slate-200')
      expect(timelineLines).toHaveLength(2) // Should be phases.length - 1
    })
  })

  describe('phase expansion', () => {
    it('should show expand text when phase is collapsed', () => {
      render(<PhaseList {...defaultProps} />)

      expect(screen.getAllByText('Click to expand details')).toHaveLength(3)
    })

    it('should show collapse text when phase is expanded', () => {
      render(<PhaseList {...defaultProps} expandedPhases={new Set([0])} />)

      expect(screen.getByText('Click to collapse details')).toBeInTheDocument()
      expect(screen.getAllByText('Click to expand details')).toHaveLength(2)
    })

    it('should call onTogglePhaseExpansion when phase header is clicked', async () => {
      const user = userEvent.setup()
      render(<PhaseList {...defaultProps} />)

      const phaseHeader = screen.getByTestId('phase-header-0')
      await user.click(phaseHeader)

      expect(defaultProps.onTogglePhaseExpansion).toHaveBeenCalledWith(0)
    })

    it('should rotate arrow icon when phase is expanded', () => {
      render(<PhaseList {...defaultProps} expandedPhases={new Set([0])} />)

      const arrow = screen.getByTestId('phase-arrow-0')
      expect(arrow).toHaveClass('rotate-90')
    })

    it('should not rotate arrow icon when phase is collapsed', () => {
      render(<PhaseList {...defaultProps} />)

      const arrow = screen.getByTestId('phase-arrow-0')
      expect(arrow).not.toHaveClass('rotate-90')
    })
  })

  describe('expanded phase content', () => {
    it('should show phase content when expanded', () => {
      render(<PhaseList {...defaultProps} expandedPhases={new Set([0])} />)

      expect(screen.getByTestId('phase-content-0')).toBeInTheDocument()
    })

    it('should hide phase content when collapsed', () => {
      render(<PhaseList {...defaultProps} />)

      expect(screen.queryByTestId('phase-content-0')).not.toBeInTheDocument()
    })

    it('should display epic count correctly', () => {
      render(<PhaseList {...defaultProps} expandedPhases={new Set([0, 1])} />)

      expect(screen.getByTestId('epics-count-0')).toHaveTextContent('Epics (2)')
      expect(screen.getByTestId('epics-count-1')).toHaveTextContent('Epics (1)')
    })

    it('should render epic cards for each epic', () => {
      render(<PhaseList {...defaultProps} expandedPhases={new Set([0])} />)

      expect(screen.getByText('Authentication System')).toBeInTheDocument()
      expect(screen.getByText('Database Setup')).toBeInTheDocument()
    })
  })

  describe('risks section', () => {
    it('should display risks when expanded', () => {
      render(<PhaseList {...defaultProps} expandedPhases={new Set([0])} />)

      expect(screen.getByText('Risks')).toBeInTheDocument()
      expect(screen.getByTestId('risk-0-0')).toHaveTextContent('Database migration complexity')
      expect(screen.getByTestId('risk-0-1')).toHaveTextContent('Authentication security vulnerabilities')
    })

    it('should show "No risks identified" when no risks exist', () => {
      render(<PhaseList {...defaultProps} expandedPhases={new Set([2])} />)

      expect(screen.getByText('No risks identified')).toBeInTheDocument()
    })

    it('should have proper styling for risks section', () => {
      render(<PhaseList {...defaultProps} expandedPhases={new Set([0])} />)

      const risksSection = screen.getByTestId('risks-0').closest('div')
      expect(risksSection).toHaveClass('bg-red-50', 'border-red-200')
    })
  })

  describe('success criteria section', () => {
    it('should display success criteria when expanded', () => {
      render(<PhaseList {...defaultProps} expandedPhases={new Set([0])} />)

      expect(screen.getByText('Success Criteria')).toBeInTheDocument()
      expect(screen.getByTestId('criteria-0-0')).toHaveTextContent('All users can register and log in')
      expect(screen.getByTestId('criteria-0-1')).toHaveTextContent('Database performance meets requirements')
    })

    it('should show "No success criteria defined" when no criteria exist', () => {
      render(<PhaseList {...defaultProps} expandedPhases={new Set([2])} />)

      expect(screen.getByText('No success criteria defined')).toBeInTheDocument()
    })

    it('should have proper styling for success criteria section', () => {
      render(<PhaseList {...defaultProps} expandedPhases={new Set([0])} />)

      const criteriaSection = screen.getByTestId('success-criteria-0').closest('div')
      expect(criteriaSection).toHaveClass('bg-green-50', 'border-green-200')
    })
  })

  describe('empty states', () => {
    it('should handle empty phases array', () => {
      render(<PhaseList {...defaultProps} phases={emptyPhases} />)

      expect(screen.queryByTestId(/^phase-\d+$/)).not.toBeInTheDocument()
    })

    it('should handle phase with no epics', () => {
      render(<PhaseList {...defaultProps} expandedPhases={new Set([2])} />)

      expect(screen.getByTestId('epics-count-2')).toHaveTextContent('Epics (0)')
    })

    it('should handle undefined epic arrays gracefully', () => {
      const phaseWithUndefinedEpics: Phase[] = [
        {
          phase: 'Test Phase',
          duration: '1 week',
          description: 'Test description',
          epics: undefined as any,
          risks: [],
          successCriteria: []
        }
      ]

      render(<PhaseList {...defaultProps} phases={phaseWithUndefinedEpics} expandedPhases={new Set([0])} />)

      expect(screen.getByTestId('epics-count-0')).toHaveTextContent('Epics (0)')
    })
  })

  describe('accessibility', () => {
    it('should have proper heading structure', () => {
      render(<PhaseList {...defaultProps} expandedPhases={new Set([0])} />)

      const h3Headings = screen.getAllByRole('heading', { level: 3 })
      expect(h3Headings).toHaveLength(3)
      expect(h3Headings[0]).toHaveTextContent('Phase 1: Foundation')

      const h4Headings = screen.getAllByRole('heading', { level: 4 })
      expect(h4Headings.length).toBeGreaterThan(0)
      expect(h4Headings[0]).toHaveTextContent('Epics (2)')
    })

    it('should have clickable phase headers', () => {
      render(<PhaseList {...defaultProps} />)

      const phaseHeader = screen.getByTestId('phase-header-0')
      expect(phaseHeader).toHaveClass('cursor-pointer')
    })

    it('should provide visual feedback on hover', () => {
      render(<PhaseList {...defaultProps} />)

      const phaseHeader = screen.getByTestId('phase-header-0')
      expect(phaseHeader).toHaveClass('hover:bg-slate-50')
    })
  })

  describe('multiple phase expansion', () => {
    it('should handle multiple expanded phases', () => {
      render(<PhaseList {...defaultProps} expandedPhases={new Set([0, 1])} />)

      expect(screen.getByTestId('phase-content-0')).toBeInTheDocument()
      expect(screen.getByTestId('phase-content-1')).toBeInTheDocument()
      expect(screen.queryByTestId('phase-content-2')).not.toBeInTheDocument()
    })

    it('should show correct epic counts for all expanded phases', () => {
      render(<PhaseList {...defaultProps} expandedPhases={new Set([0, 1, 2])} />)

      expect(screen.getByTestId('epics-count-0')).toHaveTextContent('Epics (2)')
      expect(screen.getByTestId('epics-count-1')).toHaveTextContent('Epics (1)')
      expect(screen.getByTestId('epics-count-2')).toHaveTextContent('Epics (0)')
    })
  })

  describe('data attributes', () => {
    it('should have correct data-testids for all phases', () => {
      render(<PhaseList {...defaultProps} />)

      expect(screen.getByTestId('phase-0')).toBeInTheDocument()
      expect(screen.getByTestId('phase-1')).toBeInTheDocument()
      expect(screen.getByTestId('phase-2')).toBeInTheDocument()
    })

    it('should have correct data-testids for phase headers', () => {
      render(<PhaseList {...defaultProps} />)

      expect(screen.getByTestId('phase-header-0')).toBeInTheDocument()
      expect(screen.getByTestId('phase-header-1')).toBeInTheDocument()
      expect(screen.getByTestId('phase-header-2')).toBeInTheDocument()
    })
  })
})