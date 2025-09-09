import { useState, useEffect } from 'react'
import { Users, FolderOpen, Lightbulb, Activity, TrendingUp, Database, AlertCircle, CheckCircle } from 'lucide-react'
import { PlatformStats, User } from '../../types'
import { AdminService } from '../../lib/adminService'

interface AdminDashboardProps {
  currentUser: User
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ currentUser }) => {
  const [stats, setStats] = useState<PlatformStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    setIsLoading(true)
    try {
      const platformStats = await AdminService.getPlatformStats()
      setStats(platformStats)
    } catch (error) {
      console.error('Error loading platform stats:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const statCards = stats ? [
    {
      title: 'Total Users',
      value: AdminService.formatNumber(stats.total_users),
      icon: Users,
      color: 'blue',
      trend: `+${stats.new_users_7d} this week`,
      trendUp: true
    },
    {
      title: 'Active Users (30d)',
      value: AdminService.formatNumber(stats.active_users_30d),
      icon: Activity,
      color: 'green',
      trend: `${Math.round((stats.active_users_30d / stats.total_users) * 100)}% active`,
      trendUp: true
    },
    {
      title: 'Total Projects',
      value: AdminService.formatNumber(stats.total_projects),
      icon: FolderOpen,
      color: 'purple',
      trend: `+${stats.new_projects_7d} this week`,
      trendUp: true
    },
    {
      title: 'Active Projects',
      value: AdminService.formatNumber(stats.active_projects),
      icon: CheckCircle,
      color: 'emerald',
      trend: `${Math.round((stats.active_projects / stats.total_projects) * 100)}% active`,
      trendUp: true
    },
    {
      title: 'Total Ideas',
      value: AdminService.formatNumber(stats.total_ideas),
      icon: Lightbulb,
      color: 'yellow',
      trend: `${(stats.total_ideas / stats.total_projects).toFixed(1)} per project`,
      trendUp: true
    },
    {
      title: 'File Storage',
      value: AdminService.formatFileSize(stats.total_file_size),
      icon: Database,
      color: 'indigo',
      trend: `${AdminService.formatNumber(stats.total_files)} files`,
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
                Platform overview and management tools
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 px-6 py-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    Welcome, {currentUser.full_name || currentUser.email}
                  </p>
                  <p className="text-xs text-slate-500">
                    {AdminService.isSuperAdmin(currentUser) ? 'Super Admin' : 'Admin'} Access
                  </p>
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

        {/* Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">System Health</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-green-50 rounded-xl">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-medium text-green-900">Database</span>
                </div>
                <span className="text-sm text-green-700">Healthy</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-green-50 rounded-xl">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-medium text-green-900">File Storage</span>
                </div>
                <span className="text-sm text-green-700">Operational</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-yellow-50 rounded-xl">
                <div className="flex items-center space-x-3">
                  <AlertCircle className="w-5 h-5 text-yellow-600" />
                  <span className="text-sm font-medium text-yellow-900">AI Service</span>
                </div>
                <span className="text-sm text-yellow-700">Limited</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">Recent Activity</h2>
            <div className="space-y-4">
              <div className="flex items-center space-x-3 p-3 hover:bg-slate-50 rounded-lg">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Users className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900">New user registration</p>
                  <p className="text-xs text-slate-500">sarah.wilson@startup.io • 2 minutes ago</p>
                </div>
              </div>
              <div className="flex items-center space-x-3 p-3 hover:bg-slate-50 rounded-lg">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                  <FolderOpen className="w-4 h-4 text-purple-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900">Project created</p>
                  <p className="text-xs text-slate-500">Mobile App Redesign • 15 minutes ago</p>
                </div>
              </div>
              <div className="flex items-center space-x-3 p-3 hover:bg-slate-50 rounded-lg">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <Database className="w-4 h-4 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900">Large file uploaded</p>
                  <p className="text-xs text-slate-500">presentation.pdf (12.5 MB) • 1 hour ago</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminDashboard