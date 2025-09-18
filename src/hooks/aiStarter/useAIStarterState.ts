import { useState } from 'react'
import type { ProjectType } from '../../types'

export type ModalStep = 'initial' | 'questions' | 'generating' | 'review'

export interface ClarifyingQuestion {
  question: string
  context: string
}

export interface ProjectAnalysis {
  needsClarification: boolean
  clarifyingQuestions: ClarifyingQuestion[]
  projectAnalysis: {
    industry: string
    scope: string
    timeline: string
    primaryGoals: string[]
    recommendedProjectType?: string
    projectTypeReasoning?: string
  }
  generatedIdeas: Array<{
    content: string
    details: string
    x: number
    y: number
    priority: 'low' | 'moderate' | 'high' | 'strategic' | 'innovation'
    reasoning?: string
  }>
}

export interface AIStarterState {
  // Step management
  step: ModalStep
  setStep: (step: ModalStep) => void

  // Form data
  projectName: string
  setProjectName: (name: string) => void
  projectDescription: string
  setProjectDescription: (description: string) => void
  selectedProjectType: ProjectType | 'auto'
  setSelectedProjectType: (type: ProjectType | 'auto') => void
  selectedIndustry: string | 'auto'
  setSelectedIndustry: (industry: string | 'auto') => void

  // Analysis state
  analysis: ProjectAnalysis | null
  setAnalysis: (analysis: ProjectAnalysis | null) => void
  questionAnswers: Record<number, string>
  setQuestionAnswers: (answers: Record<number, string>) => void

  // UI state
  isLoading: boolean
  setIsLoading: (loading: boolean) => void
  error: string | null
  setError: (error: string | null) => void

  // Settings
  ideaCount: number
  setIdeaCount: (count: number) => void
  ideaTolerance: number
  setIdeaTolerance: (tolerance: number) => void

  // Computed values
  isFormValid: boolean

  // Actions
  resetState: () => void
}

export const useAIStarterState = (): AIStarterState => {
  // Step management
  const [step, setStep] = useState<ModalStep>('initial')

  // Form data
  const [projectName, setProjectName] = useState('')
  const [projectDescription, setProjectDescription] = useState('')
  const [selectedProjectType, setSelectedProjectType] = useState<ProjectType | 'auto'>('auto')
  const [selectedIndustry, setSelectedIndustry] = useState<string | 'auto'>('auto')

  // Analysis state
  const [analysis, setAnalysis] = useState<ProjectAnalysis | null>(null)
  const [questionAnswers, setQuestionAnswers] = useState<Record<number, string>>({})

  // UI state
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Settings
  const [ideaCount, setIdeaCount] = useState(8)
  const [ideaTolerance, setIdeaTolerance] = useState(50)

  // Computed values
  const isFormValid = Boolean(
    projectName.trim() &&
    projectDescription.trim() &&
    !isLoading
  )

  // Actions
  const resetState = () => {
    setStep('initial')
    setProjectName('')
    setProjectDescription('')
    setSelectedProjectType('auto')
    setSelectedIndustry('auto')
    setAnalysis(null)
    setQuestionAnswers({})
    setIsLoading(false)
    setError(null)
    setIdeaCount(8)
    setIdeaTolerance(50)
  }

  return {
    // Step management
    step,
    setStep,

    // Form data
    projectName,
    setProjectName,
    projectDescription,
    setProjectDescription,
    selectedProjectType,
    setSelectedProjectType,
    selectedIndustry,
    setSelectedIndustry,

    // Analysis state
    analysis,
    setAnalysis,
    questionAnswers,
    setQuestionAnswers,

    // UI state
    isLoading,
    setIsLoading,
    error,
    setError,

    // Settings
    ideaCount,
    setIdeaCount,
    ideaTolerance,
    setIdeaTolerance,

    // Computed values
    isFormValid,

    // Actions
    resetState
  }
}