/**
 * AI SDK foundation barrel export.
 *
 * Re-exports the provider factory and model router.
 * Handler exports will be added in Plans 02 and 03 as handlers are migrated.
 */

// Provider factory
export { getModel } from './providers.js';

// Model router
export {
  selectModel,
  type TaskRoutingContext,
  type ModelSelection,
} from './modelRouter.js';

// Shared utilities
export { parseJsonResponse } from './utils/parsing.js';
export { mapUsageToTracking, type AISdkUsage, type TokenTrackingUsage } from './utils/tokenTracking.js';
export { getProjectTypePersona, type PersonaContext } from './utils/prompts.js';
