import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFeatureDragDrop } from '../useFeatureDragDrop'
import { RoadmapFeature } from '../useTimelineFeatures'

// Mock DataTransfer for drag and drop tests
Object.defineProperty(window, 'DataTransfer', {
  writable: true,
  value: class DataTransfer {
    effectAllowed = 'none'
    dropEffect = 'none'
    files = []
    items = []
    types = []
    getData() { return '' }
    setData() {}
    clearData() {}
    setDragImage() {}
  }
})

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

describe('useFeatureDragDrop', () => {
  const mockOnFeaturesChange = vi.fn()
  const mockSetFeatures = vi.fn()
  const timelineDuration = 12

  const defaultParams = {
    features: mockFeatures,
    onFeaturesChange: mockOnFeaturesChange,
    timelineDuration,
    setFeatures: mockSetFeatures
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('initialization', () => {
    it('should initialize with null draggedFeature', () => {
      const { result } = renderHook(() => useFeatureDragDrop(defaultParams))

      expect(result.current.draggedFeature).toBeNull()
    })

    it('should provide all required handlers', () => {
      const { result } = renderHook(() => useFeatureDragDrop(defaultParams))

      expect(typeof result.current.handleDragStart).toBe('function')
      expect(typeof result.current.handleDragOver).toBe('function')
      expect(typeof result.current.handleDrop).toBe('function')
      expect(typeof result.current.createDropHandler).toBe('function')
    })
  })

  describe('drag start functionality', () => {
    it('should handle drag start correctly', () => {
      const { result } = renderHook(() => useFeatureDragDrop(defaultParams))

      const mockEvent = {
        dataTransfer: new DataTransfer()
      } as React.DragEvent

      act(() => {
        result.current.handleDragStart(mockEvent, mockFeatures[0])
      })

      expect(result.current.draggedFeature).toEqual(mockFeatures[0])
      expect(mockEvent.dataTransfer.effectAllowed).toBe('move')
    })

    it('should update draggedFeature when different feature is dragged', () => {
      const { result } = renderHook(() => useFeatureDragDrop(defaultParams))

      const mockEvent = {
        dataTransfer: new DataTransfer()
      } as React.DragEvent

      act(() => {
        result.current.handleDragStart(mockEvent, mockFeatures[0])
      })

      expect(result.current.draggedFeature).toEqual(mockFeatures[0])

      act(() => {
        result.current.handleDragStart(mockEvent, mockFeatures[1])
      })

      expect(result.current.draggedFeature).toEqual(mockFeatures[1])
    })
  })

  describe('drag over functionality', () => {
    it('should handle drag over correctly', () => {
      const { result } = renderHook(() => useFeatureDragDrop(defaultParams))

      const mockEvent = {
        preventDefault: vi.fn(),
        dataTransfer: new DataTransfer()
      } as unknown as React.DragEvent

      act(() => {
        result.current.handleDragOver(mockEvent)
      })

      expect(mockEvent.preventDefault).toHaveBeenCalled()
      expect(mockEvent.dataTransfer.dropEffect).toBe('move')
    })
  })

  describe('drop functionality', () => {
    it('should handle drop correctly when feature is being dragged', () => {
      const { result } = renderHook(() => useFeatureDragDrop(defaultParams))

      const mockDragEvent = {
        dataTransfer: new DataTransfer()
      } as React.DragEvent

      const mockDropEvent = {
        preventDefault: vi.fn()
      } as unknown as React.DragEvent

      // Start dragging a feature
      act(() => {
        result.current.handleDragStart(mockDragEvent, mockFeatures[0])
      })

      // Drop it on a new team and month
      act(() => {
        result.current.handleDrop(mockDropEvent, 'new-team', 5)
      })

      expect(mockDropEvent.preventDefault).toHaveBeenCalled()
      expect(mockSetFeatures).toHaveBeenCalledWith([
        {
          ...mockFeatures[0],
          team: 'new-team',
          startMonth: 5
        },
        mockFeatures[1]
      ])
      expect(mockOnFeaturesChange).toHaveBeenCalledWith([
        {
          ...mockFeatures[0],
          team: 'new-team',
          startMonth: 5
        },
        mockFeatures[1]
      ])
      expect(result.current.draggedFeature).toBeNull()
    })

    it('should do nothing when no feature is being dragged', () => {
      const { result } = renderHook(() => useFeatureDragDrop(defaultParams))

      const mockDropEvent = {
        preventDefault: vi.fn()
      } as unknown as React.DragEvent

      act(() => {
        result.current.handleDrop(mockDropEvent, 'new-team', 5)
      })

      expect(mockDropEvent.preventDefault).toHaveBeenCalled()
      expect(mockSetFeatures).not.toHaveBeenCalled()
      expect(mockOnFeaturesChange).not.toHaveBeenCalled()
    })

    it('should handle missing onFeaturesChange callback', () => {
      const { result } = renderHook(() => useFeatureDragDrop({
        ...defaultParams,
        onFeaturesChange: undefined
      }))

      const mockDragEvent = {
        dataTransfer: new DataTransfer()
      } as React.DragEvent

      const mockDropEvent = {
        preventDefault: vi.fn()
      } as unknown as React.DragEvent

      act(() => {
        result.current.handleDragStart(mockDragEvent, mockFeatures[0])
      })

      expect(() => {
        act(() => {
          result.current.handleDrop(mockDropEvent, 'new-team', 5)
        })
      }).not.toThrow()

      expect(mockSetFeatures).toHaveBeenCalled()
    })
  })

  describe('createDropHandler functionality', () => {
    it('should create a drop handler with correct month calculation', () => {
      const { result } = renderHook(() => useFeatureDragDrop(defaultParams))

      const mockDragEvent = {
        dataTransfer: new DataTransfer()
      } as React.DragEvent

      // Start dragging first
      act(() => {
        result.current.handleDragStart(mockDragEvent, mockFeatures[0])
      })

      // Create drop handler after dragging starts
      const dropHandler = result.current.createDropHandler('target-team', 12)

      // Mock the drop event with positioning
      const mockDropEvent = {
        preventDefault: vi.fn(),
        clientX: 300,
        currentTarget: {
          getBoundingClientRect: () => ({
            left: 0,
            width: 1200 // 12 months * 100px each
          })
        }
      } as unknown as React.DragEvent

      // Use the created drop handler
      act(() => {
        dropHandler(mockDropEvent)
      })

      // Month calculation: clientX (300) / monthWidth (100) = 3
      expect(mockSetFeatures).toHaveBeenCalledWith([
        {
          ...mockFeatures[0],
          team: 'target-team',
          startMonth: 3
        },
        mockFeatures[1]
      ])
    })

    it('should handle edge case month calculations', () => {
      const { result } = renderHook(() => useFeatureDragDrop(defaultParams))

      const mockDragEvent = {
        dataTransfer: new DataTransfer()
      } as React.DragEvent

      // Start dragging first
      act(() => {
        result.current.handleDragStart(mockDragEvent, mockFeatures[0])
      })

      // Create drop handler after dragging starts
      const dropHandler = result.current.createDropHandler('target-team', 6)

      const mockDropEvent = {
        preventDefault: vi.fn(),
        clientX: 25, // Quarter way through first month
        currentTarget: {
          getBoundingClientRect: () => ({
            left: 0,
            width: 600 // 6 months * 100px each
          })
        }
      } as unknown as React.DragEvent

      act(() => {
        dropHandler(mockDropEvent)
      })

      // Month calculation: Math.floor(25 / 100) = 0
      expect(mockSetFeatures).toHaveBeenCalledWith([
        {
          ...mockFeatures[0],
          team: 'target-team',
          startMonth: 0
        },
        mockFeatures[1]
      ])
    })
  })

  describe('edge cases', () => {
    it('should handle dropping feature with same team and month', () => {
      const { result } = renderHook(() => useFeatureDragDrop(defaultParams))

      const mockDragEvent = {
        dataTransfer: new DataTransfer()
      } as React.DragEvent

      const mockDropEvent = {
        preventDefault: vi.fn()
      } as unknown as React.DragEvent

      act(() => {
        result.current.handleDragStart(mockDragEvent, mockFeatures[0])
      })

      // Drop on same team and month
      act(() => {
        result.current.handleDrop(mockDropEvent, 'platform', 0)
      })

      expect(mockSetFeatures).toHaveBeenCalledWith([
        {
          ...mockFeatures[0],
          team: 'platform',
          startMonth: 0
        },
        mockFeatures[1]
      ])
    })

    it('should handle multiple drag operations in sequence', () => {
      const { result } = renderHook(() => useFeatureDragDrop(defaultParams))

      const mockEvent = {
        dataTransfer: new DataTransfer()
      } as React.DragEvent

      const mockDropEvent = {
        preventDefault: vi.fn()
      } as unknown as React.DragEvent

      // First drag operation
      act(() => {
        result.current.handleDragStart(mockEvent, mockFeatures[0])
      })

      act(() => {
        result.current.handleDrop(mockDropEvent, 'team-1', 1)
      })

      expect(result.current.draggedFeature).toBeNull()

      // Second drag operation
      act(() => {
        result.current.handleDragStart(mockEvent, mockFeatures[1])
      })

      expect(result.current.draggedFeature).toEqual(mockFeatures[1])

      act(() => {
        result.current.handleDrop(mockDropEvent, 'team-2', 2)
      })

      expect(result.current.draggedFeature).toBeNull()
      expect(mockSetFeatures).toHaveBeenCalledTimes(2)
    })
  })
})