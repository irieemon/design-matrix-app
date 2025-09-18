import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useProjectAnalysis } from '../useProjectAnalysis'
import { aiService } from '../../../lib/aiService'

// Mock dependencies
vi.mock('../../../lib/aiService', () => ({
  aiService: {
    generateProjectIdeas: vi.fn()
  }
}))

vi.mock('../../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn()
  }
}))

const mockGeneratedIdeas = [
  {
    content: 'User authentication system',
    details: 'Implement secure login',
    x: 150,
    y: 200,
    priority: 'high' as const,
    reasoning: 'Critical for security'
  }
]

describe('useProjectAnalysis', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(aiService.generateProjectIdeas).mockResolvedValue(mockGeneratedIdeas)
  })

  describe('analyzeProjectContext', () => {
    it('should detect software project type correctly', () => {
      const { result } = renderHook(() => useProjectAnalysis())

      const analysis = result.current.analyzeProjectContext(
        'Mobile App Development',
        'Building a mobile application with React Native for iOS and Android platforms'
      )

      expect(analysis.recommendedProjectType).toBe('software')
      expect(analysis.reasoning).toContain('software development')
      expect(analysis.industry).toBe('Technology')
    })

    it('should detect marketing project type correctly', () => {
      const { result } = renderHook(() => useProjectAnalysis())

      const analysis = result.current.analyzeProjectContext(
        'Brand Campaign',
        'Creating a marketing campaign to increase brand awareness and customer acquisition'
      )

      expect(analysis.recommendedProjectType).toBe('marketing')
      expect(analysis.reasoning).toContain('marketing')
    })

    it('should detect healthcare industry correctly', () => {
      const { result } = renderHook(() => useProjectAnalysis())

      const analysis = result.current.analyzeProjectContext(
        'Patient Care System',
        'Improving patient care and clinical workflows in healthcare settings'
      )

      expect(analysis.industry).toBe('Healthcare')
    })

    it('should extract goals from project description', () => {
      const { result } = renderHook(() => useProjectAnalysis())

      const analysis = result.current.analyzeProjectContext(
        'Product Launch',
        'We need to launch a new product and improve our market presence through development'
      )

      expect(analysis.primaryGoals).toContain('Product Launch')
      expect(analysis.primaryGoals).toContain('Process Improvement')
      expect(analysis.primaryGoals).toContain('Market Expansion')
      expect(analysis.primaryGoals).toContain('Development')
    })

    it('should determine timeline correctly', () => {
      const { result } = renderHook(() => useProjectAnalysis())

      const shortTermAnalysis = result.current.analyzeProjectContext(
        'Quick Fix',
        'A short-term solution needed this quarter'
      )

      const longTermAnalysis = result.current.analyzeProjectContext(
        'Long Term Strategy',
        'A year-long strategic initiative for long-term growth'
      )

      expect(shortTermAnalysis.timeline).toBe('Short-term')
      expect(longTermAnalysis.timeline).toBe('Long-term')
    })

    it('should require clarification for short descriptions', () => {
      const { result } = renderHook(() => useProjectAnalysis())

      const analysis = result.current.analyzeProjectContext(
        'Test',
        'Short'
      )

      expect(analysis.needsClarification).toBe(true)
      expect(analysis.clarifyingQuestions.length).toBeGreaterThan(0)
    })

    it('should generate audience questions when no target is mentioned', () => {
      const { result } = renderHook(() => useProjectAnalysis())

      const analysis = result.current.analyzeProjectContext(
        'Software Project',
        'Building a comprehensive software solution with advanced features and functionality'
      )

      expect(analysis.needsClarification).toBe(true)
      const audienceQuestion = analysis.clarifyingQuestions.find(q =>
        q.question.toLowerCase().includes('user')
      )
      expect(audienceQuestion).toBeDefined()
    })

    it('should generate marketing-specific questions', () => {
      const { result } = renderHook(() => useProjectAnalysis())

      const analysis = result.current.analyzeProjectContext(
        'Marketing Campaign',
        'Creating a comprehensive marketing campaign to boost brand awareness'
      )

      expect(analysis.needsClarification).toBe(true)
      const budgetQuestion = analysis.clarifyingQuestions.find(q =>
        q.question.toLowerCase().includes('budget')
      )
      expect(budgetQuestion).toBeDefined()
    })

    it('should generate healthcare compliance questions', () => {
      const { result } = renderHook(() => useProjectAnalysis())

      const analysis = result.current.analyzeProjectContext(
        'Healthcare System',
        'Building a patient management system for healthcare providers with comprehensive care features'
      )

      expect(analysis.needsClarification).toBe(true)
      const complianceQuestion = analysis.clarifyingQuestions.find(q =>
        q.question.toLowerCase().includes('regulation')
      )
      expect(complianceQuestion).toBeDefined()
    })

    it('should not require clarification for detailed descriptions', () => {
      const { result } = renderHook(() => useProjectAnalysis())

      const analysis = result.current.analyzeProjectContext(
        'Comprehensive Software Project',
        'Building a detailed software application targeting developers and tech professionals, with specific features including user authentication, data analytics, and mobile responsiveness. The project aims to serve the technology industry with a focus on improving development workflows.'
      )

      expect(analysis.needsClarification).toBe(false)
      expect(analysis.clarifyingQuestions.length).toBe(0)
    })
  })

  describe('generateProjectIdeas', () => {
    it('should call AI service with correct parameters', async () => {
      const { result } = renderHook(() => useProjectAnalysis())
      const mockAIService = vi.mocked(aiService.generateProjectIdeas)

      await act(async () => {
        const ideas = await result.current.generateProjectIdeas(
          'Test Project',
          'Test description',
          'software',
          8,
          50
        )

        expect(ideas).toEqual(mockGeneratedIdeas)
      })

      expect(mockAIService).toHaveBeenCalledWith(
        'Test Project',
        'Test description',
        'software',
        8,
        50
      )
    })
  })

  describe('performInitialAnalysis', () => {
    it('should perform complete initial analysis', async () => {
      const { result } = renderHook(() => useProjectAnalysis())

      await act(async () => {
        const analysis = await result.current.performInitialAnalysis(
          'Software Project',
          'Building a web application with user authentication',
          'auto',
          'auto',
          8,
          50
        )

        expect(analysis).toHaveProperty('needsClarification')
        expect(analysis).toHaveProperty('clarifyingQuestions')
        expect(analysis).toHaveProperty('projectAnalysis')
        expect(analysis).toHaveProperty('generatedIdeas')
        expect(analysis.generatedIdeas).toEqual(mockGeneratedIdeas)
        expect(analysis.projectAnalysis.scope).toBe('Standard')
      })
    })

    it('should use manual selections when provided', async () => {
      const { result } = renderHook(() => useProjectAnalysis())

      await act(async () => {
        const analysis = await result.current.performInitialAnalysis(
          'Project',
          'Description',
          'marketing',
          'Healthcare',
          10,
          75
        )

        expect(analysis.projectAnalysis.industry).toBe('Healthcare')
      })

      const mockAIService = vi.mocked(aiService.generateProjectIdeas)
      expect(mockAIService).toHaveBeenCalledWith(
        'Project',
        'Description',
        'marketing',
        10,
        75
      )
    })
  })

  describe('performEnhancedAnalysis', () => {
    it('should perform enhanced analysis with additional context', async () => {
      const { result } = renderHook(() => useProjectAnalysis())

      await act(async () => {
        const analysis = await result.current.performEnhancedAnalysis(
          'Test Project',
          'Initial description',
          'Additional context from user answers',
          'auto',
          'auto',
          8,
          50
        )

        expect(analysis.needsClarification).toBe(false)
        expect(analysis.clarifyingQuestions).toEqual([])
        expect(analysis.projectAnalysis.scope).toBe('Enhanced')
      })

      const mockAIService = vi.mocked(aiService.generateProjectIdeas)
      expect(mockAIService).toHaveBeenCalledWith(
        'Test Project',
        'Initial description\n\nAdditional Details:\nAdditional context from user answers',
        expect.any(String),
        8,
        50
      )
    })
  })

  describe('business logic integration', () => {
    it('should handle AI service errors gracefully', async () => {
      const { result } = renderHook(() => useProjectAnalysis())
      vi.mocked(aiService.generateProjectIdeas).mockRejectedValue(new Error('AI service error'))

      await act(async () => {
        await expect(result.current.performInitialAnalysis(
          'Test Project',
          'Test description',
          'auto',
          'auto',
          8,
          50
        )).rejects.toThrow('AI service error')
      })
    })

    it('should prioritize marketing detection over software', () => {
      const { result } = renderHook(() => useProjectAnalysis())

      const analysis = result.current.analyzeProjectContext(
        'Software Marketing Campaign',
        'Creating a marketing campaign for our software platform to increase customer acquisition'
      )

      expect(analysis.recommendedProjectType).toBe('marketing')
    })

    it('should detect multiple industries correctly', () => {
      const { result } = renderHook(() => useProjectAnalysis())

      const financeAnalysis = result.current.analyzeProjectContext(
        'Banking App',
        'Developing a fintech application for financial services and investment tracking'
      )

      const educationAnalysis = result.current.analyzeProjectContext(
        'Learning Platform',
        'Building an educational platform for university students and academic courses'
      )

      expect(financeAnalysis.industry).toBe('Finance')
      expect(educationAnalysis.industry).toBe('Education')
    })
  })
})