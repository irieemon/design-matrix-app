import { useCallback } from 'react'
import { aiService } from '../../lib/aiService'
import { logger } from '../../utils/logger'
import type { ProjectType } from '../../types'
import type { ClarifyingQuestion, ProjectAnalysis } from './useAIStarterState'

export interface ProjectAnalysisResult {
  recommendedProjectType: ProjectType
  reasoning: string
  industry: string
  timeline: string
  primaryGoals: string[]
  needsClarification: boolean
  clarifyingQuestions: ClarifyingQuestion[]
}

export interface UseProjectAnalysisReturn {
  analyzeProjectContext: (projectName: string, description: string) => ProjectAnalysisResult
  generateProjectIdeas: (
    projectName: string,
    description: string,
    projectType: ProjectType,
    ideaCount: number,
    ideaTolerance: number
  ) => Promise<ProjectAnalysis['generatedIdeas']>
  performInitialAnalysis: (
    projectName: string,
    description: string,
    projectType: ProjectType | 'auto',
    industry: string | 'auto',
    ideaCount: number,
    ideaTolerance: number
  ) => Promise<ProjectAnalysis>
  performEnhancedAnalysis: (
    projectName: string,
    description: string,
    additionalContext: string,
    projectType: ProjectType | 'auto',
    industry: string | 'auto',
    ideaCount: number,
    ideaTolerance: number
  ) => Promise<ProjectAnalysis>
}

