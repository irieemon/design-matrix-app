import { useState } from 'react'
import { Check, X } from 'lucide-react'
import { useUser } from '../../contexts/UserContext'
import { subscriptionService } from '../../lib/services/subscriptionService'
// supabase import removed - not used in this file
import { SUPABASE_STORAGE_KEY } from '../../lib/config'
import type { SubscriptionTier } from '../../types/subscription'
import { logger } from '../../utils/logger'

interface PricingTier {
  name: string
  tier: SubscriptionTier
  price: string
  period: string
  description: string
  features: string[]
  notIncluded?: string[]
  highlighted?: boolean
  priceId?: string
  cta: string
}

const pricingTiers: PricingTier[] = [
  {
    name: 'Free',
    tier: 'free',
    price: '$0',
    period: 'forever',
    description: 'Perfect for individuals getting started',
    cta: 'Current Plan',
    features: [
      '1 project',
      '5 AI idea generations per month',
      '3 team members',
      'Basic roadmap view',
      'Basic insights',
      'File attachments',
      'PNG & CSV exports',
    ],
    notIncluded: [
      'No priority support',
      'No PDF/PowerPoint exports',
      'No API access',
      'No SSO',
    ],
  },
  {
    name: 'Team',
    tier: 'team',
    price: '$29',
    period: 'per month',
    description: 'For growing teams and serious projects',
    highlighted: true,
    priceId: import.meta.env.VITE_STRIPE_PRICE_ID_TEAM,
    cta: 'Upgrade to Team',
    features: [
      '10 projects',
      'Unlimited AI idea generations',
      '15 team members',
      'Advanced roadmap features',
      'Advanced insights & analytics',
      'Priority file storage',
      'All export formats (PDF, PPT, PNG, CSV)',
      'Priority email support',
    ],
  },
  {
    name: 'Enterprise',
    tier: 'enterprise',
    price: 'Custom',
    period: 'contact sales',
    description: 'For organizations with advanced needs',
    priceId: import.meta.env.VITE_STRIPE_PRICE_ID_ENTERPRISE,
    cta: 'Contact Sales',
    features: [
      'Unlimited projects',
      'Unlimited AI idea generations',
      'Unlimited team members',
      'Custom roadmap templates',
      'Advanced analytics & reporting',
      'Dedicated account manager',
      'All export formats',
      'REST API access',
      'SSO & SAML integration',
      'Custom white-labeling',
      '24/7 priority support',
      'SLA guarantees',
    ],
  },
]

