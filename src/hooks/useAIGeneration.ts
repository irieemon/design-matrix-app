/**
 * useAIGeneration -- ADR-0015 Step 2
 *
 * Manages the full AI generation lifecycle: AbortController creation,
 * progress simulation with deceleration curve, stage transitions,
 * cancel support, and error/quota handling.
 *
 * Standalone hook (not wrapping useAsyncOperation) per ADR Decision 1:
 * one state machine, one source of truth for the generation lifecycle.
 *
 * Timer strategy: A single tick counter state drives re-renders during
 * generation. Progress, stage index, and estimated time remaining are
 * derived from wall-clock time (Date.now) during render -- not stored
 * as state updated from the timer callback. This avoids the infinite
 * timer cascade that occurs when React 18 act() + fake timers encounter
 * setState inside setInterval callbacks (React's internal scheduler
 * uses setTimeout, which cascades under fake timers).
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { logger } from '../utils/logger'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AIGenerationConfig {
  operationType: string
  stages: string[]
  steps: string[]
  estimatedTotalSeconds: number
  stageThresholds: number[]
}

interface QuotaExhaustedInfo {
  code: string
  resource: string
  limit: number
  used: number
  upgradeUrl: string
}

export interface UseAIGenerationReturn {
  execute: (generatorFn: (signal: AbortSignal) => Promise<unknown>) => Promise<void>
  cancel: () => void
  retry: () => void
  isGenerating: boolean
  progress: number
  stage: string
  estimatedSecondsRemaining: number
  processingSteps: string[]
  stageSequence: string[]
  error: string | null
  quotaExhausted: QuotaExhaustedInfo | null
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROGRESS_INTERVAL_MS = 100
const MAX_SIMULATED_PROGRESS = 95

// ---------------------------------------------------------------------------
// Progress deceleration curve
//
// 0-60%:  linear (1.0x speed)
// 60-85%: deceleration (0.7x speed)
// 85-95%: crawl (0.3x speed)
// 95%+:   hold (no further simulated progress)
// ---------------------------------------------------------------------------

function calculateProgress(elapsedMs: number, estimatedTotalMs: number): number {
  const fraction = elapsedMs / estimatedTotalMs

  let progress: number

  if (fraction <= 0.6) {
    // Linear zone: maps 0-0.6 of time to 0-60% progress
    progress = (fraction / 0.6) * 60
  } else if (fraction <= 0.85) {
    // Deceleration zone: maps 0.6-0.85 of time to 60-85% at 0.7x rate
    const zoneFraction = (fraction - 0.6) / 0.25
    progress = 60 + zoneFraction * 25 * 0.7
  } else if (fraction <= 1.5) {
    // Crawl zone: maps 0.85-1.5 of time to ~77.5%-95% at 0.3x rate
    const baseFromDecel = 60 + 25 * 0.7 // 77.5
    const zoneFraction = (fraction - 0.85) / 0.65
    progress = baseFromDecel + zoneFraction * (MAX_SIMULATED_PROGRESS - baseFromDecel) * 0.3
  } else {
    progress = MAX_SIMULATED_PROGRESS
  }

  return Math.min(progress, MAX_SIMULATED_PROGRESS)
}

function resolveStageIndex(progress: number, thresholds: number[]): number {
  let idx = 0
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (progress >= thresholds[i]) {
      idx = i
      break
    }
  }
  return idx
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAIGeneration(config: AIGenerationConfig): UseAIGenerationReturn {
  const { stages, steps, estimatedTotalSeconds, stageThresholds } = config

  // Core state
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [quotaExhausted, setQuotaExhausted] = useState<QuotaExhaustedInfo | null>(null)

  // Completion override: when the generator resolves, we set progress to 100
  // and the final stage. When not completed, progress is derived from time.
  const [completedProgress, setCompletedProgress] = useState<number | null>(null)
  const [completedStageIndex, setCompletedStageIndex] = useState<number | null>(null)

  // Elapsed milliseconds: the ONLY state updated by the timer callback.
  // Stored as state so render reads only pure state (no Date.now() or ref.current
  // during render, satisfying react-hooks/purity and react-hooks/refs).
  const [elapsedMs, setElapsedMs] = useState(0)

  // Refs (mutable, don't trigger re-render)
  const controllerRef = useRef<AbortController | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startTimeRef = useRef<number>(0)
  const isGeneratingRef = useRef(false)
  // Generation token: incremented on each startProgressSimulation call.
  // The recursive setTimeout chain captures the token at start and stops
  // when it no longer matches, making vi.runAllTimers() safe to call.
  const generationTokenRef = useRef(0)

  // Derived values
  const estimatedTotalMs = estimatedTotalSeconds * 1000

  // Compute progress from wall-clock time during render (not from state)
  let progress: number
  let stageIndex: number
  let estimatedSecondsRemaining: number

  if (completedProgress !== null) {
    // Success/error/cancel path set explicit overrides
    progress = completedProgress
    stageIndex = completedStageIndex ?? 0
    estimatedSecondsRemaining = 0
  } else if (isGenerating && elapsedMs > 0) {
    // Active generation: derive from elapsed time (pure state, no Date.now() in render)
    progress = calculateProgress(elapsedMs, estimatedTotalMs)
    stageIndex = resolveStageIndex(progress, stageThresholds)
    estimatedSecondsRemaining = Math.max(0, Math.round(estimatedTotalSeconds - elapsedMs / 1000))
  } else {
    // Idle
    progress = 0
    stageIndex = 0
    estimatedSecondsRemaining = 0
  }

  const stage = stages[stageIndex] ?? stages[0] ?? ''

  // -------------------------------------------------------------------------
  // Stop progress timer
  // -------------------------------------------------------------------------

  const stopProgressSimulation = useCallback(() => {
    generationTokenRef.current += 1
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  // -------------------------------------------------------------------------
  // Start progress timer (imperatively, outside React effects)
  // -------------------------------------------------------------------------

  const startProgressSimulation = useCallback(() => {
    stopProgressSimulation()
    startTimeRef.current = Date.now()
    // Seed elapsedMs to 1ms so the first render after generation starts shows
    // estimatedSecondsRemaining = estimatedTotalSeconds rather than 0.
    setElapsedMs(1)
    const token = generationTokenRef.current
    // Cap ticks at 2× the estimated duration. Progress is pegged at 95% well
    // before this point, so further ticks produce no visible change. The cap
    // also makes vi.runAllTimers() safe in tests — the chain is always finite.
    const maxTicks = Math.ceil((estimatedTotalMs * 2) / PROGRESS_INTERVAL_MS)
    let ticks = 0
    const scheduleNext = () => {
      timerRef.current = setTimeout(() => {
        if (generationTokenRef.current !== token) return
        ticks += 1
        setElapsedMs(Date.now() - startTimeRef.current)
        if (ticks < maxTicks) {
          scheduleNext()
        }
      }, PROGRESS_INTERVAL_MS)
    }
    scheduleNext()
  }, [stopProgressSimulation, estimatedTotalMs])

  // -------------------------------------------------------------------------
  // Reset
  // -------------------------------------------------------------------------

  const resetState = useCallback(() => {
    setIsGenerating(false)
    isGeneratingRef.current = false
    setCompletedProgress(null)
    setCompletedStageIndex(null)
    setError(null)
    setQuotaExhausted(null)
    setElapsedMs(0)
    stopProgressSimulation()
    startTimeRef.current = 0
  }, [stopProgressSimulation])

  // -------------------------------------------------------------------------
  // Cancel
  // -------------------------------------------------------------------------

  const cancel = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.abort()
      controllerRef.current = null
    }
    resetState()
  }, [resetState])

  // -------------------------------------------------------------------------
  // Execute
  // -------------------------------------------------------------------------

  const execute = useCallback(async (generatorFn: (signal: AbortSignal) => Promise<unknown>): Promise<void> => {
    // Double-click prevention
    if (isGeneratingRef.current) {
      return
    }

    // Reset any previous state
    setError(null)
    setQuotaExhausted(null)
    setCompletedProgress(null)
    setCompletedStageIndex(null)

    // Create new AbortController
    const controller = new AbortController()
    controllerRef.current = controller

    // Enter generating state
    setIsGenerating(true)
    isGeneratingRef.current = true

    // Start progress simulation (imperative, not via useEffect)
    startProgressSimulation()

    try {
      await generatorFn(controller.signal)

      // On success: stop timer, set completion overrides
      stopProgressSimulation()
      setCompletedProgress(100)
      setCompletedStageIndex(stages.length - 1)
      setIsGenerating(false)
      isGeneratingRef.current = false
    } catch (err: unknown) {
      stopProgressSimulation()

      const isAbortError =
        err instanceof Error && (err.name === 'AbortError' || err.message === 'AbortError')

      if (isAbortError) {
        // Silent reset on cancel -- no error state, no toast
        resetState()
        return
      }

      // Check for 402 quota exceeded
      const errWithStatus = err as { status?: number; responseBody?: { error?: QuotaExhaustedInfo } }
      if (errWithStatus.status === 402 && errWithStatus.responseBody?.error) {
        setQuotaExhausted(errWithStatus.responseBody.error)
        setError(null)
        setIsGenerating(false)
        isGeneratingRef.current = false
        logger.warn('AI quota exceeded', errWithStatus.responseBody.error)
        return
      }

      // General error
      const message = err instanceof Error ? err.message : 'An unexpected error occurred'
      setError(message)
      setIsGenerating(false)
      isGeneratingRef.current = false
      logger.error('AI generation failed', { error: message })
    }
  }, [stages.length, stopProgressSimulation, resetState, startProgressSimulation])

  // -------------------------------------------------------------------------
  // Retry
  // -------------------------------------------------------------------------

  const retry = useCallback(() => {
    setError(null)
    setQuotaExhausted(null)
    setCompletedProgress(null)
    setCompletedStageIndex(null)
  }, [])

  // -------------------------------------------------------------------------
  // Cleanup on unmount
  // -------------------------------------------------------------------------

  useEffect(() => {
    return () => {
      isGeneratingRef.current = false
      if (controllerRef.current) {
        controllerRef.current.abort()
        controllerRef.current = null
      }
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [])

  // -------------------------------------------------------------------------
  // Return
  // -------------------------------------------------------------------------

  return {
    execute,
    cancel,
    retry,
    isGenerating,
    progress,
    stage: !isGenerating && completedProgress === 100 ? 'Complete!' : (isGenerating ? stage : stages[0] ?? ''),
    estimatedSecondsRemaining,
    processingSteps: steps,
    stageSequence: stages,
    error,
    quotaExhausted,
  }
}
