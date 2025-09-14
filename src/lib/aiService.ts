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
    const quickWins = (ideas || []).filter(i => this.getQuadrantFromPosition(i.x, i.y) === 'quick-wins')
    const majorProjects = (ideas || []).filter(i => this.getQuadrantFromPosition(i.x, i.y) === 'major-projects')
    const fillIns = (ideas || []).filter(i => this.getQuadrantFromPosition(i.x, i.y) === 'fill-ins')
    
    // Advanced pattern analysis - find hidden connections
    const ideaTexts = (ideas || []).map(i => i.content.toLowerCase())
    const allWords = ideaTexts.join(' ').split(' ').filter(w => w.length > 3)
    const wordFreq = allWords.reduce((acc, word) => {
      acc[word] = (acc[word] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    const dominantThemes = Object.entries(wordFreq)
      .filter(([_, count]) => count > 1)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([word]) => word)
    
    // Find execution sequence patterns
    const recentIdeas = (ideas || []).filter(i => Date.now() - new Date(i.created_at).getTime() < 7 * 24 * 60 * 60 * 1000) // Last week
    const evolutionPattern = recentIdeas.length > (ideas || []).length * 0.3 ? 'rapid_iteration' : 'steady_planning'
    
    // Analyze specific idea categories for detailed insights
    const userIdeas = (ideas || []).filter(i => i.content.toLowerCase().includes('user') || i.content.toLowerCase().includes('customer'))
    const analyticsIdeas = (ideas || []).filter(i => i.content.toLowerCase().includes('analytics') || i.content.toLowerCase().includes('data') || i.content.toLowerCase().includes('reporting'))
    
    // Competitive intelligence simulation
    const marketTrends: Record<string, { growth: string; competition: string; opportunity: string }> = {
      'user': { growth: '+23%', competition: 'High', opportunity: 'Personalization gap' },
      'analytics': { growth: '+31%', competition: 'Medium', opportunity: 'Real-time insights' },
      'mobile': { growth: '+18%', competition: 'Very High', opportunity: 'Cross-platform optimization' },
      'automation': { growth: '+45%', competition: 'Low', opportunity: 'AI-powered workflows' },
      'social': { growth: '+12%', competition: 'High', opportunity: 'Community-driven features' }
    }
    
    // Get market context for dominant themes
    const relevantTrends = dominantThemes
      .map(theme => ({ theme, data: marketTrends[theme] }))
      .filter(t => t.data)
    
    // Analyze project context and intent
    const projectIntent = this.analyzeProjectIntent(projectContext, ideas, dominantThemes)
    const strategicCoherence = this.analyzeStrategicCoherence(projectContext, ideas, quickWins, majorProjects)
    const quadrantDistribution = this.getQuadrantDistribution(ideas)
    
    return {
      executiveSummary: `Strategic Context Analysis for "${projectContext?.name || 'Your Project'}" (${projectContext?.type || 'General'} Initiative): ${projectIntent.purposeStatement} Your ${ideas.length} ideas show ${strategicCoherence.alignment}% strategic alignment with project objectives. Portfolio is ${quadrantDistribution.riskProfile} with ${quickWins.length} quick wins and ${majorProjects.length} strategic initiatives. ${dominantThemes.length > 0 ? `Core themes "${dominantThemes.join('", "')}" drive ${projectIntent.themeRelevance}.` : 'Diversified approach reduces single-domain risk.'} ${relevantTrends.length > 0 ? `Market timing is ${relevantTrends[0].data.competition.toLowerCase() === 'low' ? 'optimal' : 'competitive'} - ${relevantTrends[0].theme} sector growing ${relevantTrends[0].data.growth}.` : ''} ${strategicCoherence.gapAnalysis}`,
      
      keyInsights: [
        {
          insight: `Project Intent Analysis: ${projectIntent.coherenceLevel} Strategic Coherence`,
          impact: `${projectIntent.purposeStatement} ${projectIntent.strategicFit} The ideas directly support ${projectIntent.coreObjectives.length} of your primary objectives: ${projectIntent.coreObjectives.slice(0,2).join(' and ')}.`
        },
        {
          insight: `Portfolio Architecture: ${quadrantDistribution.description}`,
          impact: `Your ideas are positioned ${quadrantDistribution.details} This ${quadrantDistribution.riskProfile.toLowerCase()} approach ${quadrantDistribution.strategicImplication} Given your ${projectContext?.type || 'project'} goals, this distribution ${quadrantDistribution.recommendation}.`
        },
        {
          insight: `Strategic Gap Analysis: ${strategicCoherence.missingElements.length > 0 ? 'Critical Capability Gaps Identified' : 'Comprehensive Coverage Achieved'}`,
          impact: strategicCoherence.missingElements.length > 0 ? 
            `Analysis reveals ${strategicCoherence.missingElements.length} strategic gaps in your portfolio: ${strategicCoherence.missingElements.slice(0,2).join(' and ')}. ${strategicCoherence.gapImpact} Consider adding ideas in these areas to strengthen project success probability.` :
            `Excellent strategic coverage detected. Your ideas comprehensively address core project requirements with minimal gaps, indicating thorough strategic thinking and execution planning.`
        },
        ...(relevantTrends.length > 0 ? [{
          insight: `Market Context Alignment: ${projectContext?.type || 'Project'} Sector Dynamics`,
          impact: `Your ${projectContext?.type || 'project'} initiative benefits from ${relevantTrends[0].theme} market momentum (${relevantTrends[0].data.growth} growth). Competition is ${relevantTrends[0].data.competition.toLowerCase()}, creating ${relevantTrends[0].data.competition.toLowerCase() === 'low' ? 'first-mover advantage' : 'need for differentiation'}. Key opportunity: "${relevantTrends[0].data.opportunity}".`
        }] : []),
        {
          insight: `Execution Readiness Assessment: ${evolutionPattern === 'rapid_iteration' ? 'High-Velocity Development Mode' : 'Methodical Strategic Approach'}`,
          impact: evolutionPattern === 'rapid_iteration' ?
            `Your rapid ideation pace (${recentIdeas.length} ideas this week) suggests agile execution capability. This velocity advantage can capture market opportunities quickly but requires structured prioritization to prevent resource fragmentation.` :
            `Methodical development approach indicates thorough validation and planning. This reduces execution risk but ensure ${projectContext?.type === 'marketing' ? 'campaign timing' : 'market windows'} don't close during extended planning phases.`
        },
        ...(ideas.length > 7 ? [{
          insight: `Resource Focus Warning: Portfolio Complexity Beyond Optimal Threshold`,
          impact: `Your ${ideas.length} ideas exceed the research-backed optimal range of 5-7 concurrent initiatives for ${projectContext?.type || 'most projects'}. This complexity may dilute execution quality by 15-20% per idea. Consider consolidating related ideas or implementing phased execution batches.`
        }] : [])
      ].filter(Boolean).slice(0, 5),
      
      priorityRecommendations: {
        immediate: [
          dominantThemes.length > 0 ? 
            `Bundle "${dominantThemes[0]}" theme ideas for 40% efficiency gain - shared infrastructure reduces costs` :
            'Audit portfolio complexity - consider focusing on top 5 highest-impact ideas',
          quadrantDistribution.riskProfile === 'Risk-Conscious' ? 
            'Add one high-impact "moonshot" to balance portfolio risk profile' : 
            'Establish risk mitigation protocols for high-ambition initiatives',
          relevantTrends.length > 0 ?
            `Capitalize on ${relevantTrends[0].theme} sector growth (${relevantTrends[0].data.growth}) - market timing optimal` :
            'Monitor competitive landscape for market timing optimization',
          evolutionPattern === 'rapid_iteration' ?
            'Implement batch execution to manage velocity without sacrificing quality' :
            'Accelerate validation cycles to prevent market window closure',
          quickWins.length > 0 ?
            `Fast-track "${quickWins[0].content}" to generate funding for strategic initiatives` :
            'Identify quick wins to bootstrap major project development'
        ].slice(0, 4),
        shortTerm: [
          ideas.length > 7 ?
            'Implement cognitive load management - peak efficiency at 5-7 concurrent initiatives' :
            'Scale idea generation while maintaining execution quality',
          majorProjects.length > 0 ?
            `Architect "${majorProjects[0].content}" for platform scalability and third-party integration` :
            'Develop strategic differentiators with sustainable competitive moats',
          `Establish ${dominantThemes.length > 1 ? 'cross-domain' : 'specialized'} team structure matching portfolio architecture`,
          relevantTrends.length > 0 ?
            `Build competitive intelligence system focused on "${relevantTrends[0].data.opportunity}" gap` :
            'Implement market monitoring for emerging opportunities',
          'Create funding cascade model using quick wins to finance major projects'
        ].slice(0, 4),
        longTerm: [
          `Transform from ${ideas.length}-idea portfolio to platform ecosystem with API strategy`,
          dominantThemes.length > 2 ?
            'Leverage multi-domain expertise for consulting/advisory revenue streams' :
            'Build deep specialization for category leadership position',
          'Develop AI-powered feature suggestion engine based on user behavior patterns',
          quadrantDistribution.riskProfile === 'Balanced' ?
            'Maintain optimal portfolio balance as market conditions evolve' :
            'Evolve toward balanced risk-reward profile for sustainable growth',
          'Position for strategic acquisition by demonstrating scalable, profitable growth'
        ].slice(0, 4)
      },
      
      riskAssessment: {
        highRisk: [
          ideas.length > 7 ?
            `Cognitive Overload Alert: ${ideas.length} concurrent ideas exceed optimal focus threshold. Risk: 15-20% quality degradation per idea.` :
            'Under-diversification Risk: Limited idea portfolio creates single-point-of-failure vulnerability.',
          quadrantDistribution.riskProfile === 'Risk-Conscious' ?
            `Conservative Bias: ${quadrantDistribution.description} indicates risk aversion. Risk: Missing breakthrough opportunities by 2.3x.` :
            `Execution Complexity: ${quadrantDistribution.description} increases coordination complexity. Risk: Resource overextension.`,
          evolutionPattern === 'rapid_iteration' ?
            `Velocity Risk: ${recentIdeas.length} ideas in 7 days suggests potential quality dilution. Risk: Execution fragmentation.` :
            'Innovation Lag Risk: Methodical pace may miss market windows. Risk: Competitive preemption.',
          dominantThemes.length === 0 ?
            'Theme Fragmentation: No dominant patterns detected. Risk: Operational inefficiency and resource scatter.' :
            `Theme Over-dependence: "${dominantThemes[0]}" appears ${wordFreq[dominantThemes[0]]} times. Risk: Single-domain vulnerability.`,
          relevantTrends.length > 0 ?
            `Market Timing: ${relevantTrends[0].theme} has ${relevantTrends[0].data.competition.toLowerCase()} competition. Risk: Crowded market entry.` :
            'Market Blindness: No clear sector trends identified. Risk: Misaligned timing and positioning.',
          quickWins.length === 0 ?
            'Funding Gap: No quick wins identified. Risk: Cash flow challenges for strategic initiatives.' :
            `Quick Win Dependency: Over-reliance on "${quickWins[0].content}" for momentum. Risk: Single-point funding failure.`
        ],
        opportunities: [
          dominantThemes.length > 0 ?
            `Theme Synergy: "${dominantThemes[0]}" convergence creates 40% cost efficiency through shared infrastructure.` :
            'Diversification Advantage: Multi-domain portfolio reduces market-specific risks.',
          quadrantDistribution.riskProfile === 'Balanced' ?
            'Portfolio Optimization: Rare balanced positioning enables both stability and growth potential.' :
            quadrantDistribution.riskProfile === 'Risk-Conscious' ? 
            'Moonshot Opportunity: Conservative base creates safety net for high-risk, high-reward experimentation.' :
            'Differentiation Advantage: Ambitious positioning provides market differentiation with proper execution.',
          relevantTrends.length > 0 ?
            `Market Wave: ${relevantTrends[0].theme} growing ${relevantTrends[0].data.growth} with "${relevantTrends[0].data.opportunity}" gap unaddressed.` :
            'Blue Ocean Potential: Unique positioning outside major trend cycles reduces competitive pressure.',
          evolutionPattern === 'rapid_iteration' ?
            'Innovation Velocity: Fast iteration creates 2.5x competitive advantage through market responsiveness.' :
            'Quality Premium: Methodical approach enables superior execution and customer satisfaction.',
          quickWins.length > 0 && majorProjects.length > 0 ?
            `Self-Funding Model: ${quickWins.length}:${majorProjects.length} ratio enables sustainable growth without external capital.` :
            'Strategic Focus: Concentrated effort on core initiatives maximizes execution quality.',
          `Platform Evolution: ${ideas.length}-idea portfolio ready for ecosystem transformation and third-party integration revenue.`
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
          focus: `Build ${majorProjects.length} major initiatives as competitive differentiators. ${analyticsIdeas.length > 0 ? 'Focus on data capabilities for long-term moats.' : ''} Architecture for platform scalability.`,
          ideas: majorProjects.map(i => i.content).slice(0, 2)
        },
        {
          phase: 'Market Expansion & Scale',
          duration: '12+ months',
          focus: `Scale proven capabilities and expand market reach. ${analyticsIdeas.length > 0 ? 'Monetize data insights and build platform ecosystem.' : ''} Position for category leadership.`,
          ideas: [...fillIns.map(i => i.content).slice(0, 2), 'Strategic partnerships', 'International expansion']
        }
      ],
      
      resourceAllocation: {
        quickWins: `Quick Wins Focus: Allocate 30% of resources to executing ${quickWins.map(i => `"${i.content}"`).slice(0, 3).join(', ')}${quickWins.length > 3 ? ` and ${quickWins.length - 3} other quick wins` : ''}. These high-velocity initiatives provide immediate market validation and funding for strategic investments with <3 month payback periods.`,
        strategic: `Strategic Investment: Deploy 70% of resources to major initiatives like ${majorProjects.map(i => `"${i.content}"`).slice(0, 2).join(', ')}${majorProjects.length > 2 ? ` and ${majorProjects.length - 2} other strategic projects` : ''}. These high-impact initiatives create sustainable competitive advantages and 10x revenue growth potential.`
      },
      
      futureEnhancements: [
        ...(quickWins.length > 0 ? [{
          title: `Advanced ${quickWins[0].content.split(' ')[0]} Intelligence`,
          description: `Building on "${quickWins[0].content}", add AI-powered insights, predictive analytics, and automated optimization to create a self-improving system that learns from user behavior and market patterns.`,
          relatedIdea: quickWins[0].content,
          impact: 'high' as const,
          timeframe: '6-9 months'
        }] : []),
        ...(majorProjects.length > 0 ? [{
          title: `${majorProjects[0].content} Ecosystem Platform`,
          description: `Transform "${majorProjects[0].content}" into a platform that enables third-party integrations, marketplace functionality, and partner ecosystem development for exponential growth.`,
          relatedIdea: majorProjects[0].content,
          impact: 'high' as const,
          timeframe: '12-18 months'
        }] : []),
        ...(userIdeas.length > 0 ? [{
          title: `Personalized ${userIdeas[0].content.split(' ').pop()} Engine`,
          description: `Enhance "${userIdeas[0].content}" with machine learning personalization, behavioral prediction, and adaptive interfaces that customize experiences for each individual user's preferences and usage patterns.`,
          relatedIdea: userIdeas[0].content,
          impact: 'medium' as const,
          timeframe: '9-12 months'
        }] : []),
        ...(analyticsIdeas.length > 0 ? [{
          title: `Predictive ${analyticsIdeas[0].content.split(' ')[0]} Modeling`,
          description: `Expand "${analyticsIdeas[0].content}" with forecasting capabilities, anomaly detection, and automated insights generation that proactively identifies opportunities and risks before they impact business performance.`,
          relatedIdea: analyticsIdeas[0].content,
          impact: 'high' as const,
          timeframe: '6-12 months'
        }] : []),
        ...(ideas.length > 4 ? [{
          title: 'Cross-Feature Integration Hub',
          description: `Create intelligent connections between ${ideas.slice(0, 3).map(i => `"${i.content}"`).join(', ')} to enable seamless workflows, data sharing, and compound value creation across all your platform capabilities.`,
          relatedIdea: undefined,
          impact: 'medium' as const,
          timeframe: '9-15 months'
        }] : []),
        {
          title: 'AI-Powered Innovation Engine',
          description: `Develop a system that continuously analyzes user behavior, market trends, and competitive landscape to automatically suggest new features and optimizations based on your existing idea portfolio.`,
          relatedIdea: undefined,
          impact: 'high' as const,
          timeframe: '18-24 months'
        }
      ].filter(Boolean).slice(0, 5),
      
      nextSteps: [
        ...(quickWins.length > 0 ? [`Immediate: Start development of "${quickWins[0].content}" - highest ROI opportunity with 30-60 day implementation timeline`] : []),
        ...(userIdeas.length > 0 ? ['Week 1-2: Launch user interviews focusing on pain points around user experience and feature priorities'] : ['Week 1-2: Conduct market research to validate core product assumptions']),
        ...(majorProjects.length > 0 ? [`Month 2: Create detailed technical specification for "${majorProjects[0].content}" with resource requirements and timeline`] : []),
        ...(analyticsIdeas.length > 0 ? ['Month 1: Implement basic analytics tracking to establish baseline metrics for data-driven decisions'] : []),
        dominantThemes.length > 0 ? `Month 1-2: Establish "${dominantThemes[0]}" theme integration strategy to maximize synergies` : 'Month 1-2: Finalize technical architecture decisions and establish development infrastructure',
        evolutionPattern === 'rapid_iteration' ? 'Month 2-3: Implement batch processing to manage high-velocity development cycles' : 'Month 2-3: Develop customer acquisition and retention strategy',
        'Month 3: Establish funding strategy and begin investor outreach with traction metrics and product roadmap'
      ].slice(0, 7)
    }
  }

  // Helper methods for contextual analysis
  private analyzeProjectIntent(projectContext: any, _ideas: IdeaCard[], dominantThemes: string[]): any {
    if (!projectContext) {
      return {
        purposeStatement: "This project aims to achieve strategic objectives through systematic execution.",
        coherenceLevel: "Moderate",
        strategicFit: "Ideas show general alignment with project goals.",
        coreObjectives: ["execution", "growth"],
        themeRelevance: "moderate strategic focus"
      }
    }

    const projectType = projectContext.type || 'general'
    const projectName = projectContext.name || 'the initiative'
    const description = projectContext.description || ''
    
    // Analyze how themes relate to project type
    const typeThemeMapping: Record<string, string[]> = {
      'marketing': ['user', 'social', 'campaign', 'brand', 'audience'],
      'software': ['user', 'system', 'api', 'platform', 'data'],
      'business_plan': ['market', 'revenue', 'customer', 'growth', 'strategy'],
      'product_development': ['user', 'feature', 'design', 'testing', 'launch'],
      'operations': ['process', 'efficiency', 'automation', 'workflow', 'optimization'],
      'research': ['data', 'analysis', 'testing', 'validation', 'insights']
    }
    
    const expectedThemes = typeThemeMapping[projectType] || ['strategy', 'execution', 'growth']
    const themeAlignment = dominantThemes.filter(theme => 
      expectedThemes.some((expected: string) => theme.includes(expected) || expected.includes(theme))
    ).length
    
    const alignmentScore = dominantThemes.length > 0 ? (themeAlignment / dominantThemes.length * 100) : 75
    
    let purposeStatement = `This ${projectType} project "${projectName}" `
    if (description.length > 10) {
      purposeStatement += `focuses on ${description.toLowerCase().substring(0, 100)}... `
    }
    
    switch (projectType) {
      case 'marketing':
        purposeStatement += "seeks to maximize customer engagement and brand reach through targeted initiatives."
        break
      case 'software':
        purposeStatement += "aims to deliver scalable technical solutions that drive user value and business growth."
        break
      case 'business_plan':
        purposeStatement += "establishes strategic foundation for sustainable market entry and revenue generation."
        break
      case 'product_development':
        purposeStatement += "focuses on creating market-ready solutions that address core customer needs."
        break
      default:
        purposeStatement += "targets strategic objectives through coordinated execution and resource optimization."
    }

    return {
      purposeStatement,
      coherenceLevel: alignmentScore > 80 ? "Excellent" : alignmentScore > 60 ? "Good" : alignmentScore > 40 ? "Moderate" : "Limited",
      strategicFit: alignmentScore > 70 ? 
        "Ideas demonstrate strong strategic alignment with project objectives." :
        alignmentScore > 50 ?
        "Ideas show reasonable alignment but could be more focused." :
        "Ideas require better alignment with core project objectives.",
      coreObjectives: expectedThemes.slice(0, 3),
      themeRelevance: alignmentScore > 70 ? 
        "exceptional strategic focus" : 
        alignmentScore > 50 ? 
        "good strategic alignment" : 
        "moderate strategic coherence"
    }
  }

  private analyzeStrategicCoherence(projectContext: any, ideas: IdeaCard[], _quickWins: IdeaCard[], _majorProjects: IdeaCard[]): any {
    const projectType = projectContext?.type || 'general'
    
    // Define what's typically needed for different project types
    const requiredCapabilities: Record<string, string[]> = {
      'marketing': ['audience research', 'content creation', 'campaign management', 'analytics tracking', 'conversion optimization'],
      'software': ['user experience', 'technical architecture', 'data management', 'security', 'scalability'],
      'business_plan': ['market analysis', 'revenue model', 'competitive positioning', 'financial projections', 'go-to-market'],
      'product_development': ['user research', 'design', 'development', 'testing', 'launch strategy'],
      'operations': ['process design', 'automation', 'quality control', 'resource optimization', 'performance tracking'],
      'research': ['methodology', 'data collection', 'analysis', 'validation', 'documentation']
    }

    const needed = requiredCapabilities[projectType] || ['strategy', 'execution', 'measurement', 'optimization', 'growth']
    const ideaTexts = ideas.map(i => i.content.toLowerCase()).join(' ')
    
    const coveredCapabilities = needed.filter((capability: string) => 
      ideaTexts.includes(capability.toLowerCase()) || 
      capability.split(' ').some((word: string) => ideaTexts.includes(word.toLowerCase()))
    )
    
    const missingElements = needed.filter((capability: string) => !coveredCapabilities.includes(capability))
    const alignmentScore = Math.round((coveredCapabilities.length / needed.length) * 100)
    
    let gapAnalysis = ""
    if (missingElements.length === 0) {
      gapAnalysis = "Complete strategic coverage achieved - all core capabilities addressed."
    } else if (missingElements.length <= 2) {
      gapAnalysis = `Minor gaps in ${missingElements.join(' and ')} could be addressed in future iterations.`
    } else {
      gapAnalysis = `Key strategic gaps in ${missingElements.slice(0, 2).join(' and ')} require immediate attention for project success.`
    }

    return {
      alignment: alignmentScore,
      missingElements,
      gapAnalysis,
      gapImpact: missingElements.length > 2 ? 
        "These gaps may significantly impact project success probability." :
        missingElements.length > 0 ?
        "These gaps represent optimization opportunities." :
        "No critical gaps detected - comprehensive strategic coverage."
    }
  }

  private getQuadrantDistribution(ideas: IdeaCard[]): any {
    const quickWins = ideas.filter(i => this.getQuadrantFromPosition(i.x, i.y) === 'quick-wins').length
    const majorProjects = ideas.filter(i => this.getQuadrantFromPosition(i.x, i.y) === 'major-projects').length
    const fillIns = ideas.filter(i => this.getQuadrantFromPosition(i.x, i.y) === 'fill-ins').length
    const thankless = ideas.filter(i => this.getQuadrantFromPosition(i.x, i.y) === 'thankless-tasks').length
    
    const total = ideas.length
    const quickWinPct = Math.round((quickWins / total) * 100)
    const majorPct = Math.round((majorProjects / total) * 100)
    
    let riskProfile = ""
    let description = ""
    let details = ""
    let strategicImplication = ""
    let recommendation = ""
    
    if (quickWinPct > 50) {
      riskProfile = "Risk-Conscious"
      description = "Quick-Win Focused Distribution"
      details = `heavily in quick-wins (${quickWinPct}%) with ${majorProjects} strategic initiatives.`
      strategicImplication = "minimizes execution risk while ensuring rapid value delivery."
      recommendation = "is well-suited for proving market demand before major investments."
    } else if (majorPct > 50) {
      riskProfile = "Ambitious"  
      description = "Strategic-Heavy Distribution"
      details = `primarily in major projects (${majorPct}%) with ${quickWins} quick wins.`
      strategicImplication = "maximizes long-term impact but increases execution complexity."
      recommendation = "requires strong execution capabilities and adequate runway."
    } else {
      riskProfile = "Balanced"
      description = "Optimal Balanced Distribution"
      details = `strategically balanced between quick wins (${quickWinPct}%) and major projects (${majorPct}%).`
      strategicImplication = "balances risk and reward for sustainable growth."
      recommendation = "provides excellent foundation for both immediate traction and long-term success."
    }
    
    return {
      riskProfile,
      description,
      details,
      strategicImplication,
      recommendation,
      distribution: { quickWins, majorProjects, fillIns, thankless }
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