import React, { useEffect, useState } from 'react'
import { UserRepository } from '../../lib/repositories/userRepository'
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  BarChart3,
  DollarSign,
  HelpCircle,
  Settings,
  ArrowLeft
} from 'lucide-react'

interface AdminLayoutProps {
  children: React.ReactNode
  currentPage?: string
  onPageChange?: (page: string) => void
  onBackToApp?: () => void
}

/**
 * AdminLayout Component
 *
 * Provides the admin panel layout with sidebar navigation.
 * Includes admin access control - non-admins are redirected to home.
 */
export const AdminLayout: React.FC<AdminLayoutProps> = ({
  children,
  currentPage = 'admin',
  onPageChange,
  onBackToApp
}) => {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAdminAccess()
  }, [])

  const checkAdminAccess = async () => {
    try {
      const user = await UserRepository.getCurrentUser()
      if (!user) {
        setIsAdmin(false)
        setLoading(false)
        return
      }

      const adminStatus = await UserRepository.isUserAdmin(user.id)
      setIsAdmin(adminStatus)
    } catch (error) {
      console.error('Failed to check admin access:', error)
      setIsAdmin(false)
    } finally {
      setLoading(false)
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Checking admin access...</p>
        </div>
      </div>
    )
  }

  // Access denied - handled by AdminPortal
  if (isAdmin === false) {
    return null
  }

  const navItems = [
    { page: 'admin', icon: LayoutDashboard, label: 'Dashboard' },
    { page: 'admin/users', icon: Users, label: 'Users' },
    { page: 'admin/projects', icon: FolderKanban, label: 'Projects' },
    { page: 'admin/analytics', icon: BarChart3, label: 'Analytics' },
    { page: 'admin/tokens', icon: DollarSign, label: 'Token Spend' },
    { page: 'admin/faq', icon: HelpCircle, label: 'FAQ' },
    { page: 'admin/settings', icon: Settings, label: 'Settings' }
  ]

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-800">Admin Panel</h1>
          <p className="text-sm text-gray-500">Prioritas</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = currentPage === item.page

            return (
              <button
                key={item.page}
                onClick={() => onPageChange && onPageChange(item.page)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-600 font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        {/* Back to App */}
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={onBackToApp}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to App</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
