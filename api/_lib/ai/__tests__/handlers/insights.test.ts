import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing handler
vi.mock('ai', () => ({
  generateText: vi.fn(),
}));

vi.mock('../../providers.js', () => ({
  getModel: vi.fn(() => 'mock-model-instance'),
}));

vi.mock('../../modelRouter.js', () => ({
  selectModel: vi.fn(() => ({
    provider: 'openai',
    modelId: 'gpt-4o',
    gatewayModelId: 'openai/gpt-4o',
    maxOutputTokens: 4096,
    temperature: 0.5,
  })),
}));

vi.mock('../../../services/subscriptionService.js', () => ({
  checkLimit: vi.fn(() => Promise.resolve({
    canUse: true,
    current: 1,
    limit: 10,
    percentageUsed: 10,
    isUnlimited: false,
  })),
  trackAIUsage: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../utils/supabaseAdmin.js', () => ({
  trackTokenUsage: vi.fn(() => Promise.resolve()),
}));

import { generateText } from 'ai';
import { handleGenerateInsights } from '../../generateInsights.js';
import { selectModel } from '../../modelRouter.js';
import { getModel } from '../../providers.js';
import type { VercelResponse } from '@vercel/node';

const MOCK_INSIGHTS_RESPONSE = {
  executiveSummary: 'This project shows strong potential.',
  keyInsights: [
    { insight: 'Good market fit', impact: 'High revenue potential' },
  ],
  priorityRecommendations: {
    immediate: ['Launch MVP'],
    shortTerm: ['Add analytics'],
    longTerm: ['Expand market'],
  },
  riskAssessment: {
    risks: ['Competition'],
    mitigations: ['Differentiate on UX'],
  },
  suggestedRoadmap: [
    { phase: 'Phase 1', duration: '4 weeks', focus: 'Core features', ideas: ['Idea 1'] },
  ],
  resourceAllocation: {
    quickWins: 'Focus on onboarding',
    strategic: 'Platform investment',
  },
  futureEnhancements: [],
  nextSteps: ['Define KPIs'],
};

function createMockReq(body: Record<string, unknown> = {}) {
  return {
    body: {
      ideas: [
        { title: 'Idea 1', description: 'Desc 1', quadrant: 'quick-wins' },
        { title: 'Idea 2', description: 'Desc 2', quadrant: 'major-projects' },
      ],
      projectName: 'Test Project',
      projectType: 'software',
      ...body,
    },
    user: { id: 'user-123', email: 'test@test.com' },
    headers: {
      'x-forwarded-for': '127.0.0.1',
      authorization: 'Bearer test',
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

describe('generateInsights handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';

    (generateText as ReturnType<typeof vi.fn>).mockResolvedValue({
      text: JSON.stringify(MOCK_INSIGHTS_RESPONSE),
      usage: {
        inputTokens: 500,
        outputTokens: 1000,
        totalTokens: 1500,
      },
    });
  });

  it('returns { insights: {...} } JSON shape', async () => {
    const req = createMockReq();
    const res = createMockRes();

    await handleGenerateInsights(req, res as unknown as VercelResponse);

    expect(res._status).toBe(200);
    expect(res._json).toHaveProperty('insights');
    const insights = (res._json as any).insights;
    expect(insights).toHaveProperty('executiveSummary');
    expect(insights).toHaveProperty('keyInsights');
    expect(insights).toHaveProperty('priorityRecommendations');
    expect(insights).toHaveProperty('riskAssessment');
    expect(insights).toHaveProperty('suggestedRoadmap');
  });

  it('uses selectModel with task=generate-insights', async () => {
    const req = createMockReq();
    const res = createMockRes();

    await handleGenerateInsights(req, res as unknown as VercelResponse);

    expect(selectModel).toHaveBeenCalledWith(
      expect.objectContaining({
        task: 'generate-insights',
        hasVision: false,
        hasAudio: false,
      })
    );
  });

  it('passes getModel result to generateText', async () => {
    const req = createMockReq();
    const res = createMockRes();

    await handleGenerateInsights(req, res as unknown as VercelResponse);

    expect(getModel).toHaveBeenCalled();
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'mock-model-instance',
      })
    );
  });

  it('falls back to Anthropic when OpenAI fails', async () => {
    // First call (OpenAI) fails, second call (Anthropic) succeeds
    (generateText as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error('OpenAI API error'))
      .mockResolvedValueOnce({
        text: JSON.stringify(MOCK_INSIGHTS_RESPONSE),
        usage: {
          inputTokens: 400,
          outputTokens: 800,
          totalTokens: 1200,
        },
      });

    const req = createMockReq();
    const res = createMockRes();

    await handleGenerateInsights(req, res as unknown as VercelResponse);

    expect(res._status).toBe(200);
    expect(res._json).toHaveProperty('insights');
    // getModel should have been called twice - once for primary, once for fallback
    expect(getModel).toHaveBeenCalledTimes(2);
  });

  it('returns 400 when ideas array is missing', async () => {
    const req = createMockReq({ ideas: null });
    const res = createMockRes();

    await handleGenerateInsights(req, res as unknown as VercelResponse);

    expect(res._status).toBe(400);
    expect((res._json as any).error).toContain('Ideas array is required');
  });

  it('returns 500 when no AI service configured', async () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    const req = createMockReq();
    const res = createMockRes();

    await handleGenerateInsights(req, res as unknown as VercelResponse);

    expect(res._status).toBe(500);
    expect((res._json as any).error).toContain('No AI service configured');
  });

  it('handles invalid JSON in AI response', async () => {
    (generateText as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        text: 'This is not valid JSON at all',
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      })
      // Anthropic fallback also fails
      .mockRejectedValueOnce(new Error('Anthropic also failed'));

    const req = createMockReq();
    const res = createMockRes();

    await handleGenerateInsights(req, res as unknown as VercelResponse);

    expect(res._status).toBe(500);
  });
});
