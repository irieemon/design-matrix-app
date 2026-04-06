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
 */

/**
 * Context for routing a task to the appropriate model.
 */
export interface TaskRoutingContext {
  task: 'generate-ideas' | 'generate-insights' | 'generate-roadmap' | 'analyze-file' | 'analyze-image' | 'transcribe-audio';
  hasVision: boolean;
  hasAudio: boolean;
  userTier: 'free' | 'pro' | 'enterprise';
  complexity?: 'low' | 'medium' | 'high';
}

/**
 * Result of model selection -- everything needed to call the provider.
 */
export interface ModelSelection {
  provider: 'openai' | 'anthropic' | 'minimax';
  modelId: string;
  gatewayModelId: string;
  maxOutputTokens: number;
  temperature?: number;
}

/**
 * Per-task model configuration defaults.
 */
const MODEL_CONFIG: Record<string, { temperature: number; maxOutputTokens: number }> = {
  'generate-ideas': { temperature: 0.8, maxOutputTokens: 4096 },
  'generate-insights': { temperature: 0.5, maxOutputTokens: 4096 },
  'generate-roadmap': { temperature: 0.6, maxOutputTokens: 8192 },
  'analyze-file': { temperature: 0.3, maxOutputTokens: 4096 },
  'analyze-image': { temperature: 0.3, maxOutputTokens: 4096 },
  'transcribe-audio': { temperature: 0, maxOutputTokens: 4096 },
};

/**
 * Selects the appropriate model for a given task and capability context.
 *
 * Routing rules:
 * - hasVision or analyze-image/analyze-file -> OpenAI gpt-4o (vision-capable, never MiniMax)
 * - hasAudio or transcribe-audio -> OpenAI whisper-1
 * - Text tasks (generate-ideas, generate-insights, generate-roadmap) -> OpenAI gpt-4o
 *
 * Error handling: fail-fast with descriptive error for unknown tasks (no fallback chain).
 *
 * @param ctx - Task routing context with capability requirements
 * @returns ModelSelection with provider, model ID, and parameters
 * @throws Error if task is unknown
 */
export function selectModel(ctx: TaskRoutingContext): ModelSelection {
  const config = MODEL_CONFIG[ctx.task];

  // Audio routing: always whisper-1
  if (ctx.hasAudio || ctx.task === 'transcribe-audio') {
    return {
      provider: 'openai',
      modelId: 'whisper-1',
      gatewayModelId: 'openai/whisper-1',
      maxOutputTokens: config?.maxOutputTokens ?? 4096,
      temperature: config?.temperature ?? 0,
    };
  }

  // Vision routing: always OpenAI gpt-4o (MiniMax has no vision support)
  if (ctx.hasVision || ctx.task === 'analyze-image' || ctx.task === 'analyze-file') {
    return {
      provider: 'openai',
      modelId: 'gpt-4o',
      gatewayModelId: 'openai/gpt-4o',
      maxOutputTokens: config?.maxOutputTokens ?? 4096,
      temperature: config?.temperature ?? 0.3,
    };
  }

  // Text task routing
  switch (ctx.task) {
    case 'generate-ideas':
      return {
        provider: 'openai',
        modelId: 'gpt-4o',
        gatewayModelId: 'openai/gpt-4o',
        maxOutputTokens: config.maxOutputTokens,
        temperature: config.temperature,
      };

    case 'generate-insights':
      return {
        provider: 'openai',
        modelId: 'gpt-4o',
        gatewayModelId: 'openai/gpt-4o',
        maxOutputTokens: config.maxOutputTokens,
        temperature: config.temperature,
      };

    case 'generate-roadmap':
      return {
        provider: 'openai',
        modelId: 'gpt-4o',
        gatewayModelId: 'openai/gpt-4o',
        maxOutputTokens: config.maxOutputTokens,
        temperature: config.temperature,
      };

    default: {
      const _exhaustive: never = ctx.task;
      throw new Error(
        `Unknown task type: "${ctx.task}". Expected one of: generate-ideas, generate-insights, generate-roadmap, analyze-file, analyze-image, transcribe-audio`
      );
    }
  }
}
