/**
 * Logging Service Public API
 * Centralized exports for the logging service
 */

// Core service
export { LoggingService, loggingService, logger } from './LoggingService'

// Types
export type {
  LogLevel,
  LogEntry,
  LogContext,
  Logger,
  PerformanceMetric,
  PerformanceLogger,
  LoggingConfig,
  LoggingStats,
  Environment
} from './types'

// React integration
export { useLogger, useScopedLogger } from './hooks/useLogger'
export {
  usePerformanceLogger,
  useOperationTimer
} from './hooks/usePerformanceLogger'
export { LoggingProvider, LoggingContext } from './contexts/LoggingContext'

/**
 * Convenience exports for common usage patterns
 */

// Quick logger instance (no context)
export { logger as log } from './LoggingService'

// Global debug mode toggle
export const setDebugMode = (enabled: boolean) => {
  const { loggingService: service } = require('./LoggingService')
  service.setDebugMode(enabled)
}

// Get logging statistics
export const getLoggingStats = () => {
  const { loggingService: service } = require('./LoggingService')
  return service.getStats()
}

// Clear throttle state (for testing)
export const clearLoggingState = () => {
  const { loggingService: service } = require('./LoggingService')
  service.clearThrottleState()
}
