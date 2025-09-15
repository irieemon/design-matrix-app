// SECURE AI SERVICE - Uses server-side proxy endpoints for all AI API calls
// This ensures API keys are never exposed to the client-side

import { IdeaCard } from '../types'
import { supabase } from './supabase'
import { logger } from '../utils/logger'
import { FileService } from './fileService'
import { aiCache, AICache } from './aiCache'

interface AIIdeaResponse {
  content: string
  details: string
  priority: 'low' | 'moderate' | 'high' | 'strategic' | 'innovation'
}

interface SecureAIServiceConfig {
  baseUrl?: string // For custom API endpoints (defaults to current domain)
}

class SecureAIService {
  private baseUrl: string

  constructor(config: SecureAIServiceConfig = {}) {
    // Use current domain in production, localhost in development
    if (config.baseUrl) {
      this.baseUrl = config.baseUrl
    } else if (typeof window !== 'undefined') {
      // In browser, always use current domain
      this.baseUrl = window.location.origin
    } else {
      // Server-side rendering fallback
      this.baseUrl = 'http://localhost:3000'
    }
    
    logger.debug('🔒 Secure AI Service initialized', {
      baseUrl: this.baseUrl,
      mode: 'server-side-proxy',
      security: 'API keys protected on server',
      origin: typeof window !== 'undefined' ? window.location.origin : 'server-side'
    })
  }

