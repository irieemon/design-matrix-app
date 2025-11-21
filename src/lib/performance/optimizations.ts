/**
 * Performance Optimization Utilities
 * World-class performance enhancements for enterprise matrix interface
 */

import React from 'react'
import { logger } from '../../utils/logger'
import type { IdeaCard } from '../../types'

const optimizationLogger = logger.withContext({
  component: 'PerformanceOptimizations'
})

// Lazy loading utilities
export const createLazyComponent = <T extends React.ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  _fallback?: React.ComponentType // Currently unused
) => {
  return React.lazy(importFn)
}

// Bundle splitting helpers
export const chunkMap = {
  // PDF functionality - only load when needed
  pdf: () => import('../../components/RoadmapExportModal'),

  // Admin functionality - only load for admin users
  admin: () => import('../../components/admin/ProjectManagement'),

  // AI functionality - only load when AI features are used
  ai: () => import('../../components/AIStarterModal'),

  // Collaboration - only load when accessing collaboration features
  collaboration: () => import('../../components/pages/ProjectCollaboration')
}

// Memoization utilities for expensive calculations
export const memoizeMatrixCalculations = <T extends (...args: any[]) => any>(
  fn: T,
  keySelector?: (...args: Parameters<T>) => string
): T => {
  const cache = new Map<string, ReturnType<T>>()

  return ((...args: Parameters<T>): ReturnType<T> => {
    const key = keySelector ? keySelector(...args) : JSON.stringify(args)

    if (cache.has(key)) {
      return cache.get(key)!
    }

    const result = fn(...args)
    cache.set(key, result)

    // Prevent memory leaks - limit cache size
    if (cache.size > 50) {
      const firstKey = cache.keys().next().value
      if (firstKey !== undefined) {
        cache.delete(firstKey)
      }
    }

    return result
  }) as T
}

// GPU acceleration detection and optimization
export const enableHardwareAcceleration = (element: HTMLElement): void => {
  element.style.transform = 'translateZ(0)'
  element.style.backfaceVisibility = 'hidden'
  element.style.perspective = '1000px'
  element.style.willChange = 'transform, opacity'
}

// Virtual scrolling for large idea sets
export class VirtualizedCardRenderer {
  private visibleRange = { start: 0, end: 0 }
  // private viewport: DOMRect | null = null // Currently unused

  calculateVisibleItems(
    ideas: IdeaCard[],
    containerRect: DOMRect,
    cardHeight: number = 180
  ): { start: number; end: number; total: number } {
    if (!containerRect) return { start: 0, end: ideas.length, total: ideas.length }

    const overscan = 5 // Render extra items for smooth scrolling
    const start = Math.max(0, Math.floor(containerRect.top / cardHeight) - overscan)
    const end = Math.min(
      ideas.length,
      Math.ceil((containerRect.top + containerRect.height) / cardHeight) + overscan
    )

    return { start, end, total: ideas.length }
  }

  shouldUpdate(newRange: { start: number; end: number }): boolean {
    return (
      newRange.start !== this.visibleRange.start ||
      newRange.end !== this.visibleRange.end
    )
  }

  updateRange(newRange: { start: number; end: number }): void {
    this.visibleRange = newRange
  }
}

// Performance monitoring utilities
export class MatrixPerformanceMonitor {
  private metrics: Map<string, PerformanceMeasure[]> = new Map()
  // private observers: Map<string, PerformanceObserver> = new Map() // Currently unused

  startMeasurement(name: string): () => void {
    const startTime = performance.now()
    performance.mark(`${name}-start`)

    return () => {
      performance.mark(`${name}-end`)
      performance.measure(name, `${name}-start`, `${name}-end`)

      const endTime = performance.now()
      this.recordMetric(name, endTime - startTime)
    }
  }

  private recordMetric(name: string, duration: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, [])
    }

    const measures = this.metrics.get(name)!
    measures.push({ duration } as PerformanceMeasure)

    // Keep only recent measurements
    if (measures.length > 100) {
      measures.shift()
    }
  }

  getAverageTime(name: string): number {
    const measures = this.metrics.get(name) || []
    if (measures.length === 0) return 0

    const total = measures.reduce((sum, measure) => sum + measure.duration, 0)
    return total / measures.length
  }

  setupFrameRateMonitoring(): () => void {
    let frameCount = 0
    let lastTime = performance.now()
    let animationId: number

    const measureFPS = () => {
      frameCount++
      const currentTime = performance.now()

      if (currentTime - lastTime >= 1000) {
        const fps = Math.round((frameCount * 1000) / (currentTime - lastTime))
        optimizationLogger.debug('Matrix FPS measurement', {
          operation: 'frameRateMonitoring',
          fps,
          frameCount,
          interval: currentTime - lastTime
        })

        frameCount = 0
        lastTime = currentTime
      }

      animationId = requestAnimationFrame(measureFPS)
    }

    measureFPS()

    return () => cancelAnimationFrame(animationId)
  }
}

// Memory management utilities
export const cleanupMatrixResources = (): void => {
  // Clean up any global state or event listeners
  performance.clearMarks()
  performance.clearMeasures()

  // Force garbage collection if available (development only)
  if (process.env.NODE_ENV === 'development' && 'gc' in window) {
    ;(window as any).gc()
  }
}

// Intersection Observer for visibility-based optimizations
export const createVisibilityObserver = (
  callback: (entries: IntersectionObserverEntry[]) => void,
  options: IntersectionObserverInit = {}
): IntersectionObserver => {
  const defaultOptions: IntersectionObserverInit = {
    rootMargin: '50px',
    threshold: [0, 0.1, 0.5, 1.0],
    ...options
  }

  return new IntersectionObserver(callback, defaultOptions)
}

// WebGL acceleration utilities (for future canvas-based rendering)
export const detectWebGLSupport = (): boolean => {
  try {
    const canvas = document.createElement('canvas')
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    )
  } catch (_e) {
    return false
  }
}

// Export performance monitor instance
export const matrixPerfMonitor = new MatrixPerformanceMonitor()