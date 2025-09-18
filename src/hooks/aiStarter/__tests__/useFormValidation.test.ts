import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useFormValidation } from '../useFormValidation'

describe('useFormValidation', () => {
  describe('validateProjectName', () => {
    it('should validate required project name', () => {
      const { result } = renderHook(() => useFormValidation())

      const emptyResult = result.current.validateProjectName('')
      expect(emptyResult.isValid).toBe(false)
      expect(emptyResult.errors).toContain('Project name is required')

      const validResult = result.current.validateProjectName('Test Project')
      expect(validResult.isValid).toBe(true)
      expect(validResult.errors).toHaveLength(0)
    })

    it('should validate project name length', () => {
      const { result } = renderHook(() => useFormValidation())

      const longName = 'a'.repeat(101)
      const longResult = result.current.validateProjectName(longName)
      expect(longResult.isValid).toBe(false)
      expect(longResult.errors).toContain('Project name must be no more than 100 characters')
    })

    it('should trim whitespace when validating', () => {
      const { result } = renderHook(() => useFormValidation())

      const whitespaceResult = result.current.validateProjectName('   ')
      expect(whitespaceResult.isValid).toBe(false)
      expect(whitespaceResult.errors).toContain('Project name is required')

      const trimmedResult = result.current.validateProjectName('  Test  ')
      expect(trimmedResult.isValid).toBe(true)
    })
  })

  describe('validateProjectDescription', () => {
    it('should validate required project description', () => {
      const { result } = renderHook(() => useFormValidation())

      const emptyResult = result.current.validateProjectDescription('')
      expect(emptyResult.isValid).toBe(false)
      expect(emptyResult.errors).toContain('Project description is required')

      const validResult = result.current.validateProjectDescription('A detailed project description')
      expect(validResult.isValid).toBe(true)
      expect(validResult.errors).toHaveLength(0)
    })

    it('should validate minimum description length', () => {
      const { result } = renderHook(() => useFormValidation())

      const shortResult = result.current.validateProjectDescription('Short')
      expect(shortResult.isValid).toBe(false)
      expect(shortResult.errors).toContain('Project description must be at least 10 characters')

      const validResult = result.current.validateProjectDescription('This is a valid description')
      expect(validResult.isValid).toBe(true)
    })

    it('should validate maximum description length', () => {
      const { result } = renderHook(() => useFormValidation())

      const longDescription = 'a'.repeat(1001)
      const longResult = result.current.validateProjectDescription(longDescription)
      expect(longResult.isValid).toBe(false)
      expect(longResult.errors).toContain('Project description must be no more than 1000 characters')
    })
  })

  describe('validateProjectType', () => {
    it('should validate valid project types', () => {
      const { result } = renderHook(() => useFormValidation())

      const validTypes = ['auto', 'software', 'product_development', 'business_plan', 'marketing', 'operations', 'research', 'other']

      validTypes.forEach(type => {
        const validationResult = result.current.validateProjectType(type as any)
        expect(validationResult.isValid).toBe(true)
        expect(validationResult.errors).toHaveLength(0)
      })
    })

    it('should reject invalid project types', () => {
      const { result } = renderHook(() => useFormValidation())

      const invalidResult = result.current.validateProjectType('invalid' as any)
      expect(invalidResult.isValid).toBe(false)
      expect(invalidResult.errors).toContain('Invalid project type selected')
    })
  })

  describe('validateIndustry', () => {
    it('should validate valid industries', () => {
      const { result } = renderHook(() => useFormValidation())

      const validIndustries = ['auto', 'Healthcare', 'Technology', 'Finance', 'Education', 'General']

      validIndustries.forEach(industry => {
        const validationResult = result.current.validateIndustry(industry)
        expect(validationResult.isValid).toBe(true)
        expect(validationResult.errors).toHaveLength(0)
      })
    })

    it('should reject invalid industries', () => {
      const { result } = renderHook(() => useFormValidation())

      const invalidResult = result.current.validateIndustry('InvalidIndustry')
      expect(invalidResult.isValid).toBe(false)
      expect(invalidResult.errors).toContain('Invalid industry selected')
    })
  })

  describe('validateIdeaCount', () => {
    it('should validate idea count range', () => {
      const { result } = renderHook(() => useFormValidation())

      const validResult = result.current.validateIdeaCount(8)
      expect(validResult.isValid).toBe(true)
      expect(validResult.errors).toHaveLength(0)

      const tooLowResult = result.current.validateIdeaCount(2)
      expect(tooLowResult.isValid).toBe(false)
      expect(tooLowResult.errors).toContain('Idea count must be at least 3')

      const tooHighResult = result.current.validateIdeaCount(15)
      expect(tooHighResult.isValid).toBe(false)
      expect(tooHighResult.errors).toContain('Idea count cannot exceed 12')
    })

    it('should require integer values', () => {
      const { result } = renderHook(() => useFormValidation())

      const floatResult = result.current.validateIdeaCount(8.5)
      expect(floatResult.isValid).toBe(false)
      expect(floatResult.errors).toContain('Idea count must be a whole number')
    })
  })

  describe('validateIdeaTolerance', () => {
    it('should validate tolerance range', () => {
      const { result } = renderHook(() => useFormValidation())

      const validResult = result.current.validateIdeaTolerance(50)
      expect(validResult.isValid).toBe(true)
      expect(validResult.errors).toHaveLength(0)

      const tooLowResult = result.current.validateIdeaTolerance(-1)
      expect(tooLowResult.isValid).toBe(false)
      expect(tooLowResult.errors).toContain('Idea tolerance must be at least 0%')

      const tooHighResult = result.current.validateIdeaTolerance(101)
      expect(tooHighResult.isValid).toBe(false)
      expect(tooHighResult.errors).toContain('Idea tolerance cannot exceed 100%')
    })

    it('should require integer values', () => {
      const { result } = renderHook(() => useFormValidation())

      const floatResult = result.current.validateIdeaTolerance(50.5)
      expect(floatResult.isValid).toBe(false)
      expect(floatResult.errors).toContain('Idea tolerance must be a whole number')
    })
  })

  describe('validateQuestionAnswers', () => {
    it('should validate required question answers', () => {
      const { result } = renderHook(() => useFormValidation())

      const emptyAnswers = {}
      const invalidResult = result.current.validateQuestionAnswers(emptyAnswers, 2)
      expect(invalidResult.isValid).toBe(false)
      expect(invalidResult.errors).toContain('Answer to question 1 is required')
      expect(invalidResult.errors).toContain('Answer to question 2 is required')

      const validAnswers = { 0: 'Answer 1', 1: 'Answer 2' }
      const validResult = result.current.validateQuestionAnswers(validAnswers, 2)
      expect(validResult.isValid).toBe(true)
      expect(validResult.errors).toHaveLength(0)
    })

    it('should validate minimum answer length', () => {
      const { result } = renderHook(() => useFormValidation())

      const shortAnswers = { 0: 'Hi', 1: 'Hello there' }
      const invalidResult = result.current.validateQuestionAnswers(shortAnswers, 2)
      expect(invalidResult.isValid).toBe(false)
      expect(invalidResult.errors).toContain('Answer to question 1 should be more detailed (at least 5 characters)')

      const validAnswers = { 0: 'Hello there', 1: 'Detailed answer' }
      const validResult = result.current.validateQuestionAnswers(validAnswers, 2)
      expect(validResult.isValid).toBe(true)
    })

    it('should handle no questions', () => {
      const { result } = renderHook(() => useFormValidation())

      const noQuestionsResult = result.current.validateQuestionAnswers({}, 0)
      expect(noQuestionsResult.isValid).toBe(true)
      expect(noQuestionsResult.errors).toHaveLength(0)
    })
  })

  describe('validateOverallForm', () => {
    it('should validate complete form data', () => {
      const { result } = renderHook(() => useFormValidation())

      const validFormData = {
        projectName: 'Test Project',
        projectDescription: 'A detailed project description',
        projectType: 'software' as const,
        industry: 'Technology',
        ideaCount: 8,
        ideaTolerance: 50,
        isLoading: false
      }

      const validResult = result.current.validateOverallForm(validFormData)
      expect(validResult.isValid).toBe(true)
      expect(validResult.errors).toHaveLength(0)
    })

    it('should collect all field errors', () => {
      const { result } = renderHook(() => useFormValidation())

      const invalidFormData = {
        projectName: '',
        projectDescription: 'Short',
        projectType: 'invalid' as any,
        industry: 'InvalidIndustry',
        ideaCount: 2,
        ideaTolerance: 150,
        isLoading: false
      }

      const invalidResult = result.current.validateOverallForm(invalidFormData)
      expect(invalidResult.isValid).toBe(false)
      expect(invalidResult.errors.length).toBeGreaterThan(0)
      expect(invalidResult.errors).toContain('Project name is required')
      expect(invalidResult.errors).toContain('Project description must be at least 10 characters')
      expect(invalidResult.errors).toContain('Invalid project type selected')
      expect(invalidResult.errors).toContain('Invalid industry selected')
      expect(invalidResult.errors).toContain('Idea count must be at least 3')
      expect(invalidResult.errors).toContain('Idea tolerance cannot exceed 100%')
    })

    it('should reject form when loading', () => {
      const { result } = renderHook(() => useFormValidation())

      const loadingFormData = {
        projectName: 'Test Project',
        projectDescription: 'A detailed project description',
        projectType: 'software' as const,
        industry: 'Technology',
        ideaCount: 8,
        ideaTolerance: 50,
        isLoading: true
      }

      const invalidResult = result.current.validateOverallForm(loadingFormData)
      expect(invalidResult.isValid).toBe(false)
      expect(invalidResult.errors).toContain('Please wait for current operation to complete')
    })
  })

  describe('getFieldErrorMessage', () => {
    it('should return error message for invalid fields', () => {
      const { result } = renderHook(() => useFormValidation())

      const nameError = result.current.getFieldErrorMessage('projectName', '')
      expect(nameError).toBe('Project name is required')

      const descError = result.current.getFieldErrorMessage('projectDescription', 'Short')
      expect(descError).toBe('Project description must be at least 10 characters')

      const countError = result.current.getFieldErrorMessage('ideaCount', 2)
      expect(countError).toBe('Idea count must be at least 3')

      const noError = result.current.getFieldErrorMessage('projectName', 'Valid Name')
      expect(noError).toBe(null)
    })

    it('should return null for unknown fields', () => {
      const { result } = renderHook(() => useFormValidation())

      const unknownError = result.current.getFieldErrorMessage('unknownField', 'value')
      expect(unknownError).toBe(null)
    })
  })

  describe('custom rules', () => {
    it('should accept custom validation rules', () => {
      const customRules = {
        projectName: {
          required: true,
          minLength: 5,
          maxLength: 50
        }
      }

      const { result } = renderHook(() => useFormValidation(customRules))

      expect(result.current.rules.projectName.minLength).toBe(5)
      expect(result.current.rules.projectName.maxLength).toBe(50)

      const shortNameResult = result.current.validateProjectName('Hi')
      expect(shortNameResult.isValid).toBe(false)
      expect(shortNameResult.errors).toContain('Project name must be at least 5 character(s)')
    })

    it('should merge custom rules with defaults', () => {
      const customRules = {
        ideaCount: {
          min: 5,
          max: 15
        }
      }

      const { result } = renderHook(() => useFormValidation(customRules))

      expect(result.current.rules.ideaCount.min).toBe(5)
      expect(result.current.rules.ideaCount.max).toBe(15)
      expect(result.current.rules.projectName.required).toBe(true) // Default preserved
    })
  })
})