/**
 * withRateLimit Middleware
 *
 * Request rate limiting to prevent DoS and brute force attacks
 * Uses in-memory storage (suitable for serverless with considerations)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { AuthenticatedRequest, MiddlewareHandler, MiddlewareWrapper, RateLimitConfig } from './types'
import { logger } from '../../../utils/logger'

/**
 * Environment detection for rate limiting configuration
 */
const isDevelopment = process.env.NODE_ENV === 'development' ||
                      process.env.VERCEL_ENV === 'development'

const bypassRateLimit = process.env.BYPASS_RATE_LIMIT === 'true' && isDevelopment

if (bypassRateLimit) {
  logger.warn('⚠️  [SECURITY] Rate limiting bypassed in development mode')
  logger.warn('⚠️  [SECURITY] This should NEVER be enabled in production')
}

/**
 * In-memory rate limit store
 * Note: In serverless, this resets between cold starts
 * For production, consider Redis or similar persistent storage
 */
interface RateLimitEntry {
  count: number
  resetTime: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()

/**
 * Default rate limit configuration
 *
 * Development: 10x more lenient to support rapid iteration
 * Production: Strict limits for DoS protection
 */
const DEFAULT_RATE_LIMIT_CONFIG: Required<RateLimitConfig> = {
  windowMs: 15 * 60 * 1000,  // 15 minutes
  maxRequests: isDevelopment ? 1000 : 100,  // 1000 in dev, 100 in prod
  keyGenerator: (req) => {
    // Use IP address as default key
    return req.headers['x-forwarded-for'] as string ||
           req.socket?.remoteAddress ||
           'unknown'
  },
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
}

/**
 * Clean up expired entries
 */
function cleanupExpiredEntries(): void {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key)
    }
  }
}

// Periodic cleanup every minute
setInterval(cleanupExpiredEntries, 60 * 1000)

/**
 * Rate limiting middleware
 *
 * @example
 * // Default: 100 requests per 15 minutes per IP
 * export default withRateLimit()(handler)
 *
 * @example
 * // Custom: 10 requests per minute
 * export default withRateLimit({
 *   windowMs: 60 * 1000,
 *   maxRequests: 10
 * })(handler)
 *
 * @example
 * // Per-user rate limiting
 * export default withAuth(
 *   withRateLimit({
 *     keyGenerator: (req) => req.user?.id || 'anonymous'
 *   })(handler)
 * )
 */
export function withRateLimit(
  config: Partial<RateLimitConfig> = {}
): MiddlewareWrapper {
  const opts = { ...DEFAULT_RATE_LIMIT_CONFIG, ...config }

  return (handler: MiddlewareHandler) => {
    return async (req: VercelRequest, res: VercelResponse) => {
      // Development bypass (only if explicitly enabled)
      if (bypassRateLimit) {
        logger.debug(`[DEV] Rate limiting bypassed for ${req.url}`)
        return handler(req as AuthenticatedRequest, res)
      }

      const key = opts.keyGenerator(req)
      const now = Date.now()

      // Get or create entry
      let entry = rateLimitStore.get(key)

      if (!entry || now > entry.resetTime) {
        // Create new entry (or reset expired one)
        entry = {
          count: 0,
          resetTime: now + opts.windowMs,
        }
        rateLimitStore.set(key, entry)
      }

      // Increment counter
      entry.count++

      // Calculate remaining requests
      const remaining = Math.max(0, opts.maxRequests - entry.count)
      const resetInSeconds = Math.ceil((entry.resetTime - now) / 1000)

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', opts.maxRequests.toString())
      res.setHeader('X-RateLimit-Remaining', remaining.toString())
      res.setHeader('X-RateLimit-Reset', entry.resetTime.toString())

      // Check if rate limit exceeded
      if (entry.count > opts.maxRequests) {
        res.setHeader('Retry-After', resetInSeconds.toString())
        return res.status(429).json({
          error: {
            message: 'Too many requests. Please try again later.',
            code: 'RATE_LIMIT_EXCEEDED',
            details: {
              limit: opts.maxRequests,
              retryAfter: resetInSeconds,
            },
          },
          timestamp: new Date().toISOString(),
        })
      }

      // Execute handler and track success/failure
      try {
        await handler(req as AuthenticatedRequest, res)

        // Optionally don't count successful requests
        if (opts.skipSuccessfulRequests && res.statusCode < 400) {
          entry.count--
        }
      } catch (error) {
        // Optionally don't count failed requests
        if (opts.skipFailedRequests) {
          entry.count--
        }
        throw error
      }
    }
  }
}

/**
 * Strict rate limiting for sensitive endpoints
 *
 * Stricter limits for login, password reset, etc.
 *
 * Development: 100 requests per 15min (allows testing with typos)
 * Production: 5 requests per 15min (brute-force protection)
 *
 * @example
 * export default withStrictRateLimit()(loginHandler)
 */
export function withStrictRateLimit(): MiddlewareWrapper {
  return withRateLimit({
    windowMs: 15 * 60 * 1000,  // 15 minutes
    maxRequests: isDevelopment ? 100 : 5,  // 100 in dev, 5 in prod
    skipSuccessfulRequests: true,  // Only count failed attempts
  })
}

/**
 * Per-user rate limiting
 *
 * Requires withAuth to be applied first
 *
 * @example
 * export default withAuth(
 *   withUserRateLimit()(handler)
 * )
 */
export function withUserRateLimit(
  config: Partial<RateLimitConfig> = {}
): MiddlewareWrapper {
  return withRateLimit({
    ...config,
    keyGenerator: (req) => {
      const authReq = req as AuthenticatedRequest
      return authReq.user?.id ||
             req.headers['x-forwarded-for'] as string ||
             'anonymous'
    },
  })
}
