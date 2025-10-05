/**
 * Simplified API Logger for Vercel Serverless Functions
 *
 * Lightweight console-based logging without frontend dependencies
 * Designed for serverless environment with request correlation
 */

import { VercelRequest } from '@vercel/node'

// Track cold starts
let isColdStart = true

interface LogContext {
  requestId?: string
  endpoint?: string
  method?: string
  path?: string
  clientIp?: string
  coldStart?: boolean
  environment?: string
  region?: string
  timestamp?: string
  [key: string]: any
}

/**
 * Generate request ID for correlation
 */
function getRequestId(req: VercelRequest): string {
  const existingId =
    req.headers['x-request-id'] ||
    req.headers['x-correlation-id'] ||
    req.headers['x-amzn-trace-id']

  if (existingId) {
    return typeof existingId === 'string' ? existingId : existingId[0]
  }

  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Extract client info from request
 */
function getClientInfo(req: VercelRequest) {
  return {
    ip: req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown',
    userAgent: req.headers['user-agent']?.substring(0, 100) || 'unknown',
    origin: req.headers['origin'] || req.headers['referer'] || 'unknown'
  }
}

/**
 * Simple logger with context
 */
class SimpleLogger {
  constructor(private context: LogContext = {}) {}

  private formatMessage(level: string, message: string, meta?: any): string {
    const logEntry = {
      level,
      message,
      ...this.context,
      ...meta,
      timestamp: new Date().toISOString()
    }
    return JSON.stringify(logEntry)
  }

  debug(message: string, meta?: any) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(this.formatMessage('DEBUG', message, meta))
    }
  }

  info(message: string, meta?: any) {
    console.log(this.formatMessage('INFO', message, meta))
  }

  warn(message: string, meta?: any) {
    console.warn(this.formatMessage('WARN', message, meta))
  }

  error(message: string, error?: any, meta?: any) {
    const errorMeta = {
      ...meta,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : error
    }
    console.error(this.formatMessage('ERROR', message, errorMeta))
  }

  withContext(additionalContext: LogContext): SimpleLogger {
    return new SimpleLogger({ ...this.context, ...additionalContext })
  }
}

/**
 * Create request-scoped logger
 */
export function createRequestLogger(req: VercelRequest, endpoint: string): SimpleLogger {
  const requestId = getRequestId(req)
  const clientInfo = getClientInfo(req)
  const coldStart = isColdStart

  if (isColdStart) {
    isColdStart = false
  }

  return new SimpleLogger({
    requestId,
    endpoint,
    method: req.method || 'UNKNOWN',
    path: req.url || 'unknown',
    clientIp: typeof clientInfo.ip === 'string'
      ? clientInfo.ip.split(',')[0].trim().substring(0, 15)
      : 'unknown',
    coldStart,
    environment: process.env.NODE_ENV || 'development',
    region: process.env.VERCEL_REGION || 'unknown'
  })
}

/**
 * Create performance-tracking logger
 */
export function createPerformanceLogger(
  req: VercelRequest,
  endpoint: string,
  startTime: number
) {
  const logger = createRequestLogger(req, endpoint)

  return {
    ...logger,

    debug: logger.debug.bind(logger),
    info: logger.info.bind(logger),
    warn: logger.warn.bind(logger),
    error: logger.error.bind(logger),

    logWithDuration(level: 'debug' | 'info' | 'warn' | 'error', message: string, metadata?: Record<string, any>) {
      const duration = performance.now() - startTime
      const performanceMetadata = {
        ...metadata,
        duration: `${duration.toFixed(2)}ms`,
        durationMs: Math.round(duration)
      }
      logger[level](message, performanceMetadata)
    },

    complete(statusCode: number, metadata?: Record<string, any>) {
      const duration = performance.now() - startTime
      logger.info('Request completed', {
        ...metadata,
        statusCode,
        duration: `${duration.toFixed(2)}ms`,
        durationMs: Math.round(duration),
        success: statusCode >= 200 && statusCode < 300
      })
    },

    fail(error: Error | unknown, statusCode: number, metadata?: Record<string, any>) {
      const duration = performance.now() - startTime
      logger.error('Request failed', error, {
        ...metadata,
        statusCode,
        duration: `${duration.toFixed(2)}ms`,
        durationMs: Math.round(duration)
      })
    }
  }
}

/**
 * Log cold start event
 */
export function logColdStart(endpoint: string) {
  if (isColdStart) {
    const logger = new SimpleLogger({ endpoint })
    logger.debug('Cold start detected', {
      environment: process.env.NODE_ENV,
      region: process.env.VERCEL_REGION
    })
  }
}

/**
 * Reset cold start flag (for testing)
 */
export function resetColdStartFlag() {
  isColdStart = true
}

/**
 * Check if this is a cold start
 */
export function isColdStartActive(): boolean {
  return isColdStart
}
