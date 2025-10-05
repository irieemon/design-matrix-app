/**
 * AI Services Barrel Export
 * Centralized exports for all AI services and utilities
 */

// Legacy services (keep for backward compatibility)
export { AIIdeaService, aiIdeaService } from './aiIdeaService'
export { AIInsightsService, aiInsightsService } from './aiInsightsService'
export { AIRoadmapService, aiRoadmapService } from './aiRoadmapService'

// New modular services (recommended for new code)
export { AiServiceFacade } from './AiServiceFacade'
export { BaseAiService } from './services/BaseAiService'
export { IdeaGenerationService } from './services/IdeaGenerationService'
export { InsightsService } from './services/InsightsService'
export { RoadmapService } from './services/RoadmapService'

// Mock Generators
export { MockDataGenerator } from './mocks/MockDataGenerator'
export { MockInsightsGenerator } from './mocks/MockInsightsGenerator'

// Utilities
export * from './utils'

// Type exports
export type { IdeaCard } from '../../types'
export type { SecureAIServiceConfig } from './services/BaseAiService'
export type { AIIdeaResponse } from './services/IdeaGenerationService'