import { useState, useEffect, forwardRef, useImperativeHandle } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { IdeaCard, User } from '../types'
import { OptimizedIdeaCard } from './matrix/OptimizedIdeaCard'
import { SkeletonMatrix } from './ui'
import { useComponentState } from '../hooks/useComponentState'
import { useComponentStateContext } from '../contexts/ComponentStateProvider'
import { useMatrixPerformance } from '../hooks/useMatrixPerformance'
import {
  ComponentVariant,
  ComponentState,
  ComponentSize
} from '../types/componentState'
import { logger } from '../utils/logger'

interface DesignMatrixProps {
  ideas: IdeaCard[]
  activeId?: string | null
  currentUser: User | null
  onEditIdea: (idea: IdeaCard) => void
  onDeleteIdea: (ideaId: string) => void
  onToggleCollapse: (ideaId: string, collapsed?: boolean) => void
  /** Loading state for initial data fetch */
  isLoading?: boolean
  /** Error state for data operations */
  error?: string | null
  /** Enable enhanced animations and interactions */
  animated?: boolean
  /** Matrix variant for different visual styles */
  variant?: ComponentVariant
  /** Size variant for responsive design */
  size?: ComponentSize
  /** Callback when matrix state changes */
  onStateChange?: (state: ComponentState) => void
  /** Callback for async operations with automatic state management */
  onAsyncOperation?: (operation: () => Promise<void>) => Promise<void>
  /** Zoom level for full-screen mode (0.5 - 2.0) */
  zoomLevel?: number
  /** Show grid lines */
  showGrid?: boolean
  /** Show quadrant labels */
  showLabels?: boolean
  /** Whether component is in fullscreen mode */
  isFullscreen?: boolean
}

// Matrix component reference for imperative operations
export interface DesignMatrixRef {
  /** Get current matrix state */
  getState: () => ComponentState
  /** Set matrix state programmatically */
  setState: (state: ComponentState) => void
  /** Trigger success state with optional message */
  setSuccess: (message?: string) => void
  /** Trigger error state with optional message */
  setError: (message?: string) => void
  /** Clear error/success and return to idle */
  reset: () => void
  /** Execute async operation with state management */
  executeOperation: (operation: () => Promise<void>) => Promise<void>
}

