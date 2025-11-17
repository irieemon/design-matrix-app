/**
 * Admin Token Spend API Endpoint
 *
 * Provides detailed token usage and cost analytics:
 * - Overview metrics (total tokens, costs, trends)
 * - Breakdown by endpoint, user, and model
 * - Daily and hourly timeline data
 * - Monthly budget projections
 *
 * Authentication: Requires admin role
 * Performance: Cached responses (5min TTL), <2s fresh queries
 */

import type { VercelResponse } from '@vercel/node'
import { adminEndpoint } from '../_lib/middleware/compose'
import { supabaseAdmin } from '../_lib/utils/supabaseAdmin'
import type { AuthenticatedRequest } from '../_lib/middleware/types'

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface EndpointSpend {
  endpoint: string
  callCount: number
  totalTokens: number
  totalCost: number
  percentOfTotal: number
}

interface UserSpend {
  userId: string
  email: string
  fullName: string | null
  callCount: number
  totalTokens: number
  totalCost: number
}

interface ModelSpend {
  model: string
  callCount: number
  totalTokens: number
  totalCost: number
  percentOfTotal: number
}

interface DailySpend {
  date: string
  tokens: number
  cost: number
  callCount: number
}

interface HourlySpend {
  hour: number
  tokens: number
  cost: number
  callCount: number
}

interface TokenSpendResponse {
  success: boolean
  data: {
    overview: {
      totalTokens: number
      totalCost: number
      averageCostPerCall: number
      callCount: number
      costTrend: number
    }
    breakdown: {
      byEndpoint: EndpointSpend[]
      byUser: UserSpend[]
      byModel: ModelSpend[]
    }
    timeline: {
      daily: DailySpend[]
      hourly: HourlySpend[]
    }
    projections: {
      monthlyProjection: number
      budgetRemaining: number | null
      estimatedOverage: number | null
    }
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

const cache = new Map<string, { data: any; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

function getCacheKey(timeRange: string): string {
  return `token-spend:${timeRange}`
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

function getDateRange(rangeType: string): { start: Date; end: Date } {
  const end = new Date()
  let start = new Date()

  switch (rangeType) {
    case '24h':
      start.setHours(end.getHours() - 24)
      break
    case '7d':
      start.setDate(end.getDate() - 7)
      break
    case '30d':
      start.setDate(end.getDate() - 30)
      break
    case 'all':
      start = new Date('2020-01-01')
      break
    default:
      start.setDate(end.getDate() - 30)
  }

  return { start, end }
}

// ============================================================================
// ANALYTICS QUERY FUNCTIONS
// ============================================================================

async function getOverviewMetrics(supabase: any, startDate: Date, endDate: Date) {
  console.log('💰 Fetching token spend overview...')

  // Get current period data
  const { data: currentData } = await supabase
    .from('ai_token_usage')
    .select('total_tokens, total_cost')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())

  // Calculate totals
  const totalTokens = currentData?.reduce((sum: number, row: any) => sum + (row.total_tokens || 0), 0) || 0
  const totalCost = currentData?.reduce((sum: number, row: any) => sum + (row.total_cost || 0), 0) || 0
  const callCount = currentData?.length || 0
  const averageCostPerCall = callCount > 0 ? totalCost / callCount : 0

  // Get previous period for trend calculation
  const periodLength = endDate.getTime() - startDate.getTime()
  const prevStart = new Date(startDate.getTime() - periodLength)
  const prevEnd = new Date(startDate)

  const { data: prevData } = await supabase
    .from('ai_token_usage')
    .select('total_cost')
    .gte('created_at', prevStart.toISOString())
    .lte('created_at', prevEnd.toISOString())

  const prevCost = prevData?.reduce((sum: number, row: any) => sum + (row.total_cost || 0), 0) || 0
  const costTrend = prevCost > 0 ? ((totalCost - prevCost) / prevCost) * 100 : 0

  return {
    totalTokens,
    totalCost,
    averageCostPerCall,
    callCount,
    costTrend
  }
}

async function getEndpointBreakdown(supabase: any, startDate: Date, endDate: Date): Promise<EndpointSpend[]> {
  console.log('🎯 Fetching endpoint breakdown...')

  const { data } = await supabase
    .from('ai_token_usage')
    .select('endpoint, total_tokens, total_cost')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())

  if (!data || data.length === 0) return []

  // Group by endpoint
  const endpointMap = new Map<string, { tokens: number; cost: number; count: number }>()
  let totalCost = 0

  for (const row of data) {
    const endpoint = row.endpoint || 'unknown'
    const current = endpointMap.get(endpoint) || { tokens: 0, cost: 0, count: 0 }
    current.tokens += row.total_tokens || 0
    current.cost += row.total_cost || 0
    current.count += 1
    totalCost += row.total_cost || 0
    endpointMap.set(endpoint, current)
  }

  // Convert to array and calculate percentages
  const result: EndpointSpend[] = []
  for (const [endpoint, stats] of endpointMap.entries()) {
    result.push({
      endpoint,
      callCount: stats.count,
      totalTokens: stats.tokens,
      totalCost: stats.cost,
      percentOfTotal: totalCost > 0 ? (stats.cost / totalCost) * 100 : 0
    })
  }

  return result.sort((a, b) => b.totalCost - a.totalCost).slice(0, 10)
}

async function getUserBreakdown(supabase: any, startDate: Date, endDate: Date): Promise<UserSpend[]> {
  console.log('👥 Fetching user breakdown...')

  const { data } = await supabase
    .from('ai_token_usage')
    .select(`
      user_id,
      total_tokens,
      total_cost,
      user_profiles!inner (
        email,
        full_name
      )
    `)
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())

  if (!data || data.length === 0) return []

  // Group by user
  const userMap = new Map<string, { email: string; fullName: string | null; tokens: number; cost: number; count: number }>()

  for (const row of data) {
    const userId = row.user_id
    if (!userId) continue

    const current = userMap.get(userId) || {
      email: row.user_profiles?.email || 'unknown',
      fullName: row.user_profiles?.full_name || null,
      tokens: 0,
      cost: 0,
      count: 0
    }
    current.tokens += row.total_tokens || 0
    current.cost += row.total_cost || 0
    current.count += 1
    userMap.set(userId, current)
  }

  // Convert to array
  const result: UserSpend[] = []
  for (const [userId, stats] of userMap.entries()) {
    result.push({
      userId,
      email: stats.email,
      fullName: stats.fullName,
      callCount: stats.count,
      totalTokens: stats.tokens,
      totalCost: stats.cost
    })
  }

  return result.sort((a, b) => b.totalCost - a.totalCost).slice(0, 10)
}

async function getModelBreakdown(supabase: any, startDate: Date, endDate: Date): Promise<ModelSpend[]> {
  console.log('🤖 Fetching model breakdown...')

  const { data } = await supabase
    .from('ai_token_usage')
    .select('model, total_tokens, total_cost')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())

