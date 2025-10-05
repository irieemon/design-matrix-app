/**
 * DEPRECATED: This file is maintained for backward compatibility only
 * New code should import from './ai' barrel export
 *
 * SECURE AI SERVICE - Uses server-side proxy endpoints for all AI API calls
 * This ensures API keys are never exposed to the client-side
 *
 * Refactored into modular services:
 * - BaseAiService: Common functionality
 * - IdeaGenerationService: Idea generation
 * - InsightsService: Insights generation
 * - RoadmapService: Roadmap generation
 * - MockDataGenerator: Mock idea data
 * - MockInsightsGenerator: Mock insights data
 */

import { AiServiceFacade } from './ai/AiServiceFacade'
import { logger } from '../utils/logger'

// Re-export types for backward compatibility
export type { AIIdeaResponse } from './ai/services/IdeaGenerationService'
export type { SecureAIServiceConfig } from './ai/services/BaseAiService'

/**
 * Legacy SecureAIService class for backward compatibility
 * Delegates all calls to the new modular AiServiceFacade
 */
class SecureAIService extends AiServiceFacade {
  constructor(config = {}) {
    super(config)
    logger.debug('🔄 Legacy SecureAIService wrapper initialized - delegates to modular facade')
  }
}

// Export singleton instance - maintains exact same export signature
export const aiService = new SecureAIService()
export default aiService
