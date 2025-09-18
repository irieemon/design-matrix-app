import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  AIStarterHeader,
  ProjectBasicsStep,
  ClarifyingQuestionsStep,
  ProjectReviewStep
} from '../index'

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User'
}

const mockAnalysis = {
  needsClarification: false,
  clarifyingQuestions: [],
  projectAnalysis: {
    industry: 'Technology',
    scope: 'Standard',
    timeline: 'Medium-term',
    primaryGoals: ['Development'],
    recommendedProjectType: 'software',
    projectTypeReasoning: 'Technical project'
  },
  generatedIdeas: [
    {
      content: 'User authentication system',
      details: 'Implement secure login',
      x: 150,
      y: 200,
      priority: 'high' as const,
      reasoning: 'Critical for security'
    }
  ]
}

describe('AI Starter Components', () => {
  describe('AIStarterHeader', () => {
    it('should render header with title and close button', () => {
      const onClose = vi.fn()
      render(<AIStarterHeader onClose={onClose} />)

      expect(screen.getByText('AI Project Starter')).toBeInTheDocument()
      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('should call onClose when close button is clicked', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()
      render(<AIStarterHeader onClose={onClose} />)

      const closeButton = screen.getByRole('button')
      await user.click(closeButton)

      expect(onClose).toHaveBeenCalledOnce()
    })
  })

  describe('ProjectBasicsStep', () => {
    const defaultProps = {
      projectName: '',
      onProjectNameChange: vi.fn(),
      projectDescription: '',
      onProjectDescriptionChange: vi.fn(),
      selectedProjectType: 'auto' as const,
      onProjectTypeChange: vi.fn(),
      selectedIndustry: 'auto' as const,
      onIndustryChange: vi.fn(),
      ideaCount: 8,
      onIdeaCountChange: vi.fn(),
      ideaTolerance: 50,
      onIdeaToleranceChange: vi.fn(),
      isLoading: false,
      isFormValid: false,
      onCancel: vi.fn(),
      onStartAnalysis: vi.fn()
    }

    it('should render all form fields', () => {
      render(<ProjectBasicsStep {...defaultProps} />)

      expect(screen.getByPlaceholderText(/e.g., Mobile App Launch/)).toBeInTheDocument()
      expect(screen.getByPlaceholderText(/Describe your project goals/)).toBeInTheDocument()
      expect(screen.getAllByDisplayValue('🤖 Let AI recommend')).toHaveLength(2) // Project type and industry
      expect(screen.getByText(/Number of Ideas: 8/)).toBeInTheDocument()
      expect(screen.getByText(/Idea Tolerance: 50%/)).toBeInTheDocument()
    })

    it('should show start analysis button disabled when form is invalid', () => {
      render(<ProjectBasicsStep {...defaultProps} isFormValid={false} />)

      const startButton = screen.getByRole('button', { name: /Start AI Analysis/ })
      expect(startButton).toBeDisabled()
    })

    it('should enable start analysis button when form is valid', () => {
      render(<ProjectBasicsStep {...defaultProps} isFormValid={true} />)

      const startButton = screen.getByRole('button', { name: /Start AI Analysis/ })
      expect(startButton).toBeEnabled()
    })

    it('should show loading state', () => {
      render(<ProjectBasicsStep {...defaultProps} isLoading={true} />)

      expect(screen.getByText('Analyzing...')).toBeInTheDocument()
    })

    it('should call handlers when inputs change', async () => {
      const user = userEvent.setup()
      const mockHandlers = {
        ...defaultProps,
        onProjectNameChange: vi.fn(),
        onProjectDescriptionChange: vi.fn(),
        onProjectTypeChange: vi.fn()
      }

      render(<ProjectBasicsStep {...mockHandlers} />)

      const nameInput = screen.getByPlaceholderText(/e.g., Mobile App Launch/)
      await user.type(nameInput, 'Test Project')

      const descInput = screen.getByPlaceholderText(/Describe your project goals/)
      await user.type(descInput, 'Test description')

      expect(mockHandlers.onProjectNameChange).toHaveBeenCalled()
      expect(mockHandlers.onProjectDescriptionChange).toHaveBeenCalled()
    })
  })

  describe('ClarifyingQuestionsStep', () => {
    const mockQuestions = [
      {
        question: 'What is your target audience?',
        context: 'This helps prioritize features'
      },
      {
        question: 'What is your budget range?',
        context: 'Budget affects scope and strategy'
      }
    ]

    const defaultProps = {
      questions: mockQuestions,
      answers: {},
      onAnswerChange: vi.fn(),
      isLoading: false,
      onBack: vi.fn(),
      onSubmit: vi.fn()
    }

    it('should render all questions', () => {
      render(<ClarifyingQuestionsStep {...defaultProps} />)

      expect(screen.getByText('What is your target audience?')).toBeInTheDocument()
      expect(screen.getByText('What is your budget range?')).toBeInTheDocument()
      expect(screen.getByText('This helps prioritize features')).toBeInTheDocument()
      expect(screen.getByText('Budget affects scope and strategy')).toBeInTheDocument()
    })

    it('should show existing answers', () => {
      const answers = { 0: 'Developers', 1: '$10,000' }
      render(<ClarifyingQuestionsStep {...defaultProps} answers={answers} />)

      expect(screen.getByDisplayValue('Developers')).toBeInTheDocument()
      expect(screen.getByDisplayValue('$10,000')).toBeInTheDocument()
    })

    it('should call onAnswerChange when answers are updated', async () => {
      const user = userEvent.setup()
      const onAnswerChange = vi.fn()
      render(<ClarifyingQuestionsStep {...defaultProps} onAnswerChange={onAnswerChange} />)

      const firstTextarea = screen.getAllByPlaceholderText('Your answer...')[0]
      await user.type(firstTextarea, 'Test answer')

      expect(onAnswerChange).toHaveBeenCalled()
    })

    it('should show loading state', () => {
      render(<ClarifyingQuestionsStep {...defaultProps} isLoading={true} />)

      expect(screen.getByText('Generating Ideas...')).toBeInTheDocument()
    })
  })

  describe('ProjectReviewStep', () => {
    const defaultProps = {
      analysis: mockAnalysis,
      selectedProjectType: 'auto' as const,
      selectedIndustry: 'auto' as const,
      isLoading: false,
      onBack: vi.fn(),
      onCreateProject: vi.fn()
    }

    it('should render project analysis summary', () => {
      render(<ProjectReviewStep {...defaultProps} />)

      expect(screen.getByText('Project Analysis Complete')).toBeInTheDocument()
      expect(screen.getByText('Technology')).toBeInTheDocument()
      expect(screen.getByText('Medium-term')).toBeInTheDocument()
      expect(screen.getByText('Development')).toBeInTheDocument()
    })

    it('should render generated ideas', () => {
      render(<ProjectReviewStep {...defaultProps} />)

      expect(screen.getByText('Generated Ideas (1)')).toBeInTheDocument()
      expect(screen.getByText('User authentication system')).toBeInTheDocument()
      expect(screen.getByText('Implement secure login')).toBeInTheDocument()
      expect(screen.getByText('high')).toBeInTheDocument()
    })

    it('should show AI recommendation when project type is auto', () => {
      render(<ProjectReviewStep {...defaultProps} selectedProjectType="auto" />)

      expect(screen.getByText('🤖 AI Recommended Project Type:')).toBeInTheDocument()
      expect(screen.getByText('software')).toBeInTheDocument()
    })

    it('should show manual selection when project type is specified', () => {
      render(<ProjectReviewStep {...defaultProps} selectedProjectType="marketing" />)

      expect(screen.getByText('✓ Selected Project Type:')).toBeInTheDocument()
      expect(screen.getByText('marketing')).toBeInTheDocument()
    })

    it('should disable create button when no ideas', () => {
      const emptyAnalysis = { ...mockAnalysis, generatedIdeas: [] }
      render(<ProjectReviewStep {...defaultProps} analysis={emptyAnalysis} />)

      const createButton = screen.getByRole('button', { name: /Create Project/ })
      expect(createButton).toBeDisabled()
    })

    it('should show loading state', () => {
      render(<ProjectReviewStep {...defaultProps} isLoading={true} />)

      expect(screen.getByText('Creating...')).toBeInTheDocument()
    })
  })
})