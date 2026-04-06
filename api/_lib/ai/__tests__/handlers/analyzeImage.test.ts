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
    temperature: 0.3,
  })),
}));

import { generateText } from 'ai';
import { handleAnalyzeImage } from '../../analyzeImage.js';
import { selectModel } from '../../modelRouter.js';
import { getModel } from '../../providers.js';
import type { VercelResponse } from '@vercel/node';

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
  });

  it('returns 400 if imageUrl is missing', async () => {
    const req = createMockReq({ imageUrl: undefined });
    const res = createMockRes();

    await handleAnalyzeImage(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));
  });

  it('uses AI SDK vision content parts format', async () => {
    (generateText as any).mockResolvedValue({
      text: JSON.stringify({
        type: 'general',
        description: 'A test image analysis',
        extractedText: 'some text',
        insights: ['test insight'],
        relevance: 'high',
      }),
      usage: { inputTokens: 150, outputTokens: 80, totalTokens: 230 },
    });

    const req = createMockReq();
    const res = createMockRes();

    await handleAnalyzeImage(req, res);

    // Verify generateText was called with vision content parts (messages array)
    expect(generateText).toHaveBeenCalledWith(
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
    (generateText as any).mockResolvedValue({
      text: '{"type":"general","description":"test"}',
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    });

    const req = createMockReq();
    const res = createMockRes();

    await handleAnalyzeImage(req, res);

    expect(selectModel).toHaveBeenCalledWith(
      expect.objectContaining({
        task: 'analyze-image',
        hasVision: true,
        hasAudio: false,
      })
    );
  });

  it('never routes to MiniMax for vision (AI-04)', async () => {
    (generateText as any).mockResolvedValue({
      text: '{"type":"general","description":"test"}',
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    });

    const req = createMockReq();
    const res = createMockRes();

    await handleAnalyzeImage(req, res);

    // selectModel enforces hasVision=true which means MiniMax is never selected
    expect(selectModel).toHaveBeenCalledWith(
      expect.objectContaining({ hasVision: true })
    );
    // The model router never returns minimax for hasVision=true
    expect(getModel).toHaveBeenCalled();
  });

  it('preserves response shape with analysis object', async () => {
    const analysisResult = {
      type: 'ui_design',
      description: 'A UI mockup',
      extractedText: 'Login button',
      insights: ['Clean layout', 'Good UX'],
      relevance: 'high',
    };

    (generateText as any).mockResolvedValue({
      text: JSON.stringify(analysisResult),
      usage: { inputTokens: 200, outputTokens: 100, totalTokens: 300 },
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

  it('handles non-JSON response from AI gracefully', async () => {
    (generateText as any).mockResolvedValue({
      text: 'This is a plain text analysis of the image showing various UI elements.',
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    });

    const req = createMockReq();
    const res = createMockRes();

    await handleAnalyzeImage(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        analysis: expect.objectContaining({
          description: expect.any(String),
        }),
      })
    );
  });
});
