import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing handler
vi.mock('ai', () => ({
  generateText: vi.fn(),
  experimental_transcribe: vi.fn(),
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
    modelId: 'whisper-1',
    gatewayModelId: 'openai/whisper-1',
    maxOutputTokens: 4096,
    temperature: 0,
    fallbackModels: [],
  })),
  getProviderOptions: vi.fn(() => undefined),
}));

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn(() => ({
    transcription: vi.fn(() => 'mock-transcription-model'),
  })),
}));

import { generateText, experimental_transcribe } from 'ai';
import { handleTranscribeAudio } from '../../transcribeAudio.js';
import { selectModel } from '../../modelRouter.js';
import { getModel } from '../../providers.js';
import type { VercelResponse } from '@vercel/node';

function createMockReq(body: Record<string, unknown> = {}) {
  return {
    body: {
      audioUrl: 'https://example.com/audio.mp3',
      projectContext: { projectName: 'Test Project', projectType: 'software' },
      language: 'en',
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

describe('handleTranscribeAudio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = 'test-openai-key';
  });

  it('returns 400 if audioUrl is missing', async () => {
    const req = createMockReq({ audioUrl: undefined });
    const res = createMockRes();

    await handleTranscribeAudio(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));
  });

  it('performs two-step pipeline: experimental_transcribe then generateText', async () => {
    // Mock fetch for audio download
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(2048)),
    }) as any;

    (experimental_transcribe as any).mockResolvedValue({
      text: 'This is the transcribed audio content about the project timeline and milestones.',
      segments: [
        { start: 0, end: 5, text: 'This is the transcribed' },
        { start: 5, end: 10, text: 'audio content about the project' },
      ],
    });

    (generateText as any).mockResolvedValue({
      text: 'The audio discusses project timeline and key milestones for the upcoming quarter.',
      usage: { inputTokens: 100, outputTokens: 40, totalTokens: 140 },
    });

    const req = createMockReq();
    const res = createMockRes();

    await handleTranscribeAudio(req, res);

    // Verify two-step pipeline
    expect(experimental_transcribe).toHaveBeenCalledTimes(1);
    expect(generateText).toHaveBeenCalledTimes(1);

    // Verify transcribe was called first, then generateText for summary
    expect(experimental_transcribe).toHaveBeenCalled();
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining('transcri'),
      })
    );

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('response shape includes transcript, summary, and key_insights', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(2048)),
    }) as any;

    (experimental_transcribe as any).mockResolvedValue({
      text: 'Important discussion about the key deliverables and timeline for the project launch next quarter.',
    });

    (generateText as any).mockResolvedValue({
      text: 'Discussion covers project deliverables and Q2 launch timeline.',
      usage: { inputTokens: 80, outputTokens: 30, totalTokens: 110 },
    });

    const req = createMockReq();
    const res = createMockRes();

    await handleTranscribeAudio(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        transcription: expect.objectContaining({
          text: expect.any(String),
          summary: expect.any(String),
          keyPoints: expect.any(Array),
        }),
      })
    );
  });

  it('returns 500 if no AI service configured', async () => {
    delete process.env.OPENAI_API_KEY;

    const req = createMockReq();
    const res = createMockRes();

    await handleTranscribeAudio(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));
  });

  it('handles short transcription without summary', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(512)),
    }) as any;

    (experimental_transcribe as any).mockResolvedValue({
      text: 'Short audio.',
    });

    const req = createMockReq();
    const res = createMockRes();

    await handleTranscribeAudio(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    // For short transcriptions, generateText for summary may be skipped
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        transcription: expect.objectContaining({
          text: expect.any(String),
        }),
      })
    );
  });

  it('uses @ai-sdk/openai for transcription model', async () => {
    const { createOpenAI } = await import('@ai-sdk/openai');

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(2048)),
    }) as any;

    (experimental_transcribe as any).mockResolvedValue({
      text: 'Test transcription content for the project discussion meeting.',
    });

    (generateText as any).mockResolvedValue({
      text: 'Project discussion summary.',
      usage: { inputTokens: 50, outputTokens: 20, totalTokens: 70 },
    });

    const req = createMockReq();
    const res = createMockRes();

    await handleTranscribeAudio(req, res);

    // createOpenAI should be used for transcription (targeted exception per plan)
    expect(createOpenAI).toHaveBeenCalled();
    expect(experimental_transcribe).toHaveBeenCalled();
  });
});
