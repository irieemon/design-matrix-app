import { describe, it, expect } from 'vitest';
import { selectModel, type TaskRoutingContext, type ModelSelection } from '../modelRouter';

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
});
