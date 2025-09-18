import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AIStarterModal from '../AIStarterModal'
import { aiService } from '../../lib/aiService'
import { DatabaseService } from '../../lib/database'

// Mock dependencies
vi.mock('../../lib/aiService', () => ({
  aiService: {
    generateProjectIdeas: vi.fn()
  }
}))

vi.mock('../../lib/database', () => ({
  DatabaseService: {
    createProject: vi.fn(),
    createIdea: vi.fn()
  }
}))

vi.mock('../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn()
  }
}))

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User'
}

const defaultProps = {
  currentUser: mockUser,
  onClose: vi.fn(),
  onProjectCreated: vi.fn()
}

const mockAnalysisResult = [
  {
    content: 'User authentication system',
    details: 'Implement secure login with email/password',
    x: 150,
    y: 200,
    priority: 'high' as const,
    reasoning: 'Critical for user security'
  },
  {
    content: 'Dashboard analytics',
    details: 'Create user activity dashboard',
    x: 300,
    y: 400,
    priority: 'medium' as const,
    reasoning: 'Valuable for user insights'
  }
]

const mockProject = {
  id: 'project-1',
  name: 'Test Project',
  description: 'Test project description',
  project_type: 'software',
  status: 'active',
  priority_level: 'medium',
  visibility: 'private',
  owner_id: 'user-1'
}

const mockCreatedIdea = {
  success: true,
  data: {
    id: 'idea-1',
    content: 'Test idea',
    details: 'Test details',
    x: 150,
    y: 200,
    priority: 'high',
    created_by: 'user-1',
    is_collapsed: true,
    project_id: 'project-1'
  }
}

