/**
 * Debug API Endpoint
 * For diagnosing serverless function issues
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  console.log('Debug endpoint called - step 1: handler started')

  try {
    // Create inline Supabase client (avoid all import issues)
    const supabaseUrl = process.env.SUPABASE_URL || ''
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

    console.log('Debug endpoint - step 2: env vars', { hasUrl: !!supabaseUrl, hasKey: !!supabaseServiceRoleKey })

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return res.status(500).json({
        success: false,
        error: 'Missing Supabase configuration',
        steps: {
          handlerStarted: true,
          hasUrl: !!supabaseUrl,
          hasKey: !!supabaseServiceRoleKey
        }
      })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
    console.log('Debug endpoint - step 3: supabase client created')

    // Test if client works
    const { data, error } = await supabase.from('brainstorm_sessions').select('id').limit(1)
    console.log('Debug endpoint - step 4: query completed', { hasData: !!data, hasError: !!error })

    return res.status(200).json({
      success: true,
      message: 'Debug endpoint working',
      steps: {
        handlerStarted: true,
        supabaseCreated: true,
        queryCompleted: true,
        hasData: !!data,
        hasError: !!error,
        errorMessage: error?.message
      }
    })
  } catch (err) {
    console.error('Debug endpoint error:', err)
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
      stack: err instanceof Error ? err.stack : undefined
    })
  }
}
