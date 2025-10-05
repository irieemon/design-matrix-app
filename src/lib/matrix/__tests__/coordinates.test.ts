/**
 * Matrix Coordinate System Test Suite
 *
 * Tests the coordinate transformation utilities including:
 * - Normalized to pixel conversions
 * - Pixel to normalized conversions
 * - Quadrant calculations
 * - Position validation and clamping
 * - Legacy coordinate migration
 * - Random position generation
 */

import { describe, it, expect } from 'vitest'
import {
  normalizedToPixel,
  pixelToNormalized,
  applyPixelDelta,
  getQuadrant,
  getQuadrantCenter,
  isValidPosition,
  constrainPosition,
  legacyToNormalized,
  randomPositionInQuadrant,
  DEFAULT_MATRIX_DIMENSIONS,
  MINIMUM_MATRIX_DIMENSIONS,
  MAXIMUM_MATRIX_DIMENSIONS,
  type NormalizedPosition,
  type PixelPosition,
  type MatrixQuadrant
} from '../coordinates'

describe('Matrix Coordinates', () => {
  describe('normalizedToPixel', () => {
    it('should convert center position (0.5, 0.5) to pixel coordinates', () => {
      const normalized: NormalizedPosition = { x: 0.5, y: 0.5 }
      const result = normalizedToPixel(normalized)

      // Default dimensions: width=1200, height=1000, padding=60
      // Usable width: 1200 - 60 - 60 = 1080
      // Usable height: 1000 - 60 - 80 = 860
      // Center X: 60 + (0.5 * 1080) = 600
      // Center Y: 60 + (0.5 * 860) = 490

      expect(result.x).toBe(600)
      expect(result.y).toBe(490)
    })

    it('should convert top-left position (0, 0) to pixel coordinates', () => {
      const normalized: NormalizedPosition = { x: 0, y: 0 }
      const result = normalizedToPixel(normalized)

      // Should be at padding offset
      expect(result.x).toBe(DEFAULT_MATRIX_DIMENSIONS.padding.left)
      expect(result.y).toBe(DEFAULT_MATRIX_DIMENSIONS.padding.top)
    })

    it('should convert bottom-right position (1, 1) to pixel coordinates', () => {
      const normalized: NormalizedPosition = { x: 1, y: 1 }
      const result = normalizedToPixel(normalized)

      const expectedX = DEFAULT_MATRIX_DIMENSIONS.width - DEFAULT_MATRIX_DIMENSIONS.padding.right
      const expectedY = DEFAULT_MATRIX_DIMENSIONS.height - DEFAULT_MATRIX_DIMENSIONS.padding.bottom

      expect(result.x).toBe(expectedX)
      expect(result.y).toBe(expectedY)
    })

    it('should handle fractional normalized coordinates', () => {
      const normalized: NormalizedPosition = { x: 0.25, y: 0.75 }
      const result = normalizedToPixel(normalized)

      // Should convert accurately
      expect(result.x).toBeGreaterThan(DEFAULT_MATRIX_DIMENSIONS.padding.left)
      expect(result.y).toBeGreaterThan(DEFAULT_MATRIX_DIMENSIONS.padding.top)
    })

    it('should respect custom dimensions', () => {
      const normalized: NormalizedPosition = { x: 0.5, y: 0.5 }
      const result = normalizedToPixel(normalized, MINIMUM_MATRIX_DIMENSIONS)

      // Minimum dimensions: width=600, height=500, padding=40
      // Usable width: 600 - 40 - 40 = 520
      // Usable height: 500 - 40 - 60 = 400
      // Center X: 40 + (0.5 * 520) = 300
      // Center Y: 40 + (0.5 * 400) = 240

      expect(result.x).toBe(300)
      expect(result.y).toBe(240)
    })
  })

  describe('pixelToNormalized', () => {
    it('should convert center pixel coordinates to normalized', () => {
      const pixel: PixelPosition = { x: 600, y: 490 }
      const result = pixelToNormalized(pixel)

      expect(result.x).toBeCloseTo(0.5, 5)
      expect(result.y).toBeCloseTo(0.5, 5)
    })

    it('should convert top-left pixel coordinates to normalized', () => {
      const pixel: PixelPosition = {
        x: DEFAULT_MATRIX_DIMENSIONS.padding.left,
        y: DEFAULT_MATRIX_DIMENSIONS.padding.top
      }
      const result = pixelToNormalized(pixel)

      expect(result.x).toBe(0)
      expect(result.y).toBe(0)
    })

    it('should convert bottom-right pixel coordinates to normalized', () => {
      const pixel: PixelPosition = {
        x: DEFAULT_MATRIX_DIMENSIONS.width - DEFAULT_MATRIX_DIMENSIONS.padding.right,
        y: DEFAULT_MATRIX_DIMENSIONS.height - DEFAULT_MATRIX_DIMENSIONS.padding.bottom
      }
      const result = pixelToNormalized(pixel)

      expect(result.x).toBeCloseTo(1, 5)
      expect(result.y).toBeCloseTo(1, 5)
    })

    it('should clamp out-of-bounds coordinates', () => {
      const pixelOutside: PixelPosition = { x: -100, y: 5000 }
      const result = pixelToNormalized(pixelOutside)

      // Should clamp to 0-1 range
      expect(result.x).toBeGreaterThanOrEqual(0)
      expect(result.x).toBeLessThanOrEqual(1)
      expect(result.y).toBeGreaterThanOrEqual(0)
      expect(result.y).toBeLessThanOrEqual(1)
    })

    it('should handle fractional pixel coordinates', () => {
      const pixel: PixelPosition = { x: 450.5, y: 327.3 }
      const result = pixelToNormalized(pixel)

      expect(result.x).toBeGreaterThan(0)
      expect(result.x).toBeLessThan(1)
      expect(result.y).toBeGreaterThan(0)
      expect(result.y).toBeLessThan(1)
    })

    it('should be inverse of normalizedToPixel', () => {
      const original: NormalizedPosition = { x: 0.7, y: 0.3 }
      const pixel = normalizedToPixel(original)
      const backToNormalized = pixelToNormalized(pixel)

      expect(backToNormalized.x).toBeCloseTo(original.x, 5)
      expect(backToNormalized.y).toBeCloseTo(original.y, 5)
    })
  })

  describe('applyPixelDelta', () => {
    it('should apply positive pixel delta', () => {
      const normalized: NormalizedPosition = { x: 0.5, y: 0.5 }
      const delta: PixelPosition = { x: 100, y: 50 }
      const result = applyPixelDelta(normalized, delta)

      expect(result.x).toBeGreaterThan(0.5)
      expect(result.y).toBeGreaterThan(0.5)
    })

    it('should apply negative pixel delta', () => {
      const normalized: NormalizedPosition = { x: 0.5, y: 0.5 }
      const delta: PixelPosition = { x: -100, y: -50 }
      const result = applyPixelDelta(normalized, delta)

      expect(result.x).toBeLessThan(0.5)
      expect(result.y).toBeLessThan(0.5)
    })

    it('should clamp result to valid bounds', () => {
      const normalized: NormalizedPosition = { x: 0.9, y: 0.9 }
      const largeDelta: PixelPosition = { x: 1000, y: 1000 }
      const result = applyPixelDelta(normalized, largeDelta)

      expect(result.x).toBeLessThanOrEqual(1)
      expect(result.y).toBeLessThanOrEqual(1)
    })

    it('should handle zero delta', () => {
      const normalized: NormalizedPosition = { x: 0.3, y: 0.7 }
      const delta: PixelPosition = { x: 0, y: 0 }
      const result = applyPixelDelta(normalized, delta)

      expect(result.x).toBeCloseTo(normalized.x, 5)
      expect(result.y).toBeCloseTo(normalized.y, 5)
    })

    it('should scale delta proportionally to dimensions', () => {
      const normalized: NormalizedPosition = { x: 0.5, y: 0.5 }
      const delta: PixelPosition = { x: 100, y: 0 }

      const resultDefault = applyPixelDelta(normalized, delta, DEFAULT_MATRIX_DIMENSIONS)
      const resultMinimum = applyPixelDelta(normalized, delta, MINIMUM_MATRIX_DIMENSIONS)

      // Smaller dimensions should result in larger normalized change
      expect(resultMinimum.x - normalized.x).toBeGreaterThan(resultDefault.x - normalized.x)
    })
  })

  describe('getQuadrant', () => {
    it('should identify quick-wins quadrant (top-left)', () => {
      const position: NormalizedPosition = { x: 0.25, y: 0.25 }
      const quadrant = getQuadrant(position)

      expect(quadrant).toBe('quick-wins')
    })

    it('should identify strategic quadrant (top-right)', () => {
      const position: NormalizedPosition = { x: 0.75, y: 0.25 }
      const quadrant = getQuadrant(position)

      expect(quadrant).toBe('strategic')
    })

    it('should identify reconsider quadrant (bottom-left)', () => {
      const position: NormalizedPosition = { x: 0.25, y: 0.75 }
      const quadrant = getQuadrant(position)

      expect(quadrant).toBe('reconsider')
    })

    it('should identify avoid quadrant (bottom-right)', () => {
      const position: NormalizedPosition = { x: 0.75, y: 0.75 }
      const quadrant = getQuadrant(position)

      expect(quadrant).toBe('avoid')
    })

    it('should handle exact center (0.5, 0.5) as avoid', () => {
      const position: NormalizedPosition = { x: 0.5, y: 0.5 }
      const quadrant = getQuadrant(position)

      // Center is >= 0.5, so should be in avoid quadrant
      expect(quadrant).toBe('avoid')
    })

    it('should handle boundary at x=0.5', () => {
      const justLeft: NormalizedPosition = { x: 0.49999, y: 0.25 }
      const justRight: NormalizedPosition = { x: 0.5, y: 0.25 }

      expect(getQuadrant(justLeft)).toBe('quick-wins')
      expect(getQuadrant(justRight)).toBe('strategic')
    })

    it('should handle boundary at y=0.5', () => {
      const justAbove: NormalizedPosition = { x: 0.25, y: 0.49999 }
      const justBelow: NormalizedPosition = { x: 0.25, y: 0.5 }

      expect(getQuadrant(justAbove)).toBe('quick-wins')
      expect(getQuadrant(justBelow)).toBe('reconsider')
    })

    it('should handle extreme positions', () => {
      expect(getQuadrant({ x: 0, y: 0 })).toBe('quick-wins')
      expect(getQuadrant({ x: 1, y: 0 })).toBe('strategic')
      expect(getQuadrant({ x: 0, y: 1 })).toBe('reconsider')
      expect(getQuadrant({ x: 1, y: 1 })).toBe('avoid')
    })
  })

  describe('getQuadrantCenter', () => {
    it('should return center of quick-wins quadrant', () => {
      const center = getQuadrantCenter('quick-wins')

      expect(center.x).toBe(0.25)
      expect(center.y).toBe(0.25)
    })

    it('should return center of strategic quadrant', () => {
      const center = getQuadrantCenter('strategic')

      expect(center.x).toBe(0.75)
      expect(center.y).toBe(0.25)
    })

    it('should return center of reconsider quadrant', () => {
      const center = getQuadrantCenter('reconsider')

      expect(center.x).toBe(0.25)
      expect(center.y).toBe(0.75)
    })

    it('should return center of avoid quadrant', () => {
      const center = getQuadrantCenter('avoid')

      expect(center.x).toBe(0.75)
      expect(center.y).toBe(0.75)
    })

    it('should return positions that map back to same quadrant', () => {
      const quadrants: MatrixQuadrant[] = ['quick-wins', 'strategic', 'reconsider', 'avoid']

      quadrants.forEach((quadrant) => {
        const center = getQuadrantCenter(quadrant)
        const calculatedQuadrant = getQuadrant(center)

        expect(calculatedQuadrant).toBe(quadrant)
      })
    })
  })

  describe('isValidPosition', () => {
    it('should accept valid positions', () => {
      expect(isValidPosition({ x: 0, y: 0 })).toBe(true)
      expect(isValidPosition({ x: 0.5, y: 0.5 })).toBe(true)
      expect(isValidPosition({ x: 1, y: 1 })).toBe(true)
      expect(isValidPosition({ x: 0.123, y: 0.789 })).toBe(true)
    })

    it('should reject positions with x < 0', () => {
      expect(isValidPosition({ x: -0.1, y: 0.5 })).toBe(false)
      expect(isValidPosition({ x: -1, y: 0.5 })).toBe(false)
    })

    it('should reject positions with x > 1', () => {
      expect(isValidPosition({ x: 1.1, y: 0.5 })).toBe(false)
      expect(isValidPosition({ x: 2, y: 0.5 })).toBe(false)
    })

    it('should reject positions with y < 0', () => {
      expect(isValidPosition({ x: 0.5, y: -0.1 })).toBe(false)
      expect(isValidPosition({ x: 0.5, y: -1 })).toBe(false)
    })

    it('should reject positions with y > 1', () => {
      expect(isValidPosition({ x: 0.5, y: 1.1 })).toBe(false)
      expect(isValidPosition({ x: 0.5, y: 2 })).toBe(false)
    })

    it('should handle boundary values exactly', () => {
      expect(isValidPosition({ x: 0, y: 1 })).toBe(true)
      expect(isValidPosition({ x: 1, y: 0 })).toBe(true)
    })
  })

  describe('constrainPosition', () => {
    it('should leave valid positions unchanged', () => {
      const position: NormalizedPosition = { x: 0.5, y: 0.7 }
      const result = constrainPosition(position)

      expect(result.x).toBe(0.5)
      expect(result.y).toBe(0.7)
    })

    it('should clamp x < 0 to 0', () => {
      const position: NormalizedPosition = { x: -0.5, y: 0.5 }
      const result = constrainPosition(position)

      expect(result.x).toBe(0)
      expect(result.y).toBe(0.5)
    })

    it('should clamp x > 1 to 1', () => {
      const position: NormalizedPosition = { x: 1.5, y: 0.5 }
      const result = constrainPosition(position)

      expect(result.x).toBe(1)
      expect(result.y).toBe(0.5)
    })

    it('should clamp y < 0 to 0', () => {
      const position: NormalizedPosition = { x: 0.5, y: -0.5 }
      const result = constrainPosition(position)

      expect(result.x).toBe(0.5)
      expect(result.y).toBe(0)
    })

    it('should clamp y > 1 to 1', () => {
      const position: NormalizedPosition = { x: 0.5, y: 1.5 }
      const result = constrainPosition(position)

      expect(result.x).toBe(0.5)
      expect(result.y).toBe(1)
    })

    it('should clamp both coordinates simultaneously', () => {
      const position: NormalizedPosition = { x: -0.3, y: 1.7 }
      const result = constrainPosition(position)

      expect(result.x).toBe(0)
      expect(result.y).toBe(1)
    })

    it('should handle extreme values', () => {
      const position: NormalizedPosition = { x: -1000, y: 1000 }
      const result = constrainPosition(position)

      expect(result.x).toBe(0)
      expect(result.y).toBe(1)
    })
  })

  describe('legacyToNormalized', () => {
    it('should prefer matrix_position when available', () => {
      const idea = {
        x: 100,
        y: 100,
        matrix_position: { x: 0.6, y: 0.4 }
      }

      const result = legacyToNormalized(idea)

      expect(result.x).toBe(0.6)
      expect(result.y).toBe(0.4)
    })

    it('should convert legacy pixel coordinates', () => {
      const idea = {
        x: 600,
        y: 490
      }

      const result = legacyToNormalized(idea)

      // Should convert from pixels to normalized
      expect(result.x).toBeCloseTo(0.5, 1)
      expect(result.y).toBeCloseTo(0.5, 1)
    })

    it('should default to center when no position data', () => {
      const idea = {}

      const result = legacyToNormalized(idea)

      expect(result.x).toBe(0.5)
      expect(result.y).toBe(0.5)
    })

    it('should constrain out-of-bounds matrix_position', () => {
      const idea = {
        matrix_position: { x: 1.5, y: -0.5 }
      }

      const result = legacyToNormalized(idea)

      expect(result.x).toBeLessThanOrEqual(1)
      expect(result.y).toBeGreaterThanOrEqual(0)
    })

    it('should handle undefined coordinates', () => {
      const idea = {
        x: undefined,
        y: undefined
      }

      const result = legacyToNormalized(idea)

      expect(result.x).toBe(0.5)
      expect(result.y).toBe(0.5)
    })

    it('should handle null coordinates', () => {
      const idea = {
        x: null as any,
        y: null as any
      }

      const result = legacyToNormalized(idea)

      expect(result.x).toBe(0.5)
      expect(result.y).toBe(0.5)
    })
  })

  describe('randomPositionInQuadrant', () => {
    it('should generate position in quick-wins quadrant', () => {
      for (let i = 0; i < 10; i++) {
        const position = randomPositionInQuadrant('quick-wins')
        const quadrant = getQuadrant(position)

        expect(quadrant).toBe('quick-wins')
      }
    })

    it('should generate position in strategic quadrant', () => {
      for (let i = 0; i < 10; i++) {
        const position = randomPositionInQuadrant('strategic')
        const quadrant = getQuadrant(position)

        expect(quadrant).toBe('strategic')
      }
    })

    it('should generate position in reconsider quadrant', () => {
      for (let i = 0; i < 10; i++) {
        const position = randomPositionInQuadrant('reconsider')
        const quadrant = getQuadrant(position)

        expect(quadrant).toBe('reconsider')
      }
    })

    it('should generate position in avoid quadrant', () => {
      for (let i = 0; i < 10; i++) {
        const position = randomPositionInQuadrant('avoid')
        const quadrant = getQuadrant(position)

        expect(quadrant).toBe('avoid')
      }
    })

    it('should respect margin parameter', () => {
      const positions = Array.from({ length: 20 }, () =>
        randomPositionInQuadrant('quick-wins', 0.2)
      )

      // With larger margin, positions should be closer to center
      positions.forEach((pos) => {
        expect(pos.x).toBeGreaterThan(0.1) // Not too close to edge
        expect(pos.x).toBeLessThan(0.4) // Not too close to center
        expect(pos.y).toBeGreaterThan(0.1)
        expect(pos.y).toBeLessThan(0.4)
      })
    })

    it('should generate different positions on each call', () => {
      const position1 = randomPositionInQuadrant('quick-wins')
      const position2 = randomPositionInQuadrant('quick-wins')

      // Extremely unlikely to be exactly the same
      expect(
        position1.x === position2.x && position1.y === position2.y
      ).toBe(false)
    })

    it('should generate valid positions', () => {
      const quadrants: MatrixQuadrant[] = ['quick-wins', 'strategic', 'reconsider', 'avoid']

      quadrants.forEach((quadrant) => {
        for (let i = 0; i < 5; i++) {
          const position = randomPositionInQuadrant(quadrant)
          expect(isValidPosition(position)).toBe(true)
        }
      })
    })

    it('should handle zero margin', () => {
      for (let i = 0; i < 10; i++) {
        const position = randomPositionInQuadrant('quick-wins', 0)
        expect(isValidPosition(position)).toBe(true)
        expect(getQuadrant(position)).toBe('quick-wins')
      }
    })
  })

  describe('Dimension Presets', () => {
    it('should have valid default dimensions', () => {
      expect(DEFAULT_MATRIX_DIMENSIONS.width).toBeGreaterThan(0)
      expect(DEFAULT_MATRIX_DIMENSIONS.height).toBeGreaterThan(0)
      expect(DEFAULT_MATRIX_DIMENSIONS.padding.top).toBeGreaterThanOrEqual(0)
      expect(DEFAULT_MATRIX_DIMENSIONS.padding.right).toBeGreaterThanOrEqual(0)
      expect(DEFAULT_MATRIX_DIMENSIONS.padding.bottom).toBeGreaterThanOrEqual(0)
      expect(DEFAULT_MATRIX_DIMENSIONS.padding.left).toBeGreaterThanOrEqual(0)
    })

    it('should have valid minimum dimensions', () => {
      expect(MINIMUM_MATRIX_DIMENSIONS.width).toBeGreaterThan(0)
      expect(MINIMUM_MATRIX_DIMENSIONS.height).toBeGreaterThan(0)
      expect(MINIMUM_MATRIX_DIMENSIONS.width).toBeLessThan(DEFAULT_MATRIX_DIMENSIONS.width)
      expect(MINIMUM_MATRIX_DIMENSIONS.height).toBeLessThan(DEFAULT_MATRIX_DIMENSIONS.height)
    })

    it('should have valid maximum dimensions', () => {
      expect(MAXIMUM_MATRIX_DIMENSIONS.width).toBeGreaterThan(0)
      expect(MAXIMUM_MATRIX_DIMENSIONS.height).toBeGreaterThan(0)
      expect(MAXIMUM_MATRIX_DIMENSIONS.width).toBeGreaterThan(DEFAULT_MATRIX_DIMENSIONS.width)
      expect(MAXIMUM_MATRIX_DIMENSIONS.height).toBeGreaterThan(DEFAULT_MATRIX_DIMENSIONS.height)
    })

    it('should maintain aspect ratios across dimension presets', () => {
      const defaultRatio = DEFAULT_MATRIX_DIMENSIONS.width / DEFAULT_MATRIX_DIMENSIONS.height
      const minRatio = MINIMUM_MATRIX_DIMENSIONS.width / MINIMUM_MATRIX_DIMENSIONS.height
      const maxRatio = MAXIMUM_MATRIX_DIMENSIONS.width / MAXIMUM_MATRIX_DIMENSIONS.height

      // Ratios should be similar (within 20%)
      expect(Math.abs(defaultRatio - minRatio)).toBeLessThan(0.3)
      expect(Math.abs(defaultRatio - maxRatio)).toBeLessThan(0.3)
    })
  })

  describe('Round-trip Conversions', () => {
    it('should preserve position through round-trip conversion', () => {
      const originalNormalized: NormalizedPosition = { x: 0.3, y: 0.7 }

      const pixel = normalizedToPixel(originalNormalized)
      const backToNormalized = pixelToNormalized(pixel)

      expect(backToNormalized.x).toBeCloseTo(originalNormalized.x, 5)
      expect(backToNormalized.y).toBeCloseTo(originalNormalized.y, 5)
    })

    it('should handle multiple round-trips without drift', () => {
      let position: NormalizedPosition = { x: 0.42, y: 0.68 }

      // Multiple round-trips
      for (let i = 0; i < 5; i++) {
        const pixel = normalizedToPixel(position)
        position = pixelToNormalized(pixel)
      }

      expect(position.x).toBeCloseTo(0.42, 3)
      expect(position.y).toBeCloseTo(0.68, 3)
    })
  })

  describe('Integration Tests', () => {
    it('should correctly position idea in each quadrant', () => {
      const ideas = [
        { quadrant: 'quick-wins' as MatrixQuadrant, normalized: { x: 0.2, y: 0.3 } },
        { quadrant: 'strategic' as MatrixQuadrant, normalized: { x: 0.8, y: 0.2 } },
        { quadrant: 'reconsider' as MatrixQuadrant, normalized: { x: 0.3, y: 0.8 } },
        { quadrant: 'avoid' as MatrixQuadrant, normalized: { x: 0.7, y: 0.7 } }
      ]

      ideas.forEach(({ quadrant, normalized }) => {
        const pixel = normalizedToPixel(normalized)
        const backToNormalized = pixelToNormalized(pixel)
        const calculatedQuadrant = getQuadrant(backToNormalized)

        expect(calculatedQuadrant).toBe(quadrant)
      })
    })

    it('should handle drag operation correctly', () => {
      // Simulate dragging an idea from quick-wins to strategic
      const startPosition: NormalizedPosition = { x: 0.3, y: 0.3 }
      const dragDelta: PixelPosition = { x: 500, y: 0 }

      const endPosition = applyPixelDelta(startPosition, dragDelta)

      expect(getQuadrant(startPosition)).toBe('quick-wins')
      expect(getQuadrant(endPosition)).toBe('strategic')
    })

    it('should maintain precision across all operations', () => {
      const original: NormalizedPosition = { x: 0.123456, y: 0.789012 }

      const pixel = normalizedToPixel(original)
      const delta: PixelPosition = { x: 50, y: -30 }
      const afterDrag = applyPixelDelta(original, delta)
      const constrained = constrainPosition(afterDrag)

      expect(isValidPosition(constrained)).toBe(true)
      expect(constrained.x).toBeGreaterThanOrEqual(0)
      expect(constrained.x).toBeLessThanOrEqual(1)
      expect(constrained.y).toBeGreaterThanOrEqual(0)
      expect(constrained.y).toBeLessThanOrEqual(1)
    })
  })
})