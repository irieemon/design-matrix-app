/**
 * AI Services Barrel Export
 * Centralized exports for all AI services and utilities
 */

// Modular services
export { AiServiceFacade } from './AiServiceFacade'
export { BaseAiService } from './services/BaseAiService'
export { IdeaGenerationService } from './services/IdeaGenerationService'
export { InsightsService } from './services/InsightsService'
export { RoadmapService } from './services/RoadmapService'

// Mock Generators are intentionally NOT re-exported from the barrel
// (ADR-0016 R8). They remain on disk for developer use via direct import
// from `./mocks/MockDataGenerator` or `./mocks/MockInsightsGenerator`, but
// the barrel re-exports would anchor them into any prod bundle that imports
// from this file. Tree-shake-safe by omission.

// Utilities
export * from './utils'

// Type exports
export type { IdeaCard } from '../../types'
export type { SecureAIServiceConfig } from './services/BaseAiService'
export type { AIIdeaResponse } from './services/IdeaGenerationService'