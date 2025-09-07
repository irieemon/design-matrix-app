import { useState } from 'react'
import { Edit2, Check, X, Plus, Sparkles } from 'lucide-react'
import { Project, IdeaCard, User } from '../types'
import { DatabaseService } from '../lib/database'
import AIStarterModal from './AIStarterModal'

interface ProjectHeaderProps {
  currentUser: User
  currentProject?: Project | null
  onProjectChange?: (project: Project | null) => void
  onIdeasCreated?: (ideas: IdeaCard[]) => void
}

const ProjectHeader: React.FC<ProjectHeaderProps> = ({ currentUser, currentProject, onProjectChange, onIdeasCreated }) => {
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [showAIStarter, setShowAIStarter] = useState(false)

  // No longer loading project independently - using the currentProject prop instead

  const handleCreateProject = async () => {
    if (!editName.trim()) return

    const newProject = await DatabaseService.createProject({
      name: editName.trim(),
      description: editDescription.trim() || undefined,
      project_type: 'other',
      status: 'active',
      priority_level: 'medium',
      visibility: 'private',
      owner_id: currentUser.id
    })

    if (newProject) {
      setIsCreating(false)
      setEditName('')
      setEditDescription('')
      if (onProjectChange) {
        onProjectChange(newProject)
      }
    }
  }

  const handleUpdateProject = async () => {
    if (!currentProject || !editName.trim()) return

    const updatedProject = await DatabaseService.updateProject(currentProject.id, {
      name: editName.trim(),
      description: editDescription.trim() || undefined
    })

    if (updatedProject) {
      setIsEditing(false)
      if (onProjectChange) {
        onProjectChange(updatedProject)
      }
    }
  }

  const startEditing = () => {
    if (currentProject) {
      setEditName(currentProject.name)
      setEditDescription(currentProject.description || '')
      setIsEditing(true)
    }
  }

  const startCreating = () => {
    setEditName('')
    setEditDescription('')
    setIsCreating(true)
  }

  const cancelEdit = () => {
    setIsEditing(false)
    setIsCreating(false)
    setEditName('')
    setEditDescription('')
  }

  const handleAIProjectCreated = (newProject: Project, ideas: IdeaCard[]) => {
    if (onProjectChange) {
      onProjectChange(newProject)
    }
    if (onIdeasCreated) {
      onIdeasCreated(ideas)
    }
  }

  if (isCreating) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6 mb-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Project Name
            </label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Enter project name..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Description (optional)
            </label>
            <input
              type="text"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Brief description of your project..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex space-x-2">
            <button
              onClick={handleCreateProject}
              disabled={!editName.trim()}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check className="w-4 h-4" />
              <span>Create Project</span>
            </button>
            <button
              onClick={cancelEdit}
              className="flex items-center space-x-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <X className="w-4 h-4" />
              <span>Cancel</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!currentProject) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6 mb-6">
        <div className="text-center">
          <h3 className="text-lg font-medium text-slate-900 mb-2">Create Your First Project</h3>
          <p className="text-slate-600 mb-4">Give your priority matrix a name to get started</p>
          <div className="flex justify-center space-x-3">
            <button
              onClick={() => setShowAIStarter(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              <span>AI Starter</span>
            </button>
            <button
              onClick={startCreating}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Manual Setup</span>
            </button>
          </div>
        </div>
        
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

  if (isEditing) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6 mb-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Project Name
            </label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Description (optional)
            </label>
            <input
              type="text"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Brief description of your project..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex space-x-2">
            <button
              onClick={handleUpdateProject}
              disabled={!editName.trim()}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check className="w-4 h-4" />
              <span>Save Changes</span>
            </button>
            <button
              onClick={cancelEdit}
              className="flex items-center space-x-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <X className="w-4 h-4" />
              <span>Cancel</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-r from-slate-50 to-blue-50 rounded-2xl shadow-sm border border-slate-200/60 p-6 mb-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">{currentProject?.name || 'No Project Selected'}</h1>
          {currentProject?.description && (
            <p className="text-slate-600">{currentProject.description}</p>
          )}
          {currentProject && (
            <div className="text-xs text-slate-500 mt-2">
              Created by {
                currentProject.owner?.full_name || 
                currentProject.owner?.email || 
                (currentProject.owner_id === currentUser?.id 
                  ? (currentUser?.full_name || currentUser?.email || 'You')
                  : 'Unknown')
              } • {new Date(currentProject.created_at).toLocaleDateString()}
            </div>
          )}
        </div>
        <button
          onClick={startEditing}
          className="flex items-center space-x-2 px-3 py-2 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition-all"
          title="Edit project details"
        >
          <Edit2 className="w-4 h-4" />
          <span className="text-sm">Edit</span>
        </button>
      </div>
    </div>
  )
}

export default ProjectHeader