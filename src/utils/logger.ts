type LogLevel = 'debug' | 'info' | 'warn' | 'error'

class Logger {
  private enabledLevels: Set<LogLevel>

  constructor() {
    // Temporarily enable debug logs in production to diagnose flashing
    // TODO: Revert to production-only warn/error after fixing
    this.enabledLevels = new Set(['debug', 'info', 'warn', 'error'])
  }

  private shouldLog(level: LogLevel): boolean {
    return this.enabledLevels.has(level)
  }

  debug(message: string, ...args: any[]): void {
    if (this.shouldLog('debug')) {
      console.log(`[DEBUG] ${message}`, ...args)
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.shouldLog('info')) {
      console.log(`[INFO] ${message}`, ...args)
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.shouldLog('warn')) {
      console.warn(`[WARN] ${message}`, ...args)
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.shouldLog('error')) {
      console.error(`[ERROR] ${message}`, ...args)
    }
  }
}

export const logger = new Logger()