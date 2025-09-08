import { useState, useEffect } from 'react'
import { Plus, FolderOpen, Calendar, Users, DollarSign, Edit2, Trash2, Archive, MoreVertical, Search, Filter, Sparkles } from 'lucide-react'
import { Project, IdeaCard, ProjectType, User } from '../types'
import { DatabaseService } from '../lib/database'
import ProjectStartupFlow from './ProjectStartupFlow'
import AIStarterModal from './AIStarterModal'

interface ProjectManagementProps {
  currentUser: User
  currentProject: Project | null
  onProjectSelect: (project: Project) => void
  onProjectCreated: (project: Project, ideas?: IdeaCard[]) => void
  onNavigateToMatrix?: () => void
}

const PROJECT_TYPE_ICONS = {
  software: '💻',
  product_development: '🚀',
  business_plan: '📊',
  marketing: '📢',
  operations: '⚙️',
  research: '🔬',
  other: '✨'
}

const PRIORITY_COLORS = {
  low: 'bg-green-100 text-green-800 border-green-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  high: 'bg-red-100 text-red-800 border-red-200',
  critical: 'bg-purple-100 text-purple-800 border-purple-200'
}

const STATUS_COLORS = {
  active: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  paused: 'bg-yellow-100 text-yellow-800',
  archived: 'bg-gray-100 text-gray-800'
}

