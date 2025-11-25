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
import { X, Plus, Sparkles, Smartphone } from 'lucide-react'
import { IdeaCard, User, Project } from '../../types'
import type { BrainstormSession } from '../../types/BrainstormSession'
import DesignMatrix from '../DesignMatrix'
import { OptimizedIdeaCard } from './OptimizedIdeaCard'
import { logger } from '../../utils/logger'
import { Button } from '../ui/Button'
import { BrainstormSessionService } from '../../lib/services/BrainstormSessionService'
import SessionQRCode from '../brainstorm/SessionQRCode'
import SessionControls from '../brainstorm/SessionControls'
import DesktopParticipantPanel from '../brainstorm/DesktopParticipantPanel'
import { useBrainstormRealtime } from '../../hooks/useBrainstormRealtime'
import { isFeatureEnabled } from '../../lib/config'

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
  /** Callback to refresh ideas (polling fallback when real-time fails) */
  onRefreshIdeas?: () => Promise<void>
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
  onUpdateIdea,
  onRefreshIdeas
}) => {
  // View preferences state
  const [showGrid, setShowGrid] = useState(true)
  const [showLabels, setShowLabels] = useState(true)
  const [zoomLevel] = useState(1)

  // Track if we've successfully entered fullscreen
  const hasEnteredFullscreen = useRef(false)

  // Phase Four: Brainstorm session state
  const [brainstormSession, setBrainstormSession] = useState<
    (BrainstormSession & { qrCodeData: string }) | null
  >(null)
  const [isCreatingSession, setIsCreatingSession] = useState(false)
  const [showSessionQR, setShowSessionQR] = useState(false)
  const [mobileIdeaIds, setMobileIdeaIds] = useState<Set<string>>(new Set())

  // Phase Four: Real-time brainstorm data (participants, ideas, session state)
  // NOTE: Ideas are handled by the main useIdeas hook's real-time subscription (project-based).
  // The brainstorm realtime manager tracks session-specific events but does NOT manage the
  // main ideas array - that's handled by useIdeas which already has its own postgres_changes subscription.
  // We only use this for mobile idea tracking (blue pulse indicator) and participant presence.
  const realtimeData = useBrainstormRealtime(brainstormSession?.id || null, {
    onIdeaCreated: (idea) => {
      logger.debug('Mobile idea created (notification only):', idea.id)
      // Track this idea as coming from mobile for visual indicator (blue pulse)
      // The actual idea data will be loaded by useIdeas's project-based subscription
      setMobileIdeaIds((prev) => new Set(prev).add(idea.id))
      // NOTE: Do NOT call onAddIdea here! The idea already exists in the database.
      // The useIdeas hook's real-time subscription will pick up the change automatically.
    },
    onIdeaUpdated: (idea) => {
      logger.debug('Mobile idea updated (notification only):', idea.id)
      // NOTE: Do NOT call onUpdateIdea here! The useIdeas hook handles this.
    },
    onIdeaDeleted: (ideaId) => {
      logger.debug('Mobile idea deleted (notification only):', ideaId)
      // NOTE: Do NOT call onDeleteIdea here! The useIdeas hook handles this.
    },
    onParticipantJoined: (participant) => {
      logger.debug('Participant joined:', participant.participant_name)
    },
    onParticipantLeft: (participantId) => {
      logger.debug('Participant left:', participantId)
    },
    onSessionStateChanged: (state) => {
      logger.debug('Session state changed:', state.status)
      // Update the session status in state
      if (brainstormSession) {
        setBrainstormSession((prev) =>
          prev ? { ...prev, status: state.status } : null
        )
      }
    }
  })

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
      logger.debug('✅ MatrixFullScreenView is ACTIVE', { ideasCount: ideas.length, hasOnDragEnd: !!onDragEnd })
    }
  }, [isActive, ideas.length, onDragEnd])

  // CRITICAL: Debug feature flag and session state for brainstorm button
  React.useEffect(() => {
    const phase4Enabled = isFeatureEnabled('MOBILE_BRAINSTORM_PHASE4')
    const hasSession = !!brainstormSession
    const buttonShouldShow = phase4Enabled && !hasSession

    logger.debug('🎯 Brainstorm Button Visibility Check', {
      phase4Enabled,
      hasSession,
      buttonShouldShow,
      sessionId: brainstormSession?.id || 'none',
      timestamp: new Date().toISOString()
    })

    // Log to console for easy debugging
    console.log('=== BRAINSTORM BUTTON DEBUG ===')
    console.log('Feature Flag PHASE4:', phase4Enabled ? '✅ ENABLED' : '❌ DISABLED')
    console.log('Has Active Session:', hasSession ? '✅ YES' : '❌ NO')
    console.log('Button Should Show:', buttonShouldShow ? '✅ YES' : '❌ NO')
    console.log('==============================')
  }, [brainstormSession])

  // Phase Four: Polling fallback for ideas when brainstorm session is active
  // Real-time subscriptions may fail with "binding mismatch" errors, so we poll every 3 seconds
  // CRITICAL: Use console.log directly (not logger.debug) to ensure visibility in production
  useEffect(() => {
    // ALWAYS log polling conditions to console (not logger which filters in production)
    console.log('📡 POLLING CONDITIONS:', {
      hasBrainstormSession: !!brainstormSession,
      sessionId: brainstormSession?.id,
      sessionStatus: brainstormSession?.status,
      hasOnRefreshIdeas: !!onRefreshIdeas,
      onRefreshIdeasType: typeof onRefreshIdeas
    })

    // Only poll when:
    // 1. A brainstorm session exists (any session, even paused, means mobile users may be active)
    // 2. We have an onRefreshIdeas callback
    if (!brainstormSession || !onRefreshIdeas) {
      console.log('📡 Polling NOT started:', !brainstormSession ? 'no session' : 'no callback')
      return
    }

    // Start polling regardless of session status - mobile users may submit during any state
    console.log('📡 STARTING POLLING for session:', brainstormSession.id, 'status:', brainstormSession.status)

    // Poll immediately on session start to catch any missed ideas
    console.log('📡 Initial poll starting...')
    onRefreshIdeas()
      .then(() => console.log('📡 Initial poll completed successfully'))
      .catch(err => console.warn('📡 Initial poll failed:', err))

    // Set up interval for polling every 3 seconds
    const pollInterval = setInterval(() => {
      console.log('📡 Polling for new ideas...')
      onRefreshIdeas()
        .then(() => console.log('📡 Poll completed'))
        .catch(err => console.warn('📡 Poll failed:', err))
    }, 3000)

    console.log('📡 Poll interval set up with ID:', pollInterval)

    return () => {
      console.log('📡 Stopping polling - cleanup triggered')
      clearInterval(pollInterval)
    }
  }, [brainstormSession?.id, onRefreshIdeas])

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
      logger.debug('🔔 fullscreenchange event fired!', {
        hasFullscreenElement: !!document.fullscreenElement,
        hasEnteredFlag: hasEnteredFullscreen.current,
        willCallOnExit: !document.fullscreenElement && hasEnteredFullscreen.current
      })

      if (!document.fullscreenElement && hasEnteredFullscreen.current) {
        // User exited fullscreen via browser controls (F11, ESC, etc)
        logger.debug('📤 Calling onExit() - user exited fullscreen')
        hasEnteredFullscreen.current = false
        onExit()
        logger.debug('Browser fullscreen exited')
      }
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)

    return () => {
      logger.debug('🧹 Cleanup running for fullscreenchange useEffect', {
        hasFullscreenElement: !!document.fullscreenElement,
        hasEnteredFlag: hasEnteredFullscreen.current
      })
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      // Exit fullscreen if component unmounts while in fullscreen
      if (document.fullscreenElement) {
        logger.debug('📤 Cleanup exiting fullscreen')
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
    logger.debug('🎯 FULLSCREEN Drag started!', event.active.id)
    setActiveId(event.active.id as string)
    logger.debug('🎯 FULLSCREEN Drag started:', {
      ideaId: event.active.id,
      hasOnDragEndProp: !!onDragEnd
    })
  }

  const handleDragEndWrapper = async (event: DragEndEvent) => {
    logger.debug('🎯 FULLSCREEN Drag ended!', event.active.id, event.delta)
    logger.debug('📺 Fullscreen status at drag end:', {
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
      logger.debug('✅ Fullscreen drag completed successfully')
      logger.debug('📺 Fullscreen status after completion:', {
        hasFullscreenElement: !!document.fullscreenElement,
        hasEnteredFlag: hasEnteredFullscreen.current
      })
      logger.debug('✅ Fullscreen drag completed successfully')
    } catch (_error) {
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

  /**
   * Phase Four: Enable Mobile Join
   * Creates a new brainstorm session and displays QR code
   */
  const handleEnableMobileJoin = async () => {
    if (!currentProject || !currentUser?.id) {
      logger.error('Cannot create session: missing project or user')
      return
    }

    setIsCreatingSession(true)

    try {
      const response = await BrainstormSessionService.createSession({
        projectId: currentProject.id,
        facilitatorId: currentUser.id,
        name: `${currentProject.name} Brainstorm`,
        durationMinutes: 60,
        maxParticipants: 50,
        allowAnonymous: true,
        requireApproval: false,
        enableVoting: false
      })

      if (response.success && response.session) {
        setBrainstormSession(response.session)
        setShowSessionQR(true)
        logger.debug('Brainstorm session created:', response.session.id)
      } else {
        logger.error('Failed to create session:', response.error)
      }
    } catch (error) {
      logger.error('Error creating session:', error)
    } finally {
      setIsCreatingSession(false)
    }
  }

  /**
   * Phase Four: Close session QR overlay
   */
  const handleCloseSessionQR = () => {
    setShowSessionQR(false)
  }

  /**
   * Phase Four: Handle session updates from controls
   */
  const handleSessionUpdated = (updatedSession: BrainstormSession) => {
    setBrainstormSession((prev) =>
      prev ? { ...prev, ...updatedSession } : null
    )
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
            {/* DEV MODE: Diagnostic Banner */}
            {import.meta.env.DEV && (
              <div className="px-3 py-1 rounded bg-yellow-500/20 border border-yellow-500/50 text-xs text-yellow-200">
                Phase4: {isFeatureEnabled('MOBILE_BRAINSTORM_PHASE4') ? '✅' : '❌'} | Session: {brainstormSession ? '✅' : '❌'}
              </div>
            )}

            {/* Phase Four: Session Controls (when session active) */}
            {isFeatureEnabled('MOBILE_BRAINSTORM_PHASE4') && brainstormSession && (
              <SessionControls
                session={brainstormSession}
                onSessionUpdated={handleSessionUpdated}
              />
            )}

            {/* Phase Four: Mobile Join Button (when no session) */}
            {isFeatureEnabled('MOBILE_BRAINSTORM_PHASE4') && !brainstormSession && (
              <Button
                onClick={handleEnableMobileJoin}
                variant="secondary"
                size="md"
                icon={<Smartphone className="w-4 h-4" />}
                disabled={isCreatingSession}
              >
                {isCreatingSession ? 'Starting...' : 'Enable Mobile Join'}
              </Button>
            )}

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

      {/* Phase Four: Paused Session Visual Treatment */}
      {isFeatureEnabled('MOBILE_BRAINSTORM_PHASE4') &&
        brainstormSession &&
        brainstormSession.status === 'paused' && (
          <>
            {/* Dim overlay */}
            <div
              className="absolute inset-0 z-[100] bg-black/40 pointer-events-none"
              style={{ top: '64px' }}
            />
            {/* Pause banner */}
            <div
              className="absolute left-1/2 top-32 -translate-x-1/2 z-[100] px-6 py-4 bg-amber-500 text-white rounded-lg shadow-2xl pointer-events-none"
              role="status"
              aria-live="polite"
            >
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-white rounded-full animate-pulse-subtle" />
                <p className="text-lg font-semibold">Session Paused</p>
              </div>
              <p className="text-sm text-white/90 mt-1">
                Mobile participants cannot submit ideas while paused
              </p>
            </div>
          </>
        )}

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
            mobileIdeaIds={mobileIdeaIds}
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

      {/* Phase Four: Desktop Participant Panel (when session active) */}
      {isFeatureEnabled('MOBILE_BRAINSTORM_PHASE4') && brainstormSession && (
        <div className="fixed top-20 right-4 z-40 pointer-events-auto">
          <DesktopParticipantPanel
            participants={realtimeData.participants}
            sessionId={brainstormSession.id}
          />
        </div>
      )}

      {/* Phase Four: Session QR Code Overlay */}
      {/* CRITICAL: Must wrap in pointer-events-auto since parent has pointer-events: none */}
      {isFeatureEnabled('MOBILE_BRAINSTORM_PHASE4') &&
        brainstormSession &&
        showSessionQR && (
          <div style={{ pointerEvents: 'auto' }}>
            <SessionQRCode
              sessionId={brainstormSession.id}
              qrCodeData={brainstormSession.qrCodeData}
              joinCode={brainstormSession.join_code}
              expiresAt={brainstormSession.expires_at}
              onClose={handleCloseSessionQR}
            />
          </div>
        )}
    </div>
  )
}

export default MatrixFullScreenView
