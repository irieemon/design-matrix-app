/**
 * useBreakpoint - shared viewport hook for responsive branching.
 *
 * Thresholds align with Tailwind md/lg:
 *   mobile:  width <  768
 *   tablet:  768 <= width < 1024
 *   desktop: width >= 1024
 *
 * SSR-safe: defaults to desktop when `window` is undefined.
 */
import { useEffect, useState } from 'react'

export interface Breakpoint {
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
  width: number
}

const MOBILE_MAX = 768
const TABLET_MAX = 1024

function computeBreakpoint(width: number): Breakpoint {
  return {
    isMobile: width < MOBILE_MAX,
    isTablet: width >= MOBILE_MAX && width < TABLET_MAX,
    isDesktop: width >= TABLET_MAX,
    width,
  }
}

function getInitialBreakpoint(): Breakpoint {
  if (typeof window === 'undefined') {
    // SSR-safe default: desktop
    return computeBreakpoint(TABLET_MAX)
  }
  return computeBreakpoint(window.innerWidth)
}

export function useBreakpoint(): Breakpoint {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>(getInitialBreakpoint)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleResize = (): void => {
      setBreakpoint(computeBreakpoint(window.innerWidth))
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return breakpoint
}
