import React, { useState, useEffect } from 'react'
import { Users, UserPlus, Crown, Settings, Bell, Activity, ArrowLeft } from 'lucide-react'
import { User, Project } from '../../types'
import { CollaborationService } from '../../lib/services/CollaborationService'
import ProjectCollaborators from '../ProjectCollaborators'
import { logger } from '../../utils/logger'
import { Button } from '../ui/Button'

interface ProjectCollaborationProps {
  currentUser: User
  currentProject: Project
  onNavigateBack?: () => void
}

const ProjectCollaboration: React.FC<ProjectCollaborationProps> = ({
  currentUser,
  currentProject,
  onNavigateBack
}) => {
  const [userRole, setUserRole] = useState<string>('viewer')
  const [collaboratorCount, setCollaboratorCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadUserRole()
    loadCollaboratorCount()
  }, [currentProject.id, currentUser.id])

  const loadUserRole = async () => {
    try {
      const result = await CollaborationService.getUserProjectRole(
        currentProject.id,
        currentUser.id,
        { userId: currentUser.id }
      )
      const role = result.success ? result.data : null
      setUserRole(role || 'viewer')
    } catch (error) {
      logger.error('Error loading user role:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadCollaboratorCount = async () => {
    try {
      const result = await CollaborationService.getProjectCollaborators(
        currentProject.id,
        { userId: currentUser.id }
      )
      const collaborators = result.success ? result.data : []
      setCollaboratorCount(collaborators.length + 1) // +1 for owner
    } catch (error) {
      logger.error('Error loading collaborator count:', error)
    }
  }

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'owner': return 'Project Owner'
      case 'admin': return 'Administrator'
      case 'editor': return 'Editor'
      case 'viewer': return 'Viewer'
      default: return 'Team Member'
    }
  }

  const getRoleDescription = (role: string) => {
    switch (role) {
      case 'owner': return 'Full control over the project and all settings'
      case 'admin': return 'Can manage collaborators and project settings'
      case 'editor': return 'Can create and edit ideas, move cards around'
      case 'viewer': return 'Can view the project but cannot make changes'
      default: return 'Standard team member access'
    }
  }

  const getRoleClasses = (role: string) => {
    switch (role) {
      case 'owner':
        return 'bg-garnet-50 text-garnet-800 border-garnet-200'
      case 'admin':
        return 'bg-sapphire-50 text-sapphire-800 border-sapphire-200'
      case 'editor':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200'
      case 'viewer':
        return 'bg-graphite-100 text-graphite-800 border-graphite-300'
      default:
        return 'bg-graphite-100 text-graphite-800 border-graphite-300'
    }
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 rounded w-1/3 bg-graphite-200"></div>
          <div className="h-32 rounded bg-graphite-200"></div>
          <div className="h-64 rounded bg-graphite-200"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 sm:mb-8">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
          {onNavigateBack && (
            <Button
              onClick={onNavigateBack}
              variant="ghost"
              size="md"
              icon={<ArrowLeft className="w-5 h-5" />}
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 mb-2 min-w-0">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center bg-sapphire-100 flex-shrink-0">
                <Users className="w-5 h-5 sm:w-6 sm:h-6 text-info-600" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-3xl font-bold text-graphite-900 truncate">Team Collaboration</h1>
                <p className="text-sm sm:text-base text-graphite-600 truncate">Manage access and permissions for "{currentProject.name}"</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Your Role */}
        <div className="rounded-xl p-6 border bg-surface-primary border-hairline-default">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-garnet-100">
              <Crown className="w-5 h-5 text-garnet-600" />
            </div>
            <div>
              <h3 className="font-semibold text-graphite-900">Your Role</h3>
              <p className="text-sm text-graphite-600">Current access level</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium ${getRoleClasses(userRole)}`}>
              <Crown className="w-4 h-4" />
              {getRoleDisplayName(userRole)}
            </div>
            <p className="text-xs leading-relaxed text-graphite-600">
              {getRoleDescription(userRole)}
            </p>
          </div>
        </div>

        {/* Team Size */}
        <div className="rounded-xl p-6 border bg-surface-primary border-hairline-default">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-emerald-100">
              <Users className="w-5 h-5 text-success-600" />
            </div>
            <div>
              <h3 className="font-semibold text-graphite-900">Team Size</h3>
              <p className="text-sm text-graphite-600">Active collaborators</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="text-3xl font-bold text-graphite-900">
              {collaboratorCount}
            </div>
            <p className="text-xs text-graphite-600">
              Including project owner and invited members
            </p>
          </div>
        </div>

        {/* Project Status */}
        <div className="rounded-xl p-6 border bg-surface-primary border-hairline-default">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-sapphire-100">
              <Activity className="w-5 h-5 text-info-600" />
            </div>
            <div>
              <h3 className="font-semibold text-graphite-900">Project Status</h3>
              <p className="text-sm text-graphite-600">Current state</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${
              currentProject.status === 'active' ? 'bg-emerald-100 text-emerald-800' :
              currentProject.status === 'paused' ? 'bg-amber-100 text-amber-800' :
              currentProject.status === 'completed' ? 'bg-sapphire-100 text-sapphire-800' :
              'bg-graphite-100 text-graphite-800'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                currentProject.status === 'active' ? 'bg-emerald-500' :
                currentProject.status === 'paused' ? 'bg-amber-500' :
                currentProject.status === 'completed' ? 'bg-sapphire-500' :
                'bg-graphite-500'
              }`}></div>
              {currentProject.status}
            </div>
            <p className="text-xs capitalize text-graphite-600">
              {currentProject.project_type.replace('_', ' ')} project
            </p>
          </div>
        </div>
      </div>

      {/* Permission Guidelines */}
      <div className="rounded-xl border p-6 mb-8 bg-info-50 border-info-200">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-info-600">
            <Settings className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="font-semibold mb-2 text-sapphire-900">Permission Levels</h3>
            <div className="space-y-2 text-sm text-sapphire-800">
              <div className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-garnet-600" />
                <span className="font-medium">Owner:</span>
                <span>Full control, can delete project and manage all settings</span>
              </div>
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-info-600" />
                <span className="font-medium">Admin:</span>
                <span>Can invite/remove collaborators and change project settings</span>
              </div>
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-success-600" />
                <span className="font-medium">Editor:</span>
                <span>Can create, edit, and move ideas in the matrix</span>
              </div>
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-graphite-600" />
                <span className="font-medium">Viewer:</span>
                <span>Read-only access to view project and ideas</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Team Management */}
      <ProjectCollaborators
        projectId={currentProject.id}
        projectName={currentProject.name}
        ownerId={currentProject.owner_id}
        currentUserRole={userRole}
        currentUser={currentUser}
      />

      {/* AI Analysis Section (if AI generated) */}
      {currentProject.is_ai_generated && currentProject.ai_analysis && (
        <div className="mt-8 rounded-xl border p-6 bg-amber-50 border-amber-200">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-amber-600">
              <Activity className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-semibold mb-3 text-amber-900">AI Project Analysis</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="font-medium text-amber-800">Industry:</span>
                  <p className="mt-1 text-amber-700">{currentProject.ai_analysis.industry}</p>
                </div>
                <div>
                  <span className="font-medium text-amber-800">Scope:</span>
                  <p className="mt-1 text-amber-700">{currentProject.ai_analysis.scope}</p>
                </div>
                <div>
                  <span className="font-medium text-amber-800">Timeline:</span>
                  <p className="mt-1 text-amber-700">{currentProject.ai_analysis.timeline}</p>
                </div>
                <div>
                  <span className="font-medium text-amber-800">Goals:</span>
                  <p className="mt-1 text-amber-700">
                    {currentProject.ai_analysis.primaryGoals?.join(', ') || 'Various objectives'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProjectCollaboration