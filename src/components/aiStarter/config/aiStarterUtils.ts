// AI Starter Utility Functions

import type { ProjectType } from '../../../types'
import { ANALYSIS_PATTERNS, AI_STARTER_VALIDATION } from './aiStarterConstants'

export interface ClarifyingQuestion {
  question: string
  context: string
}

export interface ProjectAnalysisResult {
  recommendedProjectType: ProjectType
  reasoning: string
  industry: string
  timeline: string
  primaryGoals: string[]
  needsClarification: boolean
  clarifyingQuestions: ClarifyingQuestion[]
}

/**
 * Analyzes project context and returns recommendations and clarifying questions
 */
export const analyzeProjectContext = (
  projectName: string,
  description: string
): ProjectAnalysisResult => {
  const descLower = description.toLowerCase()
  const nameLower = projectName.toLowerCase()
  const combined = `${nameLower} ${descLower}`

  // Extract primary goals
  const goals = extractPrimaryGoals(combined, projectName)

  // Determine timeline
  const timeline = determineTimeline(combined)

  // Detect industry
  const industry = detectIndustry(combined)

  // Detect project type
  const { projectType, reasoning } = detectProjectType(combined)

  // Generate clarifying questions
  const { needsClarification, clarifyingQuestions } = generateClarifyingQuestions(
    combined,
    description,
    projectType,
    industry
  )

  return {
    recommendedProjectType: projectType,
    reasoning,
    industry,
    timeline,
    primaryGoals: goals,
    needsClarification,
    clarifyingQuestions
  }
}

/**
 * Extracts primary goals from project description
 */
const extractPrimaryGoals = (combined: string, projectName: string): string[] => {
  const goals: string[] = []

  if (ANALYSIS_PATTERNS.GOALS.PRODUCT_LAUNCH.test(combined)) {
    goals.push('Product Launch')
  }
  if (ANALYSIS_PATTERNS.GOALS.PROCESS_IMPROVEMENT.test(combined)) {
    goals.push('Process Improvement')
  }
  if (ANALYSIS_PATTERNS.GOALS.MARKET_EXPANSION.test(combined)) {
    goals.push('Market Expansion')
  }
  if (ANALYSIS_PATTERNS.GOALS.DEVELOPMENT.test(combined)) {
    goals.push('Development')
  }
  if (ANALYSIS_PATTERNS.GOALS.RESEARCH.test(combined)) {
    goals.push('Research & Analysis')
  }

  // Fallback to project name if no goals detected
  if (goals.length === 0) {
    goals.push(projectName)
  }

  return goals
}

/**
 * Determines project timeline from description
 */
const determineTimeline = (combined: string): string => {
  if (ANALYSIS_PATTERNS.TIMELINE.SHORT_TERM.test(combined)) {
    return 'Short-term'
  }
  if (ANALYSIS_PATTERNS.TIMELINE.LONG_TERM.test(combined)) {
    return 'Long-term'
  }
  return 'Medium-term'
}

/**
 * Detects industry from project description with context awareness
 */
const detectIndustry = (combined: string): string => {
  // Healthcare patterns (prioritized for care/senior services)
  if (ANALYSIS_PATTERNS.INDUSTRY.HEALTHCARE.test(combined)) {
    return 'Healthcare'
  }

  // Finance patterns
  if (ANALYSIS_PATTERNS.INDUSTRY.FINANCE.test(combined)) {
    return 'Finance'
  }

  // Education patterns
  if (ANALYSIS_PATTERNS.INDUSTRY.EDUCATION.test(combined)) {
    return 'Education'
  }

  // Retail/E-commerce patterns
  if (ANALYSIS_PATTERNS.INDUSTRY.RETAIL.test(combined)) {
    return 'Retail'
  }

  // Real Estate patterns
  if (ANALYSIS_PATTERNS.INDUSTRY.REAL_ESTATE.test(combined)) {
    return 'Real Estate'
  }

  // Food & Hospitality patterns
  if (ANALYSIS_PATTERNS.INDUSTRY.FOOD_HOSPITALITY.test(combined)) {
    return 'Food & Hospitality'
  }

  // Non-profit patterns
  if (ANALYSIS_PATTERNS.INDUSTRY.NONPROFIT.test(combined)) {
    return 'Non-profit'
  }

  // Technology patterns (only if no other industry detected and clear tech focus)
  if (ANALYSIS_PATTERNS.INDUSTRY.TECHNOLOGY.test(combined) ||
      (ANALYSIS_PATTERNS.INDUSTRY.TECHNOLOGY_GENERAL.test(combined) &&
       !ANALYSIS_PATTERNS.INDUSTRY.MARKETING_EXCLUSIONS.test(combined))) {
    return 'Technology'
  }

  return 'General'
}

