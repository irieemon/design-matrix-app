// AI Starter Custom Hooks - Business Logic Extraction
export { useAIStarterState } from './useAIStarterState'
export { useProjectAnalysis } from './useProjectAnalysis'
export { useFormValidation } from './useFormValidation'
export { useProjectCreation } from './useProjectCreation'

// Re-export types for convenience
export type {
  ModalStep,
  ClarifyingQuestion,
  ProjectAnalysis,
  AIStarterState
} from './useAIStarterState'

export type {
  ProjectAnalysisResult,
  UseProjectAnalysisReturn
} from './useProjectAnalysis'

export type {
  ValidationResult,
  FormValidationRules,
  UseFormValidationReturn
} from './useFormValidation'

export type {
  UseProjectCreationReturn
} from './useProjectCreation'