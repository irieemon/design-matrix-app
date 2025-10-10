/**
 * withAuth Middleware
 *
 * Verifies authentication via httpOnly cookies
 * Prevents XSS token theft by keeping tokens server-side only
 */

import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { AuthenticatedRequest, MiddlewareHandler, MiddlewareWrapper } from './types.js'
import { getCookie, COOKIE_NAMES } from './cookies.js'

const supabaseUrl = process.env.VITE_SUPABASE_URL!
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!

/**
 * Error responses
 */
function sendUnauthorized(res: VercelResponse, message: string): void {
  res.status(401).json({
    error: {
      message,
      code: 'UNAUTHORIZED',
    },
    timestamp: new Date().toISOString(),
  })
}

function sendForbidden(res: VercelResponse, message: string): void {
  res.status(403).json({
    error: {
      message,
      code: 'FORBIDDEN',
    },
    timestamp: new Date().toISOString(),
  })
}

/**
 * Authentication middleware
 *
 * Verifies JWT token from httpOnly cookie OR Authorization header (for backward compatibility)
 * Supports both new httpOnly cookie auth and legacy localStorage auth
 *
 * @example
 * export default withAuth(async (req, res) => {
 *   // req.user is guaranteed to exist here
 *   const userId = req.user.id
 *   // ...
 * })
 */
export const withAuth: MiddlewareWrapper = (handler: MiddlewareHandler) => {
  return async (req: VercelRequest, res: VercelResponse) => {
    try {
      // Try to extract access token from httpOnly cookie first (new auth)
      let accessToken = getCookie(req, COOKIE_NAMES.ACCESS_TOKEN)

      // Fallback to Authorization header (legacy auth for backward compatibility)
      if (!accessToken) {
        const authHeader = req.headers.authorization || req.headers.Authorization
        if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
          accessToken = authHeader.substring(7)
        }
      }

      if (!accessToken) {
        return sendUnauthorized(res, 'No authentication token provided')
      }

      // Create Supabase client with the token
      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      })

      // Verify token and get user
      const { data: { user }, error } = await supabase.auth.getUser(accessToken)

      if (error || !user) {
        console.error('Auth verification error:', error)
        return sendUnauthorized(res, 'Invalid or expired token')
      }

      // Get user profile with role information
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('id, email, role')
        .eq('id', user.id)
        .single()

      if (profileError) {
        console.error('Profile fetch error:', profileError)
        // Continue with basic user info from token
      }

      // Attach user information to request
      const authReq = req as AuthenticatedRequest
      authReq.user = {
        id: user.id,
        email: user.email || '',
        role: profile?.role || 'user',
        iat: (user as any).iat,
        exp: (user as any).exp,
      }

      authReq.session = {
        accessToken,
      }

      // Call the handler
      return await handler(authReq, res)
    } catch (error) {
      console.error('withAuth middleware error:', error)
      return res.status(500).json({
        error: {
          message: 'Internal server error during authentication',
          code: 'AUTH_ERROR',
        },
        timestamp: new Date().toISOString(),
      })
    }
  }
}

/**
 * Admin role verification middleware
 *
 * Requires withAuth to be applied first
 * Verifies user has admin or super_admin role
 *
 * @example
 * export default withAuth(
 *   withAdmin(async (req, res) => {
 *     // User is guaranteed to be admin here
 *     // ...
 *   })
 * )
 */
export const withAdmin: MiddlewareWrapper = (handler: MiddlewareHandler) => {
  return async (req: VercelRequest, res: VercelResponse) => {
    const authReq = req as AuthenticatedRequest

    // Verify user exists (should be set by withAuth)
    if (!authReq.user) {
      return sendUnauthorized(res, 'Authentication required')
    }

    // Verify admin role
    const isAdmin = authReq.user.role === 'admin' || authReq.user.role === 'super_admin'

    if (!isAdmin) {
      return sendForbidden(res, 'Admin access required')
    }

    // Log admin action (audit logging)
    try {
      const supabase = createClient(
        supabaseUrl,
        process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey
      )

      await supabase.from('admin_audit_log').insert({
        user_id: authReq.user.id,
        action: `${req.method} ${req.url}`,
        resource: req.url || '',
        is_admin: isAdmin,
        timestamp: new Date().toISOString(),
        ip_address: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null,
        user_agent: req.headers['user-agent'] || null,
        metadata: {
          method: req.method,
          query: req.query,
        },
      })
    } catch (logError) {
      console.error('Failed to log admin action:', logError)
      // Don't fail the request if logging fails
    }

    return await handler(authReq, res)
  }
}

/**
 * Optional authentication middleware
 *
 * Adds user info if token is present (from cookie OR header), but doesn't require it
 * Useful for endpoints that work for both authenticated and anonymous users
 */
export const withOptionalAuth: MiddlewareWrapper = (handler: MiddlewareHandler) => {
  return async (req: VercelRequest, res: VercelResponse) => {
    // Try to extract token from cookie first, then Authorization header
    let accessToken = getCookie(req, COOKIE_NAMES.ACCESS_TOKEN)

    if (!accessToken) {
      const authHeader = req.headers.authorization || req.headers.Authorization
      if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
        accessToken = authHeader.substring(7)
      }
    }

    if (!accessToken) {
      // No token, continue as anonymous
      return await handler(req as AuthenticatedRequest, res)
    }

    try {
      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      })

      const { data: { user } } = await supabase.auth.getUser(accessToken)

      if (user) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('id, email, role')
          .eq('id', user.id)
          .single()

        const authReq = req as AuthenticatedRequest
        authReq.user = {
          id: user.id,
          email: user.email || '',
          role: profile?.role || 'user',
        }

        authReq.session = {
          accessToken,
        }
      }
    } catch (error) {
      console.error('Optional auth error:', error)
      // Continue anyway
    }

    return await handler(req as AuthenticatedRequest, res)
  }
}
