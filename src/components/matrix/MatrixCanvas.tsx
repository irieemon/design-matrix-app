/**
 * MatrixCanvas - S-Tier Strategic Priority Matrix Canvas
 *
 * Responsibilities:
 * - Clean, accessible matrix visualization following S-tier design principles
 * - Positioning engine and layout manager using design system tokens
 * - Modern card positioning calculations with strategic white space
 * - Professional drop zone management with subtle interactions
 * - WCAG AA+ compliant with Inter typography and proper contrast
 */

import React, { useMemo } from 'react'
import { useDroppable, type DragEndEvent } from '@dnd-kit/core'

import type { IdeaCard, User } from '../../types'
import { useLogger } from '../../lib/logging'
import { MatrixGrid } from './MatrixGrid'
import { MatrixQuadrants } from './MatrixQuadrants'
import { MatrixCards } from './MatrixCards'
import {
  // DEFAULT_MATRIX_DIMENSIONS, // Currently unused
  normalizedToPixel,
  legacyToNormalized,
  type MatrixDimensions
} from '../../lib/matrix/coordinates'
import {
  CARD_DIMENSIONS,
  resolveAllCollisions,
  // type CardDimensions // Currently unused
} from '../../lib/matrix/collision'
import { Z_INDEX } from '../../lib/matrix/zIndex'
import { performanceMonitor } from '../../lib/matrix/performance'

interface MatrixCanvasProps {
  ideas: IdeaCard[]
  currentUser: User | null
  activeId?: string | null
  dimensions: MatrixDimensions
  onEditIdea: (idea: IdeaCard) => Promise<void> | void
  onDeleteIdea: (ideaId: string) => void
  onToggleCollapse: (ideaId: string, collapsed?: boolean) => void
  onDragEnd?: (event: DragEndEvent) => void
}

