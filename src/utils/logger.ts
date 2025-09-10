type LogLevel = 'debug' | 'info' | 'warn' | 'error'

class Logger {
  private isProduction = import.meta.env.PROD
  private enabledLevels: Set<LogLevel>

  constructor() {
    // In production, only show warnings and errors
    // In development, show all logs
    this.enabledLevels = this.isProduction 
      ? new Set(['warn', 'error'])
      : new Set(['debug', 'info', 'warn', 'error'])
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