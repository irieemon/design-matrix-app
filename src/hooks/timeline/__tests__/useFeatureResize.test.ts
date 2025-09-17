import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFeatureResize } from '../useFeatureResize'
import { RoadmapFeature } from '../useTimelineFeatures'

const mockFeatures: RoadmapFeature[] = [
  {
    id: 'feature-1',
    title: 'Test Feature 1',
    description: 'First test feature',
    startMonth: 2,
    duration: 3,
    team: 'platform',
    priority: 'high',
    status: 'in-progress'
  },
  {
    id: 'feature-2',
    title: 'Test Feature 2',
    description: 'Second test feature',
    startMonth: 6,
    duration: 2,
    team: 'web',
    priority: 'medium',
    status: 'planned'
  }
]

// Mock DOM APIs for resize functionality
const mockGetBoundingClientRect = vi.fn()

beforeEach(() => {
  // Mock getBoundingClientRect for timeline container
  mockGetBoundingClientRect.mockReturnValue({
    left: 0,
    width: 1200, // 12 months * 100px each
    top: 0,
    right: 1200,
    bottom: 100,
    height: 100
  })

  // Mock closest method for finding timeline container
  Element.prototype.closest = vi.fn().mockReturnValue({
    getBoundingClientRect: mockGetBoundingClientRect
  })

  // Mock addEventListener and removeEventListener
  document.addEventListener = vi.fn()
  document.removeEventListener = vi.fn()
})

afterEach(() => {
  vi.clearAllMocks()
  vi.restoreAllMocks()
})

