import React, { useState, useEffect } from 'react'
import { Users, UserPlus, Crown, Shield, Edit3, Trash2, MoreHorizontal, Mail } from 'lucide-react'
import { DatabaseService } from '../lib/database'
import InviteCollaboratorModal from './InviteCollaboratorModal'
import { logger } from '../utils/logger'

interface Collaborator {
  id: string
  project_id: string
  user_id: string
  role: string
  invited_by: string
  status: string
  created_at: string
  updated_at: string
  user?: {
    id: string
    email: string
    raw_user_meta_data?: {
      full_name?: string
      avatar_url?: string
    }
  }
}

interface ProjectCollaboratorsProps {
  projectId: string
  projectName: string
  ownerId: string
  currentUserRole: string
  currentUser: { id: string; email: string }
}

const roleConfig = {
  owner: { label: 'Owner', icon: Crown, color: 'text-purple-600 bg-purple-100' },
  admin: { label: 'Admin', icon: Shield, color: 'text-blue-600 bg-blue-100' },
  editor: { label: 'Editor', icon: Edit3, color: 'text-green-600 bg-green-100' },
  viewer: { label: 'Viewer', icon: Users, color: 'text-gray-600 bg-gray-100' }
}

const ProjectCollaborators: React.FC<ProjectCollaboratorsProps> = ({
  projectId,
  projectName,
  ownerId,
  currentUserRole,
  currentUser
}) => {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [loading, setLoading] = useState(true)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null)
  const [updating, setUpdating] = useState<string | null>(null)
  const [removeConfirm, setRemoveConfirm] = useState<{ collaborator: Collaborator; show: boolean }>({ collaborator: null as any, show: false })

  const canManageCollaborators = ['owner', 'admin'].includes(currentUserRole)
  const canInvite = canManageCollaborators

  useEffect(() => {
    loadCollaborators()
    
    // Subscribe to real-time collaborator updates
    const unsubscribe = DatabaseService.subscribeToProjectCollaborators(projectId, setCollaborators)
    
    return unsubscribe
  }, [projectId])

  const loadCollaborators = async () => {
    setLoading(true)
    try {
      logger.debug('🔄 ProjectCollaborators: Loading collaborators for project:', projectId)
      const data = await DatabaseService.getProjectCollaborators(projectId)
      logger.debug('📋 ProjectCollaborators: Received collaborator data:', data)
      setCollaborators(data)
      logger.debug('✅ ProjectCollaborators: Updated collaborators state with', data.length, 'items')
    } catch (error) {
      logger.error('❌ ProjectCollaborators: Error loading collaborators:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleInvite = async (email: string, role: string) => {
    logger.debug('📧 ProjectCollaborators: handleInvite called with:', { email, role, projectId, currentUserId: currentUser?.id })
    
    if (!currentUser?.id) {
      logger.error('❌ ProjectCollaborators: No current user ID available')
      return false
    }

    try {
      logger.debug('🔄 ProjectCollaborators: Calling DatabaseService.addProjectCollaborator...')
      const success = await DatabaseService.addProjectCollaborator(
        projectId, 
        email, 
        role, 
        currentUser.id,
        projectName,
        currentUser.email?.split('@')[0] || 'Project Owner',
        currentUser.email
      )
      logger.debug('📊 ProjectCollaborators: addProjectCollaborator returned:', success)
      
      if (success) {
        logger.debug('✅ ProjectCollaborators: Invitation successful, reloading collaborators...')
        await loadCollaborators()
        return true
      }
      logger.error('❌ ProjectCollaborators: Invitation failed')
      return false
    } catch (error) {
      logger.error('💥 ProjectCollaborators: Error inviting collaborator:', error)
      return false
    }
  }

  const handleRoleChange = async (collaboratorId: string, userId: string, newRole: string) => {
    setUpdating(collaboratorId)
    try {
      const success = await DatabaseService.updateCollaboratorRole(projectId, userId, newRole)
      if (success) {
        await loadCollaborators()
      }
    } catch (error) {
      logger.error('Error updating role:', error)
    } finally {
      setUpdating(null)
      setActionMenuOpen(null)
    }
  }

  const handleRemoveCollaborator = async (collaborator: Collaborator) => {
    setRemoveConfirm({ collaborator, show: true })
    setActionMenuOpen(null)
  }

  const confirmRemoveCollaborator = async () => {
    const { collaborator } = removeConfirm
    if (!collaborator) return

    setUpdating(collaborator.id)
    try {
      const success = await DatabaseService.removeProjectCollaborator(projectId, collaborator.user_id)
      if (success) {
        await loadCollaborators()
      }
    } catch (error) {
      logger.error('Error removing collaborator:', error)
    } finally {
      setUpdating(null)
      setRemoveConfirm({ collaborator: null as any, show: false })
    }
  }

  const getUserDisplayName = (collaborator: Collaborator) => {
    const userData = collaborator.user
    if (userData?.raw_user_meta_data?.full_name) {
      return userData.raw_user_meta_data.full_name
    }
    return userData?.email?.split('@')[0] || 'Unknown User'
  }

  const getUserInitials = (collaborator: Collaborator) => {
    const name = getUserDisplayName(collaborator)
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Users className="w-5 h-5" />
            Team Members
          </h3>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-3 p-3 animate-pulse">
              <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/4"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Users className="w-5 h-5" />
            Team Members
            <span className="bg-gray-100 text-gray-600 text-sm px-2 py-1 rounded-full ml-2">
              {collaborators.length + 1} {/* +1 for owner */}
            </span>
          </h3>
          
          {canInvite && (
            <button
              onClick={() => setShowInviteModal(true)}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              Invite
            </button>
          )}
        </div>

        {/* Owner */}
        <div className="mb-4">
          <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
            <div className="w-10 h-10 bg-purple-500 text-white rounded-full flex items-center justify-center font-semibold">
              {currentUser?.id === ownerId ? getUserInitials({ user: { email: currentUser.email || '' } } as Collaborator) : 'O'}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900">
                  {currentUser?.id === ownerId ? 'You' : 'Project Owner'}
                </span>
                <div className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium text-purple-600 bg-purple-100">
                  <Crown className="w-3 h-3" />
                  Owner
                </div>
              </div>
              <p className="text-sm text-gray-600">{currentUser?.id === ownerId ? currentUser.email : 'Project Creator'}</p>
            </div>
          </div>
        </div>

        {/* Collaborators */}
        <div className="space-y-2">
          {collaborators.map((collaborator) => {
            const RoleIcon = roleConfig[collaborator.role as keyof typeof roleConfig]?.icon || Users
            const roleColor = roleConfig[collaborator.role as keyof typeof roleConfig]?.color || 'text-gray-600 bg-gray-100'
            const isCurrentUser = collaborator.user_id === currentUser?.id
            const canManageThis = canManageCollaborators && !isCurrentUser

            return (
              <div
                key={collaborator.id}
                className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors"
              >
                {/* Avatar */}
                <div className="w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center font-semibold">
                  {getUserInitials(collaborator)}
                </div>

                {/* User Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">
                      {isCurrentUser ? 'You' : getUserDisplayName(collaborator)}
                    </span>
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${roleColor}`}>
                      <RoleIcon className="w-3 h-3" />
                      {roleConfig[collaborator.role as keyof typeof roleConfig]?.label || collaborator.role}
                    </div>
                    {collaborator.status === 'pending' && (
                      <div className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        ⏳ Pending
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 flex items-center gap-1">
                    <Mail className="w-3 h-3" />
                    {collaborator.user?.email}
                  </p>
                </div>

                {/* Actions */}
                {canManageThis && (
                  <div className="relative">
                    <button
                      onClick={() => setActionMenuOpen(actionMenuOpen === collaborator.id ? null : collaborator.id)}
                      disabled={updating === collaborator.id}
                      className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                      {updating === collaborator.id ? (
                        <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <MoreHorizontal className="w-4 h-4" />
                      )}
                    </button>

                    {/* Action Menu */}
                    {actionMenuOpen === collaborator.id && (
                      <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 w-48">
                        <div className="p-1">
                          <p className="text-xs text-gray-500 px-3 py-2 border-b border-gray-100">Change Role</p>
                          {Object.entries(roleConfig).map(([role, config]) => {
                            if (role === 'owner' || role === collaborator.role) return null
                            const Icon = config.icon
                            return (
                              <button
                                key={role}
                                onClick={() => handleRoleChange(collaborator.id, collaborator.user_id, role)}
                                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 transition-colors"
                              >
                                <Icon className="w-4 h-4 text-gray-500" />
                                <span className="text-sm">{config.label}</span>
                              </button>
                            )
                          })}
                          <div className="border-t border-gray-100 mt-1 pt-1">
                            <button
                              onClick={() => handleRemoveCollaborator(collaborator)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-red-50 text-red-600 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                              <span className="text-sm">Remove Access</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {collaborators.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-sm">No collaborators yet</p>
              {canInvite && (
                <p className="text-xs mt-1">Invite team members to start collaborating!</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Invite Modal */}
      <InviteCollaboratorModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onInvite={handleInvite}
        projectName={projectName}
      />

      {/* Remove Collaborator Confirmation Modal */}
      {removeConfirm.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Remove Team Member</h3>
                  <p className="text-sm text-gray-600">This action cannot be undone</p>
                </div>
              </div>
              
              <p className="text-gray-700 mb-6">
                Are you sure you want to remove <strong>{getUserDisplayName(removeConfirm.collaborator)}</strong> from this project? 
                They will lose access to all project data and be notified of this change.
              </p>
              
              <div className="flex space-x-3">
                <button
                  onClick={() => setRemoveConfirm({ collaborator: null as any, show: false })}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmRemoveCollaborator}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Remove Access
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default ProjectCollaborators