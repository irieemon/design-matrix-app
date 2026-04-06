/**
 * AI SDK foundation barrel export.
 *
 * Re-exports the provider factory, model router, handlers, and shared utilities.
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

// Text handlers (Plan 02)
export { handleGenerateIdeas } from './generateIdeas.js';
export { handleGenerateInsights } from './generateInsights.js';
export { handleGenerateRoadmap } from './generateRoadmap.js';

// Multi-modal handlers (Plan 03)
export { handleAnalyzeFile } from './analyzeFile.js';
export { handleAnalyzeImage } from './analyzeImage.js';
export { handleTranscribeAudio } from './transcribeAudio.js';
