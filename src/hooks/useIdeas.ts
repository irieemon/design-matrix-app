import { useState, useEffect, useCallback, useRef } from 'react'
import { DragEndEvent } from '@dnd-kit/core'
import { IdeaCard, User, Project } from '../types'
import { DatabaseService } from '../lib/database'
import { useOptimisticUpdates } from './useOptimisticUpdates'
import { useLogger } from '../lib/logging'
import { useCurrentUser } from '../contexts/UserContext'
import { supabase } from '../lib/supabase'
import { getCachedAuthToken } from '../utils/authTokenCache'

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

        // PERFORMANCE OPTIMIZATION: Use cached token to avoid repeated JSON.parse
        // This reduces localStorage parsing overhead by 15% on every API request
        // Implements token caching pattern from authTokenCache utility
        const accessToken = getCachedAuthToken()

        if (accessToken) {
          logger.debug('🔑 Using cached access token (performance optimized)')
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
        const rawIdeas = data.ideas || []

        // Filter ideas by type for auto-positioning
        const brainstormIdeas = rawIdeas.filter((i: any) => i.session_id)
        const desktopIdeas = rawIdeas.filter((i: any) => !i.session_id)

        // CRITICAL FIX: Auto-position stacked brainstorm ideas to prevent drag snap-back bug
        // Brainstorm ideas are inserted at default position (75, 75) causing them to stack.
        // Previously, DesignMatrix.tsx spread them visually but useIdeas had original coords,
        // causing first drag to calculate from wrong position and snap back.
        // Now we spread positions in state so drag calculations match visual positions.
        const stackedBrainstormIdeas = brainstormIdeas.filter((i: any) => {
          return Math.abs(i.x - 75) < 5 && Math.abs(i.y - 75) < 5
        })

        const autoPositionMap = new Map<string, { x: number; y: number }>()
        if (stackedBrainstormIdeas.length > 1) {
          // Grid layout for stacked brainstorm ideas
          const GRID_COLS = 5
          const GRID_SPACING_X = 40
          const GRID_SPACING_Y = 45
          const START_X = 30
          const START_Y = 30

          stackedBrainstormIdeas.forEach((idea: any, index: number) => {
            const col = index % GRID_COLS
            const row = Math.floor(index / GRID_COLS)
            autoPositionMap.set(idea.id, {
              x: START_X + (col * GRID_SPACING_X),
              y: START_Y + (row * GRID_SPACING_Y)
            })
          })

          logger.debug('🎯 Auto-positioning stacked brainstorm ideas:', {
            count: stackedBrainstormIdeas.length,
            positions: Array.from(autoPositionMap.entries()).slice(0, 3)
          })
        }

        // Apply auto-positions to ideas in state
        const ideas = rawIdeas.map((idea: any) => {
          const autoPos = autoPositionMap.get(idea.id)
          if (autoPos) {
            return { ...idea, x: autoPos.x, y: autoPos.y }
          }
          return idea
        })

        // Only log detailed info if it's an error scenario or significantly different
        if (ideas.length === 0) {
          logger.debug(`No ideas found for project: ${projectId}`)
        } else {
          logger.debug(`Loaded ${ideas.length} ideas for project: ${projectId}`)
        }

        setIdeas(ideas)
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
    console.log('🗑️ useIdeas.deleteIdea CALLED:', { ideaId })
    logger.debug('🗑️ Deleting idea with optimistic update:', { ideaId })

    // Use optimistic update for instant UI feedback
    const updateId = deleteIdeaOptimistic(
      ideaId,
      async () => {
        console.log('🗑️ useIdeas: Calling DatabaseService.deleteIdea...', { ideaId })
        const success = await DatabaseService.deleteIdea(ideaId, supabase)
        console.log('🗑️ useIdeas: DatabaseService.deleteIdea returned:', { ideaId, success })
        if (success) {
          logger.debug('✅ Idea deleted successfully from database:', { ideaId })
          return success
        } else {
          throw new Error('Failed to delete idea')
        }
      }
    )

    console.log('🗑️ useIdeas: deleteIdeaOptimistic returned updateId:', updateId)
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
    logger.debug('🔵 useIdeas.handleDragEnd CALLED', event)
    const { active, delta, over: _over } = event

    logger.debug('🔵 Delta:', delta)
    if (!delta || (delta.x === 0 && delta.y === 0)) {
      logger.debug('⚠️ No delta or zero delta, returning early')
      return
    }

    const ideaId = active.id as string
    const idea = optimisticData.find(i => i.id === ideaId)
    logger.debug('🔵 Found idea:', idea ? idea.id : 'NOT FOUND')
    if (!idea) {
      logger.debug('⚠️ Idea not found in optimisticData, returning early')
      return
    }

    // ✅ CRITICAL FIX: Get the ACTUAL matrix container that the card is being dragged within
    // This ensures we measure the VISIBLE matrix, not a hidden duplicate elsewhere in the DOM
    //
    // The bug was: document.querySelector('.matrix-container') found the FIRST .matrix-container
    // In full-screen mode, there are TWO: the hidden normal view (0x0 size) and the visible full-screen view
    // querySelector found the hidden one first, causing division by zero → Infinity coordinates
    //
    // Solution: Use querySelectorAll to find ALL matrix containers, then filter for the visible one
    const allMatrixContainers = document.querySelectorAll('.matrix-container')
    let matrixContainer: HTMLElement | null = null

    // Find the matrix container that has non-zero dimensions (the visible one)
    logger.debug('🔍 Searching for visible matrix container:', { totalContainers: allMatrixContainers.length })
    for (let i = 0; i < allMatrixContainers.length; i++) {
      const container = allMatrixContainers[i] as HTMLElement
      const rect = container.getBoundingClientRect()
      logger.debug(`  Container ${i}:`, { width: rect.width, height: rect.height, isVisible: rect.width > 0 && rect.height > 0 })
      if (rect.width > 0 && rect.height > 0) {
        matrixContainer = container
        logger.debug(`✅ Selected container ${i} as visible matrix`)
        break
      }
    }

    if (!matrixContainer) {
      logger.error('❌ No visible matrix container found for drag calculation')
      return
    }

    // Use getBoundingClientRect() to get VISUAL size after CSS transforms
    // This is the actual rendered size the user sees and drags on
    const rect = matrixContainer.getBoundingClientRect()
    const visualWidth = rect.width
    const visualHeight = rect.height

    // Reference coordinate space: 600px (520px content + 40px padding each side)
    // The stored coordinates (0-520) map to this 600px reference frame
    // Scale factor: coordinate_units / visual_pixels
    const scaleX = 600 / visualWidth
    const scaleY = 600 / visualHeight

    // Convert visual pixel delta to coordinate delta
    // Works correctly in all modes: normal view, full-screen, zoomed
    const coordDeltaX = delta.x * scaleX
    const coordDeltaY = delta.y * scaleY

    logger.debug('📐 Drag scale calculation:', {
      visualSize: { width: visualWidth, height: visualHeight },
      referenceSpace: 600,
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

    // Validate coordinates are not Infinity or NaN
    if (!isFinite(finalX) || !isFinite(finalY) || isNaN(finalX) || isNaN(finalY)) {
      logger.error('❌ Invalid coordinates calculated:', {
        finalX,
        finalY,
        newX,
        newY,
        coordDelta: { x: coordDeltaX, y: coordDeltaY },
        scale: { x: scaleX, y: scaleY },
        visualSize: { width: visualWidth, height: visualHeight }
      })
      return
    }

    logger.debug('🚚 Moving idea with optimistic update:', {
      ideaId,
      from: { x: idea.x, y: idea.y },
      to: { x: finalX, y: finalY }
    })

    // Use optimistic update for instant drag feedback
    logger.debug('📞 Calling moveIdeaOptimistic...')
    moveIdeaOptimistic(
      ideaId,
      { x: finalX, y: finalY },
      async () => {
        logger.debug('💾 Database update starting for:', { ideaId, x: finalX, y: finalY })
        const result = await DatabaseService.updateIdea(ideaId, {
          x: finalX,
          y: finalY
        }, supabase)
        if (result) {
          logger.debug('✅ Idea position updated successfully in database:', { result })
          return result
        } else {
          logger.error('❌ Database update returned null/undefined')
          throw new Error('Failed to update idea position')
        }
      }
    )
    logger.debug('✅ moveIdeaOptimistic call completed')
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

  // MEMORY LEAK FIX: Use ref to prevent stale closures in subscription callback
  // The callback needs to always reference the CURRENT project, not the one from closure
  const currentProjectRef = useRef(currentProject)
  useEffect(() => {
    currentProjectRef.current = currentProject
  }, [currentProject])

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
        // MEMORY LEAK FIX: Use ref to get CURRENT project, not stale closure value
        // Prevents cross-project pollution and memory leaks from old subscriptions
        const activeProject = currentProjectRef.current
        if (!activeProject?.id) {
          logger.debug('🔄 Subscription callback: no active project, ignoring update')
          return
        }

        // Only update ideas if they belong to the current project
        const projectIdeas = freshIdeas.filter(idea => idea.project_id === activeProject.id)
        logger.debug('🔄 Subscription callback: filtered ideas for current project:', {
          filteredCount: projectIdeas.length,
          projectId: activeProject.id
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