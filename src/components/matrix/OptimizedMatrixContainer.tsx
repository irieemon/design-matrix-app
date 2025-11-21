/**
 * OptimizedMatrixContainer - Ultra-high performance matrix orchestration
 *
 * Performance optimizations:
 * - GPU hardware acceleration
 * - Intelligent memoization
 * - Efficient re-render prevention
 * - Memory management
 * - 60fps target optimization
 */

import React, { useMemo, useEffect, useState, useCallback, useRef } from 'react'
import { DragEndEvent } from '@dnd-kit/core'

import type { IdeaCard, User } from '../../types'
import { useLogger } from '../../lib/logging'
import { MatrixCanvas } from './MatrixCanvas'
import {
  DEFAULT_MATRIX_DIMENSIONS,
  type MatrixDimensions
} from '../../lib/matrix/coordinates'
import { matrixPerfMonitor, enableHardwareAcceleration } from '../../lib/performance/optimizations'

interface OptimizedMatrixContainerProps {
  ideas: IdeaCard[]
  currentUser: User | null
  activeId?: string | null
  onEditIdea: (idea: IdeaCard) => void
  onDeleteIdea: (ideaId: string) => void
  onToggleCollapse: (ideaId: string, collapsed?: boolean) => void
  onDragEnd: (event: DragEndEvent) => void
  dimensions?: typeof DEFAULT_MATRIX_DIMENSIONS
  className?: string
}

