import { describe, test, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useFeatureValidation } from '../useFeatureValidation'
import type { FeatureDetail } from '../useFeatureModalState'

describe('useFeatureValidation', () => {
  const validFeature: FeatureDetail = {
    id: 'test-feature-1',
    title: 'Valid Feature Title',
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

  describe('Overall validation - isValid', () => {
    test('returns true for valid feature', () => {
      const { result } = renderHook(() =>
        useFeatureValidation({
          editedFeature: validFeature
        })
      )

      expect(result.current.isValid).toBe(true)
      expect(result.current.errors).toHaveLength(0)
    })

    test('returns false when editedFeature is null', () => {
      const { result } = renderHook(() =>
        useFeatureValidation({
          editedFeature: null
        })
      )

      expect(result.current.isValid).toBe(false)
      expect(result.current.errors).toHaveLength(1)
      expect(result.current.errors[0]).toEqual({
        field: 'general',
        message: 'No feature data provided'
      })
    })

    test('returns false when multiple fields are invalid', () => {
      const invalidFeature = {
        ...validFeature,
        title: '',
        duration: 0,
        startMonth: -1,
        team: '',
        priority: 'invalid' as any
      }

      const { result } = renderHook(() =>
        useFeatureValidation({
          editedFeature: invalidFeature
        })
      )

      expect(result.current.isValid).toBe(false)
      expect(result.current.errors.length).toBeGreaterThan(1)
    })
  })

  describe('Title validation', () => {
    test('validates title correctly for valid title', () => {
      const { result } = renderHook(() =>
        useFeatureValidation({
          editedFeature: validFeature
        })
      )

      expect(result.current.isTitleValid).toBe(true)
      expect(result.current.validateTitle('Valid Title')).toBe(true)
    })

    test('rejects empty title', () => {
      const { result } = renderHook(() =>
        useFeatureValidation({
          editedFeature: { ...validFeature, title: '' }
        })
      )

      expect(result.current.isTitleValid).toBe(false)
      expect(result.current.fieldErrors.title).toBe('Title is required')
      expect(result.current.validateTitle('')).toBe(false)
    })

    test('rejects whitespace-only title', () => {
      const { result } = renderHook(() =>
        useFeatureValidation({
          editedFeature: { ...validFeature, title: '   ' }
        })
      )

      expect(result.current.isTitleValid).toBe(false)
      expect(result.current.fieldErrors.title).toBe('Title is required')
      expect(result.current.validateTitle('   ')).toBe(false)
    })

    test('rejects title longer than 100 characters', () => {
      const longTitle = 'a'.repeat(101)

      const { result } = renderHook(() =>
        useFeatureValidation({
          editedFeature: { ...validFeature, title: longTitle }
        })
      )

      expect(result.current.isTitleValid).toBe(false)
      expect(result.current.fieldErrors.title).toBe('Title must be 100 characters or less')
      expect(result.current.validateTitle(longTitle)).toBe(false)
    })

    test('accepts title exactly 100 characters', () => {
      const maxTitle = 'a'.repeat(100)

      const { result } = renderHook(() =>
        useFeatureValidation({
          editedFeature: { ...validFeature, title: maxTitle }
        })
      )

      expect(result.current.isTitleValid).toBe(true)
      expect(result.current.validateTitle(maxTitle)).toBe(true)
    })

    test('accepts title with leading/trailing whitespace if content is valid', () => {
      const { result } = renderHook(() =>
        useFeatureValidation({
          editedFeature: { ...validFeature, title: '  Valid Title  ' }
        })
      )

      expect(result.current.isTitleValid).toBe(true)
      expect(result.current.validateTitle('  Valid Title  ')).toBe(true)
    })
  })

  describe('Duration validation', () => {
    test('validates duration correctly for valid duration', () => {
      const { result } = renderHook(() =>
        useFeatureValidation({
          editedFeature: validFeature
        })
      )

      expect(result.current.isDurationValid).toBe(true)
      expect(result.current.validateDuration(3)).toBe(true)
    })

    test('rejects duration less than 1', () => {
      const { result } = renderHook(() =>
        useFeatureValidation({
          editedFeature: { ...validFeature, duration: 0 }
        })
      )

      expect(result.current.isDurationValid).toBe(false)
      expect(result.current.fieldErrors.duration).toBe('Duration must be at least 1 month')
      expect(result.current.validateDuration(0)).toBe(false)
    })

    test('rejects negative duration', () => {
      const { result } = renderHook(() =>
        useFeatureValidation({
          editedFeature: { ...validFeature, duration: -1 }
        })
      )

      expect(result.current.isDurationValid).toBe(false)
      expect(result.current.fieldErrors.duration).toBe('Duration must be at least 1 month')
      expect(result.current.validateDuration(-1)).toBe(false)
    })

    test('rejects duration greater than 12', () => {
      const { result } = renderHook(() =>
        useFeatureValidation({
          editedFeature: { ...validFeature, duration: 13 }
        })
      )

      expect(result.current.isDurationValid).toBe(false)
      expect(result.current.fieldErrors.duration).toBe('Duration cannot exceed 12 months')
      expect(result.current.validateDuration(13)).toBe(false)
    })

    test('accepts duration exactly 1', () => {
      const { result } = renderHook(() =>
        useFeatureValidation({
          editedFeature: { ...validFeature, duration: 1 }
        })
      )

      expect(result.current.isDurationValid).toBe(true)
      expect(result.current.validateDuration(1)).toBe(true)
    })

    test('accepts duration exactly 12', () => {
      const { result } = renderHook(() =>
        useFeatureValidation({
          editedFeature: { ...validFeature, duration: 12 }
        })
      )

      expect(result.current.isDurationValid).toBe(true)
      expect(result.current.validateDuration(12)).toBe(true)
    })

    test('rejects non-integer duration', () => {
      const { result } = renderHook(() =>
        useFeatureValidation({
          editedFeature: { ...validFeature, duration: 3.5 }
        })
      )

      expect(result.current.isDurationValid).toBe(false)
      expect(result.current.fieldErrors.duration).toBe('Duration must be a whole number')
      expect(result.current.validateDuration(3.5)).toBe(false)
    })

    test('rejects floating point duration', () => {
      expect(renderHook(() =>
        useFeatureValidation({
          editedFeature: { ...validFeature, duration: 5.99 }
        })
      ).result.current.isDurationValid).toBe(false)
    })
  })

  describe('Start Month validation', () => {
    test('validates startMonth correctly for valid startMonth', () => {
      const { result } = renderHook(() =>
        useFeatureValidation({
          editedFeature: validFeature
        })
      )

      expect(result.current.isStartMonthValid).toBe(true)
      expect(result.current.validateStartMonth(0)).toBe(true)
    })

    test('accepts startMonth 0', () => {
      const { result } = renderHook(() =>
        useFeatureValidation({
          editedFeature: { ...validFeature, startMonth: 0 }
        })
      )

      expect(result.current.isStartMonthValid).toBe(true)
      expect(result.current.validateStartMonth(0)).toBe(true)
    })

    test('accepts startMonth 23', () => {
      const { result } = renderHook(() =>
        useFeatureValidation({
          editedFeature: { ...validFeature, startMonth: 23 }
        })
      )

      expect(result.current.isStartMonthValid).toBe(true)
      expect(result.current.validateStartMonth(23)).toBe(true)
    })

    test('rejects negative startMonth', () => {
      const { result } = renderHook(() =>
        useFeatureValidation({
          editedFeature: { ...validFeature, startMonth: -1 }
        })
      )

      expect(result.current.isStartMonthValid).toBe(false)
      expect(result.current.fieldErrors.startMonth).toBe('Start month cannot be negative')
      expect(result.current.validateStartMonth(-1)).toBe(false)
    })

    test('rejects startMonth greater than 23', () => {
      const { result } = renderHook(() =>
        useFeatureValidation({
          editedFeature: { ...validFeature, startMonth: 24 }
        })
      )

      expect(result.current.isStartMonthValid).toBe(false)
      expect(result.current.fieldErrors.startMonth).toBe('Start month cannot be more than 24 months in the future')
      expect(result.current.validateStartMonth(24)).toBe(false)
    })

    test('rejects non-integer startMonth', () => {
      const { result } = renderHook(() =>
        useFeatureValidation({
          editedFeature: { ...validFeature, startMonth: 5.5 }
        })
      )

      expect(result.current.isStartMonthValid).toBe(false)
      expect(result.current.fieldErrors.startMonth).toBe('Start month must be a whole number')
      expect(result.current.validateStartMonth(5.5)).toBe(false)
    })
  })

  describe('Team validation', () => {
    test('accepts valid team', () => {
      const { result } = renderHook(() =>
        useFeatureValidation({
          editedFeature: validFeature
        })
      )

      expect(result.current.isValid).toBe(true)
      expect(result.current.fieldErrors.team).toBeUndefined()
    })

    test('rejects empty team', () => {
      const { result } = renderHook(() =>
        useFeatureValidation({
          editedFeature: { ...validFeature, team: '' }
        })
      )

      expect(result.current.isValid).toBe(false)
      expect(result.current.fieldErrors.team).toBe('Team is required')
    })

    test('rejects whitespace-only team', () => {
      const { result } = renderHook(() =>
        useFeatureValidation({
          editedFeature: { ...validFeature, team: '   ' }
        })
      )

      expect(result.current.isValid).toBe(false)
      expect(result.current.fieldErrors.team).toBe('Team is required')
    })
  })

  describe('Priority validation', () => {
    test('accepts high priority', () => {
      const { result } = renderHook(() =>
        useFeatureValidation({
          editedFeature: { ...validFeature, priority: 'high' }
        })
      )

      expect(result.current.isValid).toBe(true)
      expect(result.current.fieldErrors.priority).toBeUndefined()
    })

    test('accepts medium priority', () => {
      const { result } = renderHook(() =>
        useFeatureValidation({
          editedFeature: { ...validFeature, priority: 'medium' }
        })
      )

      expect(result.current.isValid).toBe(true)
      expect(result.current.fieldErrors.priority).toBeUndefined()
    })

    test('accepts low priority', () => {
      const { result } = renderHook(() =>
        useFeatureValidation({
          editedFeature: { ...validFeature, priority: 'low' }
        })
      )

      expect(result.current.isValid).toBe(true)
      expect(result.current.fieldErrors.priority).toBeUndefined()
    })

    test('rejects invalid priority', () => {
      const { result } = renderHook(() =>
        useFeatureValidation({
          editedFeature: { ...validFeature, priority: 'critical' as any }
        })
      )

      expect(result.current.isValid).toBe(false)
      expect(result.current.fieldErrors.priority).toBe('Priority must be high, medium, or low')
    })
  })

  describe('Status validation', () => {
    test('accepts planned status', () => {
      const { result } = renderHook(() =>
        useFeatureValidation({
          editedFeature: { ...validFeature, status: 'planned' }
        })
      )

      expect(result.current.isValid).toBe(true)
      expect(result.current.fieldErrors.status).toBeUndefined()
    })

    test('accepts in-progress status', () => {
      const { result } = renderHook(() =>
        useFeatureValidation({
          editedFeature: { ...validFeature, status: 'in-progress' }
        })
      )

      expect(result.current.isValid).toBe(true)
      expect(result.current.fieldErrors.status).toBeUndefined()
    })

    test('accepts completed status', () => {
      const { result } = renderHook(() =>
        useFeatureValidation({
          editedFeature: { ...validFeature, status: 'completed' }
        })
      )

      expect(result.current.isValid).toBe(true)
      expect(result.current.fieldErrors.status).toBeUndefined()
    })

    test('rejects invalid status', () => {
      const { result } = renderHook(() =>
        useFeatureValidation({
          editedFeature: { ...validFeature, status: 'archived' as any }
        })
      )

      expect(result.current.isValid).toBe(false)
      expect(result.current.fieldErrors.status).toBe('Status must be planned, in-progress, or completed')
    })
  })

  describe('Field errors map', () => {
    test('creates empty field errors map for valid feature', () => {
      const { result } = renderHook(() =>
        useFeatureValidation({
          editedFeature: validFeature
        })
      )

      expect(result.current.fieldErrors).toEqual({})
    })

    test('creates field errors map with all errors', () => {
      const invalidFeature = {
        ...validFeature,
        title: '',
        duration: 0,
        startMonth: -1,
        team: '',
        priority: 'invalid' as any,
        status: 'invalid' as any
      }

      const { result } = renderHook(() =>
        useFeatureValidation({
          editedFeature: invalidFeature
        })
      )

      expect(result.current.fieldErrors.title).toBeDefined()
      expect(result.current.fieldErrors.duration).toBeDefined()
      expect(result.current.fieldErrors.startMonth).toBeDefined()
      expect(result.current.fieldErrors.team).toBeDefined()
      expect(result.current.fieldErrors.priority).toBeDefined()
      expect(result.current.fieldErrors.status).toBeDefined()
    })

    test('allows easy field error lookup', () => {
      const { result } = renderHook(() =>
        useFeatureValidation({
          editedFeature: { ...validFeature, title: '' }
        })
      )

      expect(result.current.fieldErrors['title']).toBe('Title is required')
      expect(result.current.fieldErrors['duration']).toBeUndefined()
    })
  })

  describe('Memoization', () => {
    test('memoizes validation results when feature does not change', () => {
      const { result, rerender } = renderHook(() =>
        useFeatureValidation({
          editedFeature: validFeature
        })
      )

      const firstErrors = result.current.errors

      rerender()

      expect(result.current.errors).toBe(firstErrors)
    })

    test('recalculates when title changes', () => {
      const { result, rerender } = renderHook(
        ({ feature }) => useFeatureValidation({ editedFeature: feature }),
        {
          initialProps: { feature: validFeature }
        }
      )

      const firstIsValid = result.current.isValid

      rerender({ feature: { ...validFeature, title: '' } })

      expect(result.current.isValid).not.toBe(firstIsValid)
      expect(result.current.isValid).toBe(false)
    })

    test('recalculates when duration changes', () => {
      const { result, rerender } = renderHook(
        ({ feature }) => useFeatureValidation({ editedFeature: feature }),
        {
          initialProps: { feature: validFeature }
        }
      )

      expect(result.current.isDurationValid).toBe(true)

      rerender({ feature: { ...validFeature, duration: 0 } })

      expect(result.current.isDurationValid).toBe(false)
    })

    test('memoizes fieldErrors map', () => {
      const { result, rerender } = renderHook(() =>
        useFeatureValidation({
          editedFeature: validFeature
        })
      )

      const firstFieldErrors = result.current.fieldErrors

      rerender()

      expect(result.current.fieldErrors).toBe(firstFieldErrors)
    })
  })

  describe('Helper function stability', () => {
    test('validateTitle function is stable', () => {
      const { result, rerender } = renderHook(() =>
        useFeatureValidation({
          editedFeature: validFeature
        })
      )

      const firstValidateTitle = result.current.validateTitle

      rerender()

      expect(result.current.validateTitle).toBe(firstValidateTitle)
    })

    test('validateDuration function is stable', () => {
      const { result, rerender } = renderHook(() =>
        useFeatureValidation({
          editedFeature: validFeature
        })
      )

      const firstValidateDuration = result.current.validateDuration

      rerender()

      expect(result.current.validateDuration).toBe(firstValidateDuration)
    })

    test('validateStartMonth function is stable', () => {
      const { result, rerender } = renderHook(() =>
        useFeatureValidation({
          editedFeature: validFeature
        })
      )

      const firstValidateStartMonth = result.current.validateStartMonth

      rerender()

      expect(result.current.validateStartMonth).toBe(firstValidateStartMonth)
    })
  })

  describe('Edge cases', () => {
    test('handles feature with minimal properties', () => {
      const minimalFeature: FeatureDetail = {
        id: 'minimal',
        title: 'Minimal',
        startMonth: 0,
        duration: 1,
        team: 'TEAM',
        priority: 'low',
        status: 'planned'
      }

      const { result } = renderHook(() =>
        useFeatureValidation({
          editedFeature: minimalFeature
        })
      )

      expect(result.current.isValid).toBe(true)
    })

    test('validates all fields even when some are invalid', () => {
      const partiallyInvalidFeature = {
        ...validFeature,
        title: '',
        duration: 15
      }

      const { result } = renderHook(() =>
        useFeatureValidation({
          editedFeature: partiallyInvalidFeature
        })
      )

      // Should have errors for both title and duration
      expect(result.current.errors.length).toBeGreaterThanOrEqual(2)
      expect(result.current.fieldErrors.title).toBeDefined()
      expect(result.current.fieldErrors.duration).toBeDefined()
    })
  })
})