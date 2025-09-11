import { useState, useEffect, useCallback } from 'react'
import { DragEndEvent } from '@dnd-kit/core'
import { IdeaCard, User, Project } from '../types'
import { DatabaseService } from '../lib/database'
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

  const loadIdeas = useCallback(async (projectId?: string) => {
    if (projectId) {
      logger.debug('📂 Loading ideas for project:', projectId)
      const ideas = await DatabaseService.getProjectIdeas(projectId)
      logger.debug('📋 Raw ideas returned from database:', ideas)
      setIdeas(ideas)
      logger.debug('✅ Loaded', ideas.length, 'ideas for project', projectId)
      logger.debug('📋 Ideas details:', ideas.map(i => ({ id: i.id, content: i.content, project_id: i.project_id })))
    } else {
      // If no project is selected, show no ideas
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
    
    logger.debug('💾 Creating idea in database...', ideaWithUser)
    
    const createdIdeaResponse = await DatabaseService.createIdea(ideaWithUser)
    
    if (createdIdeaResponse.success && createdIdeaResponse.data) {
      logger.debug('✅ Idea created successfully, adding to state:', createdIdeaResponse.data)
      // Immediately add to local state for instant feedback
      setIdeas(prev => [...prev, createdIdeaResponse.data!])
    } else {
      logger.error('❌ Failed to create idea in database:', createdIdeaResponse.error)
    }
    
    logger.debug('🔄 Closing modals...')
    setShowAddModal?.(false)
    setShowAIModal?.(false)
  }, [currentUser, currentProject, setShowAddModal, setShowAIModal])

  const updateIdea = useCallback(async (updatedIdea: IdeaCard) => {
    const result = await DatabaseService.updateIdea(updatedIdea.id, {
      content: updatedIdea.content,
      details: updatedIdea.details,
      x: updatedIdea.x,
      y: updatedIdea.y,
      priority: updatedIdea.priority
    })
    if (result) {
      // Immediately update local state for instant feedback
      setIdeas(prev => prev.map(i => 
        i.id === updatedIdea.id ? result : i
      ))
    }
    setEditingIdea?.(null)
  }, [setEditingIdea])

  const deleteIdea = useCallback(async (ideaId: string) => {
    const success = await DatabaseService.deleteIdea(ideaId)
    if (success) {
      // Immediately remove from local state for instant feedback
      setIdeas(prev => prev.filter(i => i.id !== ideaId))
    }
    setEditingIdea?.(null)
  }, [setEditingIdea])

  const toggleCollapse = useCallback(async (ideaId: string, collapsed?: boolean) => {
    const idea = ideas.find(i => i.id === ideaId)
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
    const idea = ideas.find(i => i.id === ideaId)
    if (!idea) return

    // New position after drag
    const newX = idea.x + delta.x
    const newY = idea.y + delta.y
    
    // Round to integers and add reasonable bounds (allow some overflow but not too much)
    // Matrix is full width (~1200px on most screens) and 600px height
    const finalX = Math.max(-100, Math.min(1400, Math.round(newX))) // Allow wider range for X
    const finalY = Math.max(-50, Math.min(650, Math.round(newY)))   // Match matrix height (600px + padding)

    // Immediately update local state for instant feedback
    setIdeas(prev => prev.map(i => 
      i.id === ideaId ? { ...i, x: finalX, y: finalY, updated_at: new Date().toISOString() } : i
    ))

    // Update position in database (in background)
    await DatabaseService.updateIdea(ideaId, {
      x: finalX,
      y: finalY
    })
  }, [ideas])

  // Load ideas when current project changes
  useEffect(() => {
    logger.debug('🔄 Project changed effect triggered. Current project:', currentProject?.name, currentProject?.id)
    if (currentProject) {
      logger.debug('📂 Project selected, loading ideas for:', currentProject.name, currentProject.id)
      loadIdeas(currentProject.id)
    } else {
      // Clear ideas when no project is selected
      logger.debug('📂 No project selected, clearing ideas')
      loadIdeas()
    }
  }, [currentProject, loadIdeas])

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
    const unsubscribe = DatabaseService.subscribeToIdeas(setIdeas, currentProject?.id)
    
    return () => {
      logger.debug('🔄 Cleaning up subscription')
      unsubscribe()
    }
  }, [currentUser, currentProject?.id])

  return {
    ideas,
    setIdeas,
    loadIdeas,
    addIdea,
    updateIdea,
    deleteIdea,
    toggleCollapse,
    handleDragEnd
  }
}