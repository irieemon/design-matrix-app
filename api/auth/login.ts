/**
 * POST /api/auth/login
 *
 * Secure authentication endpoint using httpOnly cookies
 * Resolves PRIO-SEC-001 (CVSS 9.1) by eliminating localStorage token storage
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { setAuthCookies, generateCSRFToken } from '../_lib/middleware/cookies.js'
import { withCors } from '../_lib/middleware/cors.js'

const supabaseUrl = process.env.VITE_SUPABASE_URL!
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!

async function loginHandler(req: VercelRequest, res: VercelResponse) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: { message: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' },
      timestamp: new Date().toISOString()
    })
  }

  try {
    const { email, password } = req.body

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        error: {
          message: 'Email and password are required',
          code: 'VALIDATION_ERROR'
        },
        timestamp: new Date().toISOString()
      })
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    // Authenticate with Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      console.error('Login error:', error)
      return res.status(401).json({
        error: {
          message: error.message,
          code: 'AUTH_ERROR'
        },
        timestamp: new Date().toISOString()
      })
    }

    if (!data.session) {
      return res.status(401).json({
        error: {
          message: 'Authentication failed',
          code: 'NO_SESSION'
        },
        timestamp: new Date().toISOString()
      })
    }

    // Generate CSRF token for request protection
    const csrfToken = generateCSRFToken()

    // Set secure httpOnly cookies
    setAuthCookies(res, {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      csrfToken,
    })

    // Return success with user info (NO TOKENS in response body)
    return res.status(200).json({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        user_metadata: data.user.user_metadata,
      },
      // CSRF token is also in cookie, but include in response for initial setup
      csrfToken,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Login handler error:', error)
    return res.status(500).json({
      error: {
        message: 'Internal server error',
        code: 'SERVER_ERROR'
      },
      timestamp: new Date().toISOString()
    })
  }
}

export default withCors(loginHandler)
