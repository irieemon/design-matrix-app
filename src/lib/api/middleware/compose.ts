/**
 * Middleware Composition Utility
 *
 * Compose multiple middleware functions together
 */

import type { MiddlewareWrapper } from './types'
import { withRateLimit } from './withRateLimit'
import { withCSRF } from './withCSRF'
// ✅ FIX: withAuth middleware moved to backend (api/_lib/middleware/withAuth.ts)
// Frontend middleware should not handle auth - use backend API routes instead
// import { withAuth, withAdmin } from './withAuth'

/**
 * Compose middleware functions
 *
 * Applies middleware in order (left to right)
 *
 * @example
 * export default compose(
 *   withRateLimit(),
 *   withCSRF(),
 *   withAuth,
 *   withAdmin
 * )(async (req, res) => {
 *   // Handler with all middleware applied
 * })
 */
export function compose(...middlewares: MiddlewareWrapper[]): MiddlewareWrapper {
  return (handler) => {
    // Apply middleware in reverse order so they execute left-to-right
    const composedHandler = middlewares.reduceRight(
      (wrapped, middleware) => middleware(wrapped),
      handler
    )
    // Ensure the return type matches MiddlewareWrapper
    return async (req, res) => composedHandler(req as any, res)
  }
}

/**
 * Pre-composed common middleware stacks
 */

/**
 * Public API endpoint (no auth required)
 * Just rate limiting for public endpoints
 */
export const publicEndpoint = compose(
  withRateLimit()
)

/**
 * Authenticated API endpoint
 * Rate limit, CSRF check (auth handled by backend)
 *
 * ✅ FIX: withAuth middleware only exists in backend
 * Frontend should use backend API routes for authenticated operations
 */
export const authenticatedEndpoint = compose(
  withRateLimit(),
  withCSRF()
  // withAuth - backend only
)

/**
 * Admin API endpoint
 * Rate limit, CSRF check (auth/admin checks handled by backend)
 *
 * ✅ FIX: withAuth/withAdmin middleware only exist in backend
 * Frontend should use backend API routes for admin operations
 */
export const adminEndpoint = compose(
  withRateLimit(),
  withCSRF()
  // withAuth, withAdmin - backend only
)
