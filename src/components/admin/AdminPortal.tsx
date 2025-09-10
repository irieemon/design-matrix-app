import { useState, useEffect } from 'react'
import { Shield, AlertCircle, Home } from 'lucide-react'
import { User } from '../../types'
import { AdminService } from '../../lib/adminService'
import AdminSidebar from './AdminSidebar'
import AdminDashboard from './AdminDashboard'
import UserManagement from './UserManagement'
import ProjectManagement from './ProjectManagement'
import { logger } from '../../utils/logger'

interface AdminPortalProps {
  currentUser: User
  onBackToApp: () => void
  onLogout: () => void
}

const AdminPortal: React.FC<AdminPortalProps> = ({ currentUser, onBackToApp, onLogout }) => {
  const [currentPage, setCurrentPage] = useState('dashboard')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [hasAccess, setHasAccess] = useState<boolean | null>(null)

  useEffect(() => {
    // Check admin access
    const checkAccess = async () => {
      const isAdmin = AdminService.isAdmin(currentUser)
      setHasAccess(isAdmin)
      
      if (!isAdmin) {
        logger.warn('Non-admin user attempted to access admin portal:', currentUser.email)
      }
    }

    checkAccess()
  }, [currentUser])

  // Show loading while checking access
  if (hasAccess === null) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-red-600 animate-pulse" />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">Verifying Access</h3>
          <p className="text-slate-400">Checking administrative privileges...</p>
        </div>
      </div>
    )
  }

  // Show access denied for non-admin users
  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center">
          <div className="w-20 h-20 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-10 h-10 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-4">Access Denied</h1>
          <p className="text-slate-400 mb-8">
            You don't have administrator privileges to access this portal. 
            Contact your system administrator if you believe this is an error.
          </p>
          <div className="space-y-3">
            <button
              onClick={onBackToApp}
              className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
            >
              <Home className="w-5 h-5" />
              <span>Back to Application</span>
            </button>
            <button
              onClick={onLogout}
              className="w-full px-6 py-3 border border-slate-600 text-slate-300 rounded-xl hover:bg-slate-800 transition-colors"
            >
              Logout
            </button>
          </div>
          <div className="mt-8 p-4 bg-slate-800 rounded-xl">
            <p className="text-xs text-slate-500">
              Logged in as: {currentUser.email}
            </p>
            <p className="text-xs text-slate-500">
              Role: {currentUser.role || 'user'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <AdminDashboard currentUser={currentUser} />
      case 'users':
        return <UserManagement currentUser={currentUser} />
      case 'projects':
        return <ProjectManagement currentUser={currentUser} />
      case 'storage':
        return (
          <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-medium text-slate-900 mb-2">File Storage Management</h3>
              <p className="text-slate-600">Coming soon - Storage analytics and file management tools</p>
            </div>
          </div>
        )
      case 'settings':
        return (
          <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="text-lg font-medium text-slate-900 mb-2">Platform Settings</h3>
              <p className="text-slate-600">Coming soon - System configuration and preferences</p>
            </div>
          </div>
        )
      default:
        return <AdminDashboard currentUser={currentUser} />
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminSidebar
        currentUser={currentUser}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        onLogout={onLogout}
        onBackToApp={onBackToApp}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={setSidebarCollapsed}
      />
      
      <main className={`${sidebarCollapsed ? 'ml-20' : 'ml-72'} transition-all duration-300 ease-in-out min-h-screen`}>
        {renderCurrentPage()}
      </main>
    </div>
  )
}

export default AdminPortal