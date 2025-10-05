import { useState, useEffect, useCallback } from 'react'
import { Plus, FolderOpen, Calendar, Users, DollarSign, Edit2, Trash2, Archive, MoreVertical, Search, Filter, Sparkles } from 'lucide-react'
import { Project, IdeaCard, ProjectType, User } from '../types'
import { ProjectRepository } from '../lib/repositories'
import ProjectStartupFlow from './ProjectStartupFlow'
import AIStarterModal from './AIStarterModal'
import { logger } from '../utils/logger'
import { Button } from './ui/Button'

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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ project: Project; show: boolean }>({ project: null as any, show: false })

  // Extract userId to primitive to prevent object reference issues
  const userId = currentUser?.id

  // Wrap loadProjectsDirectly in useCallback to prevent infinite loop
  const loadProjectsDirectly = useCallback(async () => {
    if (!userId) {
      logger.debug('No user ID, skipping project load')
      setIsLoading(false)
      return
    }

    try {
      logger.debug('Loading projects for user', { userId })
      const projects = await ProjectRepository.getUserOwnedProjects(userId)
      logger.debug('Direct load received', { count: projects?.length })
      setProjects(projects)
      setIsLoading(false)
    } catch (error) {
      logger.error('Direct load error', error)
      setProjects([])
      setIsLoading(false)
    }
  }, [userId])

  useEffect(() => {
    loadProjectsDirectly()
  }, [loadProjectsDirectly])

  const handleProjectCreated = useCallback((project: Project, ideas?: IdeaCard[]) => {
    setProjects(prev => [project, ...prev])
    onProjectCreated(project, ideas)
    setShowStartupFlow(false)
  }, [onProjectCreated])

  const handleAIProjectCreated = useCallback((project: Project, ideas: IdeaCard[]) => {
    setProjects(prev => [project, ...prev])
    onProjectCreated(project, ideas)
    setShowAIStarter(false)
  }, [onProjectCreated])

  const handleCloseAIStarter = useCallback(() => {
    setShowAIStarter(false)
  }, [])

  const handleProjectSelect = (project: Project) => {
    logger.debug('📂 ProjectManagement: Selecting project:', project.name, project.id)
    logger.debug('📂 ProjectManagement: Full project object:', project)
    
    onProjectSelect(project)
    setSelectedProject(project)
    setShowProjectMenu(null)
    
    // Navigate to the matrix screen to show the selected project
    logger.debug('📂 ProjectManagement: About to navigate to matrix')
    if (onNavigateToMatrix) {
      onNavigateToMatrix()
    }
  }

  const handleUpdateProjectStatus = async (projectId: string, status: Project['status']) => {
    try {
      const updatedProject = await ProjectRepository.updateProject(projectId, { status })
      if (updatedProject) {
        setProjects(prev => prev.map(p => p.id === projectId ? updatedProject : p))
      }
    } catch (error) {
      logger.error('Error updating project status:', error)
    }
    setShowProjectMenu(null)
  }

  const handleDeleteProject = (project: Project) => {
    setShowDeleteConfirm({ project, show: true })
    setShowProjectMenu(null)
  }

  const confirmDeleteProject = async () => {
    const { project } = showDeleteConfirm
    try {
      const success = await ProjectRepository.deleteProject(project.id)
      if (success) {
        setProjects(prev => prev.filter(p => p.id !== project.id))
        if (currentProject?.id === project.id) {
          // If deleting current project, need to handle this in parent
          onProjectSelect((projects || []).find(p => p.id !== project.id) || null as any)
        }
      }
    } catch (error) {
      logger.error('Error deleting project:', error)
    }
    setShowDeleteConfirm({ project: null as any, show: false })
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

  logger.debug('🖥️ ProjectManagement render - isLoading:', isLoading, 'projects:', projects.length)

  if (isLoading) {
    logger.debug('🔄 ProjectManagement showing loading state')
    return (
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-neutral-200 rounded w-1/4"></div>
          <div className="h-32 bg-neutral-200 rounded"></div>
          <div className="h-32 bg-neutral-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900 mb-2">Project Management</h1>
          <p className="text-neutral-600">Manage all your priority matrix projects</p>
        </div>
        <div className="flex items-center space-x-3">
          <Button
            onClick={() => setShowAIStarter(true)}
            variant="sapphire"
            icon={<Sparkles className="w-5 h-5" />}
          >
            AI Starter
          </Button>
          <Button
            onClick={() => setShowStartupFlow(true)}
            data-testid="create-project-button"
            variant="primary"
            icon={<Plus className="w-5 h-5" />}
          >
            New Project
          </Button>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200/60 p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
            className="px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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

          <div className="flex items-center text-sm text-neutral-600">
            <Filter className="w-4 h-4 mr-2" />
            {filteredProjects.length} of {projects.length} projects
          </div>
        </div>
      </div>

      {/* Projects Grid */}
      {filteredProjects.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200/60 p-12 text-center">
          <FolderOpen className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-neutral-900 mb-2">No projects found</h3>
          <p className="text-neutral-600 mb-6">
            {projects.length === 0
              ? "Get started by creating your first project"
              : "Try adjusting your search or filters"}
          </p>
          {projects.length === 0 && (
            <div className="flex items-center justify-center space-x-3">
              <Button
                onClick={() => setShowAIStarter(true)}
                variant="sapphire"
                icon={<Sparkles className="w-5 h-5" />}
              >
                AI Starter
              </Button>
              <Button
                onClick={() => setShowStartupFlow(true)}
                variant="primary"
                icon={<Plus className="w-5 h-5" />}
              >
                Manual Setup
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="project-list">
          {filteredProjects.map((project) => (
            <div
              key={project.id}
              className={`bg-white rounded-2xl shadow-sm border-2 transition-all hover:shadow-md cursor-pointer ${
                currentProject?.id === project.id
                  ? 'border-blue-500 bg-blue-50/30'
                  : 'border-neutral-200/60 hover:border-neutral-300'
              }`}
              data-testid={`project-card-${project.id}`}
              onClick={(e) => {
                logger.debug('Project card clicked', { name: project.name, id: project.id })
                logger.debug('Click event', { target: e.target })
                handleProjectSelect(project)
              }}
              onDoubleClick={() => {
                logger.debug('Project card double-clicked', { name: project.name, id: project.id })
                handleProjectSelect(project)
              }}
            >
              <div className="p-6">
                {/* Project Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    <div className="w-12 h-12 bg-neutral-100 rounded-xl flex items-center justify-center text-xl">
                      {PROJECT_TYPE_ICONS[project.project_type]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-neutral-900 truncate">{project.name}</h3>
                      <p className="text-sm text-neutral-500 capitalize">
                        {project.project_type.replace('_', ' ')}
                      </p>
                    </div>
                  </div>
                  
                  <div className="relative">
                    <Button
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowProjectMenu(showProjectMenu === project.id ? null : project.id)
                      }}
                      variant="ghost"
                      size="sm"
                      icon={<MoreVertical className="w-4 h-4" />}
                      className="!p-2"
                    />

                    {showProjectMenu === project.id && (
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-neutral-200 py-1 z-10">
                        <Button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleProjectSelect(project)
                          }}
                          variant="ghost"
                          size="sm"
                          icon={<FolderOpen className="w-4 h-4" />}
                          className="w-full !justify-start !rounded-none hover:!bg-neutral-100"
                        >
                          Open Project
                        </Button>

                        <hr className="my-1" />

                        <Button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleUpdateProjectStatus(project.id, project.status === 'active' ? 'paused' : 'active')
                          }}
                          variant="ghost"
                          size="sm"
                          icon={<Edit2 className="w-4 h-4" />}
                          className="w-full !justify-start !rounded-none hover:!bg-neutral-100"
                        >
                          {project.status === 'active' ? 'Pause' : 'Activate'}
                        </Button>

                        <Button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleUpdateProjectStatus(project.id, 'archived')
                          }}
                          variant="ghost"
                          size="sm"
                          icon={<Archive className="w-4 h-4" />}
                          className="w-full !justify-start !rounded-none hover:!bg-neutral-100"
                        >
                          Archive
                        </Button>

                        <hr className="my-1" />

                        <Button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteProject(project)
                          }}
                          variant="ghost"
                          size="sm"
                          icon={<Trash2 className="w-4 h-4" />}
                          className="w-full !justify-start !rounded-none hover:!bg-red-50 !text-red-600"
                        >
                          Delete
                        </Button>
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
                  <p className="text-sm text-neutral-600 mb-4 line-clamp-3">
                    {project.description}
                  </p>
                )}

                {/* Project Details */}
                <div className="space-y-2">
                  {project.target_date && (
                    <div className="flex items-center text-sm text-neutral-500">
                      <Calendar className="w-4 h-4 mr-2" />
                      <span>Target: {formatDate(project.target_date)}</span>
                    </div>
                  )}
                  
                  {project.team_size && (
                    <div className="flex items-center text-sm text-neutral-500">
                      <Users className="w-4 h-4 mr-2" />
                      <span>Team: {project.team_size} members</span>
                    </div>
                  )}
                  
                  {project.budget && (
                    <div className="flex items-center text-sm text-neutral-500">
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
                        className="px-2 py-1 text-xs bg-neutral-100 text-neutral-700 rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                    {project.tags.length > 3 && (
                      <span className="px-2 py-1 text-xs bg-neutral-100 text-neutral-500 rounded-full">
                        +{project.tags.length - 3}
                      </span>
                    )}
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-neutral-100">
                  <span className="text-xs text-neutral-500">
                    Updated {formatDate(project.updated_at)}
                  </span>
                  <span className="text-xs text-neutral-500">
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
          onClose={handleCloseAIStarter}
          onProjectCreated={handleAIProjectCreated}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
            <div className="p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <Trash2 className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-neutral-900">Delete Project</h3>
                  <p className="text-sm text-neutral-500">This action cannot be undone</p>
                </div>
              </div>
              
              <div className="mb-6">
                <p className="text-neutral-700 mb-2">
                  Are you sure you want to delete <strong>"{showDeleteConfirm.project?.name}"</strong>?
                </p>
                <p className="text-sm text-neutral-500">
                  This will permanently delete the project and all associated ideas, roadmaps, and data.
                </p>
              </div>
              
              <div className="flex space-x-3">
                <Button
                  onClick={() => setShowDeleteConfirm({ project: null as any, show: false })}
                  variant="secondary"
                  size="md"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={confirmDeleteProject}
                  variant="danger"
                  size="md"
                  className="flex-1"
                >
                  Delete
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProjectManagement