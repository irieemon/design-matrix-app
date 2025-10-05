/**
 * React Hook for Performance Logging
 * Provides utilities for tracking operation performance
 */

import { useCallback, useContext, useMemo } from 'react'
import { loggingService } from '../LoggingService'
import type { PerformanceLogger, PerformanceMetric, LogContext } from '../types'
import { LoggingContext } from '../contexts/LoggingContext'

/**
 * Hook to get a performance logger instance
 *
 * @param component - Component or module name
 * @param additionalContext - Additional context to merge
 * @returns Performance logger instance
 *
 * @example
 * ```tsx
 * function DataFetcher() {
 *   const perfLogger = usePerformanceLogger('DataFetcher')
 *
 *   const fetchData = async () => {
 *     const end = perfLogger.start('fetch_data')
 *     try {
 *       const data = await api.fetchData()
 *       end() // Records success
 *       return data
 *     } catch (error) {
 *       end() // Records failure
 *       throw error
 *     }
 *   }
 *
 *   // Or use measure for cleaner syntax
 *   const fetchDataAlt = () => {
 *     return perfLogger.measure('fetch_data', () => api.fetchData())
 *   }
 * }
 * ```
 */
export function usePerformanceLogger(
  component?: string,
  additionalContext?: LogContext
): PerformanceLogger {
  // Get context from provider
  const contextData = useContext(LoggingContext)

  // Merge context
  const context = useMemo(
    () => ({
      ...contextData,
      component: component ?? contextData?.component,
      ...additionalContext
    }),
    [component, contextData, additionalContext]
  )

  // Create logger instance
  const logger = useMemo(() => loggingService.createLogger(context), [context])

  /**
   * Start a performance measurement
   */
  const start = useCallback(
    (operation: string, metadata?: Record<string, unknown>) => {
      const startTime = performance.now()
      let ended = false

      // Return end function
      return (finalMetadata?: Record<string, unknown>) => {
        if (ended) {
          logger.warn('Performance measurement already ended', { operation })
          return
        }

        ended = true
        const duration = performance.now() - startTime

        const metric: PerformanceMetric = {
          operation,
          duration,
          success: true, // Assume success if end() is called
          metadata: { ...metadata, ...finalMetadata },
          timestamp: Date.now()
        }

        logger.performance(metric)
      }
    },
    [logger]
  )

  /**
   * Measure an async operation
   */
  const measure = useCallback(
    async <T,>(
      operation: string,
      fn: () => Promise<T>,
      metadata?: Record<string, unknown>
    ): Promise<T> => {
      const startTime = performance.now()

      try {
        const result = await fn()
        const duration = performance.now() - startTime

        const metric: PerformanceMetric = {
          operation,
          duration,
          success: true,
          metadata,
          timestamp: Date.now()
        }

        logger.performance(metric)
        return result
      } catch (error) {
        const duration = performance.now() - startTime

        const metric: PerformanceMetric = {
          operation,
          duration,
          success: false,
          metadata: {
            ...metadata,
            error: error instanceof Error ? error.message : String(error)
          },
          timestamp: Date.now()
        }

        logger.performance(metric)
        throw error
      }
    },
    [logger]
  )

  return {
    start,
    measure
  }
}

/**
 * Hook for simple operation timing
 * Auto-starts on mount, ends on unmount
 *
 * @param operation - Operation name
 * @param metadata - Optional metadata
 * @returns End function to manually end measurement
 *
 * @example
 * ```tsx
 * function Component() {
 *   useOperationTimer('component_lifecycle')
 *   // Automatically tracked from mount to unmount
 *
 *   return <div>Component</div>
 * }
 * ```
 */
export function useOperationTimer(
  operation: string,
  metadata?: Record<string, unknown>
): () => void {
  const perfLogger = usePerformanceLogger()
  const end = useMemo(() => perfLogger.start(operation, metadata), [])

  // Auto-end on unmount
  useMemo(() => {
    return () => end()
  }, [end])

  return end
}
