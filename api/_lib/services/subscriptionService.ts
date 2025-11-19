/**
 * Server-Side Subscription Service
 *
 * IMPORTANT: This is the BACKEND version for Vercel serverless functions
 * Uses process.env and supabaseAdmin (service role) instead of frontend code
 *
 * DO NOT import from ../../../src/ - those are frontend-only modules!
 */

import { supabaseAdmin } from '../utils/supabaseAdmin'

export interface LimitCheckResult {
  canUse: boolean
  current: number
  limit: number
  percentageUsed: number
  isUnlimited: boolean
}

/**
 * Check if user can use a specific feature based on subscription limits
 */
export async function checkLimit(userId: string, limitType: 'ai_ideas' | 'ai_roadmap' | 'ai_insights'): Promise<LimitCheckResult> {
  try {
    if (!supabaseAdmin) {
      console.error('❌ Supabase admin client not initialized')
      // Allow operation to proceed but log error
      return {
        canUse: true,
        current: 0,
        limit: 999999,
        percentageUsed: 0,
        isUnlimited: true
      }
    }

    // Get user's subscription
    const { data: subscription, error: subError } = await supabaseAdmin
      .from('subscriptions')
      .select('tier, status')
      .eq('user_id', userId)
      .single()

    if (subError || !subscription) {
      console.warn(`⚠️ No subscription found for user ${userId}, defaulting to free tier`)
      // Default to free tier limits
      const freeLimit = limitType === 'ai_ideas' ? 10 : 5
      return {
        canUse: true,
        current: 0,
        limit: freeLimit,
        percentageUsed: 0,
        isUnlimited: false
      }
    }

    // Get current usage count for this month
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const { count, error: countError } = await supabaseAdmin
      .from('ai_usage_tracking')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('usage_type', limitType)
      .gte('created_at', startOfMonth.toISOString())

    if (countError) {
      console.error('❌ Error checking usage count:', countError)
      // Allow operation but log error
      return {
        canUse: true,
        current: 0,
        limit: 999999,
        percentageUsed: 0,
        isUnlimited: true
      }
    }

    const currentUsage = count || 0

    // Define limits based on tier
    const tierLimits: Record<string, number | null> = {
      free: limitType === 'ai_ideas' ? 10 : 5,
      team: null, // unlimited
      enterprise: null // unlimited
    }

    const limit = tierLimits[subscription.tier] || 10
    const isUnlimited = limit === null

    if (isUnlimited) {
      return {
        canUse: true,
        current: currentUsage,
        limit: 999999,
        percentageUsed: 0,
        isUnlimited: true
      }
    }

    const canUse = currentUsage < limit
    const percentageUsed = (currentUsage / limit) * 100

    return {
      canUse,
      current: currentUsage,
      limit,
      percentageUsed,
      isUnlimited: false
    }
  } catch (error) {
    console.error('❌ Error in checkLimit:', error)
    // On error, allow operation but log
    return {
      canUse: true,
      current: 0,
      limit: 999999,
      percentageUsed: 0,
      isUnlimited: true
    }
  }
}

/**
 * Track AI usage
 */
export async function trackAIUsage(userId: string, usageType: 'ai_ideas' | 'ai_roadmap' | 'ai_insights'): Promise<void> {
  try {
    if (!supabaseAdmin) {
      console.error('❌ Supabase admin client not initialized')
      return
    }

    const { error } = await supabaseAdmin
      .from('ai_usage_tracking')
      .insert({
        user_id: userId,
        usage_type: usageType,
        created_at: new Date().toISOString()
      })

    if (error) {
      console.error('❌ Error tracking AI usage:', error)
      // Don't throw - tracking failures shouldn't break user flow
    } else {
      console.log('✅ AI usage tracked:', { user: userId.substring(0, 8), type: usageType })
    }
  } catch (error) {
    console.error('❌ Error in trackAIUsage:', error)
    // Don't throw - failures shouldn't break user flow
  }
}
