/**
 * Admin Analytics Dashboard
 *
 * Comprehensive analytics view providing:
 * - Real-time platform metrics
 * - Time-series charts for trend analysis
 * - Token usage and cost tracking
 * - User engagement analytics
 * - Drill-down capabilities
 *
 * Data source: /api/admin/analytics
 * Performance: <200ms (cached), <2s (fresh)
 */

import { useState, useEffect } from 'react'
import { RefreshCw, Calendar, Download } from 'lucide-react'
import type { User } from '../../types'
import QuickStatsGrid from './QuickStatsGrid'
import ChartsSection from './ChartsSection'
import DetailedAnalytics from './DetailedAnalytics'
import { getAuthHeadersSync } from '../../lib/authHeaders'

// ============================================================================
// TYPE DEFINITIONS (matching API response)
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

interface AnalyticsData {
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

interface AnalyticsResponse {
  success: boolean
  analytics: AnalyticsData
  dateRange: {
    start: string
    end: string
  }
  generatedAt: string
  cacheStatus: 'hit' | 'miss'
}

interface AdminAnalyticsProps {
  currentUser: User
}

type DateRange = '7d' | '30d' | '90d' | 'all'

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function AdminAnalytics({ currentUser }: AdminAnalyticsProps) {
  // State management
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<DateRange>('30d')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [cacheStatus, setCacheStatus] = useState<'hit' | 'miss' | null>(null)

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  const loadAnalytics = async (refresh = false) => {
    try {
      if (refresh) {
        setIsRefreshing(true)
      } else {
        setIsLoading(true)
      }
      setError(null)

      const params = new URLSearchParams({
        dateRange,
        refresh: refresh.toString()
      })

      const response = await fetch(`/api/admin/analytics?${params}`, {
        headers: getAuthHeadersSync(),
        credentials: 'include'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to load analytics')
      }

      const result: AnalyticsResponse = await response.json()

      if (!result.success) {
        throw new Error('Analytics request was not successful')
      }

      setData(result.analytics)
      setLastUpdated(new Date(result.generatedAt))
      setCacheStatus(result.cacheStatus)
    } catch (err) {
      console.error('Failed to load analytics:', err)
      setError(err instanceof Error ? err.message : 'Failed to load analytics')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  // Load analytics on mount and when date range changes
  useEffect(() => {
    loadAnalytics()
  }, [dateRange])

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleRefresh = async () => {
    await loadAnalytics(true)
  }

  const handleExport = () => {
    if (!data) return

    // Create CSV export
    const csvData = [
      ['Metric', 'Value'],
      ['Total Users', data.overview.totalUsers],
      ['Daily Active Users', data.overview.activeUsers.daily],
      ['Weekly Active Users', data.overview.activeUsers.weekly],
      ['Monthly Active Users', data.overview.activeUsers.monthly],
      ['Total Projects', data.overview.totalProjects],
      ['Total Ideas', data.overview.totalIdeas],
      ['Total Tokens', data.overview.totalTokens],
      ['Total Cost', `$${data.overview.totalCost.toFixed(2)}`]
    ]

    const csv = csvData.map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `analytics-${dateRange}-${new Date().toISOString().split('T')[0]}.csv`
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
          <h1 className="text-3xl font-bold text-slate-900">Analytics</h1>
          <p className="text-slate-600 mt-1">Loading platform metrics...</p>
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
          <h1 className="text-3xl font-bold text-slate-900">Analytics</h1>
        </div>
        <div className="max-w-md mx-auto mt-12 text-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-8">
            <div className="text-red-600 text-6xl mb-4">⚠️</div>
            <h2 className="text-xl font-semibold text-red-900 mb-2">
              Failed to Load Analytics
            </h2>
            <p className="text-red-700 mb-4">{error}</p>
            <button
              onClick={() => loadAnalytics()}
              className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!data) {
    return null
  }

  // ============================================================================
  // RENDER MAIN ANALYTICS VIEW
  // ============================================================================

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="mb-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Analytics</h1>
          <p className="text-slate-600 mt-1">
            Platform usage, metrics, and insights
          </p>
          {lastUpdated && (
            <p className="text-xs text-slate-500 mt-1">
              Last updated: {lastUpdated.toLocaleString()}
              {cacheStatus === 'hit' && ' (cached)'}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Date Range Selector */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-500" />
            <select
              value={dateRange}
              onChange={e => setDateRange(e.target.value as DateRange)}
              className="px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="all">All time</option>
            </select>
          </div>

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Refresh analytics data"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="text-sm font-medium">Refresh</span>
          </button>

          {/* Export Button */}
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition-colors"
            title="Export analytics to CSV"
          >
            <Download className="w-4 h-4" />
            <span className="text-sm font-medium">Export</span>
          </button>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <QuickStatsGrid
        totalUsers={data.overview.totalUsers}
        activeUsers={data.overview.activeUsers}
        totalProjects={data.overview.totalProjects}
        totalIdeas={data.overview.totalIdeas}
        totalTokens={data.overview.totalTokens}
        totalCost={data.overview.totalCost}
      />

      {/* Charts Section */}
      <div className="mt-6">
        <ChartsSection
          tokenUsage={data.timeSeries.tokenUsage}
          userGrowth={data.timeSeries.userGrowth}
          costTrends={data.timeSeries.costTrends}
          projectActivity={data.timeSeries.projectActivity}
        />
      </div>

      {/* Detailed Analytics Tables */}
      <div className="mt-6">
        <DetailedAnalytics
          topUsers={data.topUsers}
          topProjects={data.topProjects}
          topEndpoints={data.topEndpoints}
          onUserClick={(userId) => console.log('View user:', userId)}
          onProjectClick={(projectId) => console.log('View project:', projectId)}
        />
      </div>
    </div>
  )
}
