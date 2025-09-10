type LogLevel = 'debug' | 'info' | 'warn' | 'error'

class Logger {
  private enabledLevels: Set<LogLevel>

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