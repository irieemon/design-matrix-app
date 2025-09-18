import { IdeaCard } from '../../types'
import { logger } from '../../utils/logger'
import { aiCache, AICache } from '../aiCache'
import { FileService } from '../fileService'
import { OpenAIModelRouter, TaskContext, AITaskType } from './openaiModelRouter'
import { IntelligentMockDataService } from './intelligentMockData'

interface ProjectContext {
  name?: string
  description?: string
  type?: string
  startDate?: string
  targetDate?: string
  budget?: number
  teamSize?: number
  priorityLevel?: string
  tags?: string[]
  aiAnalysis?: any
}

interface DocumentContext {
  name: string
  type: string
  mimeType: string
  content: string
  storagePath: string
  fileSize?: number
}

interface InsightsRequest {
  ideas: Array<{
    title: string
    description: string
    quadrant: string
  }>
  projectName: string
  projectType: string
  roadmapContext?: any
  documentContext?: DocumentContext[]
  projectContext?: ProjectContext
  // Smart model routing fields
  modelSelection?: any
  taskContext?: TaskContext
}

interface KeyInsight {
  insight: string
  impact: string
}

interface PriorityRecommendations {
  immediate: string[]
  shortTerm: string[]
  longTerm: string[]
}

interface InsightsReport {
  executiveSummary: string
  keyInsights: KeyInsight[]
  priorityRecommendations: PriorityRecommendations
  riskAssessment?: {
    risks: string[]
    mitigations: string[]
  }
}

interface SecureAIServiceConfig {
  baseUrl?: string
}

/**
 * AI Insights Generation Service
 *
 * Handles AI-powered insights generation, project analysis,
 * and contextual recommendations with multi-modal support.
 */
export class AIInsightsService {
  private baseUrl: string

  constructor(config: SecureAIServiceConfig = {}) {
    if (config.baseUrl) {
      this.baseUrl = config.baseUrl
    } else if (typeof window !== 'undefined') {
      this.baseUrl = window.location.origin
    } else {
      this.baseUrl = 'http://localhost:3000'
    }

    logger.debug('🔍 AI Insights Service initialized', { baseUrl: this.baseUrl })
  }

