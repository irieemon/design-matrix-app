/**
 * withCSRF Middleware
 *
 * CSRF protection using double-submit cookie pattern
 * Prevents cross-site request forgery attacks
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { AuthenticatedRequest, MiddlewareHandler, MiddlewareWrapper, CSRFConfig } from './types.js'
import { getCookie, COOKIE_NAMES } from './cookies.js'

/**
 * Default CSRF configuration
 */
const DEFAULT_CSRF_CONFIG: Required<CSRFConfig> = {
  cookieName: COOKIE_NAMES.CSRF_TOKEN,
  headerName: 'x-csrf-token',
  ignoreMethods: ['GET', 'HEAD', 'OPTIONS'],
}

/**
 * CSRF protection middleware (double-submit cookie pattern)
 *
 * Compares CSRF token from cookie (httpOnly=false, readable by JS)
 * with token sent in request header
 *
 * @example
 * export default withCSRF(async (req, res) => {
 *   // CSRF token verified, safe to proceed
 *   // ...
 * })
 */
export function withCSRF(
  config: Partial<CSRFConfig> = {}
): MiddlewareWrapper {
  const opts = { ...DEFAULT_CSRF_CONFIG, ...config }

  return (handler: MiddlewareHandler) => {
    return async (req: VercelRequest, res: VercelResponse) => {
      const method = req.method || 'GET'

      // Skip CSRF check for safe methods
      if (opts.ignoreMethods.includes(method.toUpperCase())) {
        return await handler(req as AuthenticatedRequest, res)
      }

      // Get CSRF token from cookie
      const cookieToken = getCookie(req, opts.cookieName)

      if (!cookieToken) {
        return res.status(403).json({
          error: {
            message: 'CSRF token missing from cookie',
            code: 'CSRF_COOKIE_MISSING',
          },
          timestamp: new Date().toISOString(),
        })
      }

      // Get CSRF token from header
      const headerToken = req.headers[opts.headerName.toLowerCase()] as string | undefined

      if (!headerToken) {
        return res.status(403).json({
          error: {
            message: `CSRF token missing from ${opts.headerName} header`,
            code: 'CSRF_HEADER_MISSING',
          },
          timestamp: new Date().toISOString(),
        })
      }

      // Compare tokens (constant-time comparison to prevent timing attacks)
      if (!constantTimeCompare(cookieToken, headerToken)) {
        return res.status(403).json({
          error: {
            message: 'CSRF token mismatch',
            code: 'CSRF_TOKEN_MISMATCH',
          },
          timestamp: new Date().toISOString(),
        })
      }

      // CSRF verified, attach token to request
      const authReq = req as AuthenticatedRequest
      authReq.csrfToken = cookieToken

      return await handler(authReq, res)
    }
  }
}

/**
 * Constant-time string comparison
 * Prevents timing attacks by always comparing full strings
 */
function constantTimeCompare(a: string, b: string): boolean {
  // If lengths don't match, tokens don't match
  if (a.length !== b.length) {
    return false
  }

  let mismatch = 0
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }

  return mismatch === 0
}

/**
 * Origin/Referer validation middleware
 *
 * Additional CSRF protection layer
 * Validates Origin or Referer header matches expected domain
 *
 * @example
 * export default withOriginValidation(async (req, res) => {
 *   // Origin validated
 *   // ...
 * })
 */
export function withOriginValidation(
  allowedOrigins?: string[]
): MiddlewareWrapper {
  return (handler: MiddlewareHandler) => {
    return async (req: VercelRequest, res: VercelResponse) => {
      const method = req.method || 'GET'

      // Only check for state-changing methods
      if (['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())) {
        return await handler(req as AuthenticatedRequest, res)
      }

      // Get Origin or Referer
      const origin = req.headers.origin || req.headers.referer

      if (!origin) {
        return res.status(403).json({
          error: {
            message: 'Origin or Referer header required',
            code: 'ORIGIN_MISSING',
          },
          timestamp: new Date().toISOString(),
        })
      }

      // Parse origin URL
      let originUrl: URL
      try {
        originUrl = new URL(origin)
      } catch {
        return res.status(403).json({
          error: {
            message: 'Invalid Origin or Referer header',
            code: 'ORIGIN_INVALID',
          },
          timestamp: new Date().toISOString(),
        })
      }

      // Determine allowed origins
      const allowed = allowedOrigins || [
        process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '',
        process.env.NEXT_PUBLIC_SITE_URL || '',
        'http://localhost:5173',  // Vite dev server (alternative port)
        'http://localhost:3003',  // Vite dev server (configured port)
        'http://localhost:3000',  // Alternative dev port
      ].filter(Boolean)

      // Check if origin is allowed
      const isAllowed = allowed.some(allowedOrigin => {
        try {
          const allowedUrl = new URL(allowedOrigin)
          return originUrl.origin === allowedUrl.origin
        } catch {
          return false
        }
      })

      if (!isAllowed) {
        console.warn('Origin validation failed:', {
          received: originUrl.origin,
          allowed,
        })

        return res.status(403).json({
          error: {
            message: 'Origin not allowed',
            code: 'ORIGIN_NOT_ALLOWED',
          },
          timestamp: new Date().toISOString(),
        })
      }

      return await handler(req as AuthenticatedRequest, res)
    }
  }
}
