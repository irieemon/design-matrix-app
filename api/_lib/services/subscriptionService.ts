/**
 * Server-Side Subscription Service
 *
 * IMPORTANT: This is the BACKEND version for Vercel serverless functions
 * Uses process.env and supabaseAdmin (service role) instead of frontend code
 *
 * DO NOT import from ../../../src/ - those are frontend-only modules!
 */

import { supabaseAdmin } from '../utils/supabaseAdmin.js'

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
export async function checkLimit(
  userId: string,
  limitType: 'ai_ideas' | 'ai_roadmap' | 'ai_insights' | 'projects' | 'users'
): Promise<LimitCheckResult> {
  try {
    if (!supabaseAdmin) {
      console.error('❌ Supabase admin client not initialized')
      // Fail closed: deny access when infrastructure is unavailable
      return {
        canUse: false,
        current: 0,
        limit: 0,
        percentageUsed: 100,
        isUnlimited: false
      }
    }

    // Resolve subscription tier (shared across all dispatches)
    const { data: subscription, error: subError } = await supabaseAdmin
      .from('subscriptions')
      .select('tier, status')
      .eq('user_id', userId)
      .single()

    const tier = subError || !subscription ? 'free' : subscription.tier

    if (limitType === 'projects') {
      return await checkProjectLimit(userId, tier)
    }
    if (limitType === 'users') {
      return await checkUserLimit(userId, tier)
    }
    return await checkAiLimit(userId, limitType, tier, !!(subError || !subscription))
  } catch (error) {
    console.error('❌ Error in checkLimit:', error)
    return {
      canUse: false,
      current: 0,
      limit: 0,
      percentageUsed: 100,
      isUnlimited: false
    }
  }
}

/**
 * Check project creation quota for a user
 * Free tier: 1 project max (matches src/lib/config/tierLimits.ts:33 free.projects)
 */
async function checkProjectLimit(userId: string, tier: string): Promise<LimitCheckResult> {
  const limit = tier === 'free' ? 1 : null  // matches src/lib/config/tierLimits.ts:33 (free.projects)
  if (limit === null) {
    return { canUse: true, current: 0, limit: 999999, percentageUsed: 0, isUnlimited: true }
  }

  const { count, error } = await supabaseAdmin!
    .from('projects')
    .select('*', { count: 'exact', head: true })
    .eq('owner_id', userId)

  if (error) {
    console.error('[checkProjectLimit] count error:', error)
    return { canUse: false, current: 0, limit: 0, percentageUsed: 100, isUnlimited: false }
  }

  const current = count ?? 0
  return {
    canUse: current < limit,
    current,
    limit,
    percentageUsed: (current / limit) * 100,
    isUnlimited: false,
  }
}

/**
 * Check team member (users) quota for a user
 * Free tier: 3 collaborators max across all owned projects (matches src/lib/config/tierLimits.ts:34 free.users)
 */
async function checkUserLimit(userId: string, tier: string): Promise<LimitCheckResult> {
  const limit = tier === 'free' ? 3 : null  // matches src/lib/config/tierLimits.ts:34 (free.users)
  if (limit === null) {
    return { canUse: true, current: 0, limit: 999999, percentageUsed: 0, isUnlimited: true }
  }

  const { data: projects, error: projErr } = await supabaseAdmin!
    .from('projects')
    .select('id')
    .eq('owner_id', userId)

  if (projErr) {
    console.error('[checkUserLimit] projects query error:', projErr)
    return { canUse: false, current: 0, limit: 0, percentageUsed: 100, isUnlimited: false }
  }

  const projectIds = ((projects ?? []) as Array<{ id: string }>).map(p => p.id)
  if (projectIds.length === 0) {
    return { canUse: true, current: 0, limit, percentageUsed: 0, isUnlimited: false }
  }

  const { count, error: collabErr } = await supabaseAdmin!
    .from('project_collaborators')
    .select('user_id', { count: 'exact', head: true })
    .in('project_id', projectIds)

  if (collabErr) {
    console.error('[checkUserLimit] collaborators query error:', collabErr)
    return { canUse: false, current: 0, limit: 0, percentageUsed: 100, isUnlimited: false }
  }

  const current = count ?? 0
  return {
    canUse: current < limit,
    current,
    limit,
    percentageUsed: (current / limit) * 100,
    isUnlimited: false,
  }
}

/**
 * Check AI feature quota (ai_ideas, ai_roadmap, ai_insights)
 * Extracted from the original checkLimit body — behavior-identical to pre-Phase-11.6.
 * The `free: limitType === 'ai_ideas' ? 10 : 5` line is a pre-existing bug, preserved per D-07.
 */
async function checkAiLimit(
  userId: string,
  limitType: 'ai_ideas' | 'ai_roadmap' | 'ai_insights',
  tier: string,
  noSubscription: boolean
): Promise<LimitCheckResult> {
  if (noSubscription) {
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

  const { count, error: countError } = await supabaseAdmin!
    .from('ai_usage_tracking')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('usage_type', limitType)
    .gte('created_at', startOfMonth.toISOString())

  if (countError) {
    console.error('❌ Error checking usage count:', countError)
    // Fail closed: deny access when usage count cannot be verified
    return {
      canUse: false,
      current: 0,
      limit: 0,
      percentageUsed: 100,
      isUnlimited: false
    }
  }

  const currentUsage = count || 0

  // Define limits based on tier
  const tierLimits: Record<string, number | null> = {
    free: limitType === 'ai_ideas' ? 10 : 5,
    team: null, // unlimited
    enterprise: null // unlimited
  }

  const limit = tierLimits[tier] || 10
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
