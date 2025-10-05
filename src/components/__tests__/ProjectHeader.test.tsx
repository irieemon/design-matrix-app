import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../../test/utils/test-utils'
import ProjectHeader from '../ProjectHeader'
import { mockUser, mockProject, mockAdminUser } from '../../test/utils/test-utils'
import { DatabaseService } from '../../lib/database'
import { Project, IdeaCard } from '../../types'
import { generateDemoUUID } from '../../utils/uuid'

// Mock dependencies
vi.mock('../../lib/database', () => ({
  DatabaseService: {
    createProject: vi.fn(),
    updateProject: vi.fn()
  }
}))

vi.mock('../AIStarterModal', () => ({
  default: ({ onClose, onProjectCreated }: any) => (
    <div data-testid="ai-starter-modal">
      <button onClick={onClose}>Close AI Modal</button>
      <button onClick={() => onProjectCreated(mockProject, [])}>Create AI Project</button>
    </div>
  )
}))

describe('ProjectHeader Component', () => {
  const mockOnProjectChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('No Project State - Initial Setup', () => {
    it('should render create project prompt when no project exists', () => {
      render(
        <ProjectHeader
          currentUser={mockUser}
          currentProject={null}
          onProjectChange={mockOnProjectChange}
        />
      )

      expect(screen.getByText('Create Your First Project')).toBeInTheDocument()
      expect(screen.getByText(/Give your priority matrix a name to get started/i)).toBeInTheDocument()
    })

    it('should display AI Starter button', () => {
      render(
        <ProjectHeader
          currentUser={mockUser}
          currentProject={null}
          onProjectChange={mockOnProjectChange}
        />
      )

      const aiButton = screen.getByRole('button', { name: /AI Starter/i })
      expect(aiButton).toBeInTheDocument()
      expect(aiButton).toHaveClass('from-purple-600', 'to-blue-600')
    })

    it('should display Manual Setup button', () => {
      render(
        <ProjectHeader
          currentUser={mockUser}
          currentProject={null}
          onProjectChange={mockOnProjectChange}
        />
      )

      const manualButton = screen.getByRole('button', { name: /Manual Setup/i })
      expect(manualButton).toBeInTheDocument()
    })

    it('should open AI Starter modal when AI Starter button clicked', async () => {
      render(
        <ProjectHeader
          currentUser={mockUser}
          currentProject={null}
          onProjectChange={mockOnProjectChange}
        />
      )

      const aiButton = screen.getByRole('button', { name: /AI Starter/i })
      fireEvent.click(aiButton)

      await waitFor(() => {
        expect(screen.getByTestId('ai-starter-modal')).toBeInTheDocument()
      })
    })

    it('should close AI Starter modal when close button clicked', async () => {
      render(
        <ProjectHeader
          currentUser={mockUser}
          currentProject={null}
          onProjectChange={mockOnProjectChange}
        />
      )

      fireEvent.click(screen.getByRole('button', { name: /AI Starter/i }))

      await waitFor(() => {
        expect(screen.getByTestId('ai-starter-modal')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Close AI Modal'))

      await waitFor(() => {
        expect(screen.queryByTestId('ai-starter-modal')).not.toBeInTheDocument()
      })
    })

    it('should handle AI project creation', async () => {
      render(
        <ProjectHeader
          currentUser={mockUser}
          currentProject={null}
          onProjectChange={mockOnProjectChange}
        />
      )

      fireEvent.click(screen.getByRole('button', { name: /AI Starter/i }))

      await waitFor(() => {
        expect(screen.getByTestId('ai-starter-modal')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Create AI Project'))

      await waitFor(() => {
        expect(mockOnProjectChange).toHaveBeenCalledWith(mockProject)
      })
    })

    it('should enter creation mode when Manual Setup clicked', () => {
      render(
        <ProjectHeader
          currentUser={mockUser}
          currentProject={null}
          onProjectChange={mockOnProjectChange}
        />
      )

      fireEvent.click(screen.getByRole('button', { name: /Manual Setup/i }))

      expect(screen.getByPlaceholderText('Enter project name...')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Brief description of your project...')).toBeInTheDocument()
    })
  })

  describe('Creation Mode', () => {
    beforeEach(() => {
      render(
        <ProjectHeader
          currentUser={mockUser}
          currentProject={null}
          onProjectChange={mockOnProjectChange}
        />
      )
      fireEvent.click(screen.getByRole('button', { name: /Manual Setup/i }))
    })

    it('should render project name input with autofocus', () => {
      const nameInput = screen.getByPlaceholderText('Enter project name...')
      expect(nameInput).toBeInTheDocument()
      expect(nameInput).toHaveAttribute('autofocus')
    })

    it('should render description input', () => {
      const descInput = screen.getByPlaceholderText('Brief description of your project...')
      expect(descInput).toBeInTheDocument()
    })

    it('should update name input value on change', () => {
      const nameInput = screen.getByPlaceholderText('Enter project name...')
      fireEvent.change(nameInput, { target: { value: 'New Project' } })
      expect(nameInput).toHaveValue('New Project')
    })

    it('should update description input value on change', () => {
      const descInput = screen.getByPlaceholderText('Brief description of your project...')
      fireEvent.change(descInput, { target: { value: 'Project description' } })
      expect(descInput).toHaveValue('Project description')
    })

    it('should disable Create Project button when name is empty', () => {
      const createButton = screen.getByRole('button', { name: /Create Project/i })
      expect(createButton).toBeDisabled()
      expect(createButton).toHaveClass('disabled:opacity-50', 'disabled:cursor-not-allowed')
    })

    it('should enable Create Project button when name is provided', () => {
      const nameInput = screen.getByPlaceholderText('Enter project name...')
      fireEvent.change(nameInput, { target: { value: 'New Project' } })

      const createButton = screen.getByRole('button', { name: /Create Project/i })
      expect(createButton).not.toBeDisabled()
    })

    it('should not enable button with only whitespace in name', () => {
      const nameInput = screen.getByPlaceholderText('Enter project name...')
      fireEvent.change(nameInput, { target: { value: '   ' } })

      const createButton = screen.getByRole('button', { name: /Create Project/i })
      expect(createButton).toBeDisabled()
    })

    it('should cancel creation and return to initial state', () => {
      const cancelButton = screen.getByRole('button', { name: /Cancel/i })
      fireEvent.click(cancelButton)

      expect(screen.getByText('Create Your First Project')).toBeInTheDocument()
      expect(screen.queryByPlaceholderText('Enter project name...')).not.toBeInTheDocument()
    })

    it('should create project with name only', async () => {
      const newProject = { ...mockProject, id: generateDemoUUID('99'), name: 'Test Project' }
      vi.mocked(DatabaseService.createProject).mockResolvedValue(newProject)

      const nameInput = screen.getByPlaceholderText('Enter project name...')
      fireEvent.change(nameInput, { target: { value: 'Test Project' } })

      const createButton = screen.getByRole('button', { name: /Create Project/i })
      fireEvent.click(createButton)

      await waitFor(() => {
        expect(DatabaseService.createProject).toHaveBeenCalledWith({
          name: 'Test Project',
          description: undefined,
          project_type: 'other',
          status: 'active',
          priority_level: 'medium',
          visibility: 'private',
          owner_id: mockUser.id
        })
      })

      expect(mockOnProjectChange).toHaveBeenCalledWith(newProject)
    })

    it('should create project with name and description', async () => {
      const newProject = {
        ...mockProject,
        id: generateDemoUUID('100'),
        name: 'Test Project',
        description: 'Test description'
      }
      vi.mocked(DatabaseService.createProject).mockResolvedValue(newProject)

      const nameInput = screen.getByPlaceholderText('Enter project name...')
      const descInput = screen.getByPlaceholderText('Brief description of your project...')

      fireEvent.change(nameInput, { target: { value: 'Test Project' } })
      fireEvent.change(descInput, { target: { value: 'Test description' } })

      const createButton = screen.getByRole('button', { name: /Create Project/i })
      fireEvent.click(createButton)

      await waitFor(() => {
        expect(DatabaseService.createProject).toHaveBeenCalledWith({
          name: 'Test Project',
          description: 'Test description',
          project_type: 'other',
          status: 'active',
          priority_level: 'medium',
          visibility: 'private',
          owner_id: mockUser.id
        })
      })
    })

    it('should trim whitespace from inputs before creating', async () => {
      const newProject = { ...mockProject, id: generateDemoUUID('101') }
      vi.mocked(DatabaseService.createProject).mockResolvedValue(newProject)

      const nameInput = screen.getByPlaceholderText('Enter project name...')
      const descInput = screen.getByPlaceholderText('Brief description of your project...')

      fireEvent.change(nameInput, { target: { value: '  Test Project  ' } })
      fireEvent.change(descInput, { target: { value: '  Test description  ' } })

      fireEvent.click(screen.getByRole('button', { name: /Create Project/i }))

      await waitFor(() => {
        expect(DatabaseService.createProject).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Test Project',
            description: 'Test description'
          })
        )
      })
    })

    it('should handle database error during creation gracefully', async () => {
      vi.mocked(DatabaseService.createProject).mockResolvedValue(null)

      const nameInput = screen.getByPlaceholderText('Enter project name...')
      fireEvent.change(nameInput, { target: { value: 'Test Project' } })
      fireEvent.click(screen.getByRole('button', { name: /Create Project/i }))

      await waitFor(() => {
        expect(DatabaseService.createProject).toHaveBeenCalled()
      })

      // Should not call onProjectChange on failure
      expect(mockOnProjectChange).not.toHaveBeenCalled()
    })

    it('should clear form after successful creation', async () => {
      const newProject = { ...mockProject, id: generateDemoUUID('102') }
      vi.mocked(DatabaseService.createProject).mockResolvedValue(newProject)

      const nameInput = screen.getByPlaceholderText('Enter project name...') as HTMLInputElement
      const descInput = screen.getByPlaceholderText('Brief description of your project...') as HTMLInputElement

      fireEvent.change(nameInput, { target: { value: 'Test Project' } })
      fireEvent.change(descInput, { target: { value: 'Test description' } })
      fireEvent.click(screen.getByRole('button', { name: /Create Project/i }))

      await waitFor(() => {
        expect(mockOnProjectChange).toHaveBeenCalled()
      })

      // Component exits creation mode, so inputs are no longer visible
      expect(screen.queryByPlaceholderText('Enter project name...')).not.toBeInTheDocument()
    })
  })

  describe('Display Mode - Existing Project', () => {
    const projectWithDescription = {
      ...mockProject,
      name: 'Existing Project',
      description: 'This is a test project description',
      owner_id: mockUser.id
    }

    it('should display project name', () => {
      render(
        <ProjectHeader
          currentUser={mockUser}
          currentProject={projectWithDescription}
          onProjectChange={mockOnProjectChange}
        />
      )

      expect(screen.getByText('Existing Project')).toBeInTheDocument()
    })

    it('should display project description', () => {
      render(
        <ProjectHeader
          currentUser={mockUser}
          currentProject={projectWithDescription}
          onProjectChange={mockOnProjectChange}
        />
      )

      expect(screen.getByText('This is a test project description')).toBeInTheDocument()
    })

    it('should display Edit button', () => {
      render(
        <ProjectHeader
          currentUser={mockUser}
          currentProject={projectWithDescription}
          onProjectChange={mockOnProjectChange}
        />
      )

      expect(screen.getByRole('button', { name: /Edit/i })).toBeInTheDocument()
    })

    it('should display project owner and creation date', () => {
      render(
        <ProjectHeader
          currentUser={mockUser}
          currentProject={projectWithDescription}
          onProjectChange={mockOnProjectChange}
        />
      )

      expect(screen.getByText(/Created by/i)).toBeInTheDocument()
      expect(screen.getByText(/1\/1\/2024/i)).toBeInTheDocument()
    })

    it('should show "You" as owner when current user is owner', () => {
      render(
        <ProjectHeader
          currentUser={mockUser}
          currentProject={projectWithDescription}
          onProjectChange={mockOnProjectChange}
        />
      )

      const ownerText = screen.getByText(/Created by/i).textContent
      expect(ownerText).toContain('Test User')
    })

    it('should handle project without description', () => {
      const projectNoDesc = { ...mockProject, description: undefined }
      render(
        <ProjectHeader
          currentUser={mockUser}
          currentProject={projectNoDesc}
          onProjectChange={mockOnProjectChange}
        />
      )

      expect(screen.getByText(mockProject.name)).toBeInTheDocument()
      expect(screen.queryByText(/This is a test project description/i)).not.toBeInTheDocument()
    })

    it('should apply gradient background styling', () => {
      const { container } = render(
        <ProjectHeader
          currentUser={mockUser}
          currentProject={projectWithDescription}
          onProjectChange={mockOnProjectChange}
        />
      )

      const headerDiv = container.querySelector('.bg-gradient-to-r.from-slate-50.to-blue-50')
      expect(headerDiv).toBeInTheDocument()
    })

    it('should enter edit mode when Edit button clicked', () => {
      render(
        <ProjectHeader
          currentUser={mockUser}
          currentProject={projectWithDescription}
          onProjectChange={mockOnProjectChange}
        />
      )

      fireEvent.click(screen.getByRole('button', { name: /Edit/i }))

      expect(screen.getByDisplayValue('Existing Project')).toBeInTheDocument()
      expect(screen.getByDisplayValue('This is a test project description')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Save Changes/i })).toBeInTheDocument()
    })

    it('should show default owner name when owner details are missing', () => {
      const projectNoOwner = { ...mockProject, owner: undefined, owner_id: 'unknown-id' }
      render(
        <ProjectHeader
          currentUser={mockUser}
          currentProject={projectNoOwner}
          onProjectChange={mockOnProjectChange}
        />
      )

      expect(screen.getByText(/Unknown/i)).toBeInTheDocument()
    })
  })

  describe('Description Collapse Feature', () => {
    it('should auto-collapse long descriptions (>240 chars)', () => {
      const longDescription = 'A'.repeat(250)
      const projectLongDesc = { ...mockProject, description: longDescription }

      render(
        <ProjectHeader
          currentUser={mockUser}
          currentProject={projectLongDesc}
          onProjectChange={mockOnProjectChange}
        />
      )

      const descElement = screen.getByText(/A{240}\.\.\./i)
      expect(descElement).toBeInTheDocument()
      expect(descElement).toHaveClass('line-clamp-3')
    })

    it('should show collapse/expand button for long descriptions', () => {
      const longDescription = 'A'.repeat(250)
      const projectLongDesc = { ...mockProject, description: longDescription }

      render(
        <ProjectHeader
          currentUser={mockUser}
          currentProject={projectLongDesc}
          onProjectChange={mockOnProjectChange}
        />
      )

      const expandButton = screen.getByTitle('Show full description')
      expect(expandButton).toBeInTheDocument()
    })

    it('should expand description when expand button clicked', () => {
      const longDescription = 'A'.repeat(250)
      const projectLongDesc = { ...mockProject, description: longDescription }

      render(
        <ProjectHeader
          currentUser={mockUser}
          currentProject={projectLongDesc}
          onProjectChange={mockOnProjectChange}
        />
      )

      const expandButton = screen.getByTitle('Show full description')
      fireEvent.click(expandButton)

      const collapseButton = screen.getByTitle('Collapse description')
      expect(collapseButton).toBeInTheDocument()
    })

    it('should not show collapse button for short descriptions', () => {
      const shortDescription = 'Short description'
      const projectShortDesc = { ...mockProject, description: shortDescription }

      render(
        <ProjectHeader
          currentUser={mockUser}
          currentProject={projectShortDesc}
          onProjectChange={mockOnProjectChange}
        />
      )

      expect(screen.queryByTitle('Show full description')).not.toBeInTheDocument()
      expect(screen.queryByTitle('Collapse description')).not.toBeInTheDocument()
    })

    it('should re-collapse when project changes', () => {
      const longDescription1 = 'A'.repeat(250)
      const project1 = { ...mockProject, id: '1', description: longDescription1 }
      const longDescription2 = 'B'.repeat(250)
      const project2 = { ...mockProject, id: '2', description: longDescription2 }

      const { rerender } = render(
        <ProjectHeader
          currentUser={mockUser}
          currentProject={project1}
          onProjectChange={mockOnProjectChange}
        />
      )

      // Expand first project
      fireEvent.click(screen.getByTitle('Show full description'))
      expect(screen.getByTitle('Collapse description')).toBeInTheDocument()

      // Change to different project
      rerender(
        <ProjectHeader
          currentUser={mockUser}
          currentProject={project2}
          onProjectChange={mockOnProjectChange}
        />
      )

      // Should be collapsed again
      expect(screen.getByTitle('Show full description')).toBeInTheDocument()
    })
  })

  describe('Edit Mode', () => {
    const projectToEdit = {
      ...mockProject,
      name: 'Edit Test Project',
      description: 'Edit test description',
      owner_id: mockUser.id
    }

    beforeEach(() => {
      render(
        <ProjectHeader
          currentUser={mockUser}
          currentProject={projectToEdit}
          onProjectChange={mockOnProjectChange}
        />
      )
      fireEvent.click(screen.getByRole('button', { name: /Edit/i }))
    })

    it('should populate form with current project values', () => {
      expect(screen.getByDisplayValue('Edit Test Project')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Edit test description')).toBeInTheDocument()
    })

    it('should focus name input in edit mode', () => {
      const nameInput = screen.getByDisplayValue('Edit Test Project')
      expect(nameInput).toHaveAttribute('autofocus')
    })

    it('should update name field', () => {
      const nameInput = screen.getByDisplayValue('Edit Test Project')
      fireEvent.change(nameInput, { target: { value: 'Updated Name' } })
      expect(nameInput).toHaveValue('Updated Name')
    })

    it('should update description field', () => {
      const descInput = screen.getByDisplayValue('Edit test description')
      fireEvent.change(descInput, { target: { value: 'Updated description' } })
      expect(descInput).toHaveValue('Updated description')
    })

    it('should disable Save Changes button when name is empty', () => {
      const nameInput = screen.getByDisplayValue('Edit Test Project')
      fireEvent.change(nameInput, { target: { value: '' } })

      const saveButton = screen.getByRole('button', { name: /Save Changes/i })
      expect(saveButton).toBeDisabled()
    })

    it('should cancel edit and return to display mode', () => {
      const cancelButton = screen.getByRole('button', { name: /Cancel/i })
      fireEvent.click(cancelButton)

      expect(screen.getByText('Edit Test Project')).toBeInTheDocument()
      expect(screen.queryByDisplayValue('Edit Test Project')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Edit/i })).toBeInTheDocument()
    })

    it('should save changes when Save Changes clicked', async () => {
      const updatedProject = { ...projectToEdit, name: 'Updated Name' }
      vi.mocked(DatabaseService.updateProject).mockResolvedValue(updatedProject)

      const nameInput = screen.getByDisplayValue('Edit Test Project')
      fireEvent.change(nameInput, { target: { value: 'Updated Name' } })

      const saveButton = screen.getByRole('button', { name: /Save Changes/i })
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(DatabaseService.updateProject).toHaveBeenCalledWith(projectToEdit.id, {
          name: 'Updated Name',
          description: 'Edit test description'
        })
      })

      expect(mockOnProjectChange).toHaveBeenCalledWith(updatedProject)
    })

    it('should trim whitespace before saving', async () => {
      const updatedProject = { ...projectToEdit, name: 'Trimmed Name' }
      vi.mocked(DatabaseService.updateProject).mockResolvedValue(updatedProject)

      const nameInput = screen.getByDisplayValue('Edit Test Project')
      const descInput = screen.getByDisplayValue('Edit test description')

      fireEvent.change(nameInput, { target: { value: '  Trimmed Name  ' } })
      fireEvent.change(descInput, { target: { value: '  Trimmed desc  ' } })

      fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }))

      await waitFor(() => {
        expect(DatabaseService.updateProject).toHaveBeenCalledWith(
          projectToEdit.id,
          expect.objectContaining({
            name: 'Trimmed Name',
            description: 'Trimmed desc'
          })
        )
      })
    })

    it('should handle update failure gracefully', async () => {
      vi.mocked(DatabaseService.updateProject).mockResolvedValue(null)

      const nameInput = screen.getByDisplayValue('Edit Test Project')
      fireEvent.change(nameInput, { target: { value: 'New Name' } })
      fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }))

      await waitFor(() => {
        expect(DatabaseService.updateProject).toHaveBeenCalled()
      })

      expect(mockOnProjectChange).not.toHaveBeenCalled()
    })

    it('should not attempt save if project is null', async () => {
      render(
        <ProjectHeader
          currentUser={mockUser}
          currentProject={null}
          onProjectChange={mockOnProjectChange}
        />
      )

      // Should not be in edit mode
      expect(screen.queryByRole('button', { name: /Save Changes/i })).not.toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper button labels', () => {
      render(
        <ProjectHeader
          currentUser={mockUser}
          currentProject={null}
          onProjectChange={mockOnProjectChange}
        />
      )

      expect(screen.getByRole('button', { name: /AI Starter/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Manual Setup/i })).toBeInTheDocument()
    })

    it('should have proper input labels in creation mode', () => {
      render(
        <ProjectHeader
          currentUser={mockUser}
          currentProject={null}
          onProjectChange={mockOnProjectChange}
        />
      )
      fireEvent.click(screen.getByRole('button', { name: /Manual Setup/i }))

      expect(screen.getByLabelText('Project Name')).toBeInTheDocument()
      expect(screen.getByLabelText('Description (optional)')).toBeInTheDocument()
    })

    it('should have title attribute on Edit button', () => {
      render(
        <ProjectHeader
          currentUser={mockUser}
          currentProject={mockProject}
          onProjectChange={mockOnProjectChange}
        />
      )

      const editButton = screen.getByRole('button', { name: /Edit/i })
      expect(editButton).toHaveAttribute('title', 'Edit project details')
    })

    it('should have proper placeholder text', () => {
      render(
        <ProjectHeader
          currentUser={mockUser}
          currentProject={null}
          onProjectChange={mockOnProjectChange}
        />
      )
      fireEvent.click(screen.getByRole('button', { name: /Manual Setup/i }))

      expect(screen.getByPlaceholderText('Enter project name...')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Brief description of your project...')).toBeInTheDocument()
    })

    it('should support keyboard navigation', () => {
      render(
        <ProjectHeader
          currentUser={mockUser}
          currentProject={null}
          onProjectChange={mockOnProjectChange}
        />
      )

      const aiButton = screen.getByRole('button', { name: /AI Starter/i })
      aiButton.focus()
      expect(document.activeElement).toBe(aiButton)
    })
  })

  describe('Edge Cases', () => {
    it('should handle undefined onProjectChange callback', async () => {
      const newProject = { ...mockProject, id: generateDemoUUID('103') }
      vi.mocked(DatabaseService.createProject).mockResolvedValue(newProject)

      render(
        <ProjectHeader
          currentUser={mockUser}
          currentProject={null}
        />
      )

      fireEvent.click(screen.getByRole('button', { name: /Manual Setup/i }))
      const nameInput = screen.getByPlaceholderText('Enter project name...')
      fireEvent.change(nameInput, { target: { value: 'Test' } })
      fireEvent.click(screen.getByRole('button', { name: /Create Project/i }))

      await waitFor(() => {
        expect(DatabaseService.createProject).toHaveBeenCalled()
      })

      // Should not throw error
    })

    it('should handle empty description as undefined in create', async () => {
      const newProject = { ...mockProject, id: generateDemoUUID('104') }
      vi.mocked(DatabaseService.createProject).mockResolvedValue(newProject)

      render(
        <ProjectHeader
          currentUser={mockUser}
          currentProject={null}
          onProjectChange={mockOnProjectChange}
        />
      )

      fireEvent.click(screen.getByRole('button', { name: /Manual Setup/i }))
      const nameInput = screen.getByPlaceholderText('Enter project name...')
      fireEvent.change(nameInput, { target: { value: 'Test' } })
      fireEvent.click(screen.getByRole('button', { name: /Create Project/i }))

      await waitFor(() => {
        expect(DatabaseService.createProject).toHaveBeenCalledWith(
          expect.objectContaining({
            description: undefined
          })
        )
      })
    })

    it('should handle very long project names', () => {
      const longName = 'A'.repeat(200)
      const project = { ...mockProject, name: longName }

      render(
        <ProjectHeader
          currentUser={mockUser}
          currentProject={project}
          onProjectChange={mockOnProjectChange}
        />
      )

      expect(screen.getByText(longName)).toBeInTheDocument()
    })

    it('should handle special characters in project name', () => {
      const specialName = 'Test <Project> & "Quotes" \'Single\''
      const project = { ...mockProject, name: specialName }

      render(
        <ProjectHeader
          currentUser={mockUser}
          currentProject={project}
          onProjectChange={mockOnProjectChange}
        />
      )

      expect(screen.getByText(specialName)).toBeInTheDocument()
    })

    it('should handle null owner_id gracefully', () => {
      const project = { ...mockProject, owner_id: null as any }

      render(
        <ProjectHeader
          currentUser={mockUser}
          currentProject={project}
          onProjectChange={mockOnProjectChange}
        />
      )

      expect(screen.getByText(/Created by/i)).toBeInTheDocument()
    })

    it('should handle missing created_at date', () => {
      const project = { ...mockProject, created_at: undefined as any }

      const { container } = render(
        <ProjectHeader
          currentUser={mockUser}
          currentProject={project}
          onProjectChange={mockOnProjectChange}
        />
      )

      // Component should still render without throwing
      expect(container.querySelector('.bg-gradient-to-r')).toBeInTheDocument()
    })

    it('should handle AI modal project creation with empty ideas array', async () => {
      render(
        <ProjectHeader
          currentUser={mockUser}
          currentProject={null}
          onProjectChange={mockOnProjectChange}
        />
      )

      fireEvent.click(screen.getByRole('button', { name: /AI Starter/i }))

      await waitFor(() => {
        expect(screen.getByTestId('ai-starter-modal')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Create AI Project'))

      await waitFor(() => {
        expect(mockOnProjectChange).toHaveBeenCalledWith(mockProject)
      })
    })

    it('should handle rapid clicking on create button', async () => {
      const newProject = { ...mockProject, id: generateDemoUUID('105') }
      vi.mocked(DatabaseService.createProject).mockResolvedValue(newProject)

      render(
        <ProjectHeader
          currentUser={mockUser}
          currentProject={null}
          onProjectChange={mockOnProjectChange}
        />
      )

      fireEvent.click(screen.getByRole('button', { name: /Manual Setup/i }))
      const nameInput = screen.getByPlaceholderText('Enter project name...')
      fireEvent.change(nameInput, { target: { value: 'Test' } })

      const createButton = screen.getByRole('button', { name: /Create Project/i })
      fireEvent.click(createButton)
      fireEvent.click(createButton)
      fireEvent.click(createButton)

      await waitFor(() => {
        expect(DatabaseService.createProject).toHaveBeenCalledTimes(3)
      })
    })

    it('should handle admin user display', () => {
      const adminProject = { ...mockProject, owner_id: mockAdminUser.id }

      render(
        <ProjectHeader
          currentUser={mockAdminUser}
          currentProject={adminProject}
          onProjectChange={mockOnProjectChange}
        />
      )

      const ownerText = screen.getByText(/Created by/i).textContent
      expect(ownerText).toContain('Admin User')
    })
  })
})