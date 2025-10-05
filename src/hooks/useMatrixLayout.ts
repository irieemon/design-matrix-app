/**
 * Optimized Matrix Layout Hook
 *
 * High-performance layout recalculation system for matrix workspace
 * with smooth transitions, debouncing, and minimal layout thrashing.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { throttle, debounce } from '../lib/matrix/performance'
import type { MatrixDimensions } from '../lib/matrix/coordinates'

interface OptimizedMatrixConfig {
  /** Sidebar collapsed state */
  sidebarCollapsed: boolean
  /** Custom debounce delay for dimension calculations (default: 16ms) */
  debounceDelay?: number
  /** Custom throttle delay for rapid state changes (default: 8ms) */
  throttleDelay?: number
  /** Enable transition coordination (default: true) */
  enableTransitions?: boolean
  /** Performance monitoring (default: false) */
  enablePerformanceMonitoring?: boolean
}

interface TransitionState {
  isTransitioning: boolean
  fromDimensions: MatrixDimensions | null
  toDimensions: MatrixDimensions | null
  progress: number
  duration: number
}

interface PerformanceMetrics {
  calculationTime: number
  lastUpdate: number
  updateCount: number
  averageUpdateTime: number
}

/**
 * Advanced hook for optimized matrix layout calculations
 */
