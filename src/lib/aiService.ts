// SECURE AI SERVICE - Uses server-side proxy endpoints for all AI API calls
// This ensures API keys are never exposed to the client-side

import { IdeaCard } from '../types'
import { supabase } from './supabase'
import { logger } from '../utils/logger'

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
      logger.warn('🚫 AI generation failed, using mock:', error)
      return this.generateMockIdea(title, projectContext)
    }
  }

  async generateMultipleIdeas(title: string, description: string, projectType: string = 'General', count: number = 8): Promise<IdeaCard[]> {
    logger.debug(`🧠 Generating ${count} ideas for project: "${title}"`)
    
    try {
      const headers = await this.getAuthHeaders()
      const response = await fetch(`${this.baseUrl}/api/ai/generate-ideas`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title,
          description,
          projectType
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
  }

  async generateInsights(ideas: IdeaCard[], projectName?: string, projectType?: string, projectId?: string): Promise<any> {
    logger.debug('🔍 Generating insights for', (ideas || []).length, 'ideas')
    
    // Get additional context if project ID is provided
    let roadmapContext = null
    let documentContext = null
    
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
        
        // Get project files for document context
        // For now, we'll get this from localStorage where files are stored
        try {
          const projectFilesData = localStorage.getItem('project-files')
          if (projectFilesData) {
            const allFiles = JSON.parse(projectFilesData)
            const projectFiles = allFiles[projectId] || []
            if (projectFiles.length > 0) {
              // Extract content previews from text files
              documentContext = projectFiles
                .filter((file: any) => file.content_preview && file.content_preview.trim())
                .map((file: any) => ({
                  name: file.name,
                  type: file.file_type,
                  content: file.content_preview
                }))
              logger.debug('📁 Found document context:', documentContext.length, 'files with content')
            }
          }
        } catch (error) {
          logger.warn('Could not parse project files from localStorage:', error)
        }
      } catch (error) {
        logger.warn('Could not fetch additional project context:', error)
      }
    }
    
    try {
      const headers = await this.getAuthHeaders()
      const response = await fetch(`${this.baseUrl}/api/ai/generate-insights`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ideas: (ideas || []).map(idea => ({
            title: idea.content,
            description: idea.details,
            quadrant: this.getQuadrantFromPosition(idea.x, idea.y)
          })),
          projectName: projectName || 'Project',
          projectType: projectType || 'General',
          roadmapContext: roadmapContext,
          documentContext: documentContext
        })
      })

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please wait a moment before trying again.')
        }
        throw new Error(`Server error: ${response.status}`)
      }

      const data = await response.json()
      const insights = data.insights || {}
      
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
        // Use mock data
        logger.debug('📊 Using mock insights data')
        return this.generateMockInsights(ideas)
      }

    } catch (error) {
      logger.warn('🚫 AI insights failed, using mock:', error)
      return this.generateMockInsights(ideas)
    }
  }

  async generateRoadmap(ideas: IdeaCard[], projectName: string, projectType?: string): Promise<any> {
    logger.debug('🗺️ Generating roadmap for project:', projectName)
    
    try {
      const headers = await this.getAuthHeaders()
      const response = await fetch(`${this.baseUrl}/api/ai/generate-roadmap`, {
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
      return this.generateMockRoadmap(projectName, projectType)
    }
  }

  // Legacy method for backward compatibility - now uses secure endpoints
  async generateProjectIdeas(projectName: string, description: string, projectType?: string): Promise<IdeaCard[]> {
    return this.generateMultipleIdeas(projectName, description, projectType || 'General', 8)
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

  private generateMockInsights(ideas: IdeaCard[]): any {
    const quickWins = (ideas || []).filter(i => this.getQuadrantFromPosition(i.x, i.y) === 'quick-wins')
    const majorProjects = (ideas || []).filter(i => this.getQuadrantFromPosition(i.x, i.y) === 'major-projects')
    const fillIns = (ideas || []).filter(i => this.getQuadrantFromPosition(i.x, i.y) === 'fill-ins')
    const thankless = (ideas || []).filter(i => this.getQuadrantFromPosition(i.x, i.y) === 'thankless-tasks')
    
    // Analyze the actual ideas to generate specific insights
    const hasUserFeatures = (ideas || []).some(i => i.content.toLowerCase().includes('user') || i.content.toLowerCase().includes('customer'))
    const hasTechFeatures = (ideas || []).some(i => i.content.toLowerCase().includes('api') || i.content.toLowerCase().includes('system') || i.content.toLowerCase().includes('platform'))
    const hasAnalyticsFeatures = (ideas || []).some(i => i.content.toLowerCase().includes('analytics') || i.content.toLowerCase().includes('data') || i.content.toLowerCase().includes('reporting'))
    const hasMobileFeatures = (ideas || []).some(i => i.content.toLowerCase().includes('mobile') || i.content.toLowerCase().includes('app'))
    const hasMarketingFeatures = (ideas || []).some(i => i.content.toLowerCase().includes('marketing') || i.content.toLowerCase().includes('social') || i.content.toLowerCase().includes('campaign'))
    
    // Generate industry-specific TAM based on idea content
    let estimatedTAM = '$500M'
    let industryFocus = 'software'
    if (hasAnalyticsFeatures && hasTechFeatures) {
      estimatedTAM = '$12B'
      industryFocus = 'business intelligence and analytics'
    } else if (hasMobileFeatures && hasUserFeatures) {
      estimatedTAM = '$8B'
      industryFocus = 'mobile application development'
    } else if (hasMarketingFeatures) {
      estimatedTAM = '$6B'
      industryFocus = 'marketing technology'
    } else if (hasTechFeatures) {
      estimatedTAM = '$15B'
      industryFocus = 'enterprise software'
    }
    
    return {
      executiveSummary: `Strategic analysis of your ${(ideas || []).length} initiatives reveals strong positioning in the ${industryFocus} market (${estimatedTAM} TAM). Your portfolio shows ${quickWins.length} quick wins like "${quickWins[0]?.content || 'user-focused features'}" that could generate immediate traction, balanced with ${majorProjects.length} transformational projects including "${majorProjects[0]?.content || 'platform development'}". ${hasAnalyticsFeatures ? 'Data-driven features create strong competitive moats and recurring revenue opportunities.' : ''} ${hasMobileFeatures ? 'Mobile-first approach aligns with market trends showing 67% user preference for mobile experiences.' : ''} ${hasUserFeatures ? 'User-centric initiatives suggest strong product-market fit potential with high retention rates.' : ''} Market timing favors execution now - competitive gaps exist in your specific feature combinations.`,
      
      keyInsights: [
        ...(quickWins.length > 0 ? [{
          insight: `Quick Win Opportunity: "${quickWins[0].content}"`,
          impact: `This ${quickWins[0].content.toLowerCase()} initiative sits in your quick wins quadrant and could generate immediate user value with minimal development investment. Similar features in the market show 30-40% user adoption rates within 60 days of launch.`
        }] : []),
        ...(majorProjects.length > 0 ? [{
          insight: `Strategic Investment: "${majorProjects[0].content}"`,
          impact: `Your ${majorProjects[0].content.toLowerCase()} represents a high-impact, high-effort initiative that could become a core competitive differentiator. This type of capability typically requires 6-12 months to build but creates 18-24 month competitive moats.`
        }] : []),
        ...(hasAnalyticsFeatures ? [{
          insight: 'Data-Driven Revenue Model',
          impact: 'Your analytics and reporting features create opportunities for data monetization. Companies with similar capabilities generate 15-25% of revenue from data insights, with 80% gross margins on analytics products.'
        }] : []),
        ...(hasMobileFeatures ? [{
          insight: 'Mobile-First Market Positioning', 
          impact: 'Mobile features align with user behavior trends - 73% of users prefer mobile-native experiences. Mobile-first products show 40% higher engagement and 2.5x better retention rates.'
        }] : []),
        ...(hasUserFeatures && hasAnalyticsFeatures ? [{
          insight: 'User Intelligence Advantage',
          impact: 'Combination of user-focused features with analytics creates powerful product intelligence capabilities. This data flywheel effect typically increases customer lifetime value by 35-50%.'
        }] : []),
        {
          insight: 'Portfolio Balance Optimization',
          impact: `Your ${quickWins.length} quick wins balanced with ${majorProjects.length} major projects creates optimal risk-adjusted execution strategy. Quick wins fund major project development while proving market demand.`
        }
      ].slice(0, 5),
      
      priorityRecommendations: {
        immediate: [
          ...(quickWins.length > 0 ? [`Execute "${quickWins[0].content}" immediately - sits in quick wins quadrant with high ROI potential and minimal risk`] : []),
          ...(hasUserFeatures ? ['Launch user research sprint: interview 50+ target users to validate core user experience assumptions'] : ['Validate core assumptions through customer discovery and market research']),
          ...(hasTechFeatures ? ['Establish technical architecture and platform strategy to support scalable growth'] : []),
          'Build MVP focusing on highest-value features to prove product-market fit',
          ...(hasAnalyticsFeatures ? ['Implement basic analytics infrastructure to capture user behavior data from day 1'] : [])
        ].slice(0, 5),
        shortTerm: [
          ...(majorProjects.length > 0 ? [`Begin scoping "${majorProjects[0].content}" as primary strategic differentiator - plan 6-12 month development timeline`] : []),
          ...(hasMobileFeatures ? ['Develop mobile-first user experience strategy to capture 67% mobile user preference'] : []),
          ...(hasAnalyticsFeatures ? ['Build data monetization strategy - analytics products typically generate 15-25% of revenue'] : []),
          ...(hasMarketingFeatures ? ['Execute go-to-market strategy leveraging marketing automation and viral growth mechanisms'] : ['Execute go-to-market strategy with focus on user acquisition and retention']),
          'Establish pricing strategy and customer success processes for sustainable growth'
        ].slice(0, 5),
        longTerm: [
          ...(thankless.length > 0 ? [`Revisit "${thankless[0]?.content || 'low-priority items'}" - may become strategic as market evolves`] : []),
          ...(hasAnalyticsFeatures && hasTechFeatures ? ['Build platform ecosystem enabling third-party integrations and data partnerships'] : []),
          'Scale to adjacent market segments and geographic expansion opportunities',
          ...(hasMobileFeatures ? ['Expand mobile platform capabilities to capture emerging mobile commerce trends'] : []),
          'Position for strategic exit through category leadership and acquisition-ready operations'
        ].slice(0, 5)
      },
      
      riskAssessment: {
        highRisk: [
          'Market Entry Timing: Large incumbents could preempt with competing offerings. Risk mitigation: accelerate MVP and secure key customers',
          'Customer Acquisition Economics: CAC payback period >18 months threatens unit economics. Monitor LTV:CAC ratio closely (target 3:1)',
          'Competitive Response: Well-funded competitors could launch price wars or copy core features. Build defensible IP and network effects',
          'Regulatory Changes: Industry regulation could impact business model viability. Maintain compliance and regulatory relationships',
          'Team Scalability: Key person dependency on founders threatens growth. Implement knowledge transfer and succession planning',
          'Technology Obsolescence: Platform dependencies create vulnerability. Diversify tech stack and maintain architectural flexibility'
        ],
        opportunities: [
          'Market Consolidation Play: Fragmented market ready for consolidation - position as category leader and acquisition target',
          'Economic Tailwinds: Macro trends (remote work, digital transformation) accelerate demand by 200-300% in target segments',
          'Strategic Acquirer Interest: Solution addresses core needs for 5+ Fortune 500 potential acquirers seeking digital capabilities',
          'International Expansion: Model proven in US market can scale to EU/APAC with 60% revenue upside and premium valuations',
          'Adjacent Market Penetration: Core platform can address $8B adjacent market with minimal product modifications',
          'Data Monetization: User behavior data creates $20M+ annual revenue potential through insights and benchmarking products'
        ]
      },
      
      suggestedRoadmap: [
        {
          phase: 'Quick Wins Execution',
          duration: '0-3 months',
          focus: `Launch ${quickWins.length} quick wins to prove traction and validate core assumptions. Build momentum with early adopters.`,
          ideas: quickWins.map(i => i.content).slice(0, 3)
        },
        {
          phase: 'Strategic Development',
          duration: '3-12 months', 
          focus: `Build ${majorProjects.length} major initiatives as competitive differentiators. ${hasAnalyticsFeatures ? 'Focus on data capabilities for long-term moats.' : ''} ${hasMobileFeatures ? 'Prioritize mobile experience for market leadership.' : ''}`,
          ideas: majorProjects.map(i => i.content).slice(0, 2)
        },
        {
          phase: 'Market Expansion & Scale',
          duration: '12+ months',
          focus: `Scale proven capabilities and expand market reach. ${hasAnalyticsFeatures ? 'Monetize data insights and build platform ecosystem.' : ''} Position for category leadership.`,
          ideas: [...fillIns.map(i => i.content).slice(0, 2), 'Strategic partnerships', 'International expansion']
        }
      ],
      
      resourceAllocation: {
        quickWins: 'Capital Efficiency Strategy: Allocate 30% of funding ($600K-900K) to high-velocity experiments and market validation activities. Focus on initiatives with <3 month payback periods and proven customer traction. Target: 5x faster learning cycles than traditional development.',
        strategic: 'Growth Investment Focus: Deploy 70% of capital ($1.4M-2.1M) in scalable growth engines - product development, sales team, and strategic partnerships. Prioritize initiatives with defendable competitive advantages and 10x revenue potential. Maintain 18-month runway while achieving growth milestones.'
      },
      
      nextSteps: [
        ...(quickWins.length > 0 ? [`Immediate: Start development of "${quickWins[0].content}" - highest ROI opportunity with 30-60 day implementation timeline`] : []),
        ...(hasUserFeatures ? ['Week 1-2: Launch user interviews focusing on pain points around user experience and feature priorities'] : ['Week 1-2: Conduct market research to validate core product assumptions']),
        ...(majorProjects.length > 0 ? [`Month 2: Create detailed technical specification for "${majorProjects[0].content}" with resource requirements and timeline`] : []),
        ...(hasAnalyticsFeatures ? ['Month 1: Implement basic analytics tracking to establish baseline metrics for data-driven decisions'] : []),
        ...(hasTechFeatures ? ['Month 1-2: Finalize technical architecture decisions and establish development infrastructure'] : []),
        ...(hasMarketingFeatures ? ['Month 2-3: Build go-to-market strategy leveraging marketing capabilities as competitive advantage'] : ['Month 2-3: Develop customer acquisition and retention strategy']),
        'Month 3: Establish funding strategy and begin investor outreach with traction metrics and product roadmap'
      ].slice(0, 7)
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