import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing handler
vi.mock('ai', () => ({
  generateText: vi.fn(),
}));

vi.mock('../../providers.js', () => ({
  getModel: vi.fn(() => 'mock-model-instance'),
}));

vi.mock('../../modelProfiles.js', () => ({
  getActiveProfile: vi.fn(() => Promise.resolve({
    id: 'test-profile',
    name: 'test',
    display_name: 'Test',
    is_active: true,
    task_configs: {},
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  })),
}));

vi.mock('../../modelRouter.js', () => ({
  selectModel: vi.fn(() => ({
    provider: 'openai',
    modelId: 'gpt-4o',
    gatewayModelId: 'openai/gpt-4o',
    maxOutputTokens: 4096,
    temperature: 0.8,
    fallbackModels: [],
  })),
  getProviderOptions: vi.fn(() => undefined),
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

vi.mock('../../../utils/validation.js', () => ({
  InputValidator: {
    validate: vi.fn((body: Record<string, unknown>, _rules: unknown[]) => ({
      isValid: true,
      errors: [],
      sanitizedData: {
        title: body.title || 'Test Project',
        description: body.description || 'A test description',
        projectType: body.projectType || 'software',
        count: body.count || 8,
        tolerance: body.tolerance || 50,
      },
    })),
  },
  commonRules: {
    title: { field: 'title', required: true },
    description: { field: 'description', required: true },
    projectType: { field: 'projectType', required: false },
    count: { field: 'count', required: false },
    tolerance: { field: 'tolerance', required: false },
  },
}));

import { generateText } from 'ai';
import { handleGenerateIdeas } from '../../generateIdeas.js';
import { selectModel } from '../../modelRouter.js';
import { checkLimit, trackAIUsage } from '../../../services/subscriptionService.js';
import { trackTokenUsage } from '../../../utils/supabaseAdmin.js';
import { getModel } from '../../providers.js';
import type { VercelResponse } from '@vercel/node';

function createMockReq(body: Record<string, unknown> = {}) {
  return {
    body: {
      title: 'Test Project',
      description: 'A test description',
      projectType: 'software',
      count: 8,
      tolerance: 50,
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

describe('generateIdeas handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (generateText as ReturnType<typeof vi.fn>).mockResolvedValue({
      text: JSON.stringify([
        {
          title: 'Idea 1',
          description: 'Description 1',
          effort: 'low',
          impact: 'high',
          category: 'feature',
          rationale: 'Good idea',
        },
      ]),
      usage: {
        inputTokens: 100,
        outputTokens: 200,
        totalTokens: 300,
      },
    });
  });

  it('returns { ideas: [...] } JSON shape', async () => {
    const req = createMockReq();
    const res = createMockRes();

    await handleGenerateIdeas(req, res as unknown as VercelResponse);

    expect(res._status).toBe(200);
    expect(res._json).toHaveProperty('ideas');
    expect(Array.isArray((res._json as any).ideas)).toBe(true);
    expect((res._json as any).ideas[0]).toHaveProperty('title');
    expect((res._json as any).ideas[0]).toHaveProperty('description');
    expect((res._json as any).ideas[0]).toHaveProperty('effort');
    expect((res._json as any).ideas[0]).toHaveProperty('impact');
  });

  it('calls checkLimit before AI generation', async () => {
    const req = createMockReq();
    const res = createMockRes();

    await handleGenerateIdeas(req, res as unknown as VercelResponse);

    expect(checkLimit).toHaveBeenCalledWith('user-123', 'ai_ideas');
    // checkLimit must be called before generateText
    const checkLimitOrder = (checkLimit as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0];
    const generateTextOrder = (generateText as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0];
    expect(checkLimitOrder).toBeLessThan(generateTextOrder);
  });

  it('returns 403 when limit exceeded', async () => {
    (checkLimit as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      canUse: false,
      current: 10,
      limit: 10,
      percentageUsed: 100,
    });

    const req = createMockReq();
    const res = createMockRes();

    await handleGenerateIdeas(req, res as unknown as VercelResponse);

    expect(res._status).toBe(403);
    expect((res._json as any).error).toBe('AI_LIMIT_REACHED');
    expect(generateText).not.toHaveBeenCalled();
  });

  it('tracks token usage after successful generation', async () => {
    const req = createMockReq({ projectId: 'proj-456' });
    const res = createMockRes();

    await handleGenerateIdeas(req, res as unknown as VercelResponse);

    expect(trackTokenUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-123',
        endpoint: 'generate-ideas',
        usage: {
          prompt_tokens: 100,
          completion_tokens: 200,
          total_tokens: 300,
        },
      })
    );
  });

  it('calls trackAIUsage after successful generation', async () => {
    const req = createMockReq();
    const res = createMockRes();

    await handleGenerateIdeas(req, res as unknown as VercelResponse);

    expect(trackAIUsage).toHaveBeenCalledWith('user-123', 'ai_ideas');
  });

  it('uses selectModel with correct task context', async () => {
    const req = createMockReq();
    const res = createMockRes();

    await handleGenerateIdeas(req, res as unknown as VercelResponse);

    expect(selectModel).toHaveBeenCalledWith(
      expect.objectContaining({
        task: 'generate-ideas',
        hasVision: false,
        hasAudio: false,
      }),
      expect.anything()
    );
  });

  it('passes getModel result to generateText', async () => {
    const req = createMockReq();
    const res = createMockRes();

    await handleGenerateIdeas(req, res as unknown as VercelResponse);

    expect(getModel).toHaveBeenCalledWith('openai/gpt-4o');
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'mock-model-instance',
      })
    );
  });

  it('returns 400 on validation failure', async () => {
    const { InputValidator } = await import('../../../utils/validation.js');
    (InputValidator.validate as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      isValid: false,
      errors: ['Title is required'],
      sanitizedData: {},
    });

    const req = createMockReq({ title: '' });
    const res = createMockRes();

    await handleGenerateIdeas(req, res as unknown as VercelResponse);

    expect(res._status).toBe(400);
    expect((res._json as any).error).toBe('Validation failed');
  });

  it('returns 500 on AI error without exposing details in production', async () => {
    (generateText as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('API key invalid')
    );

    const req = createMockReq();
    const res = createMockRes();

    // Simulate production
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    await handleGenerateIdeas(req, res as unknown as VercelResponse);

    process.env.NODE_ENV = origEnv;

    expect(res._status).toBe(500);
    expect((res._json as any).debug).toBeUndefined();
  });
});
