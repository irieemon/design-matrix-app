import type { VercelRequest, VercelResponse } from '@vercel/node'
import type Stripe from 'stripe'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { stripeService } from '../../src/lib/services/stripeService'
import { subscriptionService } from '../../src/lib/services/subscriptionService'
import type { SubscriptionTier, SubscriptionUpdateParams } from '../../src/types/subscription'

/**
 * Read raw body from Vercel request.
 *
 * In production (Vercel), bodyParser is disabled and the request stream
 * is intact — read it via async iteration.
 * In dev (vite.config.ts middleware), the stream has already been drained
 * to parse `req.body`, but the middleware stashes the original bytes on
 * `req.rawBody` — prefer that when present.
 */
async function getRawBody(req: any): Promise<Buffer> {
  if (req.rawBody && Buffer.isBuffer(req.rawBody)) {
    return req.rawBody
  }
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks)
}

function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!url || !key) throw new Error('Missing Supabase service-role configuration')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

/**
 * POST /api/stripe/webhook
 *
 * Handle Stripe webhook events for subscription lifecycle management.
 *
 * Phase 06-03 additions:
 *  - Idempotency via `stripe_webhook_events` (unique event_id) — duplicate
 *    deliveries short-circuit with `{ duplicate: true }` BEFORE any handler runs
 *  - invoice.payment_failed writes a `user_notifications` row (BILL-02)
 *  - invoice.payment_failed sets `past_due_since` (D-17 grace anchor)
 *  - customer.subscription.updated back to active clears `past_due_since`
 *
 * CRITICAL SECURITY:
 *  - Verifies webhook signature using STRIPE_WEBHOOK_SECRET
 *  - Uses raw request body (not parsed JSON)
 *  - Rejects requests with invalid signatures
 */

// Disable Next.js body parsing to get raw body for signature verification
export const config = {
  api: {
    bodyParser: false,
  },
}

export default async function webhook(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const rawBody = await getRawBody(req)
    const signature = req.headers['stripe-signature'] as string

    if (!signature) {
      console.error('Missing stripe-signature header')
      return res.status(400).json({ error: 'Missing signature' })
    }

    let event: Stripe.Event
    try {
      event = stripeService.constructWebhookEvent(rawBody, signature)
    } catch (error) {
      console.error('Webhook signature verification failed:', error)
      return res.status(400).json({ error: 'Invalid signature' })
    }

    console.log('Webhook event received:', event.type, event.id)

    // --- Idempotency guard (Phase 06-03) ------------------------------------
    // Dedupe before dispatching. Unique constraint on event_id makes this atomic.
    const admin = getSupabaseAdmin()
    const { error: dedupErr } = await admin
      .from('stripe_webhook_events')
      .insert({ event_id: event.id, event_type: event.type })

    if (dedupErr) {
      if ((dedupErr as { code?: string }).code === '23505') {
        console.log('[webhook] duplicate event, skipping:', event.id)
        return res.status(200).json({ received: true, duplicate: true })
      }
      console.error('[webhook] dedup insert failed:', dedupErr)
      return res.status(500).json({ error: 'Dedup check failed' })
    }

    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
        break

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice)
        break

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice, admin)
        break

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return res.status(200).json({ received: true })
  } catch (error) {
    console.error('Error processing webhook:', error)
    return res.status(500).json({ error: 'Webhook processing failed' })
  }
}