  private async getAuthHeaders(): Promise<HeadersInit> {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session?.access_token) {
        return {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        }
      }
    } catch (error) {
      logger.warn('Could not get auth token:', error)
    }
    
    // Return basic headers if no auth available
    return {
      'Content-Type': 'application/json'
    }
  }

  async generateIdea(title: string, projectContext?: { name?: string, description?: string, type?: string }): Promise<AIIdeaResponse> {
    logger.debug(`🧠 Generating idea for: "${title}" using secure server-side proxy`)
    
    // Generate cache key from parameters
    const cacheKey = AICache.generateKey('generateIdea', {
      title,
      projectContext: projectContext || {}
    })
    
    return aiCache.getOrSet(cacheKey, async () => {
      try {
        // Call our secure serverless endpoint
        const headers = await this.getAuthHeaders()
        const response = await fetch(`${this.baseUrl}/api/ai/generate-ideas`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            title,
            description: projectContext?.description || '',
            projectType: projectContext?.type || 'General'
          })
        })

        if (!response.ok) {
          if (response.status === 429) {
            throw new Error('Rate limit exceeded. Please wait a moment before trying again.')
          }
          throw new Error(`Server error: ${response.status}`)
        }

        const data = await response.json()
        
        if (data.ideas && data.ideas.length > 0) {
          // Return the first idea in the expected format
          const idea = data.ideas[0]
          return {
            content: idea.title,
            details: idea.description,
            priority: this.mapPriorityLevel(idea.impact, idea.effort)
          }
        } else {
          // Fallback to mock if no ideas generated
          return this.generateMockIdea(title, projectContext)
        }
      } catch (error) {
        logger.error('Error generating idea:', error)
        // Return mock idea for non-critical errors
        return this.generateMockIdea(title, projectContext)
      }
    }, 10 * 60 * 1000) // 10 minute cache for ideas
  }

  async generateMultipleIdeas(title: string, description: string, projectType: string = 'General', count: number = 8, tolerance: number = 50): Promise<IdeaCard[]> {
    logger.debug(`🧠 Generating ${count} ideas for project: "${title}" with ${tolerance}% tolerance`)
    
    // Generate cache key from parameters
    const cacheKey = AICache.generateKey('generateMultipleIdeas', {
      title,
      description,
      projectType,
      count,
      tolerance
    })
    
    return aiCache.getOrSet(cacheKey, async () => {
      try {
        const headers = await this.getAuthHeaders()
        const response = await fetch(`${this.baseUrl}/api/ai/generate-ideas`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            title,
            description,
            projectType,
            count,
            tolerance
          })
        })

        if (!response.ok) {
          if (response.status === 429) {
            throw new Error('Rate limit exceeded. Please wait a moment before trying again.')
          }
          throw new Error(`Server error: ${response.status}`)
        }

        const data = await response.json()
        
        if (data.ideas && data.ideas.length > 0) {
          return (data.ideas || []).map((idea: any, index: number) => ({
            id: `ai-${Date.now()}-${index}`,
            content: idea.title,
            details: idea.description,
            x: this.getPositionFromQuadrant(this.mapToQuadrant(idea.effort, idea.impact)).x,
            y: this.getPositionFromQuadrant(this.mapToQuadrant(idea.effort, idea.impact)).y,
            priority: this.mapPriorityLevel(idea.impact, idea.effort),
            created_by: 'ai-assistant',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }))
        } else {
          return this.generateMockIdeas(title, description, projectType, count)
        }

      } catch (error) {
        logger.warn('🚫 AI generation failed, using mock:', error)
        return this.generateMockIdeas(title, description, projectType, count)
      }
    }, 15 * 60 * 1000) // 15 minute cache for multiple ideas
  }

  async generateInsights(ideas: IdeaCard[], projectName?: string, projectType?: string, projectId?: string, currentProject?: any): Promise<any> {
    logger.debug('🔍 Generating insights for', (ideas || []).length, 'ideas')
    
    // Create a simplified cache key from core parameters (excluding timestamps and large data)
    const ideaSignature = (ideas || []).map(idea => ({
      content: idea.content,
      x: Math.round(idea.x / 10) * 10, // Round to reduce cache misses from minor position changes
      y: Math.round(idea.y / 10) * 10
    }))
    
    const cacheKey = AICache.generateKey('generateInsights', {
      ideas: ideaSignature,
      projectName: projectName || 'Project',
      projectType: projectType || 'General',
      projectId: projectId || 'none'
    })
    
    return aiCache.getOrSet(cacheKey, async () => {
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
        const { DatabaseService } = await import('./database')
        const roadmaps = await DatabaseService.getProjectRoadmaps(projectId)
        if (roadmaps && roadmaps.length > 0) {
          // Get the most recent roadmap
          const latestRoadmap = roadmaps.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
          roadmapContext = latestRoadmap.roadmap_data
          logger.debug('📋 Found roadmap context:', latestRoadmap.name)
        }
        
        // Get project files for document context from backend
        try {
          const projectFiles = await FileService.getProjectFiles(projectId)
          if (projectFiles.length > 0) {
            // Extract content previews from text files, PDFs, and other documents
            documentContext = projectFiles
              .filter(file => file.content_preview && file.content_preview.trim())
              .map(file => ({
                name: file.name,
                type: file.file_type,
                content: file.content_preview
              }))
            
            const fileTypes = documentContext.map((doc: any) => doc.type).join(', ')
            logger.debug('📁 Found document context from backend:', documentContext.length, 'files with content')
            logger.debug('📄 File types being analyzed:', fileTypes)
            
            // Enhanced console logging for easier debugging
            console.log('🎯 AI SERVICE: Document context loaded:', {
              fileCount: documentContext.length,
              fileNames: documentContext.map(doc => doc.name),
              totalContent: documentContext.reduce((sum, doc) => sum + (doc.content?.length || 0), 0)
            })
            
            // Log detailed file analysis information
            if (documentContext.length > 0) {
              const totalContentLength = documentContext.reduce((sum: number, doc: any) => sum + (doc.content?.length || 0), 0)
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
      const headers = await this.getAuthHeaders()
      
      const requestPayload = {
        ideas: (ideas || []).map(idea => ({
          title: idea.content,
          description: idea.details,
          quadrant: this.getQuadrantFromPosition(idea.x, idea.y)
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
        hasProjectContext: !!projectContext
      })
      
      if (documentContext && documentContext.length > 0) {
        logger.debug('📄 Document context being sent to AI:', {
          fileCount: documentContext.length,
          fileNames: documentContext.map((doc: any) => doc.name),
          totalContentLength: documentContext.reduce((sum: number, doc: any) => sum + (doc.content?.length || 0), 0)
        })
      }
      
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
      
      // Log what we received from the AI API
      logger.debug('📥 Received AI insights response:', {
        hasExecutiveSummary: !!insights.executiveSummary,
        hasKeyInsights: !!insights.keyInsights,
        keyInsightsCount: insights.keyInsights?.length || 0,
        hasPriorityRecommendations: !!insights.priorityRecommendations,
        hasRiskAssessment: !!insights.riskAssessment,
        responseSize: JSON.stringify(insights).length
      })
      
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
      if (this.baseUrl.includes('localhost')) {
        logger.warn('🔧 Using mock insights with file context for development')
        return this.generateMockInsightsWithFiles(ideas, documentContext || [])
      }
      
      // Don't fall back to mock data in production - let the error propagate
      throw new Error(`Failed to generate insights: ${error instanceof Error ? error.message : 'Unknown error'}. Please check your API configuration and try again.`)
    }
    }, 20 * 60 * 1000) // 20 minute cache for insights (longer due to context complexity)
  }

  async generateRoadmap(ideas: IdeaCard[], projectName: string, projectType?: string): Promise<any> {
    logger.debug('🗺️ Generating roadmap for project:', projectName)
    
    // Create cache key from core parameters
    const ideaSignature = (ideas || []).map(idea => ({
      content: idea.content,
      x: Math.round(idea.x / 10) * 10,
      y: Math.round(idea.y / 10) * 10
    }))
    
    const cacheKey = AICache.generateKey('generateRoadmap', {
      ideas: ideaSignature,
      projectName: projectName || 'Project',
      projectType: projectType || 'General'
    })
    
    return aiCache.getOrSet(cacheKey, async () => {
    try {
      const headers = await this.getAuthHeaders()
      const response = await fetch(`${this.baseUrl}/api/ai/generate-roadmap-v2`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          projectName,
          projectType: projectType || 'General',
          ideas: (ideas || []).map(idea => ({
            title: idea.content,
            description: idea.details,
            quadrant: this.getQuadrantFromPosition(idea.x, idea.y)
          }))
        })
      })

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please wait a moment before trying again.')
        }
        throw new Error(`Server error: ${response.status}`)
      }

      const data = await response.json()
      const roadmap = data.roadmap || this.generateMockRoadmap(projectName, projectType)
      
      // Return the roadmap as-is if it already has the correct structure
      if (roadmap.roadmapAnalysis && roadmap.executionStrategy) {
        logger.debug('✅ Roadmap has correct structure, returning as-is')
        return roadmap
      }
      
      // Legacy format transformation for backward compatibility
      logger.debug('🔄 Transforming legacy roadmap format')
      return {
        roadmapAnalysis: {
          totalDuration: roadmap.timeline || '3-6 months',
          phases: roadmap.phases || []
        },
        executionStrategy: {
          methodology: roadmap.methodology || 'Agile',
          sprintLength: roadmap.sprintLength || '2 weeks',
          teamRecommendations: roadmap.teamRecommendations || 'Cross-functional team structure recommended',
          keyMilestones: roadmap.keyMilestones || []
        }
      }

    } catch (error) {
      logger.warn('🚫 AI roadmap failed, using mock:', error)
      logger.debug('Roadmap API error details:', {
        projectName,
        projectType,
        ideaCount: (ideas || []).length,
        error: error instanceof Error ? error.message : String(error)
      })
      return this.generateMockRoadmap(projectName, projectType)
    }
    }, 25 * 60 * 1000) // 25 minute cache for roadmaps (longest TTL due to complexity)
  }

  // Legacy method for backward compatibility - now uses secure endpoints
  async generateProjectIdeas(projectName: string, description: string, projectType?: string, count: number = 8, tolerance: number = 50): Promise<IdeaCard[]> {
    return this.generateMultipleIdeas(projectName, description, projectType || 'General', count, tolerance)
  }

  // Helper methods
  private getQuadrantFromPosition(x: number, y: number): string {
    // Convert x,y coordinates to quadrant names
    // Assuming 520x520 grid with center at 260,260
    const centerX = 260
    const centerY = 260
    
    if (x < centerX && y < centerY) return 'quick-wins'
    if (x >= centerX && y < centerY) return 'major-projects'  
    if (x < centerX && y >= centerY) return 'fill-ins'
    if (x >= centerX && y >= centerY) return 'thankless-tasks'
    return 'major-projects' // fallback
  }

  private getPositionFromQuadrant(quadrant: string): { x: number, y: number } {
    // Generate random positions within each quadrant
    const centerX = 260
    const centerY = 260
    const margin = 50
    
    switch (quadrant) {
      case 'quick-wins':
        return {
          x: Math.random() * (centerX - margin) + margin,
          y: Math.random() * (centerY - margin) + margin
        }
      case 'major-projects':
        return {
          x: Math.random() * (centerX - margin) + centerX + margin,
          y: Math.random() * (centerY - margin) + margin
        }
      case 'fill-ins':
        return {
          x: Math.random() * (centerX - margin) + margin,
          y: Math.random() * (centerY - margin) + centerY + margin
        }
      case 'thankless-tasks':
        return {
          x: Math.random() * (centerX - margin) + centerX + margin,
          y: Math.random() * (centerY - margin) + centerY + margin
        }
      default:
        return { x: centerX, y: centerY }
    }
  }

  private mapPriorityLevel(impact: string, effort: string): 'low' | 'moderate' | 'high' | 'strategic' | 'innovation' {
    if (impact === 'high' && effort === 'low') return 'strategic'
    if (impact === 'high' && effort === 'medium') return 'high'
    if (impact === 'high' && effort === 'high') return 'innovation'
    if (impact === 'medium') return 'moderate'
    return 'low'
  }

  private mapToQuadrant(effort: string, impact: string): string {
    if (effort === 'low' && impact === 'high') return 'quick-wins'
    if (effort === 'high' && impact === 'high') return 'major-projects'
    if (effort === 'low' && impact === 'low') return 'fill-ins'
    if (effort === 'high' && impact === 'low') return 'thankless-tasks'
    
    // Handle medium values
    if (impact === 'high') return 'major-projects'
    if (effort === 'low') return 'quick-wins'
    return 'major-projects'
  }

  // Mock implementations for fallback when server-side AI is unavailable
  private generateMockIdea(title: string, projectContext?: { name?: string, description?: string, type?: string }): AIIdeaResponse {
    const mockResponses = [
      {
        content: `Enhanced ${title}`,
        details: `Implement an improved version of ${title} with modern best practices and user-centered design principles.`,
        priority: 'high' as const
      },
      {
        content: `Automated ${title}`,
        details: `Create an automated solution for ${title} to reduce manual effort and increase efficiency.`,
        priority: 'moderate' as const
      },
      {
        content: `${title} Analytics`,
        details: `Add comprehensive analytics and reporting capabilities to ${title} for better insights.`,
        priority: 'strategic' as const
      }
    ]

    const randomResponse = mockResponses[Math.floor(Math.random() * mockResponses.length)]
    return {
      ...randomResponse,
      details: `${randomResponse.details} ${projectContext?.description ? `Context: ${projectContext.description}` : ''}`
    }
  }

  private generateMockIdeas(_title: string, _description: string, _projectType: string, count: number): IdeaCard[] {
    const ideas = [
      { title: 'Quick Setup Process', description: 'Streamline the initial setup with guided onboarding', quadrant: 'quick-wins', category: 'User Experience' },
      { title: 'Advanced Analytics Dashboard', description: 'Comprehensive reporting and insights platform', quadrant: 'major-projects', category: 'Analytics' },
      { title: 'Social Media Integration', description: 'Connect with popular social platforms', quadrant: 'fill-ins', category: 'Integration' },
      { title: 'Legacy System Migration', description: 'Complex migration from old infrastructure', quadrant: 'thankless-tasks', category: 'Technical' },
      { title: 'Mobile App Version', description: 'Native mobile application with core features', quadrant: 'major-projects', category: 'Mobile' },
      { title: 'Email Templates', description: 'Pre-designed email templates for communication', quadrant: 'quick-wins', category: 'Communication' },
      { title: 'API Rate Limiting', description: 'Implement sophisticated rate limiting system', quadrant: 'thankless-tasks', category: 'Security' },
      { title: 'User Feedback System', description: 'In-app feedback collection and management', quadrant: 'fill-ins', category: 'User Experience' }
    ]

    return (ideas || []).slice(0, count).map((idea, index) => ({
      id: `mock-${Date.now()}-${index}`,
      content: idea.title,
      details: idea.description,
      x: this.getPositionFromQuadrant(idea.quadrant).x,
      y: this.getPositionFromQuadrant(idea.quadrant).y,
      priority: 'moderate' as const,
      created_by: 'ai-assistant',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }))
  }

  private transformLegacyInsights(legacyInsights: any, ideas: IdeaCard[]): any {
    const quickWins = legacyInsights.matrixAnalysis?.quickWins || []
    const majorProjects = legacyInsights.matrixAnalysis?.majorProjects || []
    
    return {
      executiveSummary: `Strategic analysis of ${(ideas || []).length} initiatives reveals significant market opportunity. ${quickWins.length} quick wins identified for immediate execution, while ${majorProjects.length} major projects represent transformational growth opportunities. Market timing and competitive positioning suggest strong potential for category leadership and investor returns.`,
      
      keyInsights: [
        {
          insight: 'Market Opportunity Analysis',
          impact: 'Current market conditions and competitive landscape present significant opportunity for rapid growth and market share capture.'
        },
        {
          insight: 'Strategic Execution Priority',
          impact: 'Portfolio balance between quick wins and strategic initiatives optimizes risk-adjusted returns and stakeholder value creation.'
        },
        {
          insight: 'Competitive Positioning',
          impact: 'First-mover advantages and differentiated capabilities create defensible market position with scalable growth potential.'
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
        quickWins: 'Deploy 30% of resources to high-velocity market validation and customer acquisition initiatives with rapid feedback cycles.',
        strategic: 'Invest 70% of capital in scalable growth infrastructure, strategic partnerships, and competitive differentiation capabilities.'
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



  private generateMockInsightsWithFiles(ideas: IdeaCard[], documentContext: any[] = []): any {
    const hasFiles = documentContext && documentContext.length > 0
    const fileTypes = hasFiles ? documentContext.map((doc: any) => doc.type).join(', ') : 'none'
    const fileCount = hasFiles ? documentContext.length : 0
    
    logger.debug('📁 Generating mock insights with file context:', fileCount, 'files of types:', fileTypes)
    
    if (hasFiles) {
      logger.warn('🎯 MOCK INSIGHTS: Files detected and being processed!')
      logger.warn(`🎯 File count: ${fileCount}`)
      logger.warn(`🎯 File types: ${fileTypes}`)
      documentContext.forEach((doc: any, index: number) => {
        logger.warn(`🎯 File ${index + 1}: ${doc.name} - ${doc.content?.length || 0} characters`)
      })
    } else {
      logger.warn('🎯 MOCK INSIGHTS: No files detected - using generic insights')
    }
    
    return {
      executiveSummary: `Strategic analysis of ${(ideas || []).length} initiatives reveals significant market opportunity${hasFiles ? ` informed by ${fileCount} uploaded documents (${fileTypes})` : ''}. Analysis shows strong potential for rapid growth and market capture based on current initiative portfolio${hasFiles ? ' and supporting documentation context' : ''}.`,
      
      keyInsights: [
        {
          insight: 'Document-Informed Market Opportunity',
          impact: hasFiles 
            ? `Based on uploaded documents (${fileTypes}), market conditions present significant opportunity for rapid growth and competitive positioning.`
            : 'Current market conditions and competitive landscape present significant opportunity for rapid growth and market share capture.'
        },
        {
          insight: 'Strategic Execution Priority',
          impact: 'Portfolio balance between quick wins and strategic initiatives optimizes risk-adjusted returns and stakeholder value creation.'
        },
        {
          insight: hasFiles ? 'Documentation-Supported Planning' : 'Competitive Positioning',
          impact: hasFiles 
            ? `Project documentation provides valuable context for strategic planning and risk assessment across ${fileCount} supporting files.`
            : 'First-mover advantages and differentiated capabilities create defensible market position with scalable growth potential.'
        }
      ],
      
      priorityRecommendations: {
        immediate: hasFiles 
          ? [
              'Leverage uploaded documentation insights for immediate market validation',
              'Execute quick wins identified through document analysis',
              'Establish stakeholder alignment based on project documentation'
            ]
          : [
              'Execute market validation and customer discovery initiatives',
              'Secure strategic partnerships and distribution channels',
              'Establish funding pipeline and investor relations'
            ],
        shortTerm: [
          'Scale go-to-market operations and sales processes',
          'Build product-market fit and customer success programs',
          'Develop strategic moats and competitive advantages'
        ],
        longTerm: [
          'Expand to adjacent markets and international opportunities',
          'Build platform ecosystem and strategic partnerships',
          'Position for strategic exit or public offering'
        ]
      },
      
      riskAssessment: {
        highRisk: hasFiles 
          ? [
              'Documentation gaps may impact execution clarity',
              'File-based insights need validation with real market data',
              'Technology scalability and operational complexity'
            ]
          : [
              'Market entry timing and competitive response risks',
              'Customer acquisition economics and unit profitability',
              'Technology scalability and operational complexity'
            ],
        opportunities: [
          'Market consolidation and acquisition opportunities',
          'Strategic partnership and channel expansion potential',
          hasFiles ? 'Document-driven process optimization potential' : 'Data monetization and platform revenue streams'
        ]
      },
      
      suggestedRoadmap: [
        {
          phase: 'Market Validation',
          duration: '0-6 months',
          focus: hasFiles 
            ? 'Validate insights from uploaded documentation and establish initial customer base'
            : 'Validate product-market fit and establish initial customer base',
          ideas: (ideas || []).slice(0, 3).map(idea => idea.content)
        },
        {
          phase: 'Growth Acceleration',
          duration: '6-18 months',
          focus: 'Scale operations and capture market share',
          ideas: (ideas || []).slice(3, 6).map(idea => idea.content)
        }
      ],
      
      resourceAllocation: {
        quickWins: hasFiles 
          ? 'Deploy 30% of resources to document-validated quick wins and high-velocity market validation initiatives.'
          : 'Deploy 30% of resources to high-velocity market validation and customer acquisition initiatives with rapid feedback cycles.',
        strategic: 'Invest 70% of capital in scalable growth infrastructure, strategic partnerships, and competitive differentiation capabilities.'
      },
      
      futureEnhancements: hasFiles 
        ? [
            {
              title: 'Document Analysis Automation',
              description: 'Automated analysis of project documents to extract insights and recommendations',
              relatedIdea: (ideas || [])[0]?.content || 'Document Processing',
              impact: 'high',
              timeframe: '3-6 months'
            },
            {
              title: 'File-Based Workflow Integration',
              description: 'Integration of uploaded file insights into daily workflow and decision-making processes',
              relatedIdea: (ideas || [])[1]?.content || 'Process Integration',
              impact: 'medium',
              timeframe: '6-12 months'
            }
          ]
        : [
            {
              title: 'Advanced Analytics Platform',
              description: 'Comprehensive analytics and reporting capabilities for better insights',
              relatedIdea: (ideas || [])[0]?.content || 'Analytics Enhancement',
              impact: 'high',
              timeframe: '3-6 months'
            }
          ],
      
      nextSteps: hasFiles 
        ? [
            'Review and validate insights from uploaded documentation',
            'Conduct comprehensive market analysis incorporating file-based insights',
            'Develop implementation strategy based on document recommendations',
            'Establish measurement framework for document-driven initiatives'
          ]
        : [
            'Conduct comprehensive market analysis and competitive intelligence',
            'Develop investor materials and funding strategy',
            'Establish strategic advisory board and industry partnerships',
            'Implement customer discovery and validation processes'
          ]
    }
  }

  private generateMockRoadmap(_projectName: string, _projectType?: string): any {
    return {
      roadmapAnalysis: {
        totalDuration: '12-16 weeks',
        phases: [
          {
            phase: 'Foundation & Planning',
            description: 'Establish project foundations and detailed planning with comprehensive requirements gathering',
            duration: '3-4 weeks',
            epics: [
              {
                title: 'Project Setup & Configuration',
                description: 'Initial project setup, development environment configuration, and team onboarding',
                priority: 'high',
                complexity: 'medium',
                userStories: [
                  'As a developer, I want a configured development environment so that I can start coding immediately',
                  'As a project manager, I want CI/CD pipeline setup so that deployments are automated',
                  'As a team lead, I want team onboarding documentation so that new members can get up to speed quickly'
                ],
                deliverables: ['Development environment', 'CI/CD pipeline', 'Project documentation', 'Team onboarding guide'],
                relatedIdeas: ['Quick Setup Process', 'Development Tools']
              },
              {
                title: 'Requirements Analysis',
                description: 'Comprehensive business requirements gathering and technical specifications',
                priority: 'high',
                complexity: 'high',
                userStories: [
                  'As a stakeholder, I want clear requirements documentation so that expectations are aligned',
                  'As a developer, I want technical specifications so that I can design the architecture',
                  'As a QA engineer, I want acceptance criteria so that I can write comprehensive tests'
                ],
                deliverables: ['Business Requirements Document', 'Technical Specifications', 'Acceptance Criteria'],
                relatedIdeas: ['User Research', 'Stakeholder Interviews']
              }
            ],
            risks: [
              'Resource availability may impact timeline',
              'Technical complexity could require additional expertise',
              'Stakeholder alignment might need more time than planned'
            ],
            successCriteria: [
              'Development environment is fully configured and tested',
              'All team members are onboarded and productive',
              'Requirements are documented and approved by stakeholders',
              'CI/CD pipeline is operational with automated testing'
            ]
          },
          {
            phase: 'Core Development',
            description: 'Implementation of core features and functionality with iterative development approach',
            duration: '6-8 weeks',
            epics: [
              {
                title: 'Core Feature Implementation',
                description: 'Development of primary application features and core business logic',
                priority: 'high',
                complexity: 'high',
                userStories: [
                  'As a user, I want core functionality working so that I can accomplish my primary goals',
                  'As an admin, I want management features so that I can configure the system',
                  'As a developer, I want clean architecture so that the code is maintainable'
                ],
                deliverables: ['Core Application Features', 'Admin Interface', 'API Documentation', 'Unit Tests'],
                relatedIdeas: ['Advanced Analytics Dashboard', 'User Management System']
              }
            ],
            risks: [
              'Technical challenges may require architecture changes',
              'Integration complexity could impact delivery timeline'
            ],
            successCriteria: [
              'Core features are implemented and tested',
              'Application architecture is scalable and maintainable',
              'Unit test coverage exceeds 80%'
            ]
          }
        ]
      },
      executionStrategy: {
        methodology: 'Agile Development with 2-week sprints',
        sprintLength: '2 weeks',
        teamRecommendations: 'Cross-functional team with Product Owner, Technical Lead, 2-3 Developers (Frontend/Backend), QA Engineer, and part-time DevOps support. Team should have strong collaboration skills and experience with agile methodologies.',
        keyMilestones: [
          {
            milestone: 'Development Environment Ready',
            timeline: 'Week 2',
            description: 'Complete development environment setup, CI/CD pipeline operational, and team fully onboarded'
          },
          {
            milestone: 'Requirements Finalized',
            timeline: 'Week 4',
            description: 'All business requirements documented, technical specifications approved, and development roadmap confirmed'
          },
          {
            milestone: 'Core Features Complete',
            timeline: 'Week 10',
            description: 'All core application features implemented, tested, and ready for integration testing'
          },
          {
            milestone: 'Beta Release Ready',
            timeline: 'Week 14',
            description: 'Application ready for beta testing with all primary features functional and tested'
          }
        ]
      }
    }
  }
}

// Export singleton instance
export const aiService = new SecureAIService()
export default aiService