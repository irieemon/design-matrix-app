/**
 * Charts Section Component
 *
 * Time-series data visualization using Recharts:
 * - Token Usage Chart (Line)
 * - User Growth Chart (Area)
 * - Cost Trends Chart (Line + Bar Combo)
 * - Project Activity Chart (Bar)
 *
 * Features:
 * - Responsive chart containers
 * - Interactive tooltips
 * - Color-coded data series
 * - Formatted axes and legends
 * - Smooth animations
 *
 * Note: Requires 'recharts' package
 * Install: npm install recharts
 */

import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'
import { TrendingUp, Users, DollarSign, FolderKanban } from 'lucide-react'

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface TimeSeriesDataPoint {
  date: string
  value: number
  label?: string
}

interface ChartsSectionProps {
  tokenUsage: TimeSeriesDataPoint[]
  userGrowth: TimeSeriesDataPoint[]
  costTrends: TimeSeriesDataPoint[]
  projectActivity: TimeSeriesDataPoint[]
}

interface ChartCardProps {
  title: string
  icon: React.ElementType
  iconColor: string
  children: React.ReactNode
}

// ============================================================================
// CHART CARD WRAPPER
// ============================================================================

function ChartCard({ title, icon: Icon, iconColor, children }: ChartCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex items-center gap-2 mb-4">
        <div className={`p-2 ${iconColor} bg-opacity-10 rounded-lg`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
        <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
      </div>
      {children}
    </div>
  )
}

// ============================================================================
// CUSTOM TOOLTIP COMPONENT
// ============================================================================

interface CustomTooltipProps {
  active?: boolean
  payload?: any[]
  label?: string
  valueFormatter?: (value: number) => string
}

function CustomTooltip({ active, payload, label, valueFormatter }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) {
    return null
  }

  const formatter = valueFormatter || ((value: number) => value.toLocaleString())

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3">
      <p className="text-sm font-medium text-slate-900 mb-2">{label}</p>
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2 text-sm">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-slate-600">{entry.name}:</span>
          <span className="font-semibold text-slate-900">
            {formatter(entry.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

// ============================================================================
// DATA TRANSFORMATION UTILITIES
// ============================================================================

/**
 * Format date for display on X-axis
 */
function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch {
    return dateStr
  }
}

/**
 * Format large numbers with K/M suffix
 */
function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`
  }
  return num.toLocaleString()
}

/**
 * Format currency values
 */
function formatCurrency(value: number): string {
  return `$${value.toFixed(2)}`
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ChartsSection({
  tokenUsage,
  userGrowth,
  costTrends,
  projectActivity
}: ChartsSectionProps) {
  // Check if we have data to display
  const hasData =
    tokenUsage.length > 0 ||
    userGrowth.length > 0 ||
    costTrends.length > 0 ||
    projectActivity.length > 0

  if (!hasData) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-8">
        <div className="text-center">
          <div className="text-slate-400 text-6xl mb-4">📊</div>
          <h3 className="text-lg font-medium text-slate-900 mb-2">
            No Chart Data Available
          </h3>
          <p className="text-slate-600">
            Analytics data will appear once users interact with the platform
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Token Usage Chart - Line Chart */}
        {tokenUsage.length > 0 && (
          <ChartCard
            title="Token Usage Trend"
            icon={TrendingUp}
            iconColor="text-green-600"
          >
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={tokenUsage}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  stroke="#cbd5e1"
                />
                <YAxis
                  tickFormatter={formatNumber}
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  stroke="#cbd5e1"
                />
                <Tooltip
                  content={<CustomTooltip valueFormatter={formatNumber} />}
                />
                <Legend
                  wrapperStyle={{ paddingTop: '20px' }}
                  iconType="line"
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  name="Tokens"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ fill: '#10b981', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {/* User Growth Chart - Area Chart */}
        {userGrowth.length > 0 && (
          <ChartCard
            title="User Growth"
            icon={Users}
            iconColor="text-blue-600"
          >
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={userGrowth}>
                <defs>
                  <linearGradient id="userGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  stroke="#cbd5e1"
                />
                <YAxis
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  stroke="#cbd5e1"
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ paddingTop: '20px' }}
                  iconType="rect"
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  name="Users"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#userGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {/* Cost Trends Chart - Line + Bar Combo */}
        {costTrends.length > 0 && (
          <ChartCard
            title="Cost Trends"
            icon={DollarSign}
            iconColor="text-red-600"
          >
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={costTrends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  stroke="#cbd5e1"
                />
                <YAxis
                  yAxisId="left"
                  tickFormatter={formatCurrency}
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  stroke="#cbd5e1"
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  stroke="#cbd5e1"
                />
                <Tooltip
                  content={<CustomTooltip valueFormatter={formatCurrency} />}
                />
                <Legend
                  wrapperStyle={{ paddingTop: '20px' }}
                  iconType="line"
                />
                <Bar
                  yAxisId="right"
                  dataKey="value"
                  name="API Calls"
                  fill="#fca5a5"
                  opacity={0.6}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="value"
                  name="Cost"
                  stroke="#dc2626"
                  strokeWidth={2}
                  dot={{ fill: '#dc2626', r: 4 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {/* Project Activity Chart - Bar Chart */}
        {projectActivity.length > 0 && (
          <ChartCard
            title="Project Activity"
            icon={FolderKanban}
            iconColor="text-purple-600"
          >
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={projectActivity}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  stroke="#cbd5e1"
                />
                <YAxis
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  stroke="#cbd5e1"
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ paddingTop: '20px' }}
                  iconType="rect"
                />
                <Bar
                  dataKey="value"
                  name="Projects"
                  fill="#8b5cf6"
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
      </div>
    </div>
  )
}
