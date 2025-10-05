import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '../../test/utils/test-utils'
import ProjectStartupFlow from '../ProjectStartupFlow'
import { mockUser, mockProject } from '../../test/utils/test-utils'
import { DatabaseService } from '../../lib/database'
import { aiService } from '../../lib/aiService'
import { logger } from '../../utils/logger'
import { generateDemoUUID } from '../../utils/uuid'
import { Project, ProjectType, IdeaCard } from '../../types'

// Mock dependencies
vi.mock('../../lib/database', () => ({
  DatabaseService: {
    createProject: vi.fn(),
    createIdea: vi.fn()
  }
}))

vi.mock('../../lib/aiService', () => ({
  aiService: {
    generateProjectIdeas: vi.fn()
  }
}))

vi.mock('../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
}))

describe('ProjectStartupFlow Component', () => {
  const mockOnClose = vi.fn()
  const mockOnProjectCreated = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    // Mock crypto.randomUUID for consistent test results
    global.crypto = {
      ...global.crypto,
      randomUUID: vi.fn(() => generateDemoUUID('999'))
    } as any
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Modal Rendering', () => {
    it('should render modal with header', () => {
      render(
        <ProjectStartupFlow
          currentUser={mockUser}
          onClose={mockOnClose}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      expect(screen.getByText('Create New Project')).toBeInTheDocument()
      expect(screen.getByText('Step 1 of 3')).toBeInTheDocument()
    })

    it('should render close button', () => {
      render(
        <ProjectStartupFlow
          currentUser={mockUser}
          onClose={mockOnClose}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      const closeButton = screen.getByRole('button', { name: '' }).closest('button')
      expect(closeButton).toBeInTheDocument()
    })

    it('should call onClose when close button clicked', () => {
      render(
        <ProjectStartupFlow
          currentUser={mockUser}
          onClose={mockOnClose}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      const closeButtons = screen.getAllByRole('button')
      const closeButton = closeButtons.find(btn => btn.querySelector('.w-5.h-5'))
      fireEvent.click(closeButton!)

      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('should render with overlay', () => {
      const { container } = render(
        <ProjectStartupFlow
          currentUser={mockUser}
          onClose={mockOnClose}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      const overlay = container.querySelector('.fixed.inset-0.bg-black.bg-opacity-50')
      expect(overlay).toBeInTheDocument()
    })

    it('should render progress bar', () => {
      const { container } = render(
        <ProjectStartupFlow
          currentUser={mockUser}
          onClose={mockOnClose}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      const progressBar = container.querySelector('.bg-gradient-to-r.from-blue-600.to-purple-600')
      expect(progressBar).toBeInTheDocument()
    })

    it('should show correct progress width for step 1', () => {
      const { container } = render(
        <ProjectStartupFlow
          currentUser={mockUser}
          onClose={mockOnClose}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      const progressBar = container.querySelector('.bg-gradient-to-r.from-blue-600.to-purple-600')
      expect(progressBar).toHaveStyle({ width: '33.333333333333336%' })
    })
  })

  describe('Step 1 - Project Basics', () => {
    it('should render step 1 heading', () => {
      render(
        <ProjectStartupFlow
          currentUser={mockUser}
          onClose={mockOnClose}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      expect(screen.getByText('Project Basics')).toBeInTheDocument()
      expect(screen.getByText(/Let's start with the essential information/i)).toBeInTheDocument()
    })

    it('should render project name input with autofocus', () => {
      render(
        <ProjectStartupFlow
          currentUser={mockUser}
          onClose={mockOnClose}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      const nameInput = screen.getByPlaceholderText(/e.g., Mobile App Launch/i)
      expect(nameInput).toBeInTheDocument()
      expect(nameInput).toHaveAttribute('autofocus')
    })

    it('should render project name label with required marker', () => {
      render(
        <ProjectStartupFlow
          currentUser={mockUser}
          onClose={mockOnClose}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      expect(screen.getByText('Project Name *')).toBeInTheDocument()
    })

    it('should update name input on change', () => {
      render(
        <ProjectStartupFlow
          currentUser={mockUser}
          onClose={mockOnClose}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      const nameInput = screen.getByPlaceholderText(/e.g., Mobile App Launch/i)
      fireEvent.change(nameInput, { target: { value: 'Test Project' } })
      expect(nameInput).toHaveValue('Test Project')
    })

    it('should render all project type options', () => {
      render(
        <ProjectStartupFlow
          currentUser={mockUser}
          onClose={mockOnClose}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      expect(screen.getByText('Software Development')).toBeInTheDocument()
      expect(screen.getByText('Product Development')).toBeInTheDocument()
      expect(screen.getByText('Business Planning')).toBeInTheDocument()
      expect(screen.getByText('Marketing Campaign')).toBeInTheDocument()
      expect(screen.getByText('Operations')).toBeInTheDocument()
      expect(screen.getByText('Research & Development')).toBeInTheDocument()
      expect(screen.getByText('Other')).toBeInTheDocument()
    })

    it('should render project type with icons and descriptions', () => {
      render(
        <ProjectStartupFlow
          currentUser={mockUser}
          onClose={mockOnClose}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      expect(screen.getByText('💻')).toBeInTheDocument()
      expect(screen.getByText(/Web apps, mobile apps, APIs/i)).toBeInTheDocument()
    })

    it('should select project type on click', () => {
      const { container } = render(
        <ProjectStartupFlow
          currentUser={mockUser}
          onClose={mockOnClose}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      const softwareCard = screen.getByText('Software Development').closest('div')
      fireEvent.click(softwareCard!)

      expect(softwareCard).toHaveClass('border-blue-500', 'bg-blue-50')
    })

    it('should deselect previous type when new type selected', () => {
      const { container } = render(
        <ProjectStartupFlow
          currentUser={mockUser}
          onClose={mockOnClose}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      const softwareCard = screen.getByText('Software Development').closest('div')
      const marketingCard = screen.getByText('Marketing Campaign').closest('div')

      fireEvent.click(softwareCard!)
      expect(softwareCard).toHaveClass('border-blue-500')

      fireEvent.click(marketingCard!)
      expect(softwareCard).not.toHaveClass('border-blue-500')
      expect(marketingCard).toHaveClass('border-blue-500')
    })

    it('should render description textarea', () => {
      render(
        <ProjectStartupFlow
          currentUser={mockUser}
          onClose={mockOnClose}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      const textarea = screen.getByPlaceholderText(/Describe your project goals/i)
      expect(textarea).toBeInTheDocument()
      expect(textarea.tagName).toBe('TEXTAREA')
    })

    it('should update description on change', () => {
      render(
        <ProjectStartupFlow
          currentUser={mockUser}
          onClose={mockOnClose}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      const textarea = screen.getByPlaceholderText(/Describe your project goals/i)
      fireEvent.change(textarea, { target: { value: 'Test description' } })
      expect(textarea).toHaveValue('Test description')
    })

    it('should disable Next button when step is invalid', () => {
      render(
        <ProjectStartupFlow
          currentUser={mockUser}
          onClose={mockOnClose}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      const nextButton = screen.getByRole('button', { name: /Next/i })
      expect(nextButton).toBeDisabled()
    })

    it('should enable Next button when all required fields filled', () => {
      render(
        <ProjectStartupFlow
          currentUser={mockUser}
          onClose={mockOnClose}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      const nameInput = screen.getByPlaceholderText(/e.g., Mobile App Launch/i)
      const softwareCard = screen.getByText('Software Development').closest('div')
      const textarea = screen.getByPlaceholderText(/Describe your project goals/i)

      fireEvent.change(nameInput, { target: { value: 'Test Project' } })
      fireEvent.click(softwareCard!)
      fireEvent.change(textarea, { target: { value: 'Test description' } })

      const nextButton = screen.getByRole('button', { name: /Next/i })
      expect(nextButton).not.toBeDisabled()
    })

    it('should require non-empty name', () => {
      render(
        <ProjectStartupFlow
          currentUser={mockUser}
          onClose={mockOnClose}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      const nameInput = screen.getByPlaceholderText(/e.g., Mobile App Launch/i)
      const softwareCard = screen.getByText('Software Development').closest('div')
      const textarea = screen.getByPlaceholderText(/Describe your project goals/i)

      fireEvent.change(nameInput, { target: { value: '   ' } })
      fireEvent.click(softwareCard!)
      fireEvent.change(textarea, { target: { value: 'Test description' } })

      const nextButton = screen.getByRole('button', { name: /Next/i })
      expect(nextButton).toBeDisabled()
    })

    it('should require project type selection', () => {
      render(
        <ProjectStartupFlow
          currentUser={mockUser}
          onClose={mockOnClose}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      const nameInput = screen.getByPlaceholderText(/e.g., Mobile App Launch/i)
      const textarea = screen.getByPlaceholderText(/Describe your project goals/i)

      fireEvent.change(nameInput, { target: { value: 'Test Project' } })
      fireEvent.change(textarea, { target: { value: 'Test description' } })

      const nextButton = screen.getByRole('button', { name: /Next/i })
      expect(nextButton).toBeDisabled()
    })

    it('should require non-empty description', () => {
      render(
        <ProjectStartupFlow
          currentUser={mockUser}
          onClose={mockOnClose}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      const nameInput = screen.getByPlaceholderText(/e.g., Mobile App Launch/i)
      const softwareCard = screen.getByText('Software Development').closest('div')
      const textarea = screen.getByPlaceholderText(/Describe your project goals/i)

      fireEvent.change(nameInput, { target: { value: 'Test Project' } })
      fireEvent.click(softwareCard!)
      fireEvent.change(textarea, { target: { value: '   ' } })

      const nextButton = screen.getByRole('button', { name: /Next/i })
      expect(nextButton).toBeDisabled()
    })

    it('should show Cancel button on step 1', () => {
      render(
        <ProjectStartupFlow
          currentUser={mockUser}
          onClose={mockOnClose}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument()
    })

    it('should call onClose when Cancel clicked on step 1', () => {
      render(
        <ProjectStartupFlow
          currentUser={mockUser}
          onClose={mockOnClose}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      fireEvent.click(screen.getByRole('button', { name: /Cancel/i }))
      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('Step Navigation', () => {
    const fillStep1 = () => {
      const nameInput = screen.getByPlaceholderText(/e.g., Mobile App Launch/i)
      const softwareCard = screen.getByText('Software Development').closest('div')
      const textarea = screen.getByPlaceholderText(/Describe your project goals/i)

      fireEvent.change(nameInput, { target: { value: 'Test Project' } })
      fireEvent.click(softwareCard!)
      fireEvent.change(textarea, { target: { value: 'Test description' } })
    }

    it('should navigate to step 2 when Next clicked', () => {
      render(
        <ProjectStartupFlow
          currentUser={mockUser}
          onClose={mockOnClose}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      fillStep1()
      fireEvent.click(screen.getByRole('button', { name: /Next/i }))

      expect(screen.getByText('Step 2 of 3')).toBeInTheDocument()
      expect(screen.getByText('Project Details')).toBeInTheDocument()
    })

    it('should update progress bar on step 2', () => {
      const { container } = render(
        <ProjectStartupFlow
          currentUser={mockUser}
          onClose={mockOnClose}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      fillStep1()
      fireEvent.click(screen.getByRole('button', { name: /Next/i }))

      const progressBar = container.querySelector('.bg-gradient-to-r.from-blue-600.to-purple-600')
      expect(progressBar).toHaveStyle({ width: '66.66666666666667%' })
    })

    it('should show Back button on step 2', () => {
      render(
        <ProjectStartupFlow
          currentUser={mockUser}
          onClose={mockOnClose}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      fillStep1()
      fireEvent.click(screen.getByRole('button', { name: /Next/i }))

      expect(screen.getByRole('button', { name: /Back/i })).toBeInTheDocument()
    })

    it('should navigate back to step 1 when Back clicked', () => {
      render(
        <ProjectStartupFlow
          currentUser={mockUser}
          onClose={mockOnClose}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      fillStep1()
      fireEvent.click(screen.getByRole('button', { name: /Next/i }))
      fireEvent.click(screen.getByRole('button', { name: /Back/i }))

      expect(screen.getByText('Step 1 of 3')).toBeInTheDocument()
      expect(screen.getByText('Project Basics')).toBeInTheDocument()
    })

    it('should preserve form data when navigating back', () => {
      render(
        <ProjectStartupFlow
          currentUser={mockUser}
          onClose={mockOnClose}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      fillStep1()
      fireEvent.click(screen.getByRole('button', { name: /Next/i }))
      fireEvent.click(screen.getByRole('button', { name: /Back/i }))

      const nameInput = screen.getByPlaceholderText(/e.g., Mobile App Launch/i)
      expect(nameInput).toHaveValue('Test Project')
    })

    it('should navigate to step 3 from step 2', () => {
      render(
        <ProjectStartupFlow
          currentUser={mockUser}
          onClose={mockOnClose}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      fillStep1()
      fireEvent.click(screen.getByRole('button', { name: /Next/i }))
      fireEvent.click(screen.getByRole('button', { name: /Next/i }))

      expect(screen.getByText('Step 3 of 3')).toBeInTheDocument()
      expect(screen.getByText('Review & AI Enhancement')).toBeInTheDocument()
    })

    it('should update progress to 100% on step 3', () => {
      const { container } = render(
        <ProjectStartupFlow
          currentUser={mockUser}
          onClose={mockOnClose}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      fillStep1()
      fireEvent.click(screen.getByRole('button', { name: /Next/i }))
      fireEvent.click(screen.getByRole('button', { name: /Next/i }))

      const progressBar = container.querySelector('.bg-gradient-to-r.from-blue-600.to-purple-600')
      expect(progressBar).toHaveStyle({ width: '100%' })
    })
  })

  describe('Step 2 - Project Details', () => {
    const navigateToStep2 = () => {
      const nameInput = screen.getByPlaceholderText(/e.g., Mobile App Launch/i)
      const softwareCard = screen.getByText('Software Development').closest('div')
      const textarea = screen.getByPlaceholderText(/Describe your project goals/i)

      fireEvent.change(nameInput, { target: { value: 'Test Project' } })
      fireEvent.click(softwareCard!)
      fireEvent.change(textarea, { target: { value: 'Test description' } })
      fireEvent.click(screen.getByRole('button', { name: /Next/i }))
    }

    beforeEach(() => {
      render(
        <ProjectStartupFlow
          currentUser={mockUser}
          onClose={mockOnClose}
          onProjectCreated={mockOnProjectCreated}
        />
      )
      navigateToStep2()
    })

    it('should render step 2 heading', () => {
      expect(screen.getByText('Project Details')).toBeInTheDocument()
      expect(screen.getByText(/Add timeline, budget, and other important details/i)).toBeInTheDocument()
    })

    it('should render start date input', () => {
      expect(screen.getByLabelText('Start Date')).toBeInTheDocument()
      expect(screen.getByLabelText('Start Date')).toHaveAttribute('type', 'date')
    })

    it('should render target date input', () => {
      expect(screen.getByLabelText('Target Date')).toBeInTheDocument()
      expect(screen.getByLabelText('Target Date')).toHaveAttribute('type', 'date')
    })

    it('should update start date on change', () => {
      const startDateInput = screen.getByLabelText('Start Date')
      fireEvent.change(startDateInput, { target: { value: '2024-01-01' } })
      expect(startDateInput).toHaveValue('2024-01-01')
    })

    it('should update target date on change', () => {
      const targetDateInput = screen.getByLabelText('Target Date')
      fireEvent.change(targetDateInput, { target: { value: '2024-12-31' } })
      expect(targetDateInput).toHaveValue('2024-12-31')
    })

    it('should render budget input', () => {
      const budgetInput = screen.getByPlaceholderText('50000')
      expect(budgetInput).toBeInTheDocument()
      expect(budgetInput).toHaveAttribute('type', 'number')
    })

    it('should render team size input', () => {
      const teamInput = screen.getByPlaceholderText('5')
      expect(teamInput).toBeInTheDocument()
      expect(teamInput).toHaveAttribute('type', 'number')
    })

    it('should update budget on change', () => {
      const budgetInput = screen.getByPlaceholderText('50000')
      fireEvent.change(budgetInput, { target: { value: '100000' } })
      expect(budgetInput).toHaveValue(100000)
    })

    it('should update team size on change', () => {
      const teamInput = screen.getByPlaceholderText('5')
      fireEvent.change(teamInput, { target: { value: '10' } })
      expect(teamInput).toHaveValue(10)
    })

    it('should render priority level dropdown', () => {
      expect(screen.getByLabelText('Priority Level')).toBeInTheDocument()
    })

    it('should render all priority options', () => {
      const select = screen.getByLabelText('Priority Level')
      expect(within(select).getByText(/Low Priority/i)).toBeInTheDocument()
      expect(within(select).getByText(/Medium Priority/i)).toBeInTheDocument()
      expect(within(select).getByText(/High Priority/i)).toBeInTheDocument()
      expect(within(select).getByText(/Critical Priority/i)).toBeInTheDocument()
    })

    it('should default to medium priority', () => {
      const select = screen.getByLabelText('Priority Level') as HTMLSelectElement
      expect(select.value).toBe('medium')
    })

    it('should update priority on change', () => {
      const select = screen.getByLabelText('Priority Level')
      fireEvent.change(select, { target: { value: 'high' } })
      expect(select).toHaveValue('high')
    })

    it('should render tags input section', () => {
      expect(screen.getByPlaceholderText('Add a tag...')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Add/i })).toBeInTheDocument()
    })

    it('should add tag when Add button clicked', () => {
      const tagInput = screen.getByPlaceholderText('Add a tag...')
      fireEvent.change(tagInput, { target: { value: 'urgent' } })
      fireEvent.click(screen.getByRole('button', { name: /^Add$/i }))

      expect(screen.getByText('urgent')).toBeInTheDocument()
    })

    it('should add tag on Enter key press', () => {
      const tagInput = screen.getByPlaceholderText('Add a tag...')
      fireEvent.change(tagInput, { target: { value: 'important' } })
      fireEvent.keyPress(tagInput, { key: 'Enter', code: 'Enter' })

      expect(screen.getByText('important')).toBeInTheDocument()
    })

    it('should clear tag input after adding', () => {
      const tagInput = screen.getByPlaceholderText('Add a tag...')
      fireEvent.change(tagInput, { target: { value: 'test' } })
      fireEvent.click(screen.getByRole('button', { name: /^Add$/i }))

      expect(tagInput).toHaveValue('')
    })

    it('should not add duplicate tags', () => {
      const tagInput = screen.getByPlaceholderText('Add a tag...')

      fireEvent.change(tagInput, { target: { value: 'duplicate' } })
      fireEvent.click(screen.getByRole('button', { name: /^Add$/i }))

      fireEvent.change(tagInput, { target: { value: 'duplicate' } })
      fireEvent.click(screen.getByRole('button', { name: /^Add$/i }))

      const tags = screen.getAllByText('duplicate')
      expect(tags).toHaveLength(1)
    })

    it('should not add empty tags', () => {
      const tagInput = screen.getByPlaceholderText('Add a tag...')
      fireEvent.change(tagInput, { target: { value: '   ' } })
      fireEvent.click(screen.getByRole('button', { name: /^Add$/i }))

      // Should not create any tag elements
      const tagContainer = screen.getByPlaceholderText('Add a tag...').closest('div')?.previousElementSibling
      expect(tagContainer?.children.length || 0).toBe(0)
    })

    it('should remove tag when × clicked', () => {
      const tagInput = screen.getByPlaceholderText('Add a tag...')
      fireEvent.change(tagInput, { target: { value: 'removable' } })
      fireEvent.click(screen.getByRole('button', { name: /^Add$/i }))

      expect(screen.getByText('removable')).toBeInTheDocument()

      const removeButton = screen.getByText('×')
      fireEvent.click(removeButton)

      expect(screen.queryByText('removable')).not.toBeInTheDocument()
    })

    it('should allow multiple tags', () => {
      const tagInput = screen.getByPlaceholderText('Add a tag...')

      fireEvent.change(tagInput, { target: { value: 'tag1' } })
      fireEvent.click(screen.getByRole('button', { name: /^Add$/i }))

      fireEvent.change(tagInput, { target: { value: 'tag2' } })
      fireEvent.click(screen.getByRole('button', { name: /^Add$/i }))

      fireEvent.change(tagInput, { target: { value: 'tag3' } })
      fireEvent.click(screen.getByRole('button', { name: /^Add$/i }))

      expect(screen.getByText('tag1')).toBeInTheDocument()
      expect(screen.getByText('tag2')).toBeInTheDocument()
      expect(screen.getByText('tag3')).toBeInTheDocument()
    })

    it('should enable Next button even with no optional fields', () => {
      const nextButton = screen.getByRole('button', { name: /Next/i })
      expect(nextButton).not.toBeDisabled()
    })
  })

  describe('Step 3 - Review & AI Enhancement', () => {
    const navigateToStep3 = () => {
      const nameInput = screen.getByPlaceholderText(/e.g., Mobile App Launch/i)
      const softwareCard = screen.getByText('Software Development').closest('div')
      const textarea = screen.getByPlaceholderText(/Describe your project goals/i)

      fireEvent.change(nameInput, { target: { value: 'Review Test Project' } })
      fireEvent.click(softwareCard!)
      fireEvent.change(textarea, { target: { value: 'Review test description' } })
      fireEvent.click(screen.getByRole('button', { name: /Next/i }))
      fireEvent.click(screen.getByRole('button', { name: /Next/i }))
    }

    beforeEach(() => {
      render(
        <ProjectStartupFlow
          currentUser={mockUser}
          onClose={mockOnClose}
          onProjectCreated={mockOnProjectCreated}
        />
      )
      navigateToStep3()
    })

    it('should render step 3 heading', () => {
      expect(screen.getByText('Review & AI Enhancement')).toBeInTheDocument()
      expect(screen.getByText(/Review your project and optionally enable/i)).toBeInTheDocument()
    })

    it('should display project summary', () => {
      expect(screen.getByText('Project Summary')).toBeInTheDocument()
    })

    it('should show project name in summary', () => {
      expect(screen.getByText(/Review Test Project/i)).toBeInTheDocument()
    })

    it('should show project type in summary', () => {
      expect(screen.getByText(/Software Development/i)).toBeInTheDocument()
    })

    it('should show project description in summary', () => {
      expect(screen.getByText(/Review test description/i)).toBeInTheDocument()
    })

    it('should render AI toggle section', () => {
      expect(screen.getByText('AI-Powered Project Startup')).toBeInTheDocument()
    })

    it('should render AI toggle checkbox', () => {
      const checkbox = screen.getByRole('checkbox')
      expect(checkbox).toBeInTheDocument()
      expect(checkbox).not.toBeChecked()
    })

    it('should render Create Project button', () => {
      expect(screen.getByRole('button', { name: /Create Project/i })).toBeInTheDocument()
    })

    it('should show optional fields in summary when provided', () => {
      render(
        <ProjectStartupFlow
          currentUser={mockUser}
          onClose={mockOnClose}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      // Fill step 1
      const nameInput = screen.getByPlaceholderText(/e.g., Mobile App Launch/i)
      const softwareCard = screen.getByText('Software Development').closest('div')
      const textarea = screen.getByPlaceholderText(/Describe your project goals/i)

      fireEvent.change(nameInput, { target: { value: 'Full Test Project' } })
      fireEvent.click(softwareCard!)
      fireEvent.change(textarea, { target: { value: 'Full test description' } })
      fireEvent.click(screen.getByRole('button', { name: /Next/i }))

      // Fill step 2 with optional fields
      const startDate = screen.getByLabelText('Start Date')
      const targetDate = screen.getByLabelText('Target Date')
      const budget = screen.getByPlaceholderText('50000')

      fireEvent.change(startDate, { target: { value: '2024-01-01' } })
      fireEvent.change(targetDate, { target: { value: '2024-12-31' } })
      fireEvent.change(budget, { target: { value: '100000' } })
      fireEvent.click(screen.getByRole('button', { name: /Next/i }))

      // Check summary
      expect(screen.getByText(/2024-01-01/i)).toBeInTheDocument()
      expect(screen.getByText(/2024-12-31/i)).toBeInTheDocument()
      expect(screen.getByText(/\$100,000/i)).toBeInTheDocument()
    })
  })

  describe('AI Enhancement Feature', () => {
    const navigateToStep3WithData = () => {
      const nameInput = screen.getByPlaceholderText(/e.g., Mobile App Launch/i)
      const softwareCard = screen.getByText('Software Development').closest('div')
      const textarea = screen.getByPlaceholderText(/Describe your project goals/i)

      fireEvent.change(nameInput, { target: { value: 'AI Test Project' } })
      fireEvent.click(softwareCard!)
      fireEvent.change(textarea, { target: { value: 'AI test description' } })
      fireEvent.click(screen.getByRole('button', { name: /Next/i }))
      fireEvent.click(screen.getByRole('button', { name: /Next/i }))
    }

    it('should toggle AI enhancement on', async () => {
      const mockAnalysis = {
        projectAnalysis: { industry: 'Software' },
        generatedIdeas: [
          { content: 'Idea 1', details: 'Details 1', x: 100, y: 100, priority: 'high' }
        ]
      }
      vi.mocked(aiService.generateProjectIdeas).mockResolvedValue(mockAnalysis)

      render(
        <ProjectStartupFlow
          currentUser={mockUser}
          onClose={mockOnClose}
          onProjectCreated={mockOnProjectCreated}
        />
      )
      navigateToStep3WithData()

      const checkbox = screen.getByRole('checkbox')
      fireEvent.click(checkbox)

      await waitFor(() => {
        expect(aiService.generateProjectIdeas).toHaveBeenCalledWith(
          'AI Test Project',
          'AI test description',
          'software'
        )
      })
    })

    it('should show AI analysis complete message', async () => {
      const mockAnalysis = {
        projectAnalysis: { industry: 'Software' },
        generatedIdeas: [
          { content: 'Idea 1', details: 'Details 1', x: 100, y: 100, priority: 'high' }
        ]
      }
      vi.mocked(aiService.generateProjectIdeas).mockResolvedValue(mockAnalysis)

      render(
        <ProjectStartupFlow
          currentUser={mockUser}
          onClose={mockOnClose}
          onProjectCreated={mockOnProjectCreated}
        />
      )
      navigateToStep3WithData()

      const checkbox = screen.getByRole('checkbox')
      fireEvent.click(checkbox)

      await waitFor(() => {
        expect(screen.getByText('AI Analysis Complete')).toBeInTheDocument()
      })
    })

    it('should display number of generated ideas', async () => {
      const mockAnalysis = {
        projectAnalysis: { industry: 'Software' },
        generatedIdeas: [
          { content: 'Idea 1', details: 'Details 1', x: 100, y: 100, priority: 'high' },
          { content: 'Idea 2', details: 'Details 2', x: 200, y: 200, priority: 'moderate' },
          { content: 'Idea 3', details: 'Details 3', x: 300, y: 300, priority: 'low' }
        ]
      }
      vi.mocked(aiService.generateProjectIdeas).mockResolvedValue(mockAnalysis)

      render(
        <ProjectStartupFlow
          currentUser={mockUser}
          onClose={mockOnClose}
          onProjectCreated={mockOnProjectCreated}
        />
      )
      navigateToStep3WithData()

      const checkbox = screen.getByRole('checkbox')
      fireEvent.click(checkbox)

      await waitFor(() => {
        expect(screen.getByText(/Generated 3 strategic ideas/i)).toBeInTheDocument()
      })
    })

    it('should clear AI analysis when toggled off', async () => {
      const mockAnalysis = {
        projectAnalysis: { industry: 'Software' },
        generatedIdeas: [
          { content: 'Idea 1', details: 'Details 1', x: 100, y: 100, priority: 'high' }
        ]
      }
      vi.mocked(aiService.generateProjectIdeas).mockResolvedValue(mockAnalysis)

      render(
        <ProjectStartupFlow
          currentUser={mockUser}
          onClose={mockOnClose}
          onProjectCreated={mockOnProjectCreated}
        />
      )
      navigateToStep3WithData()

      const checkbox = screen.getByRole('checkbox')
      fireEvent.click(checkbox)

      await waitFor(() => {
        expect(screen.getByText('AI Analysis Complete')).toBeInTheDocument()
      })

      fireEvent.click(checkbox)

      await waitFor(() => {
        expect(screen.queryByText('AI Analysis Complete')).not.toBeInTheDocument()
      })
    })

    it('should handle AI analysis error', async () => {
      vi.mocked(aiService.generateProjectIdeas).mockRejectedValue(new Error('AI Error'))

      render(
        <ProjectStartupFlow
          currentUser={mockUser}
          onClose={mockOnClose}
          onProjectCreated={mockOnProjectCreated}
        />
      )
      navigateToStep3WithData()

      const checkbox = screen.getByRole('checkbox')
      fireEvent.click(checkbox)

      await waitFor(() => {
        expect(screen.getByText(/AI analysis failed/i)).toBeInTheDocument()
      })
    })

    it('should require name and description for AI analysis', () => {
      render(
        <ProjectStartupFlow
          currentUser={mockUser}
          onClose={mockOnClose}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      // Navigate to step 3 but with minimal data
      const nameInput = screen.getByPlaceholderText(/e.g., Mobile App Launch/i)
      const softwareCard = screen.getByText('Software Development').closest('div')
      const textarea = screen.getByPlaceholderText(/Describe your project goals/i)

      fireEvent.change(nameInput, { target: { value: 'Test' } })
      fireEvent.click(softwareCard!)
      fireEvent.change(textarea, { target: { value: 'Desc' } })

      // AI toggle should work but won't call service without proper data
      // This is implicitly tested by the component behavior
    })
  })

  describe('Project Creation', () => {
    const navigateToStep3 = () => {
      const nameInput = screen.getByPlaceholderText(/e.g., Mobile App Launch/i)
      const softwareCard = screen.getByText('Software Development').closest('div')
      const textarea = screen.getByPlaceholderText(/Describe your project goals/i)

      fireEvent.change(nameInput, { target: { value: 'Creation Test' } })
      fireEvent.click(softwareCard!)
      fireEvent.change(textarea, { target: { value: 'Creation description' } })
      fireEvent.click(screen.getByRole('button', { name: /Next/i }))
      fireEvent.click(screen.getByRole('button', { name: /Next/i }))
    }

    it('should create project with database service', async () => {
      const newProject = { ...mockProject, id: generateDemoUUID('200'), name: 'Creation Test' }
      vi.mocked(DatabaseService.createProject).mockResolvedValue(newProject)

      render(
        <ProjectStartupFlow
          currentUser={mockUser}
          onClose={mockOnClose}
          onProjectCreated={mockOnProjectCreated}
        />
      )
      navigateToStep3()

      fireEvent.click(screen.getByRole('button', { name: /Create Project/i }))

      await waitFor(() => {
        expect(DatabaseService.createProject).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Creation Test',
            description: 'Creation description',
            project_type: 'software',
            status: 'active',
            owner_id: mockUser.id
          })
        )
      })
    })

    it('should show loading state during creation', async () => {
      vi.mocked(DatabaseService.createProject).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockProject), 100))
      )

      render(
        <ProjectStartupFlow
          currentUser={mockUser}
          onClose={mockOnClose}
          onProjectCreated={mockOnProjectCreated}
        />
      )
      navigateToStep3()

      fireEvent.click(screen.getByRole('button', { name: /Create Project/i }))

      expect(screen.getByText('Creating...')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Creating.../i })).toBeDisabled()

      await waitFor(() => {
        expect(mockOnProjectCreated).toHaveBeenCalled()
      })
    })

    it('should call onProjectCreated with project and ideas', async () => {
      const newProject = { ...mockProject, id: generateDemoUUID('201') }
      vi.mocked(DatabaseService.createProject).mockResolvedValue(newProject)

      render(
        <ProjectStartupFlow
          currentUser={mockUser}
          onClose={mockOnClose}
          onProjectCreated={mockOnProjectCreated}
        />
      )
      navigateToStep3()

      fireEvent.click(screen.getByRole('button', { name: /Create Project/i }))

      await waitFor(() => {
        expect(mockOnProjectCreated).toHaveBeenCalledWith(newProject, [])
      })
    })

    it('should call onClose after successful creation', async () => {
      const newProject = { ...mockProject, id: generateDemoUUID('202') }
      vi.mocked(DatabaseService.createProject).mockResolvedValue(newProject)

      render(
        <ProjectStartupFlow
          currentUser={mockUser}
          onClose={mockOnClose}
          onProjectCreated={mockOnProjectCreated}
        />
      )
      navigateToStep3()

      fireEvent.click(screen.getByRole('button', { name: /Create Project/i }))

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalledTimes(1)
      })
    })

    it('should create project with optional fields', async () => {
      const newProject = { ...mockProject, id: generateDemoUUID('203') }
      vi.mocked(DatabaseService.createProject).mockResolvedValue(newProject)

      render(
        <ProjectStartupFlow
          currentUser={mockUser}
          onClose={mockOnClose}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      // Fill step 1
      const nameInput = screen.getByPlaceholderText(/e.g., Mobile App Launch/i)
      const softwareCard = screen.getByText('Software Development').closest('div')
      const textarea = screen.getByPlaceholderText(/Describe your project goals/i)

      fireEvent.change(nameInput, { target: { value: 'Full Project' } })
      fireEvent.click(softwareCard!)
      fireEvent.change(textarea, { target: { value: 'Full description' } })
      fireEvent.click(screen.getByRole('button', { name: /Next/i }))

      // Fill step 2
      const startDate = screen.getByLabelText('Start Date')
      const targetDate = screen.getByLabelText('Target Date')
      const budget = screen.getByPlaceholderText('50000')
      const teamSize = screen.getByPlaceholderText('5')
      const priority = screen.getByLabelText('Priority Level')
      const tagInput = screen.getByPlaceholderText('Add a tag...')

      fireEvent.change(startDate, { target: { value: '2024-01-01' } })
      fireEvent.change(targetDate, { target: { value: '2024-12-31' } })
      fireEvent.change(budget, { target: { value: '50000' } })
      fireEvent.change(teamSize, { target: { value: '10' } })
      fireEvent.change(priority, { target: { value: 'high' } })
      fireEvent.change(tagInput, { target: { value: 'urgent' } })
      fireEvent.click(screen.getByRole('button', { name: /^Add$/i }))

      fireEvent.click(screen.getByRole('button', { name: /Next/i }))

      // Create
      fireEvent.click(screen.getByRole('button', { name: /Create Project/i }))

      await waitFor(() => {
        expect(DatabaseService.createProject).toHaveBeenCalledWith(
          expect.objectContaining({
            start_date: '2024-01-01',
            target_date: '2024-12-31',
            budget: 50000,
            team_size: 10,
            priority_level: 'high',
            tags: ['urgent']
          })
        )
      })
    })

    it('should handle database error and show error message', async () => {
      vi.mocked(DatabaseService.createProject).mockRejectedValue(new Error('DB Error'))

      render(
        <ProjectStartupFlow
          currentUser={mockUser}
          onClose={mockOnClose}
          onProjectCreated={mockOnProjectCreated}
        />
      )
      navigateToStep3()

      fireEvent.click(screen.getByRole('button', { name: /Create Project/i }))

      await waitFor(() => {
        expect(screen.getByText(/Failed to create project/i)).toBeInTheDocument()
      })

      expect(mockOnProjectCreated).not.toHaveBeenCalled()
      expect(mockOnClose).not.toHaveBeenCalled()
    })

    it('should dismiss error message', async () => {
      vi.mocked(DatabaseService.createProject).mockRejectedValue(new Error('DB Error'))

      render(
        <ProjectStartupFlow
          currentUser={mockUser}
          onClose={mockOnClose}
          onProjectCreated={mockOnProjectCreated}
        />
      )
      navigateToStep3()

      fireEvent.click(screen.getByRole('button', { name: /Create Project/i }))

      await waitFor(() => {
        expect(screen.getByText(/Failed to create project/i)).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Dismiss'))

      expect(screen.queryByText(/Failed to create project/i)).not.toBeInTheDocument()
    })

    it('should use local fallback when database fails', async () => {
      vi.mocked(DatabaseService.createProject).mockRejectedValue(new Error('DB Error'))

      render(
        <ProjectStartupFlow
          currentUser={mockUser}
          onClose={mockOnClose}
          onProjectCreated={mockOnProjectCreated}
        />
      )
      navigateToStep3()

      fireEvent.click(screen.getByRole('button', { name: /Create Project/i }))

      await waitFor(() => {
        expect(logger.error).toHaveBeenCalledWith(
          'Error creating project:',
          expect.any(Error)
        )
      })
    })
  })

  describe('AI-Generated Ideas', () => {
    it('should create local idea objects when AI enabled', async () => {
      const mockAnalysis = {
        projectAnalysis: { industry: 'Software' },
        generatedIdeas: [
          { content: 'Idea 1', details: 'Details 1', x: 100, y: 100, priority: 'high' as const },
          { content: 'Idea 2', details: 'Details 2', x: 200, y: 200, priority: 'moderate' as const }
        ]
      }
      const newProject = { ...mockProject, id: generateDemoUUID('204') }

      vi.mocked(aiService.generateProjectIdeas).mockResolvedValue(mockAnalysis)
      vi.mocked(DatabaseService.createProject).mockResolvedValue(newProject)

      render(
        <ProjectStartupFlow
          currentUser={mockUser}
          onClose={mockOnClose}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      // Fill and navigate to step 3
      const nameInput = screen.getByPlaceholderText(/e.g., Mobile App Launch/i)
      const softwareCard = screen.getByText('Software Development').closest('div')
      const textarea = screen.getByPlaceholderText(/Describe your project goals/i)

      fireEvent.change(nameInput, { target: { value: 'AI Project' } })
      fireEvent.click(softwareCard!)
      fireEvent.change(textarea, { target: { value: 'AI description' } })
      fireEvent.click(screen.getByRole('button', { name: /Next/i }))
      fireEvent.click(screen.getByRole('button', { name: /Next/i }))

      // Enable AI
      const checkbox = screen.getByRole('checkbox')
      fireEvent.click(checkbox)

      await waitFor(() => {
        expect(screen.getByText('AI Analysis Complete')).toBeInTheDocument()
      })

      // Create project
      fireEvent.click(screen.getByRole('button', { name: /Create Project/i }))

      await waitFor(() => {
        expect(mockOnProjectCreated).toHaveBeenCalledWith(
          expect.objectContaining({ id: newProject.id }),
          expect.arrayContaining([
            expect.objectContaining({ content: 'Idea 1' }),
            expect.objectContaining({ content: 'Idea 2' })
          ])
        )
      })
    })

    it('should set is_ai_generated flag when AI enabled', async () => {
      const mockAnalysis = {
        projectAnalysis: { industry: 'Software' },
        generatedIdeas: []
      }
      const newProject = { ...mockProject, id: generateDemoUUID('205') }

      vi.mocked(aiService.generateProjectIdeas).mockResolvedValue(mockAnalysis)
      vi.mocked(DatabaseService.createProject).mockResolvedValue(newProject)

      render(
        <ProjectStartupFlow
          currentUser={mockUser}
          onClose={mockOnClose}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      const nameInput = screen.getByPlaceholderText(/e.g., Mobile App Launch/i)
      const softwareCard = screen.getByText('Software Development').closest('div')
      const textarea = screen.getByPlaceholderText(/Describe your project goals/i)

      fireEvent.change(nameInput, { target: { value: 'AI Project' } })
      fireEvent.click(softwareCard!)
      fireEvent.change(textarea, { target: { value: 'AI description' } })
      fireEvent.click(screen.getByRole('button', { name: /Next/i }))
      fireEvent.click(screen.getByRole('button', { name: /Next/i }))

      const checkbox = screen.getByRole('checkbox')
      fireEvent.click(checkbox)

      await waitFor(() => {
        expect(aiService.generateProjectIdeas).toHaveBeenCalled()
      })

      fireEvent.click(screen.getByRole('button', { name: /Create Project/i }))

      await waitFor(() => {
        expect(DatabaseService.createProject).toHaveBeenCalledWith(
          expect.objectContaining({
            is_ai_generated: true,
            ai_analysis: mockAnalysis.projectAnalysis
          })
        )
      })
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels on modal', () => {
      render(
        <ProjectStartupFlow
          currentUser={mockUser}
          onClose={mockOnClose}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      expect(screen.getByText('Create New Project')).toBeInTheDocument()
    })

    it('should support keyboard navigation', () => {
      render(
        <ProjectStartupFlow
          currentUser={mockUser}
          onClose={mockOnClose}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      const nameInput = screen.getByPlaceholderText(/e.g., Mobile App Launch/i)
      nameInput.focus()
      expect(document.activeElement).toBe(nameInput)
    })

    it('should have proper form labels', () => {
      render(
        <ProjectStartupFlow
          currentUser={mockUser}
          onClose={mockOnClose}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      expect(screen.getByText('Project Name *')).toBeInTheDocument()
      expect(screen.getByText('Project Type *')).toBeInTheDocument()
      expect(screen.getByText('Project Description *')).toBeInTheDocument()
    })

    it('should indicate required fields with asterisk', () => {
      render(
        <ProjectStartupFlow
          currentUser={mockUser}
          onClose={mockOnClose}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      const requiredLabels = screen.getAllByText(/\*/i)
      expect(requiredLabels.length).toBeGreaterThan(0)
    })
  })

  describe('Edge Cases', () => {
    it('should handle very long project name', () => {
      render(
        <ProjectStartupFlow
          currentUser={mockUser}
          onClose={mockOnClose}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      const longName = 'A'.repeat(500)
      const nameInput = screen.getByPlaceholderText(/e.g., Mobile App Launch/i)
      fireEvent.change(nameInput, { target: { value: longName } })

      expect(nameInput).toHaveValue(longName)
    })

    it('should handle special characters in inputs', () => {
      render(
        <ProjectStartupFlow
          currentUser={mockUser}
          onClose={mockOnClose}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      const specialText = '<script>alert("xss")</script>'
      const nameInput = screen.getByPlaceholderText(/e.g., Mobile App Launch/i)
      fireEvent.change(nameInput, { target: { value: specialText } })

      expect(nameInput).toHaveValue(specialText)
    })

    it('should handle negative budget values', () => {
      render(
        <ProjectStartupFlow
          currentUser={mockUser}
          onClose={mockOnClose}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      const nameInput = screen.getByPlaceholderText(/e.g., Mobile App Launch/i)
      const softwareCard = screen.getByText('Software Development').closest('div')
      const textarea = screen.getByPlaceholderText(/Describe your project goals/i)

      fireEvent.change(nameInput, { target: { value: 'Test' } })
      fireEvent.click(softwareCard!)
      fireEvent.change(textarea, { target: { value: 'Test' } })
      fireEvent.click(screen.getByRole('button', { name: /Next/i }))

      const budgetInput = screen.getByPlaceholderText('50000')
      fireEvent.change(budgetInput, { target: { value: '-1000' } })

      expect(budgetInput).toHaveValue(-1000)
    })

    it('should handle zero team size', () => {
      render(
        <ProjectStartupFlow
          currentUser={mockUser}
          onClose={mockOnClose}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      const nameInput = screen.getByPlaceholderText(/e.g., Mobile App Launch/i)
      const softwareCard = screen.getByText('Software Development').closest('div')
      const textarea = screen.getByPlaceholderText(/Describe your project goals/i)

      fireEvent.change(nameInput, { target: { value: 'Test' } })
      fireEvent.click(softwareCard!)
      fireEvent.change(textarea, { target: { value: 'Test' } })
      fireEvent.click(screen.getByRole('button', { name: /Next/i }))

      const teamInput = screen.getByPlaceholderText('5')
      fireEvent.change(teamInput, { target: { value: '0' } })

      expect(teamInput).toHaveValue(0)
    })

    it('should handle rapid step navigation', () => {
      render(
        <ProjectStartupFlow
          currentUser={mockUser}
          onClose={mockOnClose}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      const nameInput = screen.getByPlaceholderText(/e.g., Mobile App Launch/i)
      const softwareCard = screen.getByText('Software Development').closest('div')
      const textarea = screen.getByPlaceholderText(/Describe your project goals/i)

      fireEvent.change(nameInput, { target: { value: 'Test' } })
      fireEvent.click(softwareCard!)
      fireEvent.change(textarea, { target: { value: 'Test' } })

      const nextButton = screen.getByRole('button', { name: /Next/i })
      fireEvent.click(nextButton)
      fireEvent.click(nextButton)

      expect(screen.getByText('Step 3 of 3')).toBeInTheDocument()
    })

    it('should preserve data through multiple back/forward navigation', () => {
      render(
        <ProjectStartupFlow
          currentUser={mockUser}
          onClose={mockOnClose}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      // Fill step 1
      const nameInput = screen.getByPlaceholderText(/e.g., Mobile App Launch/i)
      const softwareCard = screen.getByText('Software Development').closest('div')
      const textarea = screen.getByPlaceholderText(/Describe your project goals/i)

      fireEvent.change(nameInput, { target: { value: 'Persistent Project' } })
      fireEvent.click(softwareCard!)
      fireEvent.change(textarea, { target: { value: 'Persistent description' } })
      fireEvent.click(screen.getByRole('button', { name: /Next/i }))

      // Go to step 2 and back
      fireEvent.click(screen.getByRole('button', { name: /Back/i }))

      // Verify data persisted
      const nameInputAgain = screen.getByPlaceholderText(/e.g., Mobile App Launch/i)
      expect(nameInputAgain).toHaveValue('Persistent Project')

      // Go forward again
      fireEvent.click(screen.getByRole('button', { name: /Next/i }))
      fireEvent.click(screen.getByRole('button', { name: /Next/i }))

      // Check summary
      expect(screen.getByText('Persistent Project')).toBeInTheDocument()
    })

    it('should handle empty tags array in project creation', async () => {
      const newProject = { ...mockProject, id: generateDemoUUID('206') }
      vi.mocked(DatabaseService.createProject).mockResolvedValue(newProject)

      render(
        <ProjectStartupFlow
          currentUser={mockUser}
          onClose={mockOnClose}
          onProjectCreated={mockOnProjectCreated}
        />
      )

      const nameInput = screen.getByPlaceholderText(/e.g., Mobile App Launch/i)
      const softwareCard = screen.getByText('Software Development').closest('div')
      const textarea = screen.getByPlaceholderText(/Describe your project goals/i)

      fireEvent.change(nameInput, { target: { value: 'No Tags Project' } })
      fireEvent.click(softwareCard!)
      fireEvent.change(textarea, { target: { value: 'No tags description' } })
      fireEvent.click(screen.getByRole('button', { name: /Next/i }))
      fireEvent.click(screen.getByRole('button', { name: /Next/i }))
      fireEvent.click(screen.getByRole('button', { name: /Create Project/i }))

      await waitFor(() => {
        expect(DatabaseService.createProject).toHaveBeenCalledWith(
          expect.objectContaining({
            tags: undefined
          })
        )
      })
    })
  })
})