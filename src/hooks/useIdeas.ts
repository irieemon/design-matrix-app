import { useState, useEffect, useCallback } from 'react'
import { DragEndEvent } from '@dnd-kit/core'
import { IdeaCard, User, Project } from '../types'
import { DatabaseService } from '../lib/database'
import { useOptimisticUpdates } from './useOptimisticUpdates'
import { logger } from '../utils/logger'

interface UseIdeasReturn {
  ideas: IdeaCard[]
  setIdeas: React.Dispatch<React.SetStateAction<IdeaCard[]>>
  loadIdeas: (projectId?: string) => Promise<void>
  addIdea: (newIdea: Omit<IdeaCard, 'id' | 'created_at' | 'updated_at'>) => Promise<void>
  updateIdea: (updatedIdea: IdeaCard) => Promise<void>
  deleteIdea: (ideaId: string) => Promise<void>
  toggleCollapse: (ideaId: string, collapsed?: boolean) => Promise<void>
  handleDragEnd: (event: DragEndEvent) => Promise<void>
}

interface UseIdeasOptions {
  currentUser: User | null
  currentProject: Project | null
  setShowAddModal?: (show: boolean) => void
  setShowAIModal?: (show: boolean) => void
  setEditingIdea?: (idea: IdeaCard | null) => void
}

