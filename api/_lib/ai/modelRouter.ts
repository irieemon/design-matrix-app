/**
 * Capability-based model router for AI tasks.
 *
 * Maps task type + capability requirements to a specific provider/model selection.
 * Enforces hard constraints:
 * - Vision tasks NEVER route to MiniMax (no image support)
 * - Audio tasks ALWAYS route to OpenAI whisper-1
 * - Text-only tasks can route to any available provider
 *
 * Per D-07, D-08: selectModel maps { task, hasVision, hasAudio, userTier }
 * to { provider, modelId, gatewayModelId }.
 * Per D-10: All tasks use generateText (no streaming).
 *
 * ADR-0013 Step 2: selectModel accepts an optional ModelProfile. When provided
 * and the task exists in profile.task_configs, routing uses the profile's model.
 * When absent or task not found, falls back to current gpt-4o behavior.
 */

import type { ModelProfile } from './modelProfiles.js';

/**
 * Context for routing a task to the appropriate model.
 */
export interface TaskRoutingContext {
  task:
    | 'generate-ideas'
    | 'generate-insights'
    | 'generate-roadmap'
    | 'analyze-file'
    | 'analyze-image'
    | 'analyze-video'
    | 'transcribe-audio'
    | 'transcribe-summary';
  hasVision: boolean;
  hasAudio: boolean;
  userTier: 'free' | 'pro' | 'enterprise';
  complexity?: 'low' | 'medium' | 'high';
}

/**
 * Result of model selection -- everything needed to call the provider.
 */
export interface ModelSelection {
  provider: string;
  modelId: string;
  gatewayModelId: string;
  maxOutputTokens: number;
  temperature?: number;
  fallbackModels: string[];
}

/**
 * Per-task model configuration defaults (used when no profile is provided).
 */
const MODEL_CONFIG: Record<string, { temperature: number; maxOutputTokens: number }> = {
  'generate-ideas': { temperature: 0.8, maxOutputTokens: 4096 },
  'generate-insights': { temperature: 0.5, maxOutputTokens: 4096 },
  'generate-roadmap': { temperature: 0.6, maxOutputTokens: 8192 },
  'analyze-file': { temperature: 0.3, maxOutputTokens: 4096 },
  'analyze-image': { temperature: 0.3, maxOutputTokens: 4096 },
  'analyze-video': { temperature: 0.3, maxOutputTokens: 4096 },
  'transcribe-audio': { temperature: 0, maxOutputTokens: 4096 },
  'transcribe-summary': { temperature: 0, maxOutputTokens: 4096 },
};

/**
 * Extracts the provider prefix from a gateway model ID (e.g., 'openai' from 'openai/gpt-4o').
 */
function extractProvider(gatewayModelId: string): string {
  const slashIndex = gatewayModelId.indexOf('/');
  return slashIndex > 0 ? gatewayModelId.substring(0, slashIndex) : gatewayModelId;
}

/**
 * Selects the appropriate model for a given task and capability context.
 *
 * Routing rules:
 * - hasAudio or transcribe-audio -> OpenAI whisper-1 (always, ignores profile)
 * - If profile provided and task found in profile.task_configs -> use profile config
 * - Otherwise -> OpenAI gpt-4o (backward-compatible default)
 *
 * @param ctx - Task routing context with capability requirements
 * @param profile - Optional model profile from database
 * @returns ModelSelection with provider, model ID, parameters, and fallback chain
 * @throws Error if task is unknown and no profile is provided
 */
export function selectModel(ctx: TaskRoutingContext, profile?: ModelProfile | null): ModelSelection {
  const config = MODEL_CONFIG[ctx.task];

  // Audio routing: always whisper-1, regardless of profile
  if (ctx.hasAudio || ctx.task === 'transcribe-audio') {
    return {
      provider: 'openai',
      modelId: 'whisper-1',
      gatewayModelId: 'openai/whisper-1',
      maxOutputTokens: config?.maxOutputTokens ?? 4096,
      temperature: config?.temperature ?? 0,
      fallbackModels: [],
    };
  }

  // Profile-aware routing: when a profile is provided and has config for this task
  if (profile?.task_configs) {
    const taskConfig = profile.task_configs[ctx.task as keyof typeof profile.task_configs];
    if (taskConfig) {
      return {
        provider: extractProvider(taskConfig.gatewayModelId),
        modelId: taskConfig.gatewayModelId.split('/').pop() ?? taskConfig.gatewayModelId,
        gatewayModelId: taskConfig.gatewayModelId,
        maxOutputTokens: taskConfig.maxOutputTokens,
        temperature: taskConfig.temperature,
        fallbackModels: taskConfig.fallbackModels,
      };
    }
  }

  // No profile or task not in profile: fall back to gpt-4o default behavior
  // Vision routing: always OpenAI gpt-4o (MiniMax has no vision support)
  if (ctx.hasVision || ctx.task === 'analyze-image' || ctx.task === 'analyze-file') {
    return {
      provider: 'openai',
      modelId: 'gpt-4o',
      gatewayModelId: 'openai/gpt-4o',
      maxOutputTokens: config?.maxOutputTokens ?? 4096,
      temperature: config?.temperature ?? 0.3,
      fallbackModels: [],
    };
  }

  // Text task routing (no profile fallback)
  switch (ctx.task) {
    case 'generate-ideas':
    case 'generate-insights':
    case 'generate-roadmap':
    case 'analyze-video':
    case 'transcribe-summary':
      return {
        provider: 'openai',
        modelId: 'gpt-4o',
        gatewayModelId: 'openai/gpt-4o',
        maxOutputTokens: config?.maxOutputTokens ?? 4096,
        temperature: config?.temperature ?? 0.7,
        fallbackModels: [],
      };

    default: {
      const _exhaustive: never = ctx.task;
      throw new Error(
        `Unknown task type: "${ctx.task}". Expected one of: generate-ideas, generate-insights, generate-roadmap, analyze-file, analyze-image, analyze-video, transcribe-audio, transcribe-summary`
      );
    }
  }
}

/**
 * Builds gateway providerOptions for fallback model chains.
 *
 * @param fallbackModels - Array of gateway model IDs for fallback routing
 * @returns providerOptions object for generateText(), or undefined if no fallbacks
 */
export function getProviderOptions(
  fallbackModels: string[],
): { gateway: { models: string[]; caching: 'auto' } } | undefined {
  if (fallbackModels.length === 0) return undefined;
  return {
    gateway: {
      models: fallbackModels,
      caching: 'auto',
    },
  };
}
