/**
 * Middleware Composition Utility
 *
 * Compose multiple middleware functions together
 */

import type { MiddlewareWrapper } from './types'
import { withRateLimit } from './withRateLimit'
import { withCSRF } from './withCSRF'
import { withAuth, withAdmin } from './withAuth'

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
    return middlewares.reduceRight(
      (wrapped, middleware) => middleware(wrapped),
      handler
    )
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
 * Rate limit, CSRF check, auth verification
 */
export const authenticatedEndpoint = compose(
  withRateLimit(),
  withCSRF(),
  withAuth
)

/**
 * Admin API endpoint
 * Rate limit, CSRF check, auth verification, admin verification
 */
export const adminEndpoint = compose(
  withRateLimit(),
  withCSRF(),
  withAuth,
  withAdmin
)