/**
 * Detects project type with improved priority logic
 */
const detectProjectType = (combined: string): { projectType: ProjectType; reasoning: string } => {
  // Marketing patterns (checked first for higher priority)
  if (ANALYSIS_PATTERNS.PROJECT_TYPE.MARKETING.test(combined)) {
    return {
      projectType: 'marketing',
      reasoning: 'Contains marketing, branding, and customer acquisition elements'
    }
  }

  // Software patterns (only if no marketing terms detected)
  if (ANALYSIS_PATTERNS.PROJECT_TYPE.SOFTWARE.test(combined) ||
      (ANALYSIS_PATTERNS.PROJECT_TYPE.SOFTWARE_GENERAL.test(combined) &&
       !ANALYSIS_PATTERNS.PROJECT_TYPE.MARKETING_EXCLUSIONS.test(combined))) {
    return {
      projectType: 'software',
      reasoning: 'Detected software development keywords and technical requirements'
    }
  }

  // Product development patterns
  if (ANALYSIS_PATTERNS.PROJECT_TYPE.PRODUCT_DEVELOPMENT.test(combined)) {
    return {
      projectType: 'product_development',
      reasoning: 'Focus on product creation, features, and market launch activities'
    }
  }

  // Business plan patterns
  if (ANALYSIS_PATTERNS.PROJECT_TYPE.BUSINESS_PLAN.test(combined)) {
    return {
      projectType: 'business_plan',
      reasoning: 'Strategic business planning and growth-focused initiative'
    }
  }

  // Operations patterns
  if (ANALYSIS_PATTERNS.PROJECT_TYPE.OPERATIONS.test(combined)) {
    return {
      projectType: 'operations',
      reasoning: 'Operational improvement and process optimization focus'
    }
  }

  // Research patterns
  if (ANALYSIS_PATTERNS.PROJECT_TYPE.RESEARCH.test(combined)) {
    return {
      projectType: 'research',
      reasoning: 'Research and development focus with analytical components'
    }
  }

  return {
    projectType: 'other',
    reasoning: 'Could not clearly categorize - general project approach recommended'
  }
}

/**
 * Generates contextual clarifying questions based on project analysis
 */
const generateClarifyingQuestions = (
  combined: string,
  description: string,
  projectType: ProjectType,
  industry: string
): { needsClarification: boolean; clarifyingQuestions: ClarifyingQuestion[] } => {
  let needsClarification = false
  const clarifyingQuestions: ClarifyingQuestion[] = []

  // Check if description is too short
  if (description.length < AI_STARTER_VALIDATION.MIN_DESCRIPTION_FOR_CLARIFICATION) {
    needsClarification = true
    clarifyingQuestions.push({
      question: generateContextualDetailQuestion(projectType),
      context: 'More specific context will help generate better-targeted ideas'
    })
  }

  // Context-aware audience questions
  if (!ANALYSIS_PATTERNS.CLARIFICATION.TARGET_AUDIENCE.test(combined) && projectType !== 'operations') {
    needsClarification = true
    clarifyingQuestions.push({
      question: generateAudienceQuestion(projectType, industry),
      context: 'Understanding the audience helps prioritize features and ideas'
    })
  }

  // Project-type specific questions
  const typeSpecificQuestions = generateTypeSpecificQuestions(combined, projectType, industry)
  if (typeSpecificQuestions.length > 0) {
    needsClarification = true
    clarifyingQuestions.push(...typeSpecificQuestions)
  }

  return { needsClarification, clarifyingQuestions }
}