describe('useFeatureResize', () => {
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
    it('should initialize with null isResizing', () => {
      const { result } = renderHook(() => useFeatureResize(defaultParams))

      expect(result.current.isResizing).toBeNull()
    })

    it('should provide handleMouseDown function', () => {
      const { result } = renderHook(() => useFeatureResize(defaultParams))

      expect(typeof result.current.handleMouseDown).toBe('function')
    })
  })

  describe('mouse down functionality', () => {
    it('should set isResizing when mouse down occurs', () => {
      const { result } = renderHook(() => useFeatureResize(defaultParams))

      const mockEvent = {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        target: document.createElement('div')
      } as unknown as React.MouseEvent

      act(() => {
        result.current.handleMouseDown(mockEvent, 'feature-1', 'right')
      })

      expect(result.current.isResizing).toBe('feature-1')
      expect(mockEvent.preventDefault).toHaveBeenCalled()
      expect(mockEvent.stopPropagation).toHaveBeenCalled()
    })

    it('should add event listeners for mouse move and up', () => {
      const { result } = renderHook(() => useFeatureResize(defaultParams))

      const mockEvent = {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        target: document.createElement('div')
      } as unknown as React.MouseEvent

      act(() => {
        result.current.handleMouseDown(mockEvent, 'feature-1', 'right')
      })

      expect(document.addEventListener).toHaveBeenCalledWith('mousemove', expect.any(Function))
      expect(document.addEventListener).toHaveBeenCalledWith('mouseup', expect.any(Function))
    })
  })

  describe('right resize functionality', () => {
    it('should resize feature duration when dragging right handle', () => {
      const { result } = renderHook(() => useFeatureResize(defaultParams))

      const mockMouseDownEvent = {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        target: document.createElement('div')
      } as unknown as React.MouseEvent

      act(() => {
        result.current.handleMouseDown(mockMouseDownEvent, 'feature-1', 'right')
      })

      // Get the mousemove handler that was added
      const addEventListenerCalls = (document.addEventListener as any).mock.calls
      const mouseMoveCall = addEventListenerCalls.find((call: any) => call[0] === 'mousemove')
      const mouseMoveHandler = mouseMoveCall[1]

      // Mock mouse move event
      const mockMouseMoveEvent = {
        clientX: 700, // Month 7 position (700px / 100px per month)
        target: document.createElement('div')
      } as MouseEvent

      // Simulate mouse move
      act(() => {
        mouseMoveHandler(mockMouseMoveEvent)
      })

      // Feature starts at month 2, mouse at month 7, so duration should be 6 (7 - 2 + 1)
      expect(mockSetFeatures).toHaveBeenCalledWith([
        {
          ...mockFeatures[0],
          duration: 6
        },
        mockFeatures[1]
      ])

      expect(mockOnFeaturesChange).toHaveBeenCalledWith([
        {
          ...mockFeatures[0],
          duration: 6
        },
        mockFeatures[1]
      ])
    })

    it('should enforce minimum duration of 1 when resizing right', () => {
      const { result } = renderHook(() => useFeatureResize(defaultParams))

      const mockMouseDownEvent = {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        target: document.createElement('div')
      } as unknown as React.MouseEvent

      act(() => {
        result.current.handleMouseDown(mockMouseDownEvent, 'feature-1', 'right')
      })

      const addEventListenerCalls = (document.addEventListener as any).mock.calls
      const mouseMoveCall = addEventListenerCalls.find((call: any) => call[0] === 'mousemove')
      const mouseMoveHandler = mouseMoveCall[1]

      // Mouse position before feature start (should result in minimum duration)
      const mockMouseMoveEvent = {
        clientX: 100, // Month 1 position, but feature starts at month 2
        target: document.createElement('div')
      } as MouseEvent

      act(() => {
        mouseMoveHandler(mockMouseMoveEvent)
      })

      // Duration should be minimum 1
      expect(mockSetFeatures).toHaveBeenCalledWith([
        {
          ...mockFeatures[0],
          duration: 1
        },
        mockFeatures[1]
      ])
    })
  })

  describe('left resize functionality', () => {
    it('should resize feature start month and duration when dragging left handle', () => {
      const { result } = renderHook(() => useFeatureResize(defaultParams))

      const mockMouseDownEvent = {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        target: document.createElement('div')
      } as unknown as React.MouseEvent

      act(() => {
        result.current.handleMouseDown(mockMouseDownEvent, 'feature-1', 'left')
      })

      const addEventListenerCalls = (document.addEventListener as any).mock.calls
      const mouseMoveCall = addEventListenerCalls.find((call: any) => call[0] === 'mousemove')
      const mouseMoveHandler = mouseMoveCall[1]

      // Move to month 0 (feature currently starts at month 2 with duration 3)
      const mockMouseMoveEvent = {
        clientX: 50, // Month 0 position
        target: document.createElement('div')
      } as MouseEvent

      act(() => {
        mouseMoveHandler(mockMouseMoveEvent)
      })

      // New start month: 0, new duration: 3 + (2 - 0) = 5
      expect(mockSetFeatures).toHaveBeenCalledWith([
        {
          ...mockFeatures[0],
          startMonth: 0,
          duration: 5
        },
        mockFeatures[1]
      ])
    })

    it('should enforce minimum start month of 0 when resizing left', () => {
      const { result } = renderHook(() => useFeatureResize(defaultParams))

      const mockMouseDownEvent = {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        target: document.createElement('div')
      } as unknown as React.MouseEvent

      act(() => {
        result.current.handleMouseDown(mockMouseDownEvent, 'feature-1', 'left')
      })

      const addEventListenerCalls = (document.addEventListener as any).mock.calls
      const mouseMoveCall = addEventListenerCalls.find((call: any) => call[0] === 'mousemove')
      const mouseMoveHandler = mouseMoveCall[1]

      // Negative position should clamp to month 0
      const mockMouseMoveEvent = {
        clientX: -100,
        target: document.createElement('div')
      } as MouseEvent

      act(() => {
        mouseMoveHandler(mockMouseMoveEvent)
      })

      // Start month should be clamped to 0
      expect(mockSetFeatures).toHaveBeenCalledWith([
        {
          ...mockFeatures[0],
          startMonth: 0,
          duration: 5 // 3 + (2 - 0)
        },
        mockFeatures[1]
      ])
    })

    it('should enforce minimum duration of 1 when resizing left', () => {
      const { result } = renderHook(() => useFeatureResize(defaultParams))

      const mockMouseDownEvent = {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        target: document.createElement('div')
      } as unknown as React.MouseEvent

      act(() => {
        result.current.handleMouseDown(mockMouseDownEvent, 'feature-1', 'left')
      })

      const addEventListenerCalls = (document.addEventListener as any).mock.calls
      const mouseMoveCall = addEventListenerCalls.find((call: any) => call[0] === 'mousemove')
      const mouseMoveHandler = mouseMoveCall[1]

      // Move way past the end of the feature to force minimum duration
      const mockMouseMoveEvent = {
        clientX: 800, // Month 8, but feature only goes to month 5 (2 + 3)
        target: document.createElement('div')
      } as MouseEvent

      act(() => {
        mouseMoveHandler(mockMouseMoveEvent)
      })

      // Duration should be minimum 1
      const call = mockSetFeatures.mock.calls[0][0]
      expect(call[0].duration).toBe(1)
    })
  })

  describe('mouse up functionality', () => {
    it('should clean up event listeners and reset resizing state on mouse up', () => {
      const { result } = renderHook(() => useFeatureResize(defaultParams))

      const mockMouseDownEvent = {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        target: document.createElement('div')
      } as unknown as React.MouseEvent

      act(() => {
        result.current.handleMouseDown(mockMouseDownEvent, 'feature-1', 'right')
      })

      expect(result.current.isResizing).toBe('feature-1')

      // Get the mouseup handler
      const addEventListenerCalls = (document.addEventListener as any).mock.calls
      const mouseUpCall = addEventListenerCalls.find((call: any) => call[0] === 'mouseup')
      const mouseUpHandler = mouseUpCall[1]

      // Simulate mouse up
      act(() => {
        mouseUpHandler()
      })

      expect(result.current.isResizing).toBeNull()
      expect(document.removeEventListener).toHaveBeenCalledWith('mousemove', expect.any(Function))
      expect(document.removeEventListener).toHaveBeenCalledWith('mouseup', expect.any(Function))
    })
  })

  describe('edge cases', () => {
    it('should handle missing feature gracefully', () => {
      const { result } = renderHook(() => useFeatureResize(defaultParams))

      const mockMouseDownEvent = {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        target: document.createElement('div')
      } as unknown as React.MouseEvent

      act(() => {
        result.current.handleMouseDown(mockMouseDownEvent, 'non-existent-feature', 'right')
      })

      const addEventListenerCalls = (document.addEventListener as any).mock.calls
      const mouseMoveCall = addEventListenerCalls.find((call: any) => call[0] === 'mousemove')
      const mouseMoveHandler = mouseMoveCall[1]

      // This should not cause any updates since feature doesn't exist
      expect(() => {
        mouseMoveHandler({
          clientX: 500,
          target: document.createElement('div')
        } as MouseEvent)
      }).not.toThrow()

      expect(mockSetFeatures).not.toHaveBeenCalled()
    })

    it('should handle missing timeline container gracefully', () => {
      // Mock closest to return null (no timeline container found)
      Element.prototype.closest = vi.fn().mockReturnValue(null)

      const { result } = renderHook(() => useFeatureResize(defaultParams))

      const mockMouseDownEvent = {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        target: document.createElement('div')
      } as unknown as React.MouseEvent

      act(() => {
        result.current.handleMouseDown(mockMouseDownEvent, 'feature-1', 'right')
      })

      const addEventListenerCalls = (document.addEventListener as any).mock.calls
      const mouseMoveCall = addEventListenerCalls.find((call: any) => call[0] === 'mousemove')
      const mouseMoveHandler = mouseMoveCall[1]

      expect(() => {
        mouseMoveHandler({
          clientX: 500,
          target: document.createElement('div')
        } as MouseEvent)
      }).not.toThrow()

      expect(mockSetFeatures).not.toHaveBeenCalled()
    })

    it('should handle missing onFeaturesChange callback', () => {
      const { result } = renderHook(() => useFeatureResize({
        ...defaultParams,
        onFeaturesChange: undefined
      }))

      const mockMouseDownEvent = {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        target: document.createElement('div')
      } as unknown as React.MouseEvent

      expect(() => {
        act(() => {
          result.current.handleMouseDown(mockMouseDownEvent, 'feature-1', 'right')
        })

        const addEventListenerCalls = (document.addEventListener as any).mock.calls
        const mouseMoveCall = addEventListenerCalls.find((call: any) => call[0] === 'mousemove')
        const mouseMoveHandler = mouseMoveCall[1]

        mouseMoveHandler({
          clientX: 500,
          target: document.createElement('div')
        } as MouseEvent)
      }).not.toThrow()

      expect(mockSetFeatures).toHaveBeenCalled()
    })
  })
})