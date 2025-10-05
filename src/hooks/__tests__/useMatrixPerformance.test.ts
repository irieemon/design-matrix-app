import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useMatrixPerformance } from '../useMatrixPerformance'

// Mock Performance API
const mockPerformanceNow = vi.fn()
const mockPerformanceMark = vi.fn()
const mockPerformanceMeasure = vi.fn()
const mockPerformanceGetEntriesByType = vi.fn()

describe('useMatrixPerformance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()

    // Mock Performance API
    global.performance = {
      now: mockPerformanceNow,
      mark: mockPerformanceMark,
      measure: mockPerformanceMeasure,
      getEntriesByType: mockPerformanceGetEntriesByType,
    } as any

    mockPerformanceNow.mockReturnValue(1000)
    mockPerformanceGetEntriesByType.mockReturnValue([])
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe('initialization', () => {
    it('should initialize with default options', () => {
      const { result } = renderHook(() => useMatrixPerformance())

      expect(result.current.matrixRef).toBeDefined()
      expect(result.current.matrixRef.current).toBeNull()
      expect(result.current.startMonitoring).toBeInstanceOf(Function)
      expect(result.current.stopMonitoring).toBeInstanceOf(Function)
    })

    it('should initialize with excellent performance status', () => {
      const { result } = renderHook(() => useMatrixPerformance())

      expect(result.current.performanceStatus).toBe('excellent')
    })

    it('should initialize with default live metrics', () => {
      const { result } = renderHook(() => useMatrixPerformance())

      expect(result.current.liveMetrics).toEqual({
        averageHoverTime: 8,
        currentFrameRate: 60,
        activeAnimations: 0
      })
    })

    it('should accept custom options', () => {
      const onPerformanceIssue = vi.fn()
      const { result } = renderHook(() =>
        useMatrixPerformance({
          monitorHover: false,
          monitorAnimation: false,
          monitorDrag: false,
          mode: 'production',
          onPerformanceIssue
        })
      )

      expect(result.current).toBeDefined()
    })

    it('should initialize with all monitoring options enabled by default', () => {
      const { result } = renderHook(() => useMatrixPerformance({}))

      expect(result.current).toBeDefined()
      expect(result.current.performanceStatus).toBe('excellent')
    })
  })

  describe('monitoring mode options', () => {
    it('should accept development mode', () => {
      const { result } = renderHook(() =>
        useMatrixPerformance({ mode: 'development' })
      )

      expect(result.current.performanceStatus).toBe('excellent')
    })

    it('should accept production mode', () => {
      const { result } = renderHook(() =>
        useMatrixPerformance({ mode: 'production' })
      )

      expect(result.current.performanceStatus).toBe('excellent')
    })

    it('should accept benchmarking mode', () => {
      const { result } = renderHook(() =>
        useMatrixPerformance({ mode: 'benchmarking' })
      )

      expect(result.current.performanceStatus).toBe('excellent')
    })
  })

  describe('startMonitoring', () => {
    it('should provide a startMonitoring function', () => {
      const { result } = renderHook(() => useMatrixPerformance())

      expect(result.current.startMonitoring).toBeInstanceOf(Function)
    })

    it('should not throw when called', () => {
      const { result } = renderHook(() => useMatrixPerformance())

      expect(() => {
        act(() => {
          result.current.startMonitoring()
        })
      }).not.toThrow()
    })

    it('should be idempotent when called multiple times', () => {
      const { result } = renderHook(() => useMatrixPerformance())

      act(() => {
        result.current.startMonitoring()
        result.current.startMonitoring()
        result.current.startMonitoring()
      })

      expect(result.current.performanceStatus).toBe('excellent')
    })
  })

  describe('stopMonitoring', () => {
    it('should provide a stopMonitoring function', () => {
      const { result } = renderHook(() => useMatrixPerformance())

      expect(result.current.stopMonitoring).toBeInstanceOf(Function)
    })

    it('should return a report object when called', () => {
      const { result } = renderHook(() => useMatrixPerformance())

      let report: any
      act(() => {
        report = result.current.stopMonitoring()
      })

      expect(report).toBeDefined()
      expect(report).toHaveProperty('summary')
      expect(report).toHaveProperty('hover')
      expect(report).toHaveProperty('animation')
      expect(report).toHaveProperty('recommendations')
    })

    it('should return correct report structure', () => {
      const { result } = renderHook(() => useMatrixPerformance())

      let report: any
      act(() => {
        report = result.current.stopMonitoring()
      })

      expect(report.summary).toEqual({
        monitoringDuration: 0,
        totalInteractions: 0,
        overallFrameRate: 60,
        performanceGrade: 'A+'
      })

      expect(report.hover).toEqual({
        totalHovers: 0,
        averageResponseTime: 8,
        slowHovers: 0,
        fastestHover: 8,
        slowestHover: 8
      })

      expect(report.animation).toEqual({
        totalAnimations: 0,
        averageFrameRate: 60,
        slowAnimations: 0,
        totalDroppedFrames: 0
      })
    })

    it('should include recommendations in report', () => {
      const { result } = renderHook(() => useMatrixPerformance())

      let report: any
      act(() => {
        report = result.current.stopMonitoring()
      })

      expect(report.recommendations).toBeInstanceOf(Array)
      expect(report.recommendations).toContain(
        '✅ Excellent performance! All monitoring disabled for optimal experience'
      )
    })

    it('should not throw when called before startMonitoring', () => {
      const { result } = renderHook(() => useMatrixPerformance())

      expect(() => {
        act(() => {
          result.current.stopMonitoring()
        })
      }).not.toThrow()
    })

    it('should be idempotent when called multiple times', () => {
      const { result } = renderHook(() => useMatrixPerformance())

      let report1: any, report2: any

      act(() => {
        report1 = result.current.stopMonitoring()
        report2 = result.current.stopMonitoring()
      })

      expect(report1).toEqual(report2)
    })
  })

  describe('monitorHover', () => {
    it('should provide a monitorHover function', () => {
      const { result } = renderHook(() => useMatrixPerformance())

      expect(result.current.monitorHover).toBeInstanceOf(Function)
    })

    it('should accept an HTMLElement parameter', () => {
      const { result } = renderHook(() => useMatrixPerformance())
      const element = document.createElement('div')

      expect(() => {
        act(() => {
          result.current.monitorHover(element)
        })
      }).not.toThrow()
    })

    it('should return a cleanup function', () => {
      const { result } = renderHook(() => useMatrixPerformance())
      const element = document.createElement('div')

      let cleanup: any
      act(() => {
        cleanup = result.current.monitorHover(element)
      })

      expect(cleanup).toBeInstanceOf(Function)
    })

    it('should not throw when cleanup function is called', () => {
      const { result } = renderHook(() => useMatrixPerformance())
      const element = document.createElement('div')

      let cleanup: any
      act(() => {
        cleanup = result.current.monitorHover(element)
      })

      expect(() => {
        cleanup()
      }).not.toThrow()
    })

    it('should handle multiple elements simultaneously', () => {
      const { result } = renderHook(() => useMatrixPerformance())
      const element1 = document.createElement('div')
      const element2 = document.createElement('div')
      const element3 = document.createElement('div')

      let cleanup1: any, cleanup2: any, cleanup3: any

      act(() => {
        cleanup1 = result.current.monitorHover(element1)
        cleanup2 = result.current.monitorHover(element2)
        cleanup3 = result.current.monitorHover(element3)
      })

      expect(cleanup1).toBeInstanceOf(Function)
      expect(cleanup2).toBeInstanceOf(Function)
      expect(cleanup3).toBeInstanceOf(Function)
    })

    it('should be disabled when monitorHover option is false', () => {
      const { result } = renderHook(() =>
        useMatrixPerformance({ monitorHover: false })
      )
      const element = document.createElement('div')

      let cleanup: any
      act(() => {
        cleanup = result.current.monitorHover(element)
      })

      expect(cleanup).toBeInstanceOf(Function)
    })
  })

  describe('monitorAnimation', () => {
    it('should provide a monitorAnimation function', () => {
      const { result } = renderHook(() => useMatrixPerformance())

      expect(result.current.monitorAnimation).toBeInstanceOf(Function)
    })

    it('should accept element, type, and duration parameters', () => {
      const { result } = renderHook(() => useMatrixPerformance())
      const element = document.createElement('div')

      expect(() => {
        act(() => {
          result.current.monitorAnimation(element, 'fade', 300)
        })
      }).not.toThrow()
    })

    it('should handle different animation types', () => {
      const { result } = renderHook(() => useMatrixPerformance())
      const element = document.createElement('div')

      act(() => {
        result.current.monitorAnimation(element, 'fade', 300)
        result.current.monitorAnimation(element, 'slide', 500)
        result.current.monitorAnimation(element, 'scale', 200)
      })

      expect(result.current.liveMetrics.activeAnimations).toBe(0)
    })

    it('should handle various duration values', () => {
      const { result } = renderHook(() => useMatrixPerformance())
      const element = document.createElement('div')

      act(() => {
        result.current.monitorAnimation(element, 'fade', 0)
        result.current.monitorAnimation(element, 'fade', 100)
        result.current.monitorAnimation(element, 'fade', 1000)
        result.current.monitorAnimation(element, 'fade', 5000)
      })

      expect(result.current.performanceStatus).toBe('excellent')
    })

    it('should be disabled when monitorAnimation option is false', () => {
      const { result } = renderHook(() =>
        useMatrixPerformance({ monitorAnimation: false })
      )
      const element = document.createElement('div')

      expect(() => {
        act(() => {
          result.current.monitorAnimation(element, 'fade', 300)
        })
      }).not.toThrow()
    })
  })

  describe('monitorDrag', () => {
    it('should provide a monitorDrag function', () => {
      const { result } = renderHook(() => useMatrixPerformance())

      expect(result.current.monitorDrag).toBeInstanceOf(Function)
    })

    it('should accept an HTMLElement parameter', () => {
      const { result } = renderHook(() => useMatrixPerformance())
      const element = document.createElement('div')

      expect(() => {
        act(() => {
          result.current.monitorDrag(element)
        })
      }).not.toThrow()
    })

    it('should return a drag controller object', () => {
      const { result } = renderHook(() => useMatrixPerformance())
      const element = document.createElement('div')

      let controller: any
      act(() => {
        controller = result.current.monitorDrag(element)
      })

      expect(controller).toBeDefined()
      expect(controller).toHaveProperty('update')
      expect(controller).toHaveProperty('stop')
    })

    it('should have update and stop functions', () => {
      const { result } = renderHook(() => useMatrixPerformance())
      const element = document.createElement('div')

      let controller: any
      act(() => {
        controller = result.current.monitorDrag(element)
      })

      expect(controller.update).toBeInstanceOf(Function)
      expect(controller.stop).toBeInstanceOf(Function)
    })

    it('should not throw when update is called', () => {
      const { result } = renderHook(() => useMatrixPerformance())
      const element = document.createElement('div')

      let controller: any
      act(() => {
        controller = result.current.monitorDrag(element)
      })

      expect(() => {
        controller.update()
      }).not.toThrow()
    })

    it('should not throw when stop is called', () => {
      const { result } = renderHook(() => useMatrixPerformance())
      const element = document.createElement('div')

      let controller: any
      act(() => {
        controller = result.current.monitorDrag(element)
      })

      expect(() => {
        controller.stop()
      }).not.toThrow()
    })

    it('should handle multiple drag operations', () => {
      const { result } = renderHook(() => useMatrixPerformance())
      const element1 = document.createElement('div')
      const element2 = document.createElement('div')

      let controller1: any, controller2: any

      act(() => {
        controller1 = result.current.monitorDrag(element1)
        controller2 = result.current.monitorDrag(element2)
      })

      expect(controller1.update).toBeInstanceOf(Function)
      expect(controller2.update).toBeInstanceOf(Function)
    })

    it('should be disabled when monitorDrag option is false', () => {
      const { result } = renderHook(() =>
        useMatrixPerformance({ monitorDrag: false })
      )
      const element = document.createElement('div')

      let controller: any
      act(() => {
        controller = result.current.monitorDrag(element)
      })

      expect(controller).toBeDefined()
    })
  })

  describe('performanceStatus', () => {
    it('should start with excellent status', () => {
      const { result } = renderHook(() => useMatrixPerformance())

      expect(result.current.performanceStatus).toBe('excellent')
    })

    it('should maintain excellent status throughout lifecycle', () => {
      const { result } = renderHook(() => useMatrixPerformance())
      const element = document.createElement('div')

      act(() => {
        result.current.startMonitoring()
        result.current.monitorHover(element)
        result.current.monitorAnimation(element, 'fade', 300)
        result.current.monitorDrag(element)
      })

      expect(result.current.performanceStatus).toBe('excellent')

      act(() => {
        result.current.stopMonitoring()
      })

      expect(result.current.performanceStatus).toBe('excellent')
    })

    it('should be one of valid status values', () => {
      const { result } = renderHook(() => useMatrixPerformance())

      const validStatuses = ['excellent', 'good', 'poor', 'critical']
      expect(validStatuses).toContain(result.current.performanceStatus)
    })
  })

  describe('liveMetrics', () => {
    it('should provide live metrics object', () => {
      const { result } = renderHook(() => useMatrixPerformance())

      expect(result.current.liveMetrics).toBeDefined()
      expect(result.current.liveMetrics).toHaveProperty('averageHoverTime')
      expect(result.current.liveMetrics).toHaveProperty('currentFrameRate')
      expect(result.current.liveMetrics).toHaveProperty('activeAnimations')
    })

    it('should maintain static excellent values', () => {
      const { result } = renderHook(() => useMatrixPerformance())

      expect(result.current.liveMetrics.averageHoverTime).toBe(8)
      expect(result.current.liveMetrics.currentFrameRate).toBe(60)
      expect(result.current.liveMetrics.activeAnimations).toBe(0)
    })

    it('should not change during operations', () => {
      const { result } = renderHook(() => useMatrixPerformance())
      const element = document.createElement('div')

      const initialMetrics = { ...result.current.liveMetrics }

      act(() => {
        result.current.startMonitoring()
        result.current.monitorHover(element)
        result.current.monitorAnimation(element, 'fade', 300)
      })

      expect(result.current.liveMetrics).toEqual(initialMetrics)
    })
  })

  describe('exportData', () => {
    it('should provide an exportData function', () => {
      const { result } = renderHook(() => useMatrixPerformance())

      expect(result.current.exportData).toBeInstanceOf(Function)
    })

    it('should return a JSON string', () => {
      const { result } = renderHook(() => useMatrixPerformance())

      let data: string = ''
      act(() => {
        data = result.current.exportData()
      })

      expect(typeof data).toBe('string')
      expect(() => JSON.parse(data)).not.toThrow()
    })

    it('should include timestamp in exported data', () => {
      const { result } = renderHook(() => useMatrixPerformance())

      let data: string = ''
      act(() => {
        data = result.current.exportData()
      })

      const parsed = JSON.parse(data)
      expect(parsed).toHaveProperty('timestamp')
      expect(new Date(parsed.timestamp)).toBeInstanceOf(Date)
    })

    it('should indicate monitoring is disabled', () => {
      const { result } = renderHook(() => useMatrixPerformance())

      let data: string = ''
      act(() => {
        data = result.current.exportData()
      })

      const parsed = JSON.parse(data)
      expect(parsed.status).toBe('MONITORING_DISABLED')
      expect(parsed.message).toContain('disabled')
    })

    it('should be valid JSON for all modes', () => {
      const modes: Array<'development' | 'production' | 'benchmarking'> = [
        'development',
        'production',
        'benchmarking'
      ]

      modes.forEach((mode) => {
        const { result } = renderHook(() => useMatrixPerformance({ mode }))

        let data: string = ''
        act(() => {
          data = result.current.exportData()
        })

        expect(() => JSON.parse(data)).not.toThrow()
      })
    })
  })

  describe('matrixRef', () => {
    it('should provide a ref object', () => {
      const { result } = renderHook(() => useMatrixPerformance())

      expect(result.current.matrixRef).toBeDefined()
      expect(result.current.matrixRef).toHaveProperty('current')
    })

    it('should start with null current value', () => {
      const { result } = renderHook(() => useMatrixPerformance())

      expect(result.current.matrixRef.current).toBeNull()
    })

    it('should be assignable to an element', () => {
      const { result } = renderHook(() => useMatrixPerformance())
      const element = document.createElement('div')

      act(() => {
        if (result.current.matrixRef) {
          (result.current.matrixRef as any).current = element
        }
      })

      expect(result.current.matrixRef.current).toBe(element)
    })

    it('should persist across re-renders', () => {
      const { result, rerender } = renderHook(() => useMatrixPerformance())

      const firstRef = result.current.matrixRef

      rerender()

      expect(result.current.matrixRef).toBe(firstRef)
    })
  })

  describe('onPerformanceIssue callback', () => {
    it('should accept onPerformanceIssue callback', () => {
      const callback = vi.fn()

      expect(() => {
        renderHook(() =>
          useMatrixPerformance({ onPerformanceIssue: callback })
        )
      }).not.toThrow()
    })

    it('should not call callback when monitoring is disabled', () => {
      const callback = vi.fn()
      const { result } = renderHook(() =>
        useMatrixPerformance({ onPerformanceIssue: callback })
      )

      const element = document.createElement('div')

      act(() => {
        result.current.startMonitoring()
        result.current.monitorHover(element)
        result.current.monitorAnimation(element, 'fade', 300)
        result.current.stopMonitoring()
      })

      expect(callback).not.toHaveBeenCalled()
    })
  })

  describe('edge cases and error handling', () => {
    it('should handle null element gracefully in monitorHover', () => {
      const { result } = renderHook(() => useMatrixPerformance())

      expect(() => {
        act(() => {
          result.current.monitorHover(null as any)
        })
      }).not.toThrow()
    })

    it('should handle null element gracefully in monitorAnimation', () => {
      const { result } = renderHook(() => useMatrixPerformance())

      expect(() => {
        act(() => {
          result.current.monitorAnimation(null as any, 'fade', 300)
        })
      }).not.toThrow()
    })

    it('should handle null element gracefully in monitorDrag', () => {
      const { result } = renderHook(() => useMatrixPerformance())

      expect(() => {
        act(() => {
          result.current.monitorDrag(null as any)
        })
      }).not.toThrow()
    })

    it('should handle negative duration values', () => {
      const { result } = renderHook(() => useMatrixPerformance())
      const element = document.createElement('div')

      expect(() => {
        act(() => {
          result.current.monitorAnimation(element, 'fade', -100)
        })
      }).not.toThrow()
    })

    it('should handle very large duration values', () => {
      const { result } = renderHook(() => useMatrixPerformance())
      const element = document.createElement('div')

      expect(() => {
        act(() => {
          result.current.monitorAnimation(element, 'fade', 999999)
        })
      }).not.toThrow()
    })

    it('should handle empty string animation type', () => {
      const { result } = renderHook(() => useMatrixPerformance())
      const element = document.createElement('div')

      expect(() => {
        act(() => {
          result.current.monitorAnimation(element, '', 300)
        })
      }).not.toThrow()
    })

    it('should handle rapid successive calls', () => {
      const { result } = renderHook(() => useMatrixPerformance())
      const element = document.createElement('div')

      expect(() => {
        act(() => {
          for (let i = 0; i < 100; i++) {
            result.current.monitorHover(element)
            result.current.monitorAnimation(element, 'fade', 300)
            result.current.monitorDrag(element)
          }
        })
      }).not.toThrow()
    })
  })

  describe('hook cleanup', () => {
    it('should cleanup properly on unmount', () => {
      const { result, unmount } = renderHook(() => useMatrixPerformance())
      const element = document.createElement('div')

      act(() => {
        result.current.startMonitoring()
        result.current.monitorHover(element)
      })

      expect(() => unmount()).not.toThrow()
    })

    it('should cleanup drag controllers on unmount', () => {
      const { result, unmount } = renderHook(() => useMatrixPerformance())
      const element = document.createElement('div')

      let controller: any
      act(() => {
        controller = result.current.monitorDrag(element)
      })

      unmount()

      expect(() => controller.stop()).not.toThrow()
    })

    it('should cleanup hover monitors on unmount', () => {
      const { result, unmount } = renderHook(() => useMatrixPerformance())
      const element = document.createElement('div')

      let cleanup: any
      act(() => {
        cleanup = result.current.monitorHover(element)
      })

      unmount()

      expect(() => cleanup()).not.toThrow()
    })
  })

  describe('integration scenarios', () => {
    it('should handle complete monitoring workflow', () => {
      const { result } = renderHook(() => useMatrixPerformance())
      const element = document.createElement('div')

      act(() => {
        result.current.startMonitoring()
      })

      let hoverCleanup: any
      act(() => {
        hoverCleanup = result.current.monitorHover(element)
      })

      act(() => {
        result.current.monitorAnimation(element, 'fade', 300)
      })

      let dragController: any
      act(() => {
        dragController = result.current.monitorDrag(element)
      })

      act(() => {
        dragController.update()
      })

      let report: any
      act(() => {
        report = result.current.stopMonitoring()
      })

      expect(report).toBeDefined()
      expect(report.summary.performanceGrade).toBe('A+')

      act(() => {
        hoverCleanup()
        dragController.stop()
      })
    })

    it('should export data at any point in workflow', () => {
      const { result } = renderHook(() => useMatrixPerformance())
      const element = document.createElement('div')

      let data1: string, data2: string, data3: string

      act(() => {
        data1 = result.current.exportData()
      })

      act(() => {
        result.current.startMonitoring()
        data2 = result.current.exportData()
      })

      act(() => {
        result.current.monitorHover(element)
        data3 = result.current.exportData()
      })

      expect(() => JSON.parse(data1)).not.toThrow()
      expect(() => JSON.parse(data2)).not.toThrow()
      expect(() => JSON.parse(data3)).not.toThrow()
    })

    it('should maintain state consistency across operations', () => {
      const { result } = renderHook(() => useMatrixPerformance())
      const element = document.createElement('div')

      const operations = [
        () => result.current.startMonitoring(),
        () => result.current.monitorHover(element),
        () => result.current.monitorAnimation(element, 'fade', 300),
        () => result.current.monitorDrag(element),
        () => result.current.stopMonitoring(),
        () => result.current.exportData()
      ]

      operations.forEach((operation) => {
        act(() => {
          operation()
        })

        expect(result.current.performanceStatus).toBe('excellent')
        expect(result.current.liveMetrics.currentFrameRate).toBe(60)
      })
    })
  })
})