describe('AIStarterModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Setup default successful mocks
    vi.mocked(aiService.generateProjectIdeas).mockResolvedValue(mockAnalysisResult)
    vi.mocked(DatabaseService.createProject).mockResolvedValue(mockProject)
    vi.mocked(DatabaseService.createIdea).mockResolvedValue(mockCreatedIdea)
  })

  describe('Rendering and Initial State', () => {
    it('should render the modal with correct title', () => {
      render(<AIStarterModal {...defaultProps} />)
      expect(screen.getByRole('heading', { level: 2, name: 'AI Project Starter' })).toBeInTheDocument()
    })

    it('should show initial step with all required form fields', () => {
      render(<AIStarterModal {...defaultProps} />)

      expect(screen.getByLabelText(/Project Name/)).toBeInTheDocument()
      expect(screen.getByLabelText(/Project Description/)).toBeInTheDocument()
      expect(screen.getByLabelText(/Project Type/)).toBeInTheDocument()
      expect(screen.getByLabelText(/Industry/)).toBeInTheDocument()
    })

    it('should show sliders for idea count and tolerance', () => {
      render(<AIStarterModal {...defaultProps} />)

      expect(screen.getByLabelText(/Number of Ideas:/)).toBeInTheDocument()
      expect(screen.getByLabelText(/Idea Tolerance:/)).toBeInTheDocument()
    })

    it('should have Start AI Analysis button disabled initially', () => {
      render(<AIStarterModal {...defaultProps} />)

      const startButton = screen.getByRole('button', { name: /Start AI Analysis/ })
      expect(startButton).toBeDisabled()
    })

    it('should show how it works explanation', () => {
      render(<AIStarterModal {...defaultProps} />)

      expect(screen.getByText('How it works')).toBeInTheDocument()
      expect(screen.getByText(/AI will analyze your project and generate/)).toBeInTheDocument()
    })

    it('should show close button', () => {
      render(<AIStarterModal {...defaultProps} />)

      const closeButton = screen.getByRole('button', { name: '' }) // X button has no text
      expect(closeButton).toBeInTheDocument()
    })

    it('should show cancel button', () => {
      render(<AIStarterModal {...defaultProps} />)

      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    })

    it('should display default values correctly', () => {
      render(<AIStarterModal {...defaultProps} />)

      expect(screen.getByDisplayValue('🤖 Let AI recommend')).toBeInTheDocument()
      expect(screen.getByText('8')).toBeInTheDocument() // Default idea count
      expect(screen.getByText('50%')).toBeInTheDocument() // Default tolerance
    })
  })

  describe('Form Interactions and Validation', () => {
    it('should enable Start AI Analysis button when name and description are filled', async () => {
      const user = userEvent.setup()
      render(<AIStarterModal {...defaultProps} />)

      const nameInput = screen.getByLabelText('Project Name')
      const descInput = screen.getByLabelText('Project Description')
      const startButton = screen.getByRole('button', { name: /Start AI Analysis/ })

      expect(startButton).toBeDisabled()

      await user.type(nameInput, 'Test Project')
      await user.type(descInput, 'Test description')

      expect(startButton).toBeEnabled()
    })

    it('should update project name input', async () => {
      const user = userEvent.setup()
      render(<AIStarterModal {...defaultProps} />)

      const nameInput = screen.getByLabelText('Project Name')
      await user.type(nameInput, 'My New Project')

      expect(nameInput).toHaveValue('My New Project')
    })

    it('should update project description textarea', async () => {
      const user = userEvent.setup()
      render(<AIStarterModal {...defaultProps} />)

      const descInput = screen.getByLabelText('Project Description')
      await user.type(descInput, 'Detailed project description')

      expect(descInput).toHaveValue('Detailed project description')
    })

    it('should change project type selection', async () => {
      const user = userEvent.setup()
      render(<AIStarterModal {...defaultProps} />)

      const typeSelect = screen.getByLabelText('Project Type')
      await user.selectOptions(typeSelect, 'software')

      expect(typeSelect).toHaveValue('software')
    })

    it('should change industry selection', async () => {
      const user = userEvent.setup()
      render(<AIStarterModal {...defaultProps} />)

      const industrySelect = screen.getByLabelText('Industry')
      await user.selectOptions(industrySelect, 'Technology')

      expect(industrySelect).toHaveValue('Technology')
    })

    it('should update idea count slider', async () => {
      const user = userEvent.setup()
      render(<AIStarterModal {...defaultProps} />)

      const slider = screen.getByLabelText(/Number of Ideas:/)
      await user.clear(slider)
      await user.type(slider, '10')

      expect(screen.getByText('10')).toBeInTheDocument()
    })

    it('should update idea tolerance slider', async () => {
      const user = userEvent.setup()
      render(<AIStarterModal {...defaultProps} />)

      const toleranceSlider = screen.getByLabelText(/Idea Tolerance:/)
      fireEvent.change(toleranceSlider, { target: { value: '75' } })

      expect(screen.getByText('75%')).toBeInTheDocument()
    })

    it('should show placeholder text in inputs', () => {
      render(<AIStarterModal {...defaultProps} />)

      expect(screen.getByPlaceholderText(/e.g., Mobile App Launch/)).toBeInTheDocument()
      expect(screen.getByPlaceholderText(/Describe your project goals/)).toBeInTheDocument()
    })

    it('should respect input constraints for sliders', async () => {
      const user = userEvent.setup()
      render(<AIStarterModal {...defaultProps} />)

      const ideaSlider = screen.getByLabelText(/Number of Ideas:/)

      // Test min value
      fireEvent.change(ideaSlider, { target: { value: '1' } })
      expect(ideaSlider).toHaveValue('3') // Should clamp to min

      // Test max value
      fireEvent.change(ideaSlider, { target: { value: '20' } })
      expect(ideaSlider).toHaveValue('12') // Should clamp to max
    })

    it('should maintain form state when toggling between project types', async () => {
      const user = userEvent.setup()
      render(<AIStarterModal {...defaultProps} />)

      const nameInput = screen.getByLabelText('Project Name')
      const typeSelect = screen.getByLabelText('Project Type')

      await user.type(nameInput, 'Test Project')
      await user.selectOptions(typeSelect, 'marketing')

      expect(nameInput).toHaveValue('Test Project')
      expect(typeSelect).toHaveValue('marketing')
    })

    it('should preserve slider values when changing other fields', async () => {
      const user = userEvent.setup()
      render(<AIStarterModal {...defaultProps} />)

      const toleranceSlider = screen.getByLabelText(/Idea Tolerance:/)
      const nameInput = screen.getByLabelText('Project Name')

      fireEvent.change(toleranceSlider, { target: { value: '80' } })
      await user.type(nameInput, 'Test')

      expect(screen.getByText('80%')).toBeInTheDocument()
    })
  })

  describe('Step Navigation', () => {
    it('should call onClose when close button is clicked', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()
      render(<AIStarterModal {...defaultProps} onClose={onClose} />)

      const closeButton = screen.getByRole('button', { name: '' }) // X button
      await user.click(closeButton)

      expect(onClose).toHaveBeenCalledOnce()
    })

    it('should call onClose when cancel button is clicked', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()
      render(<AIStarterModal {...defaultProps} onClose={onClose} />)

      const cancelButton = screen.getByRole('button', { name: 'Cancel' })
      await user.click(cancelButton)

      expect(onClose).toHaveBeenCalledOnce()
    })

    it('should progress to questions step when analysis requires clarification', async () => {
      const user = userEvent.setup()

      // Mock analysis that needs clarification
      vi.mocked(aiService.generateProjectIdeas).mockResolvedValue(mockAnalysisResult)

      render(<AIStarterModal {...defaultProps} />)

      const nameInput = screen.getByLabelText('Project Name')
      const descInput = screen.getByLabelText('Project Description')

      await user.type(nameInput, 'Test') // Short name to trigger questions
      await user.type(descInput, 'Short') // Short description to trigger questions

      const startButton = screen.getByRole('button', { name: /Start AI Analysis/ })
      await user.click(startButton)

      await waitFor(() => {
        expect(screen.getByText('A few questions to help me understand better')).toBeInTheDocument()
      })
    })

    it('should progress directly to review when no clarification needed', async () => {
      const user = userEvent.setup()

      render(<AIStarterModal {...defaultProps} />)

      const nameInput = screen.getByLabelText('Project Name')
      const descInput = screen.getByLabelText('Project Description')

      await user.type(nameInput, 'Comprehensive Software Development Project')
      await user.type(descInput, 'A detailed software development project with clear requirements, target audience of developers, timeline of 6 months, and specific technical goals including user authentication, dashboard analytics, and mobile responsiveness.')

      const startButton = screen.getByRole('button', { name: /Start AI Analysis/ })
      await user.click(startButton)

      await waitFor(() => {
        expect(screen.getByText('Project Analysis Complete')).toBeInTheDocument()
      })
    })

    it('should allow navigation back from questions step', async () => {
      const user = userEvent.setup()

      render(<AIStarterModal {...defaultProps} />)

      const nameInput = screen.getByLabelText('Project Name')
      const descInput = screen.getByLabelText('Project Description')

      await user.type(nameInput, 'Test')
      await user.type(descInput, 'Short')

      const startButton = screen.getByRole('button', { name: /Start AI Analysis/ })
      await user.click(startButton)

      await waitFor(() => {
        expect(screen.getByText('A few questions to help me understand better')).toBeInTheDocument()
      })

      const backButton = screen.getByRole('button', { name: 'Back' })
      await user.click(backButton)

      expect(screen.getByText('AI Project Starter')).toBeInTheDocument()
      expect(screen.getByLabelText('Project Name')).toHaveValue('Test')
    })

    it('should allow navigation back from review step', async () => {
      const user = userEvent.setup()

      render(<AIStarterModal {...defaultProps} />)

      const nameInput = screen.getByLabelText('Project Name')
      const descInput = screen.getByLabelText('Project Description')

      await user.type(nameInput, 'Comprehensive Software Development Project')
      await user.type(descInput, 'A detailed software development project with clear requirements')

      const startButton = screen.getByRole('button', { name: /Start AI Analysis/ })
      await user.click(startButton)

      await waitFor(() => {
        expect(screen.getByText('Project Analysis Complete')).toBeInTheDocument()
      })

      const backButton = screen.getByRole('button', { name: 'Back' })
      await user.click(backButton)

      expect(screen.getByLabelText('Project Name')).toHaveValue('Comprehensive Software Development Project')
    })

    it('should preserve form data across step navigation', async () => {
      const user = userEvent.setup()

      render(<AIStarterModal {...defaultProps} />)

      const nameInput = screen.getByLabelText('Project Name')
      const descInput = screen.getByLabelText('Project Description')
      const typeSelect = screen.getByLabelText('Project Type')

      await user.type(nameInput, 'Test Project')
      await user.type(descInput, 'Test description')
      await user.selectOptions(typeSelect, 'marketing')

      const startButton = screen.getByRole('button', { name: /Start AI Analysis/ })
      await user.click(startButton)

      await waitFor(() => {
        expect(screen.getByText(/Project Analysis Complete|A few questions/)).toBeInTheDocument()
      })

      const backButton = screen.getByRole('button', { name: 'Back' })
      await user.click(backButton)

      expect(screen.getByLabelText('Project Name')).toHaveValue('Test Project')
      expect(screen.getByLabelText('Project Description')).toHaveValue('Test description')
      expect(screen.getByLabelText('Project Type')).toHaveValue('marketing')
    })

    it('should maintain slider values across navigation', async () => {
      const user = userEvent.setup()

      render(<AIStarterModal {...defaultProps} />)

      const nameInput = screen.getByLabelText('Project Name')
      const descInput = screen.getByLabelText('Project Description')
      const toleranceSlider = screen.getByLabelText(/Idea Tolerance:/)

      await user.type(nameInput, 'Test Project')
      await user.type(descInput, 'Test description that is sufficiently long to avoid clarification')
      fireEvent.change(toleranceSlider, { target: { value: '75' } })

      const startButton = screen.getByRole('button', { name: /Start AI Analysis/ })
      await user.click(startButton)

      await waitFor(() => {
        expect(screen.getByText('Project Analysis Complete')).toBeInTheDocument()
      })

      const backButton = screen.getByRole('button', { name: 'Back' })
      await user.click(backButton)

      expect(screen.getByText('75%')).toBeInTheDocument()
    })
  })

  describe('AI Analysis Workflows', () => {
    it('should call AI service with correct parameters', async () => {
      const user = userEvent.setup()

      render(<AIStarterModal {...defaultProps} />)

      const nameInput = screen.getByLabelText('Project Name')
      const descInput = screen.getByLabelText('Project Description')

      await user.type(nameInput, 'Test Project')
      await user.type(descInput, 'Detailed description with clear goals and target audience')

      const startButton = screen.getByRole('button', { name: /Start AI Analysis/ })
      await user.click(startButton)

      await waitFor(() => {
        expect(vi.mocked(aiService.generateProjectIdeas)).toHaveBeenCalledWith(
          'Test Project',
          'Detailed description with clear goals and target audience',
          expect.any(String), // project type (auto-detected)
          8, // default idea count
          50 // default tolerance
        )
      })
    })

    it('should show loading state during analysis', async () => {
      const user = userEvent.setup()
      let resolvePromise: (value: any) => void
      const analysisPromise = new Promise(resolve => { resolvePromise = resolve })

      vi.mocked(aiService.generateProjectIdeas).mockReturnValue(analysisPromise)

      render(<AIStarterModal {...defaultProps} />)

      const nameInput = screen.getByLabelText('Project Name')
      const descInput = screen.getByLabelText('Project Description')

      await user.type(nameInput, 'Test Project')
      await user.type(descInput, 'Test description')

      const startButton = screen.getByRole('button', { name: /Start AI Analysis/ })
      await user.click(startButton)

      expect(screen.getByText('Analyzing...')).toBeInTheDocument()
      expect(startButton).toBeDisabled()

      resolvePromise!(mockAnalysisResult)
    })

    it('should handle AI service errors gracefully', async () => {
      const user = userEvent.setup()
      vi.mocked(aiService.generateProjectIdeas).mockRejectedValue(new Error('AI service error'))

      render(<AIStarterModal {...defaultProps} />)

      const nameInput = screen.getByLabelText('Project Name')
      const descInput = screen.getByLabelText('Project Description')

      await user.type(nameInput, 'Test Project')
      await user.type(descInput, 'Test description')

      const startButton = screen.getByRole('button', { name: /Start AI Analysis/ })
      await user.click(startButton)

      await waitFor(() => {
        expect(screen.getByText('Failed to analyze project. Please try again.')).toBeInTheDocument()
      })
    })

    it('should use manual project type when selected', async () => {
      const user = userEvent.setup()
      
      render(<AIStarterModal {...defaultProps} />)

      const nameInput = screen.getByLabelText('Project Name')
      const descInput = screen.getByLabelText('Project Description')
      const typeSelect = screen.getByLabelText('Project Type')

      await user.type(nameInput, 'Test Project')
      await user.type(descInput, 'Test description')
      await user.selectOptions(typeSelect, 'marketing')

      const startButton = screen.getByRole('button', { name: /Start AI Analysis/ })
      await user.click(startButton)

      await waitFor(() => {
        expect(vi.mocked(aiService.generateProjectIdeas)).toHaveBeenCalledWith(
          'Test Project',
          'Test description',
          'marketing', // manual selection
          8,
          50
        )
      })
    })

    it('should use custom idea count and tolerance settings', async () => {
      const user = userEvent.setup()
      
      render(<AIStarterModal {...defaultProps} />)

      const nameInput = screen.getByLabelText('Project Name')
      const descInput = screen.getByLabelText('Project Description')
      const ideaSlider = screen.getByLabelText(/Number of Ideas:/)
      const toleranceSlider = screen.getByLabelText(/Idea Tolerance:/)

      await user.type(nameInput, 'Test Project')
      await user.type(descInput, 'Test description')
      fireEvent.change(ideaSlider, { target: { value: '10' } })
      fireEvent.change(toleranceSlider, { target: { value: '75' } })

      const startButton = screen.getByRole('button', { name: /Start AI Analysis/ })
      await user.click(startButton)

      await waitFor(() => {
        expect(vi.mocked(aiService.generateProjectIdeas)).toHaveBeenCalledWith(
          'Test Project',
          'Test description',
          expect.any(String),
          10, // custom idea count
          75 // custom tolerance
        )
      })
    })

    it('should handle questions step and reanalyze with answers', async () => {
      const user = userEvent.setup()
      
      render(<AIStarterModal {...defaultProps} />)

      const nameInput = screen.getByLabelText('Project Name')
      const descInput = screen.getByLabelText('Project Description')

      await user.type(nameInput, 'Test') // Short to trigger questions
      await user.type(descInput, 'Short') // Short to trigger questions

      const startButton = screen.getByRole('button', { name: /Start AI Analysis/ })
      await user.click(startButton)

      await waitFor(() => {
        expect(screen.getByText('A few questions to help me understand better')).toBeInTheDocument()
      })

      // Answer a question
      const questionTextarea = screen.getByPlaceholderText('Your answer...')
      await user.type(questionTextarea, 'Target audience is developers')

      const generateButton = screen.getByRole('button', { name: /Generate Ideas/ })
      await user.click(generateButton)

      await waitFor(() => {
        expect(mockGenerateIdeas).toHaveBeenCalledTimes(2) // Initial + follow-up
        const lastCall = mockGenerateIdeas.mock.calls[1]
        expect(lastCall[1]).toContain('Target audience is developers') // Enhanced description
      })
    })

    it('should show loading state during question reanalysis', async () => {
      const user = userEvent.setup()
      let resolvePromise: (value: any) => void
      const analysisPromise = new Promise(resolve => { resolvePromise = resolve })

      // First call succeeds, second call is slow
      vi.mocked(aiService.generateProjectIdeas)
        .mockResolvedValueOnce(mockAnalysisResult)
        .mockReturnValueOnce(analysisPromise)

      render(<AIStarterModal {...defaultProps} />)

      const nameInput = screen.getByLabelText('Project Name')
      const descInput = screen.getByLabelText('Project Description')

      await user.type(nameInput, 'Test')
      await user.type(descInput, 'Short')

      const startButton = screen.getByRole('button', { name: /Start AI Analysis/ })
      await user.click(startButton)

      await waitFor(() => {
        expect(screen.getByText('A few questions to help me understand better')).toBeInTheDocument()
      })

      const generateButton = screen.getByRole('button', { name: /Generate Ideas/ })
      await user.click(generateButton)

      expect(screen.getByText('Generating Ideas...')).toBeInTheDocument()
      expect(generateButton).toBeDisabled()

      resolvePromise!(mockAnalysisResult)
    })

    it('should handle errors during question reanalysis', async () => {
      const user = userEvent.setup()

      // First call succeeds, second call fails
      vi.mocked(aiService.generateProjectIdeas)
        .mockResolvedValueOnce(mockAnalysisResult)
        .mockRejectedValueOnce(new Error('Reanalysis failed'))

      render(<AIStarterModal {...defaultProps} />)

      const nameInput = screen.getByLabelText('Project Name')
      const descInput = screen.getByLabelText('Project Description')

      await user.type(nameInput, 'Test')
      await user.type(descInput, 'Short')

      const startButton = screen.getByRole('button', { name: /Start AI Analysis/ })
      await user.click(startButton)

      await waitFor(() => {
        expect(screen.getByText('A few questions to help me understand better')).toBeInTheDocument()
      })

      const generateButton = screen.getByRole('button', { name: /Generate Ideas/ })
      await user.click(generateButton)

      await waitFor(() => {
        expect(screen.getByText('Failed to generate ideas. Please try again.')).toBeInTheDocument()
      })
    })

    it('should dismiss error messages', async () => {
      const user = userEvent.setup()
      vi.mocked(aiService.generateProjectIdeas).mockRejectedValue(new Error('Test error'))

      render(<AIStarterModal {...defaultProps} />)

      const nameInput = screen.getByLabelText('Project Name')
      const descInput = screen.getByLabelText('Project Description')

      await user.type(nameInput, 'Test Project')
      await user.type(descInput, 'Test description')

      const startButton = screen.getByRole('button', { name: /Start AI Analysis/ })
      await user.click(startButton)

      await waitFor(() => {
        expect(screen.getByText('Failed to analyze project. Please try again.')).toBeInTheDocument()
      })

      const dismissButton = screen.getByText('Dismiss')
      await user.click(dismissButton)

      expect(screen.queryByText('Failed to analyze project. Please try again.')).not.toBeInTheDocument()
    })
  })

  describe('Project Creation', () => {
    it('should show review step with analysis results', async () => {
      const user = userEvent.setup()

      render(<AIStarterModal {...defaultProps} />)

      const nameInput = screen.getByLabelText('Project Name')
      const descInput = screen.getByLabelText('Project Description')

      await user.type(nameInput, 'Test Project')
      await user.type(descInput, 'Detailed description that avoids clarification questions')

      const startButton = screen.getByRole('button', { name: /Start AI Analysis/ })
      await user.click(startButton)

      await waitFor(() => {
        expect(screen.getByText('Project Analysis Complete')).toBeInTheDocument()
        expect(screen.getByText('Generated Ideas (2)')).toBeInTheDocument()
        expect(screen.getByText('User authentication system')).toBeInTheDocument()
        expect(screen.getByText('Dashboard analytics')).toBeInTheDocument()
      })
    })

    it('should create project and ideas when create button is clicked', async () => {
      const user = userEvent.setup()
                  const onProjectCreated = vi.fn()

      render(<AIStarterModal {...defaultProps} onProjectCreated={onProjectCreated} />)

      const nameInput = screen.getByLabelText('Project Name')
      const descInput = screen.getByLabelText('Project Description')

      await user.type(nameInput, 'Test Project')
      await user.type(descInput, 'Test description')

      const startButton = screen.getByRole('button', { name: /Start AI Analysis/ })
      await user.click(startButton)

      await waitFor(() => {
        expect(screen.getByText('Project Analysis Complete')).toBeInTheDocument()
      })

      const createButton = screen.getByRole('button', { name: /Create Project/ })
      await user.click(createButton)

      await waitFor(() => {
        expect(vi.mocked(DatabaseService.createProject)).toHaveBeenCalledWith({
          name: 'Test Project',
          description: 'Test description',
          project_type: expect.any(String),
          status: 'active',
          priority_level: 'medium',
          visibility: 'private',
          owner_id: 'user-1',
          ai_analysis: expect.any(Object)
        })
        expect(vi.mocked(DatabaseService.createIdea)).toHaveBeenCalledTimes(2)
        expect(onProjectCreated).toHaveBeenCalledWith(mockProject, expect.any(Array))
      })
    })

    it('should show loading state during project creation', async () => {
      const user = userEvent.setup()
      let resolvePromise: (value: any) => void
      const createPromise = new Promise(resolve => { resolvePromise = resolve })

      vi.mocked(DatabaseService.createProject).mockReturnValue(createPromise)

      render(<AIStarterModal {...defaultProps} />)

      const nameInput = screen.getByLabelText('Project Name')
      const descInput = screen.getByLabelText('Project Description')

      await user.type(nameInput, 'Test Project')
      await user.type(descInput, 'Test description')

      const startButton = screen.getByRole('button', { name: /Start AI Analysis/ })
      await user.click(startButton)

      await waitFor(() => {
        expect(screen.getByText('Project Analysis Complete')).toBeInTheDocument()
      })

      const createButton = screen.getByRole('button', { name: /Create Project/ })
      await user.click(createButton)

      expect(screen.getByText('Creating...')).toBeInTheDocument()
      expect(createButton).toBeDisabled()

      resolvePromise!(mockProject)
    })

    it('should handle project creation errors', async () => {
      const user = userEvent.setup()
      vi.mocked(DatabaseService.createProject).mockRejectedValue(new Error('Creation failed'))

      render(<AIStarterModal {...defaultProps} />)

      const nameInput = screen.getByLabelText('Project Name')
      const descInput = screen.getByLabelText('Project Description')

      await user.type(nameInput, 'Test Project')
      await user.type(descInput, 'Test description')

      const startButton = screen.getByRole('button', { name: /Start AI Analysis/ })
      await user.click(startButton)

      await waitFor(() => {
        expect(screen.getByText('Project Analysis Complete')).toBeInTheDocument()
      })

      const createButton = screen.getByRole('button', { name: /Create Project/ })
      await user.click(createButton)

      await waitFor(() => {
        expect(screen.getByText('Failed to create project and ideas. Please try again.')).toBeInTheDocument()
      })
    })

    it('should disable create button when no ideas generated', async () => {
      const user = userEvent.setup()
      vi.mocked(aiService.generateProjectIdeas).mockResolvedValue([])

      render(<AIStarterModal {...defaultProps} />)

      const nameInput = screen.getByLabelText('Project Name')
      const descInput = screen.getByLabelText('Project Description')

      await user.type(nameInput, 'Test Project')
      await user.type(descInput, 'Test description')

      const startButton = screen.getByRole('button', { name: /Start AI Analysis/ })
      await user.click(startButton)

      await waitFor(() => {
        expect(screen.getByText('Project Analysis Complete')).toBeInTheDocument()
      })

      const createButton = screen.getByRole('button', { name: /Create Project & 0 Ideas/ })
      expect(createButton).toBeDisabled()
    })

    it('should close modal after successful project creation', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()

      render(<AIStarterModal {...defaultProps} onClose={onClose} />)

      const nameInput = screen.getByLabelText('Project Name')
      const descInput = screen.getByLabelText('Project Description')

      await user.type(nameInput, 'Test Project')
      await user.type(descInput, 'Test description')

      const startButton = screen.getByRole('button', { name: /Start AI Analysis/ })
      await user.click(startButton)

      await waitFor(() => {
        expect(screen.getByText('Project Analysis Complete')).toBeInTheDocument()
      })

      const createButton = screen.getByRole('button', { name: /Create Project/ })
      await user.click(createButton)

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledOnce()
      })
    })

    it('should create ideas with correct data structure', async () => {
      const user = userEvent.setup()
      
      render(<AIStarterModal {...defaultProps} />)

      const nameInput = screen.getByLabelText('Project Name')
      const descInput = screen.getByLabelText('Project Description')

      await user.type(nameInput, 'Test Project')
      await user.type(descInput, 'Test description')

      const startButton = screen.getByRole('button', { name: /Start AI Analysis/ })
      await user.click(startButton)

      await waitFor(() => {
        expect(screen.getByText('Project Analysis Complete')).toBeInTheDocument()
      })

      const createButton = screen.getByRole('button', { name: /Create Project/ })
      await user.click(createButton)

      await waitFor(() => {
        expect(vi.mocked(DatabaseService.createIdea)).toHaveBeenCalledWith({
          content: 'User authentication system',
          details: 'Implement secure login with email/password',
          x: 150,
          y: 200,
          priority: 'high',
          created_by: 'user-1',
          is_collapsed: true,
          project_id: 'project-1'
        })
      })
    })
  })
})