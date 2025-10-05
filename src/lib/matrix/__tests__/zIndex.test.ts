/**
 * Z-Index Management Test Suite
 *
 * Tests the z-index hierarchy and management system
 */

import { describe, it, expect } from 'vitest'
import { Z_INDEX, getCardZIndex, generateZIndexCSSProperties, zIndexClasses } from '../zIndex'

describe('Z-Index Management', () => {
  describe('Z_INDEX Constants', () => {
    it('should have hierarchical z-index values', () => {
      expect(Z_INDEX.MATRIX_BACKGROUND).toBeLessThan(Z_INDEX.MATRIX_GRID)
      expect(Z_INDEX.MATRIX_GRID).toBeLessThan(Z_INDEX.MATRIX_AXES)
      expect(Z_INDEX.MATRIX_AXES).toBeLessThan(Z_INDEX.QUADRANT_LABELS)
      expect(Z_INDEX.QUADRANT_LABELS).toBeLessThan(Z_INDEX.CARD_BASE)
      expect(Z_INDEX.CARD_BASE).toBeLessThan(Z_INDEX.CARD_HOVER)
      expect(Z_INDEX.CARD_HOVER).toBeLessThan(Z_INDEX.CARD_EDITING)
      expect(Z_INDEX.CARD_EDITING).toBeLessThan(Z_INDEX.CARD_DRAGGING)
      expect(Z_INDEX.CARD_DRAGGING).toBeLessThan(Z_INDEX.DROP_INDICATORS)
      expect(Z_INDEX.DROP_INDICATORS).toBeLessThan(Z_INDEX.TOOLTIPS)
      expect(Z_INDEX.TOOLTIPS).toBeLessThan(Z_INDEX.MODALS)
      expect(Z_INDEX.MODALS).toBeLessThan(Z_INDEX.NOTIFICATIONS)
    })

    it('should have negative values for background layers', () => {
      expect(Z_INDEX.MATRIX_BACKGROUND).toBeLessThan(0)
    })

    it('should have high values for dragging state', () => {
      expect(Z_INDEX.CARD_DRAGGING).toBeGreaterThan(900)
    })

    it('should have highest values for notifications', () => {
      expect(Z_INDEX.NOTIFICATIONS).toBeGreaterThan(3000)
    })
  })

  describe('getCardZIndex', () => {
    it('should return base z-index for normal card', () => {
      const zIndex = getCardZIndex({})
      expect(zIndex).toBe(Z_INDEX.CARD_BASE)
    })

    it('should return dragging z-index when isDragging', () => {
      const zIndex = getCardZIndex({ isDragging: true })
      expect(zIndex).toBe(Z_INDEX.CARD_DRAGGING)
    })

    it('should return editing z-index when isEditing', () => {
      const zIndex = getCardZIndex({ isEditing: true })
      expect(zIndex).toBe(Z_INDEX.CARD_EDITING)
    })

    it('should return hover z-index when isHovered', () => {
      const zIndex = getCardZIndex({ isHovered: true })
      expect(zIndex).toBe(Z_INDEX.CARD_HOVER)
    })

    it('should prioritize dragging over editing', () => {
      const zIndex = getCardZIndex({ isDragging: true, isEditing: true })
      expect(zIndex).toBe(Z_INDEX.CARD_DRAGGING)
    })

    it('should prioritize editing over hovering', () => {
      const zIndex = getCardZIndex({ isEditing: true, isHovered: true })
      expect(zIndex).toBe(Z_INDEX.CARD_EDITING)
    })

    it('should prioritize dragging over all other states', () => {
      const zIndex = getCardZIndex({
        isDragging: true,
        isEditing: true,
        isHovered: true
      })
      expect(zIndex).toBe(Z_INDEX.CARD_DRAGGING)
    })
  })

  describe('generateZIndexCSSProperties', () => {
    it('should generate CSS custom properties', () => {
      const css = generateZIndexCSSProperties()
      expect(css).toContain('--z-')
      expect(css).toContain(': ')
      expect(css).toContain(';')
    })

    it('should include all z-index constants', () => {
      const css = generateZIndexCSSProperties()
      expect(css).toContain('--z-matrix-background')
      expect(css).toContain('--z-card-base')
      expect(css).toContain('--z-notifications')
    })

    it('should convert underscores to hyphens in CSS variable names', () => {
      const css = generateZIndexCSSProperties()
      expect(css).toContain('--z-card-dragging')
      expect(css).not.toContain('--z-CARD_DRAGGING')
    })

    it('should include correct numerical values', () => {
      const css = generateZIndexCSSProperties()
      expect(css).toContain(`: ${Z_INDEX.CARD_BASE};`)
      expect(css).toContain(`: ${Z_INDEX.NOTIFICATIONS};`)
    })
  })

  describe('zIndexClasses', () => {
    it('should provide all z-index class styles', () => {
      expect(zIndexClasses.matrixBackground).toBeDefined()
      expect(zIndexClasses.cardBase).toBeDefined()
      expect(zIndexClasses.cardDragging).toBeDefined()
      expect(zIndexClasses.notifications).toBeDefined()
    })

    it('should have correct z-index values in classes', () => {
      expect(zIndexClasses.cardBase.zIndex).toBe(Z_INDEX.CARD_BASE)
      expect(zIndexClasses.cardHover.zIndex).toBe(Z_INDEX.CARD_HOVER)
      expect(zIndexClasses.cardDragging.zIndex).toBe(Z_INDEX.CARD_DRAGGING)
    })

    it('should maintain hierarchy in classes', () => {
      expect(zIndexClasses.cardBase.zIndex).toBeLessThan(zIndexClasses.cardHover.zIndex)
      expect(zIndexClasses.cardHover.zIndex).toBeLessThan(zIndexClasses.cardEditing.zIndex)
      expect(zIndexClasses.cardEditing.zIndex).toBeLessThan(zIndexClasses.cardDragging.zIndex)
    })
  })

  describe('Z-Index Integration', () => {
    it('should ensure cards appear above matrix background', () => {
      expect(Z_INDEX.CARD_BASE).toBeGreaterThan(Z_INDEX.MATRIX_BACKGROUND)
      expect(Z_INDEX.CARD_BASE).toBeGreaterThan(Z_INDEX.MATRIX_GRID)
      expect(Z_INDEX.CARD_BASE).toBeGreaterThan(Z_INDEX.MATRIX_AXES)
    })

    it('should ensure modals appear above all cards', () => {
      expect(Z_INDEX.MODALS).toBeGreaterThan(Z_INDEX.CARD_DRAGGING)
      expect(Z_INDEX.MODALS).toBeGreaterThan(Z_INDEX.DROP_INDICATORS)
    })

    it('should ensure notifications appear above modals', () => {
      expect(Z_INDEX.NOTIFICATIONS).toBeGreaterThan(Z_INDEX.MODALS)
    })
  })
})