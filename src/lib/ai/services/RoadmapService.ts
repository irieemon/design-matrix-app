/**
 * Roadmap Service
 * Handles AI-powered roadmap generation for projects
 */

import { IdeaCard } from '../../../types'
import { logger } from '../../../utils/logger'
import { BaseAiService, SecureAIServiceConfig } from './BaseAiService'
import { getQuadrantFromPosition } from '../utils'

/**
 * Service for generating project roadmaps using AI
 */
export class RoadmapService extends BaseAiService {
  constructor(config: SecureAIServiceConfig = {}) {
    super(config)
  }

  /**
   * Generate a project roadmap from ideas
   * @param ideas - Array of idea cards
   * @param projectName - Project name
   * @param projectType - Project type
   * @returns Generated roadmap
   */
  async generateRoadmap(ideas: IdeaCard[], projectName: string, projectType?: string, signal?: AbortSignal): Promise<any> {
    logger.debug('🗺️ Generating roadmap for project:', projectName)

    // Create cache key from core parameters
    const ideaSignature = (ideas || []).map((idea) => ({
      content: idea.content,
      x: Math.round(idea.x / 10) * 10,
      y: Math.round(idea.y / 10) * 10
    }))

    const cacheKey = this.generateCacheKey('generateRoadmap', {
      ideas: ideaSignature,
      projectName: projectName || 'Project',
      projectType: projectType || 'General'
    })

    return this.getOrSetCache(
      cacheKey,
      async () => {
        try {
          const data = await this.fetchWithErrorHandling<any>('/api/ai?action=generate-roadmap', {
            projectName,
            projectType: projectType || 'General',
            ideas: (ideas || []).map((idea) => ({
              title: idea.content,
              description: idea.details,
              quadrant: getQuadrantFromPosition(idea.x, idea.y)
            }))
          }, false, signal)

          // 200-empty: surface as a distinct user-visible error rather than
          // silently returning mock data (ADR-0016 R9).
          if (!data.roadmap) {
            throw new Error('AI returned no roadmap -- please try again')
          }

          const roadmap = data.roadmap

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
          // Preserve AbortError propagation so callers can distinguish cancel
          // from other failures (T-0016-041).
          if (error instanceof Error && error.name === 'AbortError') throw error
          logger.error('AI roadmap failed:', error)
          logger.debug('Roadmap API error details:', {
            projectName,
            projectType,
            ideaCount: (ideas || []).length,
            error: error instanceof Error ? error.message : String(error)
          })
          throw error
        }
      },
      25 * 60 * 1000 // 25 minute cache for roadmaps (longest TTL due to complexity)
    )
  }

}
