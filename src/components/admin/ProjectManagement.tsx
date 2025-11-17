import { useState, useEffect } from 'react'
import { Search, Filter, FolderOpen, Users, Calendar, Activity, Trash2, Eye, AlertTriangle, CheckCircle } from 'lucide-react'
import { AdminProject, User } from '../../types'
import { AdminService } from '../../lib/adminService'
import { logger } from '../../utils/logger'
import { getAuthHeadersSync } from '../../lib/authHeaders'

interface ProjectManagementProps {
  currentUser: User
}

const ProjectManagement: React.FC<ProjectManagementProps> = () => {
  const [projects, setProjects] = useState<AdminProject[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'paused' | 'completed'>('all')
  const [selectedProject, setSelectedProject] = useState<AdminProject | null>(null)
  const [showProjectModal, setShowProjectModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)

  useEffect(() => {
    loadProjects()
  }, [])

  const loadProjects = async () => {
    setIsLoading(true)
    try {
      // Use backend API endpoint instead of deprecated AdminService method
      const response = await fetch('/api/admin/projects', {
        headers: getAuthHeadersSync(),
        credentials: 'include'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to load projects')
      }

      const data = await response.json()

      if (data.success && data.projects) {
        setProjects(data.projects)
      } else {
        throw new Error(data.error || 'Failed to load projects')
      }
    } catch (error) {
      logger.error('Error loading projects:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteProject = async (projectId: string) => {
    try {
      await AdminService.deleteProject(projectId)
      setProjects(prev => prev.filter(p => p.id !== projectId))
      setShowDeleteConfirm(null)
    } catch (error) {
      logger.error('Error deleting project:', error)
    }
  }

  const filteredProjects = projects.filter(project => {
    const matchesSearch = project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         project.description?.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesFilter = filterStatus === 'all' || project.status === filterStatus
    
    return matchesSearch && matchesFilter
  })

  const getProjectTypeIcon = (type: string) => {
    switch (type) {
      case 'software': return '💻'
      case 'business_plan': return '📊'
      case 'product_development': return '🛠️'
      case 'marketing': return '📢'
      case 'operations': return '⚙️'
      case 'research': return '🔬'
      default: return '📁'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'paused': return 'bg-yellow-100 text-yellow-800'
      case 'completed': return 'bg-blue-100 text-blue-800'
      case 'archived': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800'
      case 'high': return 'bg-orange-100 text-orange-800'
      case 'medium': return 'bg-blue-100 text-blue-800'
      case 'low': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const ProjectModal: React.FC<{ project: AdminProject }> = ({ project }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-600 rounded-2xl flex items-center justify-center text-2xl">
                {getProjectTypeIcon(project.project_type)}
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-900">{project.name}</h2>
                <p className="text-slate-600 mt-1">{project.description}</p>
                <div className="flex items-center space-x-2 mt-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(project.status)}`}>
                    {project.status}
                  </span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(project.priority_level)}`}>
                    {project.priority_level} priority
                  </span>
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                    {project.visibility}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowProjectModal(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              ×
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div>
                <h3 className="text-lg font-medium text-slate-900 mb-4">Project Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <div>
                        <p className="text-sm font-medium text-slate-700">Created</p>
                        <p className="text-sm text-slate-600">
                          {new Date(project.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Activity className="w-4 h-4 text-slate-400" />
                      <div>
                        <p className="text-sm font-medium text-slate-700">Last Activity</p>
                        <p className="text-sm text-slate-600">
                          {project.last_activity ? AdminService.getRelativeTime(project.last_activity) : 'No activity'}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <Users className="w-4 h-4 text-slate-400" />
                      <div>
                        <p className="text-sm font-medium text-slate-700">Collaborators</p>
                        <p className="text-sm text-slate-600">{project.collaborator_count}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <FolderOpen className="w-4 h-4 text-slate-400" />
                      <div>
                        <p className="text-sm font-medium text-slate-700">Owner</p>
                        <p className="text-sm text-slate-600">User ID: {project.owner_id}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium text-slate-900 mb-4">Content Statistics</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-blue-50 rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-blue-900">{project.idea_count}</div>
                    <div className="text-sm text-blue-700">Ideas</div>
                  </div>
                  <div className="bg-purple-50 rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-purple-900">{project.file_count}</div>
                    <div className="text-sm text-purple-700">Files</div>
                  </div>
                  <div className="bg-green-50 rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-green-900">
                      {AdminService.formatFileSize(project.total_file_size)}
                    </div>
                    <div className="text-sm text-green-700">Storage</div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-medium text-slate-900 mb-4">Admin Actions</h3>
              <div className="space-y-3">
                <button className="w-full flex items-center space-x-2 px-4 py-3 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-xl transition-colors">
                  <Eye className="w-4 h-4" />
                  <span>View Project Details</span>
                </button>
                <button className="w-full flex items-center space-x-2 px-4 py-3 bg-green-100 text-green-700 hover:bg-green-200 rounded-xl transition-colors">
                  <CheckCircle className="w-4 h-4" />
                  <span>Archive Project</span>
                </button>
                <button 
                  onClick={() => {
                    setShowProjectModal(false)
                    setShowDeleteConfirm(project.id)
                  }}
                  className="w-full flex items-center space-x-2 px-4 py-3 bg-red-100 text-red-700 hover:bg-red-200 rounded-xl transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Project</span>
                </button>
              </div>

              <div className="mt-6 p-4 bg-yellow-50 rounded-xl">
                <div className="flex items-start space-x-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-yellow-900">Admin Override</p>
                    <p className="text-xs text-yellow-700 mt-1">
                      These actions will override project owner permissions.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const DeleteConfirmModal: React.FC<{ projectId: string; projectName: string }> = ({ projectId, projectName }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Delete Project</h3>
              <p className="text-sm text-slate-600">This action cannot be undone</p>
            </div>
          </div>
          <p className="text-slate-700 mb-6">
            Are you sure you want to delete "<strong>{projectName}</strong>"? 
            This will permanently remove all associated ideas, files, and data.
          </p>
          <div className="flex space-x-3">
            <button
              onClick={() => setShowDeleteConfirm(null)}
              className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => handleDeleteProject(projectId)}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Delete Project
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Project Management</h1>
          <p className="text-slate-600">Oversee all platform projects and their content</p>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search projects by name or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center space-x-3">
              <Filter className="w-5 h-5 text-slate-400" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Projects</option>
                <option value="active">Active Only</option>
                <option value="paused">Paused</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>
        </div>

        {/* Projects Grid */}
        {isLoading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Activity className="w-6 h-6 text-blue-600 animate-pulse" />
            </div>
            <p className="text-slate-600">Loading projects...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map((project) => (
              <div key={project.id} className="bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl flex items-center justify-center text-xl">
                      {getProjectTypeIcon(project.project_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-900 truncate">{project.name}</h3>
                      <p className="text-sm text-slate-600 line-clamp-2">{project.description}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2 mb-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(project.status)}`}>
                    {project.status}
                  </span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(project.priority_level)}`}>
                    {project.priority_level}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="text-center">
                    <div className="text-lg font-bold text-slate-900">{project.idea_count}</div>
                    <div className="text-xs text-slate-500">Ideas</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-slate-900">{project.file_count}</div>
                    <div className="text-xs text-slate-500">Files</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-slate-900">{project.collaborator_count}</div>
                    <div className="text-xs text-slate-500">Users</div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm text-slate-500 mb-4">
                  <span>Last activity</span>
                  <span>{project.last_activity ? AdminService.getRelativeTime(project.last_activity) : 'No activity'}</span>
                </div>

                <button
                  onClick={() => {
                    setSelectedProject(project)
                    setShowProjectModal(true)
                  }}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  <span>View Details</span>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Results summary */}
        <div className="mt-6 text-sm text-slate-600 text-center">
          Showing {filteredProjects.length} of {projects.length} projects
        </div>

        {/* Modals */}
        {showProjectModal && selectedProject && (
          <ProjectModal project={selectedProject} />
        )}

        {showDeleteConfirm && (
          <DeleteConfirmModal 
            projectId={showDeleteConfirm}
            projectName={projects.find(p => p.id === showDeleteConfirm)?.name || ''}
          />
        )}
      </div>
    </div>
  )
}

export default ProjectManagement