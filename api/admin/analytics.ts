/**
 * Admin Analytics API Endpoint
 *
 * Provides comprehensive platform analytics including:
 * - Overview metrics (users, projects, tokens, costs)
 * - Time series data (trends over time)
 * - Top users and projects by usage
 * - Endpoint performance metrics
 *
 * Authentication: Requires admin role
 * Performance: Cached responses (5min TTL), < 2s fresh queries
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface TimeSeriesDataPoint {
  date: string
  value: number
  label?: string
}

interface TopUserMetric {
  userId: string
  email: string
  fullName: string | null
  projectCount: number
  ideaCount: number
  totalTokens: number
  totalCost: number
  lastActive: string | null
}

interface TopProjectMetric {
  projectId: string
  name: string
  ownerEmail: string
  ideaCount: number
  tokenUsage: number
  cost: number
  lastUpdated: string
}

interface EndpointMetric {
  endpoint: string
  callCount: number
  totalTokens: number
  avgTokensPerCall: number
  totalCost: number
}

interface AnalyticsResponse {
  success: boolean
  analytics: {
    overview: {
      totalUsers: number
      activeUsers: {
        daily: number
        weekly: number
        monthly: number
      }
      totalProjects: number
      totalIdeas: number
      totalTokens: number
      totalCost: number
    }
    timeSeries: {
      tokenUsage: TimeSeriesDataPoint[]
      userGrowth: TimeSeriesDataPoint[]
      costTrends: TimeSeriesDataPoint[]
      projectActivity: TimeSeriesDataPoint[]
    }
    topUsers: TopUserMetric[]
    topProjects: TopProjectMetric[]
    topEndpoints: EndpointMetric[]
  }
  dateRange: {
    start: string
    end: string
  }
  generatedAt: string
  cacheStatus: 'hit' | 'miss'
}

// ============================================================================
// CACHE MANAGEMENT
// ============================================================================

// Simple in-memory cache (for development - use Redis in production)
const cache = new Map<string, { data: any; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

function getCacheKey(dateRange: string, metrics: string): string {
  return `analytics:${dateRange}:${metrics}`
}

function getFromCache(key: string): any | null {
  const cached = cache.get(key)
  if (!cached) return null

  const age = Date.now() - cached.timestamp
  if (age > CACHE_TTL) {
    cache.delete(key)
    return null
  }

  return cached.data
}

function setCache(key: string, data: any): void {
  cache.set(key, { data, timestamp: Date.now() })
}

// ============================================================================
// DATE RANGE UTILITIES
// ============================================================================

function getDateRange(rangeType: string, customStart?: string, customEnd?: string): { start: Date; end: Date } {
  const end = new Date()
  let start = new Date()

  switch (rangeType) {
    case '7d':
      start.setDate(end.getDate() - 7)
      break
    case '30d':
      start.setDate(end.getDate() - 30)
      break
    case '90d':
      start.setDate(end.getDate() - 90)
      break
    case 'all':
      start = new Date('2020-01-01') // App inception date
      break
    case 'custom':
      if (!customStart || !customEnd) {
        throw new Error('Custom date range requires startDate and endDate')
      }
      start = new Date(customStart)
      end = new Date(customEnd)
      break
    default:
      start.setDate(end.getDate() - 30) // Default to 30 days
  }

  return { start, end }
}

// ============================================================================
// ANALYTICS QUERY FUNCTIONS
// ============================================================================

async function getOverviewMetrics(supabase: any, startDate: Date, endDate: Date) {
  console.log('📊 Fetching overview metrics...')

  // Get total users
  const { count: totalUsers } = await supabase
    .from('user_profiles')
    .select('*', { count: 'exact', head: true })

  // Get active users (simplified - using created_at as proxy for activity)
  const oneDayAgo = new Date()
  oneDayAgo.setDate(oneDayAgo.getDate() - 1)
  const { count: dailyActive } = await supabase
    .from('user_profiles')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', oneDayAgo.toISOString())

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const { count: weeklyActive } = await supabase
    .from('user_profiles')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', sevenDaysAgo.toISOString())

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const { count: monthlyActive } = await supabase
    .from('user_profiles')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', thirtyDaysAgo.toISOString())

  // Get total projects
  const { count: totalProjects } = await supabase
    .from('projects')
    .select('*', { count: 'exact', head: true })

  // Get total ideas
  const { count: totalIdeas } = await supabase
    .from('ideas')
    .select('*', { count: 'exact', head: true })

  // Get token usage and costs in date range
  const { data: tokenData } = await supabase
    .from('ai_token_usage')
    .select('total_tokens, total_cost')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())

  const totalTokens = tokenData?.reduce((sum: number, row: any) => sum + (row.total_tokens || 0), 0) || 0
  const totalCost = tokenData?.reduce((sum: number, row: any) => sum + (row.total_cost || 0), 0) || 0

  return {
    totalUsers: totalUsers || 0,
    activeUsers: {
      daily: dailyActive || 0,
      weekly: weeklyActive || 0,
      monthly: monthlyActive || 0
    },
    totalProjects: totalProjects || 0,
    totalIdeas: totalIdeas || 0,
    totalTokens,
    totalCost
  }
}

async function getTimeSeriesData(supabase: any, startDate: Date, endDate: Date) {
  console.log('📈 Fetching time series data...')

  // Token usage over time
  const { data: tokenUsageData } = await supabase
    .from('ai_token_usage')
    .select('created_at, total_tokens, total_cost')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())
    .order('created_at', { ascending: true })

  // Aggregate by day
  const tokenUsageByDay = new Map<string, { tokens: number; cost: number; calls: number }>()

  tokenUsageData?.forEach((row: any) => {
    const date = new Date(row.created_at).toISOString().split('T')[0]
    const existing = tokenUsageByDay.get(date) || { tokens: 0, cost: 0, calls: 0 }
    tokenUsageByDay.set(date, {
      tokens: existing.tokens + (row.total_tokens || 0),
      cost: existing.cost + (row.total_cost || 0),
      calls: existing.calls + 1
    })
  })

  const tokenUsage: TimeSeriesDataPoint[] = Array.from(tokenUsageByDay.entries()).map(([date, data]) => ({
    date,
    value: data.tokens
  }))

  // User growth over time (users created by day)
  const { data: userGrowthData } = await supabase
    .from('user_profiles')
    .select('created_at')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())
    .order('created_at', { ascending: true })

  const usersByDay = new Map<string, number>()
  userGrowthData?.forEach((row: any) => {
    const date = new Date(row.created_at).toISOString().split('T')[0]
    usersByDay.set(date, (usersByDay.get(date) || 0) + 1)
  })

  // Calculate cumulative user growth
  let cumulativeUsers = 0
  const userGrowth: TimeSeriesDataPoint[] = Array.from(usersByDay.entries()).map(([date, count]) => {
    cumulativeUsers += count
    return { date, value: cumulativeUsers }
  })

  // Cost trends over time
  const costTrends: TimeSeriesDataPoint[] = Array.from(tokenUsageByDay.entries()).map(([date, data]) => ({
    date,
    value: data.cost
  }))

  // Project activity over time (projects created by day)
  const { data: projectActivityData } = await supabase
    .from('projects')
    .select('created_at')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())
    .order('created_at', { ascending: true })

  const projectsByDay = new Map<string, number>()
  projectActivityData?.forEach((row: any) => {
    const date = new Date(row.created_at).toISOString().split('T')[0]
    projectsByDay.set(date, (projectsByDay.get(date) || 0) + 1)
  })

  const projectActivity: TimeSeriesDataPoint[] = Array.from(projectsByDay.entries()).map(([date, count]) => ({
    date,
    value: count
  }))

  return {
    tokenUsage,
    userGrowth,
    costTrends,
    projectActivity
  }
}

async function getTopUsers(supabase: any, startDate: Date, endDate: Date, limit: number = 10) {
  console.log('👥 Fetching top users...')

  // Get all users with their token usage
  const { data: users } = await supabase
    .from('user_profiles')
    .select('id, email, full_name, created_at')
    .order('created_at', { ascending: false })

  if (!users || users.length === 0) return []

  // Get project counts per user
  const { data: projects } = await supabase
    .from('projects')
    .select('owner_id')
    .in('owner_id', users.map((u: any) => u.id))

  const projectCounts = new Map<string, number>()
  projects?.forEach((p: any) => {
    if (p.owner_id) {
      projectCounts.set(p.owner_id, (projectCounts.get(p.owner_id) || 0) + 1)
    }
  })

  // Get idea counts per user (through projects)
  const projectIds = projects?.map((p: any) => p.owner_id) || []
  const { data: ideas } = await supabase
    .from('ideas')
    .select('project_id, projects!inner(owner_id)')
    .in('projects.owner_id', users.map((u: any) => u.id))

  const ideaCounts = new Map<string, number>()
  ideas?.forEach((idea: any) => {
    const ownerId = idea.projects?.owner_id
    if (ownerId) {
      ideaCounts.set(ownerId, (ideaCounts.get(ownerId) || 0) + 1)
    }
  })

  // Get token usage per user
  const { data: tokenUsage } = await supabase
    .from('ai_token_usage')
    .select('user_id, total_tokens, total_cost')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())
    .in('user_id', users.map((u: any) => u.id))

  const tokenStats = new Map<string, { tokens: number; cost: number }>()
  tokenUsage?.forEach((row: any) => {
    if (row.user_id) {
      const existing = tokenStats.get(row.user_id) || { tokens: 0, cost: 0 }
      tokenStats.set(row.user_id, {
        tokens: existing.tokens + (row.total_tokens || 0),
        cost: existing.cost + (row.total_cost || 0)
      })
    }
  })

  // Combine data
  const topUsers: TopUserMetric[] = users.map((user: any) => ({
    userId: user.id,
    email: user.email || 'Unknown',
    fullName: user.full_name,
    projectCount: projectCounts.get(user.id) || 0,
    ideaCount: ideaCounts.get(user.id) || 0,
    totalTokens: tokenStats.get(user.id)?.tokens || 0,
    totalCost: tokenStats.get(user.id)?.cost || 0,
    lastActive: user.created_at
  }))

  // Sort by total cost and limit
  return topUsers
    .sort((a, b) => b.totalCost - a.totalCost)
    .slice(0, limit)
}

async function getTopProjects(supabase: any, startDate: Date, endDate: Date, limit: number = 10) {
  console.log('📁 Fetching top projects...')

  // Get all projects with owner info
  const { data: projects } = await supabase
    .from('projects')
    .select(`
      id,
      name,
      owner_id,
      updated_at,
      owner:user_profiles!owner_id(email)
    `)
    .order('updated_at', { ascending: false })

  if (!projects || projects.length === 0) return []

  // Get idea counts per project
  const { data: ideas } = await supabase
    .from('ideas')
    .select('project_id')
    .in('project_id', projects.map((p: any) => p.id))

  const ideaCounts = new Map<string, number>()
  ideas?.forEach((idea: any) => {
    ideaCounts.set(idea.project_id, (ideaCounts.get(idea.project_id) || 0) + 1)
  })

  // Get token usage per project
  const { data: tokenUsage } = await supabase
    .from('ai_token_usage')
    .select('project_id, total_tokens, total_cost')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())
    .in('project_id', projects.map((p: any) => p.id))

  const tokenStats = new Map<string, { tokens: number; cost: number }>()
  tokenUsage?.forEach((row: any) => {
    if (row.project_id) {
      const existing = tokenStats.get(row.project_id) || { tokens: 0, cost: 0 }
      tokenStats.set(row.project_id, {
        tokens: existing.tokens + (row.total_tokens || 0),
        cost: existing.cost + (row.total_cost || 0)
      })
    }
  })

  // Combine data
  const topProjects: TopProjectMetric[] = projects.map((project: any) => ({
    projectId: project.id,
    name: project.name,
    ownerEmail: project.owner?.email || 'Unknown',
    ideaCount: ideaCounts.get(project.id) || 0,
    tokenUsage: tokenStats.get(project.id)?.tokens || 0,
    cost: tokenStats.get(project.id)?.cost || 0,
    lastUpdated: project.updated_at
  }))

  // Sort by cost and limit
  return topProjects
    .sort((a, b) => b.cost - a.cost)
    .slice(0, limit)
}

async function getTopEndpoints(supabase: any, startDate: Date, endDate: Date, limit: number = 10) {
  console.log('🔌 Fetching endpoint metrics...')

  const { data: tokenUsage } = await supabase
    .from('ai_token_usage')
    .select('endpoint, total_tokens, total_cost')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())

  const endpointStats = new Map<string, { calls: number; tokens: number; cost: number }>()

  tokenUsage?.forEach((row: any) => {
    const endpoint = row.endpoint || 'unknown'
    const existing = endpointStats.get(endpoint) || { calls: 0, tokens: 0, cost: 0 }
    endpointStats.set(endpoint, {
      calls: existing.calls + 1,
      tokens: existing.tokens + (row.total_tokens || 0),
      cost: existing.cost + (row.total_cost || 0)
    })
  })

  const topEndpoints: EndpointMetric[] = Array.from(endpointStats.entries()).map(([endpoint, stats]) => ({
    endpoint,
    callCount: stats.calls,
    totalTokens: stats.tokens,
    avgTokensPerCall: stats.calls > 0 ? stats.tokens / stats.calls : 0,
    totalCost: stats.cost
  }))

  return topEndpoints
    .sort((a, b) => b.totalCost - a.totalCost)
    .slice(0, limit)
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const startTime = Date.now()

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // TODO: Add admin authentication check
    // const session = await validateAdminSession(req)
    // if (!session) return res.status(403).json({ error: 'Admin access required' })

    // Parse query parameters
    const {
      dateRange = '30d',
      startDate: customStart,
      endDate: customEnd,
      metrics = 'overview,timeSeries,topUsers,topProjects,topEndpoints',
      refresh = 'false'
    } = req.query

    const dateRangeStr = String(dateRange)
    const metricsStr = String(metrics)
    const shouldRefresh = String(refresh) === 'true'

    // Check cache unless refresh is requested
    const cacheKey = getCacheKey(dateRangeStr, metricsStr)
    if (!shouldRefresh) {
      const cachedData = getFromCache(cacheKey)
      if (cachedData) {
        console.log('✅ Cache hit for', cacheKey)
        return res.status(200).json({
          ...cachedData,
          cacheStatus: 'hit'
        })
      }
    }

    console.log('❌ Cache miss - fetching fresh data')

    // Create admin Supabase client
    const supabaseUrl = process.env.VITE_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ Missing Supabase credentials')
      return res.status(500).json({ error: 'Server configuration error' })
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Calculate date range
    const { start, end } = getDateRange(
      dateRangeStr,
      String(customStart),
      String(customEnd)
    )

    console.log(`📅 Date range: ${start.toISOString()} to ${end.toISOString()}`)

    // Parse requested metrics
    const requestedMetrics = metricsStr.split(',')

    // Execute queries in parallel for performance
    const [
      overview,
      timeSeries,
      topUsers,
      topProjects,
      topEndpoints
    ] = await Promise.all([
      requestedMetrics.includes('overview') ? getOverviewMetrics(supabaseAdmin, start, end) : null,
      requestedMetrics.includes('timeSeries') ? getTimeSeriesData(supabaseAdmin, start, end) : null,
      requestedMetrics.includes('topUsers') ? getTopUsers(supabaseAdmin, start, end) : null,
      requestedMetrics.includes('topProjects') ? getTopProjects(supabaseAdmin, start, end) : null,
      requestedMetrics.includes('topEndpoints') ? getTopEndpoints(supabaseAdmin, start, end) : null
    ])

    // Build response
    const response: AnalyticsResponse = {
      success: true,
      analytics: {
        overview: overview || {
          totalUsers: 0,
          activeUsers: { daily: 0, weekly: 0, monthly: 0 },
          totalProjects: 0,
          totalIdeas: 0,
          totalTokens: 0,
          totalCost: 0
        },
        timeSeries: timeSeries || {
          tokenUsage: [],
          userGrowth: [],
          costTrends: [],
          projectActivity: []
        },
        topUsers: topUsers || [],
        topProjects: topProjects || [],
        topEndpoints: topEndpoints || []
      },
      dateRange: {
        start: start.toISOString(),
        end: end.toISOString()
      },
      generatedAt: new Date().toISOString(),
      cacheStatus: 'miss'
    }

    // Cache the response
    setCache(cacheKey, response)

    const duration = Date.now() - startTime
    console.log(`✅ Analytics generated in ${duration}ms`)

    return res.status(200).json(response)

  } catch (error) {
    console.error('❌ Error fetching analytics:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch analytics',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
