import { IdeaCard } from '../../types'
import { logger } from '../../utils/logger'
import { aiCache, AICache } from '../aiCache'
import { FileService } from '../fileService'

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
    currentProject?: any
  ): Promise<InsightsReport> {
    logger.debug('🔍 Generating insights for', (ideas || []).length, 'ideas')

    // Create cache key from core parameters
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
      version: 'v2-multimodal'
    })

    return aiCache.getOrSet(cacheKey, async () => {
      const context = await this.buildInsightsContext(projectId, currentProject)

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
          projectContext: context.projectContext
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

        // In development, provide mock data with file context
        if (this.baseUrl.includes('localhost')) {
          logger.warn('🔧 Using mock insights with file context for development')
          return this.generateMockInsightsWithFiles(ideas, context.documentContext || [])
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
   * Generate mock insights with file context for development
   */
  private generateMockInsightsWithFiles(ideas: IdeaCard[], documentContext: DocumentContext[] = []): InsightsReport {
    const hasFiles = documentContext && documentContext.length > 0
    const fileCount = hasFiles ? documentContext.length : 0

    return {
      executiveSummary: `Development mode insights for ${(ideas || []).length} ideas${hasFiles ? ` with ${fileCount} supporting documents` : ''}. This analysis provides mock insights for testing purposes with realistic content structure and formatting.`,

      keyInsights: [
        {
          insight: 'Development Environment',
          impact: 'Mock insights generated for development and testing purposes with realistic data structure.'
        },
        {
          insight: hasFiles ? 'File Context Integration' : 'Standard Analysis',
          impact: hasFiles
            ? `${fileCount} files processed for context-aware insights generation.`
            : 'Standard mock insights without file context integration.'
        },
        {
          insight: 'Testing Framework',
          impact: 'Comprehensive mock data ensures proper UI testing and development workflow.'
        }
      ],

      priorityRecommendations: {
        immediate: [
          'Configure production AI service endpoints',
          'Test with real project data',
          'Validate insight accuracy'
        ],
        shortTerm: [
          'Deploy to staging environment',
          'Conduct user acceptance testing',
          'Optimize performance metrics'
        ],
        longTerm: [
          'Scale to production workloads',
          'Monitor insight quality',
          'Expand AI capabilities'
        ]
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
}

// Export singleton instance
export const aiInsightsService = new AIInsightsService()