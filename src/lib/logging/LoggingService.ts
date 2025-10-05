/* eslint-disable no-console */
/**
 * Enhanced Logging Service
 * Provides production-ready, structured logging with TypeScript support
 *
 * Features:
 * - Structured logging with contextual metadata
 * - Environment-aware filtering (dev/prod)
 * - Rate limiting and throttling
 * - Performance tracking
 * - Type-safe API
 * - Future-ready for remote logging
 */

import type {
  LogLevel,
  LogEntry,
  LogContext,
  Logger,
  PerformanceMetric,
  LoggingConfig,
  ThrottleState,
  RateLimitConfig,
  LoggingStats,
  Environment
} from './types'

/**
 * Core Logging Service
 */
export class LoggingService {
  private enabledLevels: Set<LogLevel>
  private throttleState = new Map<string, ThrottleState>()
  private rateLimitCounts = new Map<LogLevel, number>()
  private totalLogs: Record<LogLevel, number> = {
    debug: 0,
    info: 0,
    warn: 0,
    error: 0
  }
  private droppedLogs = 0

  // Configuration
  private readonly config: LoggingConfig
  private readonly THROTTLE_INTERVAL = 10000 // 10 seconds
  private readonly MAX_LOGS_PER_INTERVAL = 2
  private readonly RATE_LIMIT_INTERVAL = 1000 // 1 second
  private readonly RATE_LIMITS: RateLimitConfig = {
    debug: 5,
    info: 8,
    warn: 20,
    error: 50
  }

  private lastRateLimitReset = Date.now()
  private environment: Environment

  constructor(config?: Partial<LoggingConfig>) {
    // Detect environment
    this.environment = this.detectEnvironment()

    // Initialize configuration
    this.config = {
      minLevel: config?.minLevel ?? this.getDefaultMinLevel(),
      enableConsole: config?.enableConsole ?? true,
      enableRateLimiting: config?.enableRateLimiting ?? true,
      enableThrottling: config?.enableThrottling ?? true,
      enablePerformance: config?.enablePerformance ?? true,
      globalContext: config?.globalContext,
      formatter: config?.formatter ?? this.defaultFormatter.bind(this),
      transport: config?.transport
    }

    // Set enabled levels based on environment and config
    this.enabledLevels = this.determineEnabledLevels()
    this.resetRateLimitCounters()

    // Log initialization in dev
    if (this.isDebugEnabled()) {
      console.log(
        '%c🚀 Logging Service Initialized',
        'color: #00ff00; font-weight: bold; font-size: 12px;',
        `Environment: ${this.environment}, Levels: ${Array.from(this.enabledLevels).join(', ')}`
      )
    }
  }

  /**
   * Detect current environment
   */
  private detectEnvironment(): Environment {
    // In server-side context (Node.js/serverless), use process.env
    if (typeof window === 'undefined') {
      if (typeof process !== 'undefined' && process.env) {
        if (process.env.NODE_ENV === 'test') return 'test'
        if (process.env.NODE_ENV === 'development') return 'development'
      }
      return 'production'
    }

    // In browser/Vite context, use import.meta.env
    try {
      if (import.meta.env.MODE === 'test') return 'test'
      if (import.meta.env.DEV) return 'development'
    } catch {
      // Fallback if import.meta not available
    }

    return 'production'
  }

  /**
   * Get default minimum log level based on environment
   */
  private getDefaultMinLevel(): LogLevel {
    // CRITICAL FIX: Check server-side FIRST before any browser API access
    if (typeof window === 'undefined') {
      // Server-side (Node.js/Vercel) environment
      if (this.environment === 'test') return 'error'
      if (this.environment === 'development') return 'debug'
      return 'info'
    }

    // Browser environment - safe to access browser APIs
    if (this.environment === 'test') return 'error'
    if (this.environment === 'development') {
      try {
        const urlParams = new URLSearchParams(window.location.search)
        const debugParam = urlParams.get('debug')
        const storedDebug = localStorage.getItem('debugMode')

        if (debugParam === 'true' || storedDebug === 'true') {
          return 'debug'
        }
        return 'info'
      } catch (err) {
        // Fallback if browser APIs fail
        return 'info'
      }
    }
    return 'warn'
  }

