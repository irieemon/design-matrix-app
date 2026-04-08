/**
 * useSubscription — React hook wrapping subscriptionService.getSubscriptionWithLimits
 *
 * Returns the current user's subscription along with live resource limits
 * (projects, ai_ideas, users) so UI surfaces can render usage bars and gate
 * actions at the point of limit.
 */

import { useCallback, useEffect, useState } from 'react'
import { subscriptionService } from '../lib/services/subscriptionService'
import { useCurrentUser } from '../contexts/UserContext'
import type { SubscriptionWithLimits } from '../types/subscription'

export interface UseSubscriptionResult {
  subscription: SubscriptionWithLimits | null
  limits: SubscriptionWithLimits['limits'] | null
  isLoading: boolean
  error: Error | null
  refresh: () => Promise<void>
}

export function useSubscription(): UseSubscriptionResult {
  const currentUser = useCurrentUser()
  const [data, setData] = useState<SubscriptionWithLimits | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const refresh = useCallback(async () => {
    if (!currentUser?.id) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    try {
      const result = await subscriptionService.getSubscriptionWithLimits(currentUser.id)
      setData(result)
      setError(null)
    } catch (err) {
      setError(err as Error)
    } finally {
      setIsLoading(false)
    }
  }, [currentUser?.id])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return {
    subscription: data,
    limits: data?.limits ?? null,
    isLoading,
    error,
    refresh,
  }
}
