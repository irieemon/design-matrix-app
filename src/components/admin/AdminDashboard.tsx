import { useState, useEffect } from 'react'
import { Users, FolderOpen, Lightbulb, Activity, TrendingUp, DollarSign, AlertCircle, RefreshCw } from 'lucide-react'
import { User } from '../../types'
import { AdminRepository, AdminDashboardStats } from '../../lib/repositories'
import { AdminService } from '../../lib/adminService'
import { logger } from '../../utils/logger'

interface AdminDashboardProps {
  currentUser: User
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ currentUser }) => {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    setIsLoading(true)
    try {
      const dashboardStats = await AdminRepository.getDashboardStats()
      setStats(dashboardStats)
    } catch (error) {
      logger.error('Error loading dashboard stats:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const refreshStats = async () => {
    setIsRefreshing(true)
    try {
      // Refresh materialized view
      await AdminRepository.refreshUserStats()
      // Reload stats
      await loadStats()
      logger.info('Admin stats refreshed successfully')
    } catch (error) {
      logger.error('Error refreshing stats:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  const statCards = stats ? [
    {
      title: 'Total Users',
      value: AdminService.formatNumber(stats.totalUsers),
      icon: Users,
      color: 'blue',
      trend: `${AdminService.formatNumber(stats.activeUsers30d)} active (30d)`,
      trendUp: true
    },
    {
      title: 'Total Projects',
      value: AdminService.formatNumber(stats.totalProjects),
      icon: FolderOpen,
      color: 'purple',
      trend: `${AdminService.formatNumber(stats.totalIdeas)} total ideas`,
      trendUp: true
    },
    {
      title: 'Monthly AI Calls',
      value: AdminService.formatNumber(stats.monthlyAICalls),
      icon: Activity,
      color: 'green',
      trend: `${AdminService.formatNumber(stats.monthlyTokens)} tokens`,
      trendUp: true
    },
    {
      title: 'Monthly API Cost',
      value: `$${stats.monthlyAPIcost.toFixed(2)}`,
      icon: DollarSign,
      color: 'red',
      trend: 'OpenAI spend',
      trendUp: false
    }
  ] : []

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Activity className="w-8 h-8 text-blue-600 animate-pulse" />
          </div>
          <h3 className="text-lg font-medium text-slate-900 mb-2">Loading Admin Dashboard</h3>
          <p className="text-slate-500">Gathering platform statistics...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Admin Dashboard</h1>
              <p className="text-slate-600 mt-2">
                Platform overview and token analytics
              </p>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={refreshStats}
                disabled={isRefreshing}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span className="text-sm font-medium">Refresh</span>
              </button>
              <div className="bg-white rounded-2xl border border-slate-200 px-6 py-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                    <AlertCircle className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {currentUser.full_name || currentUser.email}
                    </p>
                    <p className="text-xs text-slate-500">
                      {AdminService.isSuperAdmin(currentUser) ? 'Super Admin' : 'Admin'} Access
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {statCards.map((card, index) => (
            <div key={index} className="bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className={`w-12 h-12 bg-${card.color}-100 rounded-xl flex items-center justify-center`}>
                  <card.icon className={`w-6 h-6 text-${card.color}-600`} />
                </div>
                <div className={`flex items-center space-x-1 text-sm ${card.trendUp ? 'text-green-600' : 'text-slate-600'}`}>
                  {card.trendUp && <TrendingUp className="w-4 h-4" />}
                  <span>{card.trend}</span>
                </div>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-slate-900 mb-1">
                  {card.value}
                </h3>
                <p className="text-sm text-slate-600">
                  {card.title}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Subscription Tiers & Quick Links */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">Subscription Breakdown</h2>
            {stats && (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                      <Users className="w-5 h-5 text-slate-600" />
                    </div>
                    <span className="text-sm font-medium text-slate-900">Free Tier</span>
                  </div>
                  <span className="text-lg font-bold text-slate-900">{AdminService.formatNumber(stats.freeUsers)}</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-blue-50 rounded-xl">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Users className="w-5 h-5 text-blue-600" />
                    </div>
                    <span className="text-sm font-medium text-blue-900">Team Tier</span>
                  </div>
                  <span className="text-lg font-bold text-blue-900">{AdminService.formatNumber(stats.teamUsers)}</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-purple-50 rounded-xl">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                      <Users className="w-5 h-5 text-purple-600" />
                    </div>
                    <span className="text-sm font-medium text-purple-900">Enterprise Tier</span>
                  </div>
                  <span className="text-lg font-bold text-purple-900">{AdminService.formatNumber(stats.enterpriseUsers)}</span>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">Quick Links</h2>
            <div className="space-y-3">
              <a href="/admin/users" className="flex items-center justify-between p-4 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors group">
                <div className="flex items-center space-x-3">
                  <Users className="w-5 h-5 text-blue-600" />
                  <span className="text-sm font-medium text-blue-900">User Management</span>
                </div>
                <TrendingUp className="w-4 h-4 text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
              <a href="/admin/tokens" className="flex items-center justify-between p-4 bg-green-50 hover:bg-green-100 rounded-xl transition-colors group">
                <div className="flex items-center space-x-3">
                  <DollarSign className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-medium text-green-900">Token Analytics</span>
                </div>
                <TrendingUp className="w-4 h-4 text-green-600 opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
              <a href="/admin/faq" className="flex items-center justify-between p-4 bg-purple-50 hover:bg-purple-100 rounded-xl transition-colors group">
                <div className="flex items-center space-x-3">
                  <Lightbulb className="w-5 h-5 text-purple-600" />
                  <span className="text-sm font-medium text-purple-900">FAQ Management</span>
                </div>
                <TrendingUp className="w-4 h-4 text-purple-600 opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminDashboard