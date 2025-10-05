import { describe, test, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useFeatureTimelineCalculations } from '../useFeatureTimelineCalculations'
import type { FeatureDetail } from '../useFeatureModalState'

describe('useFeatureTimelineCalculations', () => {
  const mockFeature: FeatureDetail = {
    id: 'test-feature-1',
    title: 'Test Feature',
    description: 'Test description',
    startMonth: 0,
    duration: 3,
    team: 'PLATFORM',
    priority: 'high',
    status: 'planned',
    userStories: [],
    deliverables: [],
    relatedIdeas: [],
    risks: [],
    successCriteria: []
  }

  describe('Timeline calculation', () => {
    test('calculates timeline correctly with startMonth 0', () => {
      const startDate = new Date('2024-01-01')

      const { result } = renderHook(() =>
        useFeatureTimelineCalculations({
          currentFeature: mockFeature,
          startDate
        })
      )

      expect(result.current.timeline).toEqual({
        start: 'January 2024',
        end: 'April 2024'
      })
    })

    test('calculates timeline correctly with startMonth 3', () => {
      const startDate = new Date('2024-01-01')
      const feature = { ...mockFeature, startMonth: 3, duration: 2 }

      const { result } = renderHook(() =>
        useFeatureTimelineCalculations({
          currentFeature: feature,
          startDate
        })
      )

      expect(result.current.timeline).toEqual({
        start: 'April 2024',
        end: 'June 2024'
      })
    })

    test('calculates timeline correctly with startMonth 6 and duration 6', () => {
      const startDate = new Date('2024-01-01')
      const feature = { ...mockFeature, startMonth: 6, duration: 6 }

      const { result } = renderHook(() =>
        useFeatureTimelineCalculations({
          currentFeature: feature,
          startDate
        })
      )

      expect(result.current.timeline).toEqual({
        start: 'July 2024',
        end: 'January 2025'
      })
    })

    test('calculates timeline correctly with duration 1', () => {
      const startDate = new Date('2024-01-01')
      const feature = { ...mockFeature, startMonth: 0, duration: 1 }

      const { result } = renderHook(() =>
        useFeatureTimelineCalculations({
          currentFeature: feature,
          startDate
        })
      )

      expect(result.current.timeline).toEqual({
        start: 'January 2024',
        end: 'February 2024'
      })
    })

    test('calculates timeline correctly with duration 12', () => {
      const startDate = new Date('2024-01-01')
      const feature = { ...mockFeature, startMonth: 0, duration: 12 }

      const { result } = renderHook(() =>
        useFeatureTimelineCalculations({
          currentFeature: feature,
          startDate
        })
      )

      expect(result.current.timeline).toEqual({
        start: 'January 2024',
        end: 'January 2025'
      })
    })

    test('handles year rollover correctly', () => {
      const startDate = new Date('2024-11-01')
      const feature = { ...mockFeature, startMonth: 0, duration: 3 }

      const { result } = renderHook(() =>
        useFeatureTimelineCalculations({
          currentFeature: feature,
          startDate
        })
      )

      expect(result.current.timeline).toEqual({
        start: 'November 2024',
        end: 'February 2025'
      })
    })

    test('handles startMonth causing year rollover', () => {
      const startDate = new Date('2024-01-01')
      const feature = { ...mockFeature, startMonth: 13, duration: 2 }

      const { result } = renderHook(() =>
        useFeatureTimelineCalculations({
          currentFeature: feature,
          startDate
        })
      )

      expect(result.current.timeline).toEqual({
        start: 'February 2025',
        end: 'April 2025'
      })
    })

    test('returns null when currentFeature is null', () => {
      const startDate = new Date('2024-01-01')

      const { result } = renderHook(() =>
        useFeatureTimelineCalculations({
          currentFeature: null,
          startDate
        })
      )

      expect(result.current.timeline).toBeNull()
    })
  })

  describe('getFeatureTimeline function', () => {
    test('returns correct timeline when called directly', () => {
      const startDate = new Date('2024-01-01')

      const { result } = renderHook(() =>
        useFeatureTimelineCalculations({
          currentFeature: mockFeature,
          startDate
        })
      )

      const timeline = result.current.getFeatureTimeline()

      expect(timeline).toEqual({
        start: 'January 2024',
        end: 'April 2024'
      })
    })

    test('returns null when currentFeature is null', () => {
      const startDate = new Date('2024-01-01')

      const { result } = renderHook(() =>
        useFeatureTimelineCalculations({
          currentFeature: null,
          startDate
        })
      )

      const timeline = result.current.getFeatureTimeline()

      expect(timeline).toBeNull()
    })

    test('returns same result as memoized timeline', () => {
      const startDate = new Date('2024-01-01')

      const { result } = renderHook(() =>
        useFeatureTimelineCalculations({
          currentFeature: mockFeature,
          startDate
        })
      )

      const directTimeline = result.current.getFeatureTimeline()
      const memoizedTimeline = result.current.timeline

      expect(directTimeline).toEqual(memoizedTimeline)
    })
  })

  describe('Timeline memoization', () => {
    test('memoizes timeline when dependencies do not change', () => {
      const startDate = new Date('2024-01-01')

      const { result, rerender } = renderHook(() =>
        useFeatureTimelineCalculations({
          currentFeature: mockFeature,
          startDate
        })
      )

      const firstTimeline = result.current.timeline

      rerender()

      expect(result.current.timeline).toBe(firstTimeline)
    })

    test('recalculates timeline when startMonth changes', () => {
      const startDate = new Date('2024-01-01')

      const { result, rerender } = renderHook(
        ({ feature }) =>
          useFeatureTimelineCalculations({
            currentFeature: feature,
            startDate
          }),
        {
          initialProps: { feature: mockFeature }
        }
      )

      const firstTimeline = result.current.timeline

      const updatedFeature = { ...mockFeature, startMonth: 3 }
      rerender({ feature: updatedFeature })

      expect(result.current.timeline).not.toBe(firstTimeline)
      expect(result.current.timeline).toEqual({
        start: 'April 2024',
        end: 'July 2024'
      })
    })

    test('recalculates timeline when duration changes', () => {
      const startDate = new Date('2024-01-01')

      const { result, rerender } = renderHook(
        ({ feature }) =>
          useFeatureTimelineCalculations({
            currentFeature: feature,
            startDate
          }),
        {
          initialProps: { feature: mockFeature }
        }
      )

      const firstTimeline = result.current.timeline

      const updatedFeature = { ...mockFeature, duration: 6 }
      rerender({ feature: updatedFeature })

      expect(result.current.timeline).not.toBe(firstTimeline)
      expect(result.current.timeline).toEqual({
        start: 'January 2024',
        end: 'July 2024'
      })
    })

    test('recalculates timeline when startDate changes', () => {
      const { result, rerender } = renderHook(
        ({ startDate }) =>
          useFeatureTimelineCalculations({
            currentFeature: mockFeature,
            startDate
          }),
        {
          initialProps: { startDate: new Date('2024-01-01') }
        }
      )

      const firstTimeline = result.current.timeline

      rerender({ startDate: new Date('2025-01-01') })

      expect(result.current.timeline).not.toBe(firstTimeline)
      expect(result.current.timeline).toEqual({
        start: 'January 2025',
        end: 'April 2025'
      })
    })
  })

  describe('Edge cases and date handling', () => {
    test('handles leap year correctly', () => {
      const startDate = new Date('2024-01-31')
      const feature = { ...mockFeature, startMonth: 1, duration: 1 }

      const { result } = renderHook(() =>
        useFeatureTimelineCalculations({
          currentFeature: feature,
          startDate
        })
      )

      // Should handle end of month correctly
      expect(result.current.timeline?.start).toContain('2024')
      expect(result.current.timeline?.end).toContain('2024')
    })

    test('handles last day of month correctly', () => {
      const startDate = new Date('2024-01-31')
      const feature = { ...mockFeature, startMonth: 0, duration: 1 }

      const { result } = renderHook(() =>
        useFeatureTimelineCalculations({
          currentFeature: feature,
          startDate
        })
      )

      expect(result.current.timeline).toEqual({
        start: 'January 2024',
        end: 'February 2024'
      })
    })

    test('handles maximum valid startMonth', () => {
      const startDate = new Date('2024-01-01')
      const feature = { ...mockFeature, startMonth: 23, duration: 1 }

      const { result } = renderHook(() =>
        useFeatureTimelineCalculations({
          currentFeature: feature,
          startDate
        })
      )

      expect(result.current.timeline).toEqual({
        start: 'December 2025',
        end: 'January 2026'
      })
    })

    test('calculates correctly with startDate in middle of year', () => {
      const startDate = new Date('2024-06-15')
      const feature = { ...mockFeature, startMonth: 2, duration: 4 }

      const { result } = renderHook(() =>
        useFeatureTimelineCalculations({
          currentFeature: feature,
          startDate
        })
      )

      expect(result.current.timeline).toEqual({
        start: 'August 2024',
        end: 'December 2024'
      })
    })

    test('handles very long duration correctly', () => {
      const startDate = new Date('2024-01-01')
      const feature = { ...mockFeature, startMonth: 0, duration: 12 }

      const { result } = renderHook(() =>
        useFeatureTimelineCalculations({
          currentFeature: feature,
          startDate
        })
      )

      expect(result.current.timeline).toEqual({
        start: 'January 2024',
        end: 'January 2025'
      })
    })

    test('handles feature with only required fields', () => {
      const minimalFeature: FeatureDetail = {
        id: 'minimal',
        title: 'Minimal',
        startMonth: 0,
        duration: 1,
        team: 'TEAM',
        priority: 'low',
        status: 'planned'
      }

      const startDate = new Date('2024-01-01')

      const { result } = renderHook(() =>
        useFeatureTimelineCalculations({
          currentFeature: minimalFeature,
          startDate
        })
      )

      expect(result.current.timeline).toEqual({
        start: 'January 2024',
        end: 'February 2024'
      })
    })
  })

  describe('Date formatting', () => {
    test('formats dates with correct month and year', () => {
      const startDate = new Date('2024-01-01')

      const { result } = renderHook(() =>
        useFeatureTimelineCalculations({
          currentFeature: mockFeature,
          startDate
        })
      )

      // Verify format is "Month Year"
      expect(result.current.timeline?.start).toMatch(/^[A-Z][a-z]+ \d{4}$/)
      expect(result.current.timeline?.end).toMatch(/^[A-Z][a-z]+ \d{4}$/)
    })

    test('uses en-US locale for formatting', () => {
      const startDate = new Date('2024-03-01')
      const feature = { ...mockFeature, startMonth: 0, duration: 1 }

      const { result } = renderHook(() =>
        useFeatureTimelineCalculations({
          currentFeature: feature,
          startDate
        })
      )

      // March should be formatted as "March" not abbreviated
      expect(result.current.timeline?.start).toBe('March 2024')
    })
  })
})