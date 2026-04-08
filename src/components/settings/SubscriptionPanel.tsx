/**
 * SubscriptionPanel — dashboard widget for Settings (BILL-04).
 *
 * Shows:
 *  - Current plan badge
 *  - Usage bars for projects, AI ideas, team members
 *  - Period reset date (subscription.current_period_end, or next month for free)
 *  - Upgrade (free) / Manage Subscription (paid) buttons wired to /api/stripe
 */

import React, { useState } from 'react'
import { CreditCard, ExternalLink, TrendingUp, Loader2 } from 'lucide-react'
import { useSubscription } from '../../hooks/useSubscription'
import { TIER_NAMES, TIER_PRICING } from '../../lib/config/tierLimits'
import type { LimitCheckResult } from '../../types/subscription'
import { logger } from '../../utils/logger'
import { getAuthHeadersSync } from '../../lib/authHeaders'

const CHECKOUT_ENDPOINT = '/api/stripe?action=checkout'
const PORTAL_ENDPOINT = '/api/stripe?action=portal'

interface UsageBarProps {
  label: string
  result: LimitCheckResult
}

const UsageBar: React.FC<UsageBarProps> = ({ label, result }) => {
  const limitLabel = result.isUnlimited ? 'Unlimited' : String(result.limit)
  const pct = result.isUnlimited ? 0 : Math.min(100, Math.round(result.percentageUsed))
  const barColor = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-sapphire-500'

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="text-slate-600">
          {result.current} / {limitLabel}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        {!result.isUnlimited && (
          <div
            className={`h-full transition-all ${barColor}`}
            style={{ width: `${pct}%` }}
            aria-label={`${label} usage ${pct}%`}
          />
        )}
        {result.isUnlimited && (
          <div className="h-full w-full bg-gradient-to-r from-emerald-300 to-emerald-500" />
        )}
      </div>
    </div>
  )
}

function getResetDate(currentPeriodEnd: string | null): Date {
  if (currentPeriodEnd) return new Date(currentPeriodEnd)
  // Free tier: next month's 1st
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth() + 1, 1)
}

export const SubscriptionPanel: React.FC = () => {
  const { subscription, limits, isLoading, error } = useSubscription()
  const [busy, setBusy] = useState<'checkout' | 'portal' | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const handleCheckout = async () => {
    setBusy('checkout')
    setActionError(null)
    try {
      const priceId = import.meta.env.VITE_STRIPE_PRICE_ID_TEAM
      const res = await fetch(CHECKOUT_ENDPOINT, {
        method: 'POST',
        headers: getAuthHeadersSync(),
        credentials: 'include',
        body: JSON.stringify({ priceId, tier: 'team' }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error?.message || body?.error || 'Checkout failed')
      }
      const { url } = await res.json()
      if (url) window.location.href = url
    } catch (err) {
      logger.error('SubscriptionPanel checkout error', err)
      setActionError(err instanceof Error ? err.message : 'Checkout failed')
      setBusy(null)
    }
  }

  const handlePortal = async () => {
    setBusy('portal')
    setActionError(null)
    try {
      const res = await fetch(PORTAL_ENDPOINT, {
        method: 'POST',
        headers: getAuthHeadersSync(),
        credentials: 'include',
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error?.message || body?.error || 'Portal failed')
      }
      const { url } = await res.json()
      if (url) window.location.href = url
    } catch (err) {
      logger.error('SubscriptionPanel portal error', err)
      setActionError(err instanceof Error ? err.message : 'Portal failed')
      setBusy(null)
    }
  }

  if (isLoading) {
    return (
      <div
        data-testid="subscription-panel-loading"
        className="flex items-center justify-center rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm"
      >
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" aria-hidden="true" />
      </div>
    )
  }

  if (error || !subscription || !limits) {
    return (
      <div className="rounded-2xl border border-slate-200/60 bg-white p-6 text-center text-sm text-slate-600 shadow-sm">
        Unable to load Subscription information.
      </div>
    )
  }

  const tier = subscription.tier
  const tierName = TIER_NAMES[tier]
  const price = TIER_PRICING[tier]
  const resetDate = getResetDate(subscription.current_period_end)
  const isFree = tier === 'free'

  return (
    <div
      data-testid="subscription-panel"
      className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm"
    >
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Subscription &amp; Usage</h3>
          <p className="text-sm text-slate-600">Your current plan and resource usage</p>
        </div>
        <span
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ${
            isFree
              ? 'bg-slate-100 text-slate-700'
              : tier === 'team'
                ? 'bg-sapphire-100 text-sapphire-800'
                : 'bg-purple-100 text-purple-800'
          }`}
        >
          <CreditCard className="h-4 w-4" aria-hidden="true" />
          {tierName}
          {price > 0 && <span className="text-xs opacity-75">${price}/mo</span>}
        </span>
      </div>

      <div className="space-y-4">
        <UsageBar label="Projects" result={limits.projects} />
        <UsageBar label="AI Generations (this period)" result={limits.ai_ideas} />
        <UsageBar label="Team Members" result={limits.users} />
      </div>

      <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 text-sm">
        <span className="text-slate-600">
          {isFree ? 'Free tier resets' : subscription.cancel_at_period_end ? 'Cancels' : 'Renews'} on{' '}
          <strong className="text-slate-900">
            {resetDate.toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </strong>
        </span>
        {isFree ? (
          <button
            type="button"
            onClick={handleCheckout}
            disabled={busy !== null}
            className="inline-flex items-center gap-2 rounded-lg bg-sapphire-600 px-4 py-2 text-sm font-medium text-white hover:bg-sapphire-700 disabled:opacity-50"
          >
            {busy === 'checkout' ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <TrendingUp className="h-4 w-4" aria-hidden="true" />
            )}
            <span>Upgrade</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handlePortal}
            disabled={busy !== null}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50"
          >
            {busy === 'portal' ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            )}
            <span>Manage Subscription</span>
          </button>
        )}
      </div>

      {actionError && (
        <div role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {actionError}
        </div>
      )}
    </div>
  )
}

export default SubscriptionPanel
