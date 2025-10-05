/**
 * Matrix Coordinate System
 *
 * Pure functions for handling the idea matrix coordinate transformations.
 * Uses normalized coordinates (0-1) as the single source of truth.
 */

export interface MatrixDimensions {
  width: number
  height: number
  padding: {
    top: number
    right: number
    bottom: number
    left: number
  }
}

export interface NormalizedPosition {
  x: number // 0-1 where 0 = left edge, 1 = right edge
  y: number // 0-1 where 0 = top edge, 1 = bottom edge
}

export interface PixelPosition {
  x: number // absolute pixel position
  y: number // absolute pixel position
}

/**
 * Default matrix dimensions optimized for immersive full-screen experience
 */
export const DEFAULT_MATRIX_DIMENSIONS: MatrixDimensions = {
  width: 1200,
  height: 1000,
  padding: {
    top: 60,
    right: 60,
    bottom: 80,
    left: 60
  }
}

/**
 * Minimum matrix dimensions for mobile and constrained viewports
 */
export const MINIMUM_MATRIX_DIMENSIONS: MatrixDimensions = {
  width: 600,
  height: 500,
  padding: {
    top: 40,
    right: 40,
    bottom: 60,
    left: 40
  }
}

/**
 * Maximum matrix dimensions for ultra-wide displays
 */
export const MAXIMUM_MATRIX_DIMENSIONS: MatrixDimensions = {
  width: 1800,
  height: 1400,
  padding: {
    top: 80,
    right: 80,
    bottom: 100,
    left: 80
  }
}

/**
 * Convert normalized coordinates (0-1) to pixel coordinates
 */
export function normalizedToPixel(
  normalized: NormalizedPosition,
  dimensions: MatrixDimensions = DEFAULT_MATRIX_DIMENSIONS
): PixelPosition {
  const usableWidth = dimensions.width - dimensions.padding.left - dimensions.padding.right
  const usableHeight = dimensions.height - dimensions.padding.top - dimensions.padding.bottom

  return {
    x: dimensions.padding.left + (normalized.x * usableWidth),
    y: dimensions.padding.top + (normalized.y * usableHeight)
  }
}

/**
 * Convert pixel coordinates to normalized coordinates (0-1)
 */
export function pixelToNormalized(
  pixel: PixelPosition,
  dimensions: MatrixDimensions = DEFAULT_MATRIX_DIMENSIONS
): NormalizedPosition {
  const usableWidth = dimensions.width - dimensions.padding.left - dimensions.padding.right
  const usableHeight = dimensions.height - dimensions.padding.top - dimensions.padding.bottom

  const normalizedX = (pixel.x - dimensions.padding.left) / usableWidth
  const normalizedY = (pixel.y - dimensions.padding.top) / usableHeight

  return {
    x: Math.max(0, Math.min(1, normalizedX)),
    y: Math.max(0, Math.min(1, normalizedY))
  }
}

/**
 * Apply a pixel delta to a normalized position
 */
export function applyPixelDelta(
  normalized: NormalizedPosition,
  deltaPixels: PixelPosition,
  dimensions: MatrixDimensions = DEFAULT_MATRIX_DIMENSIONS
): NormalizedPosition {
  // Convert current normalized to pixels
  const currentPixel = normalizedToPixel(normalized, dimensions)

  // Apply delta
  const newPixel: PixelPosition = {
    x: currentPixel.x + deltaPixels.x,
    y: currentPixel.y + deltaPixels.y
  }

  // Convert back to normalized with bounds checking
  return pixelToNormalized(newPixel, dimensions)
}

/**
 * Get the quadrant for a given normalized position
 */
export type MatrixQuadrant = 'quick-wins' | 'strategic' | 'reconsider' | 'avoid'

export function getQuadrant(position: NormalizedPosition): MatrixQuadrant {
  const isLeft = position.x < 0.5
  const isTop = position.y < 0.5

  if (isTop && isLeft) return 'quick-wins'      // High impact, low complexity
  if (isTop && !isLeft) return 'strategic'     // High impact, high complexity
  if (!isTop && isLeft) return 'reconsider'    // Low impact, low complexity
  return 'avoid'                               // Low impact, high complexity
}

/**
 * Get the center position for a quadrant
 */
export function getQuadrantCenter(quadrant: MatrixQuadrant): NormalizedPosition {
  switch (quadrant) {
    case 'quick-wins': return { x: 0.25, y: 0.25 }
    case 'strategic': return { x: 0.75, y: 0.25 }
    case 'reconsider': return { x: 0.25, y: 0.75 }
    case 'avoid': return { x: 0.75, y: 0.75 }
  }
}

/**
 * Check if a position is within the valid matrix bounds
 */
export function isValidPosition(position: NormalizedPosition): boolean {
  return position.x >= 0 && position.x <= 1 && position.y >= 0 && position.y <= 1
}

/**
 * Constrain a position to valid matrix bounds
 */
export function constrainPosition(position: NormalizedPosition): NormalizedPosition {
  return {
    x: Math.max(0, Math.min(1, position.x)),
    y: Math.max(0, Math.min(1, position.y))
  }
}

/**
 * Convert legacy IdeaCard coordinates to normalized position
 */
export function legacyToNormalized(
  idea: { x?: number; y?: number; matrix_position?: NormalizedPosition }
): NormalizedPosition {
  // Prefer matrix_position if available
  if (idea.matrix_position) {
    return constrainPosition(idea.matrix_position)
  }

  // Fallback to converting pixel coordinates
  if (idea.x !== undefined && idea.y !== undefined) {
    return pixelToNormalized({ x: idea.x, y: idea.y })
  }

  // Default to center if no position data
  return { x: 0.5, y: 0.5 }
}

/**
 * Generate a random position within a quadrant (for new ideas)
 */
export function randomPositionInQuadrant(
  quadrant: MatrixQuadrant,
  margin: number = 0.1
): NormalizedPosition {
  const center = getQuadrantCenter(quadrant)
  const spread = 0.25 - margin // Maximum spread from center

  return {
    x: center.x + (Math.random() - 0.5) * spread,
    y: center.y + (Math.random() - 0.5) * spread
  }
}