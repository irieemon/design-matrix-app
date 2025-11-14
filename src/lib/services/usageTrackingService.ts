/**
 * Usage Tracking Service
 *
 * Tracks resource usage for limit enforcement (AI ideas, projects, exports, etc.)
 */

import { supabase } from '../supabase';
import type { ResourceType, UsageTracking } from '../../types/subscription';
import { logger } from '../../utils/logger';

export class UsageTrackingService {
  /**
   * Track AI idea generation
   */
  async trackAIUsage(userId: string): Promise<void> {
    await this.incrementUsage(userId, 'ai_idea');
  }

  /**
   * Track export usage
   */
  async trackExport(userId: string): Promise<void> {
    await this.incrementUsage(userId, 'export');
  }

  /**
   * Track API call usage
   */
  async trackAPICall(userId: string): Promise<void> {
    await this.incrementUsage(userId, 'api_call');
  }

  /**
   * Increment usage count for a resource type
   */
  private async incrementUsage(userId: string, resourceType: ResourceType): Promise<void> {
    try {
      const { periodStart, periodEnd } = this.getCurrentMonthPeriod();

      // Try to increment existing record
      const { data: existing } = await supabase
        .from('usage_tracking')
        .select('*')
        .eq('user_id', userId)
        .eq('resource_type', resourceType)
        .eq('period_start', periodStart.toISOString())
        .single();

      if (existing) {
        // Update existing record
        const { error } = await supabase
          .from('usage_tracking')
          .update({ count: existing.count + 1 })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Create new record
        const { error } = await supabase
          .from('usage_tracking')
          .insert({
            user_id: userId,
            resource_type: resourceType,
            count: 1,
            period_start: periodStart.toISOString(),
            period_end: periodEnd.toISOString()
          });

        if (error) throw error;
      }

      logger.debug(`Tracked ${resourceType} usage for user ${userId}`);
    } catch (error) {
      logger.error(`Failed to track ${resourceType} usage:`, error);
      // Don't throw - usage tracking failures shouldn't break user flows
    }
  }

  /**
   * Get usage count for a resource type in current month
   */
  async getMonthlyUsage(userId: string, resourceType: ResourceType): Promise<number> {
    try {
      const { periodStart } = this.getCurrentMonthPeriod();

      const { data, error } = await supabase
        .from('usage_tracking')
        .select('count')
        .eq('user_id', userId)
        .eq('resource_type', resourceType)
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
    } catch (error) {
      logger.error(`Failed to get monthly ${resourceType} usage:`, error);
      return 0;
    }
  }

  /**
   * Get AI usage for current month
   */
  async getMonthlyAIUsage(userId: string): Promise<number> {
    return this.getMonthlyUsage(userId, 'ai_idea');
  }

  /**
   * Get export usage for current month
   */
  async getMonthlyExportUsage(userId: string): Promise<number> {
    return this.getMonthlyUsage(userId, 'export');
  }

  /**
   * Get API call usage for current month
   */
  async getMonthlyAPIUsage(userId: string): Promise<number> {
    return this.getMonthlyUsage(userId, 'api_call');
  }

  /**
   * Get all usage for current month
   */
  async getAllMonthlyUsage(userId: string): Promise<Record<ResourceType, number>> {
    const [aiIdeas, exports, apiCalls] = await Promise.all([
      this.getMonthlyAIUsage(userId),
      this.getMonthlyExportUsage(userId),
      this.getMonthlyAPIUsage(userId)
    ]);

    return {
      ai_idea: aiIdeas,
      export: exports,
      api_call: apiCalls,
      project: 0 // Projects are counted from projects table, not usage_tracking
    };
  }

  /**
   * Get usage history for a user
   */
  async getUsageHistory(
    userId: string,
    resourceType?: ResourceType,
    limit: number = 12
  ): Promise<UsageTracking[]> {
    try {
      let query = supabase
        .from('usage_tracking')
        .select('*')
        .eq('user_id', userId)
        .order('period_start', { ascending: false })
        .limit(limit);

      if (resourceType) {
        query = query.eq('resource_type', resourceType);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error('Failed to get usage history:', error);
      return [];
    }
  }

  /**
   * Get current month period bounds
   */
  private getCurrentMonthPeriod(): { periodStart: Date; periodEnd: Date } {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    return { periodStart, periodEnd };
  }

  /**
   * Check if usage should be reset (for testing/debugging)
   */
  async resetMonthlyUsage(userId: string, resourceType: ResourceType): Promise<void> {
    try {
      const { periodStart } = this.getCurrentMonthPeriod();

      const { error } = await supabase
        .from('usage_tracking')
        .delete()
        .eq('user_id', userId)
        .eq('resource_type', resourceType)
        .gte('period_start', periodStart.toISOString());

      if (error) throw error;

      logger.info(`Reset ${resourceType} usage for user ${userId}`);
    } catch (error) {
      logger.error(`Failed to reset ${resourceType} usage:`, error);
      throw error;
    }
  }
}

// Export singleton instance
export const usageTrackingService = new UsageTrackingService();