/**
 * Generates contextual detail questions based on project type
 */
const generateContextualDetailQuestion = (projectType: ProjectType): string => {
  switch (projectType) {
    case 'marketing':
      return 'Can you provide more details about the campaign objectives and target messaging?'
    case 'software':
      return 'Can you provide more details about the technical requirements and key features?'
    case 'business_plan':
      return 'Can you provide more details about the business model and revenue strategy?'
    default:
      return 'Can you provide more details about the project scope and key objectives?'
  }
}

/**
 * Generates audience questions based on project type and industry
 */
const generateAudienceQuestion = (projectType: ProjectType, industry: string): string => {
  if (projectType === 'marketing') {
    return 'Who is your target demographic and what are their key characteristics (age, income, location, interests)?'
  }

  if (industry === 'Healthcare') {
    return 'Who are the primary patients/clients and what are their specific care needs?'
  }

  if (projectType === 'software') {
    return 'Who are the primary users and what problems are you solving for them?'
  }

  return 'Who is the primary target audience or user base for this project?'
}

/**
 * Generates project-type and industry specific clarifying questions
 */
const generateTypeSpecificQuestions = (
  combined: string,
  projectType: ProjectType,
  industry: string
): ClarifyingQuestion[] => {
  const questions: ClarifyingQuestion[] = []

  // Marketing-specific questions
  if (projectType === 'marketing' && !ANALYSIS_PATTERNS.CLARIFICATION.BUDGET_TIMELINE.test(combined)) {
    questions.push({
      question: 'What is your marketing budget range and campaign timeline?',
      context: 'Budget and timeline inform realistic marketing strategies and channel selection'
    })
  }

  // Healthcare compliance questions
  if (industry === 'Healthcare' && !ANALYSIS_PATTERNS.CLARIFICATION.COMPLIANCE.test(combined)) {
    questions.push({
      question: 'Are there specific healthcare regulations or compliance requirements to consider?',
      context: 'Healthcare projects often have regulatory constraints that affect strategy'
    })
  }

  // Software platform questions
  if (projectType === 'software' && !ANALYSIS_PATTERNS.CLARIFICATION.PLATFORM.test(combined)) {
    questions.push({
      question: 'What platforms or technologies should this solution support (web, mobile, desktop, API)?',
      context: 'Platform decisions affect development approach and user experience'
    })
  }

  return questions
}

/**
 * Validates form inputs for AI Starter
 */
export const validateAIStarterForm = (
  projectName: string,
  projectDescription: string
): boolean => {
  return (
    projectName.trim().length >= AI_STARTER_VALIDATION.MIN_PROJECT_NAME_LENGTH &&
    projectDescription.trim().length >= AI_STARTER_VALIDATION.MIN_PROJECT_DESCRIPTION_LENGTH
  )
}

/**
 * Generates enhanced description with user answers
 */
export const generateEnhancedDescription = (
  originalDescription: string,
  clarifyingQuestions: ClarifyingQuestion[],
  answers: Record<number, string>
): string => {
  const additionalContext = clarifyingQuestions
    .map((q, index) => `${q.question} ${answers[index] || 'Not specified'}`)
    .join('\n')

  return `${originalDescription}\n\nAdditional Details:\n${additionalContext}`
}

/**
 * Gets priority class name for styling
 */
export const getPriorityClassName = (priority: string): string => {
  switch (priority) {
    case 'high':
      return 'bg-red-100 text-red-800'
    case 'strategic':
      return 'bg-blue-100 text-blue-800'
    case 'moderate':
      return 'bg-amber-100 text-amber-800'
    case 'innovation':
      return 'bg-purple-100 text-purple-800'
    default:
      return 'bg-slate-100 text-slate-800'
  }
}