export const useIdeas = (options: UseIdeasOptions): UseIdeasReturn => {
  const [ideas, setIdeas] = useState<IdeaCard[]>([])
  const { currentUser, currentProject, setShowAddModal, setShowAIModal, setEditingIdea } = options
  
  // Premium optimistic updates for instant UI feedback
  const {
    optimisticData,
    createIdeaOptimistic,
    updateIdeaOptimistic,
    deleteIdeaOptimistic,
    moveIdeaOptimistic
  } = useOptimisticUpdates(ideas, setIdeas, {
    onSuccess: (id, result) => {
      logger.debug('✅ Optimistic update confirmed:', id, result)
    },
    onError: (id, error) => {
      logger.error('❌ Optimistic update failed, reverted:', id, error)
    },
    onRevert: (id, originalData) => {
      logger.debug('🔄 Optimistic update reverted:', id, originalData)
    }
  })
  

  const loadIdeas = useCallback(async (projectId?: string) => {
    if (projectId) {
      console.log('🔄 useIdeas: Loading ideas for project:', projectId)
      logger.debug('📂 Loading ideas for project:', projectId)
      // Clear ideas immediately to prevent flash of old ideas
      setIdeas([])
      const ideas = await DatabaseService.getProjectIdeas(projectId)
      console.log('📋 useIdeas: Raw ideas returned from database:', ideas)
      logger.debug('📋 Raw ideas returned from database:', ideas)
      setIdeas(ideas)
      console.log('✅ useIdeas: Set', ideas.length, 'ideas for project', projectId)
      logger.debug('✅ Loaded', ideas.length, 'ideas for project', projectId)
      logger.debug('📋 Ideas details:', (ideas || []).map(i => ({ id: i.id, content: i.content, project_id: i.project_id })))
    } else {
      // If no project is selected, show no ideas
      console.log('📂 useIdeas: No project selected, clearing ideas')
      logger.debug('📂 No project selected, clearing ideas')
      setIdeas([])
    }
  }, [])

  const addIdea = useCallback(async (newIdea: Omit<IdeaCard, 'id' | 'created_at' | 'updated_at'>) => {
    logger.debug('📥 Received new idea:', newIdea)
    
    const ideaWithUser = {
      ...newIdea,
      created_by: currentUser?.id || null,
      project_id: currentProject?.id
    }
    
    logger.debug('💾 Creating idea with optimistic update...', ideaWithUser)
    
    // Use optimistic update for instant UI feedback
    createIdeaOptimistic(
      ideaWithUser,
      async () => {
        const createdIdeaResponse = await DatabaseService.createIdea(ideaWithUser)
        if (createdIdeaResponse.success && createdIdeaResponse.data) {
          logger.debug('✅ Idea created successfully in database:', createdIdeaResponse.data)
          return createdIdeaResponse.data
        } else {
          logger.error('❌ Failed to create idea in database:', createdIdeaResponse.error)
          throw new Error(typeof createdIdeaResponse.error === 'string' ? createdIdeaResponse.error : 'Failed to create idea')
        }
      }
    )
    
    logger.debug('🔄 Closing modals...')
    setShowAddModal?.(false)
    setShowAIModal?.(false)
  }, [currentUser, currentProject, setShowAddModal, setShowAIModal, createIdeaOptimistic])

  const updateIdea = useCallback(async (updatedIdea: IdeaCard) => {
    logger.debug('📝 Updating idea with optimistic update:', updatedIdea)
    
    // Use optimistic update for instant UI feedback
    updateIdeaOptimistic(
      updatedIdea,
      async () => {
        const result = await DatabaseService.updateIdea(updatedIdea.id, {
          content: updatedIdea.content,
          details: updatedIdea.details,
          x: updatedIdea.x,
          y: updatedIdea.y,
          priority: updatedIdea.priority
        })
        if (result) {
          logger.debug('✅ Idea updated successfully in database:', result)
          return result
        } else {
          throw new Error('Failed to update idea')
        }
      }
    )
    
    setEditingIdea?.(null)
  }, [setEditingIdea, updateIdeaOptimistic])

  const deleteIdea = useCallback(async (ideaId: string) => {
    logger.debug('🗑️ Deleting idea with optimistic update:', ideaId)
    
    // Use optimistic update for instant UI feedback
    deleteIdeaOptimistic(
      ideaId,
      async () => {
        const success = await DatabaseService.deleteIdea(ideaId)
        if (success) {
          logger.debug('✅ Idea deleted successfully from database:', ideaId)
          return success
        } else {
          throw new Error('Failed to delete idea')
        }
      }
    )
    
    setEditingIdea?.(null)
  }, [setEditingIdea, deleteIdeaOptimistic])

  const toggleCollapse = useCallback(async (ideaId: string, collapsed?: boolean) => {
    const idea = (ideas || []).find(i => i.id === ideaId)
    if (!idea) return

    // Use provided collapsed state or toggle current state
    const newCollapsedState = collapsed !== undefined ? collapsed : !idea.is_collapsed

    // Immediately update local state for instant feedback
    setIdeas(prev => prev.map(i => 
      i.id === ideaId ? { ...i, is_collapsed: newCollapsedState } : i
    ))

    // Update in database
    await DatabaseService.updateIdea(ideaId, {
      is_collapsed: newCollapsedState
    })
  }, [ideas])

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, delta } = event

    if (!delta || (delta.x === 0 && delta.y === 0)) return

    const ideaId = active.id as string
    const idea = optimisticData.find(i => i.id === ideaId)
    if (!idea) return

    // New position after drag
    const newX = idea.x + delta.x
    const newY = idea.y + delta.y
    
    // Round to integers and add reasonable bounds (allow some overflow but not too much)
    // Matrix is full width (~1200px on most screens) and 600px height
    const finalX = Math.max(-100, Math.min(1400, Math.round(newX))) // Allow wider range for X
    const finalY = Math.max(-50, Math.min(650, Math.round(newY)))   // Match matrix height (600px + padding)

    logger.debug('🚚 Moving idea with optimistic update:', ideaId, { x: finalX, y: finalY })
    
    // Use optimistic update for instant drag feedback
    moveIdeaOptimistic(
      ideaId,
      { x: finalX, y: finalY },
      async () => {
        const result = await DatabaseService.updateIdea(ideaId, {
          x: finalX,
          y: finalY
        })
        if (result) {
          logger.debug('✅ Idea position updated successfully in database:', result)
          return result
        } else {
          throw new Error('Failed to update idea position')
        }
      }
    )
  }, [optimisticData, moveIdeaOptimistic])

  // Load ideas when current project changes
  useEffect(() => {
    console.log('🔄 useIdeas: Project changed effect triggered. Current project:', currentProject?.name, currentProject?.id)
    console.log('🔄 useIdeas: Current user:', currentUser?.email, currentUser?.id)
    logger.debug('🔄 Project changed effect triggered. Current project:', currentProject?.name, currentProject?.id)
    
    // Check if this is a demo user
    const isDemoUser = currentUser?.id?.startsWith('00000000-0000-0000-0000-00000000000')
    console.log('🎭 useIdeas: Is demo user:', isDemoUser)
    
    if (currentProject) {
      if (isDemoUser) {
        console.log('📂 useIdeas: Demo user: loading ideas for:', currentProject.name, currentProject.id)
        logger.debug('📂 Demo user: loading ideas for:', currentProject.name, currentProject.id)
        loadIdeas(currentProject.id)
      } else {
        console.log('📂 useIdeas: Real user: loading ideas initially for:', currentProject.name, currentProject.id)
        logger.debug('📂 Real user: loading ideas initially for:', currentProject.name, currentProject.id)
        // Load ideas immediately for real users too, subscription will handle updates
        loadIdeas(currentProject.id)
      }
    } else {
      // Always clear ideas when no project is selected
      logger.debug('📂 No project selected, clearing ideas')
      setIdeas([])
    }
  }, [currentProject, currentUser, loadIdeas])

  // Set up project-specific real-time subscription
  useEffect(() => {
    if (!currentUser) return

    // Skip subscriptions for demo users
    const isDemoUser = currentUser.id?.startsWith('00000000-0000-0000-0000-00000000000')
    if (isDemoUser) {
      logger.debug('🎭 Demo user detected, skipping real-time subscription')
      return
    }

    logger.debug('🔄 Setting up project-specific subscription for:', currentProject?.id || 'all projects')
    const unsubscribe = DatabaseService.subscribeToIdeas(
      setIdeas,
      currentProject?.id,
      currentUser.id,
      { skipInitialLoad: true } // Skip initial load since ideas are loaded by project change effect
    )
    
    return () => {
      logger.debug('🔄 Cleaning up subscription')
      unsubscribe()
    }
  }, [currentUser, currentProject?.id])


  return {
    ideas: optimisticData, // Use optimistic data for instant UI updates
    setIdeas,
    loadIdeas,
    addIdea,
    updateIdea,
    deleteIdea,
    toggleCollapse,
    handleDragEnd
  }
}