/**
 * Matrix Collision Detection and Spacing System
 *
 * Handles card collision detection, spacing constraints, and smart positioning
 * to prevent overlapping cards and maintain proper boundaries.
 */

import type { NormalizedPosition, PixelPosition, MatrixDimensions } from './coordinates'
import { normalizedToPixel, pixelToNormalized, constrainPosition } from './coordinates'

export interface CardDimensions {
  width: number
  height: number
}

export interface CardBounds {
  left: number
  top: number
  right: number
  bottom: number
  centerX: number
  centerY: number
}

// Standard card dimensions based on OptimizedIdeaCard
export const CARD_DIMENSIONS = {
  expanded: { width: 240, height: 160 },
  collapsed: { width: 144, height: 80 }
} as const

// Minimum spacing between cards (in pixels)
export const MIN_CARD_SPACING = 20

// Boundary padding to prevent cards from clipping edges
export const BOUNDARY_PADDING = {
  horizontal: 20, // Extra padding for card width
  vertical: 20    // Extra padding for card height
}

/**
 * Calculate card bounds at a given pixel position
 */
export function getCardBounds(
  pixelPosition: PixelPosition,
  dimensions: CardDimensions
): CardBounds {
  // Cards are centered on their position (transform: translate(-50%, -50%))
  const halfWidth = dimensions.width / 2
  const halfHeight = dimensions.height / 2

  return {
    left: pixelPosition.x - halfWidth,
    top: pixelPosition.y - halfHeight,
    right: pixelPosition.x + halfWidth,
    bottom: pixelPosition.y + halfHeight,
    centerX: pixelPosition.x,
    centerY: pixelPosition.y
  }
}

/**
 * Check if two card bounds overlap
 */
export function cardsOverlap(bounds1: CardBounds, bounds2: CardBounds): boolean {
  return !(
    bounds1.right < bounds2.left ||
    bounds1.left > bounds2.right ||
    bounds1.bottom < bounds2.top ||
    bounds1.top > bounds2.bottom
  )
}

/**
 * Check if two cards overlap including minimum spacing
 */
export function cardsConflict(
  bounds1: CardBounds,
  bounds2: CardBounds,
  minSpacing: number = MIN_CARD_SPACING
): boolean {
  // Expand bounds by half the minimum spacing
  const spacing = minSpacing / 2

  return !(
    bounds1.right + spacing < bounds2.left ||
    bounds1.left - spacing > bounds2.right ||
    bounds1.bottom + spacing < bounds2.top ||
    bounds1.top - spacing > bounds2.bottom
  )
}

/**
 * Check if a card position is within matrix boundaries
 */
export function isWithinBounds(
  pixelPosition: PixelPosition,
  cardDimensions: CardDimensions,
  matrixDimensions: MatrixDimensions
): boolean {
  const bounds = getCardBounds(pixelPosition, cardDimensions)

  const matrixLeft = matrixDimensions.padding.left + BOUNDARY_PADDING.horizontal
  const matrixTop = matrixDimensions.padding.top + BOUNDARY_PADDING.vertical
  const matrixRight = matrixDimensions.width - matrixDimensions.padding.right - BOUNDARY_PADDING.horizontal
  const matrixBottom = matrixDimensions.height - matrixDimensions.padding.bottom - BOUNDARY_PADDING.vertical

  return (
    bounds.left >= matrixLeft &&
    bounds.top >= matrixTop &&
    bounds.right <= matrixRight &&
    bounds.bottom <= matrixBottom
  )
}

/**
 * Constrain a card position to matrix boundaries
 */
export function constrainToBounds(
  pixelPosition: PixelPosition,
  cardDimensions: CardDimensions,
  matrixDimensions: MatrixDimensions
): PixelPosition {
  const halfWidth = cardDimensions.width / 2
  const halfHeight = cardDimensions.height / 2

  const minX = matrixDimensions.padding.left + BOUNDARY_PADDING.horizontal + halfWidth
  const minY = matrixDimensions.padding.top + BOUNDARY_PADDING.vertical + halfHeight
  const maxX = matrixDimensions.width - matrixDimensions.padding.right - BOUNDARY_PADDING.horizontal - halfWidth
  const maxY = matrixDimensions.height - matrixDimensions.padding.bottom - BOUNDARY_PADDING.vertical - halfHeight

  return {
    x: Math.max(minX, Math.min(maxX, pixelPosition.x)),
    y: Math.max(minY, Math.min(maxY, pixelPosition.y))
  }
}

/**
 * Find all cards that conflict with a given position
 */
export function findConflictingCards(
  targetPosition: PixelPosition,
  targetDimensions: CardDimensions,
  existingCards: Array<{
    position: PixelPosition
    dimensions: CardDimensions
    id: string
  }>,
  excludeId?: string
): string[] {
  const targetBounds = getCardBounds(targetPosition, targetDimensions)
  const conflicts: string[] = []

  for (const card of existingCards) {
    if (excludeId && card.id === excludeId) continue

    const cardBounds = getCardBounds(card.position, card.dimensions)
    if (cardsConflict(targetBounds, cardBounds)) {
      conflicts.push(card.id)
    }
  }

  return conflicts
}

/**
 * Find a non-conflicting position near the target position
 */
