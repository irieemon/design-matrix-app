/**
 * withQuotaCheck — Phase 11.6 architectural rewrite.
 *
 * Replaces the PROD-BUG-01 emergency stub with a real quota-enforcing middleware
 * that delegates to `api/_lib/services/subscriptionService.ts#checkLimit`. The
 * prior stub imported `src/lib/services/subscriptionService` which transitively
 * evaluated a Vite-only construct at module load that crashes in Node ESM.
 * This file imports only:
 *   - `@vercel/node` type declarations (type-only, zero runtime)
 *   - `../utils/supabaseAdmin.js` (conditional createClient, null-safe)
 *   - `../services/subscriptionService.js` (the existing backend service)
 *
 * PROD-BUG-01 regression gate: NO top-level `await`, NO Vite build-time env refs,
 * NO imports from `../../../src/`. Keep module-load a zero-work operation.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../utils/supabaseAdmin.js'
import { checkLimit } from '../services/subscriptionService.js'

export type QuotaResource = 'projects' | 'users'

export interface QuotaContext {
  userId: string
  tier: string
  limit: number | null
  used: number
  isUnlimited: boolean
}

export interface QuotaRequest extends VercelRequest {
  quota: QuotaContext
}

type Handler = (
  req: QuotaRequest,
  res: VercelResponse
) => Promise<VercelResponse | void> | VercelResponse | void

export function withQuotaCheck(resource: QuotaResource, handler: Handler) {
  return async (req: VercelRequest, res: VercelResponse) => {
    // 1. Admin client sanity check — null when env vars missing. Fail-closed.
    if (!supabaseAdmin) {
      console.error('[withQuotaCheck] supabaseAdmin is null — SUPABASE env vars missing')
      return res
        .status(500)
        .json({ error: { code: 'QUOTA_CHECK_FAILED', message: 'Service unavailable' } })
    }

    // 2. Extract bearer token
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res
        .status(401)
        .json({ error: { code: 'UNAUTHORIZED', message: 'Missing bearer token' } })
    }
    const token = authHeader.substring(7)

    // 3. Validate token → 401 on failure
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr || !userData?.user) {
      return res
        .status(401)
        .json({ error: { code: 'UNAUTHORIZED', message: 'Invalid token' } })
    }
    const userId = userData.user.id

    // 4. Quota check — backend service fails closed (returns canUse:false on any error)
    const limit = await checkLimit(userId, resource)
    if (!limit.canUse) {
      console.error('[withQuotaCheck] denied', {
        userId,
        resource,
        current: limit.current,
        limit: limit.limit,
      })
      return res.status(402).json({
        error: {
          code: 'quota_exceeded',
          resource,
          limit: limit.limit,
          used: limit.current,
          upgradeUrl: '/pricing',
        },
      })
    }

    // 5. Attach quota context and delegate to handler
    ;(req as QuotaRequest).quota = {
      userId,
      tier: 'unknown', // existing checkLimit does not surface tier — deferred enhancement
      limit: limit.isUnlimited ? null : limit.limit,
      used: limit.current,
      isUnlimited: limit.isUnlimited,
    }

    return handler(req as QuotaRequest, res)
  }
}
