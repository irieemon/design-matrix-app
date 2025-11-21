/**
 * Database Module - Barrel Export
 *
 * Provides centralized access to all database modules for modern code.
 * New code can import from this module for better modularity and tree-shaking.
 *
 * MIGRATION PATH:
 * - Legacy code: Continue using `import { DatabaseService } from './database'`
 * - New code: Use `import { IdeaService, ProjectService } from './database'`
 */

// ============================================================================
// SERVICES - Business logic and orchestration
// ============================================================================

export { IdeaService } from '../services/IdeaService'
export { ProjectService } from '../services/ProjectService'
export { CollaborationService } from '../services/CollaborationService'

// ============================================================================
// REPOSITORIES - Data access layer
// ============================================================================

export { RoadmapRepository } from './repositories/RoadmapRepository'
export { InsightsRepository } from './repositories/InsightsRepository'

// Note: IdeaRepository and ProjectRepository are in src/lib/repositories
// They are already exported from src/lib/repositories/index.ts

// ============================================================================
// SPECIALIZED SERVICES - Domain-specific functionality
// ============================================================================

export { IdeaLockingService } from './services/IdeaLockingService'
export { RealtimeSubscriptionManager } from './services/RealtimeSubscriptionManager'

// ============================================================================
// UTILITIES - Shared helpers and validation
// ============================================================================

export { DatabaseHelpers } from './utils/DatabaseHelpers'
export { ValidationHelpers } from './utils/ValidationHelpers'

// ============================================================================
// TYPES - Re-export common types for convenience
// ============================================================================

export type { RoadmapData } from './repositories/RoadmapRepository'
export type { InsightData } from './repositories/InsightsRepository'

/**
 * USAGE EXAMPLES:
 *
 * // Modern approach - use specific services
 * import { IdeaService, ProjectService } from '@/lib/database'
 *
 * // Get ideas using the service
 * const result = await IdeaService.getIdeasByProject(projectId)
 * if (result.success) {
 *   logger.debug(result.data)
 * }
 *
 * // Use utilities directly
 * import { ValidationHelpers, DatabaseHelpers } from '@/lib/database'
 *
 * const isValid = ValidationHelpers.validateProjectId(projectId)
 * DatabaseHelpers.throttledLog('key', 'message', data)
 *
 * // Legacy approach - still works for backward compatibility
 * import { DatabaseService } from '@/lib/database'
 *
 * const ideas = await DatabaseService.getProjectIdeas(projectId)
 */
