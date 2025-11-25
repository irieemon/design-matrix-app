/**
 * Debug API Endpoint
 * For diagnosing serverless function issues
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  console.log('Debug endpoint called - step 1: handler started')

  try {
    // Step 2: Test basic response
    console.log('Debug endpoint - step 2: about to import supabase')

    // Dynamic import to isolate the issue
    const { supabase } = await import('../../src/lib/supabase')
    console.log('Debug endpoint - step 3: supabase imported successfully')

    // Test if client works
    const { data, error } = await supabase.from('brainstorm_sessions').select('id').limit(1)
    console.log('Debug endpoint - step 4: query completed', { hasData: !!data, hasError: !!error })

    return res.status(200).json({
      success: true,
      message: 'Debug endpoint working',
      steps: {
        handlerStarted: true,
        supabaseImported: true,
        queryCompleted: true,
        hasData: !!data,
        hasError: !!error
      }
    })
  } catch (error) {
    console.error('Debug endpoint error:', error)
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
  }
}
