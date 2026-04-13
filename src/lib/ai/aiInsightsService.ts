/**
 * Stub module — legacy aiInsightsService has been deleted (ADR-0014 Step 3).
 * This file exists solely so Vitest's static import analysis does not fail on
 * AIInsightsModal-step2.test.tsx, which mocks this path as a dead suppression
 * stub. No production code imports this module.
 */
export const aiInsightsService = {
  generateInsights: () => Promise.reject(new Error('aiInsightsService is deleted — use aiService'))
}
