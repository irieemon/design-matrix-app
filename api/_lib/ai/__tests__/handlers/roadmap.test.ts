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
    maxOutputTokens: 8192,
    temperature: 0.6,
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
import { handleGenerateRoadmap } from '../../generateRoadmap.js';
import { selectModel } from '../../modelRouter.js';
import { getModel } from '../../providers.js';
import type { VercelResponse } from '@vercel/node';

const MOCK_ROADMAP_RESPONSE = {
  roadmapAnalysis: {
    totalDuration: '12-16 weeks',
    phases: [
      {
        phase: 'Foundation',
        duration: '3-4 weeks',
        description: 'Set up core infrastructure',
        epics: [
          {
            title: 'Backend Setup',
            description: 'API and database architecture',
            userStories: ['As a developer, I want clear API docs'],
            deliverables: ['API documentation', 'Database schema'],
            priority: 'high',
            complexity: 'high',
            relatedIdeas: ['Idea 1'],
          },
        ],
        risks: ['Technical complexity'],
        successCriteria: ['All endpoints documented'],
      },
    ],
  },
  executionStrategy: {
    methodology: 'Agile Development with 2-week sprints',
    sprintLength: '2 weeks',
    teamRecommendations: 'Full-stack team of 3-5 developers',
    keyMilestones: [
      {
        milestone: 'Phase 1 Complete',
        timeline: 'Week 4',
        description: 'Core infrastructure ready',
      },
    ],
  },
};

function createMockReq(body: Record<string, unknown> = {}) {
  return {
    body: {
      projectName: 'Test Project',
      projectType: 'software',
      ideas: [
        { title: 'Idea 1', description: 'Build core feature' },
        { title: 'Idea 2', description: 'Add analytics' },
      ],
      ...body,
    },
    user: { id: 'user-123', email: 'test@test.com' },
    headers: { authorization: 'Bearer test' },
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

describe('generateRoadmap handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = 'test-key';

    (generateText as ReturnType<typeof vi.fn>).mockResolvedValue({
      text: JSON.stringify(MOCK_ROADMAP_RESPONSE),
      usage: {
        inputTokens: 800,
        outputTokens: 2000,
        totalTokens: 2800,
      },
    });
  });

  it('returns { roadmap: {...} } JSON shape', async () => {
    const req = createMockReq();
    const res = createMockRes();

    await handleGenerateRoadmap(req, res as unknown as VercelResponse);

    expect(res._status).toBe(200);
    expect(res._json).toHaveProperty('roadmap');
    const roadmap = (res._json as any).roadmap;
    expect(roadmap).toHaveProperty('roadmapAnalysis');
    expect(roadmap).toHaveProperty('executionStrategy');
    expect(roadmap.roadmapAnalysis).toHaveProperty('phases');
    expect(Array.isArray(roadmap.roadmapAnalysis.phases)).toBe(true);
  });

  it('handles generate-roadmap action (v1 format)', async () => {
    const req = createMockReq();
    const res = createMockRes();

    await handleGenerateRoadmap(req, res as unknown as VercelResponse);

    expect(res._status).toBe(200);
    expect(res._json).toHaveProperty('roadmap');
  });

  it('handles generate-roadmap-v2 action (same handler)', async () => {
    // v2 uses same handler, just routed differently
    const req = createMockReq();
    const res = createMockRes();

    await handleGenerateRoadmap(req, res as unknown as VercelResponse);

    expect(res._status).toBe(200);
    expect(res._json).toHaveProperty('roadmap');
  });

  it('uses selectModel with task=generate-roadmap', async () => {
    const req = createMockReq();
    const res = createMockRes();

    await handleGenerateRoadmap(req, res as unknown as VercelResponse);

    expect(selectModel).toHaveBeenCalledWith(
      expect.objectContaining({
        task: 'generate-roadmap',
        hasVision: false,
        hasAudio: false,
      })
    );
  });

  it('passes getModel result to generateText', async () => {
    const req = createMockReq();
    const res = createMockRes();

    await handleGenerateRoadmap(req, res as unknown as VercelResponse);

    expect(getModel).toHaveBeenCalled();
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'mock-model-instance',
      })
    );
  });

  it('returns 400 when required fields are missing', async () => {
    const req = createMockReq({ projectName: undefined, ideas: undefined });
    const res = createMockRes();

    await handleGenerateRoadmap(req, res as unknown as VercelResponse);

    expect(res._status).toBe(400);
    expect((res._json as any).error).toContain('required');
  });

  it('returns 500 when no AI service configured', async () => {
    delete process.env.OPENAI_API_KEY;

    const req = createMockReq();
    const res = createMockRes();

    await handleGenerateRoadmap(req, res as unknown as VercelResponse);

    expect(res._status).toBe(500);
    expect((res._json as any).error).toContain('No AI service configured');
  });

  it('returns empty object on JSON parse failure', async () => {
    (generateText as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      text: 'not valid json',
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    });

    const req = createMockReq();
    const res = createMockRes();

    await handleGenerateRoadmap(req, res as unknown as VercelResponse);

    // Original behavior: returns empty object on parse failure
    expect(res._status).toBe(200);
    expect((res._json as any).roadmap).toEqual({});
  });

  it('adapts prompts for different project types', async () => {
    const req = createMockReq({ projectType: 'marketing' });
    const res = createMockRes();

    await handleGenerateRoadmap(req, res as unknown as VercelResponse);

    expect(res._status).toBe(200);
    // Verify generateText was called with marketing-specific prompts
    const callArgs = (generateText as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArgs.system).toContain('Marketing');
  });
});
