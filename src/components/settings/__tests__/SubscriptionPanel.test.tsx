/**
 * Tests for SubscriptionPanel (BILL-04 Plan 06-04 Task 1).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import React from 'react'

vi.mock('../../../hooks/useSubscription', () => ({
  useSubscription: vi.fn(),
}))

import { useSubscription } from '../../../hooks/useSubscription'
import SubscriptionPanel from '../SubscriptionPanel'

const baseFree = {
  subscription: {
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
  },
  limits: {
    projects: { canUse: false, current: 1, limit: 1, isUnlimited: false, percentageUsed: 100 },
    ai_ideas: { canUse: true, current: 3, limit: 5, isUnlimited: false, percentageUsed: 60 },
    users: { canUse: true, current: 1, limit: 3, isUnlimited: false, percentageUsed: 33 },
  },
  isLoading: false,
  error: null,
  refresh: vi.fn(),
}

const teamSub = {
  ...baseFree,
  subscription: {
    ...baseFree.subscription,
    tier: 'team' as const,
    current_period_end: '2026-12-01T00:00:00Z',
    limits: {
      projects: { canUse: true, current: 2, limit: 10, isUnlimited: false, percentageUsed: 20 },
      ai_ideas: { canUse: true, current: 0, limit: Infinity, isUnlimited: true, percentageUsed: 0 },
      users: { canUse: true, current: 1, limit: 15, isUnlimited: false, percentageUsed: 7 },
    },
  },
  limits: {
    projects: { canUse: true, current: 2, limit: 10, isUnlimited: false, percentageUsed: 20 },
    ai_ideas: { canUse: true, current: 0, limit: Infinity, isUnlimited: true, percentageUsed: 0 },
    users: { canUse: true, current: 1, limit: 15, isUnlimited: false, percentageUsed: 7 },
  },
}

describe('SubscriptionPanel', () => {
  const originalLocation = window.location
  beforeEach(() => {
    vi.clearAllMocks()
    // Ensure window.location is writable for the redirect assertion
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, href: '' },
    })
    global.fetch = vi.fn() as any
  })

  it('renders Free badge with usage bars and reset date', () => {
    ;(useSubscription as any).mockReturnValue(baseFree)
    render(<SubscriptionPanel />)

    expect(screen.getByText('Free')).toBeInTheDocument()
    expect(screen.getByText(/1 \/ 1/)).toBeInTheDocument() // projects
    expect(screen.getByText(/3 \/ 5/)).toBeInTheDocument() // ai
    expect(screen.getByRole('button', { name: /Upgrade/ })).toBeInTheDocument()
  })

  it('renders Unlimited label when isUnlimited', () => {
    ;(useSubscription as any).mockReturnValue(teamSub)
    render(<SubscriptionPanel />)
    expect(screen.getByText('Team')).toBeInTheDocument()
    expect(screen.getByText(/0 \/ Unlimited/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Manage Subscription/ })).toBeInTheDocument()
  })

  it('Upgrade button calls /api/stripe?action=checkout and redirects', async () => {
    ;(useSubscription as any).mockReturnValue(baseFree)
    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ url: 'https://checkout.stripe.com/abc' }),
    })

    render(<SubscriptionPanel />)
    fireEvent.click(screen.getByRole('button', { name: /Upgrade/ }))

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/stripe?action=checkout',
        expect.objectContaining({ method: 'POST', credentials: 'include' })
      )
    )
    await waitFor(() => expect(window.location.href).toBe('https://checkout.stripe.com/abc'))
  })

  it('Manage Subscription button calls /api/stripe?action=portal and redirects', async () => {
    ;(useSubscription as any).mockReturnValue(teamSub)
    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ url: 'https://billing.stripe.com/xyz' }),
    })

    render(<SubscriptionPanel />)
    fireEvent.click(screen.getByRole('button', { name: /Manage Subscription/ }))

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/stripe?action=portal',
        expect.objectContaining({ method: 'POST' })
      )
    )
    await waitFor(() => expect(window.location.href).toBe('https://billing.stripe.com/xyz'))
  })
})
