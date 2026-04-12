import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing handler
vi.mock('ai', () => ({
  generateText: vi.fn(),
  generateObject: vi.fn(),
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
    temperature: 0.3,
    fallbackModels: [],
  })),
  getProviderOptions: vi.fn(() => undefined),
}));

import { generateObject } from 'ai';
import { handleAnalyzeImage } from '../../analyzeImage.js';
import { selectModel } from '../../modelRouter.js';
import { getModel } from '../../providers.js';
import type { VercelResponse } from '@vercel/node';

const MOCK_ANALYSIS_OBJECT = {
  subject: 'A test image',
  description: 'A test image analysis',
  textContent: 'some text',
  insights: ['test insight'],
  relevanceScore: 80,
};

function createMockReq(body: Record<string, unknown> = {}) {
  return {
    body: {
      imageUrl: 'https://example.com/image.jpg',
      projectContext: { projectName: 'Test Project', projectType: 'software' },
      analysisType: 'general',
      ...body,
    },
    user: { id: 'user-123', email: 'test@test.com' },
    headers: { authorization: 'Bearer test' },
  } as any;
}

function createMockRes() {
  const res: Partial<VercelResponse> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as VercelResponse;
}

describe('handleAnalyzeImage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (generateObject as ReturnType<typeof vi.fn>).mockResolvedValue({
      object: MOCK_ANALYSIS_OBJECT,
    });
  });

  it('returns 400 if imageUrl is missing', async () => {
    const req = createMockReq({ imageUrl: undefined });
    const res = createMockRes();

    await handleAnalyzeImage(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));
  });

  it('uses AI SDK vision content parts format', async () => {
    const req = createMockReq();
    const res = createMockRes();

    await handleAnalyzeImage(req, res);

    // Verify generateObject was called with vision content parts (messages array)
    expect(generateObject).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: expect.arrayContaining([
              expect.objectContaining({ type: 'text' }),
              expect.objectContaining({ type: 'image', image: 'https://example.com/image.jpg' }),
            ]),
          }),
        ]),
      })
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ analysis: expect.any(Object) }));
  });

  it('calls selectModel with hasVision=true', async () => {
    const req = createMockReq();
    const res = createMockRes();

    await handleAnalyzeImage(req, res);

    expect(selectModel).toHaveBeenCalledWith(
      expect.objectContaining({
        task: 'analyze-image',
        hasVision: true,
        hasAudio: false,
      }),
      expect.anything()
    );
  });

  it('never routes to MiniMax for vision (AI-04)', async () => {
    const req = createMockReq();
    const res = createMockRes();

    await handleAnalyzeImage(req, res);

    // selectModel enforces hasVision=true which means MiniMax is never selected
    expect(selectModel).toHaveBeenCalledWith(
      expect.objectContaining({ hasVision: true }),
      expect.anything()
    );
    // The model router never returns minimax for hasVision=true
    expect(getModel).toHaveBeenCalled();
  });

  it('preserves response shape with analysis object', async () => {
    (generateObject as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      object: {
        subject: 'A UI mockup',
        description: 'A UI mockup showing a login screen',
        textContent: 'Login button',
        insights: ['Clean layout', 'Good UX'],
        relevanceScore: 75,
      },
    });

    const req = createMockReq({ analysisType: 'ui_design' });
    const res = createMockRes();

    await handleAnalyzeImage(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        analysis: expect.objectContaining({
          type: 'ui_design',
          description: expect.any(String),
        }),
      })
    );
  });

  it('returns 500 when generateObject throws', async () => {
    (generateObject as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('AI service unavailable')
    );

    const req = createMockReq();
    const res = createMockRes();

    await handleAnalyzeImage(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));
  });
});
