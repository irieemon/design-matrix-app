/**
 * AI Service Facade
 * Unified interface for all AI services maintaining backward compatibility
 */

import { IdeaCard } from '../../types'
import { SecureAIServiceConfig } from './services/BaseAiService'
import { IdeaGenerationService, AIIdeaResponse } from './services/IdeaGenerationService'
import { InsightsService } from './services/InsightsService'
import { RoadmapService } from './services/RoadmapService'
import { logger } from '../../utils/logger'

/**
 * Facade class that provides a unified interface to all AI services
 * Maintains 100% backward compatibility with the original SecureAIService
 */
export class AiServiceFacade {
  private ideaService: IdeaGenerationService
  private insightsService: InsightsService
  private roadmapService: RoadmapService

  constructor(config: SecureAIServiceConfig = {}) {
    // Initialize all services with the same config
    this.ideaService = new IdeaGenerationService(config)
    this.insightsService = new InsightsService(config)
    this.roadmapService = new RoadmapService(config)

    logger.debug('🎯 AI Service Facade initialized with modular architecture')
  }

  /**
   * Generate a single idea based on title and project context
   * @param title - Idea title
   * @param projectContext - Optional project context
   * @returns Generated idea response
   */
  async generateIdea(
    title: string,
    projectContext?: { name?: string; description?: string; type?: string }
  ): Promise<AIIdeaResponse> {
    return this.ideaService.generateIdea(title, projectContext)
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
    return this.ideaService.generateMultipleIdeas(title, description, projectType, count, tolerance)
  }

  /**
   * Generate AI insights for a set of ideas
   * @param ideas - Array of idea cards
   * @param projectName - Project name
   * @param projectType - Project type
   * @param projectId - Project ID for additional context
   * @param currentProject - Current project object
   * @returns Generated insights report
   */
  async generateInsights(
    ideas: IdeaCard[],
    projectName?: string,
    projectType?: string,
    projectId?: string,
    currentProject?: any
  ): Promise<any> {
    return this.insightsService.generateInsights(ideas, projectName, projectType, projectId, currentProject)
  }

  /**
   * Generate a project roadmap from ideas
   * @param ideas - Array of idea cards
   * @param projectName - Project name
   * @param projectType - Project type
   * @returns Generated roadmap
   */
  async generateRoadmap(ideas: IdeaCard[], projectName: string, projectType?: string): Promise<any> {
    return this.roadmapService.generateRoadmap(ideas, projectName, projectType)
  }

  /**
   * Legacy method for backward compatibility - now uses secure endpoints
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
    return this.ideaService.generateProjectIdeas(projectName, description, projectType, count, tolerance)
  }
}
