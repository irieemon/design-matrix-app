/**
 * Subscription Service
 *
 * Handles subscription management, tier checking, and limit enforcement
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase, createAuthenticatedClientFromLocalStorage } from '../supabase';
import { getLimit, isUnlimited, type SubscriptionTier } from '../config/tierLimits';
import type {
  Subscription,
  SubscriptionUpdateParams,
  LimitCheckResult,
  SubscriptionWithLimits
} from '../../types/subscription';
import { logger } from '../../utils/logger';

/**
 * Named error class so the quota middleware can detect-and-deny deterministically
 * (BILL-03 fail-closed). Wraps the underlying cause when available.
 */
export class SubscriptionCheckError extends Error {
  public readonly cause?: unknown;
  constructor(public readonly reason: string, cause?: unknown) {
    super(`Subscription check failed: ${reason}`);
    this.name = 'SubscriptionCheckError';
    if (cause !== undefined) this.cause = cause;
  }
}

export class SubscriptionService {
  /**
   * Get appropriate Supabase client based on environment
   * - Browser: authenticated client from localStorage (avoids getSession timeout)
   * - Server (Node.js): module-level supabase singleton (NOTE: server callers should
   *   pass an explicit service-role client to avoid anon-key RLS fall-through)
   */
  private getClient(): SupabaseClient | null {
    const isBrowser = typeof window !== 'undefined' && typeof localStorage !== 'undefined';
    return (isBrowser ? createAuthenticatedClientFromLocalStorage() : supabase) as SupabaseClient | null;
  }