export const useProjectAnalysis = (): UseProjectAnalysisReturn => {
  const analyzeProjectContext = useCallback((projectName: string, description: string): ProjectAnalysisResult => {
    const descLower = description.toLowerCase()
    const nameLower = projectName.toLowerCase()
    const combined = `${nameLower} ${descLower}`

    // Extract key information
    const goals = []
    if (combined.includes('launch') || combined.includes('release')) goals.push('Product Launch')
    if (combined.includes('improve') || combined.includes('optimize')) goals.push('Process Improvement')
    if (combined.includes('market') || combined.includes('campaign')) goals.push('Market Expansion')
    if (combined.includes('develop') || combined.includes('build')) goals.push('Development')
    if (combined.includes('research')) goals.push('Research & Analysis')
    if (goals.length === 0) goals.push(projectName)

    // Determine timeline
    let timeline = 'Medium-term'
    if (combined.includes('quarter') || combined.includes('3 month') || combined.includes('short')) timeline = 'Short-term'
    if (combined.includes('year') || combined.includes('annual') || combined.includes('long')) timeline = 'Long-term'

    // Intelligent industry detection with context awareness
    let industry = 'General'

    // Healthcare patterns (prioritized for care/senior services)
    if (combined.match(/(healthcare|health|medical|care|senior|elder|aging|caregiver|patient|clinical|wellness|therapy|nursing)/)) {
      industry = 'Healthcare'
    }
    // Finance patterns
    else if (combined.match(/(finance|financial|bank|investment|insurance|loan|credit|payment|trading|fintech)/)) {
      industry = 'Finance'
    }
    // Education patterns
    else if (combined.match(/(education|school|university|learning|training|course|curriculum|student|academic)/)) {
      industry = 'Education'
    }
    // Retail/E-commerce patterns
    else if (combined.match(/(retail|ecommerce|e-commerce|store|shop|product|inventory|sales|customer|commerce)/)) {
      industry = 'Retail'
    }
    // Real Estate patterns
    else if (combined.match(/(real estate|property|housing|rental|lease|commercial|residential)/)) {
      industry = 'Real Estate'
    }
    // Food & Hospitality patterns
    else if (combined.match(/(restaurant|food|hospitality|hotel|catering|dining|cuisine|chef)/)) {
      industry = 'Food & Hospitality'
    }
    // Non-profit patterns
    else if (combined.match(/(nonprofit|non-profit|charity|community|volunteer|social impact|foundation|donation)/)) {
      industry = 'Non-profit'
    }
    // Technology patterns (only if no other industry detected and clear tech focus)
    else if (combined.match(/(software development|app development|programming|coding|api|database|saas|tech startup)/) ||
             (combined.match(/(technology|software|app|platform|system|digital)/) &&
              !combined.match(/(marketing|campaign|care|health|service|community|social)/))) {
      industry = 'Technology'
    }

    // Smart project type detection with improved priority
    let recommendedProjectType: ProjectType = 'other'
    let reasoning = ''

    // Marketing patterns (checked first for higher priority)
    if (combined.match(/(marketing|campaign|brand|customer|audience|social|content|seo|ads|advertising|promotion)/)) {
      recommendedProjectType = 'marketing'
      reasoning = 'Contains marketing, branding, and customer acquisition elements'
    }
    // Software patterns (only if no marketing terms detected)
    else if (combined.match(/(software development|app development|coding|programming|api|database|backend|frontend)/) ||
             (combined.match(/(app|software|platform|system|website|mobile|web)/) && !combined.match(/(marketing|campaign|brand|customer|audience|social|content|seo|ads)/))) {
      recommendedProjectType = 'software'
      reasoning = 'Detected software development keywords and technical requirements'
    }
    // Product development patterns
    else if (combined.match(/(product|prototype|design|feature|mvp|launch|release)/)) {
      recommendedProjectType = 'product_development'
      reasoning = 'Focus on product creation, features, and market launch activities'
    }
    // Business plan patterns
    else if (combined.match(/(business|strategy|plan|revenue|model|growth|expansion|partnership)/)) {
      recommendedProjectType = 'business_plan'
      reasoning = 'Strategic business planning and growth-focused initiative'
    }
    // Operations patterns
    else if (combined.match(/(process|workflow|operation|efficiency|automat|improve|optimize)/)) {
      recommendedProjectType = 'operations'
      reasoning = 'Operational improvement and process optimization focus'
    }
    // Research patterns
    else if (combined.match(/(research|study|analysis|investigate|explore|experiment)/)) {
      recommendedProjectType = 'research'
      reasoning = 'Research and development focus with analytical components'
    }
    else {
      reasoning = 'Could not clearly categorize - general project approach recommended'
    }

    // Generate contextual clarifying questions based on project type and content
    let needsClarification = false
    const clarifyingQuestions: ClarifyingQuestion[] = []

    // Always check for missing key details, but make questions contextual to project type
    if (description.length < 50) {
      needsClarification = true
      clarifyingQuestions.push({
        question: `Can you provide more details about the ${recommendedProjectType === 'marketing' ? 'campaign objectives and target messaging' :
                   recommendedProjectType === 'software' ? 'technical requirements and key features' :
                   recommendedProjectType === 'business_plan' ? 'business model and revenue strategy' :
                   'project scope and key objectives'}?`,
        context: 'More specific context will help generate better-targeted ideas'
      })
    }

    // Context-aware audience questions
    if (!combined.match(/(target|audience|user|customer|demographic)/) && recommendedProjectType !== 'operations') {
      needsClarification = true
      const audienceQuestion = recommendedProjectType === 'marketing' ?
        'Who is your target demographic and what are their key characteristics (age, income, location, interests)?' :
        industry === 'Healthcare' ?
        'Who are the primary patients/clients and what are their specific care needs?' :
        recommendedProjectType === 'software' ?
        'Who are the primary users and what problems are you solving for them?' :
        'Who is the primary target audience or user base for this project?'

      clarifyingQuestions.push({
        question: audienceQuestion,
        context: 'Understanding the audience helps prioritize features and ideas'
      })
    }

    // Project-type specific clarifying questions
    if (recommendedProjectType === 'marketing' && !combined.match(/(budget|spend|cost|timeline|duration)/)) {
      needsClarification = true
      clarifyingQuestions.push({
        question: 'What is your marketing budget range and campaign timeline?',
        context: 'Budget and timeline inform realistic marketing strategies and channel selection'
      })
    }

    if (industry === 'Healthcare' && !combined.match(/(regulation|compliance|hipaa|privacy)/)) {
      needsClarification = true
      clarifyingQuestions.push({
        question: 'Are there specific healthcare regulations or compliance requirements to consider?',
        context: 'Healthcare projects often have regulatory constraints that affect strategy'
      })
    }

    if (recommendedProjectType === 'software' && !combined.match(/(platform|mobile|web|desktop|api)/)) {
      needsClarification = true
      clarifyingQuestions.push({
        question: 'What platforms or technologies should this solution support (web, mobile, desktop, API)?',
        context: 'Platform decisions affect development approach and user experience'
      })
    }

    return {
      recommendedProjectType,
      reasoning,
      industry,
      timeline,
      primaryGoals: goals,
      needsClarification,
      clarifyingQuestions
    }
  }, [])

  const generateProjectIdeas = useCallback(async (
    projectName: string,
    description: string,
    projectType: ProjectType,
    ideaCount: number,
    ideaTolerance: number
  ): Promise<ProjectAnalysis['generatedIdeas']> => {
    logger.debug('🎯 Generating project ideas via AI service...')

    const result = await aiService.generateProjectIdeas(
      projectName,
      description,
      projectType,
      ideaCount,
      ideaTolerance
    )

    return result
  }, [])

  const performInitialAnalysis = useCallback(async (
    projectName: string,
    description: string,
    projectType: ProjectType | 'auto',
    industry: string | 'auto',
    ideaCount: number,
    ideaTolerance: number
  ): Promise<ProjectAnalysis> => {
    logger.debug('🎯 Starting AI project analysis...')

    // Analyze project context
    const contextAnalysis = analyzeProjectContext(projectName, description)

    // Use manual selections if provided
    const effectiveProjectType = projectType === 'auto'
      ? contextAnalysis.recommendedProjectType
      : projectType
    const effectiveIndustry = industry === 'auto'
      ? contextAnalysis.industry
      : industry

    const generatedIdeas = await generateProjectIdeas(
      projectName,
      description,
      effectiveProjectType,
      ideaCount,
      ideaTolerance
    )

    return {
      needsClarification: contextAnalysis.needsClarification,
      clarifyingQuestions: contextAnalysis.clarifyingQuestions,
      projectAnalysis: {
        industry: effectiveIndustry,
        scope: 'Standard',
        timeline: contextAnalysis.timeline,
        primaryGoals: contextAnalysis.primaryGoals,
        recommendedProjectType: contextAnalysis.recommendedProjectType,
        projectTypeReasoning: contextAnalysis.reasoning
      },
      generatedIdeas
    }
  }, [analyzeProjectContext, generateProjectIdeas])

  const performEnhancedAnalysis = useCallback(async (
    projectName: string,
    description: string,
    additionalContext: string,
    projectType: ProjectType | 'auto',
    industry: string | 'auto',
    ideaCount: number,
    ideaTolerance: number
  ): Promise<ProjectAnalysis> => {
    logger.debug('🎯 Re-analyzing with additional context...')

    // Enhanced description with user answers
    const enhancedDescription = `${description}\n\nAdditional Details:\n${additionalContext}`

    // Re-analyze with enhanced context
    const contextAnalysis = analyzeProjectContext(projectName, enhancedDescription)

    const effectiveProjectType = projectType === 'auto'
      ? contextAnalysis.recommendedProjectType
      : projectType
    const effectiveIndustry = industry === 'auto'
      ? contextAnalysis.industry
      : industry

    const generatedIdeas = await generateProjectIdeas(
      projectName,
      enhancedDescription,
      effectiveProjectType,
      ideaCount,
      ideaTolerance
    )

    return {
      needsClarification: false,
      clarifyingQuestions: [],
      projectAnalysis: {
        industry: effectiveIndustry,
        scope: 'Enhanced',
        timeline: contextAnalysis.timeline,
        primaryGoals: contextAnalysis.primaryGoals,
        recommendedProjectType: contextAnalysis.recommendedProjectType,
        projectTypeReasoning: contextAnalysis.reasoning
      },
      generatedIdeas
    }
  }, [analyzeProjectContext, generateProjectIdeas])

  return {
    analyzeProjectContext,
    generateProjectIdeas,
    performInitialAnalysis,
    performEnhancedAnalysis
  }
}