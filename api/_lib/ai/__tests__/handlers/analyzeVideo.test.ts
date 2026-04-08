/**
 * Tests for the analyze-video handler (Phase 07-03).
 *
 * Verifies:
 * - Request validation (missing / out-of-range frames array)
 * - generateObject is called EXACTLY ONCE with all frames as image parts
 *   in a single messages[0].content array (research finding #1)
 * - Zod schema shape `{ summary, suggestedIdeas[] }` (D-16)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('ai', () => ({
  generateObject: vi.fn(),
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

import { generateObject } from 'ai';
import { handleAnalyzeVideo } from '../../analyzeVideo.js';
import type { VercelResponse } from '@vercel/node';

function createMockReq(body: Record<string, unknown> = {}) {
  return {
    body: {
      frames: ['data:image/jpeg;base64,AAA', 'data:image/jpeg;base64,BBB'],
      projectContext: { projectName: 'Test', projectType: 'software' },
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

const validResponse = {
  object: {
    summary: 'A short clip showing a product demo.',
    suggestedIdeas: [
      {
        content: 'Add onboarding tooltip',
        details: 'Walk new users through the demo features.',
        x: 260,
        y: 260,
        priority: 'moderate' as const,
      },
    ],
  },
};

describe('handleAnalyzeVideo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(generateObject).mockResolvedValue(validResponse as any);
  });

  it('returns {analysis: {summary, suggestedIdeas}} for a valid request', async () => {
    const frames = Array.from({ length: 6 }, (_, i) => `data:image/jpeg;base64,F${i}`);
    const req = createMockReq({ frames });
    const res = createMockRes();

    await handleAnalyzeVideo(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      analysis: expect.objectContaining({
        summary: expect.any(String),
        suggestedIdeas: expect.any(Array),
      }),
    });
  });

  it('returns 400 when frames field is missing', async () => {
    const req = createMockReq({ frames: undefined });
    const res = createMockRes();

    await handleAnalyzeVideo(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Frames are required' });
  });

  it('returns 400 when frames array is empty', async () => {
    const req = createMockReq({ frames: [] });
    const res = createMockRes();

    await handleAnalyzeVideo(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 when more than 12 frames are supplied', async () => {
    const frames = Array.from({ length: 13 }, (_, i) => `data:image/jpeg;base64,F${i}`);
    const req = createMockReq({ frames });
    const res = createMockRes();

    await handleAnalyzeVideo(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('Too many frames') }),
    );
  });

  it('calls generateObject ONCE with all frames as image parts in a single message', async () => {
    const frames = Array.from({ length: 6 }, (_, i) => `data:image/jpeg;base64,F${i}`);
    const req = createMockReq({ frames });
    const res = createMockRes();

    await handleAnalyzeVideo(req, res);

    // Must be a single call — not one per frame (research #1).
    expect(generateObject).toHaveBeenCalledTimes(1);

    const callArgs = vi.mocked(generateObject).mock.calls[0][0] as any;
    const content = callArgs.messages[0].content;
    const imageParts = content.filter((p: any) => p.type === 'image');

    expect(imageParts).toHaveLength(6);
    expect(imageParts.map((p: any) => p.image)).toEqual(frames);
  });
});