  /**
   * Get user's subscription. Pass `client` from server-side callers to avoid the
   * anon-key fail-open path on RLS-protected tables.
   */
  async getSubscription(userId: string, client?: SupabaseClient): Promise<Subscription | null> {
    try {
      const db = client ?? this.getClient();
      if (!db) throw new SubscriptionCheckError('no_client');

      const { data, error } = await db
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        if ((error as { code?: string }).code === 'PGRST116') {
          return await this.createSubscription(userId, 'free', db);
        }
        throw new SubscriptionCheckError('subscription_query', error);
      }

      return data as Subscription;
    } catch (err) {
      logger.error('Failed to get subscription:', err);
      if (err instanceof SubscriptionCheckError) throw err;
      throw new SubscriptionCheckError('get_subscription_failed', err);
    }
  }

  /**
   * Create a new subscription (defaults to free tier)
   */
  async createSubscription(
    userId: string,
    tier: SubscriptionTier = 'free',
    client?: SupabaseClient
  ): Promise<Subscription> {
    try {
      const db = client ?? this.getClient();
      if (!db) throw new SubscriptionCheckError('no_client');

      const { data, error } = await db
        .from('subscriptions')
        .insert({
          user_id: userId,
          tier,
          status: 'active'
        })
        .select()
        .single();

      if (error) throw new SubscriptionCheckError('subscription_insert', error);

      logger.info(`Created ${tier} subscription for user ${userId}`);
      return data as Subscription;
    } catch (err) {
      logger.error('Failed to create subscription:', err);
      if (err instanceof SubscriptionCheckError) throw err;
      throw new SubscriptionCheckError('create_subscription_failed', err);
    }
  }

  /**
   * Update subscription (typically called from Stripe webhooks)
   */
  async updateSubscription(
    userId: string,
    updates: SubscriptionUpdateParams,
    client?: SupabaseClient
  ): Promise<void> {
    try {
      const db = client ?? this.getClient();
      if (!db) throw new SubscriptionCheckError('no_client');

      const { error } = await db
        .from('subscriptions')
        .update(updates)
        .eq('user_id', userId);

      if (error) throw new SubscriptionCheckError('subscription_update', error);

      logger.info(`Updated subscription for user ${userId}:`, updates);
    } catch (err) {
      logger.error('Failed to update subscription:', err);
      if (err instanceof SubscriptionCheckError) throw err;
      throw new SubscriptionCheckError('update_subscription_failed', err);
    }
  }

  /**
   * Check if user can use a specific resource. Throws SubscriptionCheckError on
   * any internal failure so the middleware can fail closed (BILL-03).
   */
  async checkLimit(
    userId: string,
    resource: 'projects' | 'ai_ideas' | 'users',
    client?: SupabaseClient
  ): Promise<LimitCheckResult> {
    try {
      const db = client ?? this.getClient();
      if (!db) throw new SubscriptionCheckError('no_client');

      const subscription = await this.getSubscription(userId, db);
      if (!subscription) {
        throw new SubscriptionCheckError('no_subscription');
      }

      const limitKey = resource === 'ai_ideas' ? 'ai_ideas_per_month' : resource;
      const limit = getLimit(subscription.tier, limitKey);
      const unlimited = isUnlimited(subscription.tier, limitKey);

      let current = 0;
      if (resource === 'projects') {
        current = await this.getProjectCount(userId, db);
      } else if (resource === 'ai_ideas') {
        current = await this.getMonthlyAIUsage(userId, db);
      } else if (resource === 'users') {
        current = await this.getTeamMemberCount(userId, db);
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
      if (err instanceof SubscriptionCheckError) throw err;
      throw new SubscriptionCheckError('check_limit_failed', err);
    }
  }

  /**
   * Atomically increment AI usage for the current period via the
   * `increment_ai_usage` RPC. Called AFTER a successful AI mutation (D-12).
   */
  async incrementAiUsage(userId: string, client?: SupabaseClient): Promise<number> {
    const db = client ?? this.getClient();
    if (!db) throw new SubscriptionCheckError('no_client');
    const { data, error } = await db.rpc('increment_ai_usage', { p_user_id: userId });
    if (error) throw new SubscriptionCheckError('rpc_failed', error);
    return (data as number) ?? 0;
  }

  /**
   * Get user's subscription with all limits
   */
  async getSubscriptionWithLimits(userId: string, client?: SupabaseClient): Promise<SubscriptionWithLimits> {
    const subscription = await this.getSubscription(userId, client);
    if (!subscription) {
      throw new SubscriptionCheckError('no_subscription');
    }

    const [projectsLimit, aiLimit, usersLimit] = await Promise.all([
      this.checkLimit(userId, 'projects', client),
      this.checkLimit(userId, 'ai_ideas', client),
      this.checkLimit(userId, 'users', client)
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
  private async getProjectCount(userId: string, client?: SupabaseClient): Promise<number> {
    const db = client ?? this.getClient();
    if (!db) throw new SubscriptionCheckError('no_client');
    const { count, error } = await db
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('owner_id', userId);
    if (error) throw new SubscriptionCheckError('project_count', error);
    return count || 0;
  }

  /**
   * Get user's AI usage for current period via RPC (D-05 read-path reset).
   */
  private async getMonthlyAIUsage(userId: string, client?: SupabaseClient): Promise<number> {
    const db = client ?? this.getClient();
    if (!db) throw new SubscriptionCheckError('no_client');
    const { data, error } = await db.rpc('get_current_ai_usage', { p_user_id: userId });
    if (error) throw new SubscriptionCheckError('rpc_failed', error);
    return (data as number) ?? 0;
  }

  /**
   * Real team member count: rows in project_collaborators across the user's
   * owned projects (D-07). Replaces previous stub of 1.
   */
  private async getTeamMemberCount(userId: string, client?: SupabaseClient): Promise<number> {
    const db = client ?? this.getClient();
    if (!db) throw new SubscriptionCheckError('no_client');
    const { data: projects, error: projErr } = await db
      .from('projects')
      .select('id')
      .eq('owner_id', userId);
    if (projErr) throw new SubscriptionCheckError('projects_query', projErr);
    const projectIds = ((projects ?? []) as Array<{ id: string }>).map((p) => p.id);
    if (projectIds.length === 0) return 0;
    const { count, error: collabErr } = await db
      .from('project_collaborators')
      .select('user_id', { count: 'exact', head: true })
      .in('project_id', projectIds);
    if (collabErr) throw new SubscriptionCheckError('collab_query', collabErr);
    return count ?? 0;
  }

  /**
   * Get user ID from Stripe customer ID
   */
  async getUserIdFromStripeCustomer(stripeCustomerId: string, client?: SupabaseClient): Promise<string | null> {
    try {
      const db = client ?? this.getClient();
      if (!db) throw new SubscriptionCheckError('no_client');

      const { data, error } = await db
        .from('subscriptions')
        .select('user_id')
        .eq('stripe_customer_id', stripeCustomerId)
        .single();

      if (error) throw new SubscriptionCheckError('lookup_failed', error);
      return (data as { user_id?: string } | null)?.user_id || null;
    } catch (err) {
      logger.error('Failed to get user ID from Stripe customer:', err);
      return null;
    }
  }

  /**
   * Get Stripe customer ID for user
   */
  async getStripeCustomerId(userId: string, client?: SupabaseClient): Promise<string | null> {
    try {
      const subscription = await this.getSubscription(userId, client);
      return subscription?.stripe_customer_id || null;
    } catch (err) {
      logger.error('Failed to get Stripe customer ID:', err);
      return null;
    }
  }

  /**
   * Save Stripe customer ID for user
   */
  async saveStripeCustomerId(userId: string, stripeCustomerId: string, client?: SupabaseClient): Promise<void> {
    await this.updateSubscription(userId, { stripe_customer_id: stripeCustomerId }, client);
  }
}

// Export singleton instance
export const subscriptionService = new SubscriptionService();
