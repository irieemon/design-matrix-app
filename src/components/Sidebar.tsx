import { Target, Home, User, Database, BarChart3, FolderOpen, LogOut, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'

interface SidebarProps {
  currentPage: string
  currentUser: string
  onPageChange: (page: string) => void
  onLogout: () => void
  onToggleCollapse: (collapsed: boolean) => void
}

const Sidebar: React.FC<SidebarProps> = ({ currentPage, currentUser, onPageChange, onLogout, onToggleCollapse }) => {
  const [isCollapsed, setIsCollapsed] = useState(false)

  const handleToggleCollapse = () => {
    const newCollapsedState = !isCollapsed
    setIsCollapsed(newCollapsedState)
    onToggleCollapse(newCollapsedState)
  }

  const menuItems = [
    {
      id: 'matrix',
      label: 'Design Matrix',
      icon: Home
    },
    {
      id: 'projects',
      label: 'Projects',
      icon: FolderOpen
    },
    {
      id: 'data',
      label: 'Data Management',
      icon: Database
    },
    {
      id: 'reports',
      label: 'Reports & Analytics', 
      icon: BarChart3
    }
  ]

  return (
    <div className={`${isCollapsed ? 'w-16' : 'w-64'} bg-slate-900 text-white flex flex-col h-screen transition-all duration-300 fixed left-0 top-0 z-50`}>
      {/* Logo/Header */}
      <div className="p-6 border-b border-slate-700">
        <div className="flex items-center justify-between">
          {!isCollapsed ? (
            <>
              <div className="flex items-center space-x-3">
                <div className="bg-white rounded-lg p-2">
                  <Target className="w-6 h-6 text-slate-900" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Prioritas</h2>
                  <p className="text-xs text-slate-400">v2.0</p>
                </div>
              </div>
              <button
                onClick={handleToggleCollapse}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            </>
          ) : (
            <div className="w-full flex flex-col items-center space-y-2">
              <div className="bg-white rounded-lg p-2">
                <Target className="w-6 h-6 text-slate-900" />
              </div>
              <button
                onClick={handleToggleCollapse}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 px-4 py-6 space-y-2">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onPageChange(item.id)}
            className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2' : 'space-x-3 px-4'} py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
              currentPage === item.id || (item.id === 'matrix' && currentPage === 'home')
                ? 'bg-white text-slate-900 shadow-lg'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title={isCollapsed ? item.label : ''}
          >
            <item.icon className="w-5 h-5" />
            {!isCollapsed && <span>{item.label}</span>}
          </button>
        ))}
      </nav>

      {/* User Section */}
      <div className="p-4 border-t border-slate-700 space-y-3">
        {/* User Info - Clickable to go to settings */}
        <button
          onClick={() => onPageChange('user')}
          className={`w-full transition-all duration-200 ${
            currentPage === 'user'
              ? 'bg-white/10'
              : 'hover:bg-slate-800/50'
          }`}
          title={isCollapsed ? `${currentUser} - Settings` : ''}
        >
          {!isCollapsed ? (
            <div className="flex items-center space-x-3 px-3 py-2 rounded-lg">
              <div className="w-8 h-8 bg-slate-600 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-slate-200" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium text-white truncate">{currentUser}</p>
                <p className="text-xs text-slate-400">Click for settings</p>
              </div>
            </div>
          ) : (
            <div className="flex justify-center py-2">
              <div className="w-8 h-8 bg-slate-600 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-slate-200" />
              </div>
            </div>
          )}
        </button>

        {/* Logout */}
        <div className="space-y-1">
          <button
            onClick={onLogout}
            className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2' : 'space-x-3 px-3'} py-2 rounded-lg text-sm text-slate-400 hover:text-red-400 hover:bg-red-900/20 transition-all duration-200`}
            title={isCollapsed ? 'Sign Out' : ''}
          >
            <LogOut className="w-4 h-4" />
            {!isCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </div>
    </div>
  )
}

export default Sidebar