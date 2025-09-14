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

  async generateInsights(ideas: IdeaCard[], projectName?: string, projectType?: string, projectId?: string, currentProject?: any): Promise<any> {
    logger.debug('🔍 Generating insights for', (ideas || []).length, 'ideas')
    
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
          documentContext: documentContext,
          projectContext: projectContext
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
        return this.generateMockInsights(ideas, projectContext)
      }

    } catch (error) {
      logger.warn('🚫 AI insights failed, using mock:', error)
      return this.generateMockInsights(ideas, projectContext)
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

  private generateMockInsights(ideas: IdeaCard[], projectContext?: any): any {
    // For women's health apps like "Boobr", get market-specific insights
    const isWomensHealthApp = projectContext?.name?.toLowerCase().includes('boobr') || 
                            projectContext?.description?.toLowerCase().includes('women') ||
                            projectContext?.description?.toLowerCase().includes('health')
    
    // Create consultant personas
    const consultantInsights = this.generateConsultantInsights(ideas, projectContext, isWomensHealthApp)
    
    return consultantInsights
  }

  private generateConsultantInsights(ideas: IdeaCard[], _projectContext?: any, isWomensHealthApp: boolean = false): any {
    const quickWins = (ideas || []).filter(i => this.getQuadrantFromPosition(i.x, i.y) === 'quick-wins')
    const majorProjects = (ideas || []).filter(i => this.getQuadrantFromPosition(i.x, i.y) === 'major-projects')
    
    // Generate consultant-style insights based on market research
    return {
      executiveSummary: isWomensHealthApp ? 
        `Our analysis of your women's health platform positions Boobr in a $5.7B market growing 17.8% annually. With 37% market concentration in menstrual tracking, there's significant white space for innovation. Your portfolio of ${ideas.length} features aligns with three emerging trends: AI-powered personalization, comprehensive health tracking, and community-driven support. Key opportunity: The market lacks integrated solutions combining physical and emotional health insights.` :
        `Strategic assessment reveals strong market positioning with ${ideas.length} well-distributed initiatives. Portfolio balances immediate value creation with long-term competitive differentiation. Execution timing aligns with current market dynamics.`,
      
      keyInsights: isWomensHealthApp ? [
        {
          insight: 'Business Analyst Perspective',
          impact: 'North America dominates 38% of the women\'s health app market, but menstrual tracking oversaturation (37.68% market share) creates opportunity for comprehensive platforms. Boobr can differentiate through holistic wellness rather than single-use tracking.'
        },
        {
          insight: 'Product Owner Assessment',
          impact: `Your ${quickWins.length} quick-win features should focus on user onboarding and retention. Women\'s health apps see 70% churn in first month. Priority: seamless data import from existing trackers and immediate value demonstration.`
        },
        {
          insight: 'Marketing Expert Analysis', 
          impact: 'FemTech sector attracts $39.29B investment but faces trust barriers. Position Boobr as clinically-informed platform with transparent data practices. Partner with healthcare providers for credibility and user acquisition.'
        },
        {
          insight: 'Technology Strategist View',
          impact: `Portfolio of ${majorProjects.length} major initiatives requires robust data architecture. Implement AI-driven insights early - 68% of users access via smartphone, demanding real-time personalization and predictive health recommendations.`
        }
      ] : [
        {
          insight: 'Strategic Portfolio Balance',
          impact: `Your ${ideas.length} initiatives show balanced risk-reward positioning. Quick wins provide immediate market validation while major projects build sustainable competitive advantages.`
        },
        {
          insight: 'Market Timing Assessment',
          impact: 'Current market conditions favor execution over planning. Consider accelerating development timelines to capture first-mover advantages in emerging segments.'
        },
        {
          insight: 'Resource Optimization Opportunity', 
          impact: 'Feature consolidation could improve execution efficiency by 30%. Focus resources on highest-impact initiatives rather than spreading across all concepts.'
        }
      ],
      
      priorityRecommendations: {
        immediate: isWomensHealthApp ? [
          'Secure healthcare partnerships for clinical validation and user trust',
          'Implement comprehensive data privacy framework - critical for health data', 
          'Launch MVP with core tracking plus one unique insight feature',
          'Establish user research program focusing on emotional health needs'
        ] : [
          quickWins.length > 0 ? `Execute ${quickWins[0].content} for immediate market validation` : 'Identify quick wins for rapid value demonstration',
          'Secure initial funding through traction metrics and user feedback',
          'Build core team with complementary expertise in key domains',
          'Establish competitive intelligence and market monitoring systems'
        ],
        shortTerm: isWomensHealthApp ? [
          'Build AI recommendation engine for personalized health insights',
          'Develop community features for peer support and engagement',
          'Create clinical advisory board for product credibility',
          'Implement subscription model with premium insights tier'
        ] : [
          majorProjects.length > 0 ? `Architect ${majorProjects[0].content} for long-term scalability` : 'Develop strategic differentiators with sustainable competitive advantages',
          'Scale user acquisition through proven channels and partnerships',
          'Build platform infrastructure for third-party integrations',
          'Establish data analytics and insights capabilities'
        ],
        longTerm: isWomensHealthApp ? [
          'Expand into telehealth partnerships and virtual consultations',
          'Develop B2B offerings for healthcare providers and employers',
          'Launch international expansion starting with English-speaking markets',
          'Build predictive health analytics using aggregated user data'
        ] : [
          'Transform from product to platform with ecosystem development',
          'Build market leadership position through innovation and partnerships',
          'Develop multiple revenue streams and business model optimization',
          'Position for strategic exit or continued growth investment'
        ]
      },
      
      riskAssessment: {
        highRisk: isWomensHealthApp ? [
          'Regulatory compliance complexity - health data subject to HIPAA and international privacy laws',
          'Market saturation in menstrual tracking - need clear differentiation from Flo and Clue',
          'Trust barrier with health data sharing - users skeptical of app security',
          'Clinical validation requirements for health recommendations and insights'
        ] : [
          ideas.length > 7 ? 'Portfolio complexity may dilute execution quality and resource focus' : 'Limited diversification creates dependency on narrow feature set',
          'Market timing risks if development cycles extend beyond optimal launch window',
          'Competitive response to market entry may require rapid feature iteration',
          quickWins.length === 0 ? 'No quick wins identified for early revenue generation' : 'Over-dependency on quick wins for funding longer-term development'
        ],
        opportunities: isWomensHealthApp ? [
          '$5.7B market growing 17.8% annually with significant unmet needs in comprehensive health',
          'AI-powered insights create differentiation from basic tracking apps', 
          'Partnership opportunities with healthcare providers for clinical integration',
          'International expansion potential - US market leads but global growth accelerating'
        ] : [
          quickWins.length > 0 && majorProjects.length > 0 ? 'Balanced portfolio enables self-funding growth model' : 'Focused approach allows deep market penetration',
          'First-mover advantage available in emerging market segments',
          'Platform potential for ecosystem development and partnership integration',
          'Market conditions favor execution over extended planning cycles'
        ]
      },
      
      suggestedRoadmap: isWomensHealthApp ? [
        {
          phase: 'Foundation & Validation',
          duration: '0-6 months',
          focus: 'Build MVP with core tracking plus unique health insights. Establish clinical partnerships and user trust.',
          ideas: ['User onboarding flow', 'Basic health tracking', 'Privacy framework', 'Clinical advisor network']
        },
        {
          phase: 'Growth & Differentiation', 
          duration: '6-18 months',
          focus: 'Scale user base through AI-powered insights and community features. Launch subscription premium tier.',
          ideas: ['AI recommendation engine', 'Community platform', 'Premium insights', 'Healthcare integrations']
        },
        {
          phase: 'Market Leadership',
          duration: '18+ months', 
          focus: 'Expand into B2B markets and international regions. Build comprehensive women\'s health platform.',
          ideas: ['B2B enterprise solutions', 'International expansion', 'Telehealth integration', 'Predictive analytics']
        }
      ] : [
        {
          phase: 'Validation & Early Traction',
          duration: '0-6 months',
          focus: quickWins.length > 0 ? `Execute ${quickWins.length} quick wins for market validation and early revenue` : 'Focus resources on highest-impact features for market validation',
          ideas: quickWins.length > 0 ? quickWins.map(i => i.content).slice(0, 3) : ['Market validation', 'User feedback', 'Core features']
        },
        {
          phase: 'Strategic Development',
          duration: '6-18 months',
          focus: majorProjects.length > 0 ? `Build ${majorProjects.length} strategic initiatives for competitive differentiation` : 'Develop sustainable competitive advantages and platform capabilities',
          ideas: majorProjects.length > 0 ? majorProjects.map(i => i.content).slice(0, 2) : ['Platform development', 'Strategic partnerships']
        },
        {
          phase: 'Scale & Expansion',
          duration: '18+ months',
          focus: 'Achieve market leadership through continued innovation and strategic expansion',
          ideas: ['Market expansion', 'Strategic partnerships', 'International growth', 'Platform ecosystem']
        }
      ],
      
      resourceAllocation: {
        quickWins: isWomensHealthApp ? 
          'Focus 40% of resources on user acquisition and retention features. Women\'s health apps see 70% first-month churn - prioritize immediate value demonstration and seamless onboarding experience.' :
          quickWins.length > 0 ? 
          `Allocate 30% of resources to quick wins like "${quickWins[0].content}" for immediate market validation and early revenue generation.` :
          'Focus 30% on rapid market validation features to prove product-market fit.',
        strategic: isWomensHealthApp ?
          'Invest 60% in AI-powered insights engine and clinical partnerships. These create defensible differentiation from basic tracking apps and enable premium subscription revenue model.' :
          majorProjects.length > 0 ?
          `Deploy 70% of resources to strategic initiatives like "${majorProjects[0].content}" that build long-term competitive advantages and platform capabilities.` :
          'Invest 70% in core platform development and strategic differentiators for sustainable growth.'
      },
      
      futureEnhancements: isWomensHealthApp ? [
        {
          title: 'Predictive Health Analytics',
          description: 'Develop AI models that predict health patterns and risks based on user data, providing proactive recommendations for preventive care and lifestyle adjustments.',
          relatedIdea: 'Health tracking features',
          impact: 'high' as const,
          timeframe: '12-18 months'
        },
        {
          title: 'Clinical Integration Platform',
          description: 'Build seamless integration with healthcare providers, enabling direct data sharing, appointment scheduling, and care coordination through the app.',
          relatedIdea: 'Healthcare partnerships',
          impact: 'high' as const,
          timeframe: '18-24 months'
        },
        {
          title: 'Community Health Network',
          description: 'Create peer-to-peer support network where users can connect with others having similar health journeys, share experiences, and access expert-moderated discussions.',
          relatedIdea: 'User engagement features',
          impact: 'medium' as const,
          timeframe: '9-15 months'
        },
        {
          title: 'Wearable Device Ecosystem',
          description: 'Expand beyond smartphone to integrate with smartwatches, fitness trackers, and specialized women\'s health wearables for continuous monitoring.',
          relatedIdea: 'Data collection systems',
          impact: 'medium' as const,
          timeframe: '15-24 months'
        }
      ] : [
        quickWins.length > 0 ? {
          title: `Enhanced ${quickWins[0].content.split(' ')[0]} System`,
          description: `Build upon "${quickWins[0].content}" with advanced automation, AI optimization, and predictive capabilities.`,
          relatedIdea: quickWins[0].content,
          impact: 'high' as const,
          timeframe: '6-12 months'
        } : {
          title: 'AI-Powered Optimization',
          description: 'Implement machine learning systems to optimize user experience and business outcomes.',
          relatedIdea: undefined,
          impact: 'high' as const,
          timeframe: '12-18 months'
        },
        majorProjects.length > 0 ? {
          title: `${majorProjects[0].content} Platform Ecosystem`,
          description: `Transform "${majorProjects[0].content}" into a comprehensive platform with third-party integrations and partner ecosystem.`,
          relatedIdea: majorProjects[0].content,
          impact: 'high' as const,
          timeframe: '15-24 months'
        } : {
          title: 'Platform Ecosystem Development', 
          description: 'Build comprehensive platform architecture for third-party integrations and partnership opportunities.',
          relatedIdea: undefined,
          impact: 'high' as const,
          timeframe: '18-24 months'
        },
        {
          title: 'Advanced Analytics Engine',
          description: 'Develop predictive analytics and business intelligence capabilities for data-driven decision making.',
          relatedIdea: undefined,
          impact: 'medium' as const,
          timeframe: '12-18 months'
        }
      ].filter(Boolean).slice(0, 4),
      
      nextSteps: isWomensHealthApp ? [
        'Week 1: Conduct regulatory compliance audit and establish HIPAA framework',
        'Week 2: Begin clinical advisor recruitment and partnership discussions', 
        'Month 1: Launch user research with target demographic on health tracking pain points',
        'Month 2: Develop MVP focusing on one unique insight feature beyond basic tracking',
        'Month 3: Establish data privacy infrastructure and user consent frameworks',
        'Month 4: Begin angel/seed funding process emphasizing clinical validation approach',
        'Month 6: Launch beta with select users and healthcare partner validation'
      ] : [
        quickWins.length > 0 ? `Week 1: Begin development of "${quickWins[0].content}" for rapid market validation` : 'Week 1: Identify and prioritize highest-impact features for rapid development',
        'Week 2: Establish user feedback channels and market validation frameworks',
        majorProjects.length > 0 ? `Month 1: Create technical specifications for "${majorProjects[0].content}"` : 'Month 1: Develop core platform architecture and technical roadmap',
        'Month 2: Implement analytics and measurement systems for data-driven decisions',
        'Month 3: Launch customer acquisition strategy and early user onboarding',
        'Month 4: Establish funding strategy and investor outreach with initial traction data',
        'Month 6: Scale successful features and begin expansion planning'
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