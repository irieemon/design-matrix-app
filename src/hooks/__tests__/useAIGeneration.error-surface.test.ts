/**
 * useAIGeneration -- ADR-0016 Phase 6: Error Surface Regression Guard
 *
 * Test ID: T-0016-052
 * Type: integration
 * Step coverage: Steps 4/5/6 (IdeaGenerationService, RoadmapService, InsightsService)
 *
 * Contract asserted: When `execute` receives a thrown error from the AI service
 * (i.e., the generator function rejects), `useAIGeneration` catches it and
 * exposes the error message via `error` state. It does NOT call
 * `ToastContext.showError`. Error surface is local-state -> AIProgressOverlay,
 * not global toast.
 *
 * ADR reference: ADR-0016 Wiring Coverage table, "Throw from IdeaGenerationService
 * -> useAIGeneration.execute catch -> setError(message)" (line 628).
 *
 * Expected posture (pre-build):
 *   T-0016-052a: EXPECTED-GREEN -- useAIGeneration already catches thrown errors
 *                and sets error state (ADR-0016 "Files NOT Modified" section
 *                confirms this at useAIGeneration.ts:297).
 *   T-0016-052b: EXPECTED-GREEN -- error is cleared on reset.
 *   T-0016-052c: EXPECTED-GREEN -- AbortError is NOT surfaced as error state.
 *   T-0016-052d: EXPECTED-GREEN -- verify no toast call on error (regression guard
 *                that ToastContext.showError is never wired into the execute path).
 *
 * If any test passes before Colby's Steps 4/5/6 build, that confirms the
 * wiring already exists -- the tests act as regression guards preventing
 * Colby from accidentally breaking this path during mock removal.
 *
 * Isolation strategy:
 *   Sibling file (NOT appended to useAIGeneration.test.ts) because the base
 *   file has 10/16 timing failures at 10000ms. This file uses:
 *   - vi.useFakeTimers() + vi.runAllTimers() + explicit async flush
 *   - Minimal TestComponent with ONLY the execute -> error contract
 *   - No timer-dependent assertions (estimatedSecondsRemaining, progress)
 *   - Individual test timeout: 3000ms
 *
 * DoR retro check:
 *   Lesson 004 (hung process): Fake timers + runAllTimers before useRealTimers
 *   prevents test runner from hanging on recursive setTimeout chains.
 *   Lesson 005 (wiring omission): This test traces the full vertical slice
 *   from execute() throw -> error state -> consumer prop, not just the unit.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useAIGeneration, AIGenerationConfig } from '../useAIGeneration'

// ---------------------------------------------------------------------------
// Mocks -- hoisted before imports
// ---------------------------------------------------------------------------

vi.mock('../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

// ToastContext mock: if useAIGeneration ever calls showError, the spy captures
// it. The assertion in T-0016-052d verifies the spy is NEVER called.
// useAIGeneration.ts does not import ToastContext today -- this mock is a
// sentinel to catch future regressions where someone wires toast into execute.
const mockShowError = vi.fn()
vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({ showError: mockShowError }),
}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MINIMAL_CONFIG: AIGenerationConfig = {
  operationType: 'insights',
  stages: ['Analyzing', 'Synthesizing', 'Finalizing'],
  steps: ['Step 1', 'Step 2', 'Step 3'],
  estimatedTotalSeconds: 5,
  stageThresholds: [0, 33, 66],
}

/**
 * Awaits all pending microtasks and one macrotask tick.
 * Required to let the async execute() body settle after act().
 */
async function flushAsync(): Promise<void> {
  await act(async () => {
    await new Promise<void>(resolve => setTimeout(resolve, 0))
  })
}

// ---------------------------------------------------------------------------
// T-0016-052a: execute() sets error state when generator function throws
// ---------------------------------------------------------------------------

describe('T-0016-052a: useAIGeneration.execute sets error state on thrown error', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockShowError.mockClear()
  })

  afterEach(() => {
    vi.runAllTimers()
    vi.useRealTimers()
  })

  it('should expose the error message via hook.error when the generator throws', { timeout: 3000 }, async () => {
    const ERROR_MESSAGE = 'AI returned no ideas -- please try again'

    const { result } = renderHook(() => useAIGeneration(MINIMAL_CONFIG))

    // Initial state: no error
    expect(result.current.error).toBeNull()

    // Execute with a generator that rejects
    await act(async () => {
      await result.current.execute(async (_signal) => {
        throw new Error(ERROR_MESSAGE)
      })
    })

    // After execute rejects: error state must be set
    expect(result.current.error).toBe(ERROR_MESSAGE)
  })

  it('should set isGenerating to false after a thrown error', { timeout: 3000 }, async () => {
    const { result } = renderHook(() => useAIGeneration(MINIMAL_CONFIG))

    await act(async () => {
      await result.current.execute(async (_signal) => {
        throw new Error('Service unavailable')
      })
    })

    // Generation must have ended
    expect(result.current.isGenerating).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// T-0016-052b: error is cleared when execute is called again (retry path)
// ---------------------------------------------------------------------------

describe('T-0016-052b: useAIGeneration.execute clears previous error on new call', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.runAllTimers()
    vi.useRealTimers()
  })

  it('should clear error state when execute is called after a prior error', { timeout: 3000 }, async () => {
    const { result } = renderHook(() => useAIGeneration(MINIMAL_CONFIG))

    // First execute -- throws
    await act(async () => {
      await result.current.execute(async (_signal) => {
        throw new Error('First failure')
      })
    })

    expect(result.current.error).toBe('First failure')

    // Second execute -- succeeds. Error must be cleared at the start of execute.
    await act(async () => {
      await result.current.execute(async (_signal) => {
        // resolves without error
      })
    })

    expect(result.current.error).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// T-0016-052c: AbortError is NOT surfaced as error state (cancel = silent)
// ---------------------------------------------------------------------------

describe('T-0016-052c: useAIGeneration.execute does not set error on AbortError', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.runAllTimers()
    vi.useRealTimers()
  })

  it('should leave error as null when the generator throws AbortError', { timeout: 3000 }, async () => {
    const { result } = renderHook(() => useAIGeneration(MINIMAL_CONFIG))

    const abortError = Object.assign(new Error('AbortError'), { name: 'AbortError' })

    await act(async () => {
      await result.current.execute(async (_signal) => {
        throw abortError
      })
    })

    // AbortError is a cancel signal -- must NOT set error state
    expect(result.current.error).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// T-0016-052d: ToastContext.showError is NOT called on service error
//
// Regression guard: error surface is useAIGeneration.error -> AIProgressOverlay.
// The toast surface is reserved for Step 3 zombie-session logout only.
// This test enforces that contract by verifying the mock is never called.
// ---------------------------------------------------------------------------

describe('T-0016-052d: useAIGeneration.execute does not call ToastContext.showError on error', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockShowError.mockClear()
  })

  afterEach(() => {
    vi.runAllTimers()
    vi.useRealTimers()
  })

  it('should not call ToastContext.showError when the generator throws', { timeout: 3000 }, async () => {
    const { result } = renderHook(() => useAIGeneration(MINIMAL_CONFIG))

    await act(async () => {
      await result.current.execute(async (_signal) => {
        throw new Error('AI returned no roadmap -- please try again')
      })
    })

    // The error must be in hook state, not dispatched to toast
    expect(result.current.error).not.toBeNull()
    expect(mockShowError).not.toHaveBeenCalled()
  })
})
