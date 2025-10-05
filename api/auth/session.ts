/**
 * Session Management API
 *
 * POST   /api/auth/session   - Login (create session with httpOnly cookies)
 * DELETE /api/auth/session   - Logout (clear cookies and revoke session)
 */

import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  setAuthCookies,
  clearAuthCookies,
  generateCSRFToken,
  getCookie,
  COOKIE_NAMES,
  withStrictRateLimit,
  withOriginValidation,
  compose,
} from '../middleware'

const supabaseUrl = process.env.VITE_SUPABASE_URL!
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!

/**
 * Login handler
 */
async function handleLogin(req: VercelRequest, res: VercelResponse) {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({
        error: {
          message: 'Email and password are required',
          code: 'MISSING_CREDENTIALS',
        },
        timestamp: new Date().toISOString(),
      })
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    // Attempt to sign in
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error || !data.session) {
      console.error('Login error:', error)
      return res.status(401).json({
        error: {
          message: error?.message || 'Invalid credentials',
          code: 'LOGIN_FAILED',
        },
        timestamp: new Date().toISOString(),
      })
    }

    // Generate CSRF token
    const csrfToken = generateCSRFToken()

    // Set httpOnly cookies
    setAuthCookies(res, {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      csrfToken,
    })

    // Return user profile (don't send tokens)
    return res.status(200).json({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        full_name: data.user.user_metadata?.full_name || data.user.email,
        avatar_url: data.user.user_metadata?.avatar_url || null,
        role: data.user.role || 'user',
        created_at: data.user.created_at,
        updated_at: data.user.updated_at,
      },
      expiresAt: data.session.expires_at,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Login handler error:', error)
    return res.status(500).json({
      error: {
        message: 'Internal server error during login',
        code: 'LOGIN_ERROR',
      },
      timestamp: new Date().toISOString(),
    })
  }
}

/**
 * Logout handler
 */
async function handleLogout(req: VercelRequest, res: VercelResponse) {
  try {
    // Get access token from cookie
    const accessToken = getCookie(req, COOKIE_NAMES.ACCESS_TOKEN)

    if (accessToken) {
      // Create Supabase client with token
      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      })

      // Revoke session
      await supabase.auth.signOut()
    }

    // Clear all auth cookies
    clearAuthCookies(res)

    return res.status(200).json({
      success: true,
      message: 'Logged out successfully',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Logout handler error:', error)

    // Still clear cookies even if signOut fails
    clearAuthCookies(res)

    return res.status(200).json({
      success: true,
      message: 'Logged out (with errors)',
      timestamp: new Date().toISOString(),
    })
  }
}

/**
 * Main handler
 */
async function sessionHandler(req: VercelRequest, res: VercelResponse) {
  // Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-XSS-Protection', '1; mode=block')

  if (req.method === 'POST') {
    return handleLogin(req, res)
  }

  if (req.method === 'DELETE') {
    return handleLogout(req, res)
  }

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  return res.status(405).json({
    error: {
      message: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED',
      allowed: ['POST', 'DELETE'],
    },
    timestamp: new Date().toISOString(),
  })
}

/**
 * Export handler with security middleware
 */
export default compose(
  withStrictRateLimit(),  // 5 requests per 15 minutes (strict for auth)
  withOriginValidation()  // Verify Origin/Referer header
)(sessionHandler)
