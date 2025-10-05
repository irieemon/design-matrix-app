/**
 * Z-Index Management System
 *
 * Systematic z-index hierarchy for the matrix system.
 * No more conflicting z-index values or invisible cards.
 */

export const Z_INDEX = {
  // Background layers (negative values)
  MATRIX_BACKGROUND: -1,
  MATRIX_GRID: 0,

  // Base interface layers
  MATRIX_AXES: 10,
  QUADRANT_LABELS: 20,

  // Card layers (main content)
  CARD_BASE: 100,
  CARD_HOVER: 200,
  CARD_EDITING: 300,

  // Interaction layers
  CARD_DRAGGING: 1000,
  DROP_INDICATORS: 1100,

  // UI overlays
  TOOLTIPS: 2000,
  MODALS: 3000,
  NOTIFICATIONS: 4000
} as const

export type ZIndexLevel = typeof Z_INDEX[keyof typeof Z_INDEX]

/**
 * Get the appropriate z-index for a card based on its state
 */
export function getCardZIndex(state: {
  isDragging?: boolean
  isHovered?: boolean
  isEditing?: boolean
}): ZIndexLevel {
  if (state.isDragging) return Z_INDEX.CARD_DRAGGING
  if (state.isEditing) return Z_INDEX.CARD_EDITING
  if (state.isHovered) return Z_INDEX.CARD_HOVER
  return Z_INDEX.CARD_BASE
}

/**
 * CSS custom properties for z-index values
 */
export function generateZIndexCSSProperties() {
  return Object.entries(Z_INDEX)
    .map(([key, value]) => `--z-${key.toLowerCase().replace(/_/g, '-')}: ${value};`)
    .join('\n  ')
}

/**
 * Generate CSS classes with proper z-index values
 */
export const zIndexClasses = {
  matrixBackground: { zIndex: Z_INDEX.MATRIX_BACKGROUND },
  matrixGrid: { zIndex: Z_INDEX.MATRIX_GRID },
  matrixAxes: { zIndex: Z_INDEX.MATRIX_AXES },
  quadrantLabels: { zIndex: Z_INDEX.QUADRANT_LABELS },
  cardBase: { zIndex: Z_INDEX.CARD_BASE },
  cardHover: { zIndex: Z_INDEX.CARD_HOVER },
  cardEditing: { zIndex: Z_INDEX.CARD_EDITING },
  cardDragging: { zIndex: Z_INDEX.CARD_DRAGGING },
  dropIndicators: { zIndex: Z_INDEX.DROP_INDICATORS },
  tooltips: { zIndex: Z_INDEX.TOOLTIPS },
  modals: { zIndex: Z_INDEX.MODALS },
  notifications: { zIndex: Z_INDEX.NOTIFICATIONS }
} as const