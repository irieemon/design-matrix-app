import Stripe from 'stripe'
import { subscriptionService } from './subscriptionService'
import type { SubscriptionTier } from '../../types/subscription'

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
  tier: SubscriptionTier
  successUrl: string
  cancelUrl: string
}

export interface PortalSessionParams {
  customerId: string
  returnUrl: string
}

export class StripeService {
  /**
   * Create a Stripe Checkout session for subscription purchase
   */
  async createCheckoutSession(params: CheckoutSessionParams): Promise<Stripe.Checkout.Session> {
    try {
      // Check if user already has a Stripe customer ID
      let customerId = await subscriptionService.getStripeCustomerId(params.userId)

      // Create new customer if doesn't exist
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: params.userEmail,
          metadata: {
            user_id: params.userId,
          },
        })
        customerId = customer.id

        // Save customer ID to database
        await subscriptionService.saveStripeCustomerId(params.userId, customerId)
      }

      // Create checkout session
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: customerId,
        line_items: [
          {
            price: params.priceId,
            quantity: 1,
          },
        ],
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
    } catch (_error) {
      console.error('Error creating checkout session:', error)
      throw new Error('Failed to create checkout session')
    }
  }

  /**
   * Create a Stripe Customer Portal session for subscription management
   */
  async createPortalSession(params: PortalSessionParams): Promise<Stripe.BillingPortal.Session> {
    try {
      const session = await stripe.billingPortal.sessions.create({
        customer: params.customerId,
        return_url: params.returnUrl,
      })

      return session
    } catch (_error) {
      console.error('Error creating portal session:', error)
      throw new Error('Failed to create portal session')
    }
  }

  /**
   * Construct and verify webhook event from raw body and signature
   * CRITICAL: This must be called with the raw request body, not parsed JSON
   */
  constructWebhookEvent(rawBody: string | Buffer, signature: string): Stripe.Event {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

    if (!webhookSecret) {
      throw new Error('Missing STRIPE_WEBHOOK_SECRET environment variable')
    }

    try {
      const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
      return event
    } catch (_error) {
      console.error('Webhook signature verification failed:', error)
      throw new Error('Invalid webhook signature')
    }
  }

  /**
   * Retrieve a subscription by ID
   */
  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId)
      return subscription
    } catch (_error) {
      console.error('Error retrieving subscription:', error)
      throw new Error('Failed to retrieve subscription')
    }
  }

  /**
   * Cancel a subscription at period end
   */
  async cancelSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    try {
      const subscription = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      })
      return subscription
    } catch (_error) {
      console.error('Error canceling subscription:', error)
      throw new Error('Failed to cancel subscription')
    }
  }

  /**
   * Reactivate a canceled subscription
   */
  async reactivateSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    try {
      const subscription = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: false,
      })
      return subscription
    } catch (_error) {
      console.error('Error reactivating subscription:', error)
      throw new Error('Failed to reactivate subscription')
    }
  }
}

export const stripeService = new StripeService()
