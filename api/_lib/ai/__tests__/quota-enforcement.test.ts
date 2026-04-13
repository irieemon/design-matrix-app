/**
 * ADR-0015 Step 6 — Server-side quota enforcement tests
 *
 * These tests define the correct behavior BEFORE Colby builds it.
 * They are expected to FAIL on the current codebase because:
 *   - handleGenerateRoadmap does not call checkLimit or trackAIUsage yet
 *   - handleGenerateInsights does not call checkLimit or trackAIUsage yet
 *
 * The free-tier limit consistency test lives in quota-limit-constant.test.ts
 * (isolated so its vi.unmock does not contaminate the spies in this file).
 *
 * Spec source: ADR-0015 Implementation Plan Step 1, acceptance criteria.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Shared mocks (hoisted by Vitest before any imports) ────────────────────

vi.mock('ai', () => ({
  generateText: vi.fn(),
}));

vi.mock('../providers.js', () => ({
  getModel: vi.fn(() => 'mock-model-instance'),
}));

vi.mock('../modelProfiles.js', () => ({
  getActiveProfile: vi.fn(() =>
    Promise.resolve({
      id: 'test-profile',
      name: 'test',
      display_name: 'Test',
      is_active: true,
      task_configs: {},
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    })
  ),
}));

vi.mock('../modelRouter.js', () => ({
  selectModel: vi.fn(() => ({
    provider: 'openai',
    modelId: 'gpt-4o',
    gatewayModelId: 'openai/gpt-4o',
    maxOutputTokens: 4096,
    temperature: 0.7,
    fallbackModels: [],
  })),
  getProviderOptions: vi.fn(() => undefined),
}));

vi.mock('../../services/subscriptionService.js', () => ({
  checkLimit: vi.fn(() =>
    Promise.resolve({
      canUse: true,
      current: 1,
      limit: 5,
      percentageUsed: 20,
      isUnlimited: false,
    })
  ),
  trackAIUsage: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../utils/supabaseAdmin.js', () => ({
  trackTokenUsage: vi.fn(() => Promise.resolve()),
  supabaseAdmin: {},
}));

// ── Imports after mocks ────────────────────────────────────────────────────

import { generateText } from 'ai';
import { handleGenerateRoadmap } from '../generateRoadmap.js';
import { handleGenerateInsights } from '../generateInsights.js';
import { checkLimit, trackAIUsage } from '../../services/subscriptionService.js';
import type { VercelResponse } from '@vercel/node';

// ── Helpers ────────────────────────────────────────────────────────────────

function createRoadmapReq(body: Record<string, unknown> = {}) {
  return {
    body: {
      projectName: 'Quota Test Project',
      projectType: 'software',
      ideas: [
        { title: 'Idea A', description: 'First idea' },
        { title: 'Idea B', description: 'Second idea' },
      ],
      ...body,
    },
    user: { id: 'user-quota-test', email: 'quota@test.com' },
    headers: { authorization: 'Bearer test-token' },
    socket: { remoteAddress: '127.0.0.1' },
  } as any;
}

function createInsightsReq(body: Record<string, unknown> = {}) {
  return {
    body: {
      ideas: [
        { title: 'Idea A', description: 'First idea', quadrant: 'quick-wins' },
        { title: 'Idea B', description: 'Second idea', quadrant: 'major-projects' },
      ],
      projectName: 'Quota Test Project',
      projectType: 'software',
      ...body,
    },
    user: { id: 'user-quota-test', email: 'quota@test.com' },
    headers: {
      authorization: 'Bearer test-token',
      'x-forwarded-for': '127.0.0.1',
    },
    socket: { remoteAddress: '127.0.0.1' },
  } as any;
}

function createMockRes() {
  const res: Partial<VercelResponse> & { _status: number; _json: unknown } = {
    _status: 200,
    _json: null,
    status(code: number) {
      res._status = code;
      return res as VercelResponse;
    },
    json(data: unknown) {
      res._json = data;
      return res as VercelResponse;
    },
  };
  return res;
}

const MOCK_ROADMAP_JSON = JSON.stringify({
  roadmapAnalysis: {
    totalDuration: '12 weeks',
    phases: [{ phase: 'P1', duration: '4 weeks', description: 'd', epics: [], risks: [], successCriteria: [] }],
  },
  executionStrategy: {
    methodology: 'Agile',
    sprintLength: '2 weeks',
    teamRecommendations: 'Small team',
    keyMilestones: [],
  },
});

const MOCK_INSIGHTS_JSON = JSON.stringify({
  executiveSummary: 'Test summary',
  keyInsights: [{ insight: 'Test', impact: 'High' }],
  priorityRecommendations: { immediate: [], shortTerm: [], longTerm: [] },
  riskAssessment: { risks: [], mitigations: [] },
  suggestedRoadmap: [],
  resourceAllocation: { quickWins: 'Focus here', strategic: 'Long term' },
  futureEnhancements: [],
  nextSteps: ['Step 1'],
});

// ── Roadmap quota enforcement ──────────────────────────────────────────────

describe('generateRoadmap — quota enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // The handler checks process.env.OPENAI_API_KEY and returns 500 if absent.
    // Setting a sentinel prevents that guard from masking the quota assertions.
    process.env.OPENAI_API_KEY = 'test-key';

    (generateText as ReturnType<typeof vi.fn>).mockResolvedValue({
      text: MOCK_ROADMAP_JSON,
      usage: { inputTokens: 500, outputTokens: 1000, totalTokens: 1500 },
    });
  });

  it('calls checkLimit with userId and ai_roadmap before generating', async () => {
    const req = createRoadmapReq();
    const res = createMockRes();

    await handleGenerateRoadmap(req, res as unknown as VercelResponse);

    expect(checkLimit).toHaveBeenCalledWith('user-quota-test', 'ai_roadmap');

    // checkLimit must be called before generateText (ordering guard)
    const checkOrder = (checkLimit as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0];
    const generateOrder = (generateText as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0];
    expect(checkOrder).toBeLessThan(generateOrder);
  });

  it('returns 402 with quota_exceeded error shape when roadmap limit is exceeded', async () => {
    (checkLimit as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      canUse: false,
      current: 5,
      limit: 5,
      percentageUsed: 100,
      isUnlimited: false,
    });

    const req = createRoadmapReq();
    const res = createMockRes();

    await handleGenerateRoadmap(req, res as unknown as VercelResponse);

    expect(res._status).toBe(402);
    const body = res._json as any;
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe('quota_exceeded');
    expect(body.error.resource).toBe('ai_roadmap');
    expect(body.error.limit).toBe(5);
    expect(body.error.used).toBe(5);
    expect(typeof body.error.upgradeUrl).toBe('string');
    // AI must not be invoked when quota is exhausted
    expect(generateText).not.toHaveBeenCalled();
  });

  it('calls trackAIUsage with userId and ai_roadmap after successful generation', async () => {
    const req = createRoadmapReq();
    const res = createMockRes();

    await handleGenerateRoadmap(req, res as unknown as VercelResponse);

    expect(res._status).toBe(200);
    expect(trackAIUsage).toHaveBeenCalledWith('user-quota-test', 'ai_roadmap');
  });
});

// ── Insights quota enforcement ─────────────────────────────────────────────

describe('generateInsights — quota enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Both key vars needed: handler checks OPENAI_API_KEY for primary path
    // and ANTHROPIC_API_KEY for fallback; either absent causes 500.
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';

    (generateText as ReturnType<typeof vi.fn>).mockResolvedValue({
      text: MOCK_INSIGHTS_JSON,
      usage: { inputTokens: 400, outputTokens: 800, totalTokens: 1200 },
    });
  });

  it('calls checkLimit with userId and ai_insights before generating', async () => {
    const req = createInsightsReq();
    const res = createMockRes();

    await handleGenerateInsights(req, res as unknown as VercelResponse);

    expect(checkLimit).toHaveBeenCalledWith('user-quota-test', 'ai_insights');

    // checkLimit must be called before generateText (ordering guard)
    const checkOrder = (checkLimit as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0];
    const generateOrder = (generateText as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0];
    expect(checkOrder).toBeLessThan(generateOrder);
  });

  it('returns 402 with quota_exceeded error shape when insights limit is exceeded', async () => {
    (checkLimit as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      canUse: false,
      current: 5,
      limit: 5,
      percentageUsed: 100,
      isUnlimited: false,
    });

    const req = createInsightsReq();
    const res = createMockRes();

    await handleGenerateInsights(req, res as unknown as VercelResponse);

    expect(res._status).toBe(402);
    const body = res._json as any;
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe('quota_exceeded');
    expect(body.error.resource).toBe('ai_insights');
    expect(body.error.limit).toBe(5);
    expect(body.error.used).toBe(5);
    expect(typeof body.error.upgradeUrl).toBe('string');
    // AI must not be invoked when quota is exhausted
    expect(generateText).not.toHaveBeenCalled();
  });

  it('calls trackAIUsage with userId and ai_insights after successful generation', async () => {
    const req = createInsightsReq();
    const res = createMockRes();

    await handleGenerateInsights(req, res as unknown as VercelResponse);

    expect(res._status).toBe(200);
    expect(trackAIUsage).toHaveBeenCalledWith('user-quota-test', 'ai_insights');
  });
});
