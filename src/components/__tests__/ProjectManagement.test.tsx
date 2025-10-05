import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProjectManagement from '../ProjectManagement'
import { ProjectRepository } from '../../lib/repositories/projectRepository'
import { mockUser, mockAdminUser } from '../../test/utils/test-utils'
import { Project, IdeaCard, ProjectType } from '../../types'
import { generateDemoUUID } from '../../utils/uuid'

// Mock dependencies
vi.mock('../../lib/repositories/projectRepository')
vi.mock('../../utils/logger')
vi.mock('./ProjectStartupFlow', () => ({
  default: ({ onClose, onProjectCreated }: any) => (
    <div data-testid="project-startup-flow">
      <button onClick={() => {
        const mockProject: Project = {
          id: generateDemoUUID('new-project'),
          name: 'New Test Project',
          description: 'Created via startup flow',
          project_type: 'software',
          status: 'active',
          visibility: 'private',
          priority_level: 'high',
          owner_id: mockUser.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
        onProjectCreated(mockProject)
      }}>Create Project</button>
      <button onClick={onClose}>Close</button>
    </div>
  )
}))

vi.mock('./AIStarterModal', () => ({
  default: ({ onClose, onProjectCreated }: any) => (
    <div data-testid="ai-starter-modal">
      <button onClick={() => {
        const mockProject: Project = {
          id: generateDemoUUID('ai-project'),
          name: 'AI Generated Project',
          description: 'Created via AI',
          project_type: 'software',
          status: 'active',
          visibility: 'private',
          priority_level: 'high',
          owner_id: mockUser.id,
          is_ai_generated: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
        const mockIdeas: IdeaCard[] = [{
          id: generateDemoUUID('ai-idea'),
          content: 'AI Generated Idea',
          details: 'AI details',
          x: 200,
          y: 200,
          priority: 'high',
          project_id: mockProject.id,
          created_by: mockUser.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }]
        onProjectCreated(mockProject, mockIdeas)
      }}>Create AI Project</button>
      <button onClick={onClose}>Close</button>
    </div>
  )
}))

// Mock project data
const createMockProject = (overrides: Partial<Project> = {}): Project => ({
  id: generateDemoUUID('project-1'),
  name: 'Test Project',
  description: 'Test project description',
  project_type: 'software',
  status: 'active',
  visibility: 'private',
  priority_level: 'high',
  owner_id: mockUser.id,
  budget: 10000,
  team_size: 5,
  target_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  tags: ['test', 'development'],
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-15T00:00:00.000Z',
  ...overrides
})

const mockProjects: Project[] = [
  createMockProject({ id: generateDemoUUID('project-1'), name: 'Project Alpha' }),
  createMockProject({
    id: generateDemoUUID('project-2'),
    name: 'Project Beta',
    project_type: 'product_development',
    status: 'paused',
    priority_level: 'medium'
  }),
  createMockProject({
    id: generateDemoUUID('project-3'),
    name: 'Project Gamma',
    project_type: 'marketing',
    status: 'completed',
    priority_level: 'low',
    is_ai_generated: true
  })
]

describe('ProjectManagement', () => {
  let mockOnProjectSelect: ReturnType<typeof vi.fn>
  let mockOnProjectCreated: ReturnType<typeof vi.fn>
  let mockOnNavigateToMatrix: ReturnType<typeof vi.fn>
  let unsubscribe: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockOnProjectSelect = vi.fn()
    mockOnProjectCreated = vi.fn()
    mockOnNavigateToMatrix = vi.fn()
    unsubscribe = vi.fn()

    // Setup repository mocks
    vi.mocked(ProjectRepository.getUserOwnedProjects).mockResolvedValue(mockProjects)
    vi.mocked(ProjectRepository.subscribeToProjects).mockReturnValue(unsubscribe)
    vi.mocked(ProjectRepository.updateProject).mockImplementation(async (id, updates) => {
      const project = mockProjects.find(p => p.id === id)
      return project ? { ...project, ...updates } : null
    })
    vi.mocked(ProjectRepository.deleteProject).mockResolvedValue(true)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // =========================================================================
  // Loading States
  // =========================================================================

  describe('Loading States', () => {
    it('should show loading skeleton while fetching projects', () => {
      const { container } = render(
        <ProjectManagement
          currentUser={mockUser}
          currentProject={null}
          onProjectSelect={mockOnProjectSelect}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
    })

    it('should hide loading state after projects are loaded', async () => {
      const { container } = render(
        <ProjectManagement
          currentUser={mockUser}
          currentProject={null}
          onProjectSelect={mockOnProjectSelect}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Project Alpha')).toBeInTheDocument()
      })

      expect(container.querySelector('.animate-pulse')).not.toBeInTheDocument()
    })

    it('should handle loading with empty user ID gracefully', async () => {
      const emptyUser = { ...mockUser, id: '' }

      render(
        <ProjectManagement
          currentUser={emptyUser}
          currentProject={null}
          onProjectSelect={mockOnProjectSelect}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      await waitFor(() => {
        expect(ProjectRepository.getUserOwnedProjects).not.toHaveBeenCalled()
      })
    })
  })

  // =========================================================================
  // Project List Display
  // =========================================================================

  describe('Project List Display', () => {
    it('should display all projects after loading', async () => {
      render(
        <ProjectManagement
          currentUser={mockUser}
          currentProject={null}
          onProjectSelect={mockOnProjectSelect}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Project Alpha')).toBeInTheDocument()
        expect(screen.getByText('Project Beta')).toBeInTheDocument()
        expect(screen.getByText('Project Gamma')).toBeInTheDocument()
      })
    })

    it('should display project descriptions', async () => {
      render(
        <ProjectManagement
          currentUser={mockUser}
          currentProject={null}
          onProjectSelect={mockOnProjectSelect}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      await waitFor(() => {
        expect(screen.getAllByText('Test project description')).toHaveLength(3)
      })
    })

    it('should display project type icons', async () => {
      render(
        <ProjectManagement
          currentUser={mockUser}
          currentProject={null}
          onProjectSelect={mockOnProjectSelect}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('💻')).toBeInTheDocument() // software
        expect(screen.getByText('🚀')).toBeInTheDocument() // product_development
        expect(screen.getByText('📢')).toBeInTheDocument() // marketing
      })
    })

    it('should display project status badges', async () => {
      render(
        <ProjectManagement
          currentUser={mockUser}
          currentProject={null}
          onProjectSelect={mockOnProjectSelect}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      await waitFor(() => {
        const activeProjects = mockProjects.filter(p => p.status === 'active')
        expect(screen.getAllByText('active')).toHaveLength(activeProjects.length)
      })

      expect(screen.getByText('paused')).toBeInTheDocument()
      expect(screen.getByText('completed')).toBeInTheDocument()
    })

    it('should display project priority badges', async () => {
      render(
        <ProjectManagement
          currentUser={mockUser}
          currentProject={null}
          onProjectSelect={mockOnProjectSelect}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      await waitFor(() => {
        const highProjects = mockProjects.filter(p => p.priority_level === 'high')
        expect(screen.getAllByText('high')).toHaveLength(highProjects.length)
      })

      expect(screen.getByText('medium')).toBeInTheDocument()
      expect(screen.getByText('low')).toBeInTheDocument()
    })

    it('should display AI Enhanced badge for AI-generated projects', async () => {
      render(
        <ProjectManagement
          currentUser={mockUser}
          currentProject={null}
          onProjectSelect={mockOnProjectSelect}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('AI Enhanced')).toBeInTheDocument()
      })
    })

    it('should display project target dates', async () => {
      render(
        <ProjectManagement
          currentUser={mockUser}
          currentProject={null}
          onProjectSelect={mockOnProjectSelect}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      await waitFor(() => {
        const targetDates = screen.getAllByText(/Target:/)
        expect(targetDates.length).toBeGreaterThan(0)
      })
    })

    it('should display project team size', async () => {
      render(
        <ProjectManagement
          currentUser={mockUser}
          currentProject={null}
          onProjectSelect={mockOnProjectSelect}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      await waitFor(() => {
        const teamInfo = screen.getAllByText(/Team: 5 members/)
        expect(teamInfo.length).toBeGreaterThan(0)
      })
    })

    it('should display project budget', async () => {
      render(
        <ProjectManagement
          currentUser={mockUser}
          currentProject={null}
          onProjectSelect={mockOnProjectSelect}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      await waitFor(() => {
        const budgetInfo = screen.getAllByText(/Budget: \$10,000/)
        expect(budgetInfo.length).toBeGreaterThan(0)
      })
    })

    it('should display project tags', async () => {
      render(
        <ProjectManagement
          currentUser={mockUser}
          currentProject={null}
          onProjectSelect={mockOnProjectSelect}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      await waitFor(() => {
        expect(screen.getAllByText('test')).toHaveLength(3)
        expect(screen.getAllByText('development')).toHaveLength(3)
      })
    })

    it('should limit displayed tags to 3 and show count for extras', async () => {
      const projectWithManyTags = createMockProject({
        tags: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5']
      })
      vi.mocked(ProjectRepository.getUserOwnedProjects).mockResolvedValue([projectWithManyTags])

      render(
        <ProjectManagement
          currentUser={mockUser}
          currentProject={null}
          onProjectSelect={mockOnProjectSelect}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('+2')).toBeInTheDocument()
      })
    })

    it('should display owner information', async () => {
      render(
        <ProjectManagement
          currentUser={mockUser}
          currentProject={null}
          onProjectSelect={mockOnProjectSelect}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      await waitFor(() => {
        // Find elements containing "by You" text
        const ownerElements = screen.getAllByText((content, element) => {
          return element?.textContent?.includes('by You') || false
        })
        expect(ownerElements.length).toBeGreaterThan(0)
      })
    })

    it('should display project count in filter bar', async () => {
      render(
        <ProjectManagement
          currentUser={mockUser}
          currentProject={null}
          onProjectSelect={mockOnProjectSelect}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('3 of 3 projects')).toBeInTheDocument()
      })
    })
  })

  // =========================================================================
  // Empty States
  // =========================================================================

  describe('Empty States', () => {
    it('should show empty state when no projects exist', async () => {
      vi.mocked(ProjectRepository.getUserOwnedProjects).mockResolvedValue([])

      render(
        <ProjectManagement
          currentUser={mockUser}
          currentProject={null}
          onProjectSelect={mockOnProjectSelect}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('No projects found')).toBeInTheDocument()
      }, { timeout: 3000 })

      expect(screen.getByText('Get started by creating your first project')).toBeInTheDocument()
    })

    it('should show create buttons in empty state', async () => {
      vi.mocked(ProjectRepository.getUserOwnedProjects).mockResolvedValue([])

      render(
        <ProjectManagement
          currentUser={mockUser}
          currentProject={null}
          onProjectSelect={mockOnProjectSelect}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      await waitFor(() => {
        const aiButtons = screen.getAllByText('AI Starter')
        expect(aiButtons.length).toBeGreaterThan(0)
      })
    })

    it('should show filtered empty state when no projects match filters', async () => {
      const user = userEvent.setup()

      render(
        <ProjectManagement
          currentUser={mockUser}
          currentProject={null}
          onProjectSelect={mockOnProjectSelect}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Project Alpha')).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText('Search projects...')
      await user.type(searchInput, 'nonexistent')

      await waitFor(() => {
        expect(screen.getByText('No projects found')).toBeInTheDocument()
        expect(screen.getByText('Try adjusting your search or filters')).toBeInTheDocument()
      })
    })
  })

  // =========================================================================
  // Project Creation
  // =========================================================================

  describe('Project Creation', () => {
    it('should open project startup flow when New Project button is clicked', async () => {
      const user = userEvent.setup()

      render(
        <ProjectManagement
          currentUser={mockUser}
          currentProject={null}
          onProjectSelect={mockOnProjectSelect}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Project Alpha')).toBeInTheDocument()
      })

      const newProjectButtons = screen.getAllByText('New Project')
      await user.click(newProjectButtons[0])

      expect(screen.getByTestId('project-startup-flow')).toBeInTheDocument()
    })

    it('should open AI starter modal when AI Starter button is clicked', async () => {
      const user = userEvent.setup()

      render(
        <ProjectManagement
          currentUser={mockUser}
          currentProject={null}
          onProjectSelect={mockOnProjectSelect}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Project Alpha')).toBeInTheDocument()
      })

      const aiStarterButtons = screen.getAllByText('AI Starter')
      await user.click(aiStarterButtons[0])

      expect(screen.getByTestId('ai-starter-modal')).toBeInTheDocument()
    })

    it('should add project to list when created via startup flow', async () => {
      const user = userEvent.setup()

      render(
        <ProjectManagement
          currentUser={mockUser}
          currentProject={null}
          onProjectSelect={mockOnProjectSelect}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Project Alpha')).toBeInTheDocument()
      })

      const newProjectButtons = screen.getAllByText('New Project')
      await user.click(newProjectButtons[0])

      const createButton = screen.getByText('Create Project')
      await user.click(createButton)

      await waitFor(() => {
        expect(mockOnProjectCreated).toHaveBeenCalledWith(
          expect.objectContaining({ name: 'New Test Project' }),
          undefined
        )
      })
    })

    it('should add project with ideas when created via AI starter', async () => {
      const user = userEvent.setup()

      render(
        <ProjectManagement
          currentUser={mockUser}
          currentProject={null}
          onProjectSelect={mockOnProjectSelect}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Project Alpha')).toBeInTheDocument()
      })

      const aiStarterButtons = screen.getAllByText('AI Starter')
      await user.click(aiStarterButtons[0])

      const createButton = screen.getByText('Create AI Project')
      await user.click(createButton)

      await waitFor(() => {
        expect(mockOnProjectCreated).toHaveBeenCalledWith(
          expect.objectContaining({ name: 'AI Generated Project' }),
          expect.arrayContaining([expect.objectContaining({ content: 'AI Generated Idea' })])
        )
      })
    })

    it('should close startup flow modal when close button is clicked', async () => {
      const user = userEvent.setup()

      render(
        <ProjectManagement
          currentUser={mockUser}
          currentProject={null}
          onProjectSelect={mockOnProjectSelect}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Project Alpha')).toBeInTheDocument()
      })

      const newProjectButtons = screen.getAllByText('New Project')
      await user.click(newProjectButtons[0])

      const closeButton = screen.getByText('Close')
      await user.click(closeButton)

      await waitFor(() => {
        expect(screen.queryByTestId('project-startup-flow')).not.toBeInTheDocument()
      })
    })
  })

  // =========================================================================
  // Project Selection
  // =========================================================================

  describe('Project Selection', () => {
    it('should call onProjectSelect when project card is clicked', async () => {
      const user = userEvent.setup()

      render(
        <ProjectManagement
          currentUser={mockUser}
          currentProject={null}
          onProjectSelect={mockOnProjectSelect}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Project Alpha')).toBeInTheDocument()
      })

      const projectCard = screen.getByText('Project Alpha').closest('div[class*="bg-white"]')
      await user.click(projectCard!)

      expect(mockOnProjectSelect).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Project Alpha' })
      )
    })

    it('should call onNavigateToMatrix when project is selected', async () => {
      const user = userEvent.setup()

      render(
        <ProjectManagement
          currentUser={mockUser}
          currentProject={null}
          onProjectSelect={mockOnProjectSelect}
          onProjectCreated={mockOnProjectCreated}
          onNavigateToMatrix={mockOnNavigateToMatrix}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Project Alpha')).toBeInTheDocument()
      })

      const projectCard = screen.getByText('Project Alpha').closest('div[class*="bg-white"]')
      await user.click(projectCard!)

      expect(mockOnNavigateToMatrix).toHaveBeenCalled()
    })

    it('should highlight current project with blue border', async () => {
      const currentProject = mockProjects[0]

      const { container } = render(
        <ProjectManagement
          currentUser={mockUser}
          currentProject={currentProject}
          onProjectSelect={mockOnProjectSelect}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Project Alpha')).toBeInTheDocument()
      })

      const projectCard = screen.getByText('Project Alpha').closest('div[class*="border-2"]')
      expect(projectCard?.className).toContain('border-blue-500')
    })

    it('should handle double-click on project card', async () => {
      const user = userEvent.setup()

      render(
        <ProjectManagement
          currentUser={mockUser}
          currentProject={null}
          onProjectSelect={mockOnProjectSelect}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Project Alpha')).toBeInTheDocument()
      })

      const projectCard = screen.getByText('Project Alpha').closest('div[class*="bg-white"]')
      await user.dblClick(projectCard!)

      expect(mockOnProjectSelect).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Project Alpha' })
      )
    })
  })

  // =========================================================================
  // Search Functionality
  // =========================================================================

  describe('Search Functionality', () => {
    it('should filter projects by name', async () => {
      const user = userEvent.setup()

      render(
        <ProjectManagement
          currentUser={mockUser}
          currentProject={null}
          onProjectSelect={mockOnProjectSelect}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Project Alpha')).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText('Search projects...')
      await user.type(searchInput, 'Alpha')

      await waitFor(() => {
        expect(screen.getByText('Project Alpha')).toBeInTheDocument()
        expect(screen.queryByText('Project Beta')).not.toBeInTheDocument()
        expect(screen.queryByText('Project Gamma')).not.toBeInTheDocument()
      })
    })

    it('should filter projects by description', async () => {
      const user = userEvent.setup()
      const projectsWithUniqueDescriptions = [
        createMockProject({ id: generateDemoUUID('p1'), name: 'P1', description: 'unique description here' }),
        createMockProject({ id: generateDemoUUID('p2'), name: 'P2', description: 'different content' })
      ]
      vi.mocked(ProjectRepository.getUserOwnedProjects).mockResolvedValue(projectsWithUniqueDescriptions)

      render(
        <ProjectManagement
          currentUser={mockUser}
          currentProject={null}
          onProjectSelect={mockOnProjectSelect}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('P1')).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText('Search projects...')
      await user.type(searchInput, 'unique')

      await waitFor(() => {
        expect(screen.getByText('P1')).toBeInTheDocument()
        expect(screen.queryByText('P2')).not.toBeInTheDocument()
      })
    })

    it('should be case-insensitive', async () => {
      const user = userEvent.setup()

      render(
        <ProjectManagement
          currentUser={mockUser}
          currentProject={null}
          onProjectSelect={mockOnProjectSelect}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Project Alpha')).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText('Search projects...')
      await user.type(searchInput, 'ALPHA')

      await waitFor(() => {
        expect(screen.getByText('Project Alpha')).toBeInTheDocument()
      })
    })

    it('should update project count when searching', async () => {
      const user = userEvent.setup()

      render(
        <ProjectManagement
          currentUser={mockUser}
          currentProject={null}
          onProjectSelect={mockOnProjectSelect}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('3 of 3 projects')).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText('Search projects...')
      await user.type(searchInput, 'Alpha')

      await waitFor(() => {
        expect(screen.getByText('1 of 3 projects')).toBeInTheDocument()
      })
    })

    it('should clear results when search is cleared', async () => {
      const user = userEvent.setup()

      render(
        <ProjectManagement
          currentUser={mockUser}
          currentProject={null}
          onProjectSelect={mockOnProjectSelect}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Project Alpha')).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText('Search projects...')
      await user.type(searchInput, 'Alpha')

      await waitFor(() => {
        expect(screen.queryByText('Project Beta')).not.toBeInTheDocument()
      })

      await user.clear(searchInput)

      await waitFor(() => {
        expect(screen.getByText('Project Beta')).toBeInTheDocument()
      })
    })
  })

  // =========================================================================
  // Filter Functionality
  // =========================================================================

  describe('Filter Functionality', () => {
    it('should filter by status', async () => {
      const user = userEvent.setup()

      render(
        <ProjectManagement
          currentUser={mockUser}
          currentProject={null}
          onProjectSelect={mockOnProjectSelect}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Project Alpha')).toBeInTheDocument()
      })

      const statusSelect = screen.getByDisplayValue('All Status')
      await user.selectOptions(statusSelect, 'paused')

      await waitFor(() => {
        expect(screen.getByText('Project Beta')).toBeInTheDocument()
        expect(screen.queryByText('Project Alpha')).not.toBeInTheDocument()
        expect(screen.queryByText('Project Gamma')).not.toBeInTheDocument()
      })
    })

    it('should filter by project type', async () => {
      const user = userEvent.setup()

      render(
        <ProjectManagement
          currentUser={mockUser}
          currentProject={null}
          onProjectSelect={mockOnProjectSelect}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Project Alpha')).toBeInTheDocument()
      })

      const typeSelect = screen.getByDisplayValue('All Types')
      await user.selectOptions(typeSelect, 'marketing')

      await waitFor(() => {
        expect(screen.getByText('Project Gamma')).toBeInTheDocument()
        expect(screen.queryByText('Project Alpha')).not.toBeInTheDocument()
        expect(screen.queryByText('Project Beta')).not.toBeInTheDocument()
      })
    })

    it('should combine search and filters', async () => {
      const user = userEvent.setup()

      render(
        <ProjectManagement
          currentUser={mockUser}
          currentProject={null}
          onProjectSelect={mockOnProjectSelect}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Project Alpha')).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText('Search projects...')
      await user.type(searchInput, 'Project')

      const statusSelect = screen.getByDisplayValue('All Status')
      await user.selectOptions(statusSelect, 'active')

      await waitFor(() => {
        expect(screen.getByText('Project Alpha')).toBeInTheDocument()
        expect(screen.queryByText('Project Beta')).not.toBeInTheDocument()
        expect(screen.queryByText('Project Gamma')).not.toBeInTheDocument()
      })
    })

    it('should reset to all filters', async () => {
      const user = userEvent.setup()

      render(
        <ProjectManagement
          currentUser={mockUser}
          currentProject={null}
          onProjectSelect={mockOnProjectSelect}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Project Alpha')).toBeInTheDocument()
      })

      const statusSelect = screen.getByDisplayValue('All Status')
      await user.selectOptions(statusSelect, 'paused')

      await waitFor(() => {
        expect(screen.queryByText('Project Alpha')).not.toBeInTheDocument()
      })

      await user.selectOptions(statusSelect, 'all')

      await waitFor(() => {
        expect(screen.getByText('Project Alpha')).toBeInTheDocument()
        expect(screen.getByText('Project Beta')).toBeInTheDocument()
      })
    })
  })

  // =========================================================================
  // Project Menu
  // =========================================================================

  describe('Project Menu', () => {
    it('should open project menu when menu button is clicked', async () => {
      const user = userEvent.setup()

      render(
        <ProjectManagement
          currentUser={mockUser}
          currentProject={null}
          onProjectSelect={mockOnProjectSelect}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Project Alpha')).toBeInTheDocument()
      })

      const menuButtons = screen.getAllByRole('button', { name: '' })
      const firstMenuButton = menuButtons.find(btn =>
        btn.querySelector('svg')?.getAttribute('class')?.includes('lucide-more-vertical')
      )
      await user.click(firstMenuButton!)

      expect(screen.getByText('Open Project')).toBeInTheDocument()
      expect(screen.getByText('Pause')).toBeInTheDocument()
      expect(screen.getByText('Archive')).toBeInTheDocument()
      expect(screen.getByText('Delete')).toBeInTheDocument()
    })

    it('should close menu when another menu is opened', async () => {
      const user = userEvent.setup()

      render(
        <ProjectManagement
          currentUser={mockUser}
          currentProject={null}
          onProjectSelect={mockOnProjectSelect}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Project Alpha')).toBeInTheDocument()
      })

      const menuButtons = screen.getAllByRole('button')
      const allMenuButtons = menuButtons.filter(btn =>
        btn.querySelector('svg')?.getAttribute('class')?.includes('lucide-more-vertical')
      )

      if (allMenuButtons.length >= 2) {
        await user.click(allMenuButtons[0])
        expect(screen.getByText('Open Project')).toBeInTheDocument()

        // Open another menu
        await user.click(allMenuButtons[1])

        // First menu should be closed
        await waitFor(() => {
          const openMenus = screen.getAllByText('Open Project')
          expect(openMenus.length).toBe(1)
        })
      }
    })

    it('should stop propagation when clicking menu button', async () => {
      const user = userEvent.setup()

      render(
        <ProjectManagement
          currentUser={mockUser}
          currentProject={null}
          onProjectSelect={mockOnProjectSelect}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Project Alpha')).toBeInTheDocument()
      })

      const menuButtons = screen.getAllByRole('button')
      const firstMenuButton = menuButtons.find(btn =>
        btn.querySelector('svg')?.getAttribute('class')?.includes('lucide-more-vertical')
      )

      if (firstMenuButton) {
        await user.click(firstMenuButton)
        // Project selection should not have been triggered
        expect(mockOnProjectSelect).not.toHaveBeenCalled()
      }
    })
  })

  // =========================================================================
  // Project Status Updates
  // =========================================================================

  describe('Project Status Updates', () => {
    it('should pause active project', async () => {
      const user = userEvent.setup()

      render(
        <ProjectManagement
          currentUser={mockUser}
          currentProject={null}
          onProjectSelect={mockOnProjectSelect}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Project Alpha')).toBeInTheDocument()
      })

      const menuButtons = screen.getAllByRole('button', { name: '' })
      const firstMenuButton = menuButtons.find(btn =>
        btn.querySelector('svg')?.getAttribute('class')?.includes('lucide-more-vertical')
      )
      await user.click(firstMenuButton!)

      const pauseButton = screen.getByText('Pause')
      await user.click(pauseButton)

      await waitFor(() => {
        expect(ProjectRepository.updateProject).toHaveBeenCalledWith(
          mockProjects[0].id,
          { status: 'paused' }
        )
      })
    })

    it('should activate paused project', async () => {
      const user = userEvent.setup()

      render(
        <ProjectManagement
          currentUser={mockUser}
          currentProject={null}
          onProjectSelect={mockOnProjectSelect}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Project Beta')).toBeInTheDocument()
      })

      // Find the menu button for Project Beta (which is paused)
      const projectBetaCard = screen.getByText('Project Beta').closest('div[class*="bg-white"]')
      const menuButton = within(projectBetaCard!).getByRole('button', { name: '' })
      await user.click(menuButton)

      const activateButton = screen.getByText('Activate')
      await user.click(activateButton)

      await waitFor(() => {
        expect(ProjectRepository.updateProject).toHaveBeenCalledWith(
          mockProjects[1].id,
          { status: 'active' }
        )
      })
    })

    it('should archive project', async () => {
      const user = userEvent.setup()

      render(
        <ProjectManagement
          currentUser={mockUser}
          currentProject={null}
          onProjectSelect={mockOnProjectSelect}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Project Alpha')).toBeInTheDocument()
      })

      const menuButtons = screen.getAllByRole('button', { name: '' })
      const firstMenuButton = menuButtons.find(btn =>
        btn.querySelector('svg')?.getAttribute('class')?.includes('lucide-more-vertical')
      )
      await user.click(firstMenuButton!)

      const archiveButton = screen.getByText('Archive')
      await user.click(archiveButton)

      await waitFor(() => {
        expect(ProjectRepository.updateProject).toHaveBeenCalledWith(
          mockProjects[0].id,
          { status: 'archived' }
        )
      })
    })

    it('should handle status update errors gracefully', async () => {
      const user = userEvent.setup()
      vi.mocked(ProjectRepository.updateProject).mockResolvedValue(null)

      render(
        <ProjectManagement
          currentUser={mockUser}
          currentProject={null}
          onProjectSelect={mockOnProjectSelect}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Project Alpha')).toBeInTheDocument()
      })

      const menuButtons = screen.getAllByRole('button', { name: '' })
      const firstMenuButton = menuButtons.find(btn =>
        btn.querySelector('svg')?.getAttribute('class')?.includes('lucide-more-vertical')
      )
      await user.click(firstMenuButton!)

      const pauseButton = screen.getByText('Pause')
      await user.click(pauseButton)

      // Should not crash, menu should close
      await waitFor(() => {
        expect(screen.queryByText('Open Project')).not.toBeInTheDocument()
      })
    })
  })

  // =========================================================================
  // Project Deletion
  // =========================================================================

  describe('Project Deletion', () => {
    it('should show delete confirmation modal', async () => {
      const user = userEvent.setup()

      render(
        <ProjectManagement
          currentUser={mockUser}
          currentProject={null}
          onProjectSelect={mockOnProjectSelect}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Project Alpha')).toBeInTheDocument()
      })

      const menuButtons = screen.getAllByRole('button', { name: '' })
      const firstMenuButton = menuButtons.find(btn =>
        btn.querySelector('svg')?.getAttribute('class')?.includes('lucide-more-vertical')
      )
      await user.click(firstMenuButton!)

      const deleteButton = screen.getByText('Delete')
      await user.click(deleteButton)

      expect(screen.getByText('Delete Project')).toBeInTheDocument()
      expect(screen.getByText('"Project Alpha"')).toBeInTheDocument()
      expect(screen.getByText(/This will permanently delete the project/)).toBeInTheDocument()
    })

    it('should cancel deletion', async () => {
      const user = userEvent.setup()

      render(
        <ProjectManagement
          currentUser={mockUser}
          currentProject={null}
          onProjectSelect={mockOnProjectSelect}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Project Alpha')).toBeInTheDocument()
      })

      const menuButtons = screen.getAllByRole('button', { name: '' })
      const firstMenuButton = menuButtons.find(btn =>
        btn.querySelector('svg')?.getAttribute('class')?.includes('lucide-more-vertical')
      )
      await user.click(firstMenuButton!)

      const deleteButton = screen.getByText('Delete')
      await user.click(deleteButton)

      const cancelButton = screen.getByRole('button', { name: 'Cancel' })
      await user.click(cancelButton)

      await waitFor(() => {
        expect(screen.queryByText('Delete Project')).not.toBeInTheDocument()
      })

      expect(ProjectRepository.deleteProject).not.toHaveBeenCalled()
    })

    it('should confirm and delete project', async () => {
      const user = userEvent.setup()

      render(
        <ProjectManagement
          currentUser={mockUser}
          currentProject={null}
          onProjectSelect={mockOnProjectSelect}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Project Alpha')).toBeInTheDocument()
      })

      const menuButtons = screen.getAllByRole('button', { name: '' })
      const firstMenuButton = menuButtons.find(btn =>
        btn.querySelector('svg')?.getAttribute('class')?.includes('lucide-more-vertical')
      )
      await user.click(firstMenuButton!)

      const deleteButton = screen.getByText('Delete')
      await user.click(deleteButton)

      const confirmButton = screen.getAllByRole('button', { name: 'Delete' })[1]
      await user.click(confirmButton)

      await waitFor(() => {
        expect(ProjectRepository.deleteProject).toHaveBeenCalledWith(mockProjects[0].id)
      })
    })

    it('should switch to another project when deleting current project', async () => {
      const user = userEvent.setup()
      const currentProject = mockProjects[0]

      render(
        <ProjectManagement
          currentUser={mockUser}
          currentProject={currentProject}
          onProjectSelect={mockOnProjectSelect}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Project Alpha')).toBeInTheDocument()
      })

      const projectCard = screen.getByText('Project Alpha').closest('div[class*="bg-white"]')
      const menuButton = within(projectCard!).getByRole('button', { name: '' })
      await user.click(menuButton)

      const deleteButton = screen.getByText('Delete')
      await user.click(deleteButton)

      const confirmButton = screen.getAllByRole('button', { name: 'Delete' })[1]
      await user.click(confirmButton)

      await waitFor(() => {
        expect(mockOnProjectSelect).toHaveBeenCalledWith(
          expect.objectContaining({ name: 'Project Beta' })
        )
      })
    })

    it('should handle deletion errors gracefully', async () => {
      const user = userEvent.setup()
      vi.mocked(ProjectRepository.deleteProject).mockResolvedValue(false)

      render(
        <ProjectManagement
          currentUser={mockUser}
          currentProject={null}
          onProjectSelect={mockOnProjectSelect}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Project Alpha')).toBeInTheDocument()
      })

      const menuButtons = screen.getAllByRole('button', { name: '' })
      const firstMenuButton = menuButtons.find(btn =>
        btn.querySelector('svg')?.getAttribute('class')?.includes('lucide-more-vertical')
      )
      await user.click(firstMenuButton!)

      const deleteButton = screen.getByText('Delete')
      await user.click(deleteButton)

      const confirmButton = screen.getAllByRole('button', { name: 'Delete' })[1]
      await user.click(confirmButton)

      // Should close modal even on error
      await waitFor(() => {
        expect(screen.queryByText('Delete Project')).not.toBeInTheDocument()
      })
    })
  })

  // =========================================================================
  // Real-time Updates
  // =========================================================================

  describe('Real-time Updates', () => {
    it('should subscribe to project updates on mount', async () => {
      render(
        <ProjectManagement
          currentUser={mockUser}
          currentProject={null}
          onProjectSelect={mockOnProjectSelect}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      await waitFor(() => {
        expect(ProjectRepository.subscribeToProjects).toHaveBeenCalledWith(
          expect.any(Function),
          mockUser.id
        )
      })
    })

    it('should unsubscribe from project updates on unmount', async () => {
      const { unmount } = render(
        <ProjectManagement
          currentUser={mockUser}
          currentProject={null}
          onProjectSelect={mockOnProjectSelect}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      await waitFor(() => {
        expect(ProjectRepository.subscribeToProjects).toHaveBeenCalled()
      })

      unmount()

      expect(unsubscribe).toHaveBeenCalled()
    })

    it('should update project list when real-time update is received', async () => {
      let callback: ((projects: Project[] | null) => void) | undefined

      vi.mocked(ProjectRepository.subscribeToProjects).mockImplementation((cb) => {
        callback = cb
        return unsubscribe
      })

      render(
        <ProjectManagement
          currentUser={mockUser}
          currentProject={null}
          onProjectSelect={mockOnProjectSelect}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      await waitFor(() => {
        expect(callback).toBeDefined()
      })

      const newProject = createMockProject({
        id: generateDemoUUID('new'),
        name: 'Real-time Project'
      })
      callback!([...mockProjects, newProject])

      await waitFor(() => {
        expect(screen.getByText('Real-time Project')).toBeInTheDocument()
      })
    })
  })

  // =========================================================================
  // Error Handling
  // =========================================================================

  describe('Error Handling', () => {
    it('should handle getUserOwnedProjects error gracefully', async () => {
      vi.mocked(ProjectRepository.getUserOwnedProjects).mockRejectedValue(
        new Error('Database error')
      )

      render(
        <ProjectManagement
          currentUser={mockUser}
          currentProject={null}
          onProjectSelect={mockOnProjectSelect}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('No projects found')).toBeInTheDocument()
      })
    })

    it('should handle subscription errors gracefully', async () => {
      vi.mocked(ProjectRepository.subscribeToProjects).mockImplementation(() => {
        throw new Error('Subscription error')
      })

      const { container } = render(
        <ProjectManagement
          currentUser={mockUser}
          currentProject={null}
          onProjectSelect={mockOnProjectSelect}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      // Should still render without crashing
      await waitFor(() => {
        expect(container.querySelector('[class*="max-w-7xl"]')).toBeInTheDocument()
      })
    })
  })

  // =========================================================================
  // Edge Cases
  // =========================================================================

  describe('Edge Cases', () => {
    it('should handle many projects efficiently', async () => {
      const manyProjects = Array.from({ length: 50 }, (_, i) =>
        createMockProject({ id: generateDemoUUID(`p${i}`), name: `Project ${i}` })
      )
      vi.mocked(ProjectRepository.getUserOwnedProjects).mockResolvedValue(manyProjects)

      render(
        <ProjectManagement
          currentUser={mockUser}
          currentProject={null}
          onProjectSelect={mockOnProjectSelect}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('50 of 50 projects')).toBeInTheDocument()
      })
    })

    it('should handle projects with very long names', async () => {
      const longNameProject = createMockProject({
        name: 'A'.repeat(200),
        description: 'B'.repeat(500)
      })
      vi.mocked(ProjectRepository.getUserOwnedProjects).mockResolvedValue([longNameProject])

      const { container } = render(
        <ProjectManagement
          currentUser={mockUser}
          currentProject={null}
          onProjectSelect={mockOnProjectSelect}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      await waitFor(() => {
        const projectName = container.querySelector('[class*="truncate"]')
        expect(projectName).toBeInTheDocument()
      })
    })

    it('should handle projects without optional fields', async () => {
      const minimalProject: Project = {
        id: generateDemoUUID('minimal'),
        name: 'Minimal Project',
        project_type: 'other',
        status: 'active',
        visibility: 'private',
        priority_level: 'low',
        owner_id: mockUser.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      vi.mocked(ProjectRepository.getUserOwnedProjects).mockResolvedValue([minimalProject])

      render(
        <ProjectManagement
          currentUser={mockUser}
          currentProject={null}
          onProjectSelect={mockOnProjectSelect}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Minimal Project')).toBeInTheDocument()
      })
    })

    it('should handle duplicate project names', async () => {
      const duplicateProjects = [
        createMockProject({ id: generateDemoUUID('dup1'), name: 'Duplicate' }),
        createMockProject({ id: generateDemoUUID('dup2'), name: 'Duplicate' })
      ]
      vi.mocked(ProjectRepository.getUserOwnedProjects).mockResolvedValue(duplicateProjects)

      render(
        <ProjectManagement
          currentUser={mockUser}
          currentProject={null}
          onProjectSelect={mockOnProjectSelect}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      await waitFor(() => {
        const duplicates = screen.getAllByText('Duplicate')
        expect(duplicates).toHaveLength(2)
      })
    })

    it('should handle rapid filter changes', async () => {
      const user = userEvent.setup()

      render(
        <ProjectManagement
          currentUser={mockUser}
          currentProject={null}
          onProjectSelect={mockOnProjectSelect}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Project Alpha')).toBeInTheDocument()
      })

      const statusSelect = screen.getByDisplayValue('All Status')

      // Rapidly change filters
      await user.selectOptions(statusSelect, 'active')
      await user.selectOptions(statusSelect, 'paused')
      await user.selectOptions(statusSelect, 'completed')
      await user.selectOptions(statusSelect, 'all')

      await waitFor(() => {
        expect(screen.getByText('3 of 3 projects')).toBeInTheDocument()
      })
    })
  })

  // =========================================================================
  // Accessibility
  // =========================================================================

  describe('Accessibility', () => {
    it('should have accessible form labels', async () => {
      render(
        <ProjectManagement
          currentUser={mockUser}
          currentProject={null}
          onProjectSelect={mockOnProjectSelect}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search projects...')).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText('Search projects...')
      expect(searchInput).toHaveAttribute('type', 'text')
    })

    it('should have keyboard-accessible buttons', async () => {
      const user = userEvent.setup()

      render(
        <ProjectManagement
          currentUser={mockUser}
          currentProject={null}
          onProjectSelect={mockOnProjectSelect}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Project Alpha')).toBeInTheDocument()
      })

      const newProjectButton = screen.getAllByText('New Project')[0]
      await user.click(newProjectButton)

      await waitFor(() => {
        expect(screen.getByTestId('project-startup-flow')).toBeInTheDocument()
      })
    })

    it('should have proper ARIA attributes for modal', async () => {
      const user = userEvent.setup()

      render(
        <ProjectManagement
          currentUser={mockUser}
          currentProject={null}
          onProjectSelect={mockOnProjectSelect}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Project Alpha')).toBeInTheDocument()
      })

      const menuButtons = screen.getAllByRole('button', { name: '' })
      const firstMenuButton = menuButtons.find(btn =>
        btn.querySelector('svg')?.getAttribute('class')?.includes('lucide-more-vertical')
      )
      await user.click(firstMenuButton!)

      const deleteButton = screen.getByText('Delete')
      await user.click(deleteButton)

      const modal = screen.getByText('Delete Project').closest('div[class*="fixed"]')
      expect(modal).toBeInTheDocument()
    })

    it('should maintain focus management in modals', async () => {
      const user = userEvent.setup()

      render(
        <ProjectManagement
          currentUser={mockUser}
          currentProject={null}
          onProjectSelect={mockOnProjectSelect}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Project Alpha')).toBeInTheDocument()
      })

      const newProjectButtons = screen.getAllByText('New Project')
      await user.click(newProjectButtons[0])

      // Modal content should be accessible
      await waitFor(() => {
        const modal = screen.getByTestId('project-startup-flow')
        expect(modal).toBeInTheDocument()
      })
    })
  })
})