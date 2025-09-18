// AI Starter Type Definitions

import type { ProjectType } from '../../../types'

export type AIStarterStep = 'initial' | 'questions' | 'generating' | 'review'

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
  generatedIdeas: GeneratedIdea[]
}

export interface GeneratedIdea {
  content: string
  details: string
  x: number
  y: number
  priority: 'low' | 'moderate' | 'high' | 'strategic' | 'innovation'
  reasoning?: string
}

export interface AIStarterFormData {
  projectName: string
  projectDescription: string
  selectedProjectType: ProjectType | 'auto'
  selectedIndustry: string | 'auto'
  ideaCount: number
  ideaTolerance: number
}

export interface AIStarterState {
  step: AIStarterStep
  formData: AIStarterFormData
  analysis: ProjectAnalysis | null
  questionAnswers: Record<number, string>
  isLoading: boolean
  error: string | null
}

export interface ProjectTypeOption {
  readonly value: string
  readonly label: string
}

export interface IndustryOption {
  readonly value: string
  readonly label: string
}