export function useMatrixLayout(config: OptimizedMatrixConfig) {
  const {
    sidebarCollapsed,
    debounceDelay = 16,
    throttleDelay = 8,
    enableTransitions = true,
    enablePerformanceMonitoring = false
  } = config

  // State management
  const [dimensions, setDimensions] = useState<MatrixDimensions | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)
  const [transitionState, setTransitionState] = useState<TransitionState>({
    isTransitioning: false,
    fromDimensions: null,
    toDimensions: null,
    progress: 0,
    duration: 300
  })

  // Performance monitoring
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics>({
    calculationTime: 0,
    lastUpdate: 0,
    updateCount: 0,
    averageUpdateTime: 0
  })

  // Refs for optimization
  const dimensionsRef = useRef<MatrixDimensions | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const transitionTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const deviceTypeRef = useRef<string>('')

  /**
   * Memoized device type detection with caching
   */
  const getDeviceType = useCallback((viewportWidth: number) => {
    const deviceType = viewportWidth <= 640 ? 'mobile' :
                     viewportWidth <= 768 ? 'tablet' :
                     viewportWidth <= 1024 ? 'laptop' :
                     viewportWidth <= 1440 ? 'desktop' : 'ultrawide'

    deviceTypeRef.current = deviceType
    return deviceType
  }, [])

  /**
   * High-performance dimension calculation with CSS Grid awareness
   */
  const calculateOptimizedDimensions = useCallback((): MatrixDimensions => {
    const startTime = performance.now()

    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    // Device detection with caching
    const deviceType = getDeviceType(viewportWidth)

    // Optimized space utilization based on device
    const deviceConfig = {
      mobile: { utilization: 0.99, padding: 16 },
      tablet: { utilization: 0.97, padding: 24 },
      laptop: { utilization: 0.96, padding: 32 },
      desktop: { utilization: 0.95, padding: 40 },
      ultrawide: { utilization: 0.93, padding: 48 }
    }

    const { utilization } = deviceConfig[deviceType as keyof typeof deviceConfig]

    // CRITICAL FIX: Let CSS Grid handle the width calculation completely
    // Instead of manually calculating based on sidebar state, read from the actual DOM container
    let availableWidth = viewportWidth
    let availableHeight = viewportHeight - (deviceType === 'mobile' ? 60 : 80)

    // Always prioritize reading from the CSS Grid container if it exists
    const mainGridArea = document.querySelector('.app-layout-grid__main')
    if (mainGridArea) {
      const rect = mainGridArea.getBoundingClientRect()
      // Use the actual grid area dimensions - this respects CSS Grid calculations
      availableWidth = rect.width
      availableHeight = rect.height

      // For enterprise mode, check for the matrix workspace container
      const matrixWorkspace = mainGridArea.querySelector('.enterprise-matrix-workspace, .matrix-workspace-layout')
      if (matrixWorkspace) {
        const workspaceRect = matrixWorkspace.getBoundingClientRect()
        availableWidth = workspaceRect.width
        availableHeight = workspaceRect.height
      }
    }
    // REMOVED: Manual sidebar width calculation that conflicts with CSS Grid
    // The CSS Grid system should handle width allocation automatically

    // Responsive boundaries
    const boundaries = {
      minWidth: deviceType === 'mobile' ? 350 : deviceType === 'tablet' ? 600 : 700,
      minHeight: deviceType === 'mobile' ? 350 : deviceType === 'tablet' ? 500 : 600,
      maxWidth: Math.min(availableWidth * utilization, deviceType === 'ultrawide' ? 1800 : 1400),
      maxHeight: Math.min(availableHeight * utilization, deviceType === 'ultrawide' ? 1400 : 1200)
    }

    // Use full available width from CSS Grid - this is the key fix
    const finalWidth = Math.max(boundaries.minWidth, availableWidth * 0.98) // Use 98% to allow for minimal padding
    const finalHeight = Math.max(boundaries.minHeight, Math.min(boundaries.maxHeight, availableHeight * 0.95))

    // Ultra-minimal padding for maximum workspace
    const paddingRatio = deviceType === 'mobile' ? 0.005 : deviceType === 'tablet' ? 0.008 : 0.01
    const horizontalPadding = finalWidth * paddingRatio * 0.3
    const verticalPadding = finalHeight * paddingRatio

    const newDimensions: MatrixDimensions = {
      width: finalWidth,
      height: finalHeight,
      padding: {
        top: verticalPadding,
        right: horizontalPadding,
        bottom: verticalPadding * (deviceType === 'mobile' ? 1.1 : 1.2),
        left: horizontalPadding
      }
    }

    // Performance tracking
    if (enablePerformanceMonitoring) {
      const calculationTime = performance.now() - startTime
      setPerformanceMetrics(prev => ({
        calculationTime,
        lastUpdate: Date.now(),
        updateCount: prev.updateCount + 1,
        averageUpdateTime: (prev.averageUpdateTime * prev.updateCount + calculationTime) / (prev.updateCount + 1)
      }))
    }

    return newDimensions
  }, [sidebarCollapsed, enablePerformanceMonitoring, getDeviceType])

  /**
   * Smooth transition animation with easing
   */
  const animateTransition = useCallback((targetDimensions: MatrixDimensions) => {
    const startTime = performance.now()
    const duration = 300

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)

      // Easing function for smooth transitions - cubic-bezier(0.4, 0.0, 0.2, 1)
      const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)
      const easedProgress = easeOutCubic(progress)

      setTransitionState(prev => ({
        ...prev,
        progress: easedProgress
      }))

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate)
      } else {
        // Transition complete
        setDimensions(targetDimensions)
        dimensionsRef.current = targetDimensions
        setTransitionState({
          isTransitioning: false,
          fromDimensions: null,
          toDimensions: null,
          progress: 1,
          duration: 300
        })
      }
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
    animationFrameRef.current = requestAnimationFrame(animate)
  }, [])

  /**
   * Debounced dimension calculation to prevent excessive recalculations
   */
  const debouncedCalculation = useMemo(
    () => debounce(() => {
      setIsCalculating(true)

      // Use requestAnimationFrame for smooth updates
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }

      animationFrameRef.current = requestAnimationFrame(() => {
        const newDimensions = calculateOptimizedDimensions()

        // Check if dimensions actually changed to avoid unnecessary transitions
        const hasChanged = !dimensionsRef.current ||
          Math.abs(dimensionsRef.current.width - newDimensions.width) > 1 ||
          Math.abs(dimensionsRef.current.height - newDimensions.height) > 1

        if (hasChanged) {
          if (enableTransitions && dimensionsRef.current) {
            // Start transition
            setTransitionState({
              isTransitioning: true,
              fromDimensions: dimensionsRef.current,
              toDimensions: newDimensions,
              progress: 0,
              duration: 300
            })

            // Animate transition
            animateTransition(newDimensions)
          } else {
            // Direct update
            setDimensions(newDimensions)
            dimensionsRef.current = newDimensions
          }
        }

        setIsCalculating(false)
      })
    }, debounceDelay),
    [calculateOptimizedDimensions, debounceDelay, enableTransitions, animateTransition]
  )

  /**
   * Throttled sidebar state change handler for rapid toggles
   */
  const throttledSidebarChange = useMemo(
    () => throttle(() => {
      debouncedCalculation()
    }, throttleDelay),
    [debouncedCalculation, throttleDelay]
  )

  /**
   * ResizeObserver setup for efficient viewport monitoring
   */
  useEffect(() => {
    // Initial calculation
    debouncedCalculation()

    // Setup ResizeObserver for viewport changes
    let cleanup: (() => void) | undefined

    if ('ResizeObserver' in window) {
      resizeObserverRef.current = new ResizeObserver(
        throttle(() => {
          debouncedCalculation()
        }, 16) // 60fps throttling
      )
      resizeObserverRef.current.observe(document.documentElement)

      cleanup = () => {
        if (resizeObserverRef.current) {
          resizeObserverRef.current.disconnect()
        }
      }
    } else {
      // Fallback to window resize for older browsers
      const handleResizeThrottled = throttle(() => {
        debouncedCalculation()
      }, 16)

      if (typeof window !== 'undefined') {
        const w = window as Window
        w.addEventListener('resize', handleResizeThrottled, { passive: true })
        cleanup = () => w.removeEventListener('resize', handleResizeThrottled)
      }
    }

    return cleanup
  }, [debouncedCalculation])

  /**
   * Sidebar state change effect with optimized handling
   */
  useEffect(() => {
    throttledSidebarChange()
  }, [sidebarCollapsed, throttledSidebarChange])

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current)
      }
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect()
      }
    }
  }, [])

  /**
   * Get interpolated dimensions during transition
   */
  const getInterpolatedDimensions = useCallback((): MatrixDimensions | null => {
    if (!transitionState.isTransitioning || !transitionState.fromDimensions || !transitionState.toDimensions) {
      return dimensions
    }

    const { fromDimensions, toDimensions, progress } = transitionState

    // Linear interpolation with easing
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t

    return {
      width: lerp(fromDimensions.width, toDimensions.width, progress),
      height: lerp(fromDimensions.height, toDimensions.height, progress),
      padding: {
        top: lerp(fromDimensions.padding.top, toDimensions.padding.top, progress),
        right: lerp(fromDimensions.padding.right, toDimensions.padding.right, progress),
        bottom: lerp(fromDimensions.padding.bottom, toDimensions.padding.bottom, progress),
        left: lerp(fromDimensions.padding.left, toDimensions.padding.left, progress)
      }
    }
  }, [dimensions, transitionState])

  /**
   * Force immediate recalculation (useful for testing or emergency updates)
   */
  const forceRecalculation = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
    const newDimensions = calculateOptimizedDimensions()
    setDimensions(newDimensions)
    dimensionsRef.current = newDimensions
  }, [calculateOptimizedDimensions])

  return {
    dimensions: getInterpolatedDimensions(),
    isCalculating,
    isTransitioning: transitionState.isTransitioning,
    transitionProgress: transitionState.progress,
    performanceMetrics: enablePerformanceMonitoring ? performanceMetrics : null,
    forceRecalculation
  }
}