  if (!data || data.length === 0) return []

  // Group by model
  const modelMap = new Map<string, { tokens: number; cost: number; count: number }>()
  let totalCost = 0

  for (const row of data) {
    const model = row.model || 'unknown'
    const current = modelMap.get(model) || { tokens: 0, cost: 0, count: 0 }
    current.tokens += row.total_tokens || 0
    current.cost += row.total_cost || 0
    current.count += 1
    totalCost += row.total_cost || 0
    modelMap.set(model, current)
  }

  // Convert to array and calculate percentages
  const result: ModelSpend[] = []
  for (const [model, stats] of modelMap.entries()) {
    result.push({
      model,
      callCount: stats.count,
      totalTokens: stats.tokens,
      totalCost: stats.cost,
      percentOfTotal: totalCost > 0 ? (stats.cost / totalCost) * 100 : 0
    })
  }

  return result.sort((a, b) => b.totalCost - a.totalCost)
}

async function getDailyTimeline(supabase: any, startDate: Date, endDate: Date): Promise<DailySpend[]> {
  console.log('📅 Fetching daily timeline...')

  const { data } = await supabase
    .from('ai_token_usage')
    .select('created_at, total_tokens, total_cost')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())
    .order('created_at', { ascending: true })

  if (!data || data.length === 0) return []

  // Group by day
  const dailyMap = new Map<string, { tokens: number; cost: number; count: number }>()

  for (const row of data) {
    const date = new Date(row.created_at).toISOString().split('T')[0]
    const current = dailyMap.get(date) || { tokens: 0, cost: 0, count: 0 }
    current.tokens += row.total_tokens || 0
    current.cost += row.total_cost || 0
    current.count += 1
    dailyMap.set(date, current)
  }

  // Convert to array
  const result: DailySpend[] = []
  for (const [date, stats] of dailyMap.entries()) {
    result.push({
      date,
      tokens: stats.tokens,
      cost: stats.cost,
      callCount: stats.count
    })
  }

  return result.sort((a, b) => a.date.localeCompare(b.date))
}

