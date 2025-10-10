/**
 * POST /api/auth/refresh
 *
 * Refresh access token using refresh token from httpOnly cookie
 * Called automatically by frontend when access token expires
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { getCookie, COOKIE_NAMES, setAuthCookies, generateCSRFToken, clearAuthCookies } from '../_lib/middleware/cookies.js'
import { withCors } from '../_lib/middleware/cors.js'

const supabaseUrl = process.env.VITE_SUPABASE_URL!
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!

async function refreshHandler(req: VercelRequest, res: VercelResponse) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: { message: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' },
      timestamp: new Date().toISOString()
    })
  }

  try {
    // Get refresh token from httpOnly cookie
    const refreshToken = getCookie(req, COOKIE_NAMES.REFRESH_TOKEN)

    if (!refreshToken) {
      return res.status(401).json({
        error: {
          message: 'No refresh token available',
          code: 'NO_REFRESH_TOKEN'
        },
        timestamp: new Date().toISOString()
      })
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    // Refresh the session
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: refreshToken,
    })

    if (error || !data.session) {
      console.error('Refresh error:', error)

      // Clear invalid cookies
      clearAuthCookies(res)

      return res.status(401).json({
        error: {
          message: 'Failed to refresh session',
          code: 'REFRESH_FAILED'
        },
        timestamp: new Date().toISOString()
      })
    }

    // Generate new CSRF token
    const csrfToken = generateCSRFToken()

    // Update cookies with new tokens
    setAuthCookies(res, {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      csrfToken,
    })

    // Return success (NO TOKENS in response body)
    return res.status(200).json({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        user_metadata: data.user.user_metadata,
      },
      csrfToken,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Refresh handler error:', error)

    // Clear cookies on error
    clearAuthCookies(res)

    return res.status(500).json({
      error: {
        message: 'Internal server error',
        code: 'SERVER_ERROR'
      },
      timestamp: new Date().toISOString()
    })
  }
}

export default withCors(refreshHandler)
