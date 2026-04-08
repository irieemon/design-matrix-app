import { describe, it, expect, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useBreakpoint } from '../useBreakpoint'

function setViewportWidth(width: number): void {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  })
}

describe('useBreakpoint', () => {
  afterEach(() => {
    setViewportWidth(1024)
  })

  it('should return isMobile=true when window width is 375', () => {
    setViewportWidth(375)
    const { result } = renderHook(() => useBreakpoint())
    expect(result.current).toEqual({
      isMobile: true,
      isTablet: false,
      isDesktop: false,
      width: 375,
    })
  })

  it('should return isTablet=true when window width is 768', () => {
    setViewportWidth(768)
    const { result } = renderHook(() => useBreakpoint())
    expect(result.current).toEqual({
      isMobile: false,
      isTablet: true,
      isDesktop: false,
      width: 768,
    })
  })

  it('should return isDesktop=true when window width is 1280', () => {
    setViewportWidth(1280)
    const { result } = renderHook(() => useBreakpoint())
    expect(result.current).toEqual({
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      width: 1280,
    })
  })

  it('should update when window resize event fires', () => {
    setViewportWidth(1280)
    const { result } = renderHook(() => useBreakpoint())
    expect(result.current.isDesktop).toBe(true)

    act(() => {
      setViewportWidth(375)
      window.dispatchEvent(new Event('resize'))
    })

    expect(result.current.isMobile).toBe(true)
    expect(result.current.width).toBe(375)
  })

  it('should remove resize listener on unmount', () => {
    setViewportWidth(1280)
    const { unmount, result } = renderHook(() => useBreakpoint())
    unmount()

    // After unmount, firing resize must not throw or update stale state
    act(() => {
      setViewportWidth(375)
      window.dispatchEvent(new Event('resize'))
    })

    // Last rendered value should still be the desktop value
    expect(result.current.isDesktop).toBe(true)
  })
})
