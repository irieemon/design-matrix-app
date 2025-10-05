/**
 * Performance Optimization Utilities
 *
 * Memoization and optimization helpers for matrix operations
 */

import { useMemo, useCallback, useRef } from 'react'
import { logger } from '../../utils/logger'
import type { IdeaCard } from '../../types'
import type { NormalizedPosition } from './coordinates'

const performanceLogger = logger.withContext({
  component: 'MatrixPerformance'
})

/**
 * Debounce utility for expensive operations
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => func(...args), delay)
  }
}

/**
 * Throttle utility for drag operations
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let isThrottled = false
  return (...args: Parameters<T>) => {
    if (!isThrottled) {
      func(...args)
      isThrottled = true
      setTimeout(() => { isThrottled = false }, delay)
    }
  }
}

/**
 * Optimized idea comparison for memo
 */
export function areIdeasEqual(prev: IdeaCard, next: IdeaCard): boolean {
  // Only compare fields that affect rendering
  return (
    prev.id === next.id &&
    prev.content === next.content &&
    prev.details === next.details &&
    prev.priority === next.priority &&
    prev.is_collapsed === next.is_collapsed &&
    prev.editing_by === next.editing_by &&
    // Compare matrix_position if it exists
    (prev.matrix_position?.x === next.matrix_position?.x) &&
    (prev.matrix_position?.y === next.matrix_position?.y) &&
    // Fallback to pixel coordinates
    prev.x === next.x &&
    prev.y === next.y
  )
}

/**
 * Memoized position calculation hook
 */
export function usePositionMemo(idea: IdeaCard): NormalizedPosition {
  return useMemo(() => {
    if (idea.matrix_position) {
      return {
        x: Math.max(0, Math.min(1, idea.matrix_position.x)),
        y: Math.max(0, Math.min(1, idea.matrix_position.y))
      }
    }

    // Fallback to converting pixel coordinates
    if (idea.x !== undefined && idea.y !== undefined) {
      const containerWidth = 700 - 160  // Account for padding
      const containerHeight = 700 - 120
      return {
        x: Math.max(0, Math.min(1, (idea.x - 80) / containerWidth)),
        y: Math.max(0, Math.min(1, (idea.y - 60) / containerHeight))
      }
    }

    // Default position
    return { x: 0.5, y: 0.5 }
  }, [idea.matrix_position?.x, idea.matrix_position?.y, idea.x, idea.y])
}

/**
 * Batch update optimization
 */
export class BatchUpdater<T> {
  private updates: T[] = []
  private timeoutId: NodeJS.Timeout | null = null
  private readonly batchDelay: number
  private readonly onFlush: (updates: T[]) => void

  constructor(onFlush: (updates: T[]) => void, batchDelay: number = 16) {
    this.onFlush = onFlush
    this.batchDelay = batchDelay
  }

  add(update: T): void {
    this.updates.push(update)

    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
    }

    this.timeoutId = setTimeout(() => {
      this.flush()
    }, this.batchDelay)
  }

  flush(): void {
    if (this.updates.length > 0) {
      this.onFlush([...this.updates])
      this.updates.length = 0
    }
    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
      this.timeoutId = null
    }
  }

  destroy(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
    }
    this.updates.length = 0
  }
}

/**
 * Hook for batched position updates
 */
export function useBatchedUpdates<T>(
  onUpdate: (updates: T[]) => void,
  delay: number = 16
) {
  const batcherRef = useRef<BatchUpdater<T> | null>(null)

  const addUpdate = useCallback((update: T) => {
    if (!batcherRef.current) {
      batcherRef.current = new BatchUpdater(onUpdate, delay)
    }
    batcherRef.current.add(update)
  }, [onUpdate, delay])

  const flush = useCallback(() => {
    batcherRef.current?.flush()
  }, [])

  // Cleanup on unmount
  const cleanup = useCallback(() => {
    batcherRef.current?.destroy()
    batcherRef.current = null
  }, [])

  return { addUpdate, flush, cleanup }
}

/**
 * Optimized card render memoization
 */
export function shouldCardUpdate(
  prevProps: { idea: IdeaCard; isDragging?: boolean },
  nextProps: { idea: IdeaCard; isDragging?: boolean }
): boolean {
  return !areIdeasEqual(prevProps.idea, nextProps.idea) ||
         prevProps.isDragging !== nextProps.isDragging
}

/**
 * Layout Shift Observer for Core Web Vitals monitoring
 */
interface LayoutShiftEntry extends PerformanceEntry {
  value: number
  hadRecentInput: boolean
  lastInputTime: number
  sources: any[]
}

/**
 * Enhanced Performance monitoring utility with layout shift detection
 */
export class PerformanceMonitor {
  private measurements: Map<string, number[]> = new Map()
  private layoutShiftObserver: PerformanceObserver | null = null
  private cumulativeLayoutShift = 0
  private sessionLayoutShifts: number[] = []

