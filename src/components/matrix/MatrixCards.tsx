/**
 * MatrixCards - Card positioning and rendering container
 */

import React from 'react'
import type { DragEndEvent } from '@dnd-kit/core'
import type { IdeaCard, User } from '../../types'
import type { NormalizedPosition, PixelPosition } from '../../lib/matrix/coordinates'
import { OptimizedIdeaCard } from './OptimizedIdeaCard'
import { performanceMonitor } from '../../lib/matrix/performance'

interface PositionedIdea extends IdeaCard {
  normalizedPosition: NormalizedPosition
  pixelPosition: PixelPosition
  isActive: boolean
  wasAdjusted?: boolean
}

interface MatrixCardsProps {
  positionedIdeas: PositionedIdea[]
  currentUser: User | null
  onEditIdea: (idea: IdeaCard) => Promise<void> | void
  onDeleteIdea: (ideaId: string) => void
  onToggleCollapse: (ideaId: string, collapsed?: boolean) => void
  onDragEnd?: (event: DragEndEvent) => void
}

export const MatrixCards: React.FC<MatrixCardsProps> = ({
  positionedIdeas,
  currentUser,
  onEditIdea,
  onDeleteIdea,
  onToggleCollapse,
  // onDragEnd // Currently unused
}) => {
  const endMeasurement = React.useMemo(() =>
    performanceMonitor.startMeasurement('MatrixCards-render'),
    []
  )

  React.useEffect(() => {
    endMeasurement()
  })

  return (
    <div className="matrix-cards-container">
      {positionedIdeas.map((idea) => {
        // Skip rendering active cards (they're in the drag overlay)
        if (idea.isActive) {
          return null
        }

        return (
          <div
            key={idea.id}
            className="idea-card-wrapper"
            style={{
              position: 'absolute',
              left: `${idea.pixelPosition.x}px`,
              top: `${idea.pixelPosition.y}px`,
              transform: 'translate(-50%, -50%)', // Center the card on the position
              // FIX: Remove transition from wrapper to prevent screen-wide flicker
              // when collision detection adjusts positions during collapse/expand.
              // Position changes should be instant; only the card content animates.
              zIndex: 100, // Ensure cards are above background
              opacity: 1,
              visibility: 'visible'
            }}
          >
            <OptimizedIdeaCard
              idea={idea}
              currentUser={currentUser}
              onEdit={() => onEditIdea(idea)}
              onDelete={() => onDeleteIdea(idea.id)}
              onToggleCollapse={(ideaId, collapsed) => onToggleCollapse(ideaId, collapsed)}
            />
          </div>
        )
      })}
    </div>
  )
}

// Optimized memo with shallow comparison of positioned ideas
export default React.memo(MatrixCards, (prevProps, nextProps) => {
  // Check if positioned ideas array has changed
  if (prevProps.positionedIdeas.length !== nextProps.positionedIdeas.length) {
    return false
  }

  // Check if any positioned idea has changed
  for (let i = 0; i < prevProps.positionedIdeas.length; i++) {
    const prev = prevProps.positionedIdeas[i]
    const next = nextProps.positionedIdeas[i]

    if (
      prev.id !== next.id ||
      prev.updated_at !== next.updated_at ||
      prev.pixelPosition.x !== next.pixelPosition.x ||
      prev.pixelPosition.y !== next.pixelPosition.y ||
      prev.isActive !== next.isActive ||
      prev.is_collapsed !== next.is_collapsed
    ) {
      return false
    }
  }

  // Check other props
  return prevProps.currentUser?.id === nextProps.currentUser?.id
})