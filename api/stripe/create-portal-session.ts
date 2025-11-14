import type { VercelRequest, VercelResponse } from '@vercel/node'
import { withAuth, type AuthenticatedRequest } from '../_lib/middleware/withAuth'
import { stripeService } from '../../src/lib/services/stripeService'
import { subscriptionService } from '../../src/lib/services/subscriptionService'

/**
 * POST /api/stripe/create-portal-session
 *
 * Create a Stripe Customer Portal session for subscription management
 *
 * The Customer Portal allows users to:
 * - View subscription details
 * - Update payment methods
 * - View invoices and payment history
 * - Cancel subscription
 * - Reactivate canceled subscription
 *
 * Returns:
 * - url: Stripe Customer Portal URL to redirect user to
 */
async function handler(req: AuthenticatedRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const userId = req.user!.id

    // Get user's Stripe customer ID
    const customerId = await subscriptionService.getStripeCustomerId(userId)

    if (!customerId) {
      return res.status(400).json({
        error: 'No active subscription found',
      })
    }

    // Get origin for return URL
    const origin = req.headers.origin || 'http://localhost:3000'

    // Create portal session
    const session = await stripeService.createPortalSession({
      customerId,
      returnUrl: `${origin}/subscription`,
    })

    return res.status(200).json({
      url: session.url,
    })
  } catch (error) {
    console.error('Error in create-portal-session:', error)
    return res.status(500).json({
      error: 'Failed to create portal session',
    })
  }
}

export default withAuth(handler)
