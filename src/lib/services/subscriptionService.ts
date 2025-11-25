/**
 * Subscription Service
 *
 * Handles subscription management, tier checking, and limit enforcement
 */

import { supabase, createAuthenticatedClientFromLocalStorage } from '../supabase';
import { getLimit, isUnlimited, type SubscriptionTier } from '../config/tierLimits';
import type {
  Subscription,
  SubscriptionUpdateParams,
  LimitCheckResult,
  SubscriptionWithLimits
} from '../../types/subscription';
import { logger } from '../../utils/logger';

export class SubscriptionService {
  /**
   * Get appropriate Supabase client based on environment
   * - Browser: authenticated client from localStorage (avoids getSession timeout)
   * - Server (Node.js): service role client
   */
  private getClient() {
    const isBrowser = typeof window !== 'undefined' && typeof localStorage !== 'undefined';
    return isBrowser ? createAuthenticatedClientFromLocalStorage() : supabase;
  }

  /**
   * Get user's subscription
   *
   * CRITICAL FIX: Uses authenticated client from localStorage to avoid getSession() timeout
   * IMPORTANT: On server side (Node.js), uses regular supabase client with service role
   * Same pattern as ProjectRepository, RoadmapRepository, InsightsRepository
   */
  async getSubscription(userId: string): Promise<Subscription | null> {
    try {
      const client = this.getClient();
      if (!client) {
        throw new Error('Failed to initialize Supabase client');
      }

      const { data, error} = await client
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        // If no subscription exists, create a free one
        if (error.code === 'PGRST116') {
          return await this.createSubscription(userId);
        }
        throw error;
      }

      return data;
    } catch (err) {
      logger.error('Failed to get subscription:', err);
      throw err;
    }
  }

  /**
   * Create a new subscription (defaults to free tier)
   */
  async createSubscription(userId: string, tier: SubscriptionTier = 'free'): Promise<Subscription> {
    try {
      const client = this.getClient();
      if (!client) {
        throw new Error('Failed to initialize Supabase client');
      }

      const { data, error } = await client
        .from('subscriptions')
        .insert({
          user_id: userId,
          tier,
          status: 'active'
        })
        .select()
        .single();

      if (error) throw error;

      logger.info(`Created ${tier} subscription for user ${userId}`);
      return data;
    } catch (err) {
      logger.error('Failed to create subscription:', err);
      throw err;
    }
  }

  /**
   * Update subscription (typically called from Stripe webhooks)
   */
  async updateSubscription(userId: string, updates: SubscriptionUpdateParams): Promise<void> {
    try {
      const client = this.getClient();
      if (!client) {
        throw new Error('Failed to initialize Supabase client');
      }

      const { error } = await client
        .from('subscriptions')
        .update(updates)
        .eq('user_id', userId);

      if (error) throw error;

      logger.info(`Updated subscription for user ${userId}:`, updates);
    } catch (err) {
      logger.error('Failed to update subscription:', err);
      throw err;
    }
  }

  /**
   * Check if user can use a specific resource
   */
  async checkLimit(
    userId: string,
    resource: 'projects' | 'ai_ideas' | 'users'
  ): Promise<LimitCheckResult> {
    try {
      // Get subscription
      const subscription = await this.getSubscription(userId);
      if (!subscription) {
        throw new Error('No subscription found');
      }

      // Get limit for tier
      const limit = getLimit(subscription.tier, resource === 'ai_ideas' ? 'ai_ideas_per_month' : resource);
      const unlimited = isUnlimited(subscription.tier, resource === 'ai_ideas' ? 'ai_ideas_per_month' : resource);

      // Get current usage
      let current = 0;
      if (resource === 'projects') {
        current = await this.getProjectCount(userId);
      } else if (resource === 'ai_ideas') {
        current = await this.getMonthlyAIUsage(userId);
      } else if (resource === 'users') {
        current = await this.getTeamMemberCount(userId);
      }

      const canUse = unlimited || current < limit;
      const percentageUsed = unlimited ? 0 : (current / limit) * 100;

      return {
        canUse,
        current,
        limit,
        isUnlimited: unlimited,
        percentageUsed
      };
    } catch (err) {
      logger.error(`Failed to check limit for ${resource}:`, err);
      throw err;
    }
  }

  /**
   * Get user's subscription with all limits
   */
  async getSubscriptionWithLimits(userId: string): Promise<SubscriptionWithLimits> {
    const subscription = await this.getSubscription(userId);
    if (!subscription) {
      throw new Error('No subscription found');
    }

    const [projectsLimit, aiLimit, usersLimit] = await Promise.all([
      this.checkLimit(userId, 'projects'),
      this.checkLimit(userId, 'ai_ideas'),
      this.checkLimit(userId, 'users')
    ]);

    return {
      ...subscription,
      limits: {
        projects: projectsLimit,
        ai_ideas: aiLimit,
        users: usersLimit
      }
    };
  }

  /**
   * Get user's project count
   */
  private async getProjectCount(userId: string): Promise<number> {
    try {
      const client = this.getClient();
      if (!client) {
        throw new Error('Failed to initialize Supabase client');
      }

      const { count, error } = await client
        .from('projects')
        .select('*', { count: 'exact', head: true })
        .eq('owner_id', userId);

      if (error) throw error;
      return count || 0;
    } catch (err) {
      logger.error('Failed to get project count:', err);
      return 0;
    }
  }

  /**
   * Get user's AI usage for current month
   */
  private async getMonthlyAIUsage(userId: string): Promise<number> {
    try {
      const client = this.getClient();
      if (!client) {
        throw new Error('Failed to initialize Supabase client');
      }

      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const { data, error } = await client
        .from('usage_tracking')
        .select('count')
        .eq('user_id', userId)
        .eq('resource_type', 'ai_idea')
        .gte('period_start', periodStart.toISOString())
        .single();

      if (error) {
        // No usage record yet
        if (error.code === 'PGRST116') {
          return 0;
        }
        throw error;
      }

      return data?.count || 0;
    } catch (err) {
      logger.error('Failed to get monthly AI usage:', err);
      return 0;
    }
  }

  /**
   * Get team member count (placeholder for future team feature)
   */
  private async getTeamMemberCount(_userId: string): Promise<number> {
    // TODO: Implement when team features are added
    // For now, return 1 (just the user)
    return 1;
  }

  /**
   * Get user ID from Stripe customer ID
   */
  async getUserIdFromStripeCustomer(stripeCustomerId: string): Promise<string | null> {
    try {
      const client = this.getClient();
      if (!client) {
        throw new Error('Failed to initialize Supabase client');
      }

      const { data, error } = await client
        .from('subscriptions')
        .select('user_id')
        .eq('stripe_customer_id', stripeCustomerId)
        .single();

      if (error) throw error;
      return data?.user_id || null;
    } catch (err) {
      logger.error('Failed to get user ID from Stripe customer:', err);
      return null;
    }
  }

  /**
   * Get Stripe customer ID for user
   */
  async getStripeCustomerId(userId: string): Promise<string | null> {
    try {
      const subscription = await this.getSubscription(userId);
      return subscription?.stripe_customer_id || null;
    } catch (err) {
      logger.error('Failed to get Stripe customer ID:', err);
      return null;
    }
  }

  /**
   * Save Stripe customer ID for user
   */
  async saveStripeCustomerId(userId: string, stripeCustomerId: string): Promise<void> {
    await this.updateSubscription(userId, { stripe_customer_id: stripeCustomerId });
  }
}

// Export singleton instance
export const subscriptionService = new SubscriptionService();
