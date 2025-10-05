/**
 * Token Refresh API
 *
 * POST /api/auth/refresh - Refresh access token using refresh token from httpOnly cookie
 *
 * Implements token rotation for enhanced security
 */

import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  setAuthCookies,
  clearAuthCookies,
  generateCSRFToken,
  getCookie,
  COOKIE_NAMES,
  withRateLimit,
  compose,
} from '../middleware'

const supabaseUrl = process.env.VITE_SUPABASE_URL!
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!

/**
 * Refresh token handler
 */
async function refreshHandler(req: VercelRequest, res: VercelResponse) {
  // Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-XSS-Protection', '1; mode=block')

  if (req.method !== 'POST') {
    if (req.method === 'OPTIONS') {
      return res.status(200).end()
    }

    return res.status(405).json({
      error: {
        message: 'Method not allowed',
        code: 'METHOD_NOT_ALLOWED',
        allowed: ['POST'],
      },
      timestamp: new Date().toISOString(),
    })
  }

  try {
    // Get refresh token from httpOnly cookie
    const refreshToken = getCookie(req, COOKIE_NAMES.REFRESH_TOKEN)

    if (!refreshToken) {
      // No refresh token, clear any existing cookies
      clearAuthCookies(res)

      return res.status(401).json({
        error: {
          message: 'No refresh token provided',
          code: 'REFRESH_TOKEN_MISSING',
        },
        timestamp: new Date().toISOString(),
      })
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    // Refresh the session
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: refreshToken,
    })

    if (error || !data.session) {
      console.error('Token refresh error:', error)

      // Clear cookies on refresh failure
      clearAuthCookies(res)

      return res.status(401).json({
        error: {
          message: error?.message || 'Token refresh failed',
          code: 'REFRESH_FAILED',
        },
        timestamp: new Date().toISOString(),
      })
    }

    // Generate new CSRF token (token rotation)
    const csrfToken = generateCSRFToken()

    // Set new httpOnly cookies with rotated tokens
    setAuthCookies(res, {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      csrfToken,
    })

    // Return success with user info
    return res.status(200).json({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        metadata: data.user.user_metadata,
      },
      expiresAt: data.session.expires_at,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Refresh handler error:', error)

    // Clear cookies on error
    clearAuthCookies(res)

    return res.status(500).json({
      error: {
        message: 'Internal server error during token refresh',
        code: 'REFRESH_ERROR',
      },
      timestamp: new Date().toISOString(),
    })
  }
}

/**
 * Export handler with rate limiting
 */
export default compose(
  withRateLimit({
    windowMs: 15 * 60 * 1000,  // 15 minutes
    maxRequests: 50,  // Allow more refreshes than login
  })
)(refreshHandler)
