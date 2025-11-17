/**
 * Admin Health Check - Diagnostic Endpoint
 *
 * Tests different levels of middleware to identify what's failing
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'

// Test 1: Basic handler (no middleware)
async function basicHandler(_req: VercelRequest, res: VercelResponse) {
  return res.status(200).json({
    test: 'basic',
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: {
      hasSupabaseUrl: !!process.env.SUPABASE_URL,
      hasSupabaseAnonKey: !!process.env.SUPABASE_ANON_KEY,
      hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      nodeEnv: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV,
    }
  })
}

export default basicHandler