export const MatrixCanvas: React.FC<MatrixCanvasProps> = ({
  ideas,
  currentUser,
  activeId,
  dimensions,
  onEditIdea,
  onDeleteIdea,
  onToggleCollapse,
  onDragEnd
}) => {
  const logger = useLogger('MatrixCanvas')

  // Performance monitoring
  const endMeasurement = useMemo(() =>
    performanceMonitor.startMeasurement('MatrixCanvas-render'),
    []
  )

  React.useEffect(() => {
    endMeasurement()
  })

  // S-tier drop zone with design system tokens
  const { setNodeRef, isOver } = useDroppable({
    id: 'matrix-canvas'
  })

  // Collision-aware positioned ideas calculation
  const positionedIdeas = useMemo(() => {
    const endCalcMeasurement = performanceMonitor.startMeasurement('position-calculations')

    // Prepare cards for collision detection with their dimensions
    const cardsForCollisionDetection = ideas.map(idea => {
      const normalizedPosition = legacyToNormalized(idea)
      const dimensions = idea.is_collapsed ? CARD_DIMENSIONS.collapsed : CARD_DIMENSIONS.expanded

      return {
        id: idea.id,
        normalizedPosition,
        dimensions
      }
    })

    // Resolve all collisions and get adjusted positions
    const resolvedPositions = resolveAllCollisions(cardsForCollisionDetection, dimensions)

    // Create positioned ideas with collision-free positions
    const positioned = ideas.map(idea => {
      const resolved = resolvedPositions.find(r => r.id === idea.id)

      if (!resolved) {
        // Fallback to original logic if resolution failed
        const normalizedPosition = legacyToNormalized(idea)
        const pixelPosition = normalizedToPixel(normalizedPosition, dimensions)

        return {
          ...idea,
          normalizedPosition,
          pixelPosition,
          isActive: idea.id === activeId,
          wasAdjusted: false
        }
      }

      return {
        ...idea,
        normalizedPosition: resolved.adjustedPosition,
        pixelPosition: resolved.pixelPosition,
        isActive: idea.id === activeId,
        wasAdjusted: resolved.wasAdjusted
      }
    })

    // Log collision adjustments in development
    if (process.env.NODE_ENV === 'development') {
      const adjustedCount = positioned.filter(idea => idea.wasAdjusted).length
      if (adjustedCount > 0) {
        logger.debug('Matrix collision resolution', {
          adjustedCount,
          totalCards: positioned.length,
          adjustmentRate: `${Math.round((adjustedCount / positioned.length) * 100)}%`
        })
      }
    }

    endCalcMeasurement()
    return positioned
  }, [ideas, activeId, dimensions])

  // S-tier container styling using design system
  const containerStyle = useMemo(() => {
    return {
      width: dimensions.width,
      height: dimensions.height,
      position: 'relative' as const,
      overflow: 'hidden' as const,
      // Clean matrix styling with design tokens
      backgroundColor: 'var(--brand-surface)',
      borderRadius: 'var(--radius-card)',
      border: '1px solid var(--neutral-200)',
      transition: `all var(--duration-200) var(--ease-out)`,
      // Elevated card appearance
      boxShadow: 'var(--shadow-card)',
      // Professional drop zone feedback - subtle background only, no border changes
      ...(isOver && {
        backgroundColor: 'var(--semantic-info-bg)',
        boxShadow: 'var(--shadow-md)'
      })
    }
  }, [dimensions, isOver])

  return (
    <div className="stack stack--6 w-full h-full">
      {/* S-Tier Header with proper typography hierarchy */}
      <header className="matrix-header" style={{ zIndex: Z_INDEX.QUADRANT_LABELS }}>
        <div style={{ padding: 'var(--space-8) var(--space-8) var(--space-6)' }}>
          <h1
            style={{
              fontSize: 'var(--font-size-2xl)',
              fontWeight: 'var(--font-weight-semibold)',
              lineHeight: 'var(--line-height-tight)',
              color: 'var(--brand-primary)',
              letterSpacing: 'var(--letter-spacing-tight)',
              marginBottom: 'var(--space-4)'
            }}
          >
            Strategic Priority Matrix
          </h1>
          <p
            style={{
              fontSize: 'var(--font-size-base)',
              color: 'var(--brand-secondary)',
              lineHeight: 'var(--line-height-normal)',
              maxWidth: '600px'
            }}
          >
            Navigate strategic decisions through dimensional analysis • Ideas positioned by implementation complexity and strategic value
          </p>
        </div>
      </header>

      {/* S-Tier Matrix Canvas with clean design system styling */}
      <div className="flex-1 flex">
        <div
          ref={setNodeRef}
          className="matrix"
          style={containerStyle}
          role="application"
          aria-label="Strategic Priority Matrix - drag and drop interface for positioning ideas"
        >
          {/* Clean Background Grid using design system */}
          <MatrixGrid dimensions={dimensions} />

          {/* S-Tier Axis System with subtle, professional styling */}
          <div
            className="matrix-axis-system"
            style={{ zIndex: Z_INDEX.MATRIX_AXES }}
            aria-hidden="true"
          >
            {/* Vertical axis line */}
            <div
              className="matrix__axis matrix__axis--vertical"
              style={{
                left: '50%',
                backgroundColor: 'var(--neutral-300)'
              }}
            />

            {/* Horizontal axis line */}
            <div
              className="matrix__axis matrix__axis--horizontal"
              style={{
                top: '50%',
                backgroundColor: 'var(--neutral-300)'
              }}
            />

            {/* Professional center point with design system styling */}
            <div
              className="matrix__center"
              style={{
                backgroundColor: 'var(--interactive-focus)',
                boxShadow: `0 0 0 var(--space-1) rgba(59, 130, 246, 0.2)`
              }}
            />
          </div>

          {/* Quadrant Labels with design system integration */}
          <MatrixQuadrants dimensions={dimensions} />

          {/* Positioned Ideas with performance optimization */}
          <MatrixCards
            positionedIdeas={positionedIdeas}
            currentUser={currentUser}
            onEditIdea={onEditIdea}
            onDeleteIdea={onDeleteIdea}
            onToggleCollapse={onToggleCollapse}
            onDragEnd={onDragEnd}
          />

          {/* S-Tier Axis Labels using card component system */}
          <div
            className="matrix-axis-labels"
            style={{ zIndex: Z_INDEX.QUADRANT_LABELS }}
            role="img"
            aria-label="Matrix axes: horizontal shows implementation complexity, vertical shows strategic value"
          >
            {/* Bottom axis label - Implementation Complexity */}
            <div
              className="absolute"
              style={{
                bottom: 'var(--space-6)',
                left: '50%',
                transform: 'translateX(-50%)'
              }}
            >
              <div className="card card--elevated">
                <div
                  className="card__content"
                  style={{
                    padding: 'var(--space-3) var(--space-4)',
                    minWidth: 'max-content'
                  }}
                >
                  <span
                    style={{
                      fontSize: 'var(--font-size-sm)',
                      fontWeight: 'var(--font-weight-medium)',
                      color: 'var(--neutral-700)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-2)'
                    }}
                  >
                    Implementation Complexity
                    <span style={{ color: 'var(--neutral-500)' }}>→</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Left axis label - Strategic Value */}
            <div
              className="absolute"
              style={{
                left: 'var(--space-6)',
                top: '50%',
                transform: 'translateY(-50%) rotate(-90deg)',
                transformOrigin: 'center'
              }}
            >
              <div className="card card--elevated">
                <div
                  className="card__content"
                  style={{
                    padding: 'var(--space-3) var(--space-4)',
                    minWidth: 'max-content'
                  }}
                >
                  <span
                    style={{
                      fontSize: 'var(--font-size-sm)',
                      fontWeight: 'var(--font-weight-medium)',
                      color: 'var(--neutral-700)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-2)'
                    }}
                  >
                    <span style={{ color: 'var(--neutral-500)' }}>↑</span>
                    Strategic Value
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Professional Empty State with design system styling */}
          {positionedIdeas.length === 0 && (
            <div
              className="center absolute inset-0"
              style={{ zIndex: Z_INDEX.QUADRANT_LABELS }}
            >
              <div className="stack stack--4 text-center" style={{ maxWidth: '320px' }}>
                <div
                  style={{
                    fontSize: 'var(--font-size-5xl)',
                    lineHeight: '1'
                  }}
                  role="img"
                  aria-label="Light bulb icon"
                >
                  💡
                </div>
                <h3
                  style={{
                    fontSize: 'var(--font-size-xl)',
                    fontWeight: 'var(--font-weight-semibold)',
                    color: 'var(--brand-primary)',
                    margin: 0
                  }}
                >
                  No ideas yet
                </h3>
                <p
                  style={{
                    fontSize: 'var(--font-size-base)',
                    color: 'var(--brand-secondary)',
                    lineHeight: 'var(--line-height-normal)',
                    margin: 0
                  }}
                >
                  Click "Add Idea" to start building your strategic priority matrix and position ideas based on their implementation complexity and strategic value.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Performance-optimized memo with prop comparison
export default React.memo(MatrixCanvas, (prevProps, nextProps) => {
  return (
    prevProps.ideas === nextProps.ideas &&
    prevProps.currentUser?.id === nextProps.currentUser?.id &&
    prevProps.activeId === nextProps.activeId &&
    prevProps.dimensions === nextProps.dimensions
  )
})