const DesignMatrix = forwardRef<DesignMatrixRef, DesignMatrixProps>(({
  ideas,
  activeId,
  currentUser,
  onEditIdea,
  onDeleteIdea,
  onToggleCollapse,
  isLoading = false,
  error = null,
  animated = true,
  size = 'md',
  onStateChange,
  onAsyncOperation,
  zoomLevel = 1,
  showGrid = true,
  showLabels = true,
  isFullscreen = false
}, ref) => {
  const [hoveredQuadrant, setHoveredQuadrant] = useState<string | null>(null)

  // CRITICAL FIX: All hooks must be called before ANY conditional early returns
  // This ensures consistent hook execution order and prevents "Rendered fewer hooks than expected" error

  // DND Kit hook - must be called unconditionally
  const { setNodeRef } = useDroppable({
    id: 'matrix'
  })

  // Performance monitoring and optimization
  const {
    matrixRef
  } = useMatrixPerformance({
    monitorHover: false, // Disabled: Causing feedback loops
    monitorAnimation: false, // Disabled: Causing excessive overhead
    monitorDrag: false, // Disabled: Causing performance degradation
    mode: 'production', // Force production mode for better performance
    onPerformanceIssue: () => {
      // Performance monitoring disabled for optimal user experience
    }
  })

  // Initialize component state with enhanced configuration
  // CRITICAL FIX: Force matrix-safe variant to prevent any gray backgrounds
  const componentState = useComponentState({
    initialConfig: {
      variant: 'matrix-safe', // Override any variant to ensure no gray backgrounds
      state: isLoading ? 'loading' : error ? 'error' : 'idle',
      size,
      animated,
      errorMessage: error || undefined
    },
    autoErrorRecovery: true,
    errorRecoveryTimeout: 5000
  })

  // Component state context - properly called as a hook every render
  // This ensures consistent hook execution and prevents React hook order violations
  const contextState = useComponentStateContext()

  // Register element for animations when context and element are available
  useEffect(() => {
    if (matrixRef.current && contextState?.setActiveElement) {
      contextState.setActiveElement(matrixRef.current)
    }
  }, [contextState])

  // Handle state changes and notifications
  useEffect(() => {
    if (onStateChange) {
      onStateChange(componentState.state)
    }
  }, [componentState.state, onStateChange])

  // Update component state based on props
  useEffect(() => {
    if (isLoading && componentState.state !== 'loading') {
      componentState.setState('loading')
    } else if (error && componentState.state !== 'error') {
      componentState.setError(error)
    } else if (!isLoading && !error && componentState.state === 'loading') {
      componentState.setState('idle')
    }
  }, [isLoading, error, componentState.state, componentState.setState, componentState.setError])

  // Enhanced async operation handler
  const handleAsyncOperation = async (operation: () => Promise<void>) => {
    try {
      if (onAsyncOperation) {
        await componentState.executeAction(onAsyncOperation.bind(null, operation))
      } else {
        await componentState.executeAction(operation)
      }
    } catch (err) {
      logger.error('Matrix operation failed:', err)
      componentState.setError(err instanceof Error ? err.message : 'Operation failed')
    }
  }

  // Imperative API
  useImperativeHandle(ref, () => ({
    getState: () => componentState.state,
    setState: (newState: ComponentState) => componentState.setState(newState),
    setSuccess: (message?: string) => componentState.setSuccess(message),
    setError: (message?: string) => componentState.setError(message),
    reset: () => componentState.reset(),
    executeOperation: handleAsyncOperation
  }), [componentState, handleAsyncOperation])

  // Handle quadrant hover for enhanced interactions
  const handleQuadrantHover = (quadrant: string | null) => {
    setHoveredQuadrant(quadrant)
    // Apply hover animations if context state and animations are available
    if (matrixRef.current && contextState?.applyHoverAnimation && animated) {
      contextState.applyHoverAnimation(matrixRef.current, !!quadrant)
    }
  }

  // Enhanced idea operations with state management
  const handleEditIdea = (idea: IdeaCard) => {
    // Direct synchronous call - no async wrapper needed for UI state changes
    onEditIdea(idea)
  }

  const handleDeleteIdea = async (ideaId: string) => {
    await handleAsyncOperation(async () => {
      onDeleteIdea(ideaId)
    })
  }

  const handleToggleCollapse = async (ideaId: string, collapsed?: boolean) => {
    await handleAsyncOperation(async () => {
      onToggleCollapse(ideaId, collapsed)
    })
  }

  // Show skeleton loading state
  if (componentState.isLoading) {
    return (
      <div
        className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-8"
        style={isFullscreen ? { height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' } : { minHeight: 'calc(100vh - 200px)', height: 'auto' }}
      >
        {/* Skeleton Matrix */}
        <SkeletonMatrix
          variant="matrix-safe"
          animated={animated}
          layout="grid"
          items={6}
        />
      </div>
    )
  }

  // Show error state
  if (componentState.hasError) {
    return (
      <div
        className="bg-white rounded-2xl shadow-sm border border-red-200/60 p-8"
        style={isFullscreen ? { height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' } : { minHeight: 'calc(100vh - 200px)', height: 'auto' }}
      >
        <div className="text-center py-12">
          <div className="text-red-400 text-4xl mb-4">⚠️</div>
          <h3 className="text-lg font-medium text-red-900 mb-2">Unable to load matrix</h3>
          <p className="text-red-600 mb-4">{componentState.config.errorMessage || 'Something went wrong'}</p>
          <button
            onClick={() => componentState.reset()}
            className="px-4 py-2 bg-red-100 text-red-800 rounded-lg hover:bg-red-200 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  // Compute matrix className with performance optimizations
  const matrixClassName = [
    'matrix-container',
    'matrix-performance-layer', // GPU acceleration layer
    'matrix-responsive',
    'gpu-accelerated',
    componentState.className,
    hoveredQuadrant ? 'matrix--hovered' : '',
    animated ? 'matrix--animated' : '',
    // All performance indicators disabled
  ].filter(Boolean).join(' ')

  return (
    <div
      className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-8"
      style={isFullscreen ? { height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' } : { minHeight: 'calc(100vh - 200px)', height: 'auto' }}
    >
      {/* Matrix Container */}
      <div
        ref={(node) => {
          if (matrixRef) {
            (matrixRef as React.MutableRefObject<HTMLDivElement | null>).current = node
          }
          setNodeRef(node)
        }}
        className={matrixClassName}
        data-state={componentState.state}
        data-variant={componentState.variant}
        data-size={componentState.size}
        data-testid="design-matrix"
        style={{
          transform: `scale(${zoomLevel})`,
          transformOrigin: 'center center',
          transition: 'transform 200ms ease-out',
          ...(isFullscreen ? { flex: 1, minHeight: 0 } : {})
        }}
      >
        {/* Matrix Grid Background */}
        {showGrid && <div className="matrix-grid" />}

        {/* Center Point */}
        <div className="matrix-center-point" />

        {/* Axis Labels */}
        <div className="matrix-axis matrix-axis-x" style={{ color: '#64748b' }}>
          Implementation Difficulty →
        </div>
        <div className="matrix-axis matrix-axis-y" style={{ color: '#64748b' }}>
          ← Business Value
        </div>

        {/* Enhanced Quadrant Labels with Performance-Optimized Hover */}
        {showLabels && (
          <>
            <div
              className={`absolute top-6 left-6 bg-emerald-50 text-emerald-800 px-4 py-3 rounded-xl text-sm font-semibold border border-emerald-200/60 shadow-sm cursor-pointer instant-hover-card ${
                hoveredQuadrant === 'quick-wins' ? 'matrix-hover-layer bg-emerald-100' : ''
              }`}
              onMouseEnter={() => handleQuadrantHover('quick-wins')}
              onMouseLeave={() => handleQuadrantHover(null)}
              data-testid="quadrant-quick-wins"
            >
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                Quick Wins
              </div>
              <div className="text-xs text-emerald-600 font-normal">High Value • Low Effort</div>
            </div>

            <div
              className={`absolute top-6 right-6 bg-blue-50 text-blue-800 px-4 py-3 rounded-xl text-sm font-semibold border border-blue-200/60 shadow-sm cursor-pointer instant-hover-card ${
                hoveredQuadrant === 'strategic' ? 'matrix-hover-layer bg-blue-100' : ''
              }`}
              onMouseEnter={() => handleQuadrantHover('strategic')}
              onMouseLeave={() => handleQuadrantHover(null)}
              data-testid="quadrant-strategic"
            >
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                Strategic
              </div>
              <div className="text-xs text-blue-600 font-normal">High Value • High Effort</div>
            </div>

            <div
              className={`absolute bottom-20 left-6 bg-amber-50 text-amber-800 px-4 py-3 rounded-xl text-sm font-semibold border border-amber-200/60 shadow-sm cursor-pointer instant-hover-card ${
                hoveredQuadrant === 'reconsider' ? 'matrix-hover-layer bg-amber-100' : ''
              }`}
              onMouseEnter={() => handleQuadrantHover('reconsider')}
              onMouseLeave={() => handleQuadrantHover(null)}
              data-testid="quadrant-reconsider"
            >
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                Reconsider
              </div>
              <div className="text-xs text-amber-600 font-normal">Low Value • Low Effort</div>
            </div>

            <div
              className={`absolute bottom-20 right-6 bg-red-50 text-red-800 px-4 py-3 rounded-xl text-sm font-semibold border border-red-200/60 shadow-sm cursor-pointer instant-hover-card ${
                hoveredQuadrant === 'avoid' ? 'matrix-hover-layer bg-red-100' : ''
              }`}
              onMouseEnter={() => handleQuadrantHover('avoid')}
              onMouseLeave={() => handleQuadrantHover(null)}
              data-testid="quadrant-avoid"
            >
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                Avoid
              </div>
              <div className="text-xs text-red-600 font-normal">Low Value • High Effort</div>
            </div>
          </>
        )}

        {/* Modern Center Lines */}
        <div className="absolute top-0 bottom-0 left-1/2 w-px bg-slate-300/60 transform -translate-x-0.5"></div>
        <div className="absolute left-0 right-0 top-1/2 h-px bg-slate-300/60 transform -translate-y-0.5"></div>


        {/* Idea Cards */}
        {(ideas || []).map((idea) => {
          // COORDINATE SCALING FIX:
          // Convert stored coordinates (0-520 range, center 260) to percentages
          // This makes positioning responsive to container size
          // Coordinate space: 0-520 + 40px padding each side = 600px total reference
          // Formula: ((coordinate + 40px) / 600) * 100 = percentage position
          const xPercent = ((idea.x + 40) / 600) * 100
          const yPercent = ((idea.y + 40) / 600) * 100

          return (
            <div
              key={idea.id}
              className="instant-hover-card performance-guaranteed"
              style={{
                position: 'absolute',
                left: `${xPercent}%`,
                top: `${yPercent}%`,
                transform: 'translate(-50%, -50%)',
                opacity: activeId === idea.id ? 0.3 : 1,  // Fade original during drag
                visibility: activeId === idea.id ? 'hidden' : 'visible'  // Hide completely during drag
              }}
              data-testid={`idea-card-${idea.id}`}
              // Performance monitoring completely disabled for optimal experience
            >
              <OptimizedIdeaCard
                idea={idea}
                currentUser={currentUser}
                onEdit={() => handleEditIdea(idea)}
                onDelete={() => handleDeleteIdea(idea.id)}
                onToggleCollapse={(ideaId, collapsed) => handleToggleCollapse(ideaId, collapsed)}
              />
            </div>
          )
        })}

        {/* Enhanced Empty State */}
        {(ideas || []).length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center p-8">
              <div className="text-slate-400 text-5xl mb-6 animate-bounce">💡</div>
              <h3 className="text-xl font-semibold text-slate-900 mb-3">Ready to prioritize?</h3>
              <p className="text-slate-600 mb-6 max-w-md">Add your first idea to get started with the priority matrix. Drag ideas between quadrants to organize by value and effort.</p>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium">
                <span>💫</span>
                <span>Tip: Quick Wins (top-left) are your best opportunities</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
})

DesignMatrix.displayName = 'DesignMatrix'

export default DesignMatrix