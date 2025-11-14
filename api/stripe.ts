/**
 * Consolidated Stripe API Routes
 *
 * Consolidates Stripe checkout and portal routes into a single serverless function:
 * - POST /api/stripe?action=checkout - Create checkout session
 * - POST /api/stripe?action=portal - Create customer portal session
 */

import type { VercelResponse } from '@vercel/node'
import { withAuth, type AuthenticatedRequest } from './_lib/middleware/withAuth'
import { stripeService } from '../src/lib/services/stripeService'
import { subscriptionService } from '../src/lib/services/subscriptionService'

// ============================================================================
// CREATE CHECKOUT SESSION HANDLER
// ============================================================================

async function handleCreateCheckout(req: AuthenticatedRequest, res: VercelResponse) {
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

// ============================================================================
// CREATE PORTAL SESSION HANDLER
// ============================================================================

async function handleCreatePortal(req: AuthenticatedRequest, res: VercelResponse) {
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

// ============================================================================
// MAIN ROUTER
// ============================================================================

async function stripeRouter(req: AuthenticatedRequest, res: VercelResponse) {
  // Only POST method allowed
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
      allowed: ['POST'],
    })
  }

  // Extract action from query parameter
  const action = (req.query.action as string) || ''

  // Route based on action
  switch (action) {
    case 'checkout':
      return handleCreateCheckout(req, res)

    case 'portal':
      return handleCreatePortal(req, res)

    default:
      return res.status(404).json({
        error: 'Not found',
        code: 'INVALID_ACTION',
        validActions: ['checkout', 'portal'],
      })
  }
}

// Apply authentication middleware
export default withAuth(stripeRouter)
