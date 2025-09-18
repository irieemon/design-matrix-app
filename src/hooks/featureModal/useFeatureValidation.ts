import { useMemo } from 'react'
import type { FeatureDetail } from './useFeatureModalState'

interface ValidationError {
  field: string
  message: string
}

interface UseFeatureValidationParams {
  editedFeature: FeatureDetail | null
}

interface UseFeatureValidationReturn {
  isValid: boolean
  errors: ValidationError[]
  fieldErrors: Record<string, string>

  // Specific field validations
  isTitleValid: boolean
  isDurationValid: boolean
  isStartMonthValid: boolean

  // Helper functions
  validateTitle: (title: string) => boolean
  validateDuration: (duration: number) => boolean
  validateStartMonth: (startMonth: number) => boolean
}

export const useFeatureValidation = ({
  editedFeature
}: UseFeatureValidationParams): UseFeatureValidationReturn => {

  // Validation rules
  const validateTitle = (title: string): boolean => {
    return title.trim().length > 0 && title.trim().length <= 100
  }

  const validateDuration = (duration: number): boolean => {
    return duration >= 1 && duration <= 12 && Number.isInteger(duration)
  }

  const validateStartMonth = (startMonth: number): boolean => {
    return startMonth >= 0 && startMonth <= 23 && Number.isInteger(startMonth)
  }

  // Calculate validation results
  const validationResults = useMemo(() => {
    if (!editedFeature) {
      return {
        isValid: false,
        errors: [{ field: 'general', message: 'No feature data provided' }],
        isTitleValid: false,
        isDurationValid: false,
        isStartMonthValid: false
      }
    }

    const errors: ValidationError[] = []

    // Title validation
    const isTitleValid = validateTitle(editedFeature.title)
    if (!isTitleValid) {
      if (editedFeature.title.trim().length === 0) {
        errors.push({ field: 'title', message: 'Title is required' })
      } else if (editedFeature.title.trim().length > 100) {
        errors.push({ field: 'title', message: 'Title must be 100 characters or less' })
      }
    }

    // Duration validation
    const isDurationValid = validateDuration(editedFeature.duration)
    if (!isDurationValid) {
      if (editedFeature.duration < 1) {
        errors.push({ field: 'duration', message: 'Duration must be at least 1 month' })
      } else if (editedFeature.duration > 12) {
        errors.push({ field: 'duration', message: 'Duration cannot exceed 12 months' })
      } else if (!Number.isInteger(editedFeature.duration)) {
        errors.push({ field: 'duration', message: 'Duration must be a whole number' })
      }
    }

    // Start month validation
    const isStartMonthValid = validateStartMonth(editedFeature.startMonth)
    if (!isStartMonthValid) {
      if (editedFeature.startMonth < 0) {
        errors.push({ field: 'startMonth', message: 'Start month cannot be negative' })
      } else if (editedFeature.startMonth > 23) {
        errors.push({ field: 'startMonth', message: 'Start month cannot be more than 24 months in the future' })
      } else if (!Number.isInteger(editedFeature.startMonth)) {
        errors.push({ field: 'startMonth', message: 'Start month must be a whole number' })
      }
    }

    // Team validation
    if (!editedFeature.team || editedFeature.team.trim().length === 0) {
      errors.push({ field: 'team', message: 'Team is required' })
    }

    // Priority validation
    if (!['high', 'medium', 'low'].includes(editedFeature.priority)) {
      errors.push({ field: 'priority', message: 'Priority must be high, medium, or low' })
    }

    // Status validation
    if (!['planned', 'in-progress', 'completed'].includes(editedFeature.status)) {
      errors.push({ field: 'status', message: 'Status must be planned, in-progress, or completed' })
    }

    const isValid = errors.length === 0

    return {
      isValid,
      errors,
      isTitleValid,
      isDurationValid,
      isStartMonthValid
    }
  }, [
    editedFeature?.title,
    editedFeature?.duration,
    editedFeature?.startMonth,
    editedFeature?.team,
    editedFeature?.priority,
    editedFeature?.status
  ])

  // Create field errors map for easy lookup
  const fieldErrors = useMemo(() => {
    const errorMap: Record<string, string> = {}
    validationResults.errors.forEach(error => {
      errorMap[error.field] = error.message
    })
    return errorMap
  }, [validationResults.errors])

  return {
    isValid: validationResults.isValid,
    errors: validationResults.errors,
    fieldErrors,

    // Specific field validations
    isTitleValid: validationResults.isTitleValid,
    isDurationValid: validationResults.isDurationValid,
    isStartMonthValid: validationResults.isStartMonthValid,

    // Helper functions
    validateTitle,
    validateDuration,
    validateStartMonth
  }
}

export type { UseFeatureValidationParams, UseFeatureValidationReturn, ValidationError }