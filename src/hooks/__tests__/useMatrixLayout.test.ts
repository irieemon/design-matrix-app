import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useMatrixLayout } from '../useMatrixLayout'

// Mock performance API
global.performance = {
  now: vi.fn(() => Date.now()),
} as any

// Mock debounce and throttle
vi.mock('../../lib/matrix/performance', () => ({
  debounce: (fn: Function) => fn,
  throttle: (fn: Function) => fn,
}))

describe('useMatrixLayout', () => {
  let originalInnerWidth: number
  let originalInnerHeight: number
  let resizeObserverCallback: Function | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''

    // Store original values
    originalInnerWidth = window.innerWidth
    originalInnerHeight = window.innerHeight

    // Mock window dimensions
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1920,
    })
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 1080,
    })

    // Mock ResizeObserver
    global.ResizeObserver = class ResizeObserver {
      callback: Function

      constructor(callback: Function) {
        this.callback = callback
        resizeObserverCallback = callback
      }

      observe() {}
      unobserve() {}
      disconnect() {}
    } as any

    // Mock requestAnimationFrame
    global.requestAnimationFrame = vi.fn((cb) => {
      cb(Date.now())
      return 1
    })
    global.cancelAnimationFrame = vi.fn()
  })

  afterEach(() => {
    // Restore original values
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    })
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: originalInnerHeight,
    })

    resizeObserverCallback = null
    document.body.innerHTML = ''
  })

  describe('initialization', () => {
    it('should calculate initial dimensions', async () => {
      const { result } = renderHook(() =>
        useMatrixLayout({ sidebarCollapsed: false })
      )

      await waitFor(() => {
        expect(result.current.dimensions).not.toBeNull()
      })

      expect(result.current.dimensions?.width).toBeGreaterThan(0)
      expect(result.current.dimensions?.height).toBeGreaterThan(0)
    })

    it('should start in calculating state', () => {
      const { result } = renderHook(() =>
        useMatrixLayout({ sidebarCollapsed: false })
      )

      expect(result.current.isCalculating).toBe(true)
    })

    it('should not be transitioning initially', () => {
      const { result } = renderHook(() =>
        useMatrixLayout({ sidebarCollapsed: false })
      )

      expect(result.current.isTransitioning).toBe(false)
    })

    it('should include padding in dimensions', async () => {
      const { result } = renderHook(() =>
        useMatrixLayout({ sidebarCollapsed: false })
      )

      await waitFor(() => {
        expect(result.current.dimensions).not.toBeNull()
      })

      const dims = result.current.dimensions!
      expect(dims.padding.top).toBeGreaterThan(0)
      expect(dims.padding.right).toBeGreaterThan(0)
      expect(dims.padding.bottom).toBeGreaterThan(0)
      expect(dims.padding.left).toBeGreaterThan(0)
    })
  })

  describe('device type detection', () => {
    it('should detect mobile viewport', async () => {
      Object.defineProperty(window, 'innerWidth', { value: 375, writable: true })
      Object.defineProperty(window, 'innerHeight', { value: 667, writable: true })

      const { result } = renderHook(() =>
        useMatrixLayout({ sidebarCollapsed: false })
      )

      await waitFor(() => {
        expect(result.current.dimensions).not.toBeNull()
      })

      // Mobile should have smaller dimensions
      expect(result.current.dimensions?.width).toBeLessThan(400)
    })

    it('should detect tablet viewport', async () => {
      Object.defineProperty(window, 'innerWidth', { value: 768, writable: true })
      Object.defineProperty(window, 'innerHeight', { value: 1024, writable: true })

      const { result } = renderHook(() =>
        useMatrixLayout({ sidebarCollapsed: false })
      )

      await waitFor(() => {
        expect(result.current.dimensions).not.toBeNull()
      })

      expect(result.current.dimensions?.width).toBeGreaterThan(600)
      expect(result.current.dimensions?.width).toBeLessThan(800)
    })

    it('should detect desktop viewport', async () => {
      Object.defineProperty(window, 'innerWidth', { value: 1920, writable: true })
      Object.defineProperty(window, 'innerHeight', { value: 1080, writable: true })

      const { result } = renderHook(() =>
        useMatrixLayout({ sidebarCollapsed: false })
      )

      await waitFor(() => {
        expect(result.current.dimensions).not.toBeNull()
      })

      expect(result.current.dimensions?.width).toBeGreaterThan(1000)
    })

    it('should detect ultrawide viewport', async () => {
      Object.defineProperty(window, 'innerWidth', { value: 3440, writable: true })
      Object.defineProperty(window, 'innerHeight', { value: 1440, writable: true })

      const { result } = renderHook(() =>
        useMatrixLayout({ sidebarCollapsed: false })
      )

      await waitFor(() => {
        expect(result.current.dimensions).not.toBeNull()
      })

      // Ultrawide should respect max width constraints
      expect(result.current.dimensions?.width).toBeLessThan(2000)
    })
  })

  describe('sidebar state changes', () => {
    it('should recalculate on sidebar collapse', async () => {
      const { result, rerender } = renderHook(
        ({ collapsed }) => useMatrixLayout({ sidebarCollapsed: collapsed }),
        { initialProps: { collapsed: false } }
      )

      await waitFor(() => {
        expect(result.current.dimensions).not.toBeNull()
      })

      const initialWidth = result.current.dimensions?.width

      rerender({ collapsed: true })

      await waitFor(() => {
        const newWidth = result.current.dimensions?.width
        // Width should change when sidebar collapses
        expect(newWidth).not.toBe(initialWidth)
      })
    })

    it('should handle rapid sidebar toggles', async () => {
      const { rerender } = renderHook(
        ({ collapsed }) => useMatrixLayout({ sidebarCollapsed: collapsed }),
        { initialProps: { collapsed: false } }
      )

      // Rapid toggles
      rerender({ collapsed: true })
      rerender({ collapsed: false })
      rerender({ collapsed: true })

      // Should not throw errors
      expect(() => {
        rerender({ collapsed: false })
      }).not.toThrow()
    })
  })

  describe('transitions', () => {
    it('should enable transitions by default', async () => {
      const { result, rerender } = renderHook(
        ({ collapsed }) => useMatrixLayout({ sidebarCollapsed: collapsed }),
        { initialProps: { collapsed: false } }
      )

      await waitFor(() => {
        expect(result.current.dimensions).not.toBeNull()
      })

      rerender({ collapsed: true })

      await waitFor(() => {
        expect(result.current.isTransitioning).toBe(true)
      })
    })

    it('should disable transitions when configured', async () => {
      const { result, rerender } = renderHook(
        ({ collapsed }) =>
          useMatrixLayout({ sidebarCollapsed: collapsed, enableTransitions: false }),
        { initialProps: { collapsed: false } }
      )

      await waitFor(() => {
        expect(result.current.dimensions).not.toBeNull()
      })

      rerender({ collapsed: true })

      // Should never transition
      expect(result.current.isTransitioning).toBe(false)
    })

    it('should track transition progress', async () => {
      const { result, rerender } = renderHook(
        ({ collapsed }) => useMatrixLayout({ sidebarCollapsed: collapsed }),
        { initialProps: { collapsed: false } }
      )

      await waitFor(() => {
        expect(result.current.dimensions).not.toBeNull()
      })

      rerender({ collapsed: true })

      await waitFor(() => {
        if (result.current.isTransitioning) {
          expect(result.current.transitionProgress).toBeGreaterThanOrEqual(0)
          expect(result.current.transitionProgress).toBeLessThanOrEqual(1)
        }
      })
    })
  })

  describe('CSS Grid integration', () => {
    it('should read dimensions from CSS Grid container', async () => {
      const mainGridArea = document.createElement('div')
      mainGridArea.className = 'app-layout-grid__main'
      mainGridArea.getBoundingClientRect = () =>
        ({
          width: 1600,
          height: 900,
          top: 0,
          left: 0,
          right: 1600,
          bottom: 900,
        } as DOMRect)
      document.body.appendChild(mainGridArea)

      const { result } = renderHook(() =>
        useMatrixLayout({ sidebarCollapsed: false })
      )

      await waitFor(() => {
        expect(result.current.dimensions).not.toBeNull()
      })

      // Should use CSS Grid dimensions
      expect(result.current.dimensions?.width).toBeCloseTo(1600, -2)
    })

    it('should fallback to viewport when no grid container', async () => {
      const { result } = renderHook(() =>
        useMatrixLayout({ sidebarCollapsed: false })
      )

      await waitFor(() => {
        expect(result.current.dimensions).not.toBeNull()
      })

      // Should use viewport dimensions
      expect(result.current.dimensions?.width).toBeGreaterThan(0)
    })

    it('should prioritize matrix workspace container', async () => {
      const mainGridArea = document.createElement('div')
      mainGridArea.className = 'app-layout-grid__main'

      const workspace = document.createElement('div')
      workspace.className = 'enterprise-matrix-workspace'
      workspace.getBoundingClientRect = () =>
        ({
          width: 1400,
          height: 800,
          top: 0,
          left: 0,
          right: 1400,
          bottom: 800,
        } as DOMRect)

      mainGridArea.appendChild(workspace)
      document.body.appendChild(mainGridArea)

      const { result } = renderHook(() =>
        useMatrixLayout({ sidebarCollapsed: false })
      )

      await waitFor(() => {
        expect(result.current.dimensions).not.toBeNull()
      })

      // Should use workspace dimensions
      expect(result.current.dimensions?.width).toBeCloseTo(1400, -2)
    })
  })

  describe('performance monitoring', () => {
    it('should track performance metrics when enabled', async () => {
      const { result } = renderHook(() =>
        useMatrixLayout({
          sidebarCollapsed: false,
          enablePerformanceMonitoring: true,
        })
      )

      await waitFor(() => {
        expect(result.current.performanceMetrics).not.toBeNull()
      })

      expect(result.current.performanceMetrics?.calculationTime).toBeGreaterThanOrEqual(0)
      expect(result.current.performanceMetrics?.updateCount).toBeGreaterThan(0)
    })

    it('should not track metrics when disabled', async () => {
      const { result } = renderHook(() =>
        useMatrixLayout({
          sidebarCollapsed: false,
          enablePerformanceMonitoring: false,
        })
      )

      await waitFor(() => {
        expect(result.current.dimensions).not.toBeNull()
      })

      expect(result.current.performanceMetrics).toBeNull()
    })

    it('should calculate average update time', async () => {
      const { result, rerender } = renderHook(
        ({ collapsed }) =>
          useMatrixLayout({
            sidebarCollapsed: collapsed,
            enablePerformanceMonitoring: true,
          }),
        { initialProps: { collapsed: false } }
      )

      await waitFor(() => {
        expect(result.current.performanceMetrics).not.toBeNull()
      })

      rerender({ collapsed: true })
      rerender({ collapsed: false })

      await waitFor(() => {
        expect(result.current.performanceMetrics?.averageUpdateTime).toBeGreaterThan(0)
      })
    })
  })

  describe('debouncing and throttling', () => {
    it('should accept custom debounce delay', async () => {
      const { result } = renderHook(() =>
        useMatrixLayout({
          sidebarCollapsed: false,
          debounceDelay: 50,
        })
      )

      await waitFor(() => {
        expect(result.current.dimensions).not.toBeNull()
      })

      expect(result.current.dimensions).not.toBeNull()
    })

    it('should accept custom throttle delay', async () => {
      const { result } = renderHook(() =>
        useMatrixLayout({
          sidebarCollapsed: false,
          throttleDelay: 16,
        })
      )

      await waitFor(() => {
        expect(result.current.dimensions).not.toBeNull()
      })

      expect(result.current.dimensions).not.toBeNull()
    })
  })

  describe('force recalculation', () => {
    it('should provide forceRecalculation method', async () => {
      const { result } = renderHook(() =>
        useMatrixLayout({ sidebarCollapsed: false })
      )

      await waitFor(() => {
        expect(result.current.dimensions).not.toBeNull()
      })

      expect(typeof result.current.forceRecalculation).toBe('function')
    })

    it('should recalculate immediately on force', async () => {
      const { result } = renderHook(() =>
        useMatrixLayout({ sidebarCollapsed: false })
      )

      await waitFor(() => {
        expect(result.current.dimensions).not.toBeNull()
      })

      const beforeDimensions = result.current.dimensions

      // Change viewport
      Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true })

      act(() => {
        result.current.forceRecalculation()
      })

      // Dimensions should update
      expect(result.current.dimensions).not.toEqual(beforeDimensions)
    })
  })

  describe('responsive boundaries', () => {
    it('should respect minimum width constraints', async () => {
      Object.defineProperty(window, 'innerWidth', { value: 300, writable: true })

      const { result } = renderHook(() =>
        useMatrixLayout({ sidebarCollapsed: false })
      )

      await waitFor(() => {
        expect(result.current.dimensions).not.toBeNull()
      })

      // Should enforce minimum width
      expect(result.current.dimensions?.width).toBeGreaterThanOrEqual(350)
    })

    it('should respect minimum height constraints', async () => {
      Object.defineProperty(window, 'innerHeight', { value: 300, writable: true })

      const { result } = renderHook(() =>
        useMatrixLayout({ sidebarCollapsed: false })
      )

      await waitFor(() => {
        expect(result.current.dimensions).not.toBeNull()
      })

      // Should enforce minimum height
      expect(result.current.dimensions?.height).toBeGreaterThanOrEqual(350)
    })

    it('should respect maximum width constraints', async () => {
      Object.defineProperty(window, 'innerWidth', { value: 5000, writable: true })

      const { result } = renderHook(() =>
        useMatrixLayout({ sidebarCollapsed: false })
      )

      await waitFor(() => {
        expect(result.current.dimensions).not.toBeNull()
      })

      // Should enforce maximum width
      expect(result.current.dimensions?.width).toBeLessThanOrEqual(1800)
    })
  })

  describe('cleanup', () => {
    it('should clean up ResizeObserver on unmount', () => {
      const disconnectSpy = vi.fn()
      global.ResizeObserver = class ResizeObserver {
        disconnect = disconnectSpy
        observe() {}
        unobserve() {}
      } as any

      const { unmount } = renderHook(() =>
        useMatrixLayout({ sidebarCollapsed: false })
      )

      unmount()

      expect(disconnectSpy).toHaveBeenCalled()
    })

    it('should cancel animation frames on unmount', () => {
      const { unmount } = renderHook(() =>
        useMatrixLayout({ sidebarCollapsed: false })
      )

      unmount()

      expect(global.cancelAnimationFrame).toHaveBeenCalled()
    })

    it('should clear timeouts on unmount', () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout')

      const { unmount } = renderHook(() =>
        useMatrixLayout({ sidebarCollapsed: false })
      )

      unmount()

      // Should have cleared any pending timeouts
      expect(clearTimeoutSpy).toHaveBeenCalled()
    })
  })

  describe('edge cases', () => {
    it('should handle zero viewport dimensions', async () => {
      Object.defineProperty(window, 'innerWidth', { value: 0, writable: true })
      Object.defineProperty(window, 'innerHeight', { value: 0, writable: true })

      const { result } = renderHook(() =>
        useMatrixLayout({ sidebarCollapsed: false })
      )

      await waitFor(() => {
        expect(result.current.dimensions).not.toBeNull()
      })

      // Should still provide valid dimensions (minimums)
      expect(result.current.dimensions?.width).toBeGreaterThan(0)
      expect(result.current.dimensions?.height).toBeGreaterThan(0)
    })

    it('should handle negative padding calculations', async () => {
      Object.defineProperty(window, 'innerWidth', { value: 100, writable: true })
      Object.defineProperty(window, 'innerHeight', { value: 100, writable: true })

      const { result } = renderHook(() =>
        useMatrixLayout({ sidebarCollapsed: false })
      )

      await waitFor(() => {
        expect(result.current.dimensions).not.toBeNull()
      })

      // Padding should never be negative
      const dims = result.current.dimensions!
      expect(dims.padding.top).toBeGreaterThanOrEqual(0)
      expect(dims.padding.right).toBeGreaterThanOrEqual(0)
      expect(dims.padding.bottom).toBeGreaterThanOrEqual(0)
      expect(dims.padding.left).toBeGreaterThanOrEqual(0)
    })

    it('should handle rapid viewport changes', async () => {
      const { result } = renderHook(() =>
        useMatrixLayout({ sidebarCollapsed: false })
      )

      await waitFor(() => {
        expect(result.current.dimensions).not.toBeNull()
      })

      // Simulate rapid window resizes
      for (let i = 0; i < 10; i++) {
        Object.defineProperty(window, 'innerWidth', {
          value: 1000 + i * 100,
          writable: true,
        })
        if (resizeObserverCallback) {
          resizeObserverCallback()
        }
      }

      // Should handle without errors
      expect(result.current.dimensions).not.toBeNull()
    })
  })

  describe('interpolation', () => {
    it('should provide interpolated dimensions during transition', async () => {
      const { result, rerender } = renderHook(
        ({ collapsed }) => useMatrixLayout({ sidebarCollapsed: collapsed }),
        { initialProps: { collapsed: false } }
      )

      await waitFor(() => {
        expect(result.current.dimensions).not.toBeNull()
      })

      rerender({ collapsed: true })

      // During transition, dimensions should be valid
      if (result.current.isTransitioning) {
        expect(result.current.dimensions).not.toBeNull()
        expect(result.current.dimensions?.width).toBeGreaterThan(0)
      }
    })

    it('should use easing for smooth transitions', async () => {
      const { result, rerender } = renderHook(
        ({ collapsed }) => useMatrixLayout({ sidebarCollapsed: collapsed }),
        { initialProps: { collapsed: false } }
      )

      await waitFor(() => {
        expect(result.current.dimensions).not.toBeNull()
      })

      const initialDimensions = result.current.dimensions

      rerender({ collapsed: true })

      // Transition should provide intermediate values
      if (result.current.isTransitioning && result.current.transitionProgress > 0) {
        const currentDimensions = result.current.dimensions
        expect(currentDimensions).not.toEqual(initialDimensions)
      }
    })
  })
})