export const OptimizedMatrixContainer: React.FC<OptimizedMatrixContainerProps> = ({
  ideas,
  currentUser,
  activeId,
  onEditIdea,
  onDeleteIdea,
  onToggleCollapse,
  // onDragEnd, // Currently unused
  dimensions,
  className
}) => {
  const logger = useLogger('OptimizedMatrixContainer')

  // Performance monitoring
  const endMeasurement = useMemo(() =>
    matrixPerfMonitor.startMeasurement('OptimizedMatrixContainer-render'),
    []
  )

  // Container ref for hardware acceleration
  const containerRef = useRef<HTMLDivElement>(null)

  // Optimized viewport dimensions with aggressive caching
  const [viewportDimensions, setViewportDimensions] = useState<MatrixDimensions>(DEFAULT_MATRIX_DIMENSIONS)
  const lastCalculationRef = useRef<{
    viewport: { width: number; height: number }
    dimensions: MatrixDimensions
  } | null>(null)

  // Memoized calculation function to prevent unnecessary recalculations
  const calculateOptimizedDimensions = useCallback((): MatrixDimensions => {
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    // Check if we can reuse previous calculation
    if (lastCalculationRef.current?.viewport.width === viewportWidth &&
        lastCalculationRef.current?.viewport.height === viewportHeight) {
      return lastCalculationRef.current.dimensions
    }

    const perfStart = performance.now()

    // Ultra-optimized viewport calculation with minimal DOM access
    const sidebarWidth = 280 // Use cached value instead of DOM query
    // const headerHeight = 80 // Currently unused

    // Device detection with single check
    const deviceType = viewportWidth <= 640 ? 'mobile' :
                      viewportWidth <= 768 ? 'tablet' :
                      viewportWidth <= 1024 ? 'laptop' :
                      viewportWidth <= 1440 ? 'desktop' : 'ultrawide'

    // Lookup table for performance
    const deviceConfig = {
      mobile: { utilization: 0.98, minPadding: 16, headerHeight: 60 },
      tablet: { utilization: 0.95, minPadding: 24, headerHeight: 70 },
      laptop: { utilization: 0.90, minPadding: 32, headerHeight: 80 },
      desktop: { utilization: 0.88, minPadding: 40, headerHeight: 80 },
      ultrawide: { utilization: 0.85, minPadding: 48, headerHeight: 80 }
    }

    const config = deviceConfig[deviceType]

    // Optimized calculations
    const availableWidth = viewportWidth - sidebarWidth - config.minPadding
    const availableHeight = viewportHeight - config.headerHeight

    // Calculate final dimensions with hardware-friendly values (multiples of 2)
    const finalWidth = Math.floor(Math.min(availableWidth * config.utilization, 1400) / 2) * 2
    const finalHeight = Math.floor(Math.min(availableHeight * config.utilization, 1200) / 2) * 2

    const padding = {
      top: Math.floor(finalHeight * 0.05),
      right: Math.floor(finalWidth * 0.05),
      bottom: Math.floor(finalHeight * 0.06),
      left: Math.floor(finalWidth * 0.05)
    }

    const result: MatrixDimensions = {
      width: finalWidth,
      height: finalHeight,
      padding
    }

    // Cache the result
    lastCalculationRef.current = {
      viewport: { width: viewportWidth, height: viewportHeight },
      dimensions: result
    }

    const perfEnd = performance.now()
    if (process.env.NODE_ENV === 'development') {
      const calculationTime = perfEnd - perfStart
      logger.debug('Dimension calculation', {
        calculationTime: `${calculationTime.toFixed(2)}ms`,
        viewportWidth,
        viewportHeight,
        dimensions: result
      })
    }

    return result
  }, [])

  // Debounced resize handler for optimal performance
  const resizeTimeoutRef = useRef<NodeJS.Timeout>()
  useEffect(() => {
    const handleResize = () => {
      // Debounce resize events for 60fps performance
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current)
      }

      resizeTimeoutRef.current = setTimeout(() => {
        const newDimensions = calculateOptimizedDimensions()
        setViewportDimensions(newDimensions)
      }, 16) // ~60fps
    }

    // ✅ CRITICAL FIX: Use setTimeout(0) instead of synchronous setState
    // This prevents cascading renders and improves performance
    setTimeout(() => {
      setViewportDimensions(calculateOptimizedDimensions())
    }, 0)

    // Passive event listener for better performance
    window.addEventListener('resize', handleResize, { passive: true })
    return () => {
      window.removeEventListener('resize', handleResize)
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current)
      }
    }
  }, [calculateOptimizedDimensions])

  // Hardware acceleration setup
  useEffect(() => {
    if (containerRef.current) {
      enableHardwareAcceleration(containerRef.current)

      // Additional GPU optimizations
      containerRef.current.style.contain = 'layout style paint'
      containerRef.current.style.isolation = 'isolate'
    }
  }, [])

  // Performance monitoring cleanup
  React.useEffect(() => {
    endMeasurement()
  })

  // Use provided dimensions or calculated viewport dimensions
  const finalDimensions = dimensions || viewportDimensions

  // Enterprise mode detection
  const isEnterpriseMode = className?.includes('enterprise-matrix-canvas')

  // Memoized styles for enterprise mode
  const enterpriseStyles = useMemo(() => ({
    width: '100%',
    height: '100%',
    contain: 'layout style paint' as const,
    isolation: 'isolate' as const,
    transform: 'translateZ(0)', // Force GPU layer
    backfaceVisibility: 'hidden' as const,
    perspective: 1000,
    willChange: 'transform, opacity' as const
  }), [])

  // ✅ HOOKS FIX: Move useMemo BEFORE early return (Rules of Hooks requirement)
  // Legacy mode with GPU optimizations
  const legacyStyles = useMemo(() => ({
    width: finalDimensions.width,
    height: finalDimensions.height,
    maxWidth: '95vw',
    maxHeight: '90vh',
    position: 'relative' as const,
    borderRadius: '1.5rem',
    overflow: 'hidden' as const,
    contain: 'layout style paint' as const,
    isolation: 'isolate' as const,
    transform: 'translateZ(0)',
    backfaceVisibility: 'hidden' as const,
    perspective: 1000,
    willChange: 'transform, opacity' as const,
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
  }), [finalDimensions])

  if (isEnterpriseMode) {
    return (
      <div
        ref={containerRef}
        className={`matrix-container-enterprise ${className || ''}`}
        style={enterpriseStyles}
      >
        <MatrixCanvas
          ideas={ideas}
          currentUser={currentUser}
          activeId={activeId}
          dimensions={finalDimensions}
          onEditIdea={onEditIdea}
          onDeleteIdea={onDeleteIdea}
          onToggleCollapse={onToggleCollapse}
        />
      </div>
    )
  }

  return (
    <div className={`matrix-container w-full h-full flex items-center justify-center p-4 ${className || ''}`}>
      <div
        ref={containerRef}
        className="matrix-viewport-wrapper"
        style={legacyStyles}
      >
        <MatrixCanvas
          ideas={ideas}
          currentUser={currentUser}
          activeId={activeId}
          dimensions={finalDimensions}
          onEditIdea={onEditIdea}
          onDeleteIdea={onDeleteIdea}
          onToggleCollapse={onToggleCollapse}
        />
      </div>
    </div>
  )
}

// Ultra-optimized React.memo with intelligent comparison
export default React.memo(OptimizedMatrixContainer, (prevProps, nextProps) => {
  // Fast path: reference equality check first
  if (prevProps.ideas === nextProps.ideas &&
      prevProps.currentUser === nextProps.currentUser &&
      prevProps.activeId === nextProps.activeId) {
    return true
  }

  // Detailed comparison only when needed
  const ideasChanged =
    prevProps.ideas.length !== nextProps.ideas.length ||
    prevProps.ideas.some((idea, index) => {
      const nextIdea = nextProps.ideas[index]
      return !nextIdea ||
             idea.id !== nextIdea.id ||
             idea.updated_at !== nextIdea.updated_at ||
             idea.x !== nextIdea.x ||
             idea.y !== nextIdea.y ||
             idea.is_collapsed !== nextIdea.is_collapsed
    })

  const userChanged = prevProps.currentUser?.id !== nextProps.currentUser?.id
  const activeIdChanged = prevProps.activeId !== nextProps.activeId

  return !ideasChanged && !userChanged && !activeIdChanged
})