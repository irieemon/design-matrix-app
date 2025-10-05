/**
 * API Logger Utility for Vercel Serverless Functions
 *
 * Provides request-scoped logging for serverless environments with:
 * - Request correlation IDs
 * - Performance tracking
 * - Environment-aware filtering
 * - Cold start detection
 * - Structured metadata
 */

import { VercelRequest } from '@vercel/node'
import { logger as baseLogger } from '../../src/lib/logging'

// Track cold starts for performance monitoring
let isColdStart = true

/**
 * Generate or extract request ID for correlation
 */
function getRequestId(req: VercelRequest): string {
  // Check for existing request ID from proxy/load balancer
  const existingId =
    req.headers['x-request-id'] ||
    req.headers['x-correlation-id'] ||
    req.headers['x-amzn-trace-id']

  if (existingId) {
    return typeof existingId === 'string' ? existingId : existingId[0]
  }

  // Generate new request ID
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
 * Create request-scoped logger for API endpoints
 *
 * @param req - Vercel request object
 * @param endpoint - API endpoint name (e.g., 'auth/user', 'ai/generate-ideas')
 * @returns Logger instance with request context
 *
 * @example
 * ```typescript
 * export default async function handler(req: VercelRequest, res: VercelResponse) {
 *   const logger = createRequestLogger(req, 'auth/user')
 *
 *   logger.info('Processing user request', { userId: user.id })
 *   // Logs: { endpoint: 'auth/user', requestId: 'req_...', method: 'GET', ... }
 * }
 * ```
 */
export function createRequestLogger(req: VercelRequest, endpoint: string) {
  const requestId = getRequestId(req)
  const clientInfo = getClientInfo(req)
  const coldStart = isColdStart

  // Mark cold start as complete after first request
  if (isColdStart) {
    isColdStart = false
  }

  return baseLogger.withContext({
    // Request identification
    requestId,
    endpoint,

    // Request details
    method: req.method || 'UNKNOWN',
    path: req.url || 'unknown',

    // Client information (anonymized IP)
    clientIp: typeof clientInfo.ip === 'string'
      ? clientInfo.ip.split(',')[0].trim().substring(0, 15)
      : 'unknown',

    // Performance context
    coldStart,

    // Environment
    environment: (process.env.NODE_ENV as 'development' | 'production' | 'test') || 'development',
    region: process.env.VERCEL_REGION || 'unknown',

    // Timestamp
    timestamp: new Date().toISOString()
  })
}

/**
 * Create performance-tracking logger that includes timing data
 *
 * @param req - Vercel request object
 * @param endpoint - API endpoint name
 * @param startTime - Performance.now() timestamp when request started
 * @returns Logger instance with performance context
 *
 * @example
 * ```typescript
 * export default async function handler(req: VercelRequest, res: VercelResponse) {
 *   const startTime = performance.now()
 *   const logger = createPerformanceLogger(req, 'ai/generate-ideas', startTime)
 *
 *   // ... do work ...
 *
 *   logger.info('Request completed', {
 *     duration: performance.now() - startTime
 *   })
 * }
 * ```
 */
export function createPerformanceLogger(
  req: VercelRequest,
  endpoint: string,
  startTime: number
) {
  const logger = createRequestLogger(req, endpoint)

  // Add performance tracking methods
  return {
    ...logger,

    /**
     * Log with automatic duration calculation
     */
    logWithDuration(level: 'debug' | 'info' | 'warn' | 'error', message: string, metadata?: Record<string, any>) {
      const duration = performance.now() - startTime

      const performanceMetadata = {
        ...metadata,
        duration: `${duration.toFixed(2)}ms`,
        durationMs: Math.round(duration)
      }

      logger[level](message, performanceMetadata)
    },

    /**
     * Log request completion with automatic duration
     */
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

    /**
     * Log request failure with automatic duration
     */
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
 * Log cold start event (call at module initialization)
 *
 * @example
 * ```typescript
 * // At top of API file
 * import { logColdStart } from '../utils/logger'
 *
 * logColdStart('auth/user')
 *
 * export default async function handler(req, res) { ... }
 * ```
 */
export function logColdStart(endpoint: string) {
  if (isColdStart) {
    baseLogger.withContext({ endpoint }).debug('Cold start detected', {
      environment: process.env.NODE_ENV,
      region: process.env.VERCEL_REGION,
      timestamp: new Date().toISOString()
    })
  }
}

/**
 * Reset cold start flag (useful for testing)
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
