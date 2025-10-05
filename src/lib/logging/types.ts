/**
 * Logging Service Type Definitions
 * Provides comprehensive TypeScript types for structured logging
 */

/**
 * Log severity levels
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

/**
 * Environment types
 */
export type Environment = 'development' | 'production' | 'test'

/**
 * Contextual metadata attached to log entries
 */
export interface LogContext {
  /** Component or module name */
  component?: string
  /** Current user ID */
  userId?: string
  /** Current project ID */
  projectId?: string
  /** User action being performed */
  action?: string
  /** Environment (dev/prod/test) */
  environment?: Environment
  /** User session ID */
  sessionId?: string
  /** Request ID for tracing */
  requestId?: string
  /** Custom tags for categorization */
  tags?: string[]
  /** Any additional context data */
  [key: string]: unknown
}

/**
 * Structured log entry
 */
export interface LogEntry {
  /** Log severity level */
  level: LogLevel
  /** Log message */
  message: string
  /** Timestamp in milliseconds */
  timestamp: number
  /** Contextual metadata */
  context?: LogContext
  /** Structured data payload */
  data?: Record<string, unknown>
  /** Error object (for error-level logs) */
  error?: Error
  /** Stack trace (optional) */
  stack?: string
}

/**
 * Performance measurement data
 */
export interface PerformanceMetric {
  /** Operation being measured */
  operation: string
  /** Duration in milliseconds */
  duration: number
  /** Whether operation succeeded */
  success: boolean
  /** Additional metadata */
  metadata?: Record<string, unknown>
  /** Timestamp */
  timestamp?: number
}

/**
 * Logger interface for type-safe logging
 */
export interface Logger {
  /**
   * Log debug-level message (development only)
   * @param message - Log message
   * @param data - Optional structured data
   */
  debug(message: string, data?: Record<string, unknown>): void

  /**
   * Log info-level message
   * @param message - Log message
   * @param data - Optional structured data
   */
  info(message: string, data?: Record<string, unknown>): void

  /**
   * Log warning-level message
   * @param message - Log message
   * @param data - Optional structured data
   */
  warn(message: string, data?: Record<string, unknown>): void

  /**
   * Log error-level message
   * @param message - Log message
   * @param error - Optional error object
   * @param data - Optional structured data
   */
  error(message: string, error?: Error | unknown, data?: Record<string, unknown>): void

  /**
   * Log performance metric
   * @param metric - Performance measurement data
   */
  performance(metric: PerformanceMetric): void

  /**
   * Create a scoped logger with additional context
   * @param context - Additional context to merge
   */
  withContext(context: LogContext): Logger
}

/**
 * Performance logger interface
 */
export interface PerformanceLogger {
  /**
   * Start a performance measurement
   * @param operation - Operation name
   * @param metadata - Optional metadata
   * @returns Function to end measurement
   */
  start(operation: string, metadata?: Record<string, unknown>): () => void

  /**
   * Measure an async operation
   * @param operation - Operation name
   * @param fn - Async function to measure
   * @param metadata - Optional metadata
   */
  measure<T>(
    operation: string,
    fn: () => Promise<T>,
    metadata?: Record<string, unknown>
  ): Promise<T>
}

/**
 * Logging service configuration
 */
export interface LoggingConfig {
  /** Minimum log level to display */
  minLevel: LogLevel
  /** Enable/disable console output */
  enableConsole: boolean
  /** Enable/disable rate limiting */
  enableRateLimiting: boolean
  /** Enable/disable throttling */
  enableThrottling: boolean
  /** Enable/disable performance logging */
  enablePerformance: boolean
  /** Global context to add to all logs */
  globalContext?: LogContext
  /** Custom log formatter function */
  formatter?: (entry: LogEntry) => string
  /** Remote transport function (for future use) */
  transport?: (entry: LogEntry) => void | Promise<void>
}

/**
 * Internal throttle state
 */
export interface ThrottleState {
  lastLogged: number
  count: number
  skipCount: number
}

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  debug: number
  info: number
  warn: number
  error: number
}

/**
 * Logging statistics
 */
export interface LoggingStats {
  /** Size of throttle state map */
  throttleStateSize: number
  /** Rate limit counts by level */
  rateLimitCounts: Record<LogLevel, number>
  /** Total logs by level */
  totalLogs: Record<LogLevel, number>
  /** Logs dropped by throttling */
  droppedLogs: number
}
