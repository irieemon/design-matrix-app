/**
 * withQuotaCheck — Subscription quota enforcement middleware (Phase 06-02)
 *
 * Wraps a Vercel handler with:
 *  1. Bearer/cookie auth (same pattern as api/invitations/create.ts)
 *  2. Subscription tier resolution via service-role admin client
 *  3. Quota check via subscriptionService.checkLimit(...) — FAIL CLOSED on error (BILL-03)
 *  4. 402 quota_exceeded response when over limit (NOT 429)
 *  5. Post-success incrementAiUsage for ai_ideas resource only (D-12)
 *
 * CRITICAL: every subscriptionService call receives the service-role admin client
 * as an explicit argument. This bypasses the module-level anon supabase singleton,
 * which would otherwise return empty rows under RLS and silently fail open.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { subscriptionService, SubscriptionCheckError } from '../../../src/lib/services/subscriptionService'
import type { SubscriptionTier } from '../../../src/lib/config/tierLimits'

export type QuotaResource = 'projects' | 'ai_ideas' | 'users'

export interface QuotaContext {
  userId: string
  tier: SubscriptionTier
  limit: number | null // null = unlimited
  used: number
  isUnlimited: boolean
}

export interface QuotaRequest extends VercelRequest {
  quota: QuotaContext
}

type Handler = (req: QuotaRequest, res: VercelResponse) => Promise<VercelResponse | void> | VercelResponse | void

function getAccessToken(req: VercelRequest): string | null {
  const cookieHeader = req.headers.cookie
  if (cookieHeader && typeof cookieHeader === 'string') {
    const match = cookieHeader.match(/(?:^|;\s*)sb-access-token=([^;]+)/)
    if (match) return decodeURIComponent(match[1])
  }
  const authHeader = req.headers.authorization || (req.headers as any).Authorization
  if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7)
  }
  return null
}

function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!url || !key) throw new Error('Missing Supabase service-role configuration')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export function withQuotaCheck(resource: QuotaResource, handler: Handler) {
  return async (req: VercelRequest, res: VercelResponse) => {
    // 1. Auth
    const token = getAccessToken(req)
    if (!token) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } })
    }

    let userId: string
    let tier: SubscriptionTier = 'free'
    let adminClient: SupabaseClient
    try {
      adminClient = getSupabaseAdmin()
      const { data, error } = await adminClient.auth.getUser(token)
      if (error || !data.user) {
        return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid token' } })
      }
      userId = data.user.id
      // CRITICAL: pass adminClient — never let the service fall through to its anon singleton.
      const sub = await subscriptionService.getSubscription(userId, adminClient)
      tier = (sub?.tier as SubscriptionTier) ?? 'free'
    } catch (err) {
      console.error('[quota] auth/subscription resolve failed — denying:', err)
      return res.status(500).json({
        error: { code: 'QUOTA_CHECK_FAILED', message: 'Unable to verify subscription. Please try again.' },
      })
    }

    // 2. Quota check — FAIL CLOSED (BILL-03)
    let check
    try {
      check = await subscriptionService.checkLimit(userId, resource, adminClient)
    } catch (err) {
      console.error('[quota] checkLimit threw — denying:', err)
      const _isKnown = err instanceof SubscriptionCheckError
      return res.status(500).json({
        error: { code: 'QUOTA_CHECK_FAILED', message: 'Unable to verify subscription. Please try again.' },
      })
    }

    // 3. Enforce — 402 (NOT 429) per research §3
    if (!check.canUse) {
      return res.status(402).json({
        error: {
          code: 'quota_exceeded',
          message: `You've reached your ${resource} limit for this plan.`,
          resource,
          limit: check.isUnlimited ? null : check.limit,
          used: check.current,
          tier,
          upgradeUrl: '/pricing',
        },
      })
    }

    // 4. Attach context and run handler
    ;(req as QuotaRequest).quota = {
      userId,
      tier,
      limit: check.isUnlimited ? null : check.limit,
      used: check.current,
      isUnlimited: check.isUnlimited,
    }

    const result = await handler(req as QuotaRequest, res)

    // 5. Post-success increment (D-12) — ai_ideas only, after 2xx, best-effort
    if (resource === 'ai_ideas' && res.statusCode < 400) {
      subscriptionService.incrementAiUsage(userId, adminClient).catch((err) => {
        console.error('[quota] incrementAiUsage failed (non-blocking):', err)
      })
    }

    return result
  }
}
