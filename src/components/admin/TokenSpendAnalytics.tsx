/**
 * Token Spend Analytics Component
 *
 * Detailed view of AI token consumption and costs:
 * - Real-time spend tracking
 * - Cost breakdown by endpoint
 * - Usage trends and projections
 * - Budget alerts and thresholds
 * - Cost optimization recommendations
 */

import { useState, useEffect } from 'react'
import { Zap, DollarSign, TrendingUp, TrendingDown, AlertTriangle, RefreshCw, Calendar, Download } from 'lucide-react'
import type { User } from '../../types'
import { getAuthHeadersSync } from '../../lib/authHeaders'

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface TokenSpendData {
  overview: {
    totalTokens: number
    totalCost: number
    averageCostPerCall: number
    callCount: number
    costTrend: number // percentage change
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

interface EndpointSpend {
  endpoint: string
  calls: number
  tokens: number
  cost: number
  avgTokensPerCall: number
  percentage: number
}

interface UserSpend {
  userId: string
  email: string
  calls: number
  tokens: number
  cost: number
  percentage: number
}

interface ModelSpend {
  model: string
  calls: number
  tokens: number
  cost: number
  percentage: number
}

interface DailySpend {
  date: string
  tokens: number
  cost: number
  calls: number
}

interface HourlySpend {
  hour: number
  tokens: number
  cost: number
  calls: number
}

interface TokenSpendAnalyticsProps {
  currentUser: User
}

type TimeRange = '24h' | '7d' | '30d' | 'all'

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return num.toLocaleString()
}

function formatCurrency(value: number): string {
  return `$${value.toFixed(2)}`
}

function formatPercentage(value: number): string {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}%`
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function TokenSpendAnalytics({ currentUser: _currentUser }: TokenSpendAnalyticsProps) {
  const [data, setData] = useState<TokenSpendData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState<TimeRange>('30d')
  const [monthlyBudget] = useState<number | null>(500) // Example budget

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  const loadTokenSpend = async (refresh = false) => {
    try {
      if (refresh) {
        setIsRefreshing(true)
      } else {
        setIsLoading(true)
      }
      setError(null)

      const params = new URLSearchParams({
        timeRange,
        refresh: refresh.toString()
      })

      const response = await fetch(`/api/admin/token-spend?${params}`, {
        headers: getAuthHeadersSync(),
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error('Failed to load token spend data')
      }

      const result = await response.json()
      setData(result.data)
    } catch (_err) {
      console.error('Failed to load token spend:', err)
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    loadTokenSpend()
  }, [timeRange])

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleRefresh = () => {
    loadTokenSpend(true)
  }

  const handleExport = () => {
    if (!data) return

    const csv = [
      ['Metric', 'Value'],
      ['Total Tokens', data.overview.totalTokens],
      ['Total Cost', formatCurrency(data.overview.totalCost)],
      ['Call Count', data.overview.callCount],
      ['Average Cost Per Call', formatCurrency(data.overview.averageCostPerCall)],
      [''],
      ['Endpoint', 'Calls', 'Tokens', 'Cost'],
      ...data.breakdown.byEndpoint.map(e => [e.endpoint, e.calls, e.tokens, formatCurrency(e.cost)])
    ]

    const csvContent = csv.map(row => row.join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `token-spend-${timeRange}-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  // ============================================================================
  // RENDER LOADING STATE
  // ============================================================================

  if (isLoading && !data) {
    return (
      <div className="p-6 bg-white min-h-screen">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">Token Spend</h1>
          <p className="text-slate-600 mt-1">Loading spend analytics...</p>
        </div>
        <div className="animate-pulse space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-slate-200 rounded-lg" />
            ))}
          </div>
          <div className="h-96 bg-slate-200 rounded-lg" />
        </div>
      </div>
    )
  }

  // ============================================================================
  // RENDER ERROR STATE
  // ============================================================================

  if (error && !data) {
    return (
      <div className="p-6 bg-white min-h-screen">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">Token Spend</h1>
        </div>
        <div className="max-w-md mx-auto mt-12 text-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-8">
            <AlertTriangle className="w-16 h-16 text-red-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-red-900 mb-2">Failed to Load Data</h2>
            <p className="text-red-700 mb-4">{error}</p>
            <button
              onClick={() => loadTokenSpend()}
              className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!data) return null

  // Calculate budget status
  const budgetUsagePercent = monthlyBudget
    ? (data.projections.monthlyProjection / monthlyBudget) * 100
    : null

  const isBudgetWarning = budgetUsagePercent && budgetUsagePercent > 75
  const isBudgetDanger = budgetUsagePercent && budgetUsagePercent > 90

  // ============================================================================
  // RENDER MAIN VIEW
  // ============================================================================

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="mb-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Token Spend Analytics</h1>
          <p className="text-slate-600 mt-1">AI usage costs and optimization insights</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Time Range Selector */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-500" />
            <select
              value={timeRange}
              onChange={e => setTimeRange(e.target.value as TimeRange)}
              className="px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="24h">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="all">All time</option>
            </select>
          </div>

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="text-sm font-medium">Refresh</span>
          </button>

          {/* Export Button */}
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span className="text-sm font-medium">Export</span>
          </button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Total Cost */}
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-red-100 rounded-lg">
              <DollarSign className="w-5 h-5 text-red-600" />
            </div>
            {data.overview.costTrend !== 0 && (
              <div className={`flex items-center gap-1 text-sm ${
                data.overview.costTrend > 0 ? 'text-red-600' : 'text-green-600'
              }`}>
                {data.overview.costTrend > 0 ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
                <span className="font-medium">{formatPercentage(data.overview.costTrend)}</span>
              </div>
            )}
          </div>
          <div className="text-2xl font-bold text-slate-900">{formatCurrency(data.overview.totalCost)}</div>
          <div className="text-sm text-slate-500 mt-1">Total Spend</div>
        </div>

        {/* Total Tokens */}
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-green-100 rounded-lg">
              <Zap className="w-5 h-5 text-green-600" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{formatNumber(data.overview.totalTokens)}</div>
          <div className="text-sm text-slate-500 mt-1">Total Tokens</div>
        </div>

        {/* Average Cost */}
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <DollarSign className="w-5 h-5 text-blue-600" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{formatCurrency(data.overview.averageCostPerCall)}</div>
          <div className="text-sm text-slate-500 mt-1">Avg Cost / Call</div>
        </div>

        {/* Monthly Projection */}
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className={`p-2 rounded-lg ${
              isBudgetDanger ? 'bg-red-100' : isBudgetWarning ? 'bg-orange-100' : 'bg-purple-100'
            }`}>
              <TrendingUp className={`w-5 h-5 ${
                isBudgetDanger ? 'text-red-600' : isBudgetWarning ? 'text-orange-600' : 'text-purple-600'
              }`} />
            </div>
            {monthlyBudget && (
              <div className="text-xs text-slate-500">
                {budgetUsagePercent?.toFixed(0)}% of ${monthlyBudget}
              </div>
            )}
          </div>
          <div className="text-2xl font-bold text-slate-900">{formatCurrency(data.projections.monthlyProjection)}</div>
          <div className="text-sm text-slate-500 mt-1">Monthly Projection</div>
        </div>
      </div>

      {/* Budget Alert */}
      {isBudgetWarning && (
        <div className={`mb-6 p-4 rounded-lg border ${
          isBudgetDanger
            ? 'bg-red-50 border-red-200'
            : 'bg-orange-50 border-orange-200'
        }`}>
          <div className="flex items-start gap-3">
            <AlertTriangle className={`w-5 h-5 mt-0.5 ${
              isBudgetDanger ? 'text-red-600' : 'text-orange-600'
            }`} />
            <div>
              <h3 className={`font-semibold ${
                isBudgetDanger ? 'text-red-900' : 'text-orange-900'
              }`}>
                {isBudgetDanger ? 'Budget Alert: Critical' : 'Budget Warning'}
              </h3>
              <p className={`text-sm mt-1 ${
                isBudgetDanger ? 'text-red-700' : 'text-orange-700'
              }`}>
                Current spending trajectory will exceed monthly budget by{' '}
                {formatCurrency(data.projections.estimatedOverage || 0)}.
                Consider optimizing API usage or increasing budget.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Endpoint Breakdown */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Cost by Endpoint</h2>
        <div className="space-y-3">
          {data.breakdown.byEndpoint.slice(0, 10).map((endpoint, index) => (
            <div key={index} className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <code className="text-sm text-slate-700 font-mono">{endpoint.endpoint}</code>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-slate-500">{formatNumber(endpoint.calls)} calls</span>
                    <span className="text-slate-500">{formatNumber(endpoint.tokens)} tokens</span>
                    <span className="font-semibold text-slate-900">{formatCurrency(endpoint.cost)}</span>
                  </div>
                </div>
                <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                    style={{ width: `${endpoint.percentage}%` }}
                  />
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {endpoint.percentage.toFixed(1)}% of total • Avg {formatNumber(endpoint.avgTokensPerCall)} tokens/call
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Daily Timeline */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Daily Spend Trend</h2>
        <div className="space-y-2">
          {data.timeline.daily.slice(-14).map((day, index) => (
            <div key={index} className="flex items-center gap-4">
              <div className="w-24 text-sm text-slate-600">
                {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-slate-500">{formatNumber(day.calls)} calls</span>
                  <span className="text-sm font-semibold text-slate-900">{formatCurrency(day.cost)}</span>
                </div>
                <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-green-500 to-blue-500 rounded-full"
                    style={{
                      width: `${(day.cost / Math.max(...data.timeline.daily.map(d => d.cost))) * 100}%`
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
