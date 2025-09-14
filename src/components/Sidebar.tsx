import { Home, User, Database, BarChart3, FolderOpen, LogOut, ChevronLeft, ChevronRight, Map, Users, Shield } from 'lucide-react'
import { useState } from 'react'
import { Project, User as UserType } from '../types'
import { AdminService } from '../lib/adminService'
import PrioritasLogo from './PrioritasLogo'

interface SidebarProps {
  currentPage: string
  currentUser: string
  currentUserObj: UserType | null
  currentProject: Project | null
  onPageChange: (page: string) => void
  onLogout: () => void
  onAdminAccess?: () => void
  onToggleCollapse: (collapsed: boolean) => void
}

const Sidebar: React.FC<SidebarProps> = ({ currentPage, currentUser, currentUserObj, currentProject, onPageChange, onLogout, onAdminAccess, onToggleCollapse }) => {
  const [isCollapsed, setIsCollapsed] = useState(false)

  const handleToggleCollapse = () => {
    const newCollapsedState = !isCollapsed
    setIsCollapsed(newCollapsedState)
    onToggleCollapse(newCollapsedState)
  }

  // Project tools (only shown when a project is selected)
  const projectTools = [
    {
      id: 'matrix',
      label: 'Design Matrix',
      icon: Home,
      description: 'Priority matrix & ideas'
    },
    {
      id: 'files',
      label: 'File Management',
      icon: FolderOpen,
      description: 'Upload & organize project files'
    },
    {
      id: 'roadmap',
      label: 'Roadmap',
      icon: Map,
      description: 'Strategic roadmap & epics'
    },
    {
      id: 'reports',
      label: 'Reports & Analytics', 
      icon: BarChart3,
      description: 'Insights & analysis'
    },
    {
      id: 'collaboration',
      label: 'Team Collaboration',
      icon: Users,
      description: 'Manage team members & permissions'
    },
    {
      id: 'data',
      label: 'Data Management',
      icon: Database,
      description: 'Export & import data'
    }
  ]

  return (
    <div className={`${
      isCollapsed ? 'w-20' : 'w-72'
    } bg-gradient-to-b from-slate-900 to-slate-800 text-white flex flex-col h-screen transition-all duration-300 ease-in-out fixed left-0 top-0 z-50 shadow-2xl border-r border-slate-700/30 backdrop-blur-sm`}>
      
      {/* Header Section */}
      <div className={`${isCollapsed ? 'p-4' : 'p-6'} border-b border-slate-700/50 transition-all duration-300`}>
        {isCollapsed ? (
          /* Collapsed Header */
          <div className="flex flex-col items-center space-y-4">
            <div className="bg-gradient-to-br from-white to-slate-100 rounded-xl p-3 shadow-lg">
              <PrioritasLogo className="text-blue-600" size={24} />
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
              <div className="bg-gradient-to-br from-white to-slate-100 rounded-xl p-3 shadow-lg">
                <PrioritasLogo className="text-blue-600" size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Prioritas</h2>
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

      {/* Navigation Section */}
      <nav className={`flex-1 ${isCollapsed ? 'px-3 py-6' : 'px-6 py-8'} overflow-y-auto transition-all duration-300`}>
        
        {/* Projects Button */}
        <div className="mb-8">
          <button
            onClick={() => onPageChange('projects')}
            className={`group w-full flex items-center ${
              isCollapsed ? 'justify-center p-3' : 'px-4 py-3 space-x-3'
            } rounded-xl text-sm font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ${
              currentPage === 'projects'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
            title={isCollapsed ? 'Projects' : undefined}
          >
            <FolderOpen className={`${isCollapsed ? 'w-5 h-5' : 'w-5 h-5'} ${
              currentPage === 'projects' ? 'text-white' : 'text-blue-400 group-hover:text-white'
            }`} />
            {!isCollapsed && <span>Projects</span>}
          </button>
        </div>

        {/* Current Project Section */}
        {currentProject && (
          <div className="space-y-6">
            
            {/* Project Header */}
            {isCollapsed ? (
              <div className="flex justify-center">
                <div 
                  className="w-12 h-12 bg-gradient-to-br from-slate-800 to-slate-700 rounded-xl flex items-center justify-center border border-slate-600/50 relative"
                  title={currentProject.name}
                >
                  <PrioritasLogo className="text-blue-400" size={20} />
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full"></div>
                </div>
              </div>
            ) : (
              <div>
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
                  Current Project
                </div>
                <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-4 py-3 rounded-xl border border-slate-600/50">
                  <div className="flex items-center space-x-2 text-white font-semibold text-sm">
                    <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
                    <span className="truncate">{currentProject.name}</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1">Active workspace</div>
                </div>
              </div>
            )}

            {/* Project Tools */}
            <div className="space-y-2">
              {projectTools.map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => onPageChange(tool.id)}
                  className={`group w-full flex items-center ${
                    isCollapsed ? 'justify-center p-3' : 'px-4 py-3 space-x-3'
                  } rounded-xl text-sm font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ${
                    currentPage === tool.id || (tool.id === 'matrix' && currentPage === 'home')
                      ? 'bg-gradient-to-r from-white to-slate-50 text-slate-900 shadow-lg shadow-white/20'
                      : 'text-slate-300 hover:text-white hover:bg-gradient-to-r hover:from-slate-800/60 hover:to-slate-700/40'
                  }`}
                  title={isCollapsed ? `${tool.label} - ${tool.description}` : undefined}
                >
                  <tool.icon className={`${isCollapsed ? 'w-5 h-5' : 'w-4 h-4'} ${
                    currentPage === tool.id || (tool.id === 'matrix' && currentPage === 'home')
                      ? 'text-slate-600'
                      : 'text-slate-400 group-hover:text-blue-400'
                  }`} />
                  {!isCollapsed && (
                    <div className="flex-1 text-left min-w-0">
                      <div className="font-semibold text-sm truncate">{tool.label}</div>
                      <div className={`text-xs truncate ${
                        currentPage === tool.id || (tool.id === 'matrix' && currentPage === 'home')
                          ? 'text-slate-500'
                          : 'text-slate-500 group-hover:text-slate-400'
                      }`}>
                        {tool.description}
                      </div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!currentProject && !isCollapsed && (
          <div className="py-12 text-center">
            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
              <div className="w-12 h-12 bg-slate-700 rounded-xl flex items-center justify-center mx-auto mb-4">
                <PrioritasLogo className="text-slate-400" size={24} />
              </div>
              <div className="text-slate-400 text-sm font-medium mb-1">
                No Project Selected
              </div>
              <div className="text-xs text-slate-500">
                Choose a project to access tools
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Footer Section */}
      <div className={`${isCollapsed ? 'p-2' : 'p-3'} border-t border-slate-700/50 transition-all duration-300`}>
        
        {/* Combined User/Settings/Logout */}
        {isCollapsed ? (
          <div className="space-y-1">
            {/* User Button - Collapsed */}
            <button
              onClick={() => onPageChange('user')}
              className={`group w-full transition-all duration-200 rounded-lg hover:scale-[1.01] active:scale-[0.99] ${
                currentPage === 'user'
                  ? 'bg-gradient-to-r from-slate-700 to-slate-600 shadow-md'
                  : 'hover:bg-slate-800/40'
              }`}
              title={`${currentUser} - Settings`}
            >
              <div className="flex justify-center py-1">
                <div className="w-6 h-6 bg-gradient-to-br from-slate-600 to-slate-500 rounded-lg flex items-center justify-center">
                  <User className="w-3 h-3 text-slate-200" />
                </div>
              </div>
            </button>
            
            {/* Admin Access Button (only for admin users) */}
            {currentUserObj && AdminService.isAdmin(currentUserObj) && (
              <button
                onClick={onAdminAccess}
                className="group w-full flex justify-center p-1 rounded-lg text-xs font-medium transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] text-slate-400 hover:text-orange-400 hover:bg-gradient-to-r hover:from-orange-900/20 hover:to-red-800/10"
                title="Admin Portal"
              >
                <Shield className="w-3 h-3" />
              </button>
            )}

            {/* Logout Button */}
            <button
              onClick={onLogout}
              className="group w-full flex justify-center p-1 rounded-lg text-xs font-medium transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] text-slate-400 hover:text-red-400 hover:bg-gradient-to-r hover:from-red-900/20 hover:to-red-800/10"
              title="Sign Out"
            >
              <LogOut className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <div className="space-y-1">
            {/* User Button with inline logout - Expanded */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => onPageChange('user')}
                className={`group flex-1 transition-all duration-200 rounded-lg hover:scale-[1.01] active:scale-[0.99] ${
                  currentPage === 'user'
                    ? 'bg-gradient-to-r from-slate-700 to-slate-600 shadow-md'
                    : 'hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center space-x-2 px-2 py-1">
                  <div className="w-6 h-6 bg-gradient-to-br from-slate-600 to-slate-500 rounded-lg flex items-center justify-center">
                    <User className="w-3 h-3 text-slate-200" />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-xs font-medium text-white truncate">{currentUser}</p>
                  </div>
                </div>
              </button>
              
              <button
                onClick={onLogout}
                className="group ml-2 p-1 rounded-lg text-xs font-medium transition-all duration-200 hover:scale-[1.05] active:scale-[0.95] text-slate-400 hover:text-red-400 hover:bg-gradient-to-r hover:from-red-900/20 hover:to-red-800/10"
                title="Sign Out"
              >
                <LogOut className="w-3 h-3" />
              </button>
            </div>
            
            {/* Admin Access Button (only for admin users) */}
            {currentUserObj && AdminService.isAdmin(currentUserObj) && (
              <button
                onClick={onAdminAccess}
                className="group w-full flex items-center px-2 py-1 space-x-2 rounded-lg text-xs font-medium transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] text-slate-400 hover:text-orange-400 hover:bg-gradient-to-r hover:from-orange-900/20 hover:to-red-800/10"
              >
                <Shield className="w-3 h-3" />
                <span>Admin Portal</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default Sidebar