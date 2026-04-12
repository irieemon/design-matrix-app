/**
 * Consolidated Stripe API Routes
 *
 * Consolidates Stripe checkout and portal routes into a single serverless function:
 * - POST /api/stripe?action=checkout - Create checkout session
 * - POST /api/stripe?action=portal - Create customer portal session
 */

import type { VercelResponse } from '@vercel/node'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { withAuth, withRateLimit, compose, type AuthenticatedRequest } from './_lib/middleware/index.js'
import { stripeService } from './_lib/services/stripeService.js'
import { getStripeCustomerId } from './_lib/services/subscriptionService.js'

/**
 * Service-role Supabase client for subscription row read/write in this
 * handler. Required because the default subscriptionService client is the
 * anon singleton which fails RLS select/insert on `subscriptions` from a
 * Node context (no auth.uid()).
 */
function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!url || !key) throw new Error('Missing Supabase service-role configuration')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

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

    // Create checkout session (pass admin client to bypass RLS on
    // subscriptions read/insert from Node context)
    const admin = getSupabaseAdmin()
    const session = await stripeService.createCheckoutSession(
      {
        userId,
        userEmail,
        priceId,
        tier,
        successUrl: `${origin}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${origin}/pricing?canceled=true`,
      },
      admin
    )

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

    // Get user's Stripe customer ID (pass admin client to bypass RLS)
    const admin = getSupabaseAdmin()
    const customerId = await getStripeCustomerId(userId, admin)

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

// Apply rate limiting and authentication middleware (no CSRF — Stripe webhooks use their own signature)
export default compose(
  withRateLimit({
    windowMs: 15 * 60 * 1000,
    maxRequests: 100
  }),
  withAuth
)(stripeRouter)
