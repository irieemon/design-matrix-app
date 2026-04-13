/**
 * useAIGeneration hook — ADR-0015 Step 2 contract tests
 *
 * Tests T-0015-021 through T-0015-031 from the ADR test spec.
 * These tests define the contract Colby must implement.
 *
 * Pre-build expected state:
 *   ALL FAIL — useAIGeneration does not exist yet.
 *
 * After Colby's Step 2 implementation all must PASS.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Module-level mocks — hoisted before imports by Vitest
// ---------------------------------------------------------------------------

vi.mock('../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock AiServiceFacade so tests control fetch outcomes without real HTTP.
// The signal spy lets tests verify AbortSignal threading.
const mockExecute = vi.fn()
vi.mock('../../lib/ai/AiServiceFacade', () => ({
  AiServiceFacade: vi.fn().mockImplementation(() => ({
    generateInsights: mockExecute,
    generateRoadmap: mockExecute,
    generateIdea: mockExecute,
    generateMultipleIdeas: mockExecute,
    generateProjectIdeas: mockExecute,
  })),
}))

// ---------------------------------------------------------------------------
// Import hook after mocks are installed
// ---------------------------------------------------------------------------

import { useAIGeneration } from '../useAIGeneration'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal stage config that covers all threshold paths */
const FOUR_STAGE_CONFIG = {
  operationType: 'insights' as const,
  stages: ['Preparing', 'Analyzing', 'Synthesizing', 'Finalizing'],
  steps: ['Reading your ideas', 'Identifying patterns', 'Building insights', 'Writing report'],
  estimatedTotalSeconds: 20,
  stageThresholds: [0, 25, 50, 75],
}

