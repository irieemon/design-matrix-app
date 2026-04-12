import { describe, it, expect } from 'vitest';
import { selectModel, getProviderOptions, type TaskRoutingContext, type ModelSelection } from '../modelRouter';

function makeContext(overrides: Partial<TaskRoutingContext> = {}): TaskRoutingContext {
  return {
    task: 'generate-ideas',
    hasVision: false,
    hasAudio: false,
    userTier: 'free',
    ...overrides,
  };
}

function isValidSelection(selection: ModelSelection): boolean {
  return (
    typeof selection.provider === 'string' &&
    typeof selection.modelId === 'string' &&
    typeof selection.gatewayModelId === 'string' &&
    typeof selection.maxOutputTokens === 'number' &&
    selection.maxOutputTokens > 0
  );
}

describe('selectModel', () => {
  describe('vision routing', () => {
    it('selectModel with hasVision=true returns provider openai or anthropic (never minimax)', () => {
      const result = selectModel(makeContext({ hasVision: true }));
      expect(['openai', 'anthropic']).toContain(result.provider);
      expect(result.provider).not.toBe('minimax');
    });

    it('selectModel with task=analyze-image always returns a vision-capable model', () => {
      const result = selectModel(makeContext({ task: 'analyze-image' }));
      expect(['openai', 'anthropic']).toContain(result.provider);
      expect(result.provider).not.toBe('minimax');
    });

    it('vision tasks NEVER return minimax provider', () => {
      // Test all possible vision combinations
      const visionContexts = [
        makeContext({ hasVision: true, task: 'generate-ideas' }),
        makeContext({ hasVision: true, task: 'generate-insights' }),
        makeContext({ task: 'analyze-image' }),
        makeContext({ task: 'analyze-file', hasVision: true }),
      ];

      for (const ctx of visionContexts) {
        const result = selectModel(ctx);
        expect(result.provider).not.toBe('minimax');
      }
    });
  });

  describe('audio routing', () => {
    it('selectModel with hasAudio=true returns provider openai and modelId whisper-1', () => {
      const result = selectModel(makeContext({ hasAudio: true }));
      expect(result.provider).toBe('openai');
      expect(result.modelId).toBe('whisper-1');
    });

    it('selectModel with task=transcribe-audio always returns whisper-1', () => {
      const result = selectModel(makeContext({ task: 'transcribe-audio' }));
      expect(result.provider).toBe('openai');
      expect(result.modelId).toBe('whisper-1');
      expect(result.gatewayModelId).toBe('openai/whisper-1');
    });
  });

  describe('text task routing', () => {
    it('selectModel with task=generate-ideas returns a valid text model', () => {
      const result = selectModel(makeContext({ task: 'generate-ideas' }));
      expect(isValidSelection(result)).toBe(true);
    });

    it('selectModel with task=generate-insights returns a capable model', () => {
      const result = selectModel(makeContext({ task: 'generate-insights' }));
      expect(isValidSelection(result)).toBe(true);
      // Insights needs a capable model
      expect(['openai', 'anthropic']).toContain(result.provider);
    });

    it('selectModel with task=generate-roadmap returns a capable model', () => {
      const result = selectModel(makeContext({ task: 'generate-roadmap' }));
      expect(isValidSelection(result)).toBe(true);
      expect(['openai', 'anthropic']).toContain(result.provider);
    });
  });

  describe('all task types return valid selections', () => {
    const allTasks: TaskRoutingContext['task'][] = [
      'generate-ideas',
      'generate-insights',
      'generate-roadmap',
      'analyze-file',
      'analyze-image',
      'transcribe-audio',
    ];

    for (const task of allTasks) {
      it(`task=${task} returns a valid ModelSelection`, () => {
        const result = selectModel(makeContext({ task }));
        expect(isValidSelection(result)).toBe(true);
        expect(result.gatewayModelId).toContain('/');
      });
    }
  });

  describe('error handling', () => {
    it('throws a descriptive error for unknown task', () => {
      expect(() =>
        selectModel(makeContext({ task: 'unknown-task' as any }))
      ).toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // ADR-0013 Step 2: Profile-aware routing
  // ---------------------------------------------------------------------------

  describe('profile-aware routing', () => {
    const BALANCED_PROFILE = {
      id: 'test-balanced',
      name: 'balanced',
      display_name: 'Balanced',
      is_active: true,
      task_configs: {
        'generate-ideas': { gatewayModelId: 'anthropic/claude-sonnet-4.6', fallbackModels: ['google/gemini-2.5-flash'], temperature: 0.8, maxOutputTokens: 4096 },
        'generate-insights': { gatewayModelId: 'anthropic/claude-sonnet-4.6', fallbackModels: ['google/gemini-2.5-flash'], temperature: 0.5, maxOutputTokens: 4096 },
        'generate-roadmap': { gatewayModelId: 'anthropic/claude-sonnet-4.6', fallbackModels: ['openai/gpt-5.4-mini'], temperature: 0.6, maxOutputTokens: 8192 },
        'analyze-image': { gatewayModelId: 'openai/gpt-5.4', fallbackModels: ['anthropic/claude-sonnet-4.6'], temperature: 0.3, maxOutputTokens: 4096 },
        'analyze-video': { gatewayModelId: 'openai/gpt-5.4', fallbackModels: ['anthropic/claude-sonnet-4.6'], temperature: 0.3, maxOutputTokens: 4096 },
        'analyze-file': { gatewayModelId: 'anthropic/claude-sonnet-4.6', fallbackModels: ['google/gemini-2.5-flash'], temperature: 0.3, maxOutputTokens: 4096 },
        'transcribe-summary': { gatewayModelId: 'anthropic/claude-haiku-4.5', fallbackModels: ['google/gemini-2.5-flash'], temperature: 0.0, maxOutputTokens: 4096 },
      },
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    } as const;

    const BUDGET_PROFILE = {
      id: 'test-budget',
      name: 'budget',
      display_name: 'Budget',
      is_active: true,
      task_configs: {
        'generate-ideas': { gatewayModelId: 'google/gemini-2.5-flash', fallbackModels: ['deepseek/deepseek-v3.2'], temperature: 0.8, maxOutputTokens: 4096 },
        'generate-insights': { gatewayModelId: 'google/gemini-2.5-flash', fallbackModels: ['deepseek/deepseek-v3.2'], temperature: 0.5, maxOutputTokens: 4096 },
        'generate-roadmap': { gatewayModelId: 'google/gemini-2.5-flash', fallbackModels: ['deepseek/deepseek-v3.2'], temperature: 0.6, maxOutputTokens: 8192 },
        'analyze-image': { gatewayModelId: 'openai/gpt-4o', fallbackModels: [], temperature: 0.3, maxOutputTokens: 4096 },
        'analyze-video': { gatewayModelId: 'openai/gpt-4o', fallbackModels: [], temperature: 0.3, maxOutputTokens: 4096 },
        'analyze-file': { gatewayModelId: 'google/gemini-2.5-flash', fallbackModels: ['deepseek/deepseek-v3.2'], temperature: 0.3, maxOutputTokens: 4096 },
        'transcribe-summary': { gatewayModelId: 'google/gemini-2.5-flash', fallbackModels: [], temperature: 0.0, maxOutputTokens: 4096 },
      },
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    } as const;

    // Profile with missing task keys (no generate-ideas entry)
    const PARTIAL_PROFILE = {
      id: 'test-partial',
      name: 'partial',
      display_name: 'Partial',
      is_active: true,
      task_configs: {
        'generate-insights': { gatewayModelId: 'anthropic/claude-sonnet-4.6', fallbackModels: [], temperature: 0.5, maxOutputTokens: 4096 },
      },
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    } as const;

    it('T-0013-007: selectModel with balanced profile + generate-ideas returns anthropic/claude-sonnet-4.6', () => {
      const result = selectModel(makeContext({ task: 'generate-ideas' }), BALANCED_PROFILE as any);
      expect(result.gatewayModelId).toBe('anthropic/claude-sonnet-4.6');
      expect(result.provider).toBe('anthropic');
      expect(result.temperature).toBe(0.8);
      expect(result.fallbackModels).toEqual(['google/gemini-2.5-flash']);
    });

    it('T-0013-008: selectModel with budget profile + generate-ideas returns google/gemini-2.5-flash', () => {
      const result = selectModel(makeContext({ task: 'generate-ideas' }), BUDGET_PROFILE as any);
      expect(result.gatewayModelId).toBe('google/gemini-2.5-flash');
      expect(result.provider).toBe('google');
      expect(result.fallbackModels).toEqual(['deepseek/deepseek-v3.2']);
    });

    it('T-0013-009: selectModel with profile + transcribe-audio STILL returns whisper-1', () => {
      const result = selectModel(makeContext({ task: 'transcribe-audio' }), BALANCED_PROFILE as any);
      expect(result.provider).toBe('openai');
      expect(result.modelId).toBe('whisper-1');
      expect(result.gatewayModelId).toBe('openai/whisper-1');
      expect(result.fallbackModels).toEqual([]);
    });

    it('T-0013-010: selectModel without profile returns gpt-4o (backward-compatible)', () => {
      const result = selectModel(makeContext({ task: 'generate-ideas' }));
      expect(result.gatewayModelId).toBe('openai/gpt-4o');
      expect(result.provider).toBe('openai');
      expect(result.fallbackModels).toEqual([]);
    });

    it('T-0013-013: selectModel with profile where task key is missing returns gpt-4o fallback with empty fallbackModels', () => {
      const result = selectModel(makeContext({ task: 'generate-ideas' }), PARTIAL_PROFILE as any);
      expect(result.gatewayModelId).toBe('openai/gpt-4o');
      expect(result.fallbackModels).toEqual([]);
    });

    it('T-0013-042: selectModel with profile + analyze-video returns profile video model', () => {
      const result = selectModel(makeContext({ task: 'analyze-video' as any }), BALANCED_PROFILE as any);
      expect(result.gatewayModelId).toBe('openai/gpt-5.4');
      expect(result.provider).toBe('openai');
      expect(result.temperature).toBe(0.3);
      expect(result.fallbackModels).toEqual(['anthropic/claude-sonnet-4.6']);
    });

    it('T-0013-043: selectModel with profile + transcribe-summary returns profile summary model', () => {
      const result = selectModel(makeContext({ task: 'transcribe-summary' as any }), BALANCED_PROFILE as any);
      expect(result.gatewayModelId).toBe('anthropic/claude-haiku-4.5');
      expect(result.provider).toBe('anthropic');
      expect(result.temperature).toBe(0.0);
      expect(result.fallbackModels).toEqual(['google/gemini-2.5-flash']);
    });
  });

  describe('getProviderOptions', () => {
    it('T-0013-011: returns undefined for empty fallback array', () => {
      expect(getProviderOptions([])).toBeUndefined();
    });

    it('T-0013-012: returns gateway options with models and caching for non-empty array', () => {
      const result = getProviderOptions(['a/b', 'c/d']);
      expect(result).toEqual({
        gateway: {
          models: ['a/b', 'c/d'],
          caching: 'auto',
        },
      });
    });
  });
});
