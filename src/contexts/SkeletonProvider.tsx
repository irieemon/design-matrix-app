/**
 * Enhanced Skeleton Provider Context
 * S-tier SaaS dashboard skeleton loading system with comprehensive state management
 */

import React, { createContext, useContext, useCallback, useMemo } from 'react'
import {
  SkeletonProviderProps,
  SkeletonContextValue,
  SkeletonAnimation,
  SkeletonAccessibilityConfig,
  SkeletonPerformanceConfig
} from '../types/skeleton'

const SkeletonContext = createContext<SkeletonContextValue | null>(null)

export const useSkeletonContext = (): SkeletonContextValue => {
  const context = useContext(SkeletonContext)
  if (!context) {
    throw new Error('useSkeletonContext must be used within a SkeletonProvider')
  }
  return context
}

// Default configurations
const DEFAULT_ACCESSIBILITY_CONFIG: SkeletonAccessibilityConfig = {
  announceLoading: true,
  loadingMessage: 'Loading content...',
  completedMessage: 'Content loaded',
  respectPreferReducedMotion: true,
  focusManagement: true
}

const DEFAULT_PERFORMANCE_CONFIG: SkeletonPerformanceConfig = {
  lazyLoad: true,
  intersectionThreshold: 0.1,
  rootMargin: '50px',
  enableGPUAcceleration: true,
  optimizeAnimations: true
}

export const SkeletonProvider: React.FC<SkeletonProviderProps> = ({
  children,
  defaultAnimation = 'shimmer',
  defaultSpeed = 'normal',
  defaultContrast = 'medium',
  respectReducedMotion = true
}) => {
  // Check for reduced motion preference
  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }, [])

  // Determine effective animation based on user preferences
  const effectiveAnimation = useMemo((): SkeletonAnimation => {
    if (respectReducedMotion && prefersReducedMotion) {
      return 'none'
    }
    return defaultAnimation
  }, [defaultAnimation, respectReducedMotion, prefersReducedMotion])

  // Animation configuration based on speed setting
  const getAnimationConfig = useCallback((animation: SkeletonAnimation, speed: 'slow' | 'normal' | 'fast') => {
    const baseConfigs = {
      pulse: { duration: 2, easing: 'cubic-bezier(0.4, 0, 0.6, 1)' },
      wave: { duration: 1.6, easing: 'ease-in-out' },
      shimmer: { duration: 2.4, easing: 'ease-in-out' },
      none: { duration: 0, easing: 'none' }
    }

    const speedMultipliers = {
      slow: 1.5,
      normal: 1,
      fast: 0.7
    }

    const config = baseConfigs[animation]
    const multiplier = speedMultipliers[speed]

    return {
      ...config,
      duration: config.duration * multiplier
    }
  }, [])

  // Accessibility utilities
  const announceLoading = useCallback((message: string = DEFAULT_ACCESSIBILITY_CONFIG.loadingMessage) => {
    if (!DEFAULT_ACCESSIBILITY_CONFIG.announceLoading) return

    // Create a temporary live region for screen reader announcements
    const announcement = document.createElement('div')
    announcement.setAttribute('aria-live', 'polite')
    announcement.setAttribute('aria-atomic', 'true')
    announcement.className = 'sr-only'
    announcement.textContent = message

    document.body.appendChild(announcement)

    // Remove after announcement is made
    setTimeout(() => {
      document.body.removeChild(announcement)
    }, 1000)
  }, [])

  const announceComplete = useCallback((message: string = DEFAULT_ACCESSIBILITY_CONFIG.completedMessage) => {
    if (!DEFAULT_ACCESSIBILITY_CONFIG.announceLoading) return
    announceLoading(message)
  }, [announceLoading])

  // Performance utilities
  const createIntersectionObserver = useCallback((callback: IntersectionObserverCallback) => {
    if (!DEFAULT_PERFORMANCE_CONFIG.lazyLoad || typeof window === 'undefined') {
      return null
    }

    return new IntersectionObserver(callback, {
      threshold: DEFAULT_PERFORMANCE_CONFIG.intersectionThreshold,
      rootMargin: DEFAULT_PERFORMANCE_CONFIG.rootMargin
    })
  }, [])

  // GPU acceleration utilities
  const enableGPUAcceleration = useCallback((element: HTMLElement) => {
    if (!DEFAULT_PERFORMANCE_CONFIG.enableGPUAcceleration) return

    element.style.transform = 'translateZ(0)'
    element.style.backfaceVisibility = 'hidden'
    element.style.perspective = '1000px'
  }, [])

  // Stagger animation utilities
  const createStaggeredAnimation = useCallback((
    elements: HTMLElement[],
    _animation: SkeletonAnimation,
    staggerDelay: number = 100
  ) => {
    elements.forEach((element, index) => {
      const delay = index * staggerDelay
      element.style.animationDelay = `${delay}ms`

      if (DEFAULT_PERFORMANCE_CONFIG.enableGPUAcceleration) {
        enableGPUAcceleration(element)
      }
    })
  }, [enableGPUAcceleration])

  // Responsive utilities
  const getResponsiveClasses = useCallback((breakpoint: string) => {
    const responsiveMap = {
      mobile: 'sm:',
      tablet: 'md:',
      desktop: 'lg:',
      xl: 'xl:'
    }
    return responsiveMap[breakpoint as keyof typeof responsiveMap] || ''
  }, [])

  // Context value
  const contextValue = useMemo((): SkeletonContextValue => ({
    defaultAnimation: effectiveAnimation,
    defaultSpeed,
    defaultContrast,
    respectReducedMotion: prefersReducedMotion,

    // Configuration getters
    getAnimationConfig,

    // Accessibility utilities
    announceLoading,
    announceComplete,

    // Performance utilities
    createIntersectionObserver,
    enableGPUAcceleration,
    createStaggeredAnimation,

    // Responsive utilities
    getResponsiveClasses,

    // Configuration objects
    accessibilityConfig: DEFAULT_ACCESSIBILITY_CONFIG,
    performanceConfig: DEFAULT_PERFORMANCE_CONFIG
  }), [
    effectiveAnimation,
    defaultSpeed,
    defaultContrast,
    prefersReducedMotion,
    getAnimationConfig,
    announceLoading,
    announceComplete,
    createIntersectionObserver,
    enableGPUAcceleration,
    createStaggeredAnimation,
    getResponsiveClasses
  ])

  return (
    <SkeletonContext.Provider value={contextValue}>
      {children}
    </SkeletonContext.Provider>
  )
}

export default SkeletonProvider