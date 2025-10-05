/**
 * Optimized Matrix Hook
 *
 * Clean state management with no infinite loops, optimized updates,
 * and proper drag & drop handling.
 */

import { useState, useCallback, useEffect } from 'react'
import type { DragEndEvent } from '@dnd-kit/core'
import type { IdeaCard, User, Project } from '../types'
import { DatabaseService } from '../lib/database'
import {
  applyPixelDelta,
  legacyToNormalized,
  normalizedToPixel,
  DEFAULT_MATRIX_DIMENSIONS,
  type NormalizedPosition
} from '../lib/matrix/coordinates'
import { useBatchedUpdates, performanceMonitor } from '../lib/matrix/performance'
import { logger } from '../utils/logger'

interface UseOptimizedMatrixOptions {
  currentUser: User | null
  currentProject: Project | null
  setShowAddModal?: (show: boolean) => void
  setShowAIModal?: (show: boolean) => void
  setEditingIdea?: (idea: IdeaCard | null) => void
}

interface UseOptimizedMatrixReturn {
  ideas: IdeaCard[]
  isLoading: boolean
  error: string | null
  // Actions
  loadIdeas: (projectId?: string) => Promise<void>
  addIdea: (newIdea: Omit<IdeaCard, 'id' | 'created_at' | 'updated_at'>) => Promise<void>
  updateIdea: (updatedIdea: IdeaCard) => Promise<void>
  deleteIdea: (ideaId: string) => Promise<void>
  toggleCollapse: (ideaId: string, collapsed?: boolean) => Promise<void>
  handleDragEnd: (event: DragEndEvent) => Promise<void>
  // State
  refreshIdeas: () => Promise<void>
  clearError: () => void
}

