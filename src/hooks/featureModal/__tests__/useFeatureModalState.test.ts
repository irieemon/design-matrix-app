import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFeatureModalState } from '../useFeatureModalState'
import type { FeatureDetail } from '../useFeatureModalState'

const mockFeature: FeatureDetail = {
  id: 'feature-1',
  title: 'Test Feature',
  description: 'A test feature',
  startMonth: 0,
  duration: 2,
  team: 'platform',
  priority: 'high',
  status: 'in-progress',
  userStories: ['Test user story'],
  deliverables: ['Test deliverable'],
  relatedIdeas: ['Test idea'],
  risks: ['Test risk'],
  successCriteria: ['Test criteria'],
  complexity: 'medium'
}

const defaultParams = {
  feature: mockFeature,
  mode: 'view' as const,
  availableTeams: ['platform', 'web', 'mobile']
}

describe('useFeatureModalState', () => {
  beforeEach(() => {
    // Reset any mocks if needed
  })

  describe('initialization', () => {
    it('should initialize correctly in view mode', () => {
      const { result } = renderHook(() => useFeatureModalState(defaultParams))

      expect(result.current.editMode).toBe(false)
      expect(result.current.showDeleteConfirm).toBe(false)
      expect(result.current.editedFeature).toEqual(mockFeature)
      expect(result.current.currentFeature).toEqual(mockFeature)
    })

    it('should initialize correctly in edit mode', () => {
      const { result } = renderHook(() => useFeatureModalState({
        ...defaultParams,
        mode: 'edit'
      }))

      expect(result.current.editMode).toBe(true)
      expect(result.current.editedFeature).toEqual(mockFeature)
      expect(result.current.currentFeature).toEqual(mockFeature)
    })

    it('should initialize correctly in create mode with null feature', () => {
      const { result } = renderHook(() => useFeatureModalState({
        ...defaultParams,
        feature: null,
        mode: 'create'
      }))

      expect(result.current.editMode).toBe(true)
      expect(result.current.editedFeature).toEqual(
        expect.objectContaining({
          title: '',
          description: '',
          startMonth: 0,
          duration: 1,
          team: 'platform',
          priority: 'medium',
          status: 'planned',
          complexity: 'medium'
        })
      )
      expect(result.current.editedFeature?.id).toMatch(/^temp-\d+/)
    })

    it('should use first available team when creating new feature', () => {
      const { result } = renderHook(() => useFeatureModalState({
        feature: null,
        mode: 'create',
        availableTeams: ['web', 'mobile', 'platform']
      }))

      expect(result.current.editedFeature?.team).toBe('web')
    })

    it('should handle empty teams array gracefully', () => {
      const { result } = renderHook(() => useFeatureModalState({
        feature: null,
        mode: 'create',
        availableTeams: []
      }))

      expect(result.current.editedFeature?.team).toBe('PLATFORM')
    })
  })

  describe('state updates', () => {
    it('should update edit mode', () => {
      const { result } = renderHook(() => useFeatureModalState(defaultParams))

      expect(result.current.editMode).toBe(false)

      act(() => {
        result.current.setEditMode(true)
      })

      expect(result.current.editMode).toBe(true)
    })

    it('should update delete confirmation state', () => {
      const { result } = renderHook(() => useFeatureModalState(defaultParams))

      expect(result.current.showDeleteConfirm).toBe(false)

      act(() => {
        result.current.setShowDeleteConfirm(true)
      })

      expect(result.current.showDeleteConfirm).toBe(true)
    })

    it('should update edited feature directly', () => {
      const { result } = renderHook(() => useFeatureModalState(defaultParams))

      const newFeature = { ...mockFeature, title: 'Updated Title' }

      act(() => {
        result.current.setEditedFeature(newFeature)
      })

      expect(result.current.editedFeature?.title).toBe('Updated Title')
      expect(result.current.currentFeature?.title).toBe('Updated Title')
    })
  })

  describe('updateFeature helper', () => {
    it('should update feature properties', () => {
      const { result } = renderHook(() => useFeatureModalState({
        ...defaultParams,
        mode: 'edit'
      }))

      act(() => {
        result.current.updateFeature({ title: 'New Title' })
      })

      expect(result.current.editedFeature?.title).toBe('New Title')
      expect(result.current.editedFeature?.description).toBe('A test feature') // Other props unchanged
    })

    it('should update multiple properties at once', () => {
      const { result } = renderHook(() => useFeatureModalState({
        ...defaultParams,
        mode: 'edit'
      }))

      act(() => {
        result.current.updateFeature({
          title: 'New Title',
          priority: 'low',
          duration: 5
        })
      })

      expect(result.current.editedFeature).toEqual(
        expect.objectContaining({
          title: 'New Title',
          priority: 'low',
          duration: 5,
          description: 'A test feature' // Unchanged
        })
      )
    })

    it('should not update when editedFeature is null', () => {
      const { result } = renderHook(() => useFeatureModalState({
        feature: null,
        mode: 'view',
        availableTeams: ['platform']
      }))

      // editedFeature should be null in view mode with null feature
      expect(result.current.editedFeature).toBeNull()

      act(() => {
        result.current.updateFeature({ title: 'Should not update' })
      })

      expect(result.current.editedFeature).toBeNull()
    })

    it('should update array properties', () => {
      const { result } = renderHook(() => useFeatureModalState({
        ...defaultParams,
        mode: 'edit'
      }))

      const newUserStories = ['Story 1', 'Story 2']

      act(() => {
        result.current.updateFeature({ userStories: newUserStories })
      })

      expect(result.current.editedFeature?.userStories).toEqual(newUserStories)
    })
  })

  describe('currentFeature fallback', () => {
    it('should fallback to original feature when editedFeature is null', () => {
      const { result } = renderHook(() => useFeatureModalState({
        feature: mockFeature,
        mode: 'view',
        availableTeams: ['platform']
      }))

      // Manually set editedFeature to null
      act(() => {
        result.current.setEditedFeature(null)
      })

      expect(result.current.editedFeature).toBeNull()
      expect(result.current.currentFeature).toEqual(mockFeature)
    })

    it('should return null when both features are null', () => {
      const { result } = renderHook(() => useFeatureModalState({
        feature: null,
        mode: 'view',
        availableTeams: ['platform']
      }))

      expect(result.current.editedFeature).toBeNull()
      expect(result.current.currentFeature).toBeNull()
    })
  })

  describe('mode changes', () => {
    it('should update edit mode when mode prop changes', () => {
      const { result, rerender } = renderHook(
        ({ mode }) => useFeatureModalState({ ...defaultParams, mode }),
        { initialProps: { mode: 'view' as const } }
      )

      expect(result.current.editMode).toBe(false)

      rerender({ mode: 'edit' as const })

      expect(result.current.editMode).toBe(true)
    })

    it('should reinitialize feature when switching to create mode', () => {
      const { result, rerender } = renderHook(
        ({ mode, feature }) => useFeatureModalState({
          feature,
          mode,
          availableTeams: ['platform']
        }),
        {
          initialProps: {
            mode: 'view' as const,
            feature: mockFeature
          }
        }
      )

      expect(result.current.editedFeature?.title).toBe('Test Feature')

      rerender({ mode: 'create' as const, feature: null })

      expect(result.current.editedFeature?.title).toBe('')
      expect(result.current.editMode).toBe(true)
    })
  })

  describe('feature changes', () => {
    it('should update editedFeature when feature prop changes', () => {
      const newFeature = { ...mockFeature, title: 'Changed Feature' }

      const { result, rerender } = renderHook(
        ({ feature }) => useFeatureModalState({
          feature,
          mode: 'view',
          availableTeams: ['platform']
        }),
        { initialProps: { feature: mockFeature } }
      )

      expect(result.current.editedFeature?.title).toBe('Test Feature')

      rerender({ feature: newFeature })

      expect(result.current.editedFeature?.title).toBe('Changed Feature')
    })

    it('should handle switching from null to actual feature', () => {
      const { result, rerender } = renderHook(
        ({ feature }) => useFeatureModalState({
          feature,
          mode: 'view',
          availableTeams: ['platform']
        }),
        { initialProps: { feature: null } }
      )

      expect(result.current.editedFeature).toBeNull()

      rerender({ feature: mockFeature })

      expect(result.current.editedFeature).toEqual(mockFeature)
    })
  })

  describe('team availability changes', () => {
    it('should update default team when availableTeams changes in create mode', () => {
      const { result, rerender } = renderHook(
        ({ availableTeams }) => useFeatureModalState({
          feature: null,
          mode: 'create',
          availableTeams
        }),
        { initialProps: { availableTeams: ['platform'] } }
      )

      expect(result.current.editedFeature?.team).toBe('platform')

      rerender({ availableTeams: ['web', 'mobile'] })

      expect(result.current.editedFeature?.team).toBe('web')
    })
  })
})