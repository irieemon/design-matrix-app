import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTimelineFeatures, RoadmapFeature } from '../useTimelineFeatures'

const mockFeatures: RoadmapFeature[] = [
  {
    id: 'feature-1',
    title: 'Test Feature 1',
    description: 'First test feature',
    startMonth: 0,
    duration: 2,
    team: 'platform',
    priority: 'high',
    status: 'in-progress'
  },
  {
    id: 'feature-2',
    title: 'Test Feature 2',
    description: 'Second test feature',
    startMonth: 2,
    duration: 1,
    team: 'web',
    priority: 'medium',
    status: 'planned'
  }
]

describe('useTimelineFeatures', () => {
  const mockOnFeaturesChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('initialization', () => {
    it('should initialize with provided features', () => {
      const { result } = renderHook(() =>
        useTimelineFeatures({
          initialFeatures: mockFeatures,
          onFeaturesChange: mockOnFeaturesChange
        })
      )

      expect(result.current.features).toEqual(mockFeatures)
      expect(result.current.selectedFeature).toBeNull()
      expect(result.current.isModalOpen).toBe(false)
      expect(result.current.isExportModalOpen).toBe(false)
    })

    it('should initialize with empty features array', () => {
      const { result } = renderHook(() =>
        useTimelineFeatures({
          initialFeatures: [],
          onFeaturesChange: mockOnFeaturesChange
        })
      )

      expect(result.current.features).toEqual([])
    })
  })

  describe('feature synchronization', () => {
    it('should update features when initialFeatures change', () => {
      const { result, rerender } = renderHook(
        ({ initialFeatures }) =>
          useTimelineFeatures({
            initialFeatures,
            onFeaturesChange: mockOnFeaturesChange
          }),
        { initialProps: { initialFeatures: mockFeatures } }
      )

      expect(result.current.features).toEqual(mockFeatures)

      const newFeatures = [mockFeatures[0]]
      rerender({ initialFeatures: newFeatures })

      expect(result.current.features).toEqual(newFeatures)
    })

    it('should not update features when user is dragging', () => {
      const { result, rerender } = renderHook(
        ({ initialFeatures, draggedFeature }) =>
          useTimelineFeatures({
            initialFeatures,
            onFeaturesChange: mockOnFeaturesChange,
            draggedFeature
          }),
        {
          initialProps: {
            initialFeatures: mockFeatures,
            draggedFeature: mockFeatures[0]
          }
        }
      )

      const newFeatures = [mockFeatures[0]]
      rerender({ initialFeatures: newFeatures, draggedFeature: mockFeatures[0] })

      // Should not update because user is dragging
      expect(result.current.features).toEqual(mockFeatures)
    })

    it('should not update features when user is resizing', () => {
      const { result, rerender } = renderHook(
        ({ initialFeatures, isResizing }) =>
          useTimelineFeatures({
            initialFeatures,
            onFeaturesChange: mockOnFeaturesChange,
            isResizing
          }),
        {
          initialProps: {
            initialFeatures: mockFeatures,
            isResizing: 'feature-1'
          }
        }
      )

      const newFeatures = [mockFeatures[0]]
      rerender({ initialFeatures: newFeatures, isResizing: 'feature-1' })

      // Should not update because user is resizing
      expect(result.current.features).toEqual(mockFeatures)
    })
  })

  describe('feature management', () => {
    it('should handle feature click', () => {
      const { result } = renderHook(() =>
        useTimelineFeatures({
          initialFeatures: mockFeatures,
          onFeaturesChange: mockOnFeaturesChange
        })
      )

      act(() => {
        result.current.handleFeatureClick(mockFeatures[0])
      })

      expect(result.current.selectedFeature).toEqual(mockFeatures[0])
      expect(result.current.isModalOpen).toBe(true)
    })

    it('should handle close modal', () => {
      const { result } = renderHook(() =>
        useTimelineFeatures({
          initialFeatures: mockFeatures,
          onFeaturesChange: mockOnFeaturesChange
        })
      )

      // First open modal
      act(() => {
        result.current.handleFeatureClick(mockFeatures[0])
      })

      expect(result.current.isModalOpen).toBe(true)
      expect(result.current.selectedFeature).toEqual(mockFeatures[0])

      // Then close it
      act(() => {
        result.current.handleCloseModal()
      })

      expect(result.current.isModalOpen).toBe(false)
      expect(result.current.selectedFeature).toBeNull()
    })

    it('should handle create feature', () => {
      const { result } = renderHook(() =>
        useTimelineFeatures({
          initialFeatures: mockFeatures,
          onFeaturesChange: mockOnFeaturesChange
        })
      )

      act(() => {
        result.current.handleCreateFeature()
      })

      expect(result.current.selectedFeature).toBeNull()
      expect(result.current.isModalOpen).toBe(true)
    })
  })

  describe('feature CRUD operations', () => {
    it('should save new feature with temp ID', () => {
      const { result } = renderHook(() =>
        useTimelineFeatures({
          initialFeatures: mockFeatures,
          onFeaturesChange: mockOnFeaturesChange
        })
      )

      const newFeature: RoadmapFeature = {
        id: 'temp-123',
        title: 'New Feature',
        startMonth: 3,
        duration: 1,
        team: 'platform',
        priority: 'low',
        status: 'planned'
      }

      act(() => {
        result.current.handleSaveFeature(newFeature)
      })

      // Should add new feature with generated ID
      expect(result.current.features).toHaveLength(3)
      expect(result.current.features[2].title).toBe('New Feature')
      expect(result.current.features[2].id).toMatch(/^feature-\d+/)

      // Should call onFeaturesChange
      expect(mockOnFeaturesChange).toHaveBeenCalledTimes(1)
    })

    it('should update existing feature', () => {
      const { result } = renderHook(() =>
        useTimelineFeatures({
          initialFeatures: mockFeatures,
          onFeaturesChange: mockOnFeaturesChange
        })
      )

      const updatedFeature: RoadmapFeature = {
        ...mockFeatures[0],
        title: 'Updated Feature Title'
      }

      act(() => {
        result.current.handleSaveFeature(updatedFeature)
      })

      // Should update existing feature
      expect(result.current.features).toHaveLength(2)
      expect(result.current.features[0].title).toBe('Updated Feature Title')
      expect(result.current.features[0].id).toBe('feature-1')

      // Should call onFeaturesChange
      expect(mockOnFeaturesChange).toHaveBeenCalledTimes(1)
    })

    it('should delete feature', () => {
      const { result } = renderHook(() =>
        useTimelineFeatures({
          initialFeatures: mockFeatures,
          onFeaturesChange: mockOnFeaturesChange
        })
      )

      act(() => {
        result.current.handleDeleteFeature('feature-1')
      })

      // Should remove feature
      expect(result.current.features).toHaveLength(1)
      expect(result.current.features[0].id).toBe('feature-2')

      // Should call onFeaturesChange
      expect(mockOnFeaturesChange).toHaveBeenCalledTimes(1)
    })
  })

  describe('export modal', () => {
    it('should handle export modal state', () => {
      const { result } = renderHook(() =>
        useTimelineFeatures({
          initialFeatures: mockFeatures,
          onFeaturesChange: mockOnFeaturesChange
        })
      )

      expect(result.current.isExportModalOpen).toBe(false)

      act(() => {
        result.current.setIsExportModalOpen(true)
      })

      expect(result.current.isExportModalOpen).toBe(true)

      act(() => {
        result.current.setIsExportModalOpen(false)
      })

      expect(result.current.isExportModalOpen).toBe(false)
    })
  })

  describe('sample data loading', () => {
    it('should provide handleLoadSampleData function', () => {
      const { result } = renderHook(() =>
        useTimelineFeatures({
          initialFeatures: [],
          onFeaturesChange: mockOnFeaturesChange,
          projectType: 'marketing'
        })
      )

      expect(typeof result.current.handleLoadSampleData).toBe('function')

      // Test that calling the function doesn't throw
      expect(() => {
        result.current.handleLoadSampleData()
      }).not.toThrow()
    })
  })

  describe('internal state access', () => {
    it('should provide setFeatures for other hooks', () => {
      const { result } = renderHook(() =>
        useTimelineFeatures({
          initialFeatures: mockFeatures,
          onFeaturesChange: mockOnFeaturesChange
        })
      )

      expect(typeof result.current.setFeatures).toBe('function')

      const newFeatures = [mockFeatures[0]]

      act(() => {
        result.current.setFeatures(newFeatures)
      })

      expect(result.current.features).toEqual(newFeatures)
    })
  })

  describe('edge cases', () => {
    it('should handle missing onFeaturesChange callback', () => {
      const { result } = renderHook(() =>
        useTimelineFeatures({
          initialFeatures: mockFeatures
          // No onFeaturesChange provided
        })
      )

      expect(() => {
        act(() => {
          result.current.handleSaveFeature({
            ...mockFeatures[0],
            title: 'Updated'
          })
        })
      }).not.toThrow()
    })

    it('should handle feature save with missing properties', () => {
      const { result } = renderHook(() =>
        useTimelineFeatures({
          initialFeatures: mockFeatures,
          onFeaturesChange: mockOnFeaturesChange
        })
      )

      const minimalFeature: RoadmapFeature = {
        id: 'temp-minimal',
        title: 'Minimal Feature',
        startMonth: 0,
        duration: 1,
        team: 'platform',
        priority: 'medium',
        status: 'planned'
      }

      expect(() => {
        act(() => {
          result.current.handleSaveFeature(minimalFeature)
        })
      }).not.toThrow()

      expect(result.current.features).toHaveLength(3)
    })
  })
})