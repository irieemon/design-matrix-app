/**
 * Tests for useSubscription hook (BILL-04 Plan 06-04 Task 1).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import React from 'react'

// Mock the subscription service
vi.mock('../../lib/services/subscriptionService', () => ({
  subscriptionService: {
    getSubscriptionWithLimits: vi.fn(),
  },
}))

// Mock the user context
vi.mock('../../contexts/UserContext', () => ({
  useCurrentUser: vi.fn(),
}))

import { subscriptionService } from '../../lib/services/subscriptionService'
import { useCurrentUser } from '../../contexts/UserContext'
import { useSubscription } from '../useSubscription'

const mockSub = {
  id: 'sub-1',
  user_id: 'user-1',
  tier: 'free' as const,
  status: 'active' as const,
  stripe_customer_id: null,
  stripe_subscription_id: null,
  current_period_start: null,
  current_period_end: null,
  cancel_at_period_end: false,
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
  limits: {
    projects: { canUse: false, current: 1, limit: 1, isUnlimited: false, percentageUsed: 100 },
    ai_ideas: { canUse: true, current: 3, limit: 5, isUnlimited: false, percentageUsed: 60 },
    users: { canUse: true, current: 1, limit: 3, isUnlimited: false, percentageUsed: 33 },
  },
}

describe('useSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(useCurrentUser as any).mockReturnValue({ id: 'user-1', email: 'a@b.com' })
  })

  it('returns subscription and limits on success', async () => {
    ;(subscriptionService.getSubscriptionWithLimits as any).mockResolvedValue(mockSub)

    const { result } = renderHook(() => useSubscription())

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.subscription).toEqual(mockSub)
    expect(result.current.limits).toEqual(mockSub.limits)
    expect(result.current.error).toBeNull()
    expect(subscriptionService.getSubscriptionWithLimits).toHaveBeenCalledWith('user-1')
  })

  it('exposes refresh() that re-fetches', async () => {
    ;(subscriptionService.getSubscriptionWithLimits as any).mockResolvedValue(mockSub)

    const { result } = renderHook(() => useSubscription())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.refresh()
    })

    expect(subscriptionService.getSubscriptionWithLimits).toHaveBeenCalledTimes(2)
  })

  it('returns error state on failure without crashing', async () => {
    const err = new Error('boom')
    ;(subscriptionService.getSubscriptionWithLimits as any).mockRejectedValue(err)

    const { result } = renderHook(() => useSubscription())

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.error).toBe(err)
    expect(result.current.subscription).toBeNull()
  })
})
