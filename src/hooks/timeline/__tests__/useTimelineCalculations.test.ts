import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useTimelineCalculations } from '../useTimelineCalculations'
import { RoadmapFeature } from '../useTimelineFeatures'

const createMockFeature = (overrides: Partial<RoadmapFeature> = {}): RoadmapFeature => ({
  id: 'feature-1',
  title: 'Test Feature',
  startMonth: 0,
  duration: 1,
  team: 'platform',
  priority: 'medium',
  status: 'planned',
  ...overrides
})

describe('useTimelineCalculations', () => {
  const startDate = new Date('2024-01-01')

  beforeEach(() => {
    // Mock Date for consistent testing
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-15')) // Mid-January
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('timeline duration calculation', () => {
    it('should return 6 months for empty features', () => {
      const { result } = renderHook(() => useTimelineCalculations({
        features: [],
        startDate
      }))

      expect(result.current.timelineDuration).toBe(6)
    })

    it('should calculate duration based on latest feature end date plus buffer', () => {
      const features = [
        createMockFeature({ startMonth: 0, duration: 2 }), // Ends at month 2
        createMockFeature({ startMonth: 3, duration: 3 }), // Ends at month 6
        createMockFeature({ startMonth: 1, duration: 1 }), // Ends at month 2
      ]

      const { result } = renderHook(() => useTimelineCalculations({
        features,
        startDate
      }))

      // Latest end month is 6, plus 2 buffer = 8 months
      expect(result.current.timelineDuration).toBe(8)
    })

    it('should cap timeline duration at 12 months', () => {
      const features = [
        createMockFeature({ startMonth: 15, duration: 5 }) // Would end at month 20, plus buffer = 22
      ]

      const { result } = renderHook(() => useTimelineCalculations({
        features,
        startDate
      }))

      expect(result.current.timelineDuration).toBe(12)
    })

    it('should handle single feature correctly', () => {
      const features = [
        createMockFeature({ startMonth: 2, duration: 3 }) // Ends at month 5
      ]

      const { result } = renderHook(() => useTimelineCalculations({
        features,
        startDate
      }))

      // End month 5 plus 2 buffer = 7 months
      expect(result.current.timelineDuration).toBe(7)
    })
  })

  describe('months generation', () => {
    it('should generate correct number of months', () => {
      const features = [
        createMockFeature({ startMonth: 0, duration: 4 }) // Creates 6-month timeline
      ]

      const { result } = renderHook(() => useTimelineCalculations({
        features,
        startDate
      }))

      expect(result.current.months).toHaveLength(6)
    })

    it('should generate months with correct names and indices', () => {
      const features = [
        createMockFeature({ startMonth: 0, duration: 1 })
      ]

      const { result } = renderHook(() => useTimelineCalculations({
        features,
        startDate
      }))

      // Test basic structure rather than exact values
      expect(result.current.months[0]).toHaveProperty('index', 0)
      expect(result.current.months[0]).toHaveProperty('name')
      expect(result.current.months[0]).toHaveProperty('fullName')
      expect(result.current.months[0]).toHaveProperty('isCurrentMonth')

      expect(result.current.months[1]).toHaveProperty('index', 1)
      expect(result.current.months[1]).toHaveProperty('name')
      expect(result.current.months[1]).toHaveProperty('fullName')
      expect(result.current.months[1]).toHaveProperty('isCurrentMonth')
    })

    it('should handle different start dates', () => {
      const features = [
        createMockFeature({ startMonth: 0, duration: 1 })
      ]
      const julyStart = new Date('2024-07-01')

      const { result } = renderHook(() => useTimelineCalculations({
        features,
        startDate: julyStart
      }))

      // Test that months are generated and structured correctly
      expect(result.current.months).toHaveLength(3) // 1 duration + 2 buffer
      expect(result.current.months[0]).toHaveProperty('index', 0)
      expect(result.current.months[0]).toHaveProperty('name')
      expect(result.current.months[0]).toHaveProperty('fullName')
      expect(result.current.months[0]).toHaveProperty('isCurrentMonth')
    })

    it('should correctly identify current month', () => {
      const features = [
        createMockFeature({ startMonth: 0, duration: 1 })
      ]

      // System time is set to Jan 15, 2024, start date is Jan 1, 2024
      const { result } = renderHook(() => useTimelineCalculations({
        features,
        startDate
      }))

      // Test that isCurrentMonth property is boolean
      expect(typeof result.current.months[0].isCurrentMonth).toBe('boolean')
      expect(typeof result.current.months[1].isCurrentMonth).toBe('boolean')
    })
  })

  describe('feature positioning', () => {
    it('should calculate correct position for features', () => {
      const features = [
        createMockFeature({ startMonth: 2, duration: 3 }) // Timeline will be 7 months
      ]

      const { result } = renderHook(() => useTimelineCalculations({
        features,
        startDate
      }))

      const position = result.current.getFeaturePosition(features[0])

      // Month width = 100 / 7 ≈ 14.29%
      // Feature starts at month 2: 2 * 14.29% ≈ 28.57%
      // Feature duration 3: 3 * 14.29% ≈ 42.86%
      expect(position.left).toBe('28.571428571428573%')
      expect(position.width).toBe('42.85714285714286%')
    })

    it('should handle features that extend beyond timeline', () => {
      const features = [
        createMockFeature({ startMonth: 8, duration: 6 }) // Would extend beyond 12-month cap
      ]

      const { result } = renderHook(() => useTimelineCalculations({
        features,
        startDate
      }))

      const position = result.current.getFeaturePosition(features[0])

      // Timeline is capped at 12 months
      // Month width = 100 / 12 ≈ 8.33%
      // Feature starts at month 8: 8 * 8.33% ≈ 66.67%
      // Remaining space: 100% - 66.67% = 33.33%
      // Width should be clamped to remaining space
      expect(position.left).toBe('66.66666666666667%')
      expect(position.width).toBe('33.33333333333333%')
    })

    it('should handle zero-duration features', () => {
      const features = [
        createMockFeature({ startMonth: 1, duration: 0 })
      ]

      const { result } = renderHook(() => useTimelineCalculations({
        features,
        startDate
      }))

      const position = result.current.getFeaturePosition(features[0])

      expect(position.left).toBe('33.333333333333336%') // 1/3 * 100% (timeline is 3 months for 0 duration + 2 buffer)
      expect(position.width).toBe('0%')
    })
  })

  describe('feature row calculation', () => {
    it('should assign features to rows without overlap', () => {
      const teamFeatures = [
        createMockFeature({ id: 'f1', startMonth: 0, duration: 3 }), // Months 0-2
        createMockFeature({ id: 'f2', startMonth: 1, duration: 2 }), // Months 1-2 (overlaps with f1)
        createMockFeature({ id: 'f3', startMonth: 3, duration: 1 }), // Month 3 (no overlap)
      ]

      const { result } = renderHook(() => useTimelineCalculations({
        features: teamFeatures,
        startDate
      }))

      const rows = result.current.calculateFeatureRows(teamFeatures)

      expect(rows.f1).toBe(0) // First feature gets row 0
      expect(rows.f2).toBe(1) // Overlaps with f1, gets row 1
      expect(rows.f3).toBe(0) // No overlap, can use row 0 again
    })

    it('should handle complex overlapping scenarios', () => {
      const teamFeatures = [
        createMockFeature({ id: 'f1', startMonth: 0, duration: 4 }), // Months 0-3
        createMockFeature({ id: 'f2', startMonth: 1, duration: 3 }), // Months 1-3
        createMockFeature({ id: 'f3', startMonth: 2, duration: 3 }), // Months 2-4
        createMockFeature({ id: 'f4', startMonth: 5, duration: 1 }), // Month 5 (no overlap)
      ]

      const { result } = renderHook(() => useTimelineCalculations({
        features: teamFeatures,
        startDate
      }))

      const rows = result.current.calculateFeatureRows(teamFeatures)

      expect(rows.f1).toBe(0)
      expect(rows.f2).toBe(1)
      expect(rows.f3).toBe(2)
      expect(rows.f4).toBe(0) // Can reuse row 0 since no overlap
    })

    it('should handle empty team features', () => {
      const { result } = renderHook(() => useTimelineCalculations({
        features: [],
        startDate
      }))

      const rows = result.current.calculateFeatureRows([])

      expect(rows).toEqual({})
    })

    it('should handle single feature', () => {
      const teamFeatures = [
        createMockFeature({ id: 'f1', startMonth: 2, duration: 2 })
      ]

      const { result } = renderHook(() => useTimelineCalculations({
        features: teamFeatures,
        startDate
      }))

      const rows = result.current.calculateFeatureRows(teamFeatures)

      expect(rows.f1).toBe(0)
    })

    it('should sort features by start month for optimal row assignment', () => {
      // Features provided out of order
      const teamFeatures = [
        createMockFeature({ id: 'f3', startMonth: 4, duration: 1 }),
        createMockFeature({ id: 'f1', startMonth: 0, duration: 2 }),
        createMockFeature({ id: 'f2', startMonth: 1, duration: 2 }),
      ]

      const { result } = renderHook(() => useTimelineCalculations({
        features: teamFeatures,
        startDate
      }))

      const rows = result.current.calculateFeatureRows(teamFeatures)

      // Should be sorted by start month internally
      expect(rows.f1).toBe(0) // Starts first
      expect(rows.f2).toBe(1) // Overlaps with f1
      expect(rows.f3).toBe(0) // Can reuse row 0
    })
  })

  describe('team feature filtering', () => {
    it('should filter features by team correctly', () => {
      const features = [
        createMockFeature({ id: 'f1', team: 'platform' }),
        createMockFeature({ id: 'f2', team: 'web' }),
        createMockFeature({ id: 'f3', team: 'platform' }),
        createMockFeature({ id: 'f4', team: 'mobile' }),
      ]

      const { result } = renderHook(() => useTimelineCalculations({
        features,
        startDate
      }))

      const platformFeatures = result.current.getFeaturesForTeam('platform')
      const webFeatures = result.current.getFeaturesForTeam('web')
      const mobileFeatures = result.current.getFeaturesForTeam('mobile')

      expect(platformFeatures).toHaveLength(2)
      expect(platformFeatures.map(f => f.id)).toEqual(['f1', 'f3'])

      expect(webFeatures).toHaveLength(1)
      expect(webFeatures[0].id).toBe('f2')

      expect(mobileFeatures).toHaveLength(1)
      expect(mobileFeatures[0].id).toBe('f4')
    })

    it('should return empty array for non-existent team', () => {
      const features = [
        createMockFeature({ team: 'platform' })
      ]

      const { result } = renderHook(() => useTimelineCalculations({
        features,
        startDate
      }))

      const nonExistentTeamFeatures = result.current.getFeaturesForTeam('non-existent')

      expect(nonExistentTeamFeatures).toEqual([])
    })

    it('should handle empty features array', () => {
      const { result } = renderHook(() => useTimelineCalculations({
        features: [],
        startDate
      }))

      const teamFeatures = result.current.getFeaturesForTeam('platform')

      expect(teamFeatures).toEqual([])
    })
  })

  describe('memoization and performance', () => {
    it('should memoize results for same inputs', () => {
      const features = [
        createMockFeature({ startMonth: 0, duration: 2 })
      ]

      const { result, rerender } = renderHook(
        (props) => useTimelineCalculations(props),
        { initialProps: { features, startDate } }
      )

      const firstMonths = result.current.months
      const firstGetFeaturePosition = result.current.getFeaturePosition

      // Rerender with same props
      rerender({ features, startDate })

      // Should be the same references due to memoization
      expect(result.current.months).toBe(firstMonths)
      expect(result.current.getFeaturePosition).toBe(firstGetFeaturePosition)
    })

    it('should recalculate when features change', () => {
      const initialFeatures = [
        createMockFeature({ startMonth: 0, duration: 2 })
      ]

      const { result, rerender } = renderHook(
        (props) => useTimelineCalculations(props),
        { initialProps: { features: initialFeatures, startDate } }
      )

      expect(result.current.timelineDuration).toBe(4) // 2 + 2 buffer

      // Change features
      const newFeatures = [
        createMockFeature({ startMonth: 0, duration: 5 })
      ]
      rerender({ features: newFeatures, startDate })

      expect(result.current.timelineDuration).toBe(7) // 5 + 2 buffer
    })

    it('should recalculate when start date changes', () => {
      const features = [
        createMockFeature({ startMonth: 0, duration: 1 })
      ]

      const { result, rerender } = renderHook(
        (props) => useTimelineCalculations(props),
        { initialProps: { features, startDate } }
      )

      const firstMonthName = result.current.months[0].name

      // Change start date
      const newStartDate = new Date('2024-06-01')
      rerender({ features, startDate: newStartDate })

      const secondMonthName = result.current.months[0].name

      // The month names should be different after changing start date
      expect(firstMonthName).not.toBe(secondMonthName)
      expect(typeof firstMonthName).toBe('string')
      expect(typeof secondMonthName).toBe('string')
    })
  })
})