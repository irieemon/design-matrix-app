import { useState, useEffect, useCallback, useRef } from 'react'
import { DragEndEvent } from '@dnd-kit/core'
import { IdeaCard, User, Project } from '../types'
import { DatabaseService } from '../lib/database'
import { useOptimisticUpdates } from './useOptimisticUpdates'
import { useLogger } from '../lib/logging'
import { useCurrentUser } from '../contexts/UserContext'
import { supabase } from '../lib/supabase'
import { SUPABASE_STORAGE_KEY } from '../lib/config'

interface UseIdeasReturn {
  ideas: IdeaCard[]
  setIdeas: React.Dispatch<React.SetStateAction<IdeaCard[]>>
  loadIdeas: (projectId?: string, skipClear?: boolean) => Promise<void>
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
  const logger = useLogger('useIdeas')
  const skipNextLoad = useRef(false)

  // Use centralized user context as primary source, fallback to options for backwards compatibility
  const contextUser = useCurrentUser()
  const currentUser = contextUser || options.currentUser

  const { currentProject, setShowAddModal, setShowAIModal, setEditingIdea } = options

  // Premium optimistic updates for instant UI feedback
  const {
    optimisticData,
    createIdeaOptimistic,
    updateIdeaOptimistic,
    deleteIdeaOptimistic,
    moveIdeaOptimistic
  } = useOptimisticUpdates(ideas, setIdeas, {
    onSuccess: (id, result) => {
      logger.debug('✅ Optimistic update confirmed:', { id, result })
    },
    onError: (id, error) => {
      logger.error('❌ Optimistic update failed, reverted:', error, { id })
    },
    onRevert: (id, originalData) => {
      logger.debug('🔄 Optimistic update reverted:', { id, originalData })
    }
  })
  

  const loadIdeas = useCallback(async (projectId?: string, skipClear = false) => {
    if (projectId) {
      try {
        // Use debug logger for simple messages (performance expects PerformanceMetric object)
        logger.debug(`Loading ideas for project: ${projectId}`)

        // Clear ideas immediately to prevent flash of old ideas
        // Skip clear when ideas are being set externally (e.g., from AI Starter)
        if (!skipClear) {
          setIdeas([])
        }

        logger.debug('🔍 DIAGNOSTIC: Fetching ideas via API endpoint')

        // CRITICAL FIX: Read token from localStorage directly to avoid getSession() timeout
        // The standard supabase.auth.getSession() hangs on page refresh (same issue as useAuth.ts)
        // This is the SAME pattern used in ProjectContext.tsx (commit caab7bc)

        const stored = localStorage.getItem(SUPABASE_STORAGE_KEY)
        let accessToken: string | null = null

        if (stored) {
          try {
            const parsed = JSON.parse(stored)
            accessToken = parsed.access_token
            logger.debug('🔑 Using access token from localStorage (bypassing getSession)')
          } catch (error) {
            logger.error('Error parsing localStorage session:', error)
          }
        }

        const headers: HeadersInit = {}
        if (accessToken) {
          headers['Authorization'] = `Bearer ${accessToken}`
          logger.debug('🔑 Including Authorization header for ideas API')
        } else {
          logger.warn('⚠️ No access token found in localStorage - ideas may not load')
        }

        const response = await fetch(`/api/ideas?projectId=${projectId}`, {
          credentials: 'include', // Send httpOnly cookies if available
          headers
        })
        logger.debug(`🔍 DIAGNOSTIC: API response status: ${response.status}`)

        if (!response.ok) {
          throw new Error(`API returned ${response.status}`)
        }

        const data = await response.json()
        logger.debug(`🔍 DIAGNOSTIC: API returned ${data.ideas ? data.ideas.length : 0} ideas`)
        const ideas = data.ideas || []

        // Only log detailed info if it's an error scenario or significantly different
        if (ideas.length === 0) {
          logger.debug(`No ideas found for project: ${projectId}`)
        } else {
          logger.debug(`Loaded ${ideas.length} ideas for project: ${projectId}`)
        }

        logger.debug('🔍 DIAGNOSTIC: About to call setIdeas')
        setIdeas(ideas)
        logger.debug('🔍 DIAGNOSTIC: setIdeas completed')
      } catch (error) {
        logger.error('🚨 ERROR in loadIdeas:', error)
        setIdeas([])
      }
    } else {
      // If no project is selected, show no ideas
      logger.debug('No project selected, clearing ideas')
      setIdeas([])
    }
  }, [])

