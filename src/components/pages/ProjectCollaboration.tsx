import React, { useState, useEffect } from 'react'
import { Users, UserPlus, Crown, Settings, Bell, Activity, ArrowLeft } from 'lucide-react'
import { User, Project } from '../../types'
import { DatabaseService } from '../../lib/database'
import ProjectCollaborators from '../ProjectCollaborators'

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
      const role = await DatabaseService.getUserProjectRole(currentProject.id, currentUser.id)
      setUserRole(role || 'viewer')
    } catch (error) {
      console.error('Error loading user role:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadCollaboratorCount = async () => {
    try {
      const collaborators = await DatabaseService.getProjectCollaborators(currentProject.id)
      setCollaboratorCount(collaborators.length + 1) // +1 for owner
    } catch (error) {
      console.error('Error loading collaborator count:', error)
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

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner': return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'admin': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'editor': return 'bg-green-100 text-green-800 border-green-200'
      case 'viewer': return 'bg-gray-100 text-gray-800 border-gray-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-slate-200 rounded w-1/3"></div>
          <div className="h-32 bg-slate-200 rounded"></div>
          <div className="h-64 bg-slate-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          {onNavigateBack && (
            <button
              onClick={onNavigateBack}
              className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
          )}
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                <Users className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-900">Team Collaboration</h1>
                <p className="text-slate-600">Manage access and permissions for "{currentProject.name}"</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Your Role */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center">
              <Crown className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Your Role</h3>
              <p className="text-sm text-gray-600">Current access level</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium ${getRoleColor(userRole)}`}>
              <Crown className="w-4 h-4" />
              {getRoleDisplayName(userRole)}
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              {getRoleDescription(userRole)}
            </p>
          </div>
        </div>

        {/* Team Size */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-teal-500 rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Team Size</h3>
              <p className="text-sm text-gray-600">Active collaborators</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="text-3xl font-bold text-gray-900">
              {collaboratorCount}
            </div>
            <p className="text-xs text-gray-600">
              Including project owner and invited members
            </p>
          </div>
        </div>

        {/* Project Status */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Project Status</h3>
              <p className="text-sm text-gray-600">Current state</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${
              currentProject.status === 'active' ? 'bg-green-100 text-green-800' :
              currentProject.status === 'paused' ? 'bg-yellow-100 text-yellow-800' :
              currentProject.status === 'completed' ? 'bg-blue-100 text-blue-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                currentProject.status === 'active' ? 'bg-green-500' :
                currentProject.status === 'paused' ? 'bg-yellow-500' :
                currentProject.status === 'completed' ? 'bg-blue-500' :
                'bg-gray-500'
              }`}></div>
              {currentProject.status}
            </div>
            <p className="text-xs text-gray-600 capitalize">
              {currentProject.project_type.replace('_', ' ')} project
            </p>
          </div>
        </div>
      </div>

      {/* Permission Guidelines */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-6 mb-8">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
            <Settings className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-blue-900 mb-2">Permission Levels</h3>
            <div className="space-y-2 text-sm text-blue-800">
              <div className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-purple-600" />
                <span className="font-medium">Owner:</span>
                <span>Full control, can delete project and manage all settings</span>
              </div>
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-blue-600" />
                <span className="font-medium">Admin:</span>
                <span>Can invite/remove collaborators and change project settings</span>
              </div>
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-green-600" />
                <span className="font-medium">Editor:</span>
                <span>Can create, edit, and move ideas in the matrix</span>
              </div>
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-gray-600" />
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
        <div className="mt-8 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-200 p-6">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <Activity className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-purple-900 mb-3">AI Project Analysis</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="font-medium text-purple-800">Industry:</span>
                  <p className="text-purple-700 mt-1">{currentProject.ai_analysis.industry}</p>
                </div>
                <div>
                  <span className="font-medium text-purple-800">Scope:</span>
                  <p className="text-purple-700 mt-1">{currentProject.ai_analysis.scope}</p>
                </div>
                <div>
                  <span className="font-medium text-purple-800">Timeline:</span>
                  <p className="text-purple-700 mt-1">{currentProject.ai_analysis.timeline}</p>
                </div>
                <div>
                  <span className="font-medium text-purple-800">Goals:</span>
                  <p className="text-purple-700 mt-1">
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