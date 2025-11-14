import type { VercelRequest, VercelResponse } from '@vercel/node'
import type Stripe from 'stripe'
import { stripeService } from '../../src/lib/services/stripeService'
import { subscriptionService } from '../../src/lib/services/subscriptionService'
import type { SubscriptionTier } from '../../src/types/subscription'

/**
 * Read raw body from Vercel request
 */
async function getRawBody(req: any): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks)
}

/**
 * POST /api/stripe/webhook
 *
 * Handle Stripe webhook events for subscription lifecycle management
 *
 * Events handled:
 * - checkout.session.completed: New subscription created
 * - customer.subscription.updated: Subscription changed (upgrade/downgrade/renewal)
 * - customer.subscription.deleted: Subscription canceled
 * - invoice.payment_succeeded: Payment successful
 * - invoice.payment_failed: Payment failed
 *
 * CRITICAL SECURITY:
 * - Verifies webhook signature using STRIPE_WEBHOOK_SECRET
 * - Uses raw request body (not parsed JSON)
 * - Rejects requests with invalid signatures
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
    // Get raw body and signature
    const rawBody = await getRawBody(req)
    const signature = req.headers['stripe-signature'] as string

    if (!signature) {
      console.error('Missing stripe-signature header')
      return res.status(400).json({ error: 'Missing signature' })
    }

    // Verify webhook signature (CRITICAL SECURITY)
    let event: Stripe.Event
    try {
      event = stripeService.constructWebhookEvent(rawBody, signature)
    } catch (error) {
      console.error('Webhook signature verification failed:', error)
      return res.status(400).json({ error: 'Invalid signature' })
    }

    console.log('Webhook event received:', event.type, event.id)

    // Handle different event types
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
        await handlePaymentFailed(event.data.object as Stripe.Invoice)
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
 * Creates or updates subscription with active status
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

    // Retrieve full subscription details from Stripe
    const subscription = await stripeService.getSubscription(subscriptionId)

    // Update database with new subscription
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
 * Updates subscription tier, billing period, cancellation status
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  try {
    const userId = subscription.metadata?.user_id
    const tier = subscription.metadata?.tier as SubscriptionTier

    if (!userId) {
      console.error('Missing user_id in subscription metadata:', subscription.id)
      return
    }

    // Map Stripe status to our status
    let status: 'active' | 'canceled' | 'past_due' = 'active'
    if (subscription.status === 'canceled' || subscription.status === 'incomplete_expired') {
      status = 'canceled'
    } else if (subscription.status === 'past_due' || subscription.status === 'unpaid') {
      status = 'past_due'
    }

    // Update database
    await subscriptionService.updateSubscription(userId, {
      tier: tier || 'free', // Fallback to free if no tier in metadata
      status,
      current_period_start: new Date(subscription.current_period_start * 1000),
      current_period_end: new Date(subscription.current_period_end * 1000),
      cancel_at_period_end: subscription.cancel_at_period_end,
    })

    console.log(`Subscription updated for user ${userId}: ${status}`)
  } catch (error) {
    console.error('Error handling subscription updated:', error)
    throw error
  }
}

/**
 * Handle subscription deletion/cancellation
 * Downgrades user to free tier
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  try {
    const userId = subscription.metadata?.user_id

    if (!userId) {
      console.error('Missing user_id in subscription metadata:', subscription.id)
      return
    }

    // Downgrade to free tier
    await subscriptionService.updateSubscription(userId, {
      tier: 'free',
      status: 'canceled',
      cancel_at_period_end: false,
    })

    console.log(`Subscription canceled for user ${userId}, downgraded to free`)
  } catch (error) {
    console.error('Error handling subscription deleted:', error)
    throw error
  }
}

/**
 * Handle successful payment
 * Ensures subscription remains active after renewal
 */
async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  try {
    const subscriptionId = invoice.subscription as string

    if (!subscriptionId) {
      // Not a subscription invoice
      return
    }

    // Retrieve subscription to get user info
    const subscription = await stripeService.getSubscription(subscriptionId)
    const userId = subscription.metadata?.user_id

    if (!userId) {
      console.error('Missing user_id in subscription metadata:', subscriptionId)
      return
    }

    // Ensure subscription is active after successful payment
    await subscriptionService.updateSubscription(userId, {
      status: 'active',
      current_period_start: new Date(subscription.current_period_start * 1000),
      current_period_end: new Date(subscription.current_period_end * 1000),
    })

    console.log(`Payment succeeded for user ${userId}, subscription renewed`)
  } catch (error) {
    console.error('Error handling payment succeeded:', error)
    throw error
  }
}

/**
 * Handle failed payment
 * Marks subscription as past_due
 */
async function handlePaymentFailed(invoice: Stripe.Invoice) {
  try {
    const subscriptionId = invoice.subscription as string

    if (!subscriptionId) {
      // Not a subscription invoice
      return
    }

    // Retrieve subscription to get user info
    const subscription = await stripeService.getSubscription(subscriptionId)
    const userId = subscription.metadata?.user_id

    if (!userId) {
      console.error('Missing user_id in subscription metadata:', subscriptionId)
      return
    }

    // Mark subscription as past_due
    await subscriptionService.updateSubscription(userId, {
      status: 'past_due',
    })

    console.log(`Payment failed for user ${userId}, subscription marked past_due`)
  } catch (error) {
    console.error('Error handling payment failed:', error)
    throw error
  }
}
