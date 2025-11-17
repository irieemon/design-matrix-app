/**
 * Admin Health Check - Middleware Import Test
 *
 * Tests if importing middleware causes module load failure
 */

import type { VercelResponse } from '@vercel/node'

// Test importing middleware (this might fail at module load time)
import { adminEndpoint } from '../_lib/middleware/compose'
import type { AuthenticatedRequest } from '../_lib/middleware/types'

async function middlewareTestHandler(req: AuthenticatedRequest, res: VercelResponse) {
  return res.status(200).json({
    test: 'middleware-import',
    status: 'ok',
    timestamp: new Date().toISOString(),
    user: req.user ? {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role
    } : null,
    env: {
      hasSupabaseUrl: !!process.env.SUPABASE_URL,
      hasSupabaseAnonKey: !!process.env.SUPABASE_ANON_KEY,
      hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    }
  })
}

export default adminEndpoint(middlewareTestHandler)