/**
 * Handle successful checkout session completion
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  try {
    const userId = session.metadata?.user_id
    const tier = session.metadata?.tier as SubscriptionTier
    const subscriptionId = session.subscription as string

    if (!userId || !tier) {
      console.error('Missing metadata in checkout session:', session.id)
      return
    }

    const subscription = await stripeService.getSubscription(subscriptionId)

    await subscriptionService.updateSubscription(userId, {
      tier,
      status: 'active',
      stripe_subscription_id: subscriptionId,
      stripe_customer_id: session.customer as string,
      current_period_start: new Date(subscription.current_period_start * 1000),
      current_period_end: new Date(subscription.current_period_end * 1000),
      cancel_at_period_end: false,
    })

    console.log(`Subscription activated for user ${userId}: ${tier}`)
  } catch (error) {
    console.error('Error handling checkout completed:', error)
    throw error
  }
}

/**
 * Handle subscription update events
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  try {
    const userId = subscription.metadata?.user_id
    const tier = subscription.metadata?.tier as SubscriptionTier

    if (!userId) {
      console.error('Missing user_id in subscription metadata:', subscription.id)
      return
    }

    let status: 'active' | 'canceled' | 'past_due' = 'active'
    if (subscription.status === 'canceled' || subscription.status === 'incomplete_expired') {
      status = 'canceled'
    } else if (subscription.status === 'past_due' || subscription.status === 'unpaid') {
      status = 'past_due'
    }

    const updates: SubscriptionUpdateParams = {
      tier: tier || 'free',
      status,
      current_period_start: new Date(subscription.current_period_start * 1000),
      current_period_end: new Date(subscription.current_period_end * 1000),
      cancel_at_period_end: subscription.cancel_at_period_end,
    }

    // D-17: back-to-active clears the grace anchor
    if (status === 'active') {
      updates.past_due_since = null
    }

    await subscriptionService.updateSubscription(userId, updates)

    console.log(`Subscription updated for user ${userId}: ${status}`)
  } catch (error) {
    console.error('Error handling subscription updated:', error)
    throw error
  }
}

/**
 * Handle subscription deletion/cancellation
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  try {
    const userId = subscription.metadata?.user_id

    if (!userId) {
      console.error('Missing user_id in subscription metadata:', subscription.id)
      return
    }

    await subscriptionService.updateSubscription(userId, {
      tier: 'free',
      status: 'canceled',
      cancel_at_period_end: false,
      past_due_since: null,
    })

    console.log(`Subscription canceled for user ${userId}, downgraded to free`)
  } catch (error) {
    console.error('Error handling subscription deleted:', error)
    throw error
  }
}

/**
 * Handle successful payment
 */
async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  try {
    const subscriptionId = invoice.subscription as string
    if (!subscriptionId) return

    const subscription = await stripeService.getSubscription(subscriptionId)
    const userId = subscription.metadata?.user_id

    if (!userId) {
      console.error('Missing user_id in subscription metadata:', subscriptionId)
      return
    }

    await subscriptionService.updateSubscription(userId, {
      status: 'active',
      current_period_start: new Date(subscription.current_period_start * 1000),
      current_period_end: new Date(subscription.current_period_end * 1000),
      past_due_since: null,
    })

    console.log(`Payment succeeded for user ${userId}, subscription renewed`)
  } catch (error) {
    console.error('Error handling payment succeeded:', error)
    throw error
  }
}

/**
 * Handle failed payment — sets past_due + grace anchor + notifies user (BILL-02)
 *
 * Stripe itself fires `customer.subscription.deleted` after the dunning /
 * grace period expires, which downgrades the user to free via
 * handleSubscriptionDeleted above. We just anchor the clock here.
 */
async function handlePaymentFailed(invoice: Stripe.Invoice, admin: SupabaseClient) {
  try {
    const subscriptionId = invoice.subscription as string
    if (!subscriptionId) return

    const subscription = await stripeService.getSubscription(subscriptionId)
    const userId = subscription.metadata?.user_id

    if (!userId) {
      console.error('Missing user_id in subscription metadata:', subscriptionId)
      return
    }

    // Mark past_due with grace anchor (D-17)
    await subscriptionService.updateSubscription(userId, {
      status: 'past_due',
      past_due_since: new Date(),
    })

    // BILL-02: insert user_notifications row
    const amountCents = (invoice.amount_due ?? 0) as number
    const amount = (amountCents / 100).toFixed(2)
    const currency = (invoice.currency ?? 'usd').toUpperCase()
    const { error: notifErr } = await admin.from('user_notifications').insert({
      user_id: userId,
      type: 'payment_failed',
      message: `Your payment of ${currency} ${amount} failed. Please update your payment method to keep your subscription active.`,
      metadata: { invoice_id: invoice.id, amount_cents: amountCents, currency },
    })
    if (notifErr) {
      // Do not throw — the subscription status update already succeeded.
      console.error('[webhook] user_notifications insert failed:', notifErr)
    }

    console.log(`Payment failed for user ${userId}, subscription marked past_due`)
  } catch (error) {
    console.error('Error handling payment failed:', error)
    throw error
  }
}