  constructor() {
    this.initializeLayoutShiftObserver()
  }

  private initializeLayoutShiftObserver(): void {
    if ('PerformanceObserver' in window && 'layout-shift' in PerformanceObserver.supportedEntryTypes) {
      this.layoutShiftObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as LayoutShiftEntry[]) {
          // Only count layout shifts without recent user input
          if (!entry.hadRecentInput) {
            this.cumulativeLayoutShift += entry.value
            this.sessionLayoutShifts.push(entry.value)

            // Keep only recent shifts (last 50)
            if (this.sessionLayoutShifts.length > 50) {
              this.sessionLayoutShifts.shift()
            }

            // Log significant layout shifts in development
            if (process.env.NODE_ENV === 'development' && entry.value > 0.1) {
              performanceLogger.warn('Significant layout shift detected', {
                operation: 'layoutShiftObserver',
                value: entry.value,
                cumulativeScore: this.cumulativeLayoutShift,
                sources: entry.sources?.map(source => ({
                  node: source.node,
                  currentRect: source.currentRect,
                  previousRect: source.previousRect
                }))
              })
            }
          }
        }
      })

      this.layoutShiftObserver.observe({ entryTypes: ['layout-shift'] })
    }
  }

  startMeasurement(key: string): () => void {
    const start = performance.now()
    const initialCLS = this.cumulativeLayoutShift

    return () => {
      const duration = performance.now() - start
      const layoutShiftDelta = this.cumulativeLayoutShift - initialCLS

      const measurements = this.measurements.get(key) || []
      measurements.push(duration)

      // Keep only last 100 measurements
      if (measurements.length > 100) {
        measurements.shift()
      }

      this.measurements.set(key, measurements)

      // Store layout shift data for this measurement
      if (layoutShiftDelta > 0) {
        const layoutShiftKey = `${key}-layout-shift`
        const layoutShifts = this.measurements.get(layoutShiftKey) || []
        layoutShifts.push(layoutShiftDelta)
        if (layoutShifts.length > 100) {
          layoutShifts.shift()
        }
        this.measurements.set(layoutShiftKey, layoutShifts)
      }
    }
  }

  getAverageTime(key: string): number {
    const measurements = this.measurements.get(key) || []
    if (measurements.length === 0) return 0

    const sum = measurements.reduce((a, b) => a + b, 0)
    return sum / measurements.length
  }

  getLayoutShiftScore(): number {
    return this.cumulativeLayoutShift
  }

  getRecentLayoutShifts(): number[] {
    return [...this.sessionLayoutShifts]
  }

  getLayoutShiftForOperation(key: string): number {
    const layoutShiftKey = `${key}-layout-shift`
    const shifts = this.measurements.get(layoutShiftKey) || []
    return shifts.reduce((sum, shift) => sum + shift, 0)
  }

  getStats(): Record<string, { avg: number; count: number; layoutShift?: number }> {
    const stats: Record<string, { avg: number; count: number; layoutShift?: number }> = {}

    for (const [key, measurements] of this.measurements) {
      if (key.endsWith('-layout-shift')) {
        // Skip layout shift entries in main stats
        continue
      }

      stats[key] = {
        avg: measurements.reduce((a, b) => a + b, 0) / measurements.length,
        count: measurements.length,
        layoutShift: this.getLayoutShiftForOperation(key)
      }
    }

    return stats
  }

  getCoreWebVitalsSummary(): {
    cls: number
    avgLayoutShift: number
    maxLayoutShift: number
    recentShifts: number
    performanceScore: 'good' | 'needs-improvement' | 'poor'
  } {
    const avgShift = this.sessionLayoutShifts.length > 0
      ? this.sessionLayoutShifts.reduce((a, b) => a + b, 0) / this.sessionLayoutShifts.length
      : 0

    const maxShift = this.sessionLayoutShifts.length > 0
      ? Math.max(...this.sessionLayoutShifts)
      : 0

    const recentShifts = this.sessionLayoutShifts.slice(-10).reduce((a, b) => a + b, 0)

    // CLS scoring: good (< 0.1), needs improvement (0.1 - 0.25), poor (> 0.25)
    const performanceScore = this.cumulativeLayoutShift < 0.1
      ? 'good'
      : this.cumulativeLayoutShift < 0.25
        ? 'needs-improvement'
        : 'poor'

    return {
      cls: this.cumulativeLayoutShift,
      avgLayoutShift: avgShift,
      maxLayoutShift: maxShift,
      recentShifts,
      performanceScore
    }
  }

  clear(): void {
    this.measurements.clear()
    this.cumulativeLayoutShift = 0
    this.sessionLayoutShifts.length = 0
  }

  destroy(): void {
    if (this.layoutShiftObserver) {
      this.layoutShiftObserver.disconnect()
      this.layoutShiftObserver = null
    }
    this.clear()
  }
}

export const performanceMonitor = new PerformanceMonitor()