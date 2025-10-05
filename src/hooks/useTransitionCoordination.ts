/**
 * useTransitionCoordination Hook
 *
 * Coordinates CSS transitions with React state updates to prevent
 * visual conflicts and optimize animation performance.
 */

import { useEffect, useRef, useCallback, useState } from 'react'

interface TransitionCoordinationOptions {
  /** Disable transitions during state updates */
  disableTransitionsDuringUpdates?: boolean
  /** Performance monitoring */
  enablePerformanceMonitoring?: boolean
  /** Cleanup will-change properties */
  autoCleanupWillChange?: boolean
  /** Debounce state updates */
  debounceMs?: number
}

interface TransitionState {
  isTransitioning: boolean
  isStateUpdating: boolean
  performance: {
    fps: number
    lastFrameTime: number
    droppedFrames: number
  }
}

export const useTransitionCoordination = (
  options: TransitionCoordinationOptions = {}
) => {
  const {
    disableTransitionsDuringUpdates = true,
    enablePerformanceMonitoring = false,
    autoCleanupWillChange = true,
    debounceMs = 16 // One frame at 60fps
  } = options

  const [transitionState, setTransitionState] = useState<TransitionState>({
    isTransitioning: false,
    isStateUpdating: false,
    performance: {
      fps: 60,
      lastFrameTime: performance.now(),
      droppedFrames: 0
    }
  })

  const stateUpdateTimeoutRef = useRef<NodeJS.Timeout>()
  const performanceMonitorRef = useRef<number>()
  const frameCountRef = useRef(0)
  const lastSecondRef = useRef(performance.now())

  // Performance monitoring
  useEffect(() => {
    if (!enablePerformanceMonitoring) return

    const monitorPerformance = () => {
      const now = performance.now()
      frameCountRef.current++

      // Calculate FPS every second
      if (now - lastSecondRef.current >= 1000) {
        const fps = frameCountRef.current
        const droppedFrames = Math.max(0, 60 - fps)

        setTransitionState(prev => ({
          ...prev,
          performance: {
            fps,
            lastFrameTime: now,
            droppedFrames: prev.performance.droppedFrames + droppedFrames
          }
        }))

        frameCountRef.current = 0
        lastSecondRef.current = now
      }

      performanceMonitorRef.current = requestAnimationFrame(monitorPerformance)
    }

    performanceMonitorRef.current = requestAnimationFrame(monitorPerformance)

    return () => {
      if (performanceMonitorRef.current) {
        cancelAnimationFrame(performanceMonitorRef.current)
      }
    }
  }, [enablePerformanceMonitoring])

  // Apply CSS classes based on state
  useEffect(() => {
    const rootElement = document.documentElement

    if (disableTransitionsDuringUpdates && transitionState.isStateUpdating) {
      rootElement.classList.add('react-state-updating')
      rootElement.classList.remove('react-state-stable')
    } else {
      rootElement.classList.remove('react-state-updating')
      rootElement.classList.add('react-state-stable')
    }

    if (transitionState.isTransitioning) {
      rootElement.classList.add('transitioning')
    } else {
      rootElement.classList.remove('transitioning')

      // Cleanup will-change properties after transitions
      if (autoCleanupWillChange) {
        setTimeout(() => {
          rootElement.classList.add('transition-cleanup')
          setTimeout(() => {
            rootElement.classList.remove('transition-cleanup')
          }, 100)
        }, 200)
      }
    }

    return () => {
      rootElement.classList.remove(
        'react-state-updating',
        'react-state-stable',
        'transitioning',
        'transition-cleanup'
      )
    }
  }, [transitionState.isStateUpdating, transitionState.isTransitioning, disableTransitionsDuringUpdates, autoCleanupWillChange])

  const startStateUpdate = useCallback(() => {
    if (stateUpdateTimeoutRef.current) {
      clearTimeout(stateUpdateTimeoutRef.current)
    }

    setTransitionState(prev => ({ ...prev, isStateUpdating: true }))

    stateUpdateTimeoutRef.current = setTimeout(() => {
      setTransitionState(prev => ({ ...prev, isStateUpdating: false }))
    }, debounceMs)
  }, [debounceMs])

  const startTransition = useCallback(() => {
    setTransitionState(prev => ({ ...prev, isTransitioning: true }))
  }, [])

  const endTransition = useCallback(() => {
    setTransitionState(prev => ({ ...prev, isTransitioning: false }))
  }, [])

  const withStateUpdate = useCallback(<T extends any[]>(
    callback: (...args: T) => void
  ) => {
    return (...args: T) => {
      startStateUpdate()
      callback(...args)
    }
  }, [startStateUpdate])

  const withTransition = useCallback(<T extends any[]>(
    callback: (...args: T) => void,
    transitionDuration: number = 300
  ) => {
    return (...args: T) => {
      startTransition()
      callback(...args)
      // End transition after a delay to allow CSS transitions to complete
      // Use dynamic duration based on actual transition requirements
      setTimeout(endTransition, Math.max(transitionDuration, 200))
    }
  }, [startTransition, endTransition])

  // Performance warning system
  const isPerformanceGood = transitionState.performance.fps >= 55
  const isPerformanceWarning = transitionState.performance.fps >= 45 && transitionState.performance.fps < 55
  const isPerformanceCritical = transitionState.performance.fps < 45

  // Apply performance-based CSS classes
  useEffect(() => {
    const rootElement = document.documentElement

    rootElement.classList.remove('performance-good', 'performance-warning', 'performance-critical')

    if (isPerformanceCritical) {
      rootElement.classList.add('performance-critical')
    } else if (isPerformanceWarning) {
      rootElement.classList.add('performance-warning')
    } else {
      rootElement.classList.add('performance-good')
    }
  }, [isPerformanceGood, isPerformanceWarning, isPerformanceCritical])

  // Cleanup
  useEffect(() => {
    return () => {
      if (stateUpdateTimeoutRef.current) {
        clearTimeout(stateUpdateTimeoutRef.current)
      }
      if (performanceMonitorRef.current) {
        cancelAnimationFrame(performanceMonitorRef.current)
      }
    }
  }, [])

  return {
    transitionState,
    startStateUpdate,
    startTransition,
    endTransition,
    withStateUpdate,
    withTransition,
    isPerformanceGood,
    isPerformanceWarning,
    isPerformanceCritical
  }
}

export default useTransitionCoordination