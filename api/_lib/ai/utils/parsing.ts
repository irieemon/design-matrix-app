/**
 * Shared JSON extraction from AI responses.
 *
 * Consolidates the repeated JSON parsing logic found across all 6 handlers
 * in the legacy api/ai.ts monolith.
 */

/**
 * Extracts and parses JSON from AI response text.
 *
 * Handles common AI response formats:
 * - Plain JSON strings
 * - JSON wrapped in markdown ```json code blocks
 * - JSON wrapped in plain ``` code blocks
 * - Text surrounding a code-fenced JSON block
 *
 * @param text - Raw AI response text that may contain JSON
 * @returns Parsed JSON value
 * @throws Error with descriptive message if JSON cannot be extracted or parsed
 */
export function parseJsonResponse(text: string): unknown {
  let content = text.trim();

  // Extract content from markdown code fences if present
  const fencedMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fencedMatch) {
    content = fencedMatch[1].trim();
  }

  try {
    return JSON.parse(content);
  } catch (_error) {
    throw new Error(
      `Failed to parse JSON from AI response. Content (first 200 chars): ${content.slice(0, 200)}`
    );
  }
}
