import { useState, useEffect } from 'react'
import { Shield, AlertCircle, Home } from 'lucide-react'
import { User } from '../../types'
import { AdminService } from '../../lib/adminService'
import { AdminLayout } from './AdminLayout'
import AdminDashboard from './AdminDashboard'
import UserManagement from './UserManagement'
import ProjectManagement from './ProjectManagement'
import FAQAdmin from './FAQAdmin'
import AdminAnalytics from './AdminAnalytics'
import TokenSpendAnalytics from './TokenSpendAnalytics'
import { logger } from '../../utils/logger'

interface AdminPortalProps {
  currentUser: User
  onBackToApp: () => void
  onLogout: () => void
}

const AdminPortal: React.FC<AdminPortalProps> = ({ currentUser, onBackToApp, onLogout }) => {
  const [hasAccess, setHasAccess] = useState<boolean | null>(null)
  const [currentPage, setCurrentPage] = useState<string>('admin')

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
      case 'admin':
        return <AdminDashboard currentUser={currentUser} />
      case 'admin/users':
        return <UserManagement currentUser={currentUser} />
      case 'admin/projects':
        return <ProjectManagement currentUser={currentUser} />
      case 'admin/faq':
        return <FAQAdmin />
      case 'admin/analytics':
        return <AdminAnalytics currentUser={currentUser} />
      case 'admin/tokens':
        return <TokenSpendAnalytics currentUser={currentUser} />
      case 'admin/settings':
        return (
          <div className="p-8">
            <div className="max-w-4xl mx-auto text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-medium text-slate-900 mb-2">Coming Soon</h3>
              <p className="text-slate-600">This feature is under development</p>
            </div>
          </div>
        )
      default:
        return <AdminDashboard currentUser={currentUser} />
    }
  }

  return (
    <AdminLayout
      currentPage={currentPage}
      onPageChange={setCurrentPage}
      onBackToApp={onBackToApp}
    >
      {renderCurrentPage()}
    </AdminLayout>
  )
}

export default AdminPortal