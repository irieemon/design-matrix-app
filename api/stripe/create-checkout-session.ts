import type { VercelRequest, VercelResponse } from '@vercel/node'
import { withAuth, type AuthenticatedRequest } from '../_lib/middleware/withAuth'
import { stripeService } from '../../src/lib/services/stripeService'

/**
 * POST /api/stripe/create-checkout-session
 *
 * Create a Stripe Checkout session for subscription purchase
 *
 * Body:
 * - priceId: Stripe Price ID (e.g., price_xxx from Stripe Dashboard)
 * - tier: Subscription tier ('team' or 'enterprise')
 *
 * Returns:
 * - sessionId: Checkout session ID
 * - url: Stripe Checkout page URL to redirect user to
 */
async function handler(req: AuthenticatedRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { priceId, tier } = req.body
    const userId = req.user!.id
    const userEmail = req.user!.email

    // Validate required fields
    if (!priceId || !tier) {
      return res.status(400).json({
        error: 'Missing required fields: priceId, tier',
      })
    }

    // Validate tier
    if (!['team', 'enterprise'].includes(tier)) {
      return res.status(400).json({
        error: 'Invalid tier. Must be team or enterprise',
      })
    }

    // Get origin for redirect URLs
    const origin = req.headers.origin || 'http://localhost:3000'

    // Create checkout session
    const session = await stripeService.createCheckoutSession({
      userId,
      userEmail,
      priceId,
      tier,
      successUrl: `${origin}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}/pricing?canceled=true`,
    })

    return res.status(200).json({
      sessionId: session.id,
      url: session.url,
    })
  } catch (error) {
    console.error('Error in create-checkout-session:', error)
    return res.status(500).json({
      error: 'Failed to create checkout session',
    })
  }
}

export default withAuth(handler)
