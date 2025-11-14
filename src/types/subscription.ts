/**
 * Subscription and Usage Tracking Types
 *
 * Type definitions for subscription management and usage tracking
 */

import type { SubscriptionTier, SubscriptionStatus } from '../lib/config/tierLimits';

export type { SubscriptionTier, SubscriptionStatus };

/**
 * Subscription record from database
 */
export interface Subscription {
  id: string;
  user_id: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Resource types that can be tracked
 */
export type ResourceType = 'ai_idea' | 'project' | 'export' | 'api_call';

/**
 * Usage tracking record from database
 */
export interface UsageTracking {
  id: string;
  user_id: string;
  resource_type: ResourceType;
  count: number;
  period_start: string;
  period_end: string;
  created_at: string;
  updated_at: string;
}

/**
 * Usage limit check result
 */
export interface LimitCheckResult {
  canUse: boolean;
  current: number;
  limit: number;
  isUnlimited: boolean;
  percentageUsed: number;
}

/**
 * Subscription with usage limits
 */
export interface SubscriptionWithLimits extends Subscription {
  limits: {
    projects: LimitCheckResult;
    ai_ideas: LimitCheckResult;
    users: LimitCheckResult;
  };
}

/**
 * Stripe checkout session creation params
 */
export interface CheckoutSessionParams {
  userId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
}

/**
 * Stripe checkout session response
 */
export interface CheckoutSessionResponse {
  sessionId: string;
  sessionUrl: string;
}

/**
 * Stripe customer portal session response
 */
export interface CustomerPortalSessionResponse {
  url: string;
}

/**
 * Subscription update params (for webhooks)
 */
export interface SubscriptionUpdateParams {
  tier?: SubscriptionTier;
  status?: SubscriptionStatus;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  current_period_start?: Date;
  current_period_end?: Date;
  cancel_at_period_end?: boolean;
}

/**
 * Usage tracking upsert params
 */
export interface UsageTrackingUpsertParams {
  user_id: string;
  resource_type: ResourceType;
  period_start: Date;
  period_end: Date;
  increment?: number;
}
