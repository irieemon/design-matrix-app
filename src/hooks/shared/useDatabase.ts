import { useCallback } from 'react'
import { DatabaseService } from '../../lib/database'
import { useAsyncOperation } from './useAsyncOperation'
import { IdeaCard, Project } from '../../types'
import { logger } from '../../utils/logger'

interface UseDatabaseOptions {
  onSuccess?: (data: any) => void
  onError?: (error: string) => void
  autoRefresh?: boolean
}

/**
 * Specialized hook for database operations with consistent error handling
 * and loading states. Provides common database operations as ready-to-use hooks.
 */

/**
 * Hook for managing project ideas with CRUD operations
 */
export function useProjectIdeas(projectId?: string, options: UseDatabaseOptions = {}) {
  const { state, execute, reset } = useAsyncOperation(
    async (id?: string) => {
      return id ? DatabaseService.getProjectIdeas(id) : DatabaseService.getAllIdeas()
    },
    {
      onSuccess: options.onSuccess,
      onError: options.onError,
      logErrors: true
    }
  )

  const loadIdeas = useCallback(
    (id?: string) => execute(id || projectId),
    [execute, projectId]
  )

  const createIdea = useAsyncOperation(
    async (idea: Omit<IdeaCard, 'id' | 'created_at' | 'updated_at'>) => {
      const result = await DatabaseService.createIdea(idea)
      if (result.success && result.data) {
        // Auto-refresh ideas after creation if enabled
        if (options.autoRefresh) {
          await loadIdeas()
        }
        return result.data
      }
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to create idea')
    },
    { onSuccess: options.onSuccess, onError: options.onError }
  )

  const updateIdea = useAsyncOperation(
    async (id: string, updates: Partial<Omit<IdeaCard, 'id' | 'created_at'>>) => {
      const result = await DatabaseService.updateIdea(id, updates)
      if (result) {
        // Auto-refresh ideas after update if enabled
        if (options.autoRefresh) {
          await loadIdeas()
        }
        return result
      }
      throw new Error('Failed to update idea')
    },
    { onSuccess: options.onSuccess, onError: options.onError }
  )

  const deleteIdea = useAsyncOperation(
    async (id: string) => {
      const success = await DatabaseService.deleteIdea(id)
      if (success) {
        // Auto-refresh ideas after deletion if enabled
        if (options.autoRefresh) {
          await loadIdeas()
        }
        return success
      }
      throw new Error('Failed to delete idea')
    },
    { onSuccess: options.onSuccess, onError: options.onError }
  )

  return {
    ideas: state.data || [],
    loading: state.loading,
    error: state.error,
    success: state.success,
    loadIdeas,
    createIdea: createIdea.execute,
    updateIdea: updateIdea.execute,
    deleteIdea: deleteIdea.execute,
    reset,
    createState: createIdea.state,
    updateState: updateIdea.state,
    deleteState: deleteIdea.state
  }
}

/**
 * Hook for managing projects with CRUD operations
 */
export function useProjects(userId?: string, options: UseDatabaseOptions = {}) {
  const { state, execute, reset } = useAsyncOperation(
    async (id?: string) => {
      if (id) {
        return DatabaseService.getUserOwnedProjects(id)
      }
      return DatabaseService.getAllProjects()
    },
    {
      onSuccess: options.onSuccess,
      onError: options.onError,
      logErrors: true
    }
  )

  const loadProjects = useCallback(
    (id?: string) => execute(id || userId),
    [execute, userId]
  )

  const createProject = useAsyncOperation(
    async (project: Omit<Project, 'id' | 'created_at' | 'updated_at'>) => {
      const result = await DatabaseService.createProject(project)
      if (result) {
        // Auto-refresh projects after creation if enabled
        if (options.autoRefresh) {
          await loadProjects()
        }
        return result
      }
      throw new Error('Failed to create project')
    },
    { onSuccess: options.onSuccess, onError: options.onError }
  )

  const updateProject = useAsyncOperation(
    async (projectId: string, updates: Partial<Omit<Project, 'id' | 'created_at' | 'updated_at'>>) => {
      const result = await DatabaseService.updateProject(projectId, updates)
      if (result) {
        // Auto-refresh projects after update if enabled
        if (options.autoRefresh) {
          await loadProjects()
        }
        return result
      }
      throw new Error('Failed to update project')
    },
    { onSuccess: options.onSuccess, onError: options.onError }
  )

  const deleteProject = useAsyncOperation(
    async (projectId: string) => {
      const success = await DatabaseService.deleteProject(projectId)
      if (success) {
        // Auto-refresh projects after deletion if enabled
        if (options.autoRefresh) {
          await loadProjects()
        }
        return success
      }
      throw new Error('Failed to delete project')
    },
    { onSuccess: options.onSuccess, onError: options.onError }
  )

  return {
    projects: state.data || [],
    loading: state.loading,
    error: state.error,
    success: state.success,
    loadProjects,
    createProject: createProject.execute,
    updateProject: updateProject.execute,
    deleteProject: deleteProject.execute,
    reset,
    createState: createProject.state,
    updateState: updateProject.state,
    deleteState: deleteProject.state
  }
}

