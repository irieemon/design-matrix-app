import { describe, it } from 'vitest';

/**
 * Wave 0 test stubs for the ideas handler migration (Plan 02).
 *
 * These tests will be implemented when the ideas handler is migrated
 * from api/ai.ts to api/_lib/ai/handlers/generateIdeas.ts.
 */
describe('generateIdeas handler', () => {
  it.todo('returns same JSON shape as legacy handler');
  it.todo('calls checkLimit before generation');
  it.todo('tracks token usage after generation');
});
