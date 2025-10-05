/**
 * Insights Service
 * Handles AI-powered insights generation and transformation
 */

import { IdeaCard } from '../../../types'
import { logger } from '../../../utils/logger'
import { BaseAiService, SecureAIServiceConfig } from './BaseAiService'
import { getQuadrantFromPosition } from '../utils'

/**
 * Service for generating strategic insights from ideas
 */
export class InsightsService extends BaseAiService {
  constructor(config: SecureAIServiceConfig = {}) {
    super(config)
  }

  /**
   * Generate AI insights for a set of ideas
   * @param ideas - Array of idea cards
   * @param projectName - Project name
   * @param projectType - Project type
   * @param projectId - Project ID for additional context
   * @param currentProject - Current project object
   * @returns Generated insights report
   */
  async generateInsights(
    ideas: IdeaCard[],
    projectName?: string,
    projectType?: string,
    projectId?: string,
    currentProject?: any
  ): Promise<any> {
    logger.debug('🔍 Generating insights for', (ideas || []).length, 'ideas')

    // Create a simplified cache key from core parameters (excluding timestamps and large data)
    const ideaSignature = (ideas || []).map((idea) => ({
      content: idea.content,
      x: Math.round(idea.x / 10) * 10, // Round to reduce cache misses from minor position changes
      y: Math.round(idea.y / 10) * 10
    }))

    const cacheKey = this.generateCacheKey('generateInsights', {
      ideas: ideaSignature,
      projectName: projectName || 'Project',
      projectType: projectType || 'General',
      projectId: projectId || 'none',
      version: 'v2-multimodal' // Cache buster for new multi-modal support
    })

    return this.getOrSetCache(
      cacheKey,
      async () => {
        // Get additional context if project ID is provided
        let roadmapContext = null
        let documentContext = null
        let projectContext = null

        // Extract project context for intent analysis
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
            // Get latest roadmap for the project
            const { DatabaseService } = await import('../../database')
            const roadmaps = await DatabaseService.getProjectRoadmaps(projectId)
            if (roadmaps && roadmaps.length > 0) {
              // Get the most recent roadmap
              const latestRoadmap = roadmaps.sort(
                (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
              )[0]
              roadmapContext = latestRoadmap.roadmap_data
              logger.debug('📋 Found roadmap context:', latestRoadmap.name)
            }

            // Get project files for document context from backend
            try {
              const { FileService } = await import('../../fileService')
              const projectFiles = await FileService.getProjectFiles(projectId)
              if (projectFiles.length > 0) {
                // Process ALL uploaded files - text, images, audio, video
                documentContext = projectFiles.map((file) => {
                  // For text files and PDFs, use content_preview
                  if (file.content_preview && file.content_preview.trim()) {
                    return {
                      name: file.name,
                      type: file.file_type,
                      mimeType: file.mime_type,
                      content: file.content_preview,
                      storagePath: file.storage_path
                    }
                  }

                  // For images, videos, and audio - include metadata for processing
                  return {
                    name: file.name,
                    type: file.file_type,
                    mimeType: file.mime_type,
                    content: `${
                      file.mime_type.startsWith('image/')
                        ? 'Image'
                        : file.mime_type.startsWith('video/')
                        ? 'Video'
                        : file.mime_type.startsWith('audio/')
                        ? 'Audio'
                        : 'File'
                    } file: ${file.name} (${Math.round(file.file_size / 1024)}KB)`,
                    storagePath: file.storage_path,
                    fileSize: file.file_size
                  }
                })

                const allFileTypes = documentContext.map((doc: any) => doc.type).join(', ')
                const imageFiles = documentContext.filter((doc) => doc.mimeType?.startsWith('image/'))
                const audioFiles = documentContext.filter(
                  (doc) => doc.mimeType?.startsWith('audio/') || doc.mimeType?.startsWith('video/')
                )
                const textFiles = documentContext.filter(
                  (doc) =>
                    !doc.mimeType?.startsWith('image/') &&
                    !doc.mimeType?.startsWith('audio/') &&
                    !doc.mimeType?.startsWith('video/')
                )

                logger.debug('📁 Found ALL project files:', {
                  total: documentContext.length,
                  images: imageFiles.length,
                  audioVideo: audioFiles.length,
                  textDocs: textFiles.length
                })
                logger.debug('📄 All file types being analyzed:', allFileTypes)

                // Enhanced structured logging for file analysis debugging
                logger.debug('AI SERVICE: ALL FILES loaded for analysis', {
                  component: 'AIService',
                  operation: 'generateInsights',
                  totalFiles: documentContext.length,
                  imageFiles: imageFiles.length,
                  audioVideoFiles: audioFiles.length,
                  textFiles: textFiles.length,
                  fileNames: documentContext.map((doc) => doc.name),
                  totalTextContent: documentContext.reduce((sum, doc) => sum + (doc.content?.length || 0), 0)
                })

                // Log detailed file analysis information
                if (documentContext.length > 0) {
                  const totalContentLength = documentContext.reduce(
                    (sum: number, doc: any) => sum + (doc.content?.length || 0),
                    0
                  )
                  logger.debug('📊 Total document content length:', totalContentLength, 'characters')

                  // Log each file being processed
                  documentContext.forEach((doc: any, index: number) => {
                    const content = doc.content || ''
                    const preview = content.substring(0, 100).replace(/\n/g, ' ')
                    logger.debug(`📄 File ${index + 1}: ${doc.name} (${doc.type}) - ${content.length} chars`)
                    logger.debug(`📝 Content preview: "${preview}${content.length > 100 ? '...' : ''}"`)
                  })
                } else {
                  logger.debug('📭 No document context found - no files with extractable content')
                }
              }
            } catch (error) {
              logger.warn('Could not load project files from backend:', error)
            }
          } catch (error) {
            logger.warn('Could not fetch additional project context:', error)
          }
        }

        try {
          const requestPayload = {
            ideas: (ideas || []).map((idea) => ({
              title: idea.content,
              description: idea.details,
              quadrant: getQuadrantFromPosition(idea.x, idea.y)
            })),
            projectName: projectName || 'Project',
            projectType: projectType || 'General',
            roadmapContext: roadmapContext,
            documentContext: documentContext,
            projectContext: projectContext
          }

          // Log what we're sending to the AI API
          logger.debug('🚀 Sending AI insights request:', {
            ideaCount: requestPayload.ideas.length,
            projectName: requestPayload.projectName,
            projectType: requestPayload.projectType,
            hasRoadmapContext: !!roadmapContext,
            hasDocumentContext: !!documentContext,
            documentCount: documentContext?.length || 0,
            hasProjectContext: !!projectContext,
            ideas: requestPayload.ideas.map((idea) => ({ title: idea.title, quadrant: idea.quadrant }))
          })

          // Log detailed payload for debugging
          logger.warn('🔍 DETAILED REQUEST PAYLOAD:', {
            projectName: requestPayload.projectName,
            projectType: requestPayload.projectType,
            ideaTitles: requestPayload.ideas.map((idea) => idea.title),
            documentFiles:
              documentContext?.map((doc) => ({ name: doc.name, type: doc.type, contentLength: doc.content?.length })) ||
              []
          })

          if (documentContext && documentContext.length > 0) {
            logger.debug('📄 Document context being sent to AI:', {
              fileCount: documentContext.length,
              fileNames: documentContext.map((doc: any) => doc.name),
              totalContentLength: documentContext.reduce((sum: number, doc: any) => sum + (doc.content?.length || 0), 0)
            })
          }

          const data = await this.fetchWithErrorHandling<any>('/api/ai/generate-insights', requestPayload)
          const insights = data.insights || {}

          // Log what we received from the AI API
          logger.debug('📥 Received AI insights response:', {
            hasExecutiveSummary: !!insights.executiveSummary,
            hasKeyInsights: !!insights.keyInsights,
            keyInsightsCount: insights.keyInsights?.length || 0,
            hasPriorityRecommendations: !!insights.priorityRecommendations,
            hasRiskAssessment: !!insights.riskAssessment,
            responseSize: JSON.stringify(insights).length
          })

          // Check if API returned generic template content
          const isInappropriate = this.checkForTemplateContent(insights, requestPayload)

          if (isInappropriate) {
            logger.error("❌ AI API returned hardcoded template content that doesn't match project context")
            logger.warn('🔧 Using project-specific insights instead of generic template response')

            // Return project-specific mock insights instead of template content
            const { MockInsightsGenerator } = await import('../mocks/MockInsightsGenerator')
            return MockInsightsGenerator.generateProjectSpecificMockInsights(
              ideas,
              requestPayload.projectName,
              requestPayload.projectType,
              documentContext || []
            )
          }

          // Transform API response to match expected InsightsReport structure
          if (insights.executiveSummary && insights.keyInsights) {
            // Already in correct format
            logger.debug('✅ Insights data in correct format')
            return insights
          } else if (insights.matrixAnalysis || insights.priorityRecommendations) {
            // Transform legacy format to new structure
            logger.debug('🔄 Transforming legacy insights format')
            return this.transformLegacyInsights(insights, ideas)
          } else {
            // No valid insights returned - throw error rather than showing generic mock data
            logger.error('❌ AI service returned invalid insights format:', insights)
            throw new Error('AI service returned invalid insights format. Please check your API configuration.')
          }
        } catch (error) {
          logger.error('🚫 AI insights generation failed:', error)

          // In development, if the API is not available, provide mock data with file context
          if (this.isLocalhost()) {
            logger.warn('🔧 Using mock insights with file context for development')
            const { MockInsightsGenerator } = await import('../mocks/MockInsightsGenerator')
            return MockInsightsGenerator.generateMockInsightsWithFiles(ideas, documentContext || [])
          }

          // Don't fall back to mock data in production - let the error propagate
          throw new Error(
            `Failed to generate insights: ${
              error instanceof Error ? error.message : 'Unknown error'
            }. Please check your API configuration and try again.`
          )
        }
      },
      20 * 60 * 1000 // 20 minute cache for insights (longer due to context complexity)
    )
  }

  /**
   * Check if insights contain inappropriate template content
   * @param insights - Insights object
   * @param requestPayload - Original request payload
   * @returns True if inappropriate content detected
   */
  private checkForTemplateContent(insights: any, requestPayload: any): boolean {
    const insightsText = JSON.stringify(insights).toLowerCase()
    const projectText = `${requestPayload.projectName} ${requestPayload.projectType}`.toLowerCase()

    // Check for specific hardcoded template indicators
    const templateIndicators = [
      "within the $5.7 billion women's health app market",
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
      'join long-term competitive advantages through data',
      'shs summer marketing campaign',
      'untapped social channels',
      'under-utilized social platforms',
      'micro-influencers and behavioral-based segments',
      'quick wins strategy',
      'strategic initiatives',
      'immediate insights',
      'hyper-personalized content engine',
      'influencer collaboration platform'
    ]

    const hasTemplateContent = templateIndicators.some((indicator) => insightsText.includes(indicator))

    // Also check if content is about women's health but project isn't
    const isWomensHealthContent =
      insightsText.includes("women's health") ||
      insightsText.includes('menstrual') ||
      insightsText.includes('behavioral interventions to reduce churn')
    const isWomensHealthProject =
      projectText.includes('women') ||
      projectText.includes('health') ||
      projectText.includes('menstrual') ||
      projectText.includes('female')

    const hasInappropriateContent = hasTemplateContent || (isWomensHealthContent && !isWomensHealthProject)

    if (hasInappropriateContent) {
      logger.warn('🐛 SERVER BUG: AI API is returning template content instead of generating insights for:', {
        projectName: requestPayload.projectName,
        projectType: requestPayload.projectType,
        isWomensHealthContent,
        isWomensHealthProject,
        hasTemplateContent,
        detectedTemplates: templateIndicators.filter((indicator) => insightsText.includes(indicator))
      })
    }

    return hasInappropriateContent
  }

  /**
   * Transform legacy insights format to new structure
   * @param legacyInsights - Legacy insights object
   * @param ideas - Original ideas array
   * @returns Transformed insights
   */
  public transformLegacyInsights(legacyInsights: any, ideas: IdeaCard[]): any {
    const quickWins = legacyInsights.matrixAnalysis?.quickWins || []
    const majorProjects = legacyInsights.matrixAnalysis?.majorProjects || []

    return {
      executiveSummary: `Strategic analysis of ${(ideas || []).length} initiatives reveals significant market opportunity. ${
        quickWins.length
      } quick wins identified for immediate execution, while ${
        majorProjects.length
      } major projects represent transformational growth opportunities. Market timing and competitive positioning suggest strong potential for category leadership and investor returns.`,

      keyInsights: [
        {
          insight: 'Market Opportunity Analysis',
          impact:
            'Current market conditions and competitive landscape present significant opportunity for rapid growth and market share capture.'
        },
        {
          insight: 'Strategic Execution Priority',
          impact:
            'Portfolio balance between quick wins and strategic initiatives optimizes risk-adjusted returns and stakeholder value creation.'
        },
        {
          insight: 'Competitive Positioning',
          impact:
            'First-mover advantages and differentiated capabilities create defensible market position with scalable growth potential.'
        }
      ],

      priorityRecommendations: {
        immediate: legacyInsights.priorityRecommendations?.slice(0, 3) || [
          'Execute market validation and customer discovery initiatives',
          'Secure strategic partnerships and distribution channels',
          'Establish funding pipeline and investor relations'
        ],
        shortTerm: legacyInsights.priorityRecommendations?.slice(3, 6) || [
          'Scale go-to-market operations and sales processes',
          'Build product-market fit and customer success programs',
          'Develop strategic moats and competitive advantages'
        ],
        longTerm: legacyInsights.nextSteps || [
          'Expand to adjacent markets and international opportunities',
          'Build platform ecosystem and strategic partnerships',
          'Position for strategic exit or public offering'
        ]
      },

      riskAssessment: {
        highRisk: legacyInsights.riskAssessments || [
          'Market entry timing and competitive response risks',
          'Customer acquisition economics and unit profitability',
          'Technology scalability and operational complexity'
        ],
        opportunities: legacyInsights.resourceOptimization || [
          'Market consolidation and acquisition opportunities',
          'Strategic partnership and channel expansion potential',
          'Data monetization and platform revenue streams'
        ]
      },

      suggestedRoadmap: [
        {
          phase: 'Market Validation',
          duration: '0-6 months',
          focus: 'Validate product-market fit and establish initial customer base',
          ideas: quickWins.slice(0, 3)
        },
        {
          phase: 'Growth Acceleration',
          duration: '6-18 months',
          focus: 'Scale operations and capture market share',
          ideas: majorProjects.slice(0, 2)
        },
        {
          phase: 'Market Leadership',
          duration: '18+ months',
          focus: 'Establish category leadership and strategic positioning',
          ideas: [...majorProjects.slice(2), ...quickWins.slice(3)]
        }
      ],

      resourceAllocation: {
        quickWins:
          'Deploy 30% of resources to high-velocity market validation and customer acquisition initiatives with rapid feedback cycles.',
        strategic:
          'Invest 70% of capital in scalable growth infrastructure, strategic partnerships, and competitive differentiation capabilities.'
      },

      nextSteps: legacyInsights.nextSteps || [
        'Conduct comprehensive market analysis and competitive intelligence',
        'Develop investor materials and funding strategy',
        'Establish strategic advisory board and industry partnerships',
        'Implement customer discovery and validation processes',
        'Build minimum viable product and early customer pipeline'
      ]
    }
  }
}
