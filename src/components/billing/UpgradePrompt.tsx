/**
 * UpgradePrompt — inline call-to-action when a user hits a tier limit.
 *
 * Rendered at point-of-limit (create-project flow, AI generate button, etc.)
 * when backend returns a 402 quota_exceeded response or the client already
 * knows the limit has been reached via useSubscription.
 */

import React from 'react'
import { TrendingUp, AlertCircle } from 'lucide-react'

export type QuotaResource = 'projects' | 'ai_ideas' | 'users'

export interface UpgradePromptProps {
  resource: QuotaResource
  limit: number | null
  used: number
  compact?: boolean
  /** Optional override CTA target (defaults to /pricing) */
  ctaHref?: string
}

const RESOURCE_LABELS: Record<QuotaResource, { title: string; body: string; nextTier: string }> = {
  projects: {
    title: "You've reached your project limit",
    body: 'Upgrade to create more projects and unlock advanced roadmap tooling.',
    nextTier: 'Team',
  },
  ai_ideas: {
    title: "You've used all your AI generations this month",
    body: 'Upgrade for unlimited AI-powered idea generation.',
    nextTier: 'Team',
  },
  users: {
    title: "You've reached your team member limit",
    body: 'Upgrade to invite more collaborators.',
    nextTier: 'Team',
  },
}

export const UpgradePrompt: React.FC<UpgradePromptProps> = ({
  resource,
  limit,
  used,
  compact = false,
  ctaHref = '/pricing',
}) => {
  const { title, body, nextTier } = RESOURCE_LABELS[resource]
  const limitLabel = limit == null || limit === Infinity ? '∞' : String(limit)

  if (compact) {
    return (
      <div
        role="alert"
        className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm"
      >
        <AlertCircle className="h-4 w-4 text-amber-600" aria-hidden="true" />
        <span className="flex-1 text-amber-900">
          {title} ({used}/{limitLabel})
        </span>
        <a
          href={ctaHref}
          className="inline-flex items-center gap-1 rounded-md bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-700"
        >
          Upgrade
        </a>
      </div>
    )
  }

  return (
    <div
      role="alert"
      className="rounded-xl border border-amber-200 bg-amber-50 p-4"
      data-testid="upgrade-prompt"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-amber-100 p-2">
          <AlertCircle className="h-5 w-5 text-amber-600" aria-hidden="true" />
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-amber-900">{title}</h4>
          <p className="mt-1 text-sm text-amber-800">{body}</p>
          <p className="mt-2 text-xs text-amber-700">
            Used <strong>{used}</strong> of <strong>{limitLabel}</strong>
          </p>
          <a
            href={ctaHref}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
          >
            <TrendingUp className="h-4 w-4" aria-hidden="true" />
            <span>Upgrade to {nextTier}</span>
          </a>
        </div>
      </div>
    </div>
  )
}

export default UpgradePrompt
