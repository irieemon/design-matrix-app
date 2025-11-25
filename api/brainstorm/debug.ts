/**
 * Debug API Endpoint
 * For diagnosing serverless function issues
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../_lib/utils/supabaseAdmin'

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  console.log('Debug endpoint called - step 1: handler started')

  try {
    console.log('Debug endpoint - step 2: supabaseAdmin imported')
    console.log('Debug endpoint - step 3: supabaseAdmin exists:', !!supabaseAdmin)

    if (!supabaseAdmin) {
      return res.status(500).json({
        success: false,
        error: 'Supabase admin client not initialized - check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars',
        steps: {
          handlerStarted: true,
          supabaseImported: true,
          clientExists: false
        }
      })
    }

    // Test if client works
    const { data, error } = await supabaseAdmin.from('brainstorm_sessions').select('id').limit(1)
    console.log('Debug endpoint - step 4: query completed', { hasData: !!data, hasError: !!error })

    return res.status(200).json({
      success: true,
      message: 'Debug endpoint working',
      steps: {
        handlerStarted: true,
        supabaseImported: true,
        clientExists: true,
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
