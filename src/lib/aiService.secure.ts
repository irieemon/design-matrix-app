import { IdeaCard } from '../types'

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
    this.baseUrl = config.baseUrl || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000')
    console.log('🔒 Secure AI Service initialized:', {
      baseUrl: this.baseUrl,
      mode: 'server-side-proxy'
    })
  }

  async generateIdea(title: string, projectContext?: { name?: string, description?: string, type?: string }): Promise<AIIdeaResponse> {
    console.log(`🧠 Generating idea for: "${title}" using secure server-side proxy`)
    
    try {
      // Call our secure serverless endpoint
      const response = await fetch(`${this.baseUrl}/api/ai/generate-ideas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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
      console.warn('🚫 AI generation failed, using mock:', error)
      return this.generateMockIdea(title, projectContext)
    }
  }

  async generateMultipleIdeas(title: string, description: string, projectType: string = 'General', count: number = 8): Promise<IdeaCard[]> {
    console.log(`🧠 Generating ${count} ideas for project: "${title}"`)
    
    try {
      const response = await fetch(`${this.baseUrl}/api/ai/generate-ideas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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
          title: idea.title,
          description: idea.description,
          quadrant: this.mapToQuadrant(idea.effort, idea.impact),
          tags: idea.category ? [idea.category] : [],
          contributor: 'AI Assistant',
          createdAt: new Date().toISOString()
        }))
      } else {
        return this.generateMockIdeas(title, description, projectType, count)
      }

    } catch (error) {
      console.warn('🚫 AI generation failed, using mock:', error)
      return this.generateMockIdeas(title, description, projectType, count)
    }
  }

  async generateInsights(ideas: IdeaCard[], projectName?: string, projectType?: string): Promise<any> {
    console.log('🔍 Generating insights for', ideas.length, 'ideas')
    
    try {
      const response = await fetch(`${this.baseUrl}/api/ai/generate-insights`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ideas: ideas.map(idea => ({
            title: idea.title,
            description: idea.description,
            quadrant: idea.quadrant
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
      console.warn('🚫 AI insights failed, using mock:', error)
      return this.generateMockInsights(ideas)
    }
  }

  async generateRoadmap(ideas: IdeaCard[], projectName: string, projectType?: string): Promise<any> {
    console.log('🗺️ Generating roadmap for project:', projectName)
    
    try {
      const response = await fetch(`${this.baseUrl}/api/ai/generate-roadmap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectName,
          projectType: projectType || 'General',
          ideas: ideas.map(idea => ({
            title: idea.title,
            description: idea.description,
            quadrant: idea.quadrant
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
      return data.roadmap || this.generateMockRoadmap(projectName, projectType)

    } catch (error) {
      console.warn('🚫 AI roadmap failed, using mock:', error)
      return this.generateMockRoadmap(projectName, projectType)
    }
  }

  // Helper methods
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

  // Mock implementations for fallback
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

  private generateMockIdeas(title: string, description: string, projectType: string, count: number): IdeaCard[] {
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
      title: idea.title,
      description: idea.description,
      quadrant: idea.quadrant,
      tags: [idea.category],
      contributor: 'AI Assistant',
      createdAt: new Date().toISOString()
    }))
  }

  private generateMockInsights(ideas: IdeaCard[]): any {
    return {
      matrixAnalysis: {
        quickWins: ideas.filter(i => i.quadrant === 'quick-wins').map(i => i.title),
        majorProjects: ideas.filter(i => i.quadrant === 'major-projects').map(i => i.title),
        fillIns: ideas.filter(i => i.quadrant === 'fill-ins').map(i => i.title),
        thanklessItems: ideas.filter(i => i.quadrant === 'thankless-tasks').map(i => i.title)
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

  private generateMockRoadmap(projectName: string, projectType?: string): any {
    return {
      id: `roadmap-${Date.now()}`,
      name: `${projectName} Strategic Roadmap`,
      description: `Comprehensive roadmap for ${projectName} project development`,
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
      ],
      timeline: '3-4 months',
      keyMilestones: ['MVP Launch', 'Beta Release', 'Production Deployment']
    }
  }
}

// Export singleton instance
export const aiService = new SecureAIService()
export default aiService