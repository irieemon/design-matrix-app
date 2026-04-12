/**
 * Backend Stripe Service
 *
 * Node-safe wrapper around the Stripe SDK for use in Vercel serverless
 * functions. Uses process.env exclusively — no import.meta.env, no frontend
 * module imports.
 *
 * Replaces the frontend src/lib/services/stripeService.ts cross-import that
 * was introduced before the backend/frontend split was enforced (PROD-BUG-01
 * post-mortem, Phase 11.7).
 */

import Stripe from 'stripe'
import { getStripeCustomerId, saveStripeCustomerId } from './subscriptionService.js'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing STRIPE_SECRET_KEY environment variable')
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-02-24.acacia',
  typescript: true,
})

export interface CheckoutSessionParams {
  userId: string
  userEmail: string
  priceId: string
  tier: string
  successUrl: string
  cancelUrl: string
}

export interface PortalSessionParams {
  customerId: string
  returnUrl: string
}

export class StripeService {
  /**
   * Create a Stripe Checkout session for subscription purchase.
   *
   * Accepts an optional Supabase `client` so API route handlers can pass
   * a service-role admin client — the default (anon) singleton fails RLS
   * on subscriptions.select/insert when called from a Node context.
   */
  async createCheckoutSession(
    params: CheckoutSessionParams,
    client?: import('@supabase/supabase-js').SupabaseClient
  ): Promise<Stripe.Checkout.Session> {
    try {
      let customerId = await getStripeCustomerId(params.userId, client)

      if (!customerId) {
        const customer = await stripe.customers.create({
          email: params.userEmail,
          metadata: { user_id: params.userId },
        })
        customerId = customer.id
        await saveStripeCustomerId(params.userId, customerId, client)
      }

      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: customerId,
        line_items: [{ price: params.priceId, quantity: 1 }],
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
        metadata: {
          user_id: params.userId,
          tier: params.tier,
        },
        subscription_data: {
          metadata: {
            user_id: params.userId,
            tier: params.tier,
          },
        },
        billing_address_collection: 'required',
        allow_promotion_codes: true,
      })

      return session
    } catch (err) {
      console.error('Error creating checkout session:', err)
      throw new Error('Failed to create checkout session')
    }
  }

  /**
   * Create a Stripe Customer Portal session for subscription management.
   */
  async createPortalSession(params: PortalSessionParams): Promise<Stripe.BillingPortal.Session> {
    try {
      const session = await stripe.billingPortal.sessions.create({
        customer: params.customerId,
        return_url: params.returnUrl,
      })
      return session
    } catch (err) {
      console.error('Error creating portal session:', err)
      throw new Error('Failed to create portal session')
    }
  }

  /**
   * Construct and verify a webhook event from raw body and signature.
   * CRITICAL: Must be called with the raw request body, not parsed JSON.
   */
  constructWebhookEvent(rawBody: string | Buffer, signature: string): Stripe.Event {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
    if (!webhookSecret) {
      throw new Error('Missing STRIPE_WEBHOOK_SECRET environment variable')
    }
    try {
      return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
    } catch (err) {
      console.error('Webhook signature verification failed:', err)
      throw new Error('Invalid webhook signature')
    }
  }

  /**
   * Retrieve a Stripe subscription by ID.
   */
  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    try {
      return await stripe.subscriptions.retrieve(subscriptionId)
    } catch (err) {
      console.error('Error retrieving subscription:', err)
      throw err
    }
  }
}

export const stripeService = new StripeService()