/**
 * Hook for managing idea locking operations
 */
export function useIdeaLocking(options: UseDatabaseOptions = {}) {
  const lockIdea = useAsyncOperation(
    async (ideaId: string, userId: string) => {
      const success = await DatabaseService.lockIdeaForEditing(ideaId, userId)
      if (!success) {
        throw new Error('Failed to lock idea - it may already be locked by another user')
      }
      return success
    },
    { onSuccess: options.onSuccess, onError: options.onError }
  )

  const unlockIdea = useAsyncOperation(
    async (ideaId: string, userId: string) => {
      const success = await DatabaseService.unlockIdea(ideaId, userId)
      if (!success) {
        throw new Error('Failed to unlock idea')
      }
      return success
    },
    { onSuccess: options.onSuccess, onError: options.onError }
  )

  return {
    lockIdea: lockIdea.execute,
    unlockIdea: unlockIdea.execute,
    lockState: lockIdea.state,
    unlockState: unlockIdea.state
  }
}

/**
 * Hook for managing project collaborators
 */
export function useProjectCollaborators(projectId?: string, options: UseDatabaseOptions = {}) {
  const { state, execute, reset } = useAsyncOperation(
    async (id: string) => DatabaseService.getProjectCollaborators(id),
    {
      onSuccess: options.onSuccess,
      onError: options.onError,
      logErrors: true
    }
  )

  const loadCollaborators = useCallback(
    (id?: string) => {
      const targetId = id || projectId
      if (!targetId) {
        logger.warn('useProjectCollaborators: No project ID provided')
        return Promise.resolve(null)
      }
      return execute(targetId)
    },
    [execute, projectId]
  )

  const addCollaborator = useAsyncOperation(
    async (userEmail: string, role: string = 'viewer', invitedBy: string, projectName?: string, inviterName?: string, inviterEmail?: string) => {
      if (!projectId) {
        throw new Error('No project ID provided')
      }
      const success = await DatabaseService.addProjectCollaborator(projectId, userEmail, role, invitedBy, projectName, inviterName, inviterEmail)
      if (success) {
        // Auto-refresh collaborators after addition if enabled
        if (options.autoRefresh) {
          await loadCollaborators()
        }
        return success
      }
      throw new Error('Failed to add collaborator')
    },
    { onSuccess: options.onSuccess, onError: options.onError }
  )

  const removeCollaborator = useAsyncOperation(
    async (userId: string) => {
      if (!projectId) {
        throw new Error('No project ID provided')
      }
      const success = await DatabaseService.removeProjectCollaborator(projectId, userId)
      if (success) {
        // Auto-refresh collaborators after removal if enabled
        if (options.autoRefresh) {
          await loadCollaborators()
        }
        return success
      }
      throw new Error('Failed to remove collaborator')
    },
    { onSuccess: options.onSuccess, onError: options.onError }
  )

  return {
    collaborators: state.data || [],
    loading: state.loading,
    error: state.error,
    success: state.success,
    loadCollaborators,
    addCollaborator: addCollaborator.execute,
    removeCollaborator: removeCollaborator.execute,
    reset,
    addState: addCollaborator.state,
    removeState: removeCollaborator.state
  }
}