export const useOptimizedMatrix = (options: UseOptimizedMatrixOptions): UseOptimizedMatrixReturn => {
  const { currentUser, currentProject, setShowAddModal, setShowAIModal, setEditingIdea } = options

  // Core state
  const [ideas, setIdeas] = useState<IdeaCard[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Batched position updates for performance
  const { addUpdate: addPositionUpdate, flush: flushPositionUpdates } = useBatchedUpdates<{
    ideaId: string
    position: NormalizedPosition
  }>(
    async (updates) => {
      // Batch multiple position updates into a single database operation
      if (updates.length === 0) return

      const endMeasurement = performanceMonitor.startMeasurement('batch-position-update')

      try {
        for (const update of updates) {
          const pixelPosition = normalizedToPixel(update.position)
          await DatabaseService.updateIdea(update.ideaId, {
            x: Math.round(pixelPosition.x),
            y: Math.round(pixelPosition.y),
            matrix_position: update.position
          })
        }
        logger.debug('✅ Batch position update completed:', updates.length, 'ideas')
      } catch (error) {
        logger.error('❌ Batch position update failed:', error)
        setError('Failed to update idea positions')
      } finally {
        endMeasurement()
      }
    },
    100 // 100ms batch delay for smooth dragging
  )

  // Clear error handler
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  // Load ideas with optimized loading state
  const loadIdeas = useCallback(async (projectId?: string) => {
    if (!projectId) {
      setIdeas([])
      return
    }

    const endMeasurement = performanceMonitor.startMeasurement('load-ideas')
    setIsLoading(true)
    setError(null)

    try {
      logger.debug('🔄 Loading ideas for project:', projectId)

      // Check for demo data first
      const demoIdeas = (globalThis as any).demoIdeas
      if (demoIdeas && Array.isArray(demoIdeas) && projectId.startsWith('demo-project-')) {
        const projectDemoIdeas = demoIdeas.filter((idea: any) => idea.project_id === projectId)
        setIdeas(projectDemoIdeas)
        logger.debug('✅ Loaded demo ideas:', projectDemoIdeas.length)
        return
      }

      // Load from database
      const loadedIdeas = await DatabaseService.getProjectIdeas(projectId)
      setIdeas(loadedIdeas || [])
      logger.debug('✅ Loaded ideas from database:', loadedIdeas?.length || 0)

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load ideas'
      logger.error('❌ Failed to load ideas:', errorMessage)
      setError(errorMessage)
      setIdeas([])
    } finally {
      setIsLoading(false)
      endMeasurement()
    }
  }, [])

  // Refresh ideas - force reload
  const refreshIdeas = useCallback(async () => {
    if (currentProject?.id) {
      await loadIdeas(currentProject.id)
    }
  }, [currentProject?.id, loadIdeas])

  // Add idea with optimistic updates
  const addIdea = useCallback(async (newIdea: Omit<IdeaCard, 'id' | 'created_at' | 'updated_at'>) => {
    const endMeasurement = performanceMonitor.startMeasurement('add-idea')
    setError(null)

    try {
      const ideaWithUser = {
        ...newIdea,
        created_by: currentUser?.id || null,
        project_id: currentProject?.id
      }

      logger.debug('📥 Creating new idea:', ideaWithUser.content)

      // Optimistic update - add to local state immediately
      const tempId = `temp-${Date.now()}-${Math.random()}`
      const optimisticIdea: IdeaCard = {
        ...ideaWithUser,
        id: tempId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      setIdeas(prev => [...prev, optimisticIdea])

      // Create in database
      const result = await DatabaseService.createIdea(ideaWithUser)

      if (result.success && result.data) {
        // Replace optimistic update with real data
        setIdeas(prev => prev.map(idea =>
          idea.id === tempId ? result.data! : idea
        ))
        logger.debug('✅ Idea created successfully:', result.data.id)
      } else {
        // Remove optimistic update on failure
        setIdeas(prev => prev.filter(idea => idea.id !== tempId))
        const errorMessage = typeof result.error === 'string' ? result.error : result.error?.message || 'Failed to create idea'
        throw new Error(errorMessage)
      }

      // Close modals
      setShowAddModal?.(false)
      setShowAIModal?.(false)

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add idea'
      logger.error('❌ Failed to add idea:', errorMessage)
      setError(errorMessage)
    } finally {
      endMeasurement()
    }
  }, [currentUser, currentProject, setShowAddModal, setShowAIModal])

  // Update idea with optimistic updates
  const updateIdea = useCallback(async (updatedIdea: IdeaCard) => {
    const endMeasurement = performanceMonitor.startMeasurement('update-idea')
    setError(null)

    try {
      logger.debug('📝 Updating idea:', updatedIdea.id)

      // Optimistic update
      setIdeas(prev => prev.map(idea =>
        idea.id === updatedIdea.id ? { ...updatedIdea, updated_at: new Date().toISOString() } : idea
      ))

      // Update in database
      const updateData = {
        content: updatedIdea.content,
        details: updatedIdea.details,
        x: updatedIdea.x,
        y: updatedIdea.y,
        priority: updatedIdea.priority,
        is_collapsed: updatedIdea.is_collapsed,
        matrix_position: updatedIdea.matrix_position
      }

      const result = await DatabaseService.updateIdea(updatedIdea.id, updateData)

      if (result) {
        // Update with server response
        setIdeas(prev => prev.map(idea =>
          idea.id === updatedIdea.id ? result : idea
        ))
        logger.debug('✅ Idea updated successfully:', result.id)
      } else {
        throw new Error('Failed to update idea')
      }

      setEditingIdea?.(null)

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update idea'
      logger.error('❌ Failed to update idea:', errorMessage)
      setError(errorMessage)
      // Revert optimistic update
      await refreshIdeas()
    } finally {
      endMeasurement()
    }
  }, [setEditingIdea, refreshIdeas])

  // Delete idea with optimistic updates
  const deleteIdea = useCallback(async (ideaId: string) => {
    const endMeasurement = performanceMonitor.startMeasurement('delete-idea')
    setError(null)

    try {
      logger.debug('🗑️ Deleting idea:', ideaId)

      // Store original idea for potential rollback
      const originalIdea = ideas.find(idea => idea.id === ideaId)

      // Optimistic update
      setIdeas(prev => prev.filter(idea => idea.id !== ideaId))

      // Delete from database
      const success = await DatabaseService.deleteIdea(ideaId)

      if (success) {
        logger.debug('✅ Idea deleted successfully:', ideaId)
      } else {
        // Rollback on failure
        if (originalIdea) {
          setIdeas(prev => [...prev, originalIdea])
        }
        throw new Error('Failed to delete idea')
      }

      setEditingIdea?.(null)

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete idea'
      logger.error('❌ Failed to delete idea:', errorMessage)
      setError(errorMessage)
    } finally {
      endMeasurement()
    }
  }, [ideas, setEditingIdea])

  // Toggle collapse with optimistic updates
  const toggleCollapse = useCallback(async (ideaId: string, collapsed?: boolean) => {
    const idea = ideas.find(i => i.id === ideaId)
    if (!idea) return

    const newCollapsedState = collapsed !== undefined ? collapsed : !idea.is_collapsed

    // Optimistic update
    setIdeas(prev => prev.map(i =>
      i.id === ideaId ? { ...i, is_collapsed: newCollapsedState } : i
    ))

    try {
      // Update in database
      await DatabaseService.updateIdea(ideaId, {
        is_collapsed: newCollapsedState
      })
    } catch (err) {
      logger.error('❌ Failed to toggle collapse:', err)
      // Revert on error
      setIdeas(prev => prev.map(i =>
        i.id === ideaId ? { ...i, is_collapsed: !newCollapsedState } : i
      ))
    }
  }, [ideas])

  // Optimized drag end handler
  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, delta } = event

    if (!delta || (delta.x === 0 && delta.y === 0)) return

    const endMeasurement = performanceMonitor.startMeasurement('drag-end')

    try {
      const ideaId = active.id as string
      const idea = ideas.find(i => i.id === ideaId)
      if (!idea) return

      // Get current normalized position
      const currentPosition = legacyToNormalized(idea)

      // Apply pixel delta to get new normalized position
      const newPosition = applyPixelDelta(
        currentPosition,
        { x: delta.x, y: delta.y },
        DEFAULT_MATRIX_DIMENSIONS
      )

      // Optimistic update - update local state immediately
      const pixelPosition = normalizedToPixel(newPosition)
      setIdeas(prev => prev.map(i =>
        i.id === ideaId ? {
          ...i,
          x: Math.round(pixelPosition.x),
          y: Math.round(pixelPosition.y),
          matrix_position: newPosition,
          updated_at: new Date().toISOString()
        } : i
      ))

      // Add to batch update queue for database persistence
      addPositionUpdate({ ideaId, position: newPosition })

      logger.debug('🚚 Moved idea:', ideaId, 'to', newPosition)

    } catch (err) {
      logger.error('❌ Failed to handle drag end:', err)
      setError('Failed to move idea')
    } finally {
      endMeasurement()
    }
  }, [ideas, addPositionUpdate])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      flushPositionUpdates()
    }
  }, [flushPositionUpdates])

  return {
    ideas,
    isLoading,
    error,
    loadIdeas,
    addIdea,
    updateIdea,
    deleteIdea,
    toggleCollapse,
    handleDragEnd,
    refreshIdeas,
    clearError
  }
}