/**
 * MatrixContainer - Main orchestration component for the idea matrix
 *
 * Responsibilities:
 * - Coordinate system setup
 * - Drag & drop context
 * - Performance monitoring
 * - State management coordination
 */

import React, { useMemo } from 'react'
import { DragEndEvent } from '@dnd-kit/core'

import type { IdeaCard, User } from '../../types'
import { MatrixCanvas } from './MatrixCanvas'
import {
  DEFAULT_MATRIX_DIMENSIONS,
  type MatrixDimensions
} from '../../lib/matrix/coordinates'
import { performanceMonitor } from '../../lib/matrix/performance'
import { useMatrixLayout } from '../../hooks/useMatrixLayout'

interface MatrixContainerProps {
  /** Ideas to display in the matrix */
  ideas: IdeaCard[]
  /** Current user for permission checks */
  currentUser: User | null
  /** Currently dragging idea ID */
  activeId?: string | null
  /** Callbacks for idea management */
  onEditIdea: (idea: IdeaCard) => Promise<void> | void
  onDeleteIdea: (ideaId: string) => void
  onToggleCollapse: (ideaId: string, collapsed?: boolean) => void
  onDragEnd: (event: DragEndEvent) => void
  /** Optional matrix dimensions override */
  dimensions?: typeof DEFAULT_MATRIX_DIMENSIONS
  /** Optional CSS class name */
  className?: string
  /** Sidebar collapsed state for dynamic layout calculations */
  sidebarCollapsed?: boolean
}