  /**
   * Get authentication headers for API calls
   */
  private async getAuthHeaders(): Promise<HeadersInit> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }

    try {
      // In a real implementation, get actual auth token
      headers['Authorization'] = 'Bearer placeholder-token'
    } catch (error) {
      logger.warn('Failed to get auth headers:', error)
    }

    return headers
  }

  /**
   * Generate comprehensive AI insights for project ideas
   */
  async generateInsights(
    ideas: IdeaCard[],
    projectName?: string,
    projectType?: string,
    projectId?: string,
    currentProject?: any,
    preferredModel?: 'gpt-4o' | 'gpt-4o-mini'
  ): Promise<InsightsReport> {
    logger.debug('🔍 Generating insights for', (ideas || []).length, 'ideas')

    // Build context for intelligent model selection
    const context = await this.buildInsightsContext(projectId, currentProject)

    // Analyze complexity and determine optimal model
    const complexity = OpenAIModelRouter.analyzeComplexity({
      ideaCount: (ideas || []).length,
      hasFiles: (context.documentContext?.length || 0) > 0,
      hasImages: context.documentContext?.some(doc => doc.mimeType?.startsWith('image/')) || false,
      hasAudio: context.documentContext?.some(doc => doc.mimeType?.startsWith('audio/') || doc.mimeType?.startsWith('video/')) || false,
      projectType: projectType || 'general',
      documentCount: context.documentContext?.length || 0
    })

    const taskContext: TaskContext = {
      type: 'strategic-insights' as AITaskType,
      complexity,
      ideaCount: (ideas || []).length,
      hasFiles: (context.documentContext?.length || 0) > 0,
      hasImages: context.documentContext?.some(doc => doc.mimeType?.startsWith('image/')) || false,
      hasAudio: context.documentContext?.some(doc => doc.mimeType?.startsWith('audio/') || doc.mimeType?.startsWith('video/')) || false,
      userTier: 'pro' // TODO: Get from user context
    }

    let modelSelection = OpenAIModelRouter.selectModel(taskContext)

    // Override with preferred model if specified by user
    if (preferredModel) {
      logger.debug('🎛️ User selected model override:', preferredModel)
      modelSelection = {
        ...modelSelection,
        model: preferredModel,
        reasoning: `User selected ${preferredModel} for testing/comparison purposes. Original recommendation: ${modelSelection.model}`
      }
    }

    OpenAIModelRouter.logSelection(taskContext, modelSelection)

    // Create cache key from core parameters including model selection
    const ideaSignature = (ideas || []).map(idea => ({
      content: idea.content,
      x: Math.round(idea.x / 10) * 10,
      y: Math.round(idea.y / 10) * 10
    }))

    const cacheKey = AICache.generateKey('generateInsights', {
      ideas: ideaSignature,
      projectName: projectName || 'Project',
      projectType: projectType || 'General',
      projectId: projectId || 'none',
      model: modelSelection.model,
      complexity: complexity,
      version: 'v3-smart-routing'
    })

    return aiCache.getOrSet(cacheKey, async () => {

      try {
        const requestPayload: InsightsRequest = {
          ideas: (ideas || []).map(idea => ({
            title: idea.content,
            description: idea.details,
            quadrant: this.getQuadrantFromPosition(idea.x, idea.y)
          })),
          projectName: projectName || 'Project',
          projectType: projectType || 'General',
          roadmapContext: context.roadmapContext,
          documentContext: context.documentContext,
          projectContext: context.projectContext,
          // Include model selection for smart routing
          modelSelection: modelSelection,
          taskContext: taskContext
        }

        this.logInsightsRequest(requestPayload)

        const headers = await this.getAuthHeaders()
        const response = await fetch(`${this.baseUrl}/api/ai/generate-insights`, {
          method: 'POST',
          headers,
          body: JSON.stringify(requestPayload)
        })

        if (!response.ok) {
          if (response.status === 429) {
            throw new Error('Rate limit exceeded. Please wait a moment before trying again.')
          }
          throw new Error(`Server error: ${response.status}`)
        }

        const data = await response.json()
        const insights = data.insights || {}

        this.logInsightsResponse(insights)

        // Validate response quality
        if (this.hasInappropriateContent(insights, requestPayload)) {
          logger.warn('🔧 Using project-specific insights instead of generic template response')
          return this.generateProjectSpecificMockInsights(
            ideas,
            requestPayload.projectName,
            requestPayload.projectType,
            context.documentContext || []
          )
        }

        // Transform response to expected format
        if (insights.executiveSummary && insights.keyInsights) {
          logger.debug('✅ Insights data in correct format')
          return insights
        } else if (insights.matrixAnalysis || insights.priorityRecommendations) {
          logger.debug('🔄 Transforming legacy insights format')
          return this.transformLegacyInsights(insights, ideas)
        } else {
          logger.error('❌ AI service returned invalid insights format:', insights)
          throw new Error('AI service returned invalid insights format. Please check your API configuration.')
        }

      } catch (error) {
        logger.error('🚫 AI insights generation failed:', error)

        // In development, provide intelligent mock data for testing AI optimizations
        if (this.baseUrl.includes('localhost')) {
          logger.warn('🔧 Using intelligent mock insights for development and testing')
          return this.generateIntelligentDevelopmentInsights(
            ideas,
            projectName || 'Development Project',
            projectType || 'General',
            context.documentContext || [],
            taskContext,
            modelSelection
          )
        }

        throw new Error(`Failed to generate insights: ${error instanceof Error ? error.message : 'Unknown error'}. Please check your API configuration and try again.`)
      }
    }, 20 * 60 * 1000) // 20 minute cache
  }

  /**
   * Build comprehensive context for insights generation
   */
  private async buildInsightsContext(projectId?: string, currentProject?: any) {
    let roadmapContext = undefined
    let documentContext: DocumentContext[] | undefined = undefined
    let projectContext: ProjectContext | undefined = undefined

    // Extract project context
    if (currentProject) {
      projectContext = {
        name: currentProject.name,
        description: currentProject.description,
        type: currentProject.project_type,
        startDate: currentProject.start_date,
        targetDate: currentProject.target_date,
        budget: currentProject.budget,
        teamSize: currentProject.team_size,
        priorityLevel: currentProject.priority_level,
        tags: currentProject.tags,
        aiAnalysis: currentProject.ai_analysis
      }
      logger.debug('📋 Project context extracted:', projectContext.name, projectContext.type)
    }

    if (projectId) {
      try {
        // Get roadmap context
        const { DatabaseService } = await import('../database')
        const roadmaps = await DatabaseService.getProjectRoadmaps?.(projectId)
        if (roadmaps && roadmaps.length > 0) {
          const latestRoadmap = roadmaps.sort((a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )[0]
          roadmapContext = latestRoadmap.roadmap_data
          logger.debug('📋 Found roadmap context:', latestRoadmap.name)
        }

        // Get document context
        documentContext = await this.buildDocumentContext(projectId)

      } catch (error) {
        logger.warn('Could not fetch additional project context:', error)
      }
    }

    return { roadmapContext, documentContext, projectContext }
  }

  /**
   * Build document context from project files
   */
  private async buildDocumentContext(projectId: string): Promise<DocumentContext[]> {
    try {
      const projectFiles = await FileService.getProjectFiles(projectId)
      if (projectFiles.length === 0) {
        return []
      }

      const documentContext = projectFiles.map(file => {
        if (file.content_preview && file.content_preview.trim()) {
          return {
            name: file.name,
            type: file.file_type,
            mimeType: file.mime_type,
            content: file.content_preview,
            storagePath: file.storage_path
          }
        }

        const fileTypeLabel = file.mime_type.startsWith('image/') ? 'Image' :
                             file.mime_type.startsWith('video/') ? 'Video' :
                             file.mime_type.startsWith('audio/') ? 'Audio' : 'File'

        return {
          name: file.name,
          type: file.file_type,
          mimeType: file.mime_type,
          content: `${fileTypeLabel} file: ${file.name} (${Math.round(file.file_size / 1024)}KB)`,
          storagePath: file.storage_path,
          fileSize: file.file_size
        }
      })

      this.logDocumentContext(documentContext)
      return documentContext

    } catch (error) {
      logger.warn('Could not load project files from backend:', error)
      return []
    }
  }

  /**
   * Check if AI response contains inappropriate template content
   */
  private hasInappropriateContent(insights: any, requestPayload: InsightsRequest): boolean {
    const insightsText = JSON.stringify(insights).toLowerCase()
    const projectText = `${requestPayload.projectName} ${requestPayload.projectType}`.toLowerCase()

    const templateIndicators = [
      'within the $5.7 billion women\'s health app market',
      'focusing on untapped areas beyond the oversaturated menstrual tracking segment',
      'projected annual growth rate of 17.8%',
      'north american market leads with a 38% share',
      'behavioral economics to reduce the typical 70% user churn',
      'competitive edge against major players like flo, clue, and natural cycles',
      '$500,000',
      '$500k',
      'invest $500',
      'investment of $500',
      'developing proprietary analytics capabilities',
      'hyper-personalized content engine',
      'influencer collaboration platform'
    ]

    const hasTemplateContent = templateIndicators.some(indicator => insightsText.includes(indicator))

    const isWomensHealthContent = insightsText.includes('women\'s health') ||
                                 insightsText.includes('menstrual') ||
                                 insightsText.includes('behavioral interventions to reduce churn')
    const isWomensHealthProject = projectText.includes('women') ||
                                 projectText.includes('health') ||
                                 projectText.includes('menstrual') ||
                                 projectText.includes('female')

    const hasInappropriateContent = hasTemplateContent || (isWomensHealthContent && !isWomensHealthProject)

    if (hasInappropriateContent) {
      logger.error('❌ AI API returned hardcoded template content that doesn\'t match project context')
      logger.warn('🐛 SERVER BUG: AI API returning template content for:', {
        projectName: requestPayload.projectName,
        projectType: requestPayload.projectType,
        isWomensHealthContent,
        isWomensHealthProject,
        hasTemplateContent,
        detectedTemplates: templateIndicators.filter(indicator => insightsText.includes(indicator))
      })
    }

    return hasInappropriateContent
  }

  /**
   * Get quadrant name from position coordinates
   */
  private getQuadrantFromPosition(x: number, y: number): string {
    const centerX = 260
    const centerY = 260

    if (x < centerX && y < centerY) return 'quick-wins'
    if (x >= centerX && y < centerY) return 'major-projects'
    if (x < centerX && y >= centerY) return 'fill-ins'
    return 'thankless-tasks'
  }

  /**
   * Generate project-specific mock insights
   */
  private generateProjectSpecificMockInsights(
    ideas: IdeaCard[],
    projectName: string,
    projectType: string,
    documentContext: DocumentContext[] = []
  ): InsightsReport {
    const hasFiles = documentContext && documentContext.length > 0
    const ideaCount = (ideas || []).length

    // Analyze project context
    const analysis = this.analyzeProjectContext(ideas, projectName, projectType)
    const topIdeas = (ideas || []).slice(0, 3)

    return {
      executiveSummary: `Analysis of ${ideaCount} ideas for ${projectName} shows specific opportunities in ${analysis.mainFocus}${analysis.specificFocus.length > 1 ? ` and ${analysis.specificFocus[1]}` : ''}. Based on your actual project ideas like "${topIdeas[0]?.content || 'core features'}" and "${topIdeas[1]?.content || 'user experience'}", this ${analysis.industry} project focuses on practical ${analysis.primaryTheme} implementation${hasFiles ? ` with ${documentContext.length} supporting documents providing additional context` : ''}.`,

      keyInsights: [
        {
          insight: `${analysis.specificFocus[0]?.charAt(0).toUpperCase() + analysis.specificFocus[0]?.slice(1) || 'Strategic Focus'}`,
          impact: `Initiative "${topIdeas[0]?.content || 'Primary feature'}" represents a core opportunity for ${projectName} to establish ${analysis.primaryTheme} through targeted ${analysis.mainFocus} in the ${analysis.marketContext}.`
        },
        {
          insight: `${analysis.keyThemes[0]?.charAt(0).toUpperCase() + analysis.keyThemes[0]?.slice(1) || 'Market Positioning'}`,
          impact: `Features like "${topIdeas[1]?.content || 'Secondary feature'}" and "${topIdeas[2]?.content || 'Supporting feature'}" create a cohesive strategy for ${projectName} ${analysis.primaryTheme} and competitive differentiation.`
        },
        {
          insight: hasFiles ? 'Document-Informed Strategy' : `${analysis.industry.charAt(0).toUpperCase() + analysis.industry.slice(1)} Implementation`,
          impact: hasFiles
            ? `Uploaded documentation provides specific context for implementing ${analysis.specificFocus.join(' and ')} within ${projectName}'s ${analysis.industry} strategy.`
            : `${projectName}'s focus on ${analysis.specificFocus.join(' and ')} aligns with current ${analysis.industry} market demands and user expectations.`
        }
      ],

      priorityRecommendations: {
        immediate: hasFiles
          ? [
              `Implement "${topIdeas[0]?.content || 'primary feature'}" leveraging document insights`,
              `Execute quick wins from "${topIdeas[1]?.content || 'secondary feature'}" for immediate ${analysis.primaryTheme}`,
              `Validate ${analysis.specificFocus[0]} approach with target users`
            ]
          : [
              `Prioritize "${topIdeas[0]?.content || 'core feature'}" development for ${projectName}`,
              `Launch pilot program for "${topIdeas[1]?.content || 'key feature'}" testing`,
              `Establish ${analysis.mainFocus} metrics and success criteria`
            ],
        shortTerm: [
          `Scale successful ${analysis.specificFocus[0]} implementations`,
          `Integrate ${analysis.keyThemes[0]} across all ${projectName} features`,
          `Expand ${analysis.industry} market reach through targeted initiatives`
        ],
        longTerm: [
          `Build sustainable competitive advantage in ${analysis.marketContext}`,
          `Establish ${projectName} as market leader in ${analysis.industry}`,
          `Develop strategic partnerships to accelerate ${analysis.primaryTheme}`
        ]
      }
    }
  }

  /**
   * Analyze project context to understand focus and themes
   */
  private analyzeProjectContext(ideas: IdeaCard[], projectName: string, projectType: string) {
    const allIdeaText = (ideas || []).map(idea => `${idea.content} ${idea.details || ''}`).join(' ').toLowerCase()
    const projectText = `${projectName} ${projectType}`.toLowerCase()
    const combinedText = `${projectText} ${allIdeaText}`

    let industry = 'business'
    let focus = 'operations'
    let marketContext = 'market'
    let specificFocus: string[] = []
    let keyThemes: string[] = []

    // Analyze content for industry and focus
    if (combinedText.includes('health') || combinedText.includes('medical') || combinedText.includes('patient')) {
      industry = 'healthcare'
      focus = 'patient care and health outcomes'
      marketContext = 'healthcare market'
    } else if (combinedText.includes('senior') || combinedText.includes('aging') || combinedText.includes('elderly')) {
      industry = 'senior care'
      focus = 'senior wellness and care quality'
      marketContext = 'senior care market'
    } else if (combinedText.includes('marketing') || combinedText.includes('campaign') || combinedText.includes('brand')) {
      industry = 'marketing'
      focus = 'brand engagement and customer acquisition'
      marketContext = 'target market'
    } else if (combinedText.includes('platform') || combinedText.includes('app') || combinedText.includes('software')) {
      industry = 'technology platform'
      focus = 'platform development and user experience'
      marketContext = 'technology market'
    }

    // Extract specific themes
    const ideaTitles = (ideas || []).map(idea => idea.content)
    if (ideaTitles.some(title => title.toLowerCase().includes('subscription'))) {
      specificFocus.push('subscription model optimization')
      keyThemes.push('recurring revenue growth')
    }
    if (ideaTitles.some(title => title.toLowerCase().includes('premium') || title.toLowerCase().includes('advanced'))) {
      specificFocus.push('premium feature development')
      keyThemes.push('feature differentiation')
    }
    if (ideaTitles.some(title => title.toLowerCase().includes('user') || title.toLowerCase().includes('experience'))) {
      specificFocus.push('user experience enhancement')
      keyThemes.push('customer satisfaction')
    }

    // Default themes if none detected
    if (specificFocus.length === 0) {
      specificFocus = ['core functionality improvement', 'user engagement enhancement']
      keyThemes = ['market positioning', 'competitive advantage']
    }

    const mainFocus = specificFocus[0] || focus
    const primaryTheme = keyThemes[0] || 'growth'

    return { industry, focus, marketContext, specificFocus, keyThemes, mainFocus, primaryTheme }
  }

  /**
   * Transform legacy insights format to new structure
   */
  private transformLegacyInsights(legacyInsights: any, ideas: IdeaCard[]): InsightsReport {
    const quickWins = legacyInsights.matrixAnalysis?.quickWins || []
    const majorProjects = legacyInsights.matrixAnalysis?.majorProjects || []

    return {
      executiveSummary: `Strategic analysis of ${(ideas || []).length} initiatives reveals significant market opportunity. ${quickWins.length} quick wins identified for immediate execution, while ${majorProjects.length} major projects represent transformational growth opportunities. Market timing and competitive positioning suggest strong potential for category leadership and investor returns.`,

      keyInsights: [
        {
          insight: 'Quick Wins Opportunity',
          impact: `${quickWins.length} immediate opportunities identified for rapid implementation and early returns.`
        },
        {
          insight: 'Transformational Projects',
          impact: `${majorProjects.length} major initiatives positioned to create sustainable competitive advantage.`
        },
        {
          insight: 'Strategic Positioning',
          impact: 'Market analysis indicates optimal timing for category leadership and long-term value creation.'
        }
      ],

      priorityRecommendations: legacyInsights.priorityRecommendations || {
        immediate: ['Execute identified quick wins', 'Validate market assumptions'],
        shortTerm: ['Launch major project pilots', 'Build strategic partnerships'],
        longTerm: ['Scale successful initiatives', 'Expand market presence']
      }
    }
  }


  /**
   * Log insights request for debugging
   */
  private logInsightsRequest(requestPayload: InsightsRequest) {
    logger.debug('🚀 Sending AI insights request:', {
      ideaCount: requestPayload.ideas.length,
      projectName: requestPayload.projectName,
      projectType: requestPayload.projectType,
      hasRoadmapContext: !!requestPayload.roadmapContext,
      hasDocumentContext: !!requestPayload.documentContext,
      documentCount: requestPayload.documentContext?.length || 0,
      hasProjectContext: !!requestPayload.projectContext,
      ideas: requestPayload.ideas.map(idea => ({ title: idea.title, quadrant: idea.quadrant }))
    })
  }

  /**
   * Log insights response for debugging
   */
  private logInsightsResponse(insights: any) {
    logger.debug('📥 Received AI insights response:', {
      hasExecutiveSummary: !!insights.executiveSummary,
      hasKeyInsights: !!insights.keyInsights,
      keyInsightsCount: insights.keyInsights?.length || 0,
      hasPriorityRecommendations: !!insights.priorityRecommendations,
      hasRiskAssessment: !!insights.riskAssessment,
      responseSize: JSON.stringify(insights).length
    })
  }

  /**
   * Log document context for debugging
   */
  private logDocumentContext(documentContext: DocumentContext[]) {
    const imageFiles = documentContext.filter(doc => doc.mimeType?.startsWith('image/'))
    const audioFiles = documentContext.filter(doc => doc.mimeType?.startsWith('audio/') || doc.mimeType?.startsWith('video/'))
    const textFiles = documentContext.filter(doc => !doc.mimeType?.startsWith('image/') && !doc.mimeType?.startsWith('audio/') && !doc.mimeType?.startsWith('video/'))

    logger.debug('📁 Found ALL project files:', {
      total: documentContext.length,
      images: imageFiles.length,
      audioVideo: audioFiles.length,
      textDocs: textFiles.length
    })

    logger.debug('📄 All file types being analyzed:', documentContext.map(doc => doc.type).join(', '))

    console.log('🎯 AI INSIGHTS SERVICE: ALL FILES loaded:', {
      totalFiles: documentContext.length,
      imageFiles: imageFiles.length,
      audioVideoFiles: audioFiles.length,
      textFiles: textFiles.length,
      fileNames: documentContext.map(doc => doc.name),
      totalTextContent: documentContext.reduce((sum, doc) => sum + (doc.content?.length || 0), 0)
    })
  }

  /**
   * Generate intelligent development insights for testing AI optimizations
   */
  private generateIntelligentDevelopmentInsights(
    ideas: IdeaCard[],
    projectName: string,
    projectType: string,
    documentContext: DocumentContext[] = [],
    taskContext: TaskContext,
    modelSelection: any
  ): InsightsReport {
    logger.debug('🧠 Generating intelligent development insights:', {
      projectName,
      projectType,
      ideaCount: ideas.length,
      taskType: taskContext.type,
      complexity: taskContext.complexity,
      selectedModel: modelSelection.model
    })

    // Determine if we should use existing ideas or generate scenario-based data
    const useExistingIdeas = ideas && ideas.length > 0

    if (useExistingIdeas) {
      // Use existing ideas but enhance with intelligent context
      logger.info('🎯 Using existing ideas with intelligent context enhancement')
      return this.enhanceExistingIdeasWithIntelligence(ideas, projectName, projectType, documentContext, taskContext, modelSelection)
    } else {
      // Generate a complete intelligent scenario for testing
      logger.info('🎭 Generating complete intelligent scenario for testing')
      return this.generateScenarioBasedInsights(projectName, projectType, taskContext, modelSelection)
    }
  }

  /**
   * Enhance existing ideas with intelligent context
   */
  private enhanceExistingIdeasWithIntelligence(
    ideas: IdeaCard[],
    projectName: string,
    projectType: string,
    documentContext: DocumentContext[],
    taskContext: TaskContext,
    modelSelection: any
  ): InsightsReport {
    const hasFiles = documentContext && documentContext.length > 0
    const ideaCount = ideas.length

    // Analyze idea distribution across quadrants
    const quadrantAnalysis = this.analyzeQuadrantDistribution(ideas)
    const complexityIndicators = this.getComplexityIndicators(ideas, projectType)

    return {
      executiveSummary: `Intelligent development analysis of ${ideaCount} ideas for ${projectName} (${projectType}) using ${modelSelection.model} with ${taskContext.complexity} complexity routing. ${quadrantAnalysis.dominantStrategy} Project demonstrates ${complexityIndicators.primaryFocus} with ${quadrantAnalysis.distribution}${hasFiles ? ` enhanced by ${documentContext.length} supporting documents` : ''}. Model selection reasoning: ${modelSelection.reasoning}`,

      keyInsights: [
        {
          insight: `Smart Model Routing Validation`,
          impact: `Selected ${modelSelection.model} for ${taskContext.type} task with ${taskContext.complexity} complexity. This validates our intelligent routing system's ability to optimize cost vs performance based on actual project requirements.`
        },
        {
          insight: `${quadrantAnalysis.primaryQuadrant} Strategy Focus`,
          impact: `Project emphasizes ${quadrantAnalysis.primaryQuadrant.replace('-', ' ')} with ${quadrantAnalysis.primaryCount} of ${ideaCount} ideas. This indicates ${this.getQuadrantStrategy(quadrantAnalysis.primaryQuadrant)} approach for ${projectName}.`
        },
        {
          insight: `Development Context Integration`,
          impact: hasFiles
            ? `${documentContext.length} files provide rich context for ${complexityIndicators.primaryFocus}, enabling more sophisticated AI analysis and reducing generic responses.`
            : `Project structure suggests ${complexityIndicators.secondaryFocus} implementation pattern typical of ${projectType.toLowerCase()} projects.`
        }
      ],

      priorityRecommendations: {
        immediate: [
          `Validate ${modelSelection.model} performance for ${taskContext.type} tasks`,
          `Test anti-generic AI response quality with real project context`,
          `Execute ${quadrantAnalysis.quickWinCount} quick-win initiatives for immediate validation`
        ],
        shortTerm: [
          `Scale successful ${quadrantAnalysis.primaryQuadrant} strategies across project`,
          `Monitor cost optimization from smart model routing (estimated ${this.getCostImpact(modelSelection.model)} savings)`,
          `Implement remaining ${quadrantAnalysis.majorProjectCount} major initiatives with validated approach`
        ],
        longTerm: [
          `Refine model routing based on actual performance metrics`,
          `Expand intelligent context engineering to related project types`,
          `Build comprehensive testing framework for AI optimization validation`
        ]
      },

      riskAssessment: {
        risks: [
          `Model routing accuracy for edge cases in ${projectType} projects`,
          `Context engineering effectiveness with sparse project data`,
          `Development-to-production AI behavior consistency`
        ],
        mitigations: [
          `${this.getCostImpact(modelSelection.model)} cost optimization through intelligent routing`,
          `Improved AI response quality through enhanced context engineering`,
          `Scalable testing framework for AI feature development`
        ]
      },



    }
  }

  /**
   * Generate complete scenario-based insights for testing
   */
  private generateScenarioBasedInsights(
    projectName: string,
    projectType: string,
    taskContext: TaskContext,
    modelSelection: any
  ): InsightsReport {
    // Select appropriate scenario based on task context
    let scenario = IntelligentMockDataService.getScenarioByComplexity(taskContext.complexity)

    // If project name/type suggest specific scenario, try to match
    if (projectType.toLowerCase().includes('saas') || projectType.toLowerCase().includes('platform')) {
      const saasScenarios = IntelligentMockDataService.getProjectScenarios().filter(s => s.type.includes('SaaS') || s.type.includes('Platform'))
      if (saasScenarios.length > 0) {
        scenario = saasScenarios.find(s => s.complexity === taskContext.complexity) || scenario
      }
    }

    logger.info(`🎭 Using intelligent scenario: ${scenario.name} (${scenario.complexity} complexity)`)

    // Generate insights with scenario context but use provided project name
    const insights = IntelligentMockDataService.generateIntelligentMockInsights(scenario)

    // Customize for the actual project name while keeping scenario intelligence
    insights.executiveSummary = insights.executiveSummary.replace(scenario.name, projectName)

    // Add development mode context
    insights._developmentContext = {
      originalProjectName: projectName,
      originalProjectType: projectType,
      selectedScenario: scenario.id,
      scenarioName: scenario.name,
      modelSelection: modelSelection,
      taskContext: taskContext
    }

    return insights
  }

  /**
   * Analyze quadrant distribution of ideas
   */
  private analyzeQuadrantDistribution(ideas: IdeaCard[]) {
    const distribution = ideas.reduce((acc, idea) => {
      const quadrant = this.getQuadrantFromPosition(idea.x, idea.y)
      acc[quadrant] = (acc[quadrant] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const entries = Object.entries(distribution).sort(([,a], [,b]) => b - a)
    const [primaryQuadrant, primaryCount] = entries[0] || ['quick-wins', 0]

    const quickWinCount = distribution['quick-wins'] || 0
    const majorProjectCount = distribution['major-projects'] || 0

    return {
      distribution: `${quickWinCount} quick wins, ${majorProjectCount} major projects, ${distribution['fill-ins'] || 0} fill-ins, ${distribution['thankless-tasks'] || 0} infrastructure tasks`,
      primaryQuadrant,
      primaryCount,
      quickWinCount,
      majorProjectCount,
      dominantStrategy: primaryQuadrant === 'quick-wins' ? 'Rapid iteration strategy.' :
                      primaryQuadrant === 'major-projects' ? 'Strategic development focus.' :
                      primaryQuadrant === 'fill-ins' ? 'Incremental improvement approach.' :
                      'Infrastructure-first methodology.'
    }
  }

  /**
   * Get complexity indicators based on ideas and project type
   */
  private getComplexityIndicators(_ideas: IdeaCard[], projectType: string) {
    const typeIndicators = {
      'SaaS': ['platform scalability', 'API integration'],
      'E-commerce': ['payment processing', 'inventory management'],
      'Mobile': ['user experience', 'performance optimization'],
      'Fintech': ['security compliance', 'real-time processing'],
      'EdTech': ['learning analytics', 'content delivery']
    }

    const matchedType = Object.keys(typeIndicators).find(type =>
      projectType.toLowerCase().includes(type.toLowerCase())
    )

    const indicators = matchedType ? typeIndicators[matchedType as keyof typeof typeIndicators] : ['feature development', 'user engagement']

    return {
      primaryFocus: indicators[0],
      secondaryFocus: indicators[1]
    }
  }

  /**
   * Get strategy description for quadrant
   */
  private getQuadrantStrategy(quadrant: string): string {
    switch (quadrant) {
      case 'quick-wins': return 'rapid value delivery and iterative validation'
      case 'major-projects': return 'strategic capability building and competitive differentiation'
      case 'fill-ins': return 'operational efficiency and user experience enhancement'
      case 'thankless-tasks': return 'infrastructure foundation and technical debt management'
      default: return 'balanced development'
    }
  }

  /**
   * Get cost impact description for model
   */
  private getCostImpact(model: string): string {
    return model === 'gpt-4o-mini' ? '~60-70%' : model === 'gpt-4o' ? 'premium quality' : 'optimized'
  }

  /**
   * Generate comprehensive risk assessment using enhanced model selection
   */
  async generateComprehensiveRiskAssessment(
    ideas: IdeaCard[],
    projectName?: string,
    projectType?: string,
    projectId?: string,
    currentProject?: any
  ): Promise<{ risks: string[], mitigations: string[] }> {
    logger.debug('🛡️ Generating comprehensive risk assessment for', (ideas || []).length, 'ideas')

    // Build context for intelligent model selection
    const context = await this.buildInsightsContext(projectId, currentProject)

    // Analyze complexity for risk assessment
    const complexity = OpenAIModelRouter.analyzeComplexity({
      ideaCount: (ideas || []).length,
      hasFiles: (context.documentContext?.length || 0) > 0,
      hasImages: context.documentContext?.some(doc => doc.mimeType?.startsWith('image/')) || false,
      hasAudio: context.documentContext?.some(doc => doc.mimeType?.startsWith('audio/') || doc.mimeType?.startsWith('video/')) || false,
      projectType: projectType || 'general',
      documentCount: context.documentContext?.length || 0
    })

    const taskContext: TaskContext = {
      type: 'risk-assessment' as AITaskType, // Use dedicated risk assessment task type
      complexity,
      ideaCount: (ideas || []).length,
      hasFiles: (context.documentContext?.length || 0) > 0,
      hasImages: context.documentContext?.some(doc => doc.mimeType?.startsWith('image/')) || false,
      hasAudio: context.documentContext?.some(doc => doc.mimeType?.startsWith('audio/') || doc.mimeType?.startsWith('video/')) || false,
      userTier: 'pro'
    }

    const modelSelection = OpenAIModelRouter.selectModel(taskContext)
    OpenAIModelRouter.logSelection(taskContext, modelSelection)

    logger.info('🔍 Enhanced Risk Assessment Configuration:', {
      model: modelSelection.model,
      maxTokens: modelSelection.maxTokens,
      temperature: modelSelection.temperature,
      complexity: complexity,
      reasoning: modelSelection.reasoning
    })

    const requestPayload = {
      ideas: (ideas || []).map(idea => ({
        title: idea.content,
        description: idea.details || '',
        quadrant: this.getQuadrantFromPosition(idea.x, idea.y)
      })),
      projectName: projectName || 'Project',
      projectType: projectType || 'General',
      roadmapContext: context.roadmapContext,
      documentContext: context.documentContext,
      projectContext: context.projectContext,
      modelSelection: modelSelection,
      taskContext: taskContext,
      focusArea: 'comprehensive-risk-analysis' // Special flag for enhanced risk focus
    }

    try {
      const headers = await this.getAuthHeaders()
      const response = await fetch(`${this.baseUrl}/api/ai/generate-insights`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestPayload)
      })

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please wait a moment before trying again.')
        }
        throw new Error(`Server error: ${response.status}`)
      }

      const data = await response.json()
      const insights = data.insights || {}

      logger.info('✅ Comprehensive risk assessment completed:', {
        risksCount: insights.riskAssessment?.risks?.length || 0,
        mitigationsCount: insights.riskAssessment?.mitigations?.length || 0,
        modelUsed: modelSelection.model,
        tokensUsed: modelSelection.maxTokens
      })

      return {
        risks: insights.riskAssessment?.risks || [],
        mitigations: insights.riskAssessment?.mitigations || []
      }
    } catch (error) {
      logger.error('❌ Comprehensive risk assessment failed:', error)
      throw error
    }
  }

}

// Export singleton instance
export const aiInsightsService = new AIInsightsService()