  /**
   * Determine which log levels are enabled
   */
  private determineEnabledLevels(): Set<LogLevel> {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error']
    const minLevelIndex = levels.indexOf(this.config.minLevel)
    return new Set(levels.slice(minLevelIndex))
  }

  /**
   * Check if debug logging is enabled
   */
  public isDebugEnabled(): boolean {
    return this.enabledLevels.has('debug')
  }

  /**
   * Set debug mode
   */
  public setDebugMode(enabled: boolean): void {
    if (enabled) {
      this.enabledLevels = new Set(['debug', 'info', 'warn', 'error'])
      // Only use localStorage in browser environment
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        localStorage.setItem('debugMode', 'true')
      }
      console.log('%c🐛 DEBUG MODE ENABLED', 'color: #00ff00; font-weight: bold;')
    } else {
      this.enabledLevels = new Set(['warn', 'error'])
      // Only use localStorage in browser environment
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        localStorage.setItem('debugMode', 'false')
      }
      console.log('%c🔇 DEBUG MODE DISABLED', 'color: #ff6600; font-weight: bold;')
    }
  }

  /**
   * Core logging method
   */
  public log(
    level: LogLevel,
    message: string,
    context?: LogContext,
    data?: Record<string, unknown>,
    error?: Error | unknown
  ): void {
    // Check if level is enabled
    if (!this.enabledLevels.has(level)) {
      return
    }

    // Check rate limiting
    if (this.config.enableRateLimiting && !this.checkRateLimit(level)) {
      this.droppedLogs++
      return
    }

    // Check throttling
    if (this.config.enableThrottling && this.isThrottled(message)) {
      this.droppedLogs++
      return
    }

    // Create log entry
    const entry: LogEntry = {
      level,
      message,
      timestamp: Date.now(),
      context: { ...this.config.globalContext, ...context },
      data,
      error: error instanceof Error ? error : undefined,
      stack: error instanceof Error ? error.stack : undefined
    }

    // Increment counter
    this.totalLogs[level]++

    // Output to console
    if (this.config.enableConsole) {
      this.outputToConsole(entry)
    }

    // Send to remote transport if configured
    if (this.config.transport) {
      try {
        this.config.transport(entry)
      } catch (err) {
        console.error('Transport error:', err)
      }
    }
  }

  /**
   * Output log entry to console
   */
  private outputToConsole(entry: LogEntry): void {
    const formatted = this.config.formatter?.(entry) ?? this.defaultFormatter(entry)

    switch (entry.level) {
      case 'debug':
        console.log(formatted, entry.data ?? '')
        break
      case 'info':
        console.log(formatted, entry.data ?? '')
        break
      case 'warn':
        console.warn(formatted, entry.data ?? '')
        break
      case 'error':
        console.error(formatted, entry.data ?? '', entry.error ?? '')
        if (entry.stack && this.isDebugEnabled()) {
          console.error(entry.stack)
        }
        break
    }
  }

  /**
   * Default log formatter
   */
  private defaultFormatter(entry: LogEntry): string {
    const timestamp = new Date(entry.timestamp).toISOString()
    const level = entry.level.toUpperCase().padEnd(5)
    const component = entry.context?.component ? `[${entry.context.component}]` : ''

    if (this.environment === 'development') {
      // Colorful development output
      return `%c${level}%c ${component} ${entry.message}`
    } else {
      // Plain production output
      return `[${timestamp}] ${level} ${component} ${entry.message}`
    }
  }

  /**
   * Check rate limiting
   */
  private checkRateLimit(level: LogLevel): boolean {
    const now = Date.now()

    // Reset counters if interval has passed
    if (now - this.lastRateLimitReset > this.RATE_LIMIT_INTERVAL) {
      this.resetRateLimitCounters()
      this.lastRateLimitReset = now
    }

    const currentCount = this.rateLimitCounts.get(level) || 0
    const limit = this.RATE_LIMITS[level]

    if (currentCount >= limit) {
      return false
    }

    this.rateLimitCounts.set(level, currentCount + 1)
    return true
  }

  /**
   * Reset rate limit counters
   */
  private resetRateLimitCounters(): void {
    this.rateLimitCounts.clear()
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error']
    levels.forEach(level => {
      this.rateLimitCounts.set(level, 0)
    })
  }

  /**
   * Check if message should be throttled
   */
  private isThrottled(message: string): boolean {
    const key = this.getMessageKey(message)
    const now = Date.now()
    const state = this.throttleState.get(key)

    if (!state) {
      this.throttleState.set(key, {
        lastLogged: now,
        count: 1,
        skipCount: 0
      })
      return false
    }

    // If enough time has passed, reset and allow
    if (now - state.lastLogged > this.THROTTLE_INTERVAL) {
      if (state.skipCount > 0 && this.isDebugEnabled()) {
        console.log(
          `[THROTTLED] Skipped ${state.skipCount} similar messages: "${message.substring(0, 50)}..."`
        )
      }

      this.throttleState.set(key, {
        lastLogged: now,
        count: 1,
        skipCount: 0
      })
      return false
    }

    // Check if we've exceeded the limit for this interval
    if (state.count >= this.MAX_LOGS_PER_INTERVAL) {
      state.skipCount++
      return true
    }

    state.count++
    state.lastLogged = now
    return false
  }

  /**
   * Generate message key for throttling
   */
  private getMessageKey(message: string): string {
    return message.substring(0, 100).replace(/\d+/g, '#')
  }

  /**
   * Create a logger instance with context
   */
  public createLogger(context?: LogContext): Logger {
    return {
      debug: (message: string, data?: Record<string, unknown>) => {
        this.log('debug', message, context, data)
      },

      info: (message: string, data?: Record<string, unknown>) => {
        this.log('info', message, context, data)
      },

      warn: (message: string, data?: Record<string, unknown>) => {
        this.log('warn', message, context, data)
      },

      error: (
        message: string,
        error?: Error | unknown,
        data?: Record<string, unknown>
      ) => {
        this.log('error', message, context, data, error)
      },

      performance: (metric: PerformanceMetric) => {
        if (this.config.enablePerformance) {
          this.log('debug', `Performance: ${metric.operation}`, context, {
            duration: metric.duration,
            success: metric.success,
            ...metric.metadata
          })
        }
      },

      withContext: (additionalContext: LogContext) => {
        return this.createLogger({ ...context, ...additionalContext })
      }
    }
  }

  /**
   * Get logging statistics
   */
  public getStats(): LoggingStats {
    return {
      throttleStateSize: this.throttleState.size,
      rateLimitCounts: Object.fromEntries(this.rateLimitCounts.entries()) as Record<
        LogLevel,
        number
      >,
      totalLogs: { ...this.totalLogs },
      droppedLogs: this.droppedLogs
    }
  }

  /**
   * Clear throttle state (useful for testing)
   */
  public clearThrottleState(): void {
    this.throttleState.clear()
    this.resetRateLimitCounters()
  }

  /**
   * Reset statistics
   */
  public resetStats(): void {
    this.totalLogs = { debug: 0, info: 0, warn: 0, error: 0 }
    this.droppedLogs = 0
    this.clearThrottleState()
  }
}

// ============================================
// Lazy Singleton Pattern (SSR-Safe)
// ============================================

let _loggingServiceInstance: LoggingService | null = null

/**
 * Get the singleton LoggingService instance (lazy initialization)
 * This pattern avoids SSR issues by deferring instantiation until first use
 */
export function getLoggingService(): LoggingService {
  if (!_loggingServiceInstance) {
    _loggingServiceInstance = new LoggingService()
  }
  return _loggingServiceInstance
}

/**
 * Get the default logger instance (lazy initialization)
 * This pattern avoids SSR issues by deferring instantiation until first use
 */
export function getLogger(context?: LogContext): Logger {
  return getLoggingService().createLogger(context)
}

// Legacy exports for backward compatibility (lazy via Proxy)
export const loggingService = new Proxy({} as LoggingService, {
  get(_target, prop) {
    return getLoggingService()[prop as keyof LoggingService]
  }
})

export const logger = new Proxy({} as Logger, {
  get(_target, prop) {
    return getLogger()[prop as keyof Logger]
  }
})
