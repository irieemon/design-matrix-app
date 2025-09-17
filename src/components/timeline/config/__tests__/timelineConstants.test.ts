import { describe, it, expect } from 'vitest'
import {
  TIMELINE_CONSTANTS,
  TIMELINE_CLASSES,
  calculateFeatureTop,
  calculateLaneHeight
} from '../timelineConstants'

describe('timelineConstants', () => {
  describe('TIMELINE_CONSTANTS', () => {
    it('should have all required dimension constants', () => {
      expect(TIMELINE_CONSTANTS.TEAM_COLUMN_WIDTH).toBe(192)
      expect(TIMELINE_CONSTANTS.FEATURE_ROW_HEIGHT).toBe(36)
      expect(TIMELINE_CONSTANTS.FEATURE_HEIGHT).toBe(32)
      expect(TIMELINE_CONSTANTS.FEATURE_TOP_OFFSET).toBe(16)
      expect(TIMELINE_CONSTANTS.MIN_LANE_HEIGHT).toBe(140)
      expect(TIMELINE_CONSTANTS.LANE_PADDING).toBe(40)
      expect(TIMELINE_CONSTANTS.RESIZE_HANDLE_WIDTH).toBe(8)
    })

    it('should have all required timeline settings', () => {
      expect(TIMELINE_CONSTANTS.DEFAULT_TIMELINE_MONTHS).toBe(6)
      expect(TIMELINE_CONSTANTS.MAX_TIMELINE_MONTHS).toBe(12)
      expect(TIMELINE_CONSTANTS.TIMELINE_BUFFER_MONTHS).toBe(2)
    })

    it('should have all required feature constraints', () => {
      expect(TIMELINE_CONSTANTS.MIN_FEATURE_DURATION).toBe(1)
      expect(TIMELINE_CONSTANTS.MIN_START_MONTH).toBe(0)
    })

    it('should have readonly properties (const assertion)', () => {
      // TypeScript const assertion makes properties readonly at compile time
      // At runtime, properties are still modifiable unless frozen
      expect(typeof TIMELINE_CONSTANTS.TEAM_COLUMN_WIDTH).toBe('number')
      expect(TIMELINE_CONSTANTS.TEAM_COLUMN_WIDTH).toBe(192)

      // Verify the object structure exists
      expect(TIMELINE_CONSTANTS).toHaveProperty('TEAM_COLUMN_WIDTH')
      expect(TIMELINE_CONSTANTS).toHaveProperty('FEATURE_ROW_HEIGHT')
    })
  })

  describe('TIMELINE_CLASSES', () => {
    it('should have all container classes', () => {
      expect(TIMELINE_CLASSES.MAIN_CONTAINER).toContain('bg-white')
      expect(TIMELINE_CLASSES.MAIN_CONTAINER).toContain('rounded-2xl')
      expect(TIMELINE_CLASSES.HEADER_GRADIENT).toContain('bg-gradient-to-r')
      expect(TIMELINE_CLASSES.GRID_HEADER).toContain('bg-slate-50')
      expect(TIMELINE_CLASSES.LEGEND_CONTAINER).toContain('bg-slate-50')
    })

    it('should have all team lane classes', () => {
      expect(TIMELINE_CLASSES.TEAM_LABEL_BASE).toContain('flex')
      expect(TIMELINE_CLASSES.TIMELINE_AREA).toContain('flex-1')
      expect(TIMELINE_CLASSES.TEAM_DIVIDER).toContain('divide-y')
    })

    it('should have all feature classes', () => {
      expect(TIMELINE_CLASSES.FEATURE_BASE).toContain('group')
      expect(TIMELINE_CLASSES.FEATURE_BASE).toContain('absolute')
      expect(TIMELINE_CLASSES.FEATURE_BASE).toContain('h-8')
      expect(TIMELINE_CLASSES.FEATURE_CONTENT).toContain('flex-1')
      expect(TIMELINE_CLASSES.FEATURE_TITLE).toContain('text-xs')
    })

    it('should have all resize handle classes', () => {
      expect(TIMELINE_CLASSES.RESIZE_HANDLE_BASE).toContain('absolute')
      expect(TIMELINE_CLASSES.RESIZE_HANDLE_BASE).toContain('cursor-ew-resize')
      expect(TIMELINE_CLASSES.RESIZE_HANDLE_LEFT).toBe('left-0')
      expect(TIMELINE_CLASSES.RESIZE_HANDLE_RIGHT).toBe('right-0')
    })

    it('should have all grid and layout classes', () => {
      expect(TIMELINE_CLASSES.MONTH_GRID_LINES).toContain('absolute')
      expect(TIMELINE_CLASSES.MONTH_GRID_LINE).toContain('flex-1')
      expect(TIMELINE_CLASSES.TEAMS_HEADER).toContain('w-48')
      expect(TIMELINE_CLASSES.MONTH_HEADER_BASE).toContain('flex-1')
      expect(TIMELINE_CLASSES.MONTH_HEADER_CURRENT).toContain('bg-blue-600')
      expect(TIMELINE_CLASSES.MONTH_HEADER_NORMAL).toContain('bg-slate-50')
    })

    it('should have all button classes', () => {
      expect(TIMELINE_CLASSES.BUTTON_PRIMARY).toContain('bg-green-600')
      expect(TIMELINE_CLASSES.BUTTON_SECONDARY).toContain('bg-purple-600')
      expect(TIMELINE_CLASSES.BUTTON_VIEW_MODE).toContain('flex')
      expect(TIMELINE_CLASSES.BUTTON_VIEW_MODE_ACTIVE).toContain('bg-slate-600')
      expect(TIMELINE_CLASSES.BUTTON_VIEW_MODE_INACTIVE).toContain('text-slate-300')
    })

    it('should have all state classes', () => {
      expect(TIMELINE_CLASSES.DRAGGED_OPACITY).toBe('opacity-50')
      expect(TIMELINE_CLASSES.RESIZING_RING).toBe('ring-2 ring-blue-400 scale-105')
    })
  })

  describe('calculateFeatureTop utility', () => {
    it('should calculate correct top position for row 0', () => {
      const top = calculateFeatureTop(0)
      expect(top).toBe(16) // 0 * 36 + 16
    })

    it('should calculate correct top position for row 1', () => {
      const top = calculateFeatureTop(1)
      expect(top).toBe(52) // 1 * 36 + 16
    })

    it('should calculate correct top position for row 3', () => {
      const top = calculateFeatureTop(3)
      expect(top).toBe(124) // 3 * 36 + 16
    })

    it('should handle negative row index', () => {
      const top = calculateFeatureTop(-1)
      expect(top).toBe(-20) // -1 * 36 + 16
    })

    it('should handle zero row index', () => {
      const top = calculateFeatureTop(0)
      expect(top).toBe(TIMELINE_CONSTANTS.FEATURE_TOP_OFFSET)
    })

    it('should use constants correctly', () => {
      const rowIndex = 2
      const expectedTop = rowIndex * TIMELINE_CONSTANTS.FEATURE_ROW_HEIGHT + TIMELINE_CONSTANTS.FEATURE_TOP_OFFSET
      const actualTop = calculateFeatureTop(rowIndex)
      expect(actualTop).toBe(expectedTop)
    })
  })

  describe('calculateLaneHeight utility', () => {
    it('should return minimum height for small row counts', () => {
      const height = calculateLaneHeight(1)
      expect(height).toBe(140) // MIN_LANE_HEIGHT
    })

    it('should calculate correct height for larger row counts', () => {
      const height = calculateLaneHeight(5)
      const expectedHeight = 5 * TIMELINE_CONSTANTS.FEATURE_ROW_HEIGHT + TIMELINE_CONSTANTS.LANE_PADDING
      expect(height).toBe(expectedHeight) // 5 * 36 + 40 = 220
      expect(height).toBeGreaterThan(TIMELINE_CONSTANTS.MIN_LANE_HEIGHT)
    })

    it('should handle zero rows', () => {
      const height = calculateLaneHeight(0)
      expect(height).toBe(TIMELINE_CONSTANTS.MIN_LANE_HEIGHT)
    })

    it('should handle negative row counts', () => {
      const height = calculateLaneHeight(-1)
      expect(height).toBe(TIMELINE_CONSTANTS.MIN_LANE_HEIGHT)
    })

    it('should use Math.max correctly', () => {
      // Test a case where calculated height would be less than minimum
      const smallRowCount = 1
      const calculatedHeight = smallRowCount * TIMELINE_CONSTANTS.FEATURE_ROW_HEIGHT + TIMELINE_CONSTANTS.LANE_PADDING
      expect(calculatedHeight).toBeLessThan(TIMELINE_CONSTANTS.MIN_LANE_HEIGHT)

      const actualHeight = calculateLaneHeight(smallRowCount)
      expect(actualHeight).toBe(TIMELINE_CONSTANTS.MIN_LANE_HEIGHT)
    })

    it('should use constants correctly', () => {
      const maxRows = 4
      const expectedHeight = Math.max(
        TIMELINE_CONSTANTS.MIN_LANE_HEIGHT,
        maxRows * TIMELINE_CONSTANTS.FEATURE_ROW_HEIGHT + TIMELINE_CONSTANTS.LANE_PADDING
      )
      const actualHeight = calculateLaneHeight(maxRows)
      expect(actualHeight).toBe(expectedHeight)
    })
  })

  describe('constant relationships', () => {
    it('should have logical relationships between constants', () => {
      // Feature height should be less than row height (for spacing)
      expect(TIMELINE_CONSTANTS.FEATURE_HEIGHT).toBeLessThan(TIMELINE_CONSTANTS.FEATURE_ROW_HEIGHT)

      // Feature top offset should be reasonable
      expect(TIMELINE_CONSTANTS.FEATURE_TOP_OFFSET).toBeGreaterThan(0)
      expect(TIMELINE_CONSTANTS.FEATURE_TOP_OFFSET).toBeLessThan(TIMELINE_CONSTANTS.FEATURE_ROW_HEIGHT)

      // Minimum duration should be positive
      expect(TIMELINE_CONSTANTS.MIN_FEATURE_DURATION).toBeGreaterThan(0)

      // Default months should be reasonable
      expect(TIMELINE_CONSTANTS.DEFAULT_TIMELINE_MONTHS).toBeGreaterThan(0)
      expect(TIMELINE_CONSTANTS.DEFAULT_TIMELINE_MONTHS).toBeLessThanOrEqual(TIMELINE_CONSTANTS.MAX_TIMELINE_MONTHS)

      // Buffer should be reasonable
      expect(TIMELINE_CONSTANTS.TIMELINE_BUFFER_MONTHS).toBeGreaterThan(0)
      expect(TIMELINE_CONSTANTS.TIMELINE_BUFFER_MONTHS).toBeLessThan(TIMELINE_CONSTANTS.DEFAULT_TIMELINE_MONTHS)
    })

    it('should have consistent sizing for resize handles', () => {
      expect(TIMELINE_CONSTANTS.RESIZE_HANDLE_WIDTH).toBeGreaterThan(0)
      expect(TIMELINE_CONSTANTS.RESIZE_HANDLE_WIDTH).toBeLessThan(TIMELINE_CONSTANTS.FEATURE_HEIGHT)
    })

    it('should have reasonable minimum lane height', () => {
      // Should accommodate at least a few rows
      const minRowsAccommodated = Math.floor(
        (TIMELINE_CONSTANTS.MIN_LANE_HEIGHT - TIMELINE_CONSTANTS.LANE_PADDING) / TIMELINE_CONSTANTS.FEATURE_ROW_HEIGHT
      )
      expect(minRowsAccommodated).toBeGreaterThanOrEqual(2)
    })
  })

  describe('type safety', () => {
    it('should have const assertion for immutability', () => {
      // This test mainly exists for documentation
      // TypeScript compiler enforces const assertion at compile time
      expect(typeof TIMELINE_CONSTANTS).toBe('object')
      expect(typeof TIMELINE_CLASSES).toBe('object')
    })

    it('should export functions with correct signatures', () => {
      expect(typeof calculateFeatureTop).toBe('function')
      expect(typeof calculateLaneHeight).toBe('function')

      // Functions should handle numeric inputs
      expect(calculateFeatureTop(0)).toBe(16)
      expect(calculateLaneHeight(0)).toBe(140)
    })
  })
})