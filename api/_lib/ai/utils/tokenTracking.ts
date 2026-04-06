/**
 * Token usage mapping from AI SDK format to database tracking format.
 *
 * The AI SDK v6 returns usage as LanguageModelUsage with camelCase fields
 * (inputTokens, outputTokens, totalTokens). The existing trackTokenUsage()
 * function in supabaseAdmin.ts expects snake_case (prompt_tokens,
 * completion_tokens, total_tokens).
 */

/**
 * AI SDK v6 LanguageModelUsage shape (subset of fields we need).
 */
export interface AISdkUsage {
  inputTokens: number | undefined;
  outputTokens: number | undefined;
  totalTokens: number | undefined;
}

/**
 * Database tracking format expected by trackTokenUsage().
 */
export interface TokenTrackingUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

/**
 * Maps AI SDK usage output to the snake_case format expected by trackTokenUsage().
 *
 * @param usage - AI SDK LanguageModelUsage object (or undefined/null)
 * @returns Snake_case usage object with zeros for any undefined values
 */
export function mapUsageToTracking(usage?: AISdkUsage): TokenTrackingUsage {
  if (!usage) {
    return {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    };
  }

  return {
    prompt_tokens: usage.inputTokens ?? 0,
    completion_tokens: usage.outputTokens ?? 0,
    total_tokens: usage.totalTokens ?? 0,
  };
}