export const MatrixContainer: React.FC<MatrixContainerProps> = ({
  ideas,
  currentUser,
  activeId,
  onEditIdea,
  onDeleteIdea,
  onToggleCollapse,
  onDragEnd,
  dimensions,
  className,
  sidebarCollapsed = false
}) => {
  // Performance monitoring
  const endMeasurement = useMemo(() =>
    performanceMonitor.startMeasurement('MatrixContainer-render'),
    []
  )

  // Optimized matrix layout with smooth transitions and performance monitoring
  const {
    dimensions: optimizedDimensions,
    isCalculating,
    isTransitioning,
    transitionProgress,
    performanceMetrics
  } = useMatrixLayout({
    sidebarCollapsed,
    enableTransitions: true,
    enablePerformanceMonitoring: process.env.NODE_ENV === 'development'
  })

  React.useEffect(() => {
    endMeasurement()
  })

  // Use provided dimensions or optimized calculated dimensions
  const finalDimensions = dimensions || optimizedDimensions || DEFAULT_MATRIX_DIMENSIONS

  // Add performance indicator in development
  const showPerformanceIndicator = process.env.NODE_ENV === 'development' && performanceMetrics

  // Dynamic CSS classes for performance optimization
  const containerClasses = [
    'matrix-container-optimized',
    isCalculating ? 'calculating' : '',
    isTransitioning ? 'transitioning' : '',
    className || ''
  ].filter(Boolean).join(' ')

  // Check if we're in enterprise mode (full viewport utilization)
  const isEnterpriseMode = className?.includes('enterprise-matrix-canvas')

  if (isEnterpriseMode) {
    // Enterprise mode: Full viewport utilization with maximum immersion
    const enterpriseDimensions: MatrixDimensions = {
      width: finalDimensions.width,
      height: finalDimensions.height,
      padding: finalDimensions.padding
    }

    return (
      <>
        <div className={containerClasses} style={{
          padding: '0',
          margin: '0',
          overflow: 'hidden',
          width: '100%',
          height: '100%'
        }}>
          <MatrixCanvas
            ideas={ideas}
            currentUser={currentUser}
            activeId={activeId}
            dimensions={enterpriseDimensions}
            onEditIdea={onEditIdea}
            onDeleteIdea={onDeleteIdea}
            onToggleCollapse={onToggleCollapse}
            onDragEnd={onDragEnd}
          />
        </div>

        {/* Performance indicator for development */}
        {showPerformanceIndicator && (
          <div className={`matrix-performance-indicator ${
            performanceMetrics.averageUpdateTime > 16 ? 'warning' :
            performanceMetrics.averageUpdateTime > 32 ? 'error' : ''
          }`}>
            Calc: {performanceMetrics.calculationTime.toFixed(1)}ms |
            Avg: {performanceMetrics.averageUpdateTime.toFixed(1)}ms |
            Updates: {performanceMetrics.updateCount}
            {isTransitioning && ` | Transition: ${Math.round(transitionProgress * 100)}%`}
          </div>
        )}
      </>
    )
  }

  // Legacy mode: Original behavior with minimal padding and optimization
  return (
    <>
      <div className={`matrix-container w-full h-full flex items-center justify-center p-2 ${containerClasses}`}>
        {/* Immersive Matrix Canvas - Maximum spatial utilization */}
        <div
          className="matrix-viewport-wrapper matrix-composite-layer"
          style={{
            width: finalDimensions.width,
            height: finalDimensions.height,
            maxWidth: '98vw',
            maxHeight: '95vh',
            position: 'relative',
            borderRadius: '1.5rem',
            overflow: 'hidden',
            opacity: isTransitioning ? 0.9 + (transitionProgress * 0.1) : 1,
            boxShadow: `
              0 32px 64px -12px rgba(15, 40, 71, 0.2),
              0 20px 40px -8px rgba(15, 40, 71, 0.15),
              0 8px 16px -4px rgba(15, 40, 71, 0.1),
              inset 0 1px 0 rgba(255, 255, 255, 0.8)
            `,
            background: `
              linear-gradient(135deg,
                rgba(248, 250, 252, 0.98) 0%,
                rgba(241, 245, 249, 0.95) 50%,
                rgba(248, 250, 252, 0.98) 100%
              )
            `,
            backdropFilter: 'blur(20px) saturate(120%)',
            border: '1px solid rgba(255, 255, 255, 0.6)'
          }}
        >
          <MatrixCanvas
            ideas={ideas}
            currentUser={currentUser}
            activeId={activeId}
            dimensions={finalDimensions}
            onEditIdea={onEditIdea}
            onDeleteIdea={onDeleteIdea}
            onToggleCollapse={onToggleCollapse}
            onDragEnd={onDragEnd}
          />
        </div>
      </div>

      {/* Performance indicator for development */}
      {showPerformanceIndicator && (
        <div className={`matrix-performance-indicator ${
          performanceMetrics.averageUpdateTime > 16 ? 'warning' :
          performanceMetrics.averageUpdateTime > 32 ? 'error' : ''
        }`}>
          Calc: {performanceMetrics.calculationTime.toFixed(1)}ms |
          Avg: {performanceMetrics.averageUpdateTime.toFixed(1)}ms |
          Updates: {performanceMetrics.updateCount}
          {isTransitioning && ` | Transition: ${Math.round(transitionProgress * 100)}%`}
        </div>
      )}
    </>
  )
}

// Performance-optimized export with React.memo
export default React.memo(MatrixContainer, (prevProps, nextProps) => {
  // Only re-render if ideas array changes or user changes
  const ideasChanged =
    prevProps.ideas.length !== nextProps.ideas.length ||
    prevProps.ideas.some((idea, index) => {
      const nextIdea = nextProps.ideas[index]
      return !nextIdea || idea.id !== nextIdea.id ||
             idea.updated_at !== nextIdea.updated_at
    })

  const userChanged = prevProps.currentUser?.id !== nextProps.currentUser?.id
  const activeIdChanged = prevProps.activeId !== nextProps.activeId
  const classNameChanged = prevProps.className !== nextProps.className

  // Don't block re-render on sidebar changes - let the optimized hook handle it
  return !ideasChanged && !userChanged && !activeIdChanged && !classNameChanged
})