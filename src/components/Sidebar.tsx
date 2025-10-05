import { Home, User, Database, BarChart3, FolderOpen, LogOut, Map, Users, Shield, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState, useRef, useCallback, useEffect } from 'react'
import { Project } from '../types'
import { AdminService } from '../lib/adminService'
import PrioritasLogo from './PrioritasLogo'
import { useCurrentUser, useUserDisplay } from '../contexts/UserContext'
import NavItem from './ui/NavItem'

interface SidebarProps {
  currentPage: string
  currentProject: Project | null
  onPageChange: (page: string) => void
  onLogout: () => void
  onAdminAccess?: () => void
  onToggleCollapse: (collapsed: boolean) => void
}

const Sidebar: React.FC<SidebarProps> = ({ currentPage, currentProject, onPageChange, onLogout, onAdminAccess, onToggleCollapse }) => {
  // Use centralized user context for all user data
  const currentUser = useCurrentUser()
  const { displayName, email } = useUserDisplay()
  const [isCollapsed, setIsCollapsed] = useState(false)

  // Animated selection indicator state
  const navContainerRef = useRef<HTMLDivElement>(null)
  const activeElementRef = useRef<HTMLButtonElement | null>(null)
  const [indicatorStyle, setIndicatorStyle] = useState<React.CSSProperties>({
    top: 0,
    height: 0,
    opacity: 0
  })

  // Callback for NavItem to report its position when active
  const handleActivePositionChange = useCallback((element: HTMLButtonElement) => {
    if (!navContainerRef.current) return

    // Store reference to active element for recalculation on collapse/expand
    activeElementRef.current = element

    const containerRect = navContainerRef.current.getBoundingClientRect()
    const elementRect = element.getBoundingClientRect()

    setIndicatorStyle({
      top: elementRect.top - containerRect.top,
      height: elementRect.height,
      opacity: 1,
      transition: 'all 300ms cubic-bezier(0.4, 0, 0.2, 1)'
    })
  }, [])

  // Recalculate indicator position when sidebar collapses/expands
  useEffect(() => {
    if (!navContainerRef.current || !activeElementRef.current) return

    // Wait for collapse/expand animation to complete
    const timer = setTimeout(() => {
      if (!navContainerRef.current || !activeElementRef.current) return

      const containerRect = navContainerRef.current.getBoundingClientRect()
      const elementRect = activeElementRef.current.getBoundingClientRect()

      setIndicatorStyle({
        top: elementRect.top - containerRect.top,
        height: elementRect.height,
        opacity: 1,
        transition: 'all 300ms cubic-bezier(0.4, 0, 0.2, 1)'
      })
    }, 320) // Slightly longer than the 300ms transition

    return () => clearTimeout(timer)
  }, [isCollapsed])

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
      label: 'Insights',
      icon: BarChart3,
      description: 'AI-powered insights & analytics'
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
    <div className={`${isCollapsed ? 'w-20' : 'w-72'} sidebar-clean flex flex-col h-screen transition-all duration-300 ease-in-out fixed left-0 top-0 z-50`}>

      {/* Header Section */}
      <div
        className={`${isCollapsed ? 'p-4' : 'p-6'} border-b transition-all duration-300`}
        style={{ borderColor: 'var(--hairline-default)' }}
      >
        {isCollapsed ? (
          /* Collapsed Header */
          <div className="flex flex-col items-center space-y-3">
            <div
              className="rounded-2xl p-3 shadow-lg"
              style={{
                background: 'linear-gradient(to bottom right, var(--surface-primary), var(--graphite-100))'
              }}
            >
              <div style={{ color: 'var(--sapphire-600)' }}>
                <PrioritasLogo size={24} />
              </div>
            </div>
            <button
              onClick={handleToggleCollapse}
              className="p-2 rounded-lg transition-colors hover:bg-graphite-100"
              style={{ color: 'var(--graphite-600)' }}
              aria-label="Expand sidebar"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          /* Expanded Header */
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div
                className="rounded-2xl p-3 shadow-lg"
                style={{
                  background: 'linear-gradient(to bottom right, var(--surface-primary), var(--graphite-100))'
                }}
              >
                <div style={{ color: 'var(--sapphire-600)' }}>
                  <PrioritasLogo size={24} />
                </div>
              </div>
              <div>
                <h2
                  className="text-xl font-bold"
                  style={{ color: 'var(--graphite-900)' }}
                >
                  Prioritas
                </h2>
              </div>
            </div>
            <button
              onClick={handleToggleCollapse}
              className="p-2 rounded-lg transition-colors hover:bg-graphite-100"
              style={{ color: 'var(--graphite-600)' }}
              aria-label="Collapse sidebar"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Navigation Section */}
      <nav
        ref={navContainerRef}
        className={`flex-1 ${isCollapsed ? 'px-3 py-6' : 'px-6 py-8'} overflow-y-auto transition-all duration-300`}
        style={{ position: 'relative' }}
      >
        {/* Animated Selection Indicator */}
        <div
          className="absolute left-0 w-1 rounded-r-full pointer-events-none"
          style={{
            ...indicatorStyle,
            backgroundColor: 'var(--graphite-900)',
            marginLeft: isCollapsed ? '8px' : '16px'
          }}
        />

        {/* Projects Button */}
        <div className="mb-8">
          <NavItem
            onClick={() => onPageChange('projects')}
            active={currentPage === 'projects'}
            icon={<FolderOpen />}
            collapsed={isCollapsed}
            title={isCollapsed ? 'Projects' : undefined}
            className="font-semibold"
            onActivePositionChange={handleActivePositionChange}
          >
            Projects
          </NavItem>
        </div>

        {/* Current Project Section */}
        {currentProject && (
          <div className="space-y-6">

            {/* Project Header */}
            {!isCollapsed && (
              <div>
                <div
                  className="text-xs font-semibold uppercase tracking-widest mb-3"
                  style={{ color: 'var(--graphite-500)' }}
                >
                  Current Project
                </div>
                <div className="mb-3">
                  <div
                    className="font-bold text-base truncate"
                    style={{ color: 'var(--graphite-900)' }}
                  >
                    {currentProject.name}
                  </div>
                  <div
                    className="text-xs"
                    style={{ color: 'var(--graphite-500)' }}
                  >
                    Active workspace
                  </div>
                </div>
              </div>
            )}

            {/* Project Tools */}
            <div id="project-tools-section">
              <div className="space-y-2">
                {projectTools.map((tool) => {
                  const isActive = currentPage === tool.id || (tool.id === 'matrix' && currentPage === 'home');
                  return (
                    <NavItem
                      key={tool.id}
                      onClick={() => onPageChange(tool.id)}
                      active={isActive}
                      icon={<tool.icon />}
                      collapsed={isCollapsed}
                      title={isCollapsed ? `${tool.label} - ${tool.description}` : undefined}
                      className="font-medium"
                      onActivePositionChange={handleActivePositionChange}
                    >
                      {!isCollapsed && (
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm truncate">{tool.label}</div>
                          <div
                            className="text-xs truncate"
                            style={{ color: isActive ? 'inherit' : 'var(--graphite-500)' }}
                          >
                            {tool.description}
                          </div>
                        </div>
                      )}
                    </NavItem>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!currentProject && !isCollapsed && (
          <div className="py-12 text-center">
            <div
              className="rounded-xl p-6 border"
              style={{
                backgroundColor: 'var(--canvas-secondary)',
                borderColor: 'var(--hairline-default)'
              }}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4"
                style={{ backgroundColor: 'var(--graphite-200)' }}
              >
                <div style={{ color: 'var(--graphite-500)' }}>
                  <PrioritasLogo size={24} />
                </div>
              </div>
              <div
                className="text-sm font-medium mb-1"
                style={{ color: 'var(--graphite-600)' }}
              >
                No Project Selected
              </div>
              <div
                className="text-xs"
                style={{ color: 'var(--graphite-500)' }}
              >
                Choose a project to access tools
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Footer Section */}
      <div
        className={`${isCollapsed ? 'p-2' : 'p-3'} border-t transition-all duration-300`}
        style={{ borderColor: 'var(--hairline-default)' }}
      >
        {isCollapsed ? (
          <div className="space-y-1">
            {/* User Button - Collapsed */}
            <NavItem
              onClick={() => onPageChange('user')}
              active={currentPage === 'user'}
              icon={
                <div
                  className="w-6 h-6 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: 'var(--graphite-200)' }}
                >
                  <User className="w-3 h-3" style={{ color: 'inherit' }} />
                </div>
              }
              collapsed={isCollapsed}
              title={`${email || displayName} - Settings`}
              onActivePositionChange={handleActivePositionChange}
            />

            {/* Admin Access Button (only for admin users) */}
            {currentUser && AdminService.isAdmin(currentUser) && (
              <button
                onClick={onAdminAccess}
                className="w-full p-2 rounded-lg transition-colors hover:bg-graphite-100"
                style={{ color: 'var(--graphite-500)' }}
                title="Admin Portal"
              >
                <Shield className="w-4 h-4 mx-auto" />
              </button>
            )}

            {/* Logout Button */}
            <button
              onClick={onLogout}
              className="w-full p-2 rounded-lg transition-colors hover:bg-graphite-100"
              style={{ color: 'var(--graphite-500)' }}
              title="Sign Out"
            >
              <LogOut className="w-4 h-4 mx-auto" />
            </button>
          </div>
        ) : (
          <div className="space-y-1">
            {/* User Button with inline logout - Expanded */}
            <div className="flex items-center justify-between">
              <NavItem
                onClick={() => onPageChange('user')}
                active={currentPage === 'user'}
                icon={
                  <div
                    className="w-6 h-6 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: 'var(--graphite-200)' }}
                  >
                    <User className="w-3 h-3" style={{ color: 'inherit' }} />
                  </div>
                }
                collapsed={false}
                className="flex-1"
                onActivePositionChange={handleActivePositionChange}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate" style={{ color: 'inherit' }}>
                    {email || displayName}
                  </p>
                </div>
              </NavItem>

              <button
                onClick={onLogout}
                className="ml-2 p-2 rounded-lg transition-colors hover:bg-graphite-100"
                style={{ color: 'var(--graphite-500)' }}
                title="Sign Out"
              >
                <LogOut className="w-3 h-3" />
              </button>
            </div>

            {/* Admin Access Button (only for admin users) */}
            {currentUser && AdminService.isAdmin(currentUser) && (
              <button
                onClick={onAdminAccess}
                className="w-full flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors hover:bg-graphite-100"
                style={{ color: 'var(--graphite-500)' }}
              >
                <Shield className="w-4 h-4" />
                <span className="text-sm">Admin Portal</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default Sidebar