/** Resolves after all pending microtasks and macrotasks. */
const flushAsync = () => act(async () => {
  await new Promise(resolve => setTimeout(resolve, 0))
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useAIGeneration — ADR-0015 Step 2 contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.runAllTimers()
    vi.useRealTimers()
  })

  // -------------------------------------------------------------------------
  // T-0015-021: execute() creates AbortController and passes signal through facade
  // -------------------------------------------------------------------------
  describe('T-0015-021: execute() creates AbortController and passes signal through facade', () => {
    it('should pass an AbortSignal to the facade method on execute', async () => {
      mockExecute.mockResolvedValueOnce({ executiveSummary: 'Great ideas.' })

      const { result } = renderHook(() => useAIGeneration(FOUR_STAGE_CONFIG))

      await act(async () => {
        result.current.execute(mockExecute)
      })

      expect(mockExecute).toHaveBeenCalledTimes(1)
      const callArg = mockExecute.mock.calls[0][0]
      expect(callArg).toBeInstanceOf(AbortSignal)
    })
  })

  // -------------------------------------------------------------------------
  // T-0015-022: cancel() calls controller.abort() and resets isGenerating
  // -------------------------------------------------------------------------
  describe('T-0015-022: cancel() aborts and resets isGenerating to false', () => {
    it('should set isGenerating to false after cancel is called', async () => {
      // Never-resolving promise to hold the hook in generating state
      let rejectFetch!: (e: Error) => void
      mockExecute.mockReturnValueOnce(
        new Promise<never>((_, reject) => {
          rejectFetch = reject
        })
      )

      const { result } = renderHook(() => useAIGeneration(FOUR_STAGE_CONFIG))

      // Start generation (do not await — it is intentionally pending)
      act(() => {
        result.current.execute(mockExecute)
      })

      // Hook should be generating
      await waitFor(() => {
        expect(result.current.isGenerating).toBe(true)
      })

      // Cancel
      act(() => {
        result.current.cancel()
      })

      // Simulate the AbortError the fetch would throw
      rejectFetch(Object.assign(new Error('AbortError'), { name: 'AbortError' }))

      await waitFor(() => {
        expect(result.current.isGenerating).toBe(false)
      })
    })
  })

  // -------------------------------------------------------------------------
  // T-0015-023: useEffect cleanup calls cancel() on unmount
  // -------------------------------------------------------------------------
  describe('T-0015-023: useEffect cleanup aborts on unmount', () => {
    it('should abort the in-flight operation when the component unmounts', async () => {
      let abortSpy: AbortSignal | null = null
      mockExecute.mockImplementationOnce((signal: AbortSignal) => {
        abortSpy = signal
        // Return a never-settling promise to keep the operation in-flight
        return new Promise<never>(() => {})
      })

      const { result, unmount } = renderHook(() => useAIGeneration(FOUR_STAGE_CONFIG))

      act(() => {
        result.current.execute(mockExecute)
      })

      // Signal should not be aborted while in-flight
      await waitFor(() => {
        expect(abortSpy).not.toBeNull()
      })
      expect(abortSpy!.aborted).toBe(false)

      // Unmount should trigger cleanup which calls abort()
      unmount()

      expect(abortSpy!.aborted).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  // T-0015-024: double-click prevention — execute() no-ops when isGenerating
  // -------------------------------------------------------------------------
  describe('T-0015-024: execute() is a no-op when isGenerating is already true', () => {
    it('should call the facade only once when execute is called twice rapidly', async () => {
      let resolveFirst!: (v: unknown) => void
      mockExecute.mockReturnValueOnce(new Promise(resolve => { resolveFirst = resolve }))
      mockExecute.mockResolvedValue({ executiveSummary: 'second call' })

      const { result } = renderHook(() => useAIGeneration(FOUR_STAGE_CONFIG))

      // First call — starts generating
      act(() => {
        result.current.execute(mockExecute)
      })

      await waitFor(() => {
        expect(result.current.isGenerating).toBe(true)
      })

      // Second call while already generating — should be ignored
      act(() => {
        result.current.execute(mockExecute)
      })

      // Only the first call should have gone through
      expect(mockExecute).toHaveBeenCalledTimes(1)

      // Resolve first so the hook finishes cleanly
      act(() => {
        resolveFirst({ executiveSummary: 'done' })
      })
    })
  })

  // -------------------------------------------------------------------------
  // T-0015-025: progress deceleration curve
  // -------------------------------------------------------------------------
  describe('T-0015-025: progress deceleration curve', () => {
    it('should have progress < 60 at 50% elapsed time and >= 55 at 70% elapsed time', async () => {
      // Never resolves — we control time manually
      mockExecute.mockReturnValueOnce(new Promise<never>(() => {}))

      const { result } = renderHook(() => useAIGeneration(FOUR_STAGE_CONFIG))

      act(() => {
        result.current.execute(mockExecute)
      })

      const totalMs = FOUR_STAGE_CONFIG.estimatedTotalSeconds * 1000

      // At 50% elapsed: linear zone should put progress below 60
      await act(async () => {
        vi.advanceTimersByTime(totalMs * 0.5)
      })
      const progressAt50 = result.current.progress
      expect(progressAt50).toBeLessThan(60)

      // At 70% elapsed: should be >= 55 (advanced into deceleration zone)
      await act(async () => {
        vi.advanceTimersByTime(totalMs * 0.2)
      })
      const progressAt70 = result.current.progress
      expect(progressAt70).toBeGreaterThanOrEqual(55)
    })
  })

  // -------------------------------------------------------------------------
  // T-0015-026: progress holds at 95% — never reaches 100 without server response
  // -------------------------------------------------------------------------
  describe('T-0015-026: progress holds at 95% without server response', () => {
    it('should cap progress at 95 when the server has not responded', async () => {
      mockExecute.mockReturnValueOnce(new Promise<never>(() => {}))

      const { result } = renderHook(() => useAIGeneration(FOUR_STAGE_CONFIG))

      act(() => {
        result.current.execute(mockExecute)
      })

      // Advance well past total estimated time
      await act(async () => {
        vi.advanceTimersByTime(FOUR_STAGE_CONFIG.estimatedTotalSeconds * 1000 * 3)
      })

      expect(result.current.progress).toBeLessThanOrEqual(95)
      expect(result.current.progress).toBeGreaterThanOrEqual(90)
    })
  })

  // -------------------------------------------------------------------------
  // T-0015-027: on success, progress jumps to 100 and stage becomes "Complete!"
  // -------------------------------------------------------------------------
  describe('T-0015-027: on successful response, progress is 100 and stage is "Complete!"', () => {
    it('should set progress to 100 and stage to "Complete!" after the server responds', async () => {
      mockExecute.mockResolvedValueOnce({ executiveSummary: 'All done.' })

      const { result } = renderHook(() => useAIGeneration(FOUR_STAGE_CONFIG))

      await act(async () => {
        result.current.execute(mockExecute)
      })

      await waitFor(() => {
        expect(result.current.isGenerating).toBe(false)
      })

      expect(result.current.progress).toBe(100)
      expect(result.current.stage).toBe('Complete!')
    })
  })

  // -------------------------------------------------------------------------
  // T-0015-028: on AbortError, error is null and isGenerating is false (silent reset)
  // -------------------------------------------------------------------------
  describe('T-0015-028: AbortError produces silent reset — no error, not generating', () => {
    it('should set error to null and isGenerating to false when AbortError is thrown', async () => {
      const abortError = Object.assign(new Error('The user aborted a request.'), { name: 'AbortError' })
      mockExecute.mockRejectedValueOnce(abortError)

      const { result } = renderHook(() => useAIGeneration(FOUR_STAGE_CONFIG))

      await act(async () => {
        result.current.execute(mockExecute)
      })

      await waitFor(() => {
        expect(result.current.isGenerating).toBe(false)
      })

      expect(result.current.error).toBeNull()
    })
  })

  // -------------------------------------------------------------------------
  // T-0015-029: on server 500 error, error message is set and isGenerating is false
  // -------------------------------------------------------------------------
  describe('T-0015-029: server 500 sets error message', () => {
    it('should set an error message and stop generating when the server returns a 500-class error', async () => {
      mockExecute.mockRejectedValueOnce(new Error('Server error: 500'))

      const { result } = renderHook(() => useAIGeneration(FOUR_STAGE_CONFIG))

      await act(async () => {
        result.current.execute(mockExecute)
      })

      await waitFor(() => {
        expect(result.current.isGenerating).toBe(false)
      })

      expect(result.current.error).not.toBeNull()
      expect(typeof result.current.error).toBe('string')
    })
  })

  // -------------------------------------------------------------------------
  // T-0015-030: on 402 quota exceeded, quotaExhausted state is set
  // -------------------------------------------------------------------------
  describe('T-0015-030: 402 response sets quotaExhausted state', () => {
    it('should set quotaExhausted with response data when the server returns a 402 error', async () => {
      const quotaError = Object.assign(
        new Error('Server error: 402 quota_exceeded'),
        {
          status: 402,
          responseBody: {
            error: {
              code: 'quota_exceeded',
              resource: 'ai_insights',
              limit: 5,
              used: 5,
              upgradeUrl: '/pricing',
            },
          },
        }
      )
      mockExecute.mockRejectedValueOnce(quotaError)

      const { result } = renderHook(() => useAIGeneration(FOUR_STAGE_CONFIG))

      await act(async () => {
        result.current.execute(mockExecute)
      })

      await waitFor(() => {
        expect(result.current.isGenerating).toBe(false)
      })

      expect(result.current.quotaExhausted).not.toBeNull()
      expect(result.current.error).toBeNull()
    })
  })

  // -------------------------------------------------------------------------
  // T-0015-031: stage transitions at correct thresholds for a 4-stage config
  // -------------------------------------------------------------------------
  describe('T-0015-031: stage transitions at correct percentage thresholds (4-stage config)', () => {
    it('should advance through all 4 stages at the configured thresholds', async () => {
      mockExecute.mockReturnValueOnce(new Promise<never>(() => {}))

      const { result } = renderHook(() => useAIGeneration(FOUR_STAGE_CONFIG))

      act(() => {
        result.current.execute(mockExecute)
      })

      const totalMs = FOUR_STAGE_CONFIG.estimatedTotalSeconds * 1000
      const observedStages: string[] = []

      // Stage 0 — immediate start
      await waitFor(() => {
        expect(result.current.isGenerating).toBe(true)
      })
      observedStages.push(result.current.stage)

      // Advance to ~26% (just past 25% threshold)
      await act(async () => {
        vi.advanceTimersByTime(totalMs * 0.26)
      })
      observedStages.push(result.current.stage)

      // Advance to ~51% (just past 50% threshold)
      await act(async () => {
        vi.advanceTimersByTime(totalMs * 0.25)
      })
      observedStages.push(result.current.stage)

      // Advance to ~76% (just past 75% threshold)
      await act(async () => {
        vi.advanceTimersByTime(totalMs * 0.25)
      })
      observedStages.push(result.current.stage)

      const uniqueStages = [...new Set(observedStages)]
      expect(uniqueStages.length).toBeGreaterThanOrEqual(2)

      const configStages = FOUR_STAGE_CONFIG.stages
      uniqueStages.forEach(stage => {
        expect(configStages).toContain(stage)
      })
    })
  })

  // -------------------------------------------------------------------------
  // Initial state contract
  // -------------------------------------------------------------------------
  describe('initial state', () => {
    it('should return the full expected interface on mount', () => {
      const { result } = renderHook(() => useAIGeneration(FOUR_STAGE_CONFIG))

      expect(result.current).toHaveProperty('execute')
      expect(result.current).toHaveProperty('cancel')
      expect(result.current).toHaveProperty('isGenerating')
      expect(result.current).toHaveProperty('progress')
      expect(result.current).toHaveProperty('stage')
      expect(result.current).toHaveProperty('estimatedSecondsRemaining')
      expect(result.current).toHaveProperty('processingSteps')
      expect(result.current).toHaveProperty('stageSequence')
      expect(result.current).toHaveProperty('error')
      expect(result.current).toHaveProperty('quotaExhausted')
      expect(result.current).toHaveProperty('retry')

      expect(result.current.isGenerating).toBe(false)
      expect(result.current.progress).toBe(0)
      expect(result.current.error).toBeNull()
      expect(result.current.quotaExhausted).toBeNull()
    })

    it('should populate processingSteps and stageSequence from the stage config', () => {
      const { result } = renderHook(() => useAIGeneration(FOUR_STAGE_CONFIG))

      expect(result.current.processingSteps).toEqual(FOUR_STAGE_CONFIG.steps)
      expect(result.current.stageSequence).toEqual(FOUR_STAGE_CONFIG.stages)
    })
  })

  // -------------------------------------------------------------------------
  // estimatedSecondsRemaining counts down during generation
  // -------------------------------------------------------------------------
  describe('estimatedSecondsRemaining', () => {
    it('should start at estimatedTotalSeconds and decrease over time', async () => {
      mockExecute.mockReturnValueOnce(new Promise<never>(() => {}))

      const { result } = renderHook(() => useAIGeneration(FOUR_STAGE_CONFIG))

      act(() => {
        result.current.execute(mockExecute)
      })

      await waitFor(() => {
        expect(result.current.isGenerating).toBe(true)
      })

      const initialRemaining = result.current.estimatedSecondsRemaining
      expect(initialRemaining).toBeGreaterThan(0)
      expect(initialRemaining).toBeLessThanOrEqual(FOUR_STAGE_CONFIG.estimatedTotalSeconds)

      await act(async () => {
        vi.advanceTimersByTime(5000)
      })

      // After 5 seconds, remaining should have decreased
      expect(result.current.estimatedSecondsRemaining).toBeLessThan(initialRemaining)
    })

    it('should not go below 0', async () => {
      mockExecute.mockReturnValueOnce(new Promise<never>(() => {}))

      const { result } = renderHook(() => useAIGeneration(FOUR_STAGE_CONFIG))

      act(() => {
        result.current.execute(mockExecute)
      })

      await act(async () => {
        vi.advanceTimersByTime(FOUR_STAGE_CONFIG.estimatedTotalSeconds * 1000 * 2)
      })

      expect(result.current.estimatedSecondsRemaining).toBeGreaterThanOrEqual(0)
    })
  })

  // -------------------------------------------------------------------------
  // retry() resets state and allows re-execution
  // -------------------------------------------------------------------------
  describe('retry()', () => {
    it('should reset error state and allow execute to run again', async () => {
      mockExecute.mockRejectedValueOnce(new Error('Server error: 500'))

      const { result } = renderHook(() => useAIGeneration(FOUR_STAGE_CONFIG))

      await act(async () => {
        result.current.execute(mockExecute)
      })

      await waitFor(() => {
        expect(result.current.error).not.toBeNull()
      })

      mockExecute.mockResolvedValueOnce({ executiveSummary: 'Retry succeeded.' })

      await act(async () => {
        result.current.retry()
      })

      await waitFor(() => {
        expect(result.current.error).toBeNull()
      })
    })
  })
})
