import { LayoutDashboard, Users, FolderOpen, Database, Settings, Shield, ChevronLeft, ChevronRight, LogOut, Home } from 'lucide-react'
import { User } from '../../types'
import { AdminService } from '../../lib/adminService'

interface AdminSidebarProps {
  currentUser: User
  currentPage: string
  onPageChange: (page: string) => void
  onLogout: () => void
  onBackToApp: () => void
  isCollapsed: boolean
  onToggleCollapse: (collapsed: boolean) => void
}

const AdminSidebar: React.FC<AdminSidebarProps> = ({ 
  currentUser, 
  currentPage, 
  onPageChange, 
  onLogout,
  onBackToApp,
  isCollapsed,
  onToggleCollapse
}) => {
  const adminTools = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      description: 'Platform overview & statistics'
    },
    {
      id: 'users',
      label: 'User Management',
      icon: Users,
      description: 'Manage users, roles & permissions'
    },
    {
      id: 'projects',
      label: 'Project Oversight',
      icon: FolderOpen,
      description: 'Monitor & manage all projects'
    },
    {
      id: 'storage',
      label: 'File Storage',
      icon: Database,
      description: 'Storage analytics & file management'
    },
    {
      id: 'settings',
      label: 'Platform Settings',
      icon: Settings,
      description: 'System configuration & preferences'
    }
  ]

  const handleToggleCollapse = () => {
    const newCollapsedState = !isCollapsed
    onToggleCollapse(newCollapsedState)
  }

  return (
    <div className={`${
      isCollapsed ? 'w-20' : 'w-72'
    } bg-gradient-to-b from-slate-900 to-slate-800 text-white flex flex-col h-screen transition-all duration-300 ease-in-out fixed left-0 top-0 z-50 shadow-2xl border-r border-slate-700/30 backdrop-blur-sm`}>
      
      {/* Header Section */}
      <div className={`${isCollapsed ? 'p-4' : 'p-6'} border-b border-slate-700/50 transition-all duration-300`}>
        {isCollapsed ? (
          /* Collapsed Header */
          <div className="flex flex-col items-center space-y-4">
            <div className="bg-gradient-to-br from-red-500 to-orange-600 rounded-xl p-3 shadow-lg">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <button
              onClick={handleToggleCollapse}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          /* Expanded Header */
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="bg-gradient-to-br from-red-500 to-orange-600 rounded-xl p-3 shadow-lg">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Admin Portal</h2>
                <p className="text-slate-300 text-sm">Platform Management</p>
              </div>
            </div>
            <button
              onClick={handleToggleCollapse}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Navigation Items */}
      <div className="flex-1 overflow-y-auto py-6">
        <nav className="space-y-2">
          {/* Back to App */}
          <div className={`${isCollapsed ? 'px-3' : 'px-6'} mb-4`}>
            <button
              onClick={onBackToApp}
              className={`
                w-full flex items-center transition-all duration-200 rounded-xl p-3
                bg-blue-600/20 border border-blue-500/30 text-blue-200 hover:bg-blue-600/30 hover:border-blue-400/50
                ${isCollapsed ? 'justify-center' : 'space-x-3'}
              `}
            >
              <Home className="w-5 h-5 flex-shrink-0" />
              {!isCollapsed && (
                <div className="text-left">
                  <div className="font-medium text-sm">Back to App</div>
                  <div className="text-xs text-blue-300 opacity-80">Return to main platform</div>
                </div>
              )}
            </button>
          </div>

          {/* Admin Tools */}
          {adminTools.map((tool) => (
            <div key={tool.id} className={`${isCollapsed ? 'px-3' : 'px-6'}`}>
              <button
                onClick={() => onPageChange(tool.id)}
                className={`
                  w-full flex items-center transition-all duration-200 rounded-xl p-3
                  ${currentPage === tool.id
                    ? 'bg-white/10 border border-white/20 text-white shadow-lg'
                    : 'text-slate-300 hover:text-white hover:bg-white/5 hover:border-white/10 border border-transparent'
                  }
                  ${isCollapsed ? 'justify-center' : 'space-x-3'}
                `}
              >
                <tool.icon className="w-5 h-5 flex-shrink-0" />
                {!isCollapsed && (
                  <div className="text-left">
                    <div className="font-medium text-sm">{tool.label}</div>
                    <div className="text-xs text-slate-400 opacity-80">{tool.description}</div>
                  </div>
                )}
              </button>
            </div>
          ))}
        </nav>
      </div>

      {/* User Info & Logout */}
      <div className={`${isCollapsed ? 'p-3' : 'p-6'} border-t border-slate-700/50`}>
        {isCollapsed ? (
          <div className="flex flex-col items-center space-y-3">
            <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-orange-600 rounded-xl flex items-center justify-center text-white text-sm font-bold">
              {currentUser.full_name ? currentUser.full_name.split(' ').map(n => n[0]).join('') : currentUser.email[0].toUpperCase()}
            </div>
            <button
              onClick={onLogout}
              className="p-2 text-slate-400 hover:text-white hover:bg-red-600/20 rounded-lg transition-all duration-200"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div>
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-orange-600 rounded-xl flex items-center justify-center text-white font-bold">
                {currentUser.full_name ? currentUser.full_name.split(' ').map(n => n[0]).join('') : currentUser.email[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white truncate">
                  {currentUser.full_name || currentUser.email}
                </p>
                <p className="text-xs text-slate-300">
                  {AdminService.isSuperAdmin(currentUser) ? 'Super Admin' : 'Administrator'}
                </p>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="w-full flex items-center space-x-2 p-3 text-slate-300 hover:text-white hover:bg-red-600/20 rounded-xl transition-all duration-200"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm">Logout</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default AdminSidebar