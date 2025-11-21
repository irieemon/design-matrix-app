import { IdeaCard } from '../../types'
import { logger } from '../../utils/logger'
import { aiCache, AICache } from '../aiCache'

interface AIIdeaResponse {
  content: string
  details: string
  priority: 'low' | 'moderate' | 'high' | 'strategic' | 'innovation'
}

interface ProjectContext {
  name?: string
  description?: string
  type?: string
}

interface SecureAIServiceConfig {
  baseUrl?: string
}

/**
 * AI Idea Generation Service
 *
 * Handles all AI-powered idea generation including single ideas,
 * multiple ideas, and idea enhancement functionality.
 */
export class AIIdeaService {
  private baseUrl: string

  constructor(config: SecureAIServiceConfig = {}) {
    if (config.baseUrl) {
      this.baseUrl = config.baseUrl
    } else if (typeof window !== 'undefined') {
      this.baseUrl = window.location.origin
    } else {
      this.baseUrl = 'http://localhost:3000'
    }

    logger.debug('🧠 AI Idea Service initialized', { baseUrl: this.baseUrl })
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
      // For now, use a placeholder
      headers['Authorization'] = 'Bearer placeholder-token'
    } catch (_error) {
      logger.warn('Failed to get auth headers:', error)
    }

    return headers
  }

  /**
   * Generate a single AI idea based on title and project context
   */
  async generateIdea(title: string, projectContext?: ProjectContext): Promise<AIIdeaResponse> {
    logger.debug(`🧠 Generating idea for: "${title}"`)

    const cacheKey = AICache.generateKey('generateIdea', {
      title: title.trim().toLowerCase(),
      projectContext: projectContext || {},
      timestamp: Math.floor(Date.now() / (5 * 60 * 1000)) // 5-minute cache buckets
    })

    return aiCache.getOrSet(cacheKey, async () => {
      try {
        const headers = await this.getAuthHeaders()
        const response = await fetch(`${this.baseUrl}/api/ai?action=generate-ideas`, {
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
          const idea = data.ideas[0]
          return {
            content: idea.title,
            details: idea.description,
            priority: this.mapPriorityLevel(idea.impact, idea.effort)
          }
        } else {
          return this.generateMockIdea(title, projectContext)
        }
      } catch (_error) {
        logger.error('Error generating idea:', error)
        return this.generateMockIdea(title, projectContext)
      }
    }, 10 * 60 * 1000) // 10 minute cache
  }

  /**
   * Generate multiple AI ideas for a project
   */
  async generateMultipleIdeas(
    title: string,
    description: string,
    projectType: string = 'General',
    count: number = 8,
    tolerance: number = 50
  ): Promise<IdeaCard[]> {
    logger.debug(`🧠 Generating ${count} ideas for project: "${title}" with ${tolerance}% tolerance`)

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
        const response = await fetch(`${this.baseUrl}/api/ai?action=generate-ideas`, {
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

      } catch (_error) {
        logger.warn('🚫 AI generation failed, using mock:', error)
        return this.generateMockIdeas(title, description, projectType, count)
      }
    }, 15 * 60 * 1000) // 15 minute cache
  }

  /**
   * Generate enhanced project ideas based on project creation input
   */
  async generateProjectIdeas(
    projectName: string,
    description: string,
    projectType?: string,
    count: number = 8,
    tolerance: number = 50
  ): Promise<IdeaCard[]> {
    logger.debug(`🚀 Generating enhanced project ideas for: "${projectName}"`)

    const cacheKey = AICache.generateKey('generateProjectIdeas', {
      projectName,
      description,
      projectType: projectType || 'General',
      count,
      tolerance,
      timestamp: Math.floor(Date.now() / (10 * 60 * 1000)) // 10-minute cache buckets
    })

    return aiCache.getOrSet(cacheKey, async () => {
      try {
        const headers = await this.getAuthHeaders()
        const response = await fetch(`${this.baseUrl}/api/ai/generate-project-ideas`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            projectName,
            description,
            projectType: projectType || 'General',
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
          return data.ideas.map((idea: any, index: number) => ({
            id: `project-ai-${Date.now()}-${index}`,
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
          return this.generateEnhancedMockIdeas(projectName, description, projectType, count)
        }

      } catch (_error) {
        logger.warn('🚫 Project idea generation failed, using enhanced mock:', error)
        return this.generateEnhancedMockIdeas(projectName, description, projectType, count)
      }
    }, 20 * 60 * 1000) // 20 minute cache for project ideas
  }

  /**
   * Map AI response priority levels to application priority
   */
  private mapPriorityLevel(impact: string, effort: string): 'low' | 'moderate' | 'high' | 'strategic' | 'innovation' {
    if (impact === 'high' && effort === 'low') return 'strategic'
    if (impact === 'high' && effort === 'medium') return 'high'
    if (impact === 'high' && effort === 'high') return 'innovation'
    if (impact === 'medium') return 'moderate'
    return 'low'
  }

  /**
   * Map effort and impact to matrix quadrant
   */
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

  /**
   * Get position coordinates from quadrant
   */
  private getPositionFromQuadrant(quadrant: string): { x: number, y: number } {
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
        return {
          x: Math.random() * 400 + 60,
          y: Math.random() * 400 + 60
        }
    }
  }

  /**
   * Generate mock idea when AI service is unavailable
   */
  private generateMockIdea(title: string, _projectContext?: ProjectContext): AIIdeaResponse {
    const timestamp = Date.now()
    logger.debug(`🎯 Generating mock idea for: "${title}" at ${timestamp}`)

    const titleLower = title.toLowerCase()
    let category = 'general'
    let suggestions = []

    // Smart categorization based on input keywords
    if (titleLower.includes('user') || titleLower.includes('interface') || titleLower.includes('ux')) {
      category = 'user experience'
      suggestions = [
        'Modern, intuitive user interface design',
        'Enhanced user experience with accessibility features',
        'Streamlined user onboarding process'
      ]
    } else if (titleLower.includes('api') || titleLower.includes('integration') || titleLower.includes('connect')) {
      category = 'integration'
      suggestions = [
        'RESTful API integration capabilities',
        'Third-party service integration',
        'Seamless data synchronization'
      ]
    } else if (titleLower.includes('data') || titleLower.includes('analytics') || titleLower.includes('report')) {
      category = 'analytics'
      suggestions = [
        'Advanced data analytics dashboard',
        'Real-time reporting system',
        'Data visualization tools'
      ]
    } else {
      suggestions = [
        'Core functionality implementation',
        'Essential feature development',
        'Basic system setup'
      ]
    }

    const suggestion = suggestions[Math.floor(Math.random() * suggestions.length)]

    return {
      content: title.charAt(0).toUpperCase() + title.slice(1),
      details: `${suggestion} for ${title}. This ${category} enhancement would improve overall system functionality and user satisfaction.`,
      priority: Math.random() > 0.7 ? 'high' : Math.random() > 0.4 ? 'moderate' : 'low'
    }
  }

  /**
   * Generate mock ideas when AI service is unavailable
   */
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

  /**
   * Generate enhanced mock ideas for project creation
   */
  private generateEnhancedMockIdeas(projectName: string, description: string, projectType?: string, count: number = 8): IdeaCard[] {
    const type = projectType?.toLowerCase() || 'general'

    let ideaTemplates = []

    if (type.includes('software') || type.includes('app') || type.includes('web')) {
      ideaTemplates = [
        { title: 'User Authentication System', description: 'Secure login and user management', quadrant: 'quick-wins' },
        { title: 'Data Visualization Dashboard', description: 'Interactive charts and analytics', quadrant: 'major-projects' },
        { title: 'Mobile Responsive Design', description: 'Optimized mobile experience', quadrant: 'quick-wins' },
        { title: 'Advanced Search Functionality', description: 'Powerful search with filters', quadrant: 'major-projects' },
        { title: 'Email Notifications', description: 'Automated email system', quadrant: 'fill-ins' },
        { title: 'Performance Optimization', description: 'Speed and efficiency improvements', quadrant: 'thankless-tasks' },
        { title: 'API Integration', description: 'Third-party service connections', quadrant: 'fill-ins' },
        { title: 'Security Enhancements', description: 'Advanced security measures', quadrant: 'thankless-tasks' }
      ]
    } else if (type.includes('marketing') || type.includes('business')) {
      ideaTemplates = [
        { title: 'Social Media Campaign', description: 'Multi-platform marketing strategy', quadrant: 'quick-wins' },
        { title: 'Customer Analytics Platform', description: 'Deep customer insights and tracking', quadrant: 'major-projects' },
        { title: 'Email Marketing Automation', description: 'Automated email sequences', quadrant: 'fill-ins' },
        { title: 'Brand Identity Redesign', description: 'Complete brand overhaul', quadrant: 'major-projects' },
        { title: 'Customer Feedback System', description: 'Collect and analyze feedback', quadrant: 'quick-wins' },
        { title: 'Content Management System', description: 'Streamlined content workflow', quadrant: 'thankless-tasks' },
        { title: 'Influencer Partnerships', description: 'Strategic influencer collaborations', quadrant: 'fill-ins' },
        { title: 'Market Research Initiative', description: 'Comprehensive market analysis', quadrant: 'thankless-tasks' }
      ]
    } else {
      // Generic project ideas
      ideaTemplates = [
        { title: 'Project Planning Framework', description: 'Structured approach to project management', quadrant: 'quick-wins' },
        { title: 'Quality Assurance System', description: 'Comprehensive QA processes', quadrant: 'major-projects' },
        { title: 'Team Collaboration Tools', description: 'Enhanced team communication', quadrant: 'fill-ins' },
        { title: 'Documentation Standards', description: 'Standardized documentation process', quadrant: 'thankless-tasks' },
        { title: 'Performance Metrics Dashboard', description: 'Track and measure success', quadrant: 'major-projects' },
        { title: 'Training and Onboarding', description: 'Structured learning program', quadrant: 'quick-wins' },
        { title: 'Resource Optimization', description: 'Efficient resource allocation', quadrant: 'fill-ins' },
        { title: 'Risk Management Plan', description: 'Comprehensive risk assessment', quadrant: 'thankless-tasks' }
      ]
    }

    return ideaTemplates.slice(0, count).map((idea, index) => ({
      id: `enhanced-mock-${Date.now()}-${index}`,
      content: idea.title,
      details: `${idea.description} tailored for ${projectName}. ${description}`,
      x: this.getPositionFromQuadrant(idea.quadrant).x,
      y: this.getPositionFromQuadrant(idea.quadrant).y,
      priority: 'moderate' as const,
      created_by: 'ai-assistant',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }))
  }
}

// Export singleton instance
export const aiIdeaService = new AIIdeaService()