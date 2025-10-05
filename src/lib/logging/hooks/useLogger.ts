/**
 * React Hook for Component Logging
 * Provides context-aware logger for React components
 */

import { useMemo, useContext } from 'react'
import { loggingService } from '../LoggingService'
import type { Logger, LogContext } from '../types'
import { LoggingContext } from '../contexts/LoggingContext'

/**
 * Hook to get a logger instance with component context
 *
 * @param component - Component name (optional, will auto-detect if possible)
 * @param additionalContext - Additional context to merge
 * @returns Logger instance with context
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const logger = useLogger('MyComponent')
 *
 *   useEffect(() => {
 *     logger.debug('Component mounted')
 *   }, [])
 *
 *   const handleClick = () => {
 *     logger.info('Button clicked', { buttonId: 'submit' })
 *   }
 * }
 * ```
 */
export function useLogger(
  component?: string,
  additionalContext?: LogContext
): Logger {
  // Get context from provider (if available)
  const contextData = useContext(LoggingContext)

  // Merge all context sources
  const context = useMemo(
    () => ({
      ...contextData,
      component: component ?? contextData?.component,
      ...additionalContext
    }),
    [component, contextData, additionalContext]
  )

  // Create logger with merged context
  return useMemo(() => loggingService.createLogger(context), [context])
}

/**
 * Hook to create a scoped logger with additional context
 * Useful for adding context within a component
 *
 * @param baseLogger - Base logger instance
 * @param context - Additional context to add
 * @returns Scoped logger instance
 *
 * @example
 * ```tsx
 * function MyComponent({ userId }) {
 *   const baseLogger = useLogger('MyComponent')
 *   const logger = useScopedLogger(baseLogger, { userId })
 *
 *   // Now all logs include userId context
 *   logger.info('User action')
 * }
 * ```
 */
export function useScopedLogger(baseLogger: Logger, context: LogContext): Logger {
  return useMemo(() => baseLogger.withContext(context), [baseLogger, context])
}
