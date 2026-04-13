/**
 * useAIQuota -- fetches and caches AI quota status for the current user.
 *
 * ADR-0015 Step 4: Provides quota data (canUse, current, limit, percentageUsed,
 * isUnlimited, resetsAt) so UI surfaces can render usage badges and gate actions.
 *
 * Behavior:
 * - On mount: fetches GET /api/ai?action=quota-status&type=ai_ideas
 * - Caches result for 60 seconds (module-level, shared across instances)
 * - For paid tiers (team/enterprise): returns null quota immediately, skips fetch
 * - Listens for 'ai-quota-changed' CustomEvent and re-fetches (bypasses cache)
 * - Cleans up event listener on unmount
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSubscription } from './useSubscription'
import { getCsrfToken } from '../utils/cookieUtils'
import { logger } from '../utils/logger'

export interface QuotaData {
  canUse: boolean
  current: number
  limit: number
  percentageUsed: number
  isUnlimited: boolean
  resetsAt: string
}

export interface UseAIQuotaReturn {
  quota: QuotaData | null
  isLoading: boolean
  error: string | null
  refresh: () => void
}

const CACHE_TTL_MS = 60_000

let cachedData: QuotaData | null = null
let cacheTimerId: ReturnType<typeof setTimeout> | null = null

const PAID_TIERS = new Set(['team', 'enterprise'])

function setCache(data: QuotaData): void {
  cachedData = data
  if (cacheTimerId !== null) {
    clearTimeout(cacheTimerId)
  }
  cacheTimerId = setTimeout(() => {
    cachedData = null
    cacheTimerId = null
  }, CACHE_TTL_MS)
}

function getCachedQuota(): QuotaData | null {
  return cachedData
}

export function useAIQuota(): UseAIQuotaReturn {
  const { subscription } = useSubscription()
  const tier = subscription?.tier ?? 'free'
  const isPaid = PAID_TIERS.has(tier)

  const [quota, setQuota] = useState<QuotaData | null>(null)
  const [isLoading, setIsLoading] = useState(!isPaid)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  const fetchQuota = useCallback(async (bypassCache = false) => {
    if (isPaid) return

    if (!bypassCache) {
      const cached = getCachedQuota()
      if (cached) {
        setQuota(cached)
        setIsLoading(false)
        return
      }
    }

    setIsLoading(true)
    try {
      const csrfToken = getCsrfToken()
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken
      }

      const response = await fetch('/api/ai?action=quota-status&type=ai_ideas', {
        credentials: 'include',
        headers,
      })

      if (!response.ok) {
        const body = await response.json()
        throw new Error(body.error || `Quota fetch failed (${response.status})`)
      }

      const data: QuotaData = await response.json()

      setCache(data)

      if (mountedRef.current) {
        setQuota(data)
        setError(null)
        setIsLoading(false)
      }
    } catch (err) {
      logger.error('Failed to fetch AI quota', { error: err })
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch quota')
        setQuota(null)
        setIsLoading(false)
      }
    }
  }, [isPaid])

  useEffect(() => {
    mountedRef.current = true

    if (isPaid) {
      setQuota(null)
      setIsLoading(false)
      return
    }

    void fetchQuota()

    return () => {
      mountedRef.current = false
    }
  }, [fetchQuota, isPaid])

  useEffect(() => {
    if (isPaid) return

    const handleQuotaChanged = () => {
      void fetchQuota(true)
    }

    window.addEventListener('ai-quota-changed', handleQuotaChanged)

    return () => {
      window.removeEventListener('ai-quota-changed', handleQuotaChanged)
    }
  }, [fetchQuota, isPaid])

  const refresh = useCallback(() => {
    void fetchQuota(true)
  }, [fetchQuota])

  return { quota, isLoading, error, refresh }
}
