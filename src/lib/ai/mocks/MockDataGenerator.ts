/**
 * Mock Data Generator
 * Generates mock ideas for fallback when AI service is unavailable
 */

import { IdeaCard } from '../../../types'
import { logger } from '../../../utils/logger'
import { getPositionFromQuadrant, type PriorityLevel } from '../utils'

export interface AIIdeaResponse {
  content: string
  details: string
  priority: PriorityLevel
}

/**
 * Mock data generator for idea generation fallback
 */
export class MockDataGenerator {
  /**
   * Generate a single mock idea based on title and context
   * @param title - Idea title
   * @param projectContext - Optional project context
   * @returns Mock idea response
   */
  static generateMockIdea(
    title: string,
    projectContext?: { name?: string; description?: string; type?: string }
  ): AIIdeaResponse {
    // Generate unique timestamp to prevent cache collisions
    const timestamp = Date.now()
    logger.debug(`🎯 Generating mock idea for: "${title}" at ${timestamp}`)

    // Analyze the input to provide contextually relevant suggestions
    const titleLower = title.toLowerCase()
    let category = 'general'
    let suggestions: AIIdeaResponse[] = []

    // Smart categorization based on input keywords
    if (titleLower.includes('security') || titleLower.includes('control panel')) {
      category = 'security'
      suggestions = [
        {
          content: `Security Control Dashboard`,
          details: `Comprehensive security management dashboard for ${title} with real-time monitoring, access controls, and threat detection capabilities.`,
          priority: 'high' as const
        },
        {
          content: `Automated Security Panel`,
          details: `Automated security control system for ${title} with intelligent threat response and user access management.`,
          priority: 'strategic' as const
        },
        {
          content: `Advanced Security Console`,
          details: `Enterprise-grade security console featuring ${title} with audit trails, compliance reporting, and multi-factor authentication.`,
          priority: 'innovation' as const
        }
      ]
    } else if (titleLower.includes('user') || titleLower.includes('interface')) {
      category = 'ui/ux'
      suggestions = [
        {
          content: `Enhanced User Interface for ${title}`,
          details: `Modern, intuitive user interface design for ${title} with improved accessibility and user experience.`,
          priority: 'high' as const
        },
        {
          content: `Interactive ${title} Dashboard`,
          details: `Dynamic, responsive dashboard interface for ${title} with customizable widgets and real-time data visualization.`,
          priority: 'moderate' as const
        }
      ]
    } else if (titleLower.includes('data') || titleLower.includes('analytics')) {
      category = 'analytics'
      suggestions = [
        {
          content: `${title} Analytics Platform`,
          details: `Comprehensive analytics solution for ${title} with advanced reporting, predictive insights, and data visualization.`,
          priority: 'strategic' as const
        },
        {
          content: `Real-time ${title} Monitoring`,
          details: `Live monitoring and alerting system for ${title} with customizable dashboards and automated notifications.`,
          priority: 'high' as const
        }
      ]
    } else {
      // Generic but contextually relevant suggestions
      suggestions = [
        {
          content: `Enhanced ${title} System`,
          details: `Improved implementation of ${title} with modern architecture, better performance, and enhanced user experience.`,
          priority: 'high' as const
        },
        {
          content: `Automated ${title} Process`,
          details: `Streamlined automation for ${title} to reduce manual work and increase operational efficiency.`,
          priority: 'moderate' as const
        },
        {
          content: `${title} Management Platform`,
          details: `Comprehensive management platform for ${title} with advanced controls, monitoring, and reporting capabilities.`,
          priority: 'strategic' as const
        }
      ]
    }

    // Select a contextually appropriate suggestion
    const selectedResponse = suggestions[Math.floor(Math.random() * suggestions.length)]

    logger.debug(`✨ Generated mock idea: "${selectedResponse.content}" (category: ${category})`)

    return {
      ...selectedResponse,
      details: `${selectedResponse.details} ${projectContext?.description ? `Project context: ${projectContext.description}` : ''}`
    }
  }

  /**
   * Generate multiple mock ideas for a project
   * @param title - Project title
   * @param description - Project description
   * @param projectType - Project type
   * @param count - Number of ideas to generate
   * @returns Array of mock idea cards
   */
  static generateMockIdeas(
    _title: string,
    _description: string,
    _projectType: string,
    count: number
  ): IdeaCard[] {
    const ideas = [
      {
        title: 'Quick Setup Process',
        description: 'Streamline the initial setup with guided onboarding',
        quadrant: 'quick-wins',
        category: 'User Experience'
      },
      {
        title: 'Advanced Analytics Dashboard',
        description: 'Comprehensive reporting and insights platform',
        quadrant: 'major-projects',
        category: 'Analytics'
      },
      {
        title: 'Social Media Integration',
        description: 'Connect with popular social platforms',
        quadrant: 'fill-ins',
        category: 'Integration'
      },
      {
        title: 'Legacy System Migration',
        description: 'Complex migration from old infrastructure',
        quadrant: 'thankless-tasks',
        category: 'Technical'
      },
      {
        title: 'Mobile App Version',
        description: 'Native mobile application with core features',
        quadrant: 'major-projects',
        category: 'Mobile'
      },
      {
        title: 'Email Templates',
        description: 'Pre-designed email templates for communication',
        quadrant: 'quick-wins',
        category: 'Communication'
      },
      {
        title: 'API Rate Limiting',
        description: 'Implement sophisticated rate limiting system',
        quadrant: 'thankless-tasks',
        category: 'Security'
      },
      {
        title: 'User Feedback System',
        description: 'In-app feedback collection and management',
        quadrant: 'fill-ins',
        category: 'User Experience'
      }
    ]

    return (ideas || []).slice(0, count).map((idea, index) => ({
      id: `mock-${Date.now()}-${index}`,
      content: idea.title,
      details: idea.description,
      x: getPositionFromQuadrant(idea.quadrant).x,
      y: getPositionFromQuadrant(idea.quadrant).y,
      priority: 'moderate' as const,
      created_by: 'ai-assistant',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }))
  }
}
