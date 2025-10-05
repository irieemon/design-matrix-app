import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useTransitionCoordination } from '../useTransitionCoordination'

// Mock performance API
global.performance = {
  now: vi.fn(() => Date.now()),
} as any

describe('useTransitionCoordination', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.documentElement.className = ''
    vi.useFakeTimers()

    // Mock requestAnimationFrame
    global.requestAnimationFrame = vi.fn((cb) => {
      cb(Date.now())
      return 1
    })
    global.cancelAnimationFrame = vi.fn()
  })

  afterEach(() => {
    vi.useRealTimers()
    document.documentElement.className = ''
  })

  describe('initialization', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useTransitionCoordination())

      expect(result.current.transitionState.isTransitioning).toBe(false)
      expect(result.current.transitionState.isStateUpdating).toBe(false)
      expect(result.current.transitionState.performance.fps).toBe(60)
    })

    it('should apply default CSS classes', () => {
      renderHook(() => useTransitionCoordination())

      expect(document.documentElement.classList.contains('react-state-stable')).toBe(true)
    })

    it('should not be transitioning initially', () => {
      const { result } = renderHook(() => useTransitionCoordination())

      expect(result.current.transitionState.isTransitioning).toBe(false)
    })
  })

  describe('state updates', () => {
    it('should mark state as updating', () => {
      const { result } = renderHook(() => useTransitionCoordination())

      act(() => {
        result.current.startStateUpdate()
      })

      expect(result.current.transitionState.isStateUpdating).toBe(true)
    })

    it('should apply CSS class during state update', () => {
      const { result } = renderHook(() =>
        useTransitionCoordination({ disableTransitionsDuringUpdates: true })
      )

      act(() => {
        result.current.startStateUpdate()
      })

      expect(document.documentElement.classList.contains('react-state-updating')).toBe(true)
      expect(document.documentElement.classList.contains('react-state-stable')).toBe(false)
    })

    it('should debounce state updates', () => {
      const { result } = renderHook(() =>
        useTransitionCoordination({ debounceMs: 50 })
      )

      act(() => {
        result.current.startStateUpdate()
      })

      expect(result.current.transitionState.isStateUpdating).toBe(true)

      act(() => {
        vi.advanceTimersByTime(60)
      })

      expect(result.current.transitionState.isStateUpdating).toBe(false)
    })

    it('should reset debounce on rapid updates', () => {
      const { result } = renderHook(() =>
        useTransitionCoordination({ debounceMs: 50 })
      )

      act(() => {
        result.current.startStateUpdate()
      })

      act(() => {
        vi.advanceTimersByTime(25)
      })

      act(() => {
        result.current.startStateUpdate()
      })

      act(() => {
        vi.advanceTimersByTime(40)
      })

      expect(result.current.transitionState.isStateUpdating).toBe(true)

      act(() => {
        vi.advanceTimersByTime(20)
      })

      expect(result.current.transitionState.isStateUpdating).toBe(false)
    })

    it('should handle disabled transitions option', () => {
      const { result } = renderHook(() =>
        useTransitionCoordination({ disableTransitionsDuringUpdates: false })
      )

      act(() => {
        result.current.startStateUpdate()
      })

      expect(document.documentElement.classList.contains('react-state-updating')).toBe(false)
    })
  })

  describe('transitions', () => {
    it('should start transition', () => {
      const { result } = renderHook(() => useTransitionCoordination())

      act(() => {
        result.current.startTransition()
      })

      expect(result.current.transitionState.isTransitioning).toBe(true)
    })

    it('should apply transitioning CSS class', () => {
      const { result } = renderHook(() => useTransitionCoordination())

      act(() => {
        result.current.startTransition()
      })

      expect(document.documentElement.classList.contains('transitioning')).toBe(true)
    })

    it('should end transition', () => {
      const { result } = renderHook(() => useTransitionCoordination())

      act(() => {
        result.current.startTransition()
      })

      act(() => {
        result.current.endTransition()
      })

      expect(result.current.transitionState.isTransitioning).toBe(false)
    })

    it('should cleanup will-change after transition', () => {
      const { result } = renderHook(() =>
        useTransitionCoordination({ autoCleanupWillChange: true })
      )

      act(() => {
        result.current.startTransition()
      })

      act(() => {
        result.current.endTransition()
      })

      act(() => {
        vi.advanceTimersByTime(250)
      })

      expect(document.documentElement.classList.contains('transition-cleanup')).toBe(true)

      act(() => {
        vi.advanceTimersByTime(150)
      })

      expect(document.documentElement.classList.contains('transition-cleanup')).toBe(false)
    })

    it('should not cleanup will-change when disabled', () => {
      const { result } = renderHook(() =>
        useTransitionCoordination({ autoCleanupWillChange: false })
      )

      act(() => {
        result.current.startTransition()
      })

      act(() => {
        result.current.endTransition()
      })

      act(() => {
        vi.advanceTimersByTime(500)
      })

      expect(document.documentElement.classList.contains('transition-cleanup')).toBe(false)
    })
  })

  describe('withStateUpdate wrapper', () => {
    it('should wrap callback and mark state as updating', () => {
      const { result } = renderHook(() => useTransitionCoordination())

      const callback = vi.fn()
      const wrapped = result.current.withStateUpdate(callback)

      act(() => {
        wrapped('arg1', 'arg2')
      })

      expect(callback).toHaveBeenCalledWith('arg1', 'arg2')
      expect(result.current.transitionState.isStateUpdating).toBe(true)
    })

    it('should preserve callback arguments', () => {
      const { result } = renderHook(() => useTransitionCoordination())

      const callback = vi.fn()
      const wrapped = result.current.withStateUpdate(callback)

      act(() => {
        wrapped(1, 'test', { key: 'value' })
      })

      expect(callback).toHaveBeenCalledWith(1, 'test', { key: 'value' })
    })

    it('should work with multiple wrapped callbacks', () => {
      const { result } = renderHook(() => useTransitionCoordination())

      const callback1 = vi.fn()
      const callback2 = vi.fn()
      const wrapped1 = result.current.withStateUpdate(callback1)
      const wrapped2 = result.current.withStateUpdate(callback2)

      act(() => {
        wrapped1()
        wrapped2()
      })

      expect(callback1).toHaveBeenCalled()
      expect(callback2).toHaveBeenCalled()
    })
  })

  describe('withTransition wrapper', () => {
    it('should wrap callback and trigger transition', () => {
      const { result } = renderHook(() => useTransitionCoordination())

      const callback = vi.fn()
      const wrapped = result.current.withTransition(callback)

      act(() => {
        wrapped('arg')
      })

      expect(callback).toHaveBeenCalledWith('arg')
      expect(result.current.transitionState.isTransitioning).toBe(true)
    })

    it('should end transition after duration', () => {
      const { result } = renderHook(() => useTransitionCoordination())

      const callback = vi.fn()
      const wrapped = result.current.withTransition(callback, 300)

      act(() => {
        wrapped()
      })

      expect(result.current.transitionState.isTransitioning).toBe(true)

      act(() => {
        vi.advanceTimersByTime(350)
      })

      expect(result.current.transitionState.isTransitioning).toBe(false)
    })

    it('should respect custom transition duration', () => {
      const { result } = renderHook(() => useTransitionCoordination())

      const callback = vi.fn()
      const wrapped = result.current.withTransition(callback, 500)

      act(() => {
        wrapped()
      })

      act(() => {
        vi.advanceTimersByTime(450)
      })

      expect(result.current.transitionState.isTransitioning).toBe(true)

      act(() => {
        vi.advanceTimersByTime(100)
      })

      expect(result.current.transitionState.isTransitioning).toBe(false)
    })

    it('should use minimum duration of 200ms', () => {
      const { result } = renderHook(() => useTransitionCoordination())

      const callback = vi.fn()
      const wrapped = result.current.withTransition(callback, 50)

      act(() => {
        wrapped()
      })

      act(() => {
        vi.advanceTimersByTime(150)
      })

      expect(result.current.transitionState.isTransitioning).toBe(true)

      act(() => {
        vi.advanceTimersByTime(100)
      })

      expect(result.current.transitionState.isTransitioning).toBe(false)
    })
  })

  describe('performance monitoring', () => {
    it('should monitor performance when enabled', () => {
      const { result } = renderHook(() =>
        useTransitionCoordination({ enablePerformanceMonitoring: true })
      )

      expect(result.current.transitionState.performance).toBeDefined()
      expect(result.current.transitionState.performance.fps).toBeGreaterThanOrEqual(0)
    })

    it('should not monitor performance when disabled', () => {
      const { result } = renderHook(() =>
        useTransitionCoordination({ enablePerformanceMonitoring: false })
      )

      // Should still have performance object but not actively monitoring
      expect(result.current.transitionState.performance).toBeDefined()
    })

    it('should calculate FPS', () => {
      renderHook(() =>
        useTransitionCoordination({ enablePerformanceMonitoring: true })
      )

      // Simulate frame updates
      act(() => {
        vi.advanceTimersByTime(1100)
      })

      // FPS calculation happens every second
      expect(global.requestAnimationFrame).toHaveBeenCalled()
    })

    it('should track dropped frames', () => {
      const { result } = renderHook(() =>
        useTransitionCoordination({ enablePerformanceMonitoring: true })
      )

      expect(result.current.transitionState.performance.droppedFrames).toBeGreaterThanOrEqual(0)
    })
  })

  describe('performance indicators', () => {
    it('should indicate good performance', () => {
      const { result } = renderHook(() =>
        useTransitionCoordination({ enablePerformanceMonitoring: true })
      )

      expect(result.current.isPerformanceGood).toBeDefined()
      expect(typeof result.current.isPerformanceGood).toBe('boolean')
    })

    it('should indicate warning performance', () => {
      const { result } = renderHook(() =>
        useTransitionCoordination({ enablePerformanceMonitoring: true })
      )

      expect(result.current.isPerformanceWarning).toBeDefined()
      expect(typeof result.current.isPerformanceWarning).toBe('boolean')
    })

    it('should indicate critical performance', () => {
      const { result } = renderHook(() =>
        useTransitionCoordination({ enablePerformanceMonitoring: true })
      )

      expect(result.current.isPerformanceCritical).toBeDefined()
      expect(typeof result.current.isPerformanceCritical).toBe('boolean')
    })

    it('should apply performance CSS classes', () => {
      renderHook(() =>
        useTransitionCoordination({ enablePerformanceMonitoring: true })
      )

      // Should have one performance class
      const hasGood = document.documentElement.classList.contains('performance-good')
      const hasWarning = document.documentElement.classList.contains('performance-warning')
      const hasCritical = document.documentElement.classList.contains('performance-critical')

      expect(hasGood || hasWarning || hasCritical).toBe(true)
    })

    it('should update performance classes based on FPS', async () => {
      const { result, rerender } = renderHook(() =>
        useTransitionCoordination({ enablePerformanceMonitoring: true })
      )

      // Initial should be good
      expect(document.documentElement.classList.contains('performance-good')).toBe(true)

      // Simulate performance degradation
      act(() => {
        result.current.transitionState.performance.fps = 40
        rerender()
      })

      await waitFor(() => {
        expect(document.documentElement.classList.contains('performance-critical')).toBe(true)
      })
    })
  })

  describe('cleanup', () => {
    it('should clean up timers on unmount', () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout')

      const { unmount } = renderHook(() => useTransitionCoordination())

      unmount()

      expect(clearTimeoutSpy).toHaveBeenCalled()
    })

    it('should cancel animation frames on unmount', () => {
      const { unmount } = renderHook(() =>
        useTransitionCoordination({ enablePerformanceMonitoring: true })
      )

      unmount()

      expect(global.cancelAnimationFrame).toHaveBeenCalled()
    })

    it('should remove CSS classes on unmount', () => {
      const { unmount } = renderHook(() => useTransitionCoordination())

      act(() => {
        document.documentElement.classList.add('react-state-updating')
        document.documentElement.classList.add('transitioning')
      })

      unmount()

      expect(document.documentElement.classList.contains('react-state-updating')).toBe(false)
      expect(document.documentElement.classList.contains('transitioning')).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('should handle simultaneous state update and transition', () => {
      const { result } = renderHook(() => useTransitionCoordination())

      act(() => {
        result.current.startStateUpdate()
        result.current.startTransition()
      })

      expect(result.current.transitionState.isStateUpdating).toBe(true)
      expect(result.current.transitionState.isTransitioning).toBe(true)
    })

    it('should handle rapid start/stop cycles', () => {
      const { result } = renderHook(() => useTransitionCoordination())

      for (let i = 0; i < 10; i++) {
        act(() => {
          result.current.startTransition()
          result.current.endTransition()
        })
      }

      expect(result.current.transitionState.isTransitioning).toBe(false)
    })

    it('should handle nested withTransition calls', () => {
      const { result } = renderHook(() => useTransitionCoordination())

      const callback = vi.fn(() => {
        const nested = result.current.withTransition(vi.fn())
        nested()
      })

      const wrapped = result.current.withTransition(callback)

      act(() => {
        wrapped()
      })

      expect(callback).toHaveBeenCalled()
    })

    it('should handle errors in wrapped callbacks', () => {
      const { result } = renderHook(() => useTransitionCoordination())

      const callback = vi.fn(() => {
        throw new Error('Test error')
      })

      const wrapped = result.current.withStateUpdate(callback)

      expect(() => {
        act(() => {
          wrapped()
        })
      }).toThrow('Test error')

      // State should still be marked as updating
      expect(result.current.transitionState.isStateUpdating).toBe(true)
    })
  })

  describe('debounce configuration', () => {
    it('should use default debounce delay', () => {
      const { result } = renderHook(() => useTransitionCoordination())

      act(() => {
        result.current.startStateUpdate()
      })

      act(() => {
        vi.advanceTimersByTime(20)
      })

      expect(result.current.transitionState.isStateUpdating).toBe(false)
    })

    it('should respect custom debounce delay', () => {
      const { result } = renderHook(() =>
        useTransitionCoordination({ debounceMs: 100 })
      )

      act(() => {
        result.current.startStateUpdate()
      })

      act(() => {
        vi.advanceTimersByTime(50)
      })

      expect(result.current.transitionState.isStateUpdating).toBe(true)

      act(() => {
        vi.advanceTimersByTime(60)
      })

      expect(result.current.transitionState.isStateUpdating).toBe(false)
    })

    it('should handle zero debounce delay', () => {
      const { result } = renderHook(() =>
        useTransitionCoordination({ debounceMs: 0 })
      )

      act(() => {
        result.current.startStateUpdate()
      })

      act(() => {
        vi.advanceTimersByTime(1)
      })

      expect(result.current.transitionState.isStateUpdating).toBe(false)
    })
  })

  describe('integration scenarios', () => {
    it('should coordinate state update with transition', () => {
      const { result } = renderHook(() => useTransitionCoordination())

      const callback = vi.fn()
      const wrappedUpdate = result.current.withStateUpdate(callback)
      const wrappedTransition = result.current.withTransition(wrappedUpdate)

      act(() => {
        wrappedTransition()
      })

      expect(result.current.transitionState.isStateUpdating).toBe(true)
      expect(result.current.transitionState.isTransitioning).toBe(true)
      expect(callback).toHaveBeenCalled()
    })

    it('should handle multiple concurrent transitions', () => {
      const { result } = renderHook(() => useTransitionCoordination())

      const callback1 = vi.fn()
      const callback2 = vi.fn()
      const wrapped1 = result.current.withTransition(callback1, 200)
      const wrapped2 = result.current.withTransition(callback2, 300)

      act(() => {
        wrapped1()
        wrapped2()
      })

      expect(callback1).toHaveBeenCalled()
      expect(callback2).toHaveBeenCalled()
      expect(result.current.transitionState.isTransitioning).toBe(true)
    })

    it('should maintain performance monitoring during transitions', () => {
      const { result } = renderHook(() =>
        useTransitionCoordination({ enablePerformanceMonitoring: true })
      )

      act(() => {
        result.current.startTransition()
      })

      act(() => {
        vi.advanceTimersByTime(1100)
      })

      expect(result.current.transitionState.performance.fps).toBeGreaterThanOrEqual(0)
    })
  })
})