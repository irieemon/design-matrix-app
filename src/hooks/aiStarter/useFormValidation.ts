import { useMemo } from 'react'
import type { ProjectType } from '../../types'

export interface ValidationResult {
  isValid: boolean
  errors: string[]
}

export interface FormValidationRules {
  projectName: {
    required: boolean
    minLength?: number
    maxLength?: number
  }
  projectDescription: {
    required: boolean
    minLength?: number
    maxLength?: number
  }
  ideaCount: {
    min: number
    max: number
  }
  ideaTolerance: {
    min: number
    max: number
  }
}

export interface UseFormValidationReturn {
  validateProjectName: (name: string) => ValidationResult
  validateProjectDescription: (description: string) => ValidationResult
  validateProjectType: (type: ProjectType | 'auto') => ValidationResult
  validateIndustry: (industry: string | 'auto') => ValidationResult
  validateIdeaCount: (count: number) => ValidationResult
  validateIdeaTolerance: (tolerance: number) => ValidationResult
  validateQuestionAnswers: (answers: Record<number, string>, questionCount: number) => ValidationResult
  validateOverallForm: (formData: {
    projectName: string
    projectDescription: string
    projectType: ProjectType | 'auto'
    industry: string | 'auto'
    ideaCount: number
    ideaTolerance: number
    isLoading: boolean
  }) => ValidationResult
  getFieldErrorMessage: (field: string, value: any) => string | null
  rules: FormValidationRules
}

const DEFAULT_RULES: FormValidationRules = {
  projectName: {
    required: true,
    minLength: 1,
    maxLength: 100
  },
  projectDescription: {
    required: true,
    minLength: 10,
    maxLength: 1000
  },
  ideaCount: {
    min: 3,
    max: 12
  },
  ideaTolerance: {
    min: 0,
    max: 100
  }
}

export const useFormValidation = (customRules?: Partial<FormValidationRules>): UseFormValidationReturn => {
  const rules = useMemo(() => ({
    ...DEFAULT_RULES,
    ...customRules
  }), [customRules])

  const validateProjectName = (name: string): ValidationResult => {
    const errors: string[] = []
    const trimmedName = name.trim()

    if (rules.projectName.required && !trimmedName) {
      errors.push('Project name is required')
    }

    if (rules.projectName.minLength && trimmedName.length < rules.projectName.minLength) {
      errors.push(`Project name must be at least ${rules.projectName.minLength} character(s)`)
    }

    if (rules.projectName.maxLength && trimmedName.length > rules.projectName.maxLength) {
      errors.push(`Project name must be no more than ${rules.projectName.maxLength} characters`)
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  const validateProjectDescription = (description: string): ValidationResult => {
    const errors: string[] = []
    const trimmedDescription = description.trim()

    if (rules.projectDescription.required && !trimmedDescription) {
      errors.push('Project description is required')
    }

    if (rules.projectDescription.minLength && trimmedDescription.length < rules.projectDescription.minLength) {
      errors.push(`Project description must be at least ${rules.projectDescription.minLength} characters`)
    }

    if (rules.projectDescription.maxLength && trimmedDescription.length > rules.projectDescription.maxLength) {
      errors.push(`Project description must be no more than ${rules.projectDescription.maxLength} characters`)
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  const validateProjectType = (type: ProjectType | 'auto'): ValidationResult => {
    const errors: string[] = []

    const validTypes = ['auto', 'software', 'product_development', 'business_plan', 'marketing', 'operations', 'research', 'other']

    if (!validTypes.includes(type)) {
      errors.push('Invalid project type selected')
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  const validateIndustry = (industry: string | 'auto'): ValidationResult => {
    const errors: string[] = []

    const validIndustries = [
      'auto', 'Healthcare', 'Technology', 'Finance', 'Education', 'Retail',
      'Real Estate', 'Food & Hospitality', 'Non-profit', 'Manufacturing',
      'Construction', 'Transportation', 'Media & Entertainment', 'Professional Services', 'General'
    ]

    if (!validIndustries.includes(industry)) {
      errors.push('Invalid industry selected')
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  const validateIdeaCount = (count: number): ValidationResult => {
    const errors: string[] = []

    if (!Number.isInteger(count)) {
      errors.push('Idea count must be a whole number')
    }

    if (count < rules.ideaCount.min) {
      errors.push(`Idea count must be at least ${rules.ideaCount.min}`)
    }

    if (count > rules.ideaCount.max) {
      errors.push(`Idea count cannot exceed ${rules.ideaCount.max}`)
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  const validateIdeaTolerance = (tolerance: number): ValidationResult => {
    const errors: string[] = []

    if (!Number.isInteger(tolerance)) {
      errors.push('Idea tolerance must be a whole number')
    }

    if (tolerance < rules.ideaTolerance.min) {
      errors.push(`Idea tolerance must be at least ${rules.ideaTolerance.min}%`)
    }

    if (tolerance > rules.ideaTolerance.max) {
      errors.push(`Idea tolerance cannot exceed ${rules.ideaTolerance.max}%`)
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  const validateQuestionAnswers = (answers: Record<number, string>, questionCount: number): ValidationResult => {
    const errors: string[] = []

    if (questionCount > 0) {
      for (let i = 0; i < questionCount; i++) {
        const answer = answers[i]
        if (!answer || answer.trim().length === 0) {
          errors.push(`Answer to question ${i + 1} is required`)
        } else if (answer.trim().length < 5) {
          errors.push(`Answer to question ${i + 1} should be more detailed (at least 5 characters)`)
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  const validateOverallForm = (formData: {
    projectName: string
    projectDescription: string
    projectType: ProjectType | 'auto'
    industry: string | 'auto'
    ideaCount: number
    ideaTolerance: number
    isLoading: boolean
  }): ValidationResult => {
    const errors: string[] = []

    // Check if currently loading
    if (formData.isLoading) {
      errors.push('Please wait for current operation to complete')
    }

    // Validate all fields
    const nameValidation = validateProjectName(formData.projectName)
    const descValidation = validateProjectDescription(formData.projectDescription)
    const typeValidation = validateProjectType(formData.projectType)
    const industryValidation = validateIndustry(formData.industry)
    const countValidation = validateIdeaCount(formData.ideaCount)
    const toleranceValidation = validateIdeaTolerance(formData.ideaTolerance)

    // Collect all errors
    errors.push(
      ...nameValidation.errors,
      ...descValidation.errors,
      ...typeValidation.errors,
      ...industryValidation.errors,
      ...countValidation.errors,
      ...toleranceValidation.errors
    )

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  const getFieldErrorMessage = (field: string, value: any): string | null => {
    let validation: ValidationResult

    switch (field) {
      case 'projectName':
        validation = validateProjectName(value)
        break
      case 'projectDescription':
        validation = validateProjectDescription(value)
        break
      case 'projectType':
        validation = validateProjectType(value)
        break
      case 'industry':
        validation = validateIndustry(value)
        break
      case 'ideaCount':
        validation = validateIdeaCount(value)
        break
      case 'ideaTolerance':
        validation = validateIdeaTolerance(value)
        break
      default:
        return null
    }

    return validation.errors.length > 0 ? validation.errors[0] : null
  }

  return {
    validateProjectName,
    validateProjectDescription,
    validateProjectType,
    validateIndustry,
    validateIdeaCount,
    validateIdeaTolerance,
    validateQuestionAnswers,
    validateOverallForm,
    getFieldErrorMessage,
    rules
  }
}