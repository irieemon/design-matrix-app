import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, ArrowRight, Loader2 } from 'lucide-react'
import { useUser } from '../../contexts/UserContext'
import { subscriptionService } from '../../lib/services/subscriptionService'

export default function SubscriptionSuccessPage() {
  const navigate = useNavigate()
  const { currentUser } = useUser()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [subscription, setSubscription] = useState<any>(null)

  useEffect(() => {
    const verifySubscription = async () => {
      try {
        // Get session_id from URL
        const urlParams = new URLSearchParams(window.location.search)
        const sessionId = urlParams.get('session_id')

        if (!sessionId) {
          setError('No session ID found. Please contact support if you were charged.')
          setLoading(false)
          return
        }

        if (!currentUser) {
          setError('User not found. Please sign in again.')
          setLoading(false)
          return
        }

        // Verify the payment was successful by fetching the updated subscription
        // The Stripe webhook should have already updated the subscription
        // This is just to confirm and display the updated tier
        const updatedSubscription = await subscriptionService.getSubscription(currentUser.id)

        if (updatedSubscription) {
          setSubscription(updatedSubscription)
        } else {
          setError('Subscription not found. Please contact support.')
        }

        setLoading(false)
      } catch (err) {
        console.error('Error verifying subscription:', err)
        setError('Failed to verify subscription. Please contact support if you were charged.')
        setLoading(false)
      }
    }

    verifySubscription()
  }, [currentUser])

  const handleContinue = () => {
    navigate('/projects')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--canvas-primary)' }}>
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" style={{ color: 'var(--sapphire-500)' }} />
          <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--graphite-900)' }}>
            Processing Your Subscription
          </h2>
          <p style={{ color: 'var(--graphite-600)' }}>
            Please wait while we confirm your payment...
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: 'var(--canvas-primary)' }}>
        <div className="max-w-md w-full">
          <div
            className="rounded-xl p-8 text-center border-2"
            style={{
              backgroundColor: 'var(--ruby-50)',
              borderColor: 'var(--ruby-300)',
            }}
          >
            <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: 'var(--ruby-100)' }}>
              <span className="text-3xl">⚠️</span>
            </div>
            <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--ruby-900)' }}>
              Verification Issue
            </h2>
            <p className="mb-6" style={{ color: 'var(--ruby-800)' }}>
              {error}
            </p>
            <button
              onClick={() => navigate('/settings')}
              className="w-full py-3 px-6 rounded-lg font-semibold transition-all"
              style={{
                backgroundColor: 'var(--ruby-600)',
                color: 'white',
              }}
            >
              Go to Settings
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: 'var(--canvas-primary)' }}>
      <div className="max-w-2xl w-full">
        {/* Success Card */}
        <div
          className="rounded-xl p-8 text-center border-2"
          style={{
            backgroundColor: 'var(--canvas-secondary)',
            borderColor: 'var(--emerald-300)',
          }}
        >
          {/* Success Icon */}
          <div className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center" style={{ backgroundColor: 'var(--emerald-100)' }}>
            <Check className="w-12 h-12" style={{ color: 'var(--emerald-600)' }} />
          </div>

          {/* Heading */}
          <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--graphite-900)' }}>
            Welcome to {subscription?.tier === 'team' ? 'Team' : 'Enterprise'}!
          </h1>
          <p className="text-lg mb-8" style={{ color: 'var(--graphite-600)' }}>
            Your subscription has been activated successfully.
          </p>

          {/* Features Preview */}
          <div className="mb-8 text-left max-w-md mx-auto">
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--graphite-900)' }}>
              You now have access to:
            </h3>
            <div className="space-y-3">
              {subscription?.tier === 'team' ? (
                <>
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--emerald-600)' }} />
                    <span style={{ color: 'var(--graphite-700)' }}>10 projects with unlimited ideas</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--emerald-600)' }} />
                    <span style={{ color: 'var(--graphite-700)' }}>Unlimited AI idea generations</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--emerald-600)' }} />
                    <span style={{ color: 'var(--graphite-700)' }}>15 team members</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--emerald-600)' }} />
                    <span style={{ color: 'var(--graphite-700)' }}>Advanced roadmap features</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--emerald-600)' }} />
                    <span style={{ color: 'var(--graphite-700)' }}>All export formats (PDF, PPT, PNG, CSV)</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--emerald-600)' }} />
                    <span style={{ color: 'var(--graphite-700)' }}>Priority email support</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--emerald-600)' }} />
                    <span style={{ color: 'var(--graphite-700)' }}>Unlimited projects and AI generations</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--emerald-600)' }} />
                    <span style={{ color: 'var(--graphite-700)' }}>Unlimited team members</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--emerald-600)' }} />
                    <span style={{ color: 'var(--graphite-700)' }}>Custom roadmap templates</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--emerald-600)' }} />
                    <span style={{ color: 'var(--graphite-700)' }}>REST API access</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--emerald-600)' }} />
                    <span style={{ color: 'var(--graphite-700)' }}>SSO & SAML integration</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--emerald-600)' }} />
                    <span style={{ color: 'var(--graphite-700)' }}>24/7 priority support</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Next Steps */}
          <div className="mb-8">
            <p className="text-sm mb-4" style={{ color: 'var(--graphite-600)' }}>
              A confirmation email has been sent to your inbox.
            </p>
            <p className="text-sm" style={{ color: 'var(--graphite-600)' }}>
              You can manage your subscription anytime from your account settings.
            </p>
          </div>

          {/* CTA Button */}
          <button
            onClick={handleContinue}
            className="w-full py-4 px-6 rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
            style={{
              backgroundColor: 'var(--sapphire-600)',
              color: 'white',
            }}
          >
            Start Using Your New Features
            <ArrowRight className="w-5 h-5" />
          </button>

          {/* Secondary Actions */}
          <div className="mt-4 flex gap-4 justify-center">
            <button
              onClick={() => navigate('/settings')}
              className="text-sm py-2 px-4 rounded transition-all"
              style={{
                color: 'var(--sapphire-600)',
              }}
            >
              View Settings
            </button>
            <button
              onClick={() => navigate('/pricing')}
              className="text-sm py-2 px-4 rounded transition-all"
              style={{
                color: 'var(--graphite-600)',
              }}
            >
              View Pricing Plans
            </button>
          </div>
        </div>

        {/* Support Link */}
        <div className="text-center mt-6">
          <p className="text-sm" style={{ color: 'var(--graphite-600)' }}>
            Need help?{' '}
            <a
              href="mailto:support@prioritas.app"
              className="font-semibold"
              style={{ color: 'var(--sapphire-600)' }}
            >
              Contact Support
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