const ProjectManagement: React.FC<ProjectManagementProps> = ({ 
  currentUser, 
  currentProject, 
  onProjectSelect, 
  onProjectCreated,
  onNavigateToMatrix
}) => {
  const [projects, setProjects] = useState<Project[]>([])
  const [showStartupFlow, setShowStartupFlow] = useState(false)
  const [showAIStarter, setShowAIStarter] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<Project['status'] | 'all'>('all')
  const [typeFilter, setTypeFilter] = useState<ProjectType | 'all'>('all')
  const [, setSelectedProject] = useState<Project | null>(null)
  const [showProjectMenu, setShowProjectMenu] = useState<string | null>(null)

  useEffect(() => {
    if (currentUser?.id) {
      loadProjects()
    }
    
    // Subscribe to real-time project updates
    const unsubscribe = DatabaseService.subscribeToProjects(setProjects)
    
    return unsubscribe
  }, [currentUser?.id])

  const loadProjects = async () => {
    setIsLoading(true)
    try {
      console.log('📋 Loading projects for user:', currentUser.id)
      
      // Test both approaches: database first, then fallback to test data
      try {
        console.log('🔄 Attempting database query...')
        const userProjects = await DatabaseService.getUserOwnedProjects(currentUser.id)
        console.log('✅ Database query succeeded! Projects:', userProjects.length)
        
        if (userProjects.length > 0) {
          setProjects(userProjects)
        } else {
          // If no real projects, add a test project for demo
          const testProjects = [
            {
              id: 'test-project-1',
              name: 'Test Project',
              description: 'This is a test project to verify the UI works',
              project_type: 'software' as const,
              status: 'active' as const,
              visibility: 'private' as const,
              priority_level: 'high' as const,
              owner_id: currentUser.id,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              budget: 10000,
              target_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            }
          ]
          console.log('📋 No database projects, using test project')
          setProjects(testProjects)
        }
      } catch (dbError) {
        console.error('❌ Database query failed, falling back to test data:', dbError)
        
        // Fallback to test data if database fails
        const testProjects = [
          {
            id: 'test-project-1',
            name: 'Test Project (DB Fallback)',
            description: 'This is a test project because database connection failed',
            project_type: 'software' as const,
            status: 'active' as const,
            visibility: 'private' as const,
            priority_level: 'high' as const,
            owner_id: currentUser.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            budget: 10000,
            target_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          }
        ]
        setProjects(testProjects)
      }
      
    } catch (error) {
      console.error('Error in loadProjects:', error)
      setProjects([]) // Set empty array on error
    } finally {
      console.log('📋 Setting loading to false, projects count:', projects.length)
      setIsLoading(false)
    }
  }

  const handleProjectCreated = (project: Project, ideas?: IdeaCard[]) => {
    setProjects(prev => [project, ...prev])
    onProjectCreated(project, ideas)
    setShowStartupFlow(false)
  }

  const handleAIProjectCreated = (project: Project, ideas: IdeaCard[]) => {
    setProjects(prev => [project, ...prev])
    onProjectCreated(project, ideas)
    setShowAIStarter(false)
  }

  const handleProjectSelect = (project: Project) => {
    console.log('📂 ProjectManagement: Selecting project:', project.name, project.id)
    console.log('📂 ProjectManagement: Full project object:', project)
    
    onProjectSelect(project)
    setSelectedProject(project)
    setShowProjectMenu(null)
    
    // Navigate to the matrix screen to show the selected project
    console.log('📂 ProjectManagement: About to navigate to matrix')
    if (onNavigateToMatrix) {
      onNavigateToMatrix()
    }
  }

  const handleUpdateProjectStatus = async (projectId: string, status: Project['status']) => {
    try {
      const updatedProject = await DatabaseService.updateProject(projectId, { status })
      if (updatedProject) {
        setProjects(prev => prev.map(p => p.id === projectId ? updatedProject : p))
      }
    } catch (error) {
      console.error('Error updating project status:', error)
    }
    setShowProjectMenu(null)
  }

  const handleDeleteProject = async (projectId: string) => {
    if (confirm('Are you sure you want to delete this project? This will also delete all associated ideas.')) {
      try {
        const success = await DatabaseService.deleteProject(projectId)
        if (success) {
          setProjects(prev => prev.filter(p => p.id !== projectId))
          if (currentProject?.id === projectId) {
            // If deleting current project, need to handle this in parent
            onProjectSelect(projects.find(p => p.id !== projectId) || null as any)
          }
        }
      } catch (error) {
        console.error('Error deleting project:', error)
      }
    }
    setShowProjectMenu(null)
  }

  const filteredProjects = projects.filter(project => {
    const matchesSearch = project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         project.description?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === 'all' || project.status === statusFilter
    const matchesType = typeFilter === 'all' || project.project_type === typeFilter
    
    return matchesSearch && matchesStatus && matchesType
  })

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0
    }).format(amount)
  }

  console.log('🖥️ ProjectManagement render - isLoading:', isLoading, 'projects:', projects.length)

  if (isLoading) {
    console.log('🔄 ProjectManagement showing loading state')
    return (
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-1/4"></div>
          <div className="h-32 bg-slate-200 rounded"></div>
          <div className="h-32 bg-slate-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Project Management</h1>
          <p className="text-slate-600">Manage all your priority matrix projects</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowAIStarter(true)}
            className="flex items-center space-x-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-3 rounded-xl hover:from-purple-700 hover:to-blue-700 transition-colors shadow-sm"
          >
            <Sparkles className="w-5 h-5" />
            <span className="font-medium">AI Starter</span>
          </button>
          <button
            onClick={() => setShowStartupFlow(true)}
            className="flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-purple-700 transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5" />
            <span className="font-medium">New Project</span>
          </button>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="paused">Paused</option>
            <option value="archived">Archived</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Types</option>
            <option value="software">Software Development</option>
            <option value="product_development">Product Development</option>
            <option value="business_plan">Business Planning</option>
            <option value="marketing">Marketing</option>
            <option value="operations">Operations</option>
            <option value="research">Research</option>
            <option value="other">Other</option>
          </select>

          <div className="flex items-center text-sm text-slate-600">
            <Filter className="w-4 h-4 mr-2" />
            {filteredProjects.length} of {projects.length} projects
          </div>
        </div>
      </div>

      {/* Projects Grid */}
      {filteredProjects.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-12 text-center">
          <FolderOpen className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">No projects found</h3>
          <p className="text-slate-600 mb-6">
            {projects.length === 0 
              ? "Get started by creating your first project" 
              : "Try adjusting your search or filters"}
          </p>
          {projects.length === 0 && (
            <div className="flex items-center justify-center space-x-3">
              <button
                onClick={() => setShowAIStarter(true)}
                className="inline-flex items-center space-x-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-3 rounded-lg hover:from-purple-700 hover:to-blue-700 transition-colors"
              >
                <Sparkles className="w-5 h-5" />
                <span>AI Starter</span>
              </button>
              <button
                onClick={() => setShowStartupFlow(true)}
                className="inline-flex items-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-5 h-5" />
                <span>Manual Setup</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((project) => (
            <div
              key={project.id}
              className={`bg-white rounded-2xl shadow-sm border-2 transition-all hover:shadow-md cursor-pointer ${
                currentProject?.id === project.id 
                  ? 'border-blue-500 bg-blue-50/30' 
                  : 'border-slate-200/60 hover:border-slate-300'
              }`}
              onClick={(e) => {
                console.log('🖱️ Project card clicked!', project.name, project.id)
                console.log('🖱️ Click event:', e.target)
                handleProjectSelect(project)
              }}
              onDoubleClick={() => {
                console.log('🖱️🖱️ Project card double-clicked!', project.name, project.id)
                handleProjectSelect(project)
              }}
            >
              <div className="p-6">
                {/* Project Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-xl">
                      {PROJECT_TYPE_ICONS[project.project_type]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-slate-900 truncate">{project.name}</h3>
                      <p className="text-sm text-slate-500 capitalize">
                        {project.project_type.replace('_', ' ')}
                      </p>
                    </div>
                  </div>
                  
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowProjectMenu(showProjectMenu === project.id ? null : project.id)
                      }}
                      className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {showProjectMenu === project.id && (
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-10">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleProjectSelect(project)
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center space-x-2"
                        >
                          <FolderOpen className="w-4 h-4" />
                          <span>Open Project</span>
                        </button>
                        
                        <hr className="my-1" />
                        
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleUpdateProjectStatus(project.id, project.status === 'active' ? 'paused' : 'active')
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center space-x-2"
                        >
                          <Edit2 className="w-4 h-4" />
                          <span>{project.status === 'active' ? 'Pause' : 'Activate'}</span>
                        </button>
                        
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleUpdateProjectStatus(project.id, 'archived')
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center space-x-2"
                        >
                          <Archive className="w-4 h-4" />
                          <span>Archive</span>
                        </button>
                        
                        <hr className="my-1" />
                        
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteProject(project.id)
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>Delete</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Status and Priority Badges */}
                <div className="flex items-center space-x-2 mb-4">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${STATUS_COLORS[project.status]}`}>
                    {project.status}
                  </span>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full border ${PRIORITY_COLORS[project.priority_level]}`}>
                    {project.priority_level}
                  </span>
                  {project.is_ai_generated && (
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                      AI Enhanced
                    </span>
                  )}
                </div>

                {/* Description */}
                {project.description && (
                  <p className="text-sm text-slate-600 mb-4 line-clamp-3">
                    {project.description}
                  </p>
                )}

                {/* Project Details */}
                <div className="space-y-2">
                  {project.target_date && (
                    <div className="flex items-center text-sm text-slate-500">
                      <Calendar className="w-4 h-4 mr-2" />
                      <span>Target: {formatDate(project.target_date)}</span>
                    </div>
                  )}
                  
                  {project.team_size && (
                    <div className="flex items-center text-sm text-slate-500">
                      <Users className="w-4 h-4 mr-2" />
                      <span>Team: {project.team_size} members</span>
                    </div>
                  )}
                  
                  {project.budget && (
                    <div className="flex items-center text-sm text-slate-500">
                      <DollarSign className="w-4 h-4 mr-2" />
                      <span>Budget: {formatCurrency(project.budget)}</span>
                    </div>
                  )}
                </div>

                {/* Tags */}
                {project.tags && project.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {project.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 text-xs bg-slate-100 text-slate-700 rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                    {project.tags.length > 3 && (
                      <span className="px-2 py-1 text-xs bg-slate-100 text-slate-500 rounded-full">
                        +{project.tags.length - 3}
                      </span>
                    )}
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
                  <span className="text-xs text-slate-500">
                    Updated {formatDate(project.updated_at)}
                  </span>
                  <span className="text-xs text-slate-500">
                    by {
                      project.owner?.full_name || 
                      project.owner?.email || 
                      (project.owner_id === currentUser?.id 
                        ? (currentUser?.full_name || currentUser?.email || 'You')
                        : 'Unknown')
                    }
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Startup Flow Modal */}
      {showStartupFlow && (
        <ProjectStartupFlow
          currentUser={currentUser}
          onClose={() => setShowStartupFlow(false)}
          onProjectCreated={handleProjectCreated}
        />
      )}

      {/* AI Starter Modal */}
      {showAIStarter && (
        <AIStarterModal
          currentUser={currentUser}
          onClose={() => setShowAIStarter(false)}
          onProjectCreated={handleAIProjectCreated}
        />
      )}
    </div>
  )
}

export default ProjectManagement