/**
 * ADR-0015 Step 6 — Free-tier ai_ideas limit constant test
 *
 * Isolated from quota-enforcement.test.ts because this test calls the REAL
 * subscriptionService implementation (not a spy). A vi.unmock in the same
 * file as vi.mock spies is hoisted to the top by Vitest and cancels the
 * spies, causing "not a spy" failures in unrelated tests.
 *
 * Expected to FAIL pre-build: subscriptionService currently uses 10 for
 * ai_ideas free-tier limit; ADR-0015 AC-10 requires 5.
 *
 * Spec source: ADR-0015 Implementation Plan Step 1, acceptance criteria.
 */

import { describe, it, expect, vi } from 'vitest';

// Do NOT mock subscriptionService here — the whole point is to test the
// real implementation's hardcoded constant.

// Provide a supabaseAdmin stub that returns a "no subscription" error so
// checkLimit takes the noSubscription branch, which reads the hardcoded
// freeLimit constant directly without any Supabase usage query.
vi.mock('../../utils/supabaseAdmin.js', () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () =>
            Promise.resolve({
              data: null,
              error: { code: 'PGRST116', message: 'no rows' },
            }),
        }),
      }),
    }),
  },
  trackTokenUsage: vi.fn(() => Promise.resolve()),
}));

import { checkLimit } from '../../services/subscriptionService.js';

describe('subscriptionService — free-tier ai_ideas limit', () => {
  it('uses 5 (not 10) as the free-tier limit for ai_ideas', async () => {
    // The no-subscription path returns the hardcoded freeLimit constant
    // without a Supabase usage query, making this a direct constant check.
    //
    // ADR-0015 AC-10: free-tier limit must be 5 everywhere, matching
    // frontend src/lib/config/tierLimits.ts. Current value is 10 (bug).
    const result = await checkLimit('any-user-id', 'ai_ideas');

    expect(result.limit).toBe(5);
  });

  it('uses 5 as the free-tier limit for ai_roadmap', async () => {
    // Regression guard: roadmap was already 5, must stay 5 after the fix.
    const result = await checkLimit('any-user-id', 'ai_roadmap');

    expect(result.limit).toBe(5);
  });

  it('uses 5 as the free-tier limit for ai_insights', async () => {
    // Regression guard: insights was already 5, must stay 5 after the fix.
    const result = await checkLimit('any-user-id', 'ai_insights');

    expect(result.limit).toBe(5);
  });
});