async function getHourlyTimeline(supabase: any, startDate: Date, endDate: Date): Promise<HourlySpend[]> {
  console.log('⏰ Fetching hourly timeline...')

  const { data } = await supabase
    .from('ai_token_usage')
    .select('created_at, total_tokens, total_cost')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())

  if (!data || data.length === 0) {
    return Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      tokens: 0,
      cost: 0,
      callCount: 0
    }))
  }

  // Group by hour of day
  const hourlyMap = new Map<number, { tokens: number; cost: number; count: number }>()
  for (let i = 0; i < 24; i++) {
    hourlyMap.set(i, { tokens: 0, cost: 0, count: 0 })
  }

  for (const row of data) {
    const hour = new Date(row.created_at).getHours()
    const current = hourlyMap.get(hour)!
    current.tokens += row.total_tokens || 0
    current.cost += row.total_cost || 0
    current.count += 1
  }

  // Convert to array
  const result: HourlySpend[] = []
  for (const [hour, stats] of hourlyMap.entries()) {
    result.push({
      hour,
      tokens: stats.tokens,
      cost: stats.cost,
      callCount: stats.count
    })
  }

  return result.sort((a, b) => a.hour - b.hour)
}

async function calculateProjections(
  supabase: any,
  _startDate: Date,
  _endDate: Date,
  monthlyBudget: number | null
) {
  console.log('📊 Calculating projections...')

  // Get current month data
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)

  const { data } = await supabase
    .from('ai_token_usage')
    .select('total_cost, created_at')
    .gte('created_at', monthStart.toISOString())
    .lte('created_at', monthEnd.toISOString())

  const monthToDateCost = data?.reduce((sum: number, row: any) => sum + (row.total_cost || 0), 0) || 0

  // Calculate daily average for current month
  const daysInMonth = monthEnd.getDate()
  const daysElapsed = now.getDate()
  const dailyAverage = daysElapsed > 0 ? monthToDateCost / daysElapsed : 0

  // Project to end of month
  const monthlyProjection = dailyAverage * daysInMonth

  // Calculate budget metrics
  const budgetRemaining = monthlyBudget !== null ? monthlyBudget - monthToDateCost : null
  const estimatedOverage = monthlyBudget !== null && monthlyProjection > monthlyBudget
    ? monthlyProjection - monthlyBudget
    : null

  return {
    monthlyProjection,
    budgetRemaining,
    estimatedOverage
  }
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

async function getTokenSpend(req: AuthenticatedRequest, res: VercelResponse) {
  const startTime = Date.now()

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Admin user is already verified by withAdmin middleware
    // Non-null assertion is safe here because withAdmin middleware guarantees user exists
    console.log(`💰 Admin ${req.user!.email} fetching token spend analytics`)

    // Parse query parameters
    const {
      timeRange = '30d',
      monthlyBudget: budgetParam,
      refresh = 'false'
    } = req.query

    const timeRangeStr = String(timeRange)
    const shouldRefresh = String(refresh) === 'true'
    const monthlyBudget = budgetParam ? parseFloat(String(budgetParam)) : null

    // Check cache unless refresh is requested
    const cacheKey = getCacheKey(timeRangeStr)
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

    // Get date range
    const { start: startDate, end: endDate } = getDateRange(timeRangeStr)

    console.log(`📊 Fetching token spend for ${startDate.toISOString()} to ${endDate.toISOString()}`)

    // Execute all queries in parallel using shared supabaseAdmin client
    const [
      overview,
      endpointBreakdown,
      userBreakdown,
      modelBreakdown,
      dailyTimeline,
      hourlyTimeline,
      projections
    ] = await Promise.all([
      getOverviewMetrics(supabaseAdmin, startDate, endDate),
      getEndpointBreakdown(supabaseAdmin, startDate, endDate),
      getUserBreakdown(supabaseAdmin, startDate, endDate),
      getModelBreakdown(supabaseAdmin, startDate, endDate),
      getDailyTimeline(supabaseAdmin, startDate, endDate),
      getHourlyTimeline(supabaseAdmin, startDate, endDate),
      calculateProjections(supabaseAdmin, startDate, endDate, monthlyBudget)
    ])

    const response: TokenSpendResponse = {
      success: true,
      data: {
        overview,
        breakdown: {
          byEndpoint: endpointBreakdown,
          byUser: userBreakdown,
          byModel: modelBreakdown
        },
        timeline: {
          daily: dailyTimeline,
          hourly: hourlyTimeline
        },
        projections
      },
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      },
      generatedAt: new Date().toISOString(),
      cacheStatus: 'miss'
    }

    // Cache the response
    setCache(cacheKey, response)

    const elapsed = Date.now() - startTime
    console.log(`✅ Token spend analytics generated in ${elapsed}ms`)

    return res.status(200).json(response)
  } catch (error) {
    console.error('❌ Token spend analytics error:', error)
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    })
  }
}

// Export with admin middleware (includes rate limiting, CSRF, auth, and admin check)
export default adminEndpoint(getTokenSpend)
