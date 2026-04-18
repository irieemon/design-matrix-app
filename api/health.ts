/**
 * Health Check Endpoint — /api/health
 *
 * Returns a minimal liveness/readiness payload with Supabase reachability.
 * Always returns 200 so external probes can differentiate transport errors
 * from application-level degradation. Shape is stable and contains NO user
 * identifiers, tokens, emails, CSRF values, env values, or build metadata.
 *
 * Response shape (exact):
 *   {
 *     status: 'ok' | 'degraded',
 *     timestamp: <ISO8601 string>,
 *     supabase: 'ok' | 'degraded' | 'unreachable'
 *   }
 */

import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const SUPABASE_PROBE_TIMEOUT_MS = 2000

type SupabaseHealth = 'ok' | 'degraded' | 'unreachable'
type OverallStatus = 'ok' | 'degraded'

interface HealthResponse {
  status: OverallStatus
  timestamp: string
  supabase: SupabaseHealth
}

/**
 * Probe Supabase reachability with a lightweight, RLS-safe query.
 * Returns 'ok' on success, 'degraded' on query error, 'unreachable' on
 * timeout or network failure. Never throws.
 */
async function probeSupabase(): Promise<SupabaseHealth> {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''

  if (!url || !anonKey) {
    return 'unreachable'
  }

  try {
    const supabase = createClient(url, anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    })

    const probe = supabase
      .from('user_profiles')
      .select('id', { head: true, count: 'exact' })
      .limit(0)

    const timeoutPromise = new Promise<'timeout'>((resolve) => {
      setTimeout(() => resolve('timeout'), SUPABASE_PROBE_TIMEOUT_MS)
    })

    const result = await Promise.race([probe, timeoutPromise])

    if (result === 'timeout') {
      return 'unreachable'
    }

    // supabase-js returns { error, data, count } on head queries
    if (result.error) {
      return 'degraded'
    }

    return 'ok'
  } catch {
    return 'unreachable'
  }
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse | void> {
  // Security headers (match pattern used in api/auth.ts)
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Cache-Control', 'no-store')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      error: 'Method not allowed',
      allowed: ['GET'],
    })
  }

  const supabaseHealth = await probeSupabase()
  const overall: OverallStatus = supabaseHealth === 'ok' ? 'ok' : 'degraded'

  const body: HealthResponse = {
    status: overall,
    timestamp: new Date().toISOString(),
    supabase: supabaseHealth,
  }

  return res.status(200).json(body)
}
