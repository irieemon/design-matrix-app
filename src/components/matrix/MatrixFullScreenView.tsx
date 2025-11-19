/**
 * MatrixFullScreenView - Simplified full-screen workspace for idea matrix
 *
 * A distraction-free, immersive viewing mode that maximizes canvas space
 * with a persistent action bar for adding ideas.
 *
 * Features:
 * - Full viewport utilization (100vw × 100vh)
 * - Persistent top action bar with Exit, AI Idea, and Create New Idea buttons
 * - Smooth entry/exit animations (500ms)
 * - Keyboard shortcuts (ESC to exit, N for new idea, A for AI idea)
 * - Grid and label visibility controls
 */

import React, { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { DndContext, DragOverlay, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { X, Plus, Sparkles } from 'lucide-react'
import { IdeaCard, User, Project } from '../../types'
import DesignMatrix from '../DesignMatrix'
import { OptimizedIdeaCard } from './OptimizedIdeaCard'
import { logger } from '../../utils/logger'
import { Button } from '../ui/Button'

// Lazy load modals for performance
const AddIdeaModal = lazy(() => import('../AddIdeaModal'))
const AIIdeaModal = lazy(() => import('../AIIdeaModal'))
const EditIdeaModal = lazy(() => import('../EditIdeaModal'))

interface MatrixFullScreenViewProps {
  /** Whether full-screen mode is active */
  isActive: boolean
  /** Callback to exit full-screen mode */
  onExit: () => void
  /** Current user for permission checks */
  currentUser: User
  /** Current project context */
  currentProject: Project | null
  /** Ideas to display in the matrix */
  ideas: IdeaCard[]
  /** Currently dragging idea ID */
  activeId?: string | null
  /** Callbacks for idea management */
  onEditIdea: (idea: IdeaCard | null) => void
  onDeleteIdea: (ideaId: string) => Promise<void>
  onToggleCollapse: (ideaId: string, collapsed?: boolean) => Promise<void>
  /** Drag-and-drop handler */
  onDragEnd: (event: DragEndEvent) => Promise<void>
  /** Callback to show Add Idea modal */
  onShowAddModal?: () => void
  /** Callback to show AI Generate modal */
  onShowAIModal?: () => void
  /** Callback to close Add Idea modal */
  onCloseAddModal?: () => void
  /** Callback to close AI Generate modal */
  onCloseAIModal?: () => void
  /** Modal state - passed from AppLayout for fullscreen rendering */
  showAddModal?: boolean
  showAIModal?: boolean
  editingIdea?: IdeaCard | null
  /** Callback to add new idea */
  onAddIdea?: (idea: Partial<IdeaCard>) => Promise<void>
  /** Callback to update idea */
  onUpdateIdea?: (ideaId: string, updates: Partial<IdeaCard>) => Promise<void>
}

/**
 * MatrixFullScreenView Component
 *
 * Provides a full-screen viewing mode for the idea matrix with persistent action bar.
 */
export const MatrixFullScreenView: React.FC<MatrixFullScreenViewProps> = ({
  isActive,
  onExit,
  currentUser,
  currentProject,
  ideas,
  activeId: _externalActiveId,
  onEditIdea,
  onDeleteIdea,
  onToggleCollapse,
  onDragEnd,
  onShowAddModal,
  onShowAIModal,
  onCloseAddModal,
  onCloseAIModal,
  showAddModal,
  showAIModal,
  editingIdea,
  onAddIdea,
  onUpdateIdea
}) => {
  // View preferences state
  const [showGrid, setShowGrid] = useState(true)
  const [showLabels, setShowLabels] = useState(true)
  const [zoomLevel] = useState(1)

  // Track if we've successfully entered fullscreen
  const hasEnteredFullscreen = useRef(false)

  // Ref for fullscreen container (used as modal portal target)
  const fullscreenContainerRef = useRef<HTMLDivElement | null>(null)

  // Local drag state for fullscreen DndContext
  const [activeId, setActiveId] = useState<string | null>(null)

  // Configure drag sensors with distance threshold (same as AppLayout)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before drag starts
      },
    })
  )

  // Debug log to verify fullscreen view is rendering
  React.useEffect(() => {
    if (isActive) {
      console.log('✅ MatrixFullScreenView is ACTIVE', { ideasCount: ideas.length, hasOnDragEnd: !!onDragEnd })
    }
  }, [isActive, ideas.length, onDragEnd])

  /**
   * Ref callback to enter fullscreen when container is mounted
   * This is called during the user's click action, so it's a valid user gesture
   */
  const handleContainerRef = React.useCallback((node: HTMLDivElement | null) => {
    // Store ref for modal portal target
    fullscreenContainerRef.current = node

    if (node && isActive && !hasEnteredFullscreen.current) {
      // Request fullscreen immediately on mount (within user gesture context)
      node.requestFullscreen()
        .then(() => {
          hasEnteredFullscreen.current = true
          logger.debug('Browser fullscreen mode activated')
        })
        .catch((err) => {
          logger.error('Failed to enter fullscreen:', err)
        })
    }
  }, [isActive])

  /**
   * Listen for fullscreen change events to sync state
   */
  useEffect(() => {
    if (!isActive) return

    const handleFullscreenChange = () => {
      console.log('🔔 fullscreenchange event fired!', {
        hasFullscreenElement: !!document.fullscreenElement,
        hasEnteredFlag: hasEnteredFullscreen.current,
        willCallOnExit: !document.fullscreenElement && hasEnteredFullscreen.current
      })

      if (!document.fullscreenElement && hasEnteredFullscreen.current) {
        // User exited fullscreen via browser controls (F11, ESC, etc)
        console.log('📤 Calling onExit() - user exited fullscreen')
        hasEnteredFullscreen.current = false
        onExit()
        logger.debug('Browser fullscreen exited')
      }
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)

    return () => {
      console.log('🧹 Cleanup running for fullscreenchange useEffect', {
        hasFullscreenElement: !!document.fullscreenElement,
        hasEnteredFlag: hasEnteredFullscreen.current
      })
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      // Exit fullscreen if component unmounts while in fullscreen
      if (document.fullscreenElement) {
        console.log('📤 Cleanup exiting fullscreen')
        hasEnteredFullscreen.current = false
        document.exitFullscreen().catch((err) => {
          logger.error('Failed to exit fullscreen on unmount:', err)
        })
      }
    }
  }, [isActive, onExit])

  /**
   * Handle ESC key to exit full-screen (backup for browsers)
   */
  useEffect(() => {
    if (!isActive) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // The fullscreenchange handler will also trigger, so we just exit here
        if (document.fullscreenElement) {
          document.exitFullscreen()
        }
        onExit()
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isActive, onExit])

  /**
   * Drag handlers for fullscreen DndContext
   */
  const handleDragStart = (event: any) => {
    console.log('🎯 FULLSCREEN Drag started!', event.active.id)
    setActiveId(event.active.id as string)
    logger.debug('🎯 FULLSCREEN Drag started:', {
      ideaId: event.active.id,
      hasOnDragEndProp: !!onDragEnd
    })
  }

  const handleDragEndWrapper = async (event: DragEndEvent) => {
    console.log('🎯 FULLSCREEN Drag ended!', event.active.id, event.delta)
    console.log('📺 Fullscreen status at drag end:', {
      hasFullscreenElement: !!document.fullscreenElement,
      hasEnteredFlag: hasEnteredFullscreen.current
    })
    logger.debug('🎯 Fullscreen drag ended:', {
      ideaId: event.active.id,
      delta: event.delta,
      hasOnDragEnd: !!onDragEnd
    })
    setActiveId(null)

    try {
      await onDragEnd(event)
      console.log('✅ Fullscreen drag completed successfully')
      console.log('📺 Fullscreen status after completion:', {
        hasFullscreenElement: !!document.fullscreenElement,
        hasEnteredFlag: hasEnteredFullscreen.current
      })
      logger.debug('✅ Fullscreen drag completed successfully')
    } catch (error) {
      console.error('❌ Fullscreen drag failed:', error)
      logger.error('❌ Fullscreen drag failed:', error)
    }
  }

  /**
   * Action callbacks for modals
   */
  const handleAddIdea = () => {
    if (onShowAddModal) {
      onShowAddModal()
      logger.debug('Add idea modal opened from CSS full-screen overlay')
    } else {
      logger.warn('Add idea callback not provided')
    }
  }

  const handleAIGenerate = () => {
    if (onShowAIModal) {
      onShowAIModal()
      logger.debug('AI generate modal opened from CSS full-screen overlay')
    } else {
      logger.warn('AI generate callback not provided')
    }
  }

  // Get the active idea for drag overlay
  const activeIdea = activeId ? ideas.find(i => i.id === activeId) : null

  /**
   * Keyboard shortcuts handler
   */
  useEffect(() => {
    if (!isActive) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle shortcuts if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      switch (e.key.toLowerCase()) {
        case 'n':
          e.preventDefault()
          handleAddIdea()
          break

        case 'a':
          e.preventDefault()
          handleAIGenerate()
          break

        case 'g':
          e.preventDefault()
          setShowGrid(prev => !prev)
          break

        case 'l':
          e.preventDefault()
          setShowLabels(prev => !prev)
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isActive])

  // Don't render if not active
  if (!isActive) return null

  return (
    <div
      ref={handleContainerRef}
      className="fixed inset-0 z-[9999]"
      style={{
        width: '100vw',
        height: '100vh',
        position: 'fixed',
        top: 0,
        left: 0,
        pointerEvents: 'none' // Allow clicks to pass through to modals
      }}
    >
      {/* Background layer - separate from interactive elements */}
      <div
        className="absolute inset-0 bg-slate-900"
        style={{
          // CRITICAL FIX: Disable pointer events when modals are open to prevent blocking
          pointerEvents: (showAddModal || showAIModal || editingIdea) ? 'none' : 'auto'
        }}
      />
      {/* Persistent Action Bar - Always Visible */}
      <div
        className="absolute top-0 left-0 right-0 z-[101] bg-slate-900/95 backdrop-blur-md border-b border-white/10"
        style={{
          height: '64px',
          // CRITICAL FIX: Only enable pointer events when NO modals are open
          pointerEvents: (showAddModal || showAIModal || editingIdea) ? 'none' : 'auto'
        }}
      >
        <div className="h-full px-6 flex items-center justify-between">
          {/* Left: Exit + Project Info */}
          <div className="flex items-center gap-4">
            <button
              onClick={onExit}
              className="
                p-2 rounded-lg
                bg-white/10 hover:bg-white/20
                text-white
                transition-colors duration-150
                focus:outline-none focus:ring-2 focus:ring-white/50
              "
              aria-label="Exit full-screen mode"
              title="Exit full-screen (ESC)"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="text-white">
              <h2 className="text-sm font-semibold">
                {currentProject?.name || 'Idea Matrix'}
              </h2>
              <p className="text-xs text-white/60">
                {ideas.length} ideas • Press ? for shortcuts
              </p>
            </div>
          </div>

          {/* Right: Action Buttons */}
          <div className="flex items-center gap-3">
            <Button
              onClick={handleAIGenerate}
              variant="sapphire"
              size="md"
              icon={<Sparkles className="w-4 h-4" />}
            >
              AI Idea
            </Button>
            <Button
              onClick={handleAddIdea}
              variant="primary"
              size="md"
              icon={<Plus className="w-4 h-4" />}
            >
              Create New Idea
            </Button>
          </div>
        </div>
      </div>

      {/* Matrix Canvas - Full Viewport Below Action Bar */}
      <div
        className="absolute left-0 right-0 bottom-0"
        style={{
          top: '64px',
          height: 'calc(100% - 64px)',
          // CRITICAL FIX: Disable pointer events when modals are open to prevent blocking
          pointerEvents: (showAddModal || showAIModal || editingIdea) ? 'none' : 'auto'
        }}
      >
        {/* Fullscreen DndContext - keeps drag operations inside fullscreen element */}
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEndWrapper}
        >
          <DesignMatrix
            ideas={ideas}
            activeId={activeId || null}
            currentUser={currentUser}
            onEditIdea={onEditIdea}
            onDeleteIdea={onDeleteIdea}
            onToggleCollapse={onToggleCollapse}
            zoomLevel={zoomLevel}
            showGrid={showGrid}
            showLabels={showLabels}
            isFullscreen={true}
            hasOpenModal={!!(showAddModal || showAIModal || editingIdea)}
          />

          {/* DragOverlay - rendered inside fullscreen container */}
          <DragOverlay
            dropAnimation={{
              duration: 200,
              easing: 'ease',
            }}
          >
            {activeIdea ? (
              <div
                role="img"
                aria-label={`Dragging ${activeIdea.content}`}
                style={{
                  width: activeIdea.is_collapsed ? '100px' : '130px',
                  height: activeIdea.is_collapsed ? '50px' : 'auto',
                  minHeight: activeIdea.is_collapsed ? '50px' : '90px',
                  display: 'block',
                  background: 'var(--surface-primary)',
                  boxSizing: 'border-box',
                  overflow: 'hidden',
                }}
              >
                <OptimizedIdeaCard
                  idea={activeIdea}
                  isDragOverlay
                  currentUser={currentUser}
                  onEdit={() => {}}
                  onDelete={() => {}}
                  onToggleCollapse={() => {}}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Modals - Rendered inside fullscreen container with pointer events enabled */}
      <div style={{
        pointerEvents: 'auto'
      }}>
        {showAddModal && onAddIdea && (
          <Suspense fallback={null}>
            <AddIdeaModal
              isOpen={showAddModal}
              onClose={() => onCloseAddModal?.()}
              onAdd={onAddIdea}
              currentUser={currentUser}
              portalTarget={fullscreenContainerRef.current || undefined}
            />
          </Suspense>
        )}

        {showAIModal && onAddIdea && (
          <Suspense fallback={null}>
            <AIIdeaModal
              onClose={() => onCloseAIModal?.()}
              onAdd={onAddIdea}
              currentProject={currentProject}
              currentUser={currentUser}
              portalTarget={fullscreenContainerRef.current || undefined}
            />
          </Suspense>
        )}

        {editingIdea && onUpdateIdea && (
          <Suspense fallback={null}>
            <EditIdeaModal
              idea={editingIdea}
              isOpen={!!editingIdea}
              onClose={() => onEditIdea(null)}
              onUpdate={async (updates) => {
                await onUpdateIdea(editingIdea.id, updates)
                onEditIdea(null)
              }}
              onDelete={onDeleteIdea}
              currentUser={currentUser}
              portalTarget={fullscreenContainerRef.current || undefined}
            />
          </Suspense>
        )}
      </div>
    </div>
  )
}

export default MatrixFullScreenView
