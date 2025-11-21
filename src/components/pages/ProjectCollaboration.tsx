import React, { useState, useEffect } from 'react'
import { Users, UserPlus, Crown, Settings, Bell, Activity, ArrowLeft } from 'lucide-react'
import { User, Project } from '../../types'
import { DatabaseService } from '../../lib/database'
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
      const role = await DatabaseService.getUserProjectRole(currentProject.id, currentUser.id)
      setUserRole(role || 'viewer')
    } catch (_error) {
      logger.error('Error loading user role:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadCollaboratorCount = async () => {
    try {
      const collaborators = await DatabaseService.getProjectCollaborators(currentProject.id)
      setCollaboratorCount(collaborators.length + 1) // +1 for owner
    } catch (_error) {
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

  const getRoleStyles = (role: string) => {
    switch (role) {
      case 'owner':
        return {
          backgroundColor: 'var(--garnet-50)',
          color: 'var(--garnet-800)',
          borderColor: 'var(--garnet-200)'
        }
      case 'admin':
        return {
          backgroundColor: 'var(--sapphire-50)',
          color: 'var(--sapphire-800)',
          borderColor: 'var(--sapphire-200)'
        }
      case 'editor':
        return {
          backgroundColor: 'var(--emerald-50)',
          color: 'var(--emerald-800)',
          borderColor: 'var(--emerald-200)'
        }
      case 'viewer':
        return {
          backgroundColor: 'var(--graphite-100)',
          color: 'var(--graphite-800)',
          borderColor: 'var(--graphite-300)'
        }
      default:
        return {
          backgroundColor: 'var(--graphite-100)',
          color: 'var(--graphite-800)',
          borderColor: 'var(--graphite-300)'
        }
    }
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 rounded w-1/3" style={{ backgroundColor: 'var(--graphite-200)' }}></div>
          <div className="h-32 rounded" style={{ backgroundColor: 'var(--graphite-200)' }}></div>
          <div className="h-64 rounded" style={{ backgroundColor: 'var(--graphite-200)' }}></div>
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
            <Button
              onClick={onNavigateBack}
              variant="ghost"
              size="md"
              icon={<ArrowLeft className="w-5 h-5" />}
            />
          )}
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--sapphire-100)' }}>
                <Users className="w-6 h-6" style={{ color: 'var(--sapphire-600)' }} />
              </div>
              <div>
                <h1 className="text-3xl font-bold" style={{ color: 'var(--graphite-900)' }}>Team Collaboration</h1>
                <p style={{ color: 'var(--graphite-600)' }}>Manage access and permissions for "{currentProject.name}"</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Your Role */}
        <div className="rounded-xl p-6 border" style={{
          backgroundColor: 'var(--surface-primary)',
          borderColor: 'var(--hairline-default)'
        }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--garnet-100)' }}>
              <Crown className="w-5 h-5" style={{ color: 'var(--garnet-600)' }} />
            </div>
            <div>
              <h3 className="font-semibold" style={{ color: 'var(--graphite-900)' }}>Your Role</h3>
              <p className="text-sm" style={{ color: 'var(--graphite-600)' }}>Current access level</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium" style={getRoleStyles(userRole)}>
              <Crown className="w-4 h-4" />
              {getRoleDisplayName(userRole)}
            </div>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--graphite-600)' }}>
              {getRoleDescription(userRole)}
            </p>
          </div>
        </div>

        {/* Team Size */}
        <div className="rounded-xl p-6 border" style={{
          backgroundColor: 'var(--surface-primary)',
          borderColor: 'var(--hairline-default)'
        }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--emerald-100)' }}>
              <Users className="w-5 h-5" style={{ color: 'var(--emerald-600)' }} />
            </div>
            <div>
              <h3 className="font-semibold" style={{ color: 'var(--graphite-900)' }}>Team Size</h3>
              <p className="text-sm" style={{ color: 'var(--graphite-600)' }}>Active collaborators</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="text-3xl font-bold" style={{ color: 'var(--graphite-900)' }}>
              {collaboratorCount}
            </div>
            <p className="text-xs" style={{ color: 'var(--graphite-600)' }}>
              Including project owner and invited members
            </p>
          </div>
        </div>

        {/* Project Status */}
        <div className="rounded-xl p-6 border" style={{
          backgroundColor: 'var(--surface-primary)',
          borderColor: 'var(--hairline-default)'
        }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--sapphire-100)' }}>
              <Activity className="w-5 h-5" style={{ color: 'var(--sapphire-600)' }} />
            </div>
            <div>
              <h3 className="font-semibold" style={{ color: 'var(--graphite-900)' }}>Project Status</h3>
              <p className="text-sm" style={{ color: 'var(--graphite-600)' }}>Current state</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium" style={
              currentProject.status === 'active' ? { backgroundColor: 'var(--emerald-100)', color: 'var(--emerald-800)' } :
              currentProject.status === 'paused' ? { backgroundColor: 'var(--amber-100)', color: 'var(--amber-800)' } :
              currentProject.status === 'completed' ? { backgroundColor: 'var(--sapphire-100)', color: 'var(--sapphire-800)' } :
              { backgroundColor: 'var(--graphite-100)', color: 'var(--graphite-800)' }
            }>
              <div className="w-2 h-2 rounded-full" style={{
                backgroundColor:
                  currentProject.status === 'active' ? 'var(--emerald-500)' :
                  currentProject.status === 'paused' ? 'var(--amber-500)' :
                  currentProject.status === 'completed' ? 'var(--sapphire-500)' :
                  'var(--graphite-500)'
              }}></div>
              {currentProject.status}
            </div>
            <p className="text-xs capitalize" style={{ color: 'var(--graphite-600)' }}>
              {currentProject.project_type.replace('_', ' ')} project
            </p>
          </div>
        </div>
      </div>

      {/* Permission Guidelines */}
      <div className="rounded-xl border p-6 mb-8" style={{
        backgroundColor: 'var(--sapphire-50)',
        borderColor: 'var(--sapphire-200)'
      }}>
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--sapphire-600)' }}>
            <Settings className="w-4 h-4" style={{ color: 'white' }} />
          </div>
          <div>
            <h3 className="font-semibold mb-2" style={{ color: 'var(--sapphire-900)' }}>Permission Levels</h3>
            <div className="space-y-2 text-sm" style={{ color: 'var(--sapphire-800)' }}>
              <div className="flex items-center gap-2">
                <Crown className="w-4 h-4" style={{ color: 'var(--garnet-600)' }} />
                <span className="font-medium">Owner:</span>
                <span>Full control, can delete project and manage all settings</span>
              </div>
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4" style={{ color: 'var(--sapphire-600)' }} />
                <span className="font-medium">Admin:</span>
                <span>Can invite/remove collaborators and change project settings</span>
              </div>
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4" style={{ color: 'var(--emerald-600)' }} />
                <span className="font-medium">Editor:</span>
                <span>Can create, edit, and move ideas in the matrix</span>
              </div>
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4" style={{ color: 'var(--graphite-600)' }} />
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
        <div className="mt-8 rounded-xl border p-6" style={{
          backgroundColor: 'var(--amber-50)',
          borderColor: 'var(--amber-200)'
        }}>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--amber-600)' }}>
              <Activity className="w-4 h-4" style={{ color: 'white' }} />
            </div>
            <div>
              <h3 className="font-semibold mb-3" style={{ color: 'var(--amber-900)' }}>AI Project Analysis</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="font-medium" style={{ color: 'var(--amber-800)' }}>Industry:</span>
                  <p className="mt-1" style={{ color: 'var(--amber-700)' }}>{currentProject.ai_analysis.industry}</p>
                </div>
                <div>
                  <span className="font-medium" style={{ color: 'var(--amber-800)' }}>Scope:</span>
                  <p className="mt-1" style={{ color: 'var(--amber-700)' }}>{currentProject.ai_analysis.scope}</p>
                </div>
                <div>
                  <span className="font-medium" style={{ color: 'var(--amber-800)' }}>Timeline:</span>
                  <p className="mt-1" style={{ color: 'var(--amber-700)' }}>{currentProject.ai_analysis.timeline}</p>
                </div>
                <div>
                  <span className="font-medium" style={{ color: 'var(--amber-800)' }}>Goals:</span>
                  <p className="mt-1" style={{ color: 'var(--amber-700)' }}>
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