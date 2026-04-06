/**
 * AI Gateway provider factory.
 *
 * Uses the Vercel AI Gateway built into the `ai` package to route to
 * OpenAI, Anthropic, and MiniMax via a single provider instance.
 * This is the committed approach per D-01.
 *
 * IMPORTANT: The gateway instance is lazily created (not at module top level)
 * because serverless env vars may not be set at import time.
 */

import { createGateway } from 'ai';
import type { GatewayModelId } from 'ai';

// Lazy singleton -- created on first call, not at import time
let gatewayInstance: ReturnType<typeof createGateway> | null = null;

function getGateway(): ReturnType<typeof createGateway> {
  if (!gatewayInstance) {
    const apiKey = process.env.AI_GATEWAY_API_KEY;
    if (!apiKey) {
      throw new Error(
        'AI_GATEWAY_API_KEY environment variable is not set. ' +
        'Configure it in Vercel Dashboard -> Project Settings -> AI Gateway.'
      );
    }

    gatewayInstance = createGateway({ apiKey });
  }
  return gatewayInstance;
}

/**
 * Returns an AI SDK model instance for the given gateway model ID.
 *
 * @param gatewayModelId - Model ID in provider/model format, e.g. 'openai/gpt-4o'
 * @returns AI SDK model instance ready for use with generateText()
 *
 * @example
 * ```ts
 * import { getModel } from './providers';
 * import { generateText } from 'ai';
 *
 * const result = await generateText({
 *   model: getModel('openai/gpt-4o'),
 *   prompt: 'Hello!',
 * });
 * ```
 */
export function getModel(gatewayModelId: GatewayModelId | (string & {})) {
  const gw = getGateway();
  return gw(gatewayModelId as GatewayModelId);
}
