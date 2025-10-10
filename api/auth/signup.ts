/**
 * POST /api/auth/signup
 *
 * Secure user registration endpoint using httpOnly cookies
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { setAuthCookies, generateCSRFToken } from '../_lib/middleware/cookies.js'
import { withCors } from '../_lib/middleware/cors.js'

const supabaseUrl = process.env.VITE_SUPABASE_URL!
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!

async function signupHandler(req: VercelRequest, res: VercelResponse) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: { message: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' },
      timestamp: new Date().toISOString()
    })
  }

  try {
    const { email, password, full_name } = req.body

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

    // Password strength validation
    if (password.length < 8) {
      return res.status(400).json({
        error: {
          message: 'Password must be at least 8 characters',
          code: 'WEAK_PASSWORD'
        },
        timestamp: new Date().toISOString()
      })
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    // Register with Supabase
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: full_name || email.split('@')[0],
        },
      },
    })

    if (error) {
      console.error('Signup error:', error)
      return res.status(400).json({
        error: {
          message: error.message,
          code: 'SIGNUP_ERROR'
        },
        timestamp: new Date().toISOString()
      })
    }

    if (!data.user) {
      return res.status(500).json({
        error: {
          message: 'User creation failed',
          code: 'USER_CREATION_FAILED'
        },
        timestamp: new Date().toISOString()
      })
    }

    // If email confirmation is required, session will be null
    if (!data.session) {
      return res.status(200).json({
        success: true,
        message: 'Please check your email to confirm your account',
        requiresEmailConfirmation: true,
        user: {
          id: data.user.id,
          email: data.user.email,
        },
        timestamp: new Date().toISOString()
      })
    }

    // If auto-confirmed, set cookies
    const csrfToken = generateCSRFToken()

    setAuthCookies(res, {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      csrfToken,
    })

    return res.status(201).json({
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
    console.error('Signup handler error:', error)
    return res.status(500).json({
      error: {
        message: 'Internal server error',
        code: 'SERVER_ERROR'
      },
      timestamp: new Date().toISOString()
    })
  }
}

export default withCors(signupHandler)
