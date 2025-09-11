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
        return data.ideas.map((idea: any, index: number) => ({
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

  async generateInsights(ideas: IdeaCard[], projectName?: string, projectType?: string): Promise<any> {
    logger.debug('🔍 Generating insights for', ideas.length, 'ideas')
    
    try {
      const headers = await this.getAuthHeaders()
      const response = await fetch(`${this.baseUrl}/api/ai/generate-insights`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ideas: ideas.map(idea => ({
            title: idea.content,
            description: idea.details,
            quadrant: this.getQuadrantFromPosition(idea.x, idea.y)
          })),
          projectName: projectName || 'Project',
          projectType: projectType || 'General'
        })
      })

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please wait a moment before trying again.')
        }
        throw new Error(`Server error: ${response.status}`)
      }

      const data = await response.json()
      return data.insights || this.generateMockInsights(ideas)

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
          ideas: ideas.map(idea => ({
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
      
      // Transform API response to match expected component format
      return {
        roadmapAnalysis: {
          totalDuration: roadmap.timeline || '3-6 months',
          phases: roadmap.phases || []
        },
        executionStrategy: {
          methodology: 'Agile',
          teamStructure: 'Cross-functional',
          deliveryApproach: 'Iterative'
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

    return ideas.slice(0, count).map((idea, index) => ({
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

  private generateMockInsights(ideas: IdeaCard[]): any {
    return {
      matrixAnalysis: {
        quickWins: ideas.filter(i => this.getQuadrantFromPosition(i.x, i.y) === 'quick-wins').map(i => i.content),
        majorProjects: ideas.filter(i => this.getQuadrantFromPosition(i.x, i.y) === 'major-projects').map(i => i.content),
        fillIns: ideas.filter(i => this.getQuadrantFromPosition(i.x, i.y) === 'fill-ins').map(i => i.content),
        thanklessItems: ideas.filter(i => this.getQuadrantFromPosition(i.x, i.y) === 'thankless-tasks').map(i => i.content)
      },
      priorityRecommendations: [
        'Focus on quick wins first to build momentum',
        'Plan major projects with adequate resources',
        'Use fill-ins for capacity balancing'
      ],
      riskAssessments: [
        'Resource allocation may be challenging',
        'Timeline dependencies need careful management',
        'Stakeholder alignment is critical'
      ],
      resourceOptimization: [
        'Consider cross-functional teams',
        'Leverage existing infrastructure'
      ],
      nextSteps: [
        'Validate assumptions with stakeholders',
        'Create detailed implementation plan',
        'Set up progress tracking'
      ]
    }
  }

  private generateMockRoadmap(projectName: string, _projectType?: string): any {
    return {
      roadmapAnalysis: {
        totalDuration: '3-4 months',
        phases: [
          {
            id: 'phase-1',
            name: 'Foundation & Planning',
            description: 'Establish project foundations and detailed planning',
            duration: '2-3 weeks',
            objectives: ['Define requirements', 'Set up infrastructure', 'Establish team'],
            epics: [
              {
                id: 'epic-1',
                title: 'Project Setup',
                description: 'Initial project setup and configuration',
                priority: 'High',
                stories: ['Setup development environment', 'Configure CI/CD pipeline'],
                deliverables: ['Development environment', 'Project documentation'],
                relatedIdeas: ['Quick Setup Process']
              }
            ],
            risks: ['Resource availability', 'Technical complexity'],
            successCriteria: ['Team onboarded', 'Infrastructure ready']
          }
        ]
      },
      executionStrategy: {
        methodology: 'Agile',
        teamStructure: 'Cross-functional',
        deliveryApproach: 'Iterative'
      }
    }
  }
}

// Export singleton instance
export const aiService = new SecureAIService()
export default aiService