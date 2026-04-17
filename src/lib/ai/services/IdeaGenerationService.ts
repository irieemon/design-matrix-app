/**
 * Idea Generation Service
 * Handles AI-powered idea generation for projects
 */

import { IdeaCard } from '../../../types'
import { logger } from '../../../utils/logger'
import { BaseAiService, SecureAIServiceConfig } from './BaseAiService'
import { getPositionFromQuadrant, mapToQuadrant, mapPriorityLevel, type PriorityLevel } from '../utils'

export interface AIIdeaResponse {
  content: string
  details: string
  priority: PriorityLevel
}

/**
 * Service for generating ideas using AI
 */
export class IdeaGenerationService extends BaseAiService {
  constructor(config: SecureAIServiceConfig = {}) {
    super(config)
  }

  /**
   * Generate a single idea based on title and project context
   * @param title - Idea title
   * @param projectContext - Optional project context
   * @returns Generated idea response
   */
  async generateIdea(
    title: string,
    projectContext?: { name?: string; description?: string; type?: string },
    signal?: AbortSignal
  ): Promise<AIIdeaResponse> {
    logger.debug(`🧠 Generating idea for: "${title}" using secure server-side proxy`)

    // Generate cache key from parameters with timestamp to ensure fresh results
    const cacheKey = this.generateCacheKey('generateIdea', {
      title: title.trim().toLowerCase(), // Normalize title for consistent caching
      projectContext: projectContext || {},
      timestamp: Math.floor(Date.now() / (5 * 60 * 1000)) // 5-minute cache buckets
    })

    return this.getOrSetCache(
      cacheKey,
      async () => {
        try {
          const data = await this.fetchWithErrorHandling<any>('/api/ai?action=generate-ideas', {
            title,
            description: projectContext?.description || '',
            projectType: projectContext?.type || 'General'
          }, false, signal)

          if (data.ideas && data.ideas.length > 0) {
            // Return the first idea in the expected format
            const idea = data.ideas[0]
            return {
              content: idea.title,
              details: idea.description,
              priority: mapPriorityLevel(idea.impact, idea.effort)
            }
          }

          // 200-empty: surface as a distinct user-visible error rather than
          // silently returning mock data (ADR-0016 R9).
          throw new Error('AI returned no idea -- please try again')
        } catch (error) {
          // Preserve AbortError propagation so callers can distinguish cancel
          // from other failures (T-0016-031).
          if (error instanceof Error && error.name === 'AbortError') throw error
          logger.error('Error generating idea:', error)
          throw error
        }
      },
      10 * 60 * 1000 // 10 minute cache for ideas
    )
  }

  /**
   * Generate multiple ideas for a project
   * @param title - Project title
   * @param description - Project description
   * @param projectType - Project type
   * @param count - Number of ideas to generate
   * @param tolerance - Tolerance percentage for idea distribution
   * @returns Array of generated idea cards
   */
  async generateMultipleIdeas(
    title: string,
    description: string,
    projectType: string = 'General',
    count: number = 8,
    tolerance: number = 50
  ): Promise<IdeaCard[]> {
    logger.debug(`🧠 Generating ${count} ideas for project: "${title}" with ${tolerance}% tolerance`)

    // Generate cache key from parameters
    const cacheKey = this.generateCacheKey('generateMultipleIdeas', {
      title,
      description,
      projectType,
      count,
      tolerance
    })

    return this.getOrSetCache(
      cacheKey,
      async () => {
        try {
          const data = await this.fetchWithErrorHandling<any>('/api/ai?action=generate-ideas', {
            title,
            description,
            projectType,
            count,
            tolerance
          })

          if (data.ideas && data.ideas.length > 0) {
            return (data.ideas || []).map((idea: any, index: number) => ({
              id: `ai-${Date.now()}-${index}`,
              content: idea.title,
              details: idea.description,
              x: getPositionFromQuadrant(mapToQuadrant(idea.effort, idea.impact)).x,
              y: getPositionFromQuadrant(mapToQuadrant(idea.effort, idea.impact)).y,
              priority: mapPriorityLevel(idea.impact, idea.effort),
              created_by: 'ai-assistant',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }))
          }

          // 200-empty: surface as a distinct user-visible error rather than
          // silently returning mock data (ADR-0016 R9).
          throw new Error('AI returned no ideas -- please try again')
        } catch (error) {
          // Preserve AbortError propagation so callers can distinguish cancel
          // from other failures.
          if (error instanceof Error && error.name === 'AbortError') throw error
          logger.error('AI generation failed:', error)
          throw error
        }
      },
      15 * 60 * 1000 // 15 minute cache for multiple ideas
    )
  }

  /**
   * Legacy method for backward compatibility
   * @param projectName - Project name
   * @param description - Project description
   * @param projectType - Project type
   * @param count - Number of ideas to generate
   * @param tolerance - Tolerance percentage
   * @returns Array of generated idea cards
   */
  async generateProjectIdeas(
    projectName: string,
    description: string,
    projectType?: string,
    count: number = 8,
    tolerance: number = 50
  ): Promise<IdeaCard[]> {
    return this.generateMultipleIdeas(projectName, description, projectType || 'General', count, tolerance)
  }
}
