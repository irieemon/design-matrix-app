/**
 * Minimal test endpoint to diagnose middleware issues
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Test 1: Basic response
    const result = {
      message: 'Test endpoint working',
      timestamp: new Date().toISOString(),
      env: {
        hasSupabaseUrl: !!process.env.SUPABASE_URL,
        hasSupabaseAnonKey: !!process.env.SUPABASE_ANON_KEY,
        hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        nodeEnv: process.env.NODE_ENV,
      }
    }

    // Test 2: Try importing middleware
    try {
      const { adminEndpoint } = await import('../_lib/middleware/compose')
      result['middlewareImport'] = 'SUCCESS'
    } catch (e) {
      result['middlewareImport'] = `FAILED: ${e instanceof Error ? e.message : String(e)}`
    }

    // Test 3: Try importing supabaseAdmin
    try {
      const { supabaseAdmin } = await import('../_lib/utils/supabaseAdmin')
      result['supabaseAdminImport'] = supabaseAdmin ? 'SUCCESS (client created)' : 'SUCCESS (client is null)'
    } catch (e) {
      result['supabaseAdminImport'] = `FAILED: ${e instanceof Error ? e.message : String(e)}`
    }

    return res.status(200).json(result)
  } catch (error) {
    return res.status(500).json({
      error: 'Handler error',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
  }
}
