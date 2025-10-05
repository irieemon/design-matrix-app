/**
 * Middleware Types
 *
 * Type definitions for security middleware functions
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Extended request with authenticated user information
 */
export interface AuthenticatedRequest extends VercelRequest {
  user?: {
    id: string
    email: string
    role: string
    iat?: number
    exp?: number
  }
  csrfToken?: string
  session?: {
    accessToken: string
    refreshToken?: string
  }
}

/**
 * Middleware handler function type
 */
export type MiddlewareHandler = (
  req: AuthenticatedRequest,
  res: VercelResponse
) => Promise<void> | void

/**
 * Middleware wrapper type
 */
export type MiddlewareWrapper = (
  handler: MiddlewareHandler
) => (req: VercelRequest, res: VercelResponse) => Promise<void>

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  windowMs: number  // Time window in milliseconds
  maxRequests: number  // Max requests per window
  keyGenerator?: (req: VercelRequest) => string  // Custom key generator
  skipSuccessfulRequests?: boolean
  skipFailedRequests?: boolean
}

/**
 * CSRF configuration
 */
export interface CSRFConfig {
  cookieName?: string
  headerName?: string
  ignoreMethods?: string[]
}

/**
 * Error response format
 */
export interface ErrorResponse {
  error: {
    message: string
    code?: string
    details?: unknown
  }
  timestamp: string
}