  const addIdea = useCallback(async (newIdea: Omit<IdeaCard, 'id' | 'created_at' | 'updated_at'>) => {
    logger.info('Adding new idea:', { content: newIdea.content || 'Untitled' })
    
    const ideaWithUser = {
      ...newIdea,
      created_by: currentUser?.id || null,
      project_id: currentProject?.id
    }
    
    logger.debug('💾 Creating idea with optimistic update...', { ideaWithUser })
    
    // Use optimistic update for instant UI feedback
    createIdeaOptimistic(
      ideaWithUser,
      async () => {
        const createdIdeaResponse = await DatabaseService.createIdea(ideaWithUser, supabase)
        if (createdIdeaResponse.success && createdIdeaResponse.data) {
          logger.debug('✅ Idea created successfully in database:', { data: createdIdeaResponse.data })
          return createdIdeaResponse.data
        } else {
          logger.error('❌ Failed to create idea in database:', createdIdeaResponse.error, { response: createdIdeaResponse })
          throw new Error(typeof createdIdeaResponse.error === 'string' ? createdIdeaResponse.error : 'Failed to create idea')
        }
      }
    )
    
    logger.debug('🔄 Closing modals...')
    setShowAddModal?.(false)
    setShowAIModal?.(false)
  }, [currentUser, currentProject, setShowAddModal, setShowAIModal, createIdeaOptimistic])

