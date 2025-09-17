import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RoadmapHeader from '../RoadmapHeader'
import { Project, ProjectRoadmap as ProjectRoadmapType } from '../../../types'
import { RoadmapData } from '../types'

const mockProject: Project = {
  id: 'test-project-id',
  name: 'Test Project',
  description: 'A test project',
  project_type: 'Software',
  status: 'active',
  owner_id: 'test-user-id',
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z'
}

const mockRoadmapData: RoadmapData = {
  roadmapAnalysis: {
    totalDuration: '12 weeks',
    phases: [
      {
        phase: 'Phase 1',
        duration: '4 weeks',
        description: 'Initial phase',
        epics: [],
        risks: [],
        successCriteria: []
      }
    ]
  },
  executionStrategy: {
    methodology: 'Agile',
    sprintLength: '2 weeks',
    teamRecommendations: 'Cross-functional team',
    keyMilestones: []
  }
}

const mockRoadmapHistory: ProjectRoadmapType[] = [
  {
    id: 'roadmap-1',
    project_id: 'test-project-id',
    name: 'Test Roadmap',
    roadmap_data: mockRoadmapData,
    created_by: 'test-user-id',
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z'
  }
]

const defaultProps = {
  currentProject: mockProject,
  roadmapData: mockRoadmapData,
  isLoading: false,
  viewMode: 'timeline' as const,
  showHistory: false,
  roadmapHistory: mockRoadmapHistory,
  onGenerateRoadmap: vi.fn(),
  onToggleViewMode: vi.fn(),
  onToggleHistory: vi.fn(),
  onExportClick: vi.fn()
}

describe('RoadmapHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('when no project is selected', () => {
    it('should show no project selected message', () => {
      render(<RoadmapHeader {...defaultProps} currentProject={null} />)

      expect(screen.getByText('No Project Selected')).toBeInTheDocument()
      expect(screen.getByText('Select a project to view or generate its roadmap')).toBeInTheDocument()
    })

    it('should not show any action buttons', () => {
      render(<RoadmapHeader {...defaultProps} currentProject={null} />)

      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })
  })

  describe('when project is selected', () => {
    it('should display project name and type', () => {
      render(<RoadmapHeader {...defaultProps} />)

      expect(screen.getByText('Test Project Roadmap')).toBeInTheDocument()
      expect(screen.getByText(/Strategic execution plan for your software project/i)).toBeInTheDocument()
    })

    it('should show generate roadmap button when no roadmap exists', () => {
      render(<RoadmapHeader {...defaultProps} roadmapData={null} />)

      expect(screen.getByRole('button', { name: /generate roadmap/i })).toBeInTheDocument()
    })

    it('should show regenerate roadmap button when roadmap exists', () => {
      render(<RoadmapHeader {...defaultProps} />)

      expect(screen.getByRole('button', { name: /regenerate roadmap/i })).toBeInTheDocument()
    })

    it('should call onGenerateRoadmap when generate button is clicked', async () => {
      const user = userEvent.setup()
      render(<RoadmapHeader {...defaultProps} />)

      const generateButton = screen.getByRole('button', { name: /regenerate roadmap/i })
      await user.click(generateButton)

      expect(defaultProps.onGenerateRoadmap).toHaveBeenCalledTimes(1)
    })

    it('should disable generate button when loading', () => {
      render(<RoadmapHeader {...defaultProps} isLoading={true} />)

      const generateButton = screen.getByRole('button', { name: /generating/i })
      expect(generateButton).toBeDisabled()
    })
  })

  describe('when roadmap data exists', () => {
    it('should show view mode toggle buttons', () => {
      render(<RoadmapHeader {...defaultProps} />)

      expect(screen.getByRole('button', { name: /timeline view/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /detailed view/i })).toBeInTheDocument()
    })

    it('should highlight active view mode', () => {
      render(<RoadmapHeader {...defaultProps} viewMode="detailed" />)

      const detailedButton = screen.getByRole('button', { name: /detailed view/i })
      expect(detailedButton).toHaveClass('bg-purple-100', 'text-purple-700')
    })

    it('should call onToggleViewMode when view mode button is clicked', async () => {
      const user = userEvent.setup()
      render(<RoadmapHeader {...defaultProps} />)

      const detailedButton = screen.getByRole('button', { name: /detailed view/i })
      await user.click(detailedButton)

      expect(defaultProps.onToggleViewMode).toHaveBeenCalledWith('detailed')
    })

    it('should show total duration', () => {
      render(<RoadmapHeader {...defaultProps} />)

      expect(screen.getByText('Total Duration:')).toBeInTheDocument()
      expect(screen.getByText('12 weeks')).toBeInTheDocument()
    })

    it('should show export button', () => {
      render(<RoadmapHeader {...defaultProps} />)

      expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument()
    })

    it('should call onExportClick when export button is clicked', async () => {
      const user = userEvent.setup()
      render(<RoadmapHeader {...defaultProps} />)

      const exportButton = screen.getByRole('button', { name: /export/i })
      await user.click(exportButton)

      expect(defaultProps.onExportClick).toHaveBeenCalledTimes(1)
    })
  })

  describe('roadmap history', () => {
    it('should show history button when history exists', () => {
      render(<RoadmapHeader {...defaultProps} />)

      expect(screen.getByRole('button', { name: /history \(1\)/i })).toBeInTheDocument()
    })

    it('should not show history button when no history exists', () => {
      render(<RoadmapHeader {...defaultProps} roadmapHistory={[]} />)

      expect(screen.queryByRole('button', { name: /history/i })).not.toBeInTheDocument()
    })

    it('should highlight history button when history is shown', () => {
      render(<RoadmapHeader {...defaultProps} showHistory={true} />)

      const historyButton = screen.getByRole('button', { name: /history \(1\)/i })
      expect(historyButton).toHaveClass('bg-blue-100', 'text-blue-700')
    })

    it('should call onToggleHistory when history button is clicked', async () => {
      const user = userEvent.setup()
      render(<RoadmapHeader {...defaultProps} />)

      const historyButton = screen.getByRole('button', { name: /history \(1\)/i })
      await user.click(historyButton)

      expect(defaultProps.onToggleHistory).toHaveBeenCalledTimes(1)
    })
  })

  describe('accessibility', () => {
    it('should have proper button titles', () => {
      render(<RoadmapHeader {...defaultProps} />)

      expect(screen.getByTitle('Export roadmap')).toBeInTheDocument()
      expect(screen.getByTitle('View roadmap history')).toBeInTheDocument()
    })

    it('should have proper heading structure', () => {
      render(<RoadmapHeader {...defaultProps} />)

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Test Project Roadmap')
    })
  })

  describe('loading state', () => {
    it('should show loading spinner when generating roadmap', () => {
      render(<RoadmapHeader {...defaultProps} isLoading={true} />)

      expect(screen.getByText('Generating...')).toBeInTheDocument()
      // Check for loading spinner (Loader icon should be present)
      expect(document.querySelector('.animate-spin')).toBeInTheDocument()
    })
  })
})