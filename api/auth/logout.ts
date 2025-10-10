/**
 * POST /api/auth/logout
 *
 * Secure logout endpoint that clears httpOnly cookies
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { clearAuthCookies, getCookie, COOKIE_NAMES } from '../_lib/middleware/cookies.js'
import { withCors } from '../_lib/middleware/cors.js'

const supabaseUrl = process.env.VITE_SUPABASE_URL!
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!

async function logoutHandler(req: VercelRequest, res: VercelResponse) {
  // Accept POST or GET (for backward compatibility)
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({
      error: { message: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' },
      timestamp: new Date().toISOString()
    })
  }

  try {
    // Get access token from cookie
    const accessToken = getCookie(req, COOKIE_NAMES.ACCESS_TOKEN)

    // If we have a token, sign out from Supabase
    if (accessToken) {
      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      })

      // Sign out from Supabase (invalidates refresh token)
      await supabase.auth.signOut()
    }

    // Clear all auth cookies
    clearAuthCookies(res)

    return res.status(200).json({
      success: true,
      message: 'Logged out successfully',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Logout handler error:', error)

    // Even if error, clear cookies
    clearAuthCookies(res)

    return res.status(200).json({
      success: true,
      message: 'Logged out (with errors)',
      timestamp: new Date().toISOString()
    })
  }
}

export default withCors(logoutHandler)
