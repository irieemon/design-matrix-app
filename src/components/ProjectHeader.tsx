import { useState, useEffect, useCallback } from 'react'
import { Edit2, Check, X, Plus, Sparkles, ChevronDown, ChevronUp } from 'lucide-react'
import { Project, IdeaCard, User } from '../types'
import { DatabaseService } from '../lib/database'
import AIStarterModal from './AIStarterModal'
import { Button } from './ui/Button'

interface ProjectHeaderProps {
  currentUser: User
  currentProject?: Project | null
  onProjectChange?: (project: Project | null) => void
}

// Input focus handlers for Lux focus states
const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
  e.target.style.borderColor = 'var(--sapphire-500)'
  e.target.style.boxShadow = '0 0 0 3px var(--sapphire-100)'
}

const handleInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
  e.target.style.borderColor = 'var(--hairline-default)'
  e.target.style.boxShadow = 'none'
}

const ProjectHeader: React.FC<ProjectHeaderProps> = ({ currentUser, currentProject, onProjectChange }) => {
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [showAIStarter, setShowAIStarter] = useState(false)
  const [isDescriptionCollapsed, setIsDescriptionCollapsed] = useState(false)

  // Auto-collapse long descriptions
  useEffect(() => {
    // ✅ CRITICAL FIX: Use setTimeout(0) to prevent cascading renders
    setTimeout(() => {
      if (currentProject?.description) {
        // Estimate lines: approximately 80 characters per line
        const estimatedLines = Math.ceil(currentProject.description.length / 80)
        // Auto-collapse if more than 3 lines
        setIsDescriptionCollapsed(estimatedLines > 3)
      } else {
        setIsDescriptionCollapsed(false)
      }
    }, 0)
  }, [currentProject?.description])

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

  const handleAIProjectCreated = useCallback((newProject: Project, _ideas: IdeaCard[]) => {
    if (onProjectChange) {
      onProjectChange(newProject)
    }
    // Skip onIdeasCreated - real-time subscription will handle idea updates
  }, [onProjectChange])

  const handleCloseAIStarter = useCallback(() => {
    setShowAIStarter(false)
  }, [])

  if (isCreating) {
    return (
      <div
        className="rounded-2xl shadow-sm p-6 mb-6"
        style={{
          backgroundColor: 'var(--surface-primary)',
          borderWidth: '1px',
          borderStyle: 'solid',
          borderColor: 'var(--hairline-default)'
        }}
      >
        <div className="space-y-4">
          <div>
            <label
              className="block text-sm font-medium mb-2"
              style={{ color: 'var(--graphite-700)' }}
            >
              Project Name
            </label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Enter project name..."
              className="w-full px-3 py-2 rounded-lg focus:outline-none"
              style={{
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: 'var(--hairline-default)',
                transition: 'border-color 0.15s, box-shadow 0.15s'
              }}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              autoFocus
            />
          </div>
          <div>
            <label
              className="block text-sm font-medium mb-2"
              style={{ color: 'var(--graphite-700)' }}
            >
              Description (optional)
            </label>
            <input
              type="text"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Brief description of your project..."
              className="w-full px-3 py-2 rounded-lg focus:outline-none"
              style={{
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: 'var(--hairline-default)',
                transition: 'border-color 0.15s, box-shadow 0.15s'
              }}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
            />
          </div>
          <div className="flex space-x-2">
            <Button
              onClick={handleCreateProject}
              disabled={!editName.trim()}
              variant="primary"
              icon={<Check className="w-4 h-4" />}
            >
              Create Project
            </Button>
            <Button
              onClick={cancelEdit}
              variant="secondary"
              icon={<X className="w-4 h-4" />}
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (!currentProject) {
    return (
      <div
        className="rounded-2xl shadow-sm p-6 mb-6"
        style={{
          backgroundColor: 'var(--surface-primary)',
          borderWidth: '1px',
          borderStyle: 'solid',
          borderColor: 'var(--hairline-default)'
        }}
      >
        <div className="text-center">
          <h3
            className="text-lg font-medium mb-2"
            style={{ color: 'var(--graphite-900)' }}
          >
            Create Your First Project
          </h3>
          <p
            className="mb-4"
            style={{ color: 'var(--graphite-600)' }}
          >
            Give your priority matrix a name to get started
          </p>
          <div className="flex justify-center space-x-3">
            <Button
              onClick={() => setShowAIStarter(true)}
              variant="sapphire"
              icon={<Sparkles className="w-4 h-4" />}
            >
              AI Starter
            </Button>
            <Button
              onClick={startCreating}
              variant="primary"
              icon={<Plus className="w-4 h-4" />}
            >
              Manual Setup
            </Button>
          </div>
        </div>

        {showAIStarter && (
          <AIStarterModal
            currentUser={currentUser}
            onClose={handleCloseAIStarter}
            onProjectCreated={handleAIProjectCreated}
          />
        )}
      </div>
    )
  }

  if (isEditing) {
    return (
      <div
        className="rounded-2xl shadow-sm p-6 mb-6"
        style={{
          backgroundColor: 'var(--surface-primary)',
          borderWidth: '1px',
          borderStyle: 'solid',
          borderColor: 'var(--hairline-default)'
        }}
      >
        <div className="space-y-4">
          <div>
            <label
              className="block text-sm font-medium mb-2"
              style={{ color: 'var(--graphite-700)' }}
            >
              Project Name
            </label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg focus:outline-none"
              style={{
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: 'var(--hairline-default)',
                transition: 'border-color 0.15s, box-shadow 0.15s'
              }}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              autoFocus
            />
          </div>
          <div>
            <label
              className="block text-sm font-medium mb-2"
              style={{ color: 'var(--graphite-700)' }}
            >
              Description (optional)
            </label>
            <input
              type="text"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Brief description of your project..."
              className="w-full px-3 py-2 rounded-lg focus:outline-none"
              style={{
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: 'var(--hairline-default)',
                transition: 'border-color 0.15s, box-shadow 0.15s'
              }}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
            />
          </div>
          <div className="flex space-x-2">
            <Button
              onClick={handleUpdateProject}
              disabled={!editName.trim()}
              variant="primary"
              icon={<Check className="w-4 h-4" />}
            >
              Save Changes
            </Button>
            <Button
              onClick={cancelEdit}
              variant="secondary"
              icon={<X className="w-4 h-4" />}
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="rounded-2xl shadow-sm p-6 mb-6"
      style={{
        backgroundColor: 'var(--surface-primary)',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: 'var(--hairline-default)'
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <h1
              className="text-2xl font-bold"
              style={{ color: 'var(--graphite-900)' }}
            >
              {currentProject?.name || 'No Project Selected'}
            </h1>
            {currentProject?.description && Math.ceil(currentProject.description.length / 80) > 3 && (
              <button
                onClick={() => setIsDescriptionCollapsed(!isDescriptionCollapsed)}
                className="flex items-center transition-colors"
                style={{
                  color: 'var(--graphite-400)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--graphite-600)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--graphite-400)'
                }}
                title={isDescriptionCollapsed ? "Show full description" : "Collapse description"}
              >
                {isDescriptionCollapsed ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronUp className="w-4 h-4" />
                )}
              </button>
            )}
          </div>
          {currentProject?.description && (
            <div
              className={`transition-all duration-200 ${isDescriptionCollapsed && Math.ceil(currentProject.description.length / 80) > 3 ? 'line-clamp-3' : ''}`}
              style={{ color: 'var(--graphite-600)' }}
            >
              {isDescriptionCollapsed && Math.ceil(currentProject.description.length / 80) > 3
                ? currentProject.description.substring(0, 240) + '...'
                : currentProject.description}
            </div>
          )}
          {currentProject && (
            <div
              className="text-xs mt-2"
              style={{ color: 'var(--graphite-500)' }}
            >
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
          className="flex items-center space-x-2 px-3 py-2 rounded-lg transition-all"
          style={{
            color: 'var(--graphite-600)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--graphite-900)'
            e.currentTarget.style.backgroundColor = 'var(--surface-primary)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--graphite-600)'
            e.currentTarget.style.backgroundColor = 'transparent'
          }}
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