  const updateIdea = useCallback(async (updatedIdea: IdeaCard) => {
    logger.debug('📝 Updating idea with optimistic update:', { updatedIdea })
    
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
        }, supabase)
        if (result) {
          logger.debug('✅ Idea updated successfully in database:', { result })
          return result
        } else {
          throw new Error('Failed to update idea')
        }
      }
    )
    
    setEditingIdea?.(null)
  }, [setEditingIdea, updateIdeaOptimistic])

  const deleteIdea = useCallback(async (ideaId: string) => {
    logger.debug('🗑️ Deleting idea with optimistic update:', { ideaId })
    
    // Use optimistic update for instant UI feedback
    deleteIdeaOptimistic(
      ideaId,
      async () => {
        const success = await DatabaseService.deleteIdea(ideaId, supabase)
        if (success) {
          logger.debug('✅ Idea deleted successfully from database:', { ideaId })
          return success
        } else {
          throw new Error('Failed to delete idea')
        }
      }
    )
    
    setEditingIdea?.(null)
  }, [setEditingIdea, deleteIdeaOptimistic])

  const toggleCollapse = useCallback(async (ideaId: string, collapsed?: boolean) => {
    // ✅ FIX: Use functional update to get FRESH state (not stale closure)
    let newCollapsedState: boolean | undefined

    setIdeas(prev => {
      const idea = prev.find(i => i.id === ideaId)
      if (!idea) return prev

      // Determine new collapsed state
      newCollapsedState = collapsed !== undefined ? collapsed : !idea.is_collapsed

      // Update state - preserves ALL fields including fresh x, y coordinates
      return prev.map(i =>
        i.id === ideaId ? { ...i, is_collapsed: newCollapsedState } : i
      )
    })

    // Only update database if we found the idea and determined new state
    if (newCollapsedState !== undefined) {
      await DatabaseService.updateIdea(ideaId, {
        is_collapsed: newCollapsedState
      }, supabase)
    }
  }, []) // ✅ Empty dependencies - pure functional updates

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, delta } = event

    if (!delta || (delta.x === 0 && delta.y === 0)) return

    const ideaId = active.id as string
    const idea = optimisticData.find(i => i.id === ideaId)
    if (!idea) return

    // DRAG FIX: Convert screen pixel delta to coordinate space delta
    // The matrix container uses responsive sizing but coordinates are stored in 0-520 range
    // We need to scale the pixel delta based on actual container size
    const matrixContainer = document.querySelector('.matrix-container') as HTMLElement
    if (!matrixContainer) {
      logger.error('❌ Matrix container not found for drag calculation')
      return
    }

    const containerWidth = matrixContainer.offsetWidth
    const containerHeight = matrixContainer.offsetHeight

    // Reference size: 600px (520px content + 40px padding each side)
    // Scale factor: How many coordinate units per screen pixel
    // Formula: (600 / containerWidth) gives us the coordinate units per pixel
    const scaleX = 600 / containerWidth
    const scaleY = 600 / containerHeight

    // Convert pixel delta to coordinate delta
    const coordDeltaX = delta.x * scaleX
    const coordDeltaY = delta.y * scaleY

    logger.debug('📐 Drag scale calculation:', {
      containerSize: { width: containerWidth, height: containerHeight },
      pixelDelta: { x: delta.x, y: delta.y },
      scaleFactor: { x: scaleX, y: scaleY },
      coordDelta: { x: coordDeltaX, y: coordDeltaY }
    })

    // Apply scaled delta to coordinates
    const newX = idea.x + coordDeltaX
    const newY = idea.y + coordDeltaY

    // Bounds check in coordinate space (0-520 range with some overflow allowed)
    const finalX = Math.max(-20, Math.min(540, Math.round(newX)))
    const finalY = Math.max(-20, Math.min(540, Math.round(newY)))

    logger.debug('🚚 Moving idea with optimistic update:', {
      ideaId,
      from: { x: idea.x, y: idea.y },
      to: { x: finalX, y: finalY }
    })

    // Use optimistic update for instant drag feedback
    moveIdeaOptimistic(
      ideaId,
      { x: finalX, y: finalY },
      async () => {
        const result = await DatabaseService.updateIdea(ideaId, {
          x: finalX,
          y: finalY
        }, supabase)
        if (result) {
          logger.debug('✅ Idea position updated successfully in database:', { result })
          return result
        } else {
          throw new Error('Failed to update idea position')
        }
      }
    )
  }, [optimisticData, moveIdeaOptimistic])

  // Extract project ID as primitive to prevent object reference issues
  const projectId = currentProject?.id

  // Load ideas when project ID changes
  useEffect(() => {
    logger.debug('Project changed effect triggered', {
      projectName: currentProject?.name,
      projectId: projectId,
      skipNextLoad: skipNextLoad.current
    })

    if (projectId) {
      // Check if skipNextLoad flag is set (ideas were just set externally)
      if (skipNextLoad.current) {
        logger.debug('✨ Skipping load - ideas were set externally:', {
          projectName: currentProject?.name,
          projectId: projectId
        })
        skipNextLoad.current = false
        return
      }

      logger.debug('Loading ideas for project', {
        projectName: currentProject?.name,
        projectId: projectId
      })
      loadIdeas(projectId)
    } else {
      // Always clear ideas when no project is selected
      logger.debug('No project selected, clearing ideas')
      setIdeas([])
      skipNextLoad.current = false
    }
  }, [projectId, loadIdeas])

  // Set up project-specific real-time subscription
  useEffect(() => {
    if (!currentUser) return

    // Skip subscriptions for demo users
    const isDemoUser = currentUser.id?.startsWith('00000000-0000-0000-0000-00000000000')
    if (isDemoUser) {
      logger.debug('🎭 Demo user detected, skipping real-time subscription')
      return
    }

    // Only subscribe if we have a project to avoid unnecessary subscriptions
    if (!currentProject?.id) {
      logger.debug('🔄 No project selected, skipping subscription setup')
      return
    }

    logger.debug('🔄 Setting up project-specific subscription for:', { projectId: currentProject.id })
    const unsubscribe = DatabaseService.subscribeToIdeas(
      (freshIdeas) => {
        // Only update ideas if they belong to the current project to prevent cross-project pollution
        const projectIdeas = freshIdeas.filter(idea => idea.project_id === currentProject.id)
        logger.debug('🔄 Subscription callback: filtered ideas for current project:', {
          filteredCount: projectIdeas.length,
          projectId: currentProject.id
        })
        setIdeas(projectIdeas)
      },
      currentProject.id,
      currentUser.id,
      { skipInitialLoad: true }, // Skip initial load since ideas are loaded by project change effect
      supabase
    )

    return () => {
      logger.debug('🔄 Cleaning up subscription for project:', { projectId: currentProject.id })
      unsubscribe()
    }
  }, [currentUser, currentProject?.id])


  // Wrapper for setIdeas that sets the skip flag
  const setIdeasExternal = useCallback((ideas: IdeaCard[] | ((prev: IdeaCard[]) => IdeaCard[])) => {
    skipNextLoad.current = true
    setIdeas(ideas)
  }, [])

  return {
    ideas: optimisticData, // Use optimistic data for instant UI updates
    setIdeas: setIdeasExternal,
    loadIdeas,
    addIdea,
    updateIdea,
    deleteIdea,
    toggleCollapse,
    handleDragEnd
  }
}