export default function PricingPage() {
  const { currentUser } = useUser()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [currentTier, setCurrentTier] = useState<SubscriptionTier>('free')

  // Load current subscription tier
  useState(() => {
    if (currentUser) {
      subscriptionService.getSubscription(currentUser.id).then((sub) => {
        if (sub) {
          setCurrentTier(sub.tier)
        }
      })
    }
  })

  const handleUpgrade = async (tier: PricingTier) => {
    logger.debug('🔵 handleUpgrade called for tier:', tier.tier)
    
    if (!currentUser) {
      setError('Please sign in to upgrade')
      return
    }

    if (tier.tier === 'free') {
      return // Already on free plan or downgrade not implemented yet
    }

    if (tier.tier === 'enterprise') {
      // For enterprise, open email client
      window.location.href = 'mailto:sales@prioritas.ai?subject=Enterprise Plan Inquiry'
      return
    }

    // Handle Team tier upgrade with Stripe
    if (!tier.priceId) {
      setError('Stripe configuration missing. Please contact support.')
      return
    }

    setLoading(tier.tier)
    setError(null)

    try {
      logger.debug('🔵 Reading session from localStorage...')

      // CRITICAL FIX: Read session synchronously from localStorage
      // This bypasses the async getSession() call which can timeout
      // Same pattern used in ProjectRepository, RoadmapRepository, InsightsRepository
      const stored = localStorage.getItem(SUPABASE_STORAGE_KEY)

      if (!stored) {
        console.warn('⚠️ No session in localStorage')
        setError('Authentication required. Please sign in again.')
        setLoading(null)
        return
      }

      let session: any
      try {
        session = JSON.parse(stored)
      } catch (parseError) {
        console.error('🔴 Failed to parse session:', parseError)
        setError('Invalid session data. Please sign in again.')
        setLoading(null)
        return
      }

      if (!session.access_token || !session.user) {
        console.warn('⚠️ Invalid session structure:', {
          hasToken: !!session.access_token,
          hasUser: !!session.user
        })
        setError('Invalid session. Please sign in again.')
        setLoading(null)
        return
      }

      logger.debug('🔵 Session retrieved synchronously:', {
        hasToken: true,
        userId: session.user.id
      })

      logger.debug('🔵 Making API request to create checkout session...')
      const response = await fetch('/api/stripe?action=checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          priceId: tier.priceId,
          tier: tier.tier,
        }),
      })

      logger.debug('🔵 API response status:', response.status)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        console.error('🔴 API error:', errorData)
        throw new Error(`Failed to create checkout session: ${errorData.error || response.statusText}`)
      }

      const { url } = await response.json()
      logger.debug('🔵 Redirecting to Stripe Checkout:', url)

      // Redirect to Stripe Checkout
      window.location.href = url
    } catch (err) {
      console.error('🔴 Upgrade error:', err)
      setError(`Failed to start upgrade process: ${err instanceof Error ? err.message : 'Unknown error'}`)
      setLoading(null)
    }
  }

  return (
    <div className="min-h-screen py-12 px-4 bg-canvas-primary">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold mb-4 text-graphite-900">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-graphite-600">
            Choose the plan that fits your needs. Upgrade or downgrade anytime.
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div
            className="max-w-2xl mx-auto mb-8 p-4 rounded-lg border bg-error-50 border-error-300 text-error-900"
          >
            {error}
          </div>
        )}

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {pricingTiers.map((tier) => {
            const isCurrentPlan = tier.tier === currentTier
            const isHighlighted = tier.highlighted

            return (
              <div
                key={tier.tier}
                className={`rounded-xl border-2 p-8 transition-all ${
                  isHighlighted ? 'transform scale-105 bg-info-50 border-info-500' : 'bg-canvas-secondary border-graphite-200'
                }`}
              >
                {/* Tier Name */}
                <div className="mb-4">
                  <h3 className="text-2xl font-bold text-graphite-900">
                    {tier.name}
                  </h3>
                  <p className="text-sm mt-2 text-graphite-600">
                    {tier.description}
                  </p>
                </div>

                {/* Price */}
                <div className="mb-6">
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold text-graphite-900">
                      {tier.price}
                    </span>
                    <span className="text-lg text-graphite-600">
                      {tier.period}
                    </span>
                  </div>
                </div>

                {/* CTA Button */}
                <button
                  onClick={() => handleUpgrade(tier)}
                  disabled={isCurrentPlan || loading === tier.tier}
                  className={`w-full py-3 px-6 rounded-lg font-semibold transition-all mb-8 disabled:opacity-50 disabled:cursor-not-allowed text-white ${
                    isHighlighted
                      ? 'bg-info-600'
                      : isCurrentPlan
                      ? 'bg-graphite-300'
                      : 'bg-graphite-800'
                  }`}
                >
                  {loading === tier.tier
                    ? 'Processing...'
                    : isCurrentPlan
                    ? 'Current Plan'
                    : tier.cta}
                </button>

                {/* Features List */}
                <div className="space-y-3">
                  {tier.features.map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      <Check
                        className="w-5 h-5 flex-shrink-0 mt-0.5 text-success-600"
                      />
                      <span className="text-graphite-700">{feature}</span>
                    </div>
                  ))}

                  {tier.notIncluded?.map((feature, idx) => (
                    <div key={`not-${idx}`} className="flex items-start gap-3 opacity-60">
                      <X
                        className="w-5 h-5 flex-shrink-0 mt-0.5 text-graphite-400"
                      />
                      <span className="text-graphite-600">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-8 text-graphite-900">
            Frequently Asked Questions
          </h2>

          <div className="space-y-6">
            <div className="p-6 rounded-lg bg-canvas-secondary">
              <h3 className="text-lg font-semibold mb-2 text-graphite-900">
                Can I upgrade or downgrade anytime?
              </h3>
              <p className="text-graphite-600">
                Yes! You can upgrade or downgrade your plan at any time. Upgrades take effect immediately,
                and downgrades take effect at the end of your current billing period.
              </p>
            </div>

            <div className="p-6 rounded-lg bg-canvas-secondary">
              <h3 className="text-lg font-semibold mb-2 text-graphite-900">
                What happens if I hit my project or AI limit?
              </h3>
              <p className="text-graphite-600">
                You'll see a friendly prompt to upgrade your plan. Your existing projects and ideas remain
                fully accessible - you just won't be able to create new ones until you upgrade or your
                monthly limit resets.
              </p>
            </div>

            <div className="p-6 rounded-lg bg-canvas-secondary">
              <h3 className="text-lg font-semibold mb-2 text-graphite-900">
                Is my payment information secure?
              </h3>
              <p className="text-graphite-600">
                Absolutely. All payments are processed through Stripe, a PCI-compliant payment processor
                trusted by millions of businesses. We never store your credit card information on our servers.
              </p>
            </div>

            <div className="p-6 rounded-lg bg-canvas-secondary">
              <h3 className="text-lg font-semibold mb-2 text-graphite-900">
                Can I cancel my subscription?
              </h3>
              <p className="text-graphite-600">
                Yes, you can cancel anytime from your account settings. You'll retain access to paid features
                until the end of your current billing period, then automatically downgrade to the free plan.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-16">
          <p className="text-lg mb-4 text-graphite-600">
            Need help choosing the right plan?
          </p>
          <a
            href="mailto:support@prioritas.ai"
            className="inline-block py-3 px-8 rounded-lg font-semibold transition-all bg-graphite-800 text-white"
          >
            Contact Support
          </a>
        </div>
      </div>
    </div>
  )
}
