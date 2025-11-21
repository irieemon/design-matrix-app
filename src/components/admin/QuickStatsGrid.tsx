/**
 * Quick Stats Grid Component
 *
 * Displays high-level KPIs in a 4-column responsive grid:
 * - Active Users (with growth trend)
 * - Total Projects (with ideas count)
 * - AI Token Usage (with cost)
 * - Monthly Revenue (with growth percentage)
 *
 * Features:
 * - Color-coded stat cards
 * - Growth indicators (increase/decrease/neutral)
 * - Icon representation for each metric
 * - Responsive grid layout
 */

import { Users, FolderKanban, Zap, DollarSign, TrendingUp, TrendingDown, Minus } from 'lucide-react'

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface QuickStatsGridProps {
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
  monthlyRevenue?: number
}

interface StatCardProps {
  title: string
  value: string | number
  subtitle: string
  icon: React.ElementType
  iconColor: string
  bgColor: string
  textColor: string
  change?: number
  changeType?: 'increase' | 'decrease' | 'neutral'
}

// ============================================================================
// STAT CARD COMPONENT
// ============================================================================

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor,
  bgColor,
  textColor,
  change,
  changeType = 'neutral'
}: StatCardProps) {
  // ✅ CRITICAL FIX: Don't create components during render
  // Use the component reference directly in JSX instead
  const getTrendIcon = () => {
    if (changeType === 'increase') return TrendingUp
    if (changeType === 'decrease') return TrendingDown
    return Minus
  }

  const getTrendColor = () => {
    if (changeType === 'increase') return 'text-green-600'
    if (changeType === 'decrease') return 'text-red-600'
    return 'text-slate-500'
  }

  return (
    <div className={`${bgColor} rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow`}>
      {/* Header with icon */}
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 ${iconColor} bg-opacity-10 rounded-lg`}>
          <Icon className={`w-6 h-6 ${iconColor}`} />
        </div>
        {change !== undefined && (() => {
          const TrendIcon = getTrendIcon()
          return (
            <div className={`flex items-center gap-1 ${getTrendColor()}`}>
              <TrendIcon className="w-4 h-4" />
              <span className="text-xs font-medium">{Math.abs(change)}%</span>
            </div>
          )
        })()}
      </div>

      {/* Title */}
      <h3 className="text-sm font-medium text-slate-600 mb-1">{title}</h3>

      {/* Value */}
      <div className={`text-4xl font-bold ${textColor} mb-2`}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>

      {/* Subtitle */}
      <p className="text-xs text-slate-500">{subtitle}</p>
    </div>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function QuickStatsGrid({
  totalUsers,
  activeUsers,
  totalProjects,
  totalIdeas,
  totalTokens,
  totalCost,
  monthlyRevenue = 0
}: QuickStatsGridProps) {
  // Calculate engagement rate (monthly active / total users)
  const engagementRate = totalUsers > 0
    ? Math.round((activeUsers.monthly / totalUsers) * 100)
    : 0

  // Calculate average ideas per project
  const avgIdeasPerProject = totalProjects > 0
    ? (totalIdeas / totalProjects).toFixed(1)
    : '0.0'

  // Calculate cost per million tokens
  const costPerMillionTokens = totalTokens > 0
    ? (totalCost / (totalTokens / 1000000)).toFixed(2)
    : '0.00'

  // Format token count for display
  const formattedTokens = totalTokens >= 1000000
    ? `${(totalTokens / 1000000).toFixed(2)}M`
    : totalTokens >= 1000
    ? `${(totalTokens / 1000).toFixed(1)}K`
    : totalTokens.toString()

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Users Card */}
      <StatCard
        title="Active Users"
        value={activeUsers.monthly}
        subtitle={`${totalUsers} total users (${engagementRate}% active)`}
        icon={Users}
        iconColor="text-blue-600"
        bgColor="bg-blue-50"
        textColor="text-blue-900"
        change={engagementRate}
        changeType={engagementRate >= 50 ? 'increase' : engagementRate >= 25 ? 'neutral' : 'decrease'}
      />

      {/* Projects Card */}
      <StatCard
        title="Total Projects"
        value={totalProjects}
        subtitle={`${totalIdeas} total ideas (avg ${avgIdeasPerProject}/project)`}
        icon={FolderKanban}
        iconColor="text-purple-600"
        bgColor="bg-purple-50"
        textColor="text-purple-900"
      />

      {/* Token Usage Card */}
      <StatCard
        title="AI Token Usage"
        value={formattedTokens}
        subtitle={`$${costPerMillionTokens} per million tokens`}
        icon={Zap}
        iconColor="text-green-600"
        bgColor="bg-green-50"
        textColor="text-green-900"
      />

      {/* Cost Card */}
      <StatCard
        title="Total API Cost"
        value={`$${totalCost.toFixed(2)}`}
        subtitle={monthlyRevenue > 0
          ? `${(totalCost / monthlyRevenue * 100).toFixed(1)}% of revenue`
          : 'OpenAI API charges'
        }
        icon={DollarSign}
        iconColor="text-red-600"
        bgColor="bg-red-50"
        textColor="text-red-900"
        change={monthlyRevenue > 0 ? Math.round((totalCost / monthlyRevenue) * 100) : undefined}
        changeType={totalCost < monthlyRevenue * 0.3 ? 'increase' : 'neutral'}
      />
    </div>
  )
}
