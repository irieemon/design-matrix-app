/* eslint-disable no-console */
// Legacy logger - deprecated in favor of LoggingService
type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface ThrottleState {
  lastLogged: number
  count: number
  skipCount: number
}

class Logger {
  private enabledLevels: Set<LogLevel>
  private throttleState = new Map<string, ThrottleState>()
  private readonly THROTTLE_INTERVAL = 10000 // 10 seconds (increased from 5)
  private readonly MAX_LOGS_PER_INTERVAL = 2     // Reduced from 3 to 2
  private readonly RATE_LIMIT_INTERVAL = 1000 // 1 second
  private lastRateLimitReset = Date.now()
  private rateLimitCounts = new Map<LogLevel, number>()
  private readonly RATE_LIMITS = {
    debug: 5,      // Reduced from 10 to 5
    info: 8,       // Reduced from 15 to 8
    warn: 20,      // Keep same
    error: 50      // Keep same
  }

  constructor() {
    // Check for debug mode via URL parameter
    const isDebugMode = this.checkDebugMode()

    if (isDebugMode) {
      // Debug mode: show all logs
      this.enabledLevels = new Set(['debug', 'info', 'warn', 'error'])
      console.log('%c🐛 DEBUG MODE ENABLED', 'color: #00ff00; font-weight: bold; font-size: 14px;')
      console.log('Debug logs are enabled. Add ?debug=false to URL to disable.')
    } else {
      // Production mode: only show warnings and errors
      this.enabledLevels = new Set(['warn', 'error'])
    }

    // Initialize rate limit counters
    this.resetRateLimitCounters()
  }

  private checkDebugMode(): boolean {
    // Check URL parameters
    const urlParams = new URLSearchParams(window.location.search)
    const debugParam = urlParams.get('debug')

    // Check localStorage for persistent debug setting
    const storedDebug = localStorage.getItem('debugMode')

    // URL parameter takes precedence over localStorage
    if (debugParam !== null) {
      const isDebug = debugParam.toLowerCase() === 'true'
      // Store the setting in localStorage for persistence
      localStorage.setItem('debugMode', isDebug.toString())
      return isDebug
    }

    // In development mode, default to false unless explicitly enabled
    // This prevents accidental debug spam during development
    if (storedDebug === null && import.meta.env.DEV) {
      localStorage.setItem('debugMode', 'false')
      return false
    }

    // Fall back to localStorage, default to false
    return storedDebug === 'true'
  }

  setDebugMode(enabled: boolean): void {
    if (enabled) {
      this.enabledLevels = new Set(['debug', 'info', 'warn', 'error'])
      localStorage.setItem('debugMode', 'true')
      console.log('%c🐛 DEBUG MODE ENABLED', 'color: #00ff00; font-weight: bold;')
    } else {
      this.enabledLevels = new Set(['warn', 'error'])
      localStorage.setItem('debugMode', 'false')
      console.log('%c🔇 DEBUG MODE DISABLED', 'color: #ff6600; font-weight: bold;')
    }
  }

  isDebugEnabled(): boolean {
    return this.enabledLevels.has('debug')
  }

  private shouldLog(level: LogLevel, message: string): boolean {
    if (!this.enabledLevels.has(level)) {
      return false
    }

    // Check rate limits
    if (!this.checkRateLimit(level)) {
      return false
    }

    // Check throttling for repeated messages
    if (this.isThrottled(message)) {
      return false
    }

    return true
  }

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

  private resetRateLimitCounters(): void {
    this.rateLimitCounts.clear()
    Object.keys(this.RATE_LIMITS).forEach(level => {
      this.rateLimitCounts.set(level as LogLevel, 0)
    })
  }

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
      if (state.skipCount > 0) {
        // Log summary of skipped messages
        console.log(`[THROTTLED] Skipped ${state.skipCount} similar messages: "${message.substring(0, 50)}..."`)
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

  private getMessageKey(message: string): string {
    // Create a key from the first 100 characters to group similar messages
    return message.substring(0, 100).replace(/\d+/g, '#') // Replace numbers with # to group similar messages
  }

  debug(message: string, ...args: any[]): void {
    if (this.shouldLog('debug', message)) {
      console.log(`[DEBUG] ${message}`, ...args)
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.shouldLog('info', message)) {
      console.log(`[INFO] ${message}`, ...args)
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.shouldLog('warn', message)) {
      console.warn(`[WARN] ${message}`, ...args)
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.shouldLog('error', message)) {
      console.error(`[ERROR] ${message}`, ...args)
    }
  }

  // Special method for performance logs with more aggressive throttling
  performance(message: string, ...args: any[]): void {
    const key = `perf_${this.getMessageKey(message)}`
    const now = Date.now()
    const state = this.throttleState.get(key)

    // More aggressive throttling for performance logs (30 seconds)
    const perfThrottleInterval = 30000

    if (!state || now - state.lastLogged > perfThrottleInterval) {
      if (this.shouldLog('debug', message)) {
        console.log(`[PERF] ${message}`, ...args)
        this.throttleState.set(key, {
          lastLogged: now,
          count: 1,
          skipCount: 0
        })
      }
    }
  }

  // Method to clear throttle state (useful for testing)
  clearThrottleState(): void {
    this.throttleState.clear()
    this.resetRateLimitCounters()
  }

  // Get logging statistics
  getStats(): { throttleStateSize: number, rateLimitCounts: Record<string, number> } {
    return {
      throttleStateSize: this.throttleState.size,
      rateLimitCounts: Object.fromEntries(this.rateLimitCounts.entries())
    }
  }

  // Create a context-aware logger that prepends context to all messages
  withContext(context: Record<string, any>): Logger {
    const contextStr = Object.entries(context)
      .map(([k, v]) => `${k}:${v}`)
      .join(' ')

    const contextLogger = {
      debug: (message: string, ...args: any[]) =>
        this.debug(`[${contextStr}] ${message}`, ...args),
      info: (message: string, ...args: any[]) =>
        this.info(`[${contextStr}] ${message}`, ...args),
      warn: (message: string, ...args: any[]) =>
        this.warn(`[${contextStr}] ${message}`, ...args),
      error: (message: string, ...args: any[]) =>
        this.error(`[${contextStr}] ${message}`, ...args),
      performance: (message: string, ...args: any[]) =>
        this.performance(`[${contextStr}] ${message}`, ...args),
      withContext: (newContext: Record<string, any>) =>
        this.withContext({ ...context, ...newContext }),
      setDebugMode: (enabled: boolean) => this.setDebugMode(enabled),
      isDebugEnabled: () => this.isDebugEnabled(),
      clearThrottleState: () => this.clearThrottleState(),
      getStats: () => this.getStats()
    }

    return contextLogger as Logger
  }
}

export const logger = new Logger()