// ⚠️ TEMPORARY STUB — Phase 11.6 (v1.4) architectural rework TODO
//
// Original implementation crashed Vercel functions because it imported
// src/lib/services/subscriptionService → src/lib/supabase → import.meta.env
// (Vite-only construct, undefined in Node ESM runtime).
//
// This stub is a pass-through with NO quota enforcement. Restore via
// api/_lib/subscriptionBackend.ts (Node-safe re-impl) before launch.
//
// Context: PROD-BUG-01, docs/pipeline/investigation-ledger.md

import type { VercelRequest, VercelResponse } from '@vercel/node'

export type QuotaResource = 'projects' | 'ai_ideas' | 'users'

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

// Never thrown by this stub; preserved so callers that catch it still compile.
export class SubscriptionCheckError extends Error {
  constructor(message?: string) {
    super(message)
    this.name = 'SubscriptionCheckError'
  }
}

type Handler = (req: QuotaRequest, res: VercelResponse) => Promise<VercelResponse | void> | VercelResponse | void

export function withQuotaCheck(resource: QuotaResource, handler: Handler) {
  return async (req: VercelRequest, res: VercelResponse) => {
    console.warn('[withQuotaCheck:STUB] quota enforcement disabled — see Phase 11.6')

    // Pass-through: attach a stub quota context and delegate to handler.
    ;(req as QuotaRequest).quota = {
      userId: '',
      tier: 'free',
      limit: null,
      used: 0,
      isUnlimited: true,
    }

    return handler(req as QuotaRequest, res)
  }
}