export function findNonConflictingPosition(
  targetPosition: PixelPosition,
  targetDimensions: CardDimensions,
  existingCards: Array<{
    position: PixelPosition
    dimensions: CardDimensions
    id: string
  }>,
  matrixDimensions: MatrixDimensions,
  excludeId?: string,
  maxAttempts: number = 50
): PixelPosition {
  // First, constrain to bounds
  let position = constrainToBounds(targetPosition, targetDimensions, matrixDimensions)

  // Check if already non-conflicting
  const conflicts = findConflictingCards(position, targetDimensions, existingCards, excludeId)
  if (conflicts.length === 0) {
    return position
  }

  // Try to find a nearby non-conflicting position
  const searchRadius = Math.max(targetDimensions.width, targetDimensions.height) + MIN_CARD_SPACING

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Generate random offset within search radius
    const angle = (Math.PI * 2 * attempt) / maxAttempts
    const distance = searchRadius * (1 + attempt / maxAttempts)

    const offsetX = Math.cos(angle) * distance
    const offsetY = Math.sin(angle) * distance

    const candidatePosition = {
      x: targetPosition.x + offsetX,
      y: targetPosition.y + offsetY
    }

    // Constrain to bounds
    const constrainedPosition = constrainToBounds(candidatePosition, targetDimensions, matrixDimensions)

    // Check for conflicts
    const candidateConflicts = findConflictingCards(
      constrainedPosition,
      targetDimensions,
      existingCards,
      excludeId
    )

    if (candidateConflicts.length === 0) {
      return constrainedPosition
    }
  }

  // If no non-conflicting position found, return constrained original position
  return position
}

/**
 * Smart positioning system that maintains spacing and boundaries
 */
export function smartPosition(
  normalizedPosition: NormalizedPosition,
  cardDimensions: CardDimensions,
  existingCards: Array<{
    normalizedPosition: NormalizedPosition
    dimensions: CardDimensions
    id: string
  }>,
  matrixDimensions: MatrixDimensions,
  excludeId?: string
): {
  normalizedPosition: NormalizedPosition
  pixelPosition: PixelPosition
  hadConflicts: boolean
} {
  // Convert to pixel position
  const targetPixelPosition = normalizedToPixel(normalizedPosition, matrixDimensions)

  // Convert existing cards to pixel positions
  const existingPixelCards = existingCards.map(card => ({
    position: normalizedToPixel(card.normalizedPosition, matrixDimensions),
    dimensions: card.dimensions,
    id: card.id
  }))

  // Find non-conflicting position
  const finalPixelPosition = findNonConflictingPosition(
    targetPixelPosition,
    cardDimensions,
    existingPixelCards,
    matrixDimensions,
    excludeId
  )

  // Convert back to normalized position
  const finalNormalizedPosition = constrainPosition(
    pixelToNormalized(finalPixelPosition, matrixDimensions)
  )

  // Check if position was adjusted
  const hadConflicts = (
    Math.abs(finalPixelPosition.x - targetPixelPosition.x) > 1 ||
    Math.abs(finalPixelPosition.y - targetPixelPosition.y) > 1
  )

  return {
    normalizedPosition: finalNormalizedPosition,
    pixelPosition: finalPixelPosition,
    hadConflicts
  }
}

/**
 * Validate and adjust all card positions to prevent overlaps
 */
export function resolveAllCollisions(
  cards: Array<{
    id: string
    normalizedPosition: NormalizedPosition
    dimensions: CardDimensions
  }>,
  matrixDimensions: MatrixDimensions
): Array<{
  id: string
  originalPosition: NormalizedPosition
  adjustedPosition: NormalizedPosition
  pixelPosition: PixelPosition
  wasAdjusted: boolean
}> {
  const results: Array<{
    id: string
    originalPosition: NormalizedPosition
    adjustedPosition: NormalizedPosition
    pixelPosition: PixelPosition
    wasAdjusted: boolean
  }> = []

  const processedCards: Array<{
    normalizedPosition: NormalizedPosition
    dimensions: CardDimensions
    id: string
  }> = []

  // Process cards one by one, adjusting positions as needed
  for (const card of cards) {
    const positioning = smartPosition(
      card.normalizedPosition,
      card.dimensions,
      processedCards,
      matrixDimensions,
      card.id
    )

    results.push({
      id: card.id,
      originalPosition: card.normalizedPosition,
      adjustedPosition: positioning.normalizedPosition,
      pixelPosition: positioning.pixelPosition,
      wasAdjusted: positioning.hadConflicts
    })

    // Add to processed cards for next iterations
    processedCards.push({
      normalizedPosition: positioning.normalizedPosition,
      dimensions: card.dimensions,
      id: card.id
    })
  }

  return results
}

/**
 * Get quadrant-aware spacing for better organization
 */
export function getQuadrantSpacing(position: NormalizedPosition): number {
  // Tighter spacing near center (where quadrants meet)
  const distanceFromCenter = Math.sqrt(
    Math.pow(position.x - 0.5, 2) + Math.pow(position.y - 0.5, 2)
  )

  // Increase spacing as we get closer to center
  const baseSpacing = MIN_CARD_SPACING
  const centerMultiplier = 1 + (1 - distanceFromCenter) * 0.5

  return baseSpacing * centerMultiplier
}