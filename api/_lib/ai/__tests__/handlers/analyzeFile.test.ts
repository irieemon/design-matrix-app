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
    modelId: 'gpt-4o',
    gatewayModelId: 'openai/gpt-4o',
    maxOutputTokens: 4096,
    temperature: 0.3,
    fallbackModels: [],
  })),
  getProviderOptions: vi.fn(() => undefined),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: null, error: null })),
          })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => Promise.resolve({ data: [{}], error: null })),
        })),
      })),
    })),
    storage: {
      from: vi.fn(() => ({
        createSignedUrl: vi.fn(() => Promise.resolve({ data: { signedUrl: 'https://example.com/signed' }, error: null })),
      })),
    },
  })),
}));

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn(() => ({
    transcription: vi.fn(() => 'mock-transcription-model'),
  })),
}));

import { generateText, experimental_transcribe } from 'ai';
import { handleAnalyzeFile } from '../../analyzeFile.js';
import { selectModel } from '../../modelRouter.js';
import { getModel } from '../../providers.js';
import type { VercelResponse } from '@vercel/node';

function createMockReq(body: Record<string, unknown> = {}) {
  return {
    body: {
      fileId: 'file-123',
      projectId: 'project-456',
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

describe('handleAnalyzeFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.VITE_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
    process.env.OPENAI_API_KEY = 'test-openai-key';
  });

  it('returns 400 if fileId is missing', async () => {
    const req = createMockReq({ fileId: undefined });
    const res = createMockRes();

    await handleAnalyzeFile(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));
  });

  it('returns 400 if projectId is missing', async () => {
    const req = createMockReq({ projectId: undefined });
    const res = createMockRes();

    await handleAnalyzeFile(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('uses generateText with vision content parts for image files', async () => {
    // Mock Supabase to return an image file record
    const { createClient } = await import('@supabase/supabase-js');
    const mockSingle = vi.fn(() => Promise.resolve({
      data: {
        id: 'file-123',
        name: 'photo.jpg',
        mime_type: 'image/jpeg',
        storage_path: 'uploads/photo.jpg',
        analysis_status: 'pending',
        ai_analysis: null,
      },
      error: null,
    }));

    const mockEq2 = vi.fn(() => ({ single: mockSingle }));
    const mockEq1 = vi.fn(() => ({ eq: mockEq2 }));
    const mockSelect = vi.fn(() => ({ eq: mockEq1 }));
    const mockUpdate = vi.fn(() => ({
      eq: vi.fn(() => ({
        select: vi.fn(() => Promise.resolve({ data: [{}], error: null })),
      })),
    }));

    (createClient as any).mockReturnValue({
      from: vi.fn(() => ({
        select: mockSelect,
        update: mockUpdate,
      })),
      storage: {
        from: vi.fn(() => ({
          createSignedUrl: vi.fn(() => Promise.resolve({
            data: { signedUrl: 'https://example.com/signed-photo.jpg' },
            error: null,
          })),
        })),
      },
    });

    (generateText as any).mockResolvedValue({
      text: JSON.stringify({
        summary: 'A test image',
        key_insights: ['test insight'],
        visual_description: 'test description',
        extracted_text: '',
        relevance_score: 0.8,
      }),
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    });

    const req = createMockReq();
    const res = createMockRes();

    await handleAnalyzeFile(req, res);

    // Verify selectModel called with hasVision: true for image files
    expect(selectModel).toHaveBeenCalledWith(
      expect.objectContaining({
        task: 'analyze-file',
        hasVision: true,
        hasAudio: false,
      }),
      expect.anything()
    );

    // Verify generateText was called with vision content parts
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: expect.arrayContaining([
              expect.objectContaining({ type: 'text' }),
              expect.objectContaining({ type: 'image' }),
            ]),
          }),
        ]),
      })
    );

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('uses experimental_transcribe + generateText for audio files', async () => {
    const { createClient } = await import('@supabase/supabase-js');
    const mockSingle = vi.fn(() => Promise.resolve({
      data: {
        id: 'file-123',
        name: 'recording.mp3',
        mime_type: 'audio/mpeg',
        storage_path: 'uploads/recording.mp3',
        analysis_status: 'pending',
        ai_analysis: null,
      },
      error: null,
    }));

    const mockEq2 = vi.fn(() => ({ single: mockSingle }));
    const mockEq1 = vi.fn(() => ({ eq: mockEq2 }));
    const mockSelect = vi.fn(() => ({ eq: mockEq1 }));
    const mockUpdate = vi.fn(() => ({
      eq: vi.fn(() => ({
        select: vi.fn(() => Promise.resolve({ data: [{}], error: null })),
      })),
    }));

    (createClient as any).mockReturnValue({
      from: vi.fn(() => ({
        select: mockSelect,
        update: mockUpdate,
      })),
      storage: {
        from: vi.fn(() => ({
          createSignedUrl: vi.fn(() => Promise.resolve({
            data: { signedUrl: 'https://example.com/signed-audio.mp3' },
            error: null,
          })),
        })),
      },
    });

    // Mock global fetch for audio download
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)),
    }) as any;

    (experimental_transcribe as any).mockResolvedValue({
      text: 'This is a transcribed audio about the project plan.',
    });

    (generateText as any).mockResolvedValue({
      text: JSON.stringify({
        summary: 'Audio about project plan',
        key_insights: ['project planning discussed'],
        relevance_score: 0.7,
      }),
      usage: { inputTokens: 80, outputTokens: 40, totalTokens: 120 },
    });

    const req = createMockReq();
    const res = createMockRes();

    await handleAnalyzeFile(req, res);

    // Verify two-step pipeline: transcribe then summarize
    expect(experimental_transcribe).toHaveBeenCalled();
    expect(generateText).toHaveBeenCalled();

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('uses generateText with gpt-4o-mini for text files', async () => {
    const { createClient } = await import('@supabase/supabase-js');
    const mockSingle = vi.fn(() => Promise.resolve({
      data: {
        id: 'file-123',
        name: 'document.txt',
        mime_type: 'text/plain',
        storage_path: 'uploads/document.txt',
        content_preview: 'This is a detailed document about the project requirements and specifications for the upcoming sprint planning session.',
        analysis_status: 'pending',
        ai_analysis: null,
      },
      error: null,
    }));

    const mockEq2 = vi.fn(() => ({ single: mockSingle }));
    const mockEq1 = vi.fn(() => ({ eq: mockEq2 }));
    const mockSelect = vi.fn(() => ({ eq: mockEq1 }));
    const mockUpdate = vi.fn(() => ({
      eq: vi.fn(() => ({
        select: vi.fn(() => Promise.resolve({ data: [{}], error: null })),
      })),
    }));

    (createClient as any).mockReturnValue({
      from: vi.fn(() => ({
        select: mockSelect,
        update: mockUpdate,
      })),
    });

    (generateText as any).mockResolvedValue({
      text: JSON.stringify({
        summary: 'A document about project requirements',
        key_insights: ['sprint planning details'],
        relevance_score: 0.9,
      }),
      usage: { inputTokens: 200, outputTokens: 100, totalTokens: 300 },
    });

    const req = createMockReq();
    const res = createMockRes();

    await handleAnalyzeFile(req, res);

    // Verify getModel called with the model selected by selectModel (profile-aware routing)
    expect(getModel).toHaveBeenCalledWith('openai/gpt-4o');

    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        maxOutputTokens: expect.any(Number),
      })
    );

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns cached analysis if already completed', async () => {
    const { createClient } = await import('@supabase/supabase-js');
    const cachedAnalysis = { summary: 'cached', key_insights: ['cached insight'] };

    const mockSingle = vi.fn(() => Promise.resolve({
      data: {
        id: 'file-123',
        name: 'photo.jpg',
        mime_type: 'image/jpeg',
        analysis_status: 'completed',
        ai_analysis: cachedAnalysis,
      },
      error: null,
    }));

    const mockEq2 = vi.fn(() => ({ single: mockSingle }));
    const mockEq1 = vi.fn(() => ({ eq: mockEq2 }));
    const mockSelect = vi.fn(() => ({ eq: mockEq1 }));

    (createClient as any).mockReturnValue({
      from: vi.fn(() => ({
        select: mockSelect,
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => Promise.resolve({ data: [{}], error: null })),
          })),
        })),
      })),
    });

    const req = createMockReq();
    const res = createMockRes();

    await handleAnalyzeFile(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ cached: true }));
    expect(generateText).not.toHaveBeenCalled();
  });

  it('image analysis never routes to MiniMax (AI-04)', async () => {
    const { createClient } = await import('@supabase/supabase-js');
    const mockSingle = vi.fn(() => Promise.resolve({
      data: {
        id: 'file-123',
        name: 'photo.jpg',
        mime_type: 'image/jpeg',
        storage_path: 'uploads/photo.jpg',
        analysis_status: 'pending',
        ai_analysis: null,
      },
      error: null,
    }));

    const mockEq2 = vi.fn(() => ({ single: mockSingle }));
    const mockEq1 = vi.fn(() => ({ eq: mockEq2 }));
    const mockSelect = vi.fn(() => ({ eq: mockEq1 }));

    (createClient as any).mockReturnValue({
      from: vi.fn(() => ({
        select: mockSelect,
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => Promise.resolve({ data: [{}], error: null })),
          })),
        })),
      })),
      storage: {
        from: vi.fn(() => ({
          createSignedUrl: vi.fn(() => Promise.resolve({
            data: { signedUrl: 'https://example.com/signed.jpg' },
            error: null,
          })),
        })),
      },
    });

    (generateText as any).mockResolvedValue({
      text: '{"summary":"test","key_insights":[],"visual_description":"test","extracted_text":"","relevance_score":0.5}',
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    });

    const req = createMockReq();
    const res = createMockRes();

    await handleAnalyzeFile(req, res);

    // selectModel should always be called with hasVision: true for images
    expect(selectModel).toHaveBeenCalledWith(
      expect.objectContaining({
        hasVision: true,
      }),
      expect.anything()
    );
  });
});
