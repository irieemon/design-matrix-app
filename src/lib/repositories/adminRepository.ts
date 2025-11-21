import { supabase } from '../supabase'
import { logger } from '../../utils/logger'

/**
 * Admin Repository
 *
 * Handles admin-specific queries for dashboard, user management, and analytics.
 * IMPORTANT: These methods require admin role - protected by RLS policies.
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface AdminUserStats {
  id: string
  email: string
  full_name: string | null
  role: string
  join_date: string
  last_login: string | null
  subscription_tier: string
  subscription_status: string
  project_count: number
  idea_count: number
  monthly_ai_usage: number
  monthly_export_usage: number
  total_tokens_used: number
  total_cost_usd: number
  monthly_tokens: number
  monthly_cost_usd: number
}

export interface AdminDashboardStats {
  totalUsers: number
  activeUsers30d: number
  freeUsers: number
  teamUsers: number
  enterpriseUsers: number
  totalProjects: number
  totalIdeas: number
  monthlyAICalls: number
  monthlyTokens: number
  monthlyRevenue: number
  monthlyAPIcost: number
}

export interface TokenUsageByDay {
  date: string
  tokens: number
  cost: number
  calls: number
}

export interface TokenUsageDetail {
  id: string
  user_id: string
  project_id: string | null
  endpoint: string
  model: string
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  input_cost: number
  output_cost: number
  total_cost: number
  success: boolean
  error_message: string | null
  response_time_ms: number | null
  created_at: string
}

export interface ProjectWithOwner {
  id: string
  name: string
  description: string | null
  project_type: string
  owner_id: string
  created_at: string
  updated_at: string
  owner: {
    id: string
    email: string
    full_name: string | null
  }
  idea_count: number
}

// ============================================================================
// ADMIN REPOSITORY CLASS
// ============================================================================

export class AdminRepository {
  /**
   * Get all users with comprehensive stats
   * Joins user_profiles with public.users to get proper email addresses
   */
  static async getAllUserStats(): Promise<AdminUserStats[]> {
    try {
      // Query user_profiles directly (JOIN approach failed due to missing foreign key)
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        logger.error('Failed to get user stats:', error)
        throw error
      }

      // Transform user_profiles data to AdminUserStats format
      return (data || []).map(user => ({
        id: user.id,
        email: user.email || 'Unknown',
        full_name: user.full_name || null,
        role: user.role || 'user',
        join_date: user.created_at,
        last_login: null, // TODO: Add last_login tracking
        subscription_tier: 'free', // TODO: Join with subscriptions table
        subscription_status: 'active', // TODO: Join with subscriptions table
        project_count: 0, // TODO: Compute from projects table
        idea_count: 0, // TODO: Compute from ideas table
        monthly_ai_usage: 0, // TODO: Compute from usage_tracking
        monthly_export_usage: 0, // TODO: Compute from usage_tracking
        total_tokens_used: 0, // TODO: Compute from ai_token_usage
        total_cost_usd: 0, // TODO: Compute from ai_token_usage
        monthly_tokens: 0, // TODO: Compute from ai_token_usage
        monthly_cost_usd: 0 // TODO: Compute from ai_token_usage
      }))
    } catch (_error) {
      logger.error('Failed to get all user stats:', error)
      return []
    }
  }

  /**
   * Get dashboard summary statistics
   */
  static async getDashboardStats(): Promise<AdminDashboardStats> {
    try {
      // Total users
      const { count: totalUsers } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })

      // Active users (last 30 days)
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const { count: activeUsers30d } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .gte('last_login', thirtyDaysAgo.toISOString())

      // Subscription tiers
      const { data: subscriptions } = await supabase
        .from('subscriptions')
        .select('tier')

      const tierCounts = subscriptions?.reduce((acc, { tier }) => {
        acc[tier] = (acc[tier] || 0) + 1
        return acc
      }, {} as Record<string, number>) || {}

      // Total projects and ideas
      const { count: totalProjects } = await supabase
        .from('projects')
        .select('*', { count: 'exact', head: true })

      const { count: totalIdeas } = await supabase
        .from('ideas')
        .select('*', { count: 'exact', head: true })

      // Monthly metrics
      const monthStart = new Date()
      monthStart.setDate(1)
      monthStart.setHours(0, 0, 0, 0)

      // Monthly AI usage
      const { data: monthlyUsage } = await supabase
        .from('usage_tracking')
        .select('resource_type, count')
        .gte('period_start', monthStart.toISOString())

      const monthlyAICalls = monthlyUsage
        ?.filter(u => u.resource_type === 'ai_idea')
        .reduce((sum, u) => sum + u.count, 0) || 0

      // Monthly token costs
      const { data: monthlyTokenData } = await supabase
        .from('ai_token_usage')
        .select('total_tokens, total_cost')
        .gte('created_at', monthStart.toISOString())

      const monthlyTokens = monthlyTokenData?.reduce((sum, t) => sum + t.total_tokens, 0) || 0
      const monthlyAPIcost = monthlyTokenData?.reduce((sum, t) => sum + t.total_cost, 0) || 0

      // Monthly revenue (placeholder - will integrate with Stripe later)
      const monthlyRevenue = 0

      return {
        totalUsers: totalUsers || 0,
        activeUsers30d: activeUsers30d || 0,
        freeUsers: tierCounts.free || 0,
        teamUsers: tierCounts.team || 0,
        enterpriseUsers: tierCounts.enterprise || 0,
        totalProjects: totalProjects || 0,
        totalIdeas: totalIdeas || 0,
        monthlyAICalls,
        monthlyTokens,
        monthlyRevenue,
        monthlyAPIcost
      }
    } catch (_error) {
      logger.error('Failed to get dashboard stats:', error)
      throw error
    }
  }

  /**
   * Get token usage by day (last N days)
   */
  static async getTokenUsageByDay(days: number = 30): Promise<TokenUsageByDay[]> {
    try {
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)

      const { data, error } = await supabase
        .from('ai_token_usage')
        .select('created_at, total_tokens, total_cost')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true })

      if (error) throw error

      // Group by day
      const byDay = (data || []).reduce((acc, item) => {
        const date = new Date(item.created_at).toISOString().split('T')[0]
        if (!acc[date]) {
          acc[date] = { date, tokens: 0, cost: 0, calls: 0 }
        }
        acc[date].tokens += item.total_tokens
        acc[date].cost += item.total_cost
        acc[date].calls += 1
        return acc
      }, {} as Record<string, TokenUsageByDay>)

      return Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date))
    } catch (_error) {
      logger.error('Failed to get token usage by day:', error)
      return []
    }
  }

  /**
   * Get token usage by endpoint
   */
  static async getTokenUsageByEndpoint(days: number = 30): Promise<Record<string, { tokens: number; cost: number; calls: number }>> {
    try {
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)

      const { data, error } = await supabase
        .from('ai_token_usage')
        .select('endpoint, total_tokens, total_cost')
        .gte('created_at', startDate.toISOString())

      if (error) throw error

      const byEndpoint = (data || []).reduce((acc, item) => {
        if (!acc[item.endpoint]) {
          acc[item.endpoint] = { tokens: 0, cost: 0, calls: 0 }
        }
        acc[item.endpoint].tokens += item.total_tokens
        acc[item.endpoint].cost += item.total_cost
        acc[item.endpoint].calls += 1
        return acc
      }, {} as Record<string, { tokens: number; cost: number; calls: number }>)

      return byEndpoint
    } catch (_error) {
      logger.error('Failed to get token usage by endpoint:', error)
      return {}
    }
  }

  /**
   * Get top users by token spend
   */
  static async getTopUsersByTokenCost(limit: number = 10): Promise<Array<{
    userId: string
    email: string
    totalCost: number
    totalTokens: number
    callCount: number
  }>> {
    try {
      const { data, error } = await supabase
        .from('ai_token_usage')
        .select(`
          user_id,
          total_tokens,
          total_cost,
          users!inner(email)
        `)

      if (error) throw error

      // Aggregate by user
      const userStats = (data || []).reduce((acc, item) => {
        if (!acc[item.user_id]) {
          acc[item.user_id] = {
            userId: item.user_id,
            email: (item.users as any).email,
            totalCost: 0,
            totalTokens: 0,
            callCount: 0
          }
        }
        acc[item.user_id].totalCost += item.total_cost
        acc[item.user_id].totalTokens += item.total_tokens
        acc[item.user_id].callCount += 1
        return acc
      }, {} as Record<string, { userId: string; email: string; totalCost: number; totalTokens: number; callCount: number }>)

      return Object.values(userStats)
        .sort((a, b) => b.totalCost - a.totalCost)
        .slice(0, limit)
    } catch (_error) {
      logger.error('Failed to get top users by token cost:', error)
      return []
    }
  }

  /**
   * Get all projects across all users (admin view)
   */
  static async getAllProjects(): Promise<ProjectWithOwner[]> {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          id,
          name,
          description,
          project_type,
          owner_id,
          created_at,
          updated_at,
          owner:user_profiles!owner_id(id, email, full_name)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Get idea counts for each project
      const projectIds = (data || []).map(p => p.id)
      const { data: ideaCounts } = await supabase
        .from('ideas')
        .select('project_id')
        .in('project_id', projectIds)

      const ideaCountMap = (ideaCounts || []).reduce((acc, idea) => {
        acc[idea.project_id] = (acc[idea.project_id] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      return (data || []).map(project => ({
        ...project,
        owner: Array.isArray(project.owner) ? project.owner[0] : project.owner,
        idea_count: ideaCountMap[project.id] || 0
      }))
    } catch (_error) {
      logger.error('Failed to get all projects:', error)
      return []
    }
  }

  /**
   * Search users with filters
   */
  static async searchUsers(filters: {
    query?: string
    tier?: string
    role?: string
    minCost?: number
  }): Promise<AdminUserStats[]> {
    try {
      let query = supabase
        .from('admin_user_stats')
        .select('*')

      if (filters.query) {
        query = query.or(`email.ilike.%${filters.query}%,full_name.ilike.%${filters.query}%`)
      }

      if (filters.tier) {
        query = query.eq('subscription_tier', filters.tier)
      }

      if (filters.role) {
        query = query.eq('role', filters.role)
      }

      if (filters.minCost !== undefined) {
        query = query.gte('total_cost_usd', filters.minCost)
      }

      const { data, error } = await query.order('total_cost_usd', { ascending: false })

      if (error) throw error
      return data || []
    } catch (_error) {
      logger.error('Failed to search users:', error)
      return []
    }
  }

  /**
   * Get user details with token usage history
   */
  static async getUserDetails(userId: string): Promise<{
    user: AdminUserStats | null
    recentTokenUsage: TokenUsageDetail[]
  }> {
    try {
      // Get user stats
      const { data: userStats, error: userError } = await supabase
        .from('admin_user_stats')
        .select('*')
        .eq('id', userId)
        .single()

      if (userError) throw userError

      // Get recent token usage (last 30 days)
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const { data: tokenUsage, error: tokenError } = await supabase
        .from('ai_token_usage')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(50)

      if (tokenError) throw tokenError

      return {
        user: userStats,
        recentTokenUsage: tokenUsage || []
      }
    } catch (_error) {
      logger.error('Failed to get user details:', error)
      return {
        user: null,
        recentTokenUsage: []
      }
    }
  }

  /**
   * Refresh materialized view (admin action)
   */
  static async refreshUserStats(): Promise<boolean> {
    try {
      const { error } = await supabase.rpc('refresh_admin_user_stats')

      if (error) {
        logger.error('Failed to refresh user stats:', error)
        return false
      }

      logger.info('Successfully refreshed admin_user_stats materialized view')
      return true
    } catch (_error) {
      logger.error('Failed to refresh user stats:', error)
      return false
    }
  }
}
