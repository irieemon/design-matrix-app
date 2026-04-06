import { describe, it, expect } from 'vitest';
import { parseJsonResponse } from '../utils/parsing';
import { mapUsageToTracking } from '../utils/tokenTracking';

describe('parseJsonResponse', () => {
  it('parses a plain JSON object', () => {
    const input = '{"key": "value", "count": 42}';
    const result = parseJsonResponse(input);
    expect(result).toEqual({ key: 'value', count: 42 });
  });

  it('parses a plain JSON array', () => {
    const input = '[{"id": 1}, {"id": 2}]';
    const result = parseJsonResponse(input);
    expect(result).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('strips markdown ```json code blocks before parsing', () => {
    const input = '```json\n{"key": "value"}\n```';
    const result = parseJsonResponse(input);
    expect(result).toEqual({ key: 'value' });
  });

  it('strips markdown ``` code blocks without json tag', () => {
    const input = '```\n[1, 2, 3]\n```';
    const result = parseJsonResponse(input);
    expect(result).toEqual([1, 2, 3]);
  });

  it('handles text before and after the JSON block', () => {
    const input = 'Here is the result:\n```json\n{"key": "value"}\n```\nDone.';
    const result = parseJsonResponse(input);
    expect(result).toEqual({ key: 'value' });
  });

  it('throws on invalid JSON', () => {
    const input = 'not json at all';
    expect(() => parseJsonResponse(input)).toThrow();
  });

  it('throws a descriptive error message on failure', () => {
    const input = '{broken json';
    expect(() => parseJsonResponse(input)).toThrow(/Failed to parse JSON/);
  });
});

describe('mapUsageToTracking', () => {
  it('converts AI SDK usage (inputTokens/outputTokens) to snake_case tracking format', () => {
    const usage = { inputTokens: 10, outputTokens: 5, totalTokens: 15 };
    const result = mapUsageToTracking(usage);
    expect(result).toEqual({
      prompt_tokens: 10,
      completion_tokens: 5,
      total_tokens: 15,
    });
  });

  it('returns zeros when usage is undefined', () => {
    const result = mapUsageToTracking(undefined);
    expect(result).toEqual({
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    });
  });

  it('returns zeros when usage is null', () => {
    const result = mapUsageToTracking(null as unknown as undefined);
    expect(result).toEqual({
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    });
  });

  it('handles undefined token counts within usage object', () => {
    const usage = { inputTokens: undefined, outputTokens: undefined, totalTokens: undefined };
    const result = mapUsageToTracking(usage as any);
    expect(result).toEqual({
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    });
  });
});
