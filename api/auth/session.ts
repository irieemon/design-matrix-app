/**
 * GET /api/auth/session
 *
 * Get current session information from httpOnly cookie
 * Used for session restoration on page load
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { getCookie, COOKIE_NAMES } from '../_lib/middleware/cookies.js'
import { withCors } from '../_lib/middleware/cors.js'

const supabaseUrl = process.env.VITE_SUPABASE_URL!
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!

async function sessionHandler(req: VercelRequest, res: VercelResponse) {
  // Only accept GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({
      error: { message: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' },
      timestamp: new Date().toISOString()
    })
  }

  try {
    // Get access token from httpOnly cookie
    const accessToken = getCookie(req, COOKIE_NAMES.ACCESS_TOKEN)

    if (!accessToken) {
      return res.status(401).json({
        error: {
          message: 'No active session',
          code: 'NO_SESSION'
        },
        timestamp: new Date().toISOString()
      })
    }

    // Verify token with Supabase
    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    const { data: { user }, error } = await supabase.auth.getUser(accessToken)

    if (error || !user) {
      return res.status(401).json({
        error: {
          message: 'Invalid or expired session',
          code: 'INVALID_SESSION'
        },
        timestamp: new Date().toISOString()
      })
    }

    // Get user profile with role information
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id, email, full_name, role, avatar_url')
      .eq('id', user.id)
      .single()

    // Return user info (NO TOKENS in response)
    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        user_metadata: user.user_metadata,
        profile: profile || null,
      },
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Session handler error:', error)
    return res.status(500).json({
      error: {
        message: 'Internal server error',
        code: 'SERVER_ERROR'
      },
      timestamp: new Date().toISOString()
    })
  }
}

export default withCors(sessionHandler)
