import { Target, Home, User, Database, BarChart3, FolderOpen, LogOut, ChevronLeft, ChevronRight, Map } from 'lucide-react'
import { useState } from 'react'
import { Project } from '../types'

interface SidebarProps {
  currentPage: string
  currentUser: string
  currentProject: Project | null
  onPageChange: (page: string) => void
  onLogout: () => void
  onToggleCollapse: (collapsed: boolean) => void
}

const Sidebar: React.FC<SidebarProps> = ({ currentPage, currentUser, currentProject, onPageChange, onLogout, onToggleCollapse }) => {
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
      description: 'Priority matrix & idea management'
    },
    {
      id: 'roadmap',
      label: 'Roadmap',
      icon: Map,
      description: 'Strategic roadmap & epics'
    },
    {
      id: 'data',
      label: 'Data Management',
      icon: Database,
      description: 'Export & import data'
    },
    {
      id: 'reports',
      label: 'Reports & Analytics', 
      icon: BarChart3,
      description: 'Insights & analysis'
    }
  ]

  return (
    <div className={`${isCollapsed ? 'w-20' : 'w-72'} bg-slate-900 text-white flex flex-col h-screen transition-all duration-300 fixed left-0 top-0 z-50 shadow-2xl`}>
      {/* Logo/Header */}
      <div className="p-6 border-b border-slate-700/50">
        <div className="flex items-center justify-between">
          {!isCollapsed ? (
            <>
              <div className="flex items-center space-x-4">
                <div className="bg-gradient-to-br from-white to-slate-100 rounded-xl p-3 shadow-lg border border-white/20">
                  <Target className="w-7 h-7 text-slate-900" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white tracking-wide">Prioritas</h2>
                  <p className="text-xs text-slate-400 font-medium opacity-80">Project Management Suite</p>
                </div>
              </div>
              <button
                onClick={handleToggleCollapse}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-lg transition-all duration-300 hover:scale-110"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            </>
          ) : (
            <div className="w-full flex flex-col items-center space-y-4">
              <div className="bg-gradient-to-br from-white to-slate-100 rounded-xl p-3 shadow-lg border border-white/20">
                <Target className="w-7 h-7 text-slate-900" />
              </div>
              <button
                onClick={handleToggleCollapse}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-lg transition-all duration-300 hover:scale-110"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 px-6 py-8 space-y-6 overflow-y-auto">
        {/* Projects Section */}
        <div>
          <button
            onClick={() => onPageChange('projects')}
            className={`group w-full flex items-center ${isCollapsed ? 'justify-center px-3' : 'space-x-4 px-5'} py-4 rounded-2xl text-sm font-semibold transition-all duration-300 ${
              currentPage === 'projects'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xl shadow-blue-500/25'
                : 'text-slate-300 hover:text-white hover:bg-gradient-to-r hover:from-slate-800 hover:to-slate-700 hover:shadow-lg'
            }`}
            title={isCollapsed ? 'Projects' : ''}
          >
            <FolderOpen className={`${isCollapsed ? 'w-6 h-6' : 'w-5 h-5'} transition-all duration-300 ${currentPage === 'projects' ? 'text-white' : 'text-blue-400 group-hover:text-white'}`} />
            {!isCollapsed && <span className="font-semibold tracking-wide">Projects</span>}
          </button>
        </div>

        {/* Current Project Section */}
        {currentProject && (
          <div className="space-y-4">
            {/* Project Name Header */}
            {!isCollapsed && (
              <div className="px-2">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3 opacity-80">
                  Current Project
                </div>
                <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-4 py-3 rounded-xl border border-slate-600/50 shadow-inner">
                  <div className="text-white font-semibold text-sm truncate flex items-center space-x-2">
                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                    <span>{currentProject.name}</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1 opacity-80">Active workspace</div>
                </div>
              </div>
            )}
            
            {isCollapsed && (
              <div className="px-2 py-1 text-center">
                <div className="w-12 h-12 bg-gradient-to-br from-slate-800 to-slate-700 rounded-xl flex items-center justify-center border border-slate-600/50 shadow-lg relative" title={currentProject.name}>
                  <Target className="w-5 h-5 text-blue-400" />
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full animate-pulse"></div>
                </div>
              </div>
            )}

            {/* Project Tools */}
            <div className="space-y-2">
              {projectTools.map((tool, index) => (
                <button
                  key={tool.id}
                  onClick={() => onPageChange(tool.id)}
                  className={`group w-full flex items-center ${isCollapsed ? 'justify-center px-3' : 'space-x-4 px-4'} py-3.5 rounded-xl text-sm font-medium transition-all duration-300 ${
                    currentPage === tool.id || (tool.id === 'matrix' && currentPage === 'home')
                      ? 'bg-white text-slate-900 shadow-xl shadow-white/10 scale-[1.02]'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/80 hover:shadow-lg hover:scale-[1.01]'
                  } ${!isCollapsed ? 'ml-4 border-l border-slate-700/50 pl-6' : ''}`}
                  title={isCollapsed ? `${tool.label} - ${tool.description}` : ''}
                  style={{
                    animationDelay: `${index * 50}ms`
                  }}
                >
                  <tool.icon className={`${isCollapsed ? 'w-5 h-5' : 'w-4 h-4'} transition-all duration-300 ${
                    currentPage === tool.id || (tool.id === 'matrix' && currentPage === 'home')
                      ? 'text-slate-600'
                      : 'text-slate-400 group-hover:text-blue-400'
                  }`} />
                  {!isCollapsed && (
                    <div className="flex-1 text-left">
                      <div className="font-semibold text-sm mb-0.5 tracking-wide">{tool.label}</div>
                      <div className={`text-xs truncate transition-colors duration-300 ${
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

        {/* Empty State when no project selected */}
        {!currentProject && !isCollapsed && (
          <div className="px-6 py-12 text-center">
            <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50">
              <div className="w-12 h-12 bg-slate-700 rounded-xl flex items-center justify-center mx-auto mb-4 opacity-60">
                <Target className="w-6 h-6 text-slate-400" />
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

      {/* User Section */}
      <div className="p-6 border-t border-slate-700/50 space-y-4">
        {/* User Info - Clickable to go to settings */}
        <button
          onClick={() => onPageChange('user')}
          className={`group w-full transition-all duration-300 rounded-xl ${
            currentPage === 'user'
              ? 'bg-gradient-to-r from-slate-700 to-slate-600 shadow-lg scale-[1.02]'
              : 'hover:bg-slate-800/50 hover:scale-[1.01] hover:shadow-md'
          }`}
          title={isCollapsed ? `${currentUser} - Settings` : ''}
        >
          {!isCollapsed ? (
            <div className="flex items-center space-x-4 px-4 py-3">
              <div className="w-10 h-10 bg-gradient-to-br from-slate-600 to-slate-500 rounded-xl flex items-center justify-center shadow-inner border border-slate-500/50">
                <User className="w-5 h-5 text-slate-200" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-semibold text-white truncate tracking-wide">{currentUser}</p>
                <p className="text-xs text-slate-400 opacity-80">Account settings</p>
              </div>
              <div className="w-2 h-2 bg-slate-500 rounded-full opacity-50 group-hover:opacity-80 transition-opacity"></div>
            </div>
          ) : (
            <div className="flex justify-center py-3">
              <div className="w-10 h-10 bg-gradient-to-br from-slate-600 to-slate-500 rounded-xl flex items-center justify-center shadow-inner border border-slate-500/50">
                <User className="w-5 h-5 text-slate-200" />
              </div>
            </div>
          )}
        </button>

        {/* Logout */}
        <button
          onClick={onLogout}
          className={`group w-full flex items-center ${isCollapsed ? 'justify-center px-3' : 'space-x-4 px-4'} py-3 rounded-xl text-sm font-medium transition-all duration-300 text-slate-400 hover:text-red-400 hover:bg-red-900/20 hover:border-red-800/30 hover:shadow-md hover:scale-[1.01] border border-transparent`}
          title={isCollapsed ? 'Sign Out' : ''}
        >
          <LogOut className="w-4 h-4 transition-colors duration-300" />
          {!isCollapsed && <span className="font-medium tracking-wide">Sign Out</span>}
        </button>
      </div>
    </div>
  )
}

export default Sidebar