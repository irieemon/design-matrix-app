/**
 * Accessibility utilities and hooks for WCAG 2.1 AA compliance
 *
 * Provides keyboard navigation, focus management, and ARIA utilities
 * for building accessible components throughout the application.
 */

import { useEffect, useRef, useCallback, useState } from 'react'

/**
 * Hook for managing focus trap in modals and overlays
 * Ensures keyboard navigation stays within the modal
 */
export function useFocusTrap(isActive: boolean = false) {
  const containerRef = useRef<HTMLElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!isActive || !containerRef.current) return

    const container = containerRef.current

    // Store the currently focused element
    previousFocusRef.current = document.activeElement as HTMLElement

    // Get all focusable elements within the container
    const getFocusableElements = () => {
      return container.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled]), details[open] summary'
      ) as NodeListOf<HTMLElement>
    }

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      const focusableElements = getFocusableElements()
      if (focusableElements.length === 0) return

      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          e.preventDefault()
          lastElement.focus()
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault()
          firstElement.focus()
        }
      }
    }

    // Focus the first focusable element
    const focusableElements = getFocusableElements()
    if (focusableElements.length > 0) {
      focusableElements[0].focus()
    }

    document.addEventListener('keydown', handleTabKey)

    return () => {
      document.removeEventListener('keydown', handleTabKey)

      // Restore focus to the previously focused element
      if (previousFocusRef.current) {
        previousFocusRef.current.focus()
      }
    }
  }, [isActive])

  return containerRef
}

/**
 * Hook for keyboard navigation support
 * Provides arrow key navigation for lists and grids
 */
export function useKeyboardNavigation(
  items: HTMLElement[],
  options: {
    direction?: 'horizontal' | 'vertical' | 'grid'
    loop?: boolean
    gridColumns?: number
  } = {}
) {
  const { direction = 'vertical', loop = true, gridColumns = 1 } = options
  const [currentIndex, setCurrentIndex] = useState(-1)

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (items.length === 0) return

    let newIndex = currentIndex
    const maxIndex = items.length - 1

    switch (e.key) {
      case 'ArrowDown':
        if (direction === 'vertical' || direction === 'grid') {
          e.preventDefault()
          if (direction === 'grid') {
            newIndex = Math.min(maxIndex, currentIndex + gridColumns)
          } else {
            newIndex = currentIndex === maxIndex ? (loop ? 0 : maxIndex) : currentIndex + 1
          }
        }
        break

      case 'ArrowUp':
        if (direction === 'vertical' || direction === 'grid') {
          e.preventDefault()
          if (direction === 'grid') {
            newIndex = Math.max(0, currentIndex - gridColumns)
          } else {
            newIndex = currentIndex === 0 ? (loop ? maxIndex : 0) : currentIndex - 1
          }
        }
        break

      case 'ArrowRight':
        if (direction === 'horizontal' || direction === 'grid') {
          e.preventDefault()
          if (direction === 'grid') {
            const rowStart = Math.floor(currentIndex / gridColumns) * gridColumns
            const rowEnd = Math.min(maxIndex, rowStart + gridColumns - 1)
            newIndex = currentIndex === rowEnd ? (loop ? rowStart : rowEnd) : Math.min(rowEnd, currentIndex + 1)
          } else {
            newIndex = currentIndex === maxIndex ? (loop ? 0 : maxIndex) : currentIndex + 1
          }
        }
        break

      case 'ArrowLeft':
        if (direction === 'horizontal' || direction === 'grid') {
          e.preventDefault()
          if (direction === 'grid') {
            const rowStart = Math.floor(currentIndex / gridColumns) * gridColumns
            const rowEnd = Math.min(maxIndex, rowStart + gridColumns - 1)
            newIndex = currentIndex === rowStart ? (loop ? rowEnd : rowStart) : Math.max(rowStart, currentIndex - 1)
          } else {
            newIndex = currentIndex === 0 ? (loop ? maxIndex : 0) : currentIndex - 1
          }
        }
        break

      case 'Home':
        e.preventDefault()
        newIndex = 0
        break

      case 'End':
        e.preventDefault()
        newIndex = maxIndex
        break
    }

    if (newIndex !== currentIndex && newIndex >= 0 && newIndex <= maxIndex) {
      setCurrentIndex(newIndex)
      items[newIndex]?.focus()
    }
  }, [currentIndex, items, direction, loop, gridColumns])

  return {
    currentIndex,
    setCurrentIndex,
    handleKeyDown
  }
}

/**
 * Hook for managing ARIA live regions
 * Announces dynamic content changes to screen readers
 */
export function useAriaLiveRegion() {
  const [liveRegion, setLiveRegion] = useState<HTMLDivElement | null>(null)

  useEffect(() => {
    // Create live region if it doesn't exist
    if (!liveRegion) {
      const region = document.createElement('div')
      region.setAttribute('aria-live', 'polite')
      region.setAttribute('aria-atomic', 'true')
      region.className = 'sr-only'
      region.style.position = 'absolute'
      region.style.left = '-10000px'
      region.style.width = '1px'
      region.style.height = '1px'
      region.style.overflow = 'hidden'

      document.body.appendChild(region)
      setLiveRegion(region)
    }

    return () => {
      if (liveRegion && document.body.contains(liveRegion)) {
        document.body.removeChild(liveRegion)
      }
    }
  }, [liveRegion])

  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (!liveRegion) return

    // Clear the region first
    liveRegion.textContent = ''
    liveRegion.setAttribute('aria-live', priority)

    // Announce the message after a brief delay to ensure screen readers pick it up
    setTimeout(() => {
      liveRegion.textContent = message
    }, 100)
  }, [liveRegion])

  return { announce }
}

/**
 * Hook for skip links functionality
 * Allows keyboard users to skip navigation and jump to main content
 */
export function useSkipLinks() {
  useEffect(() => {
    const skipLink = document.createElement('a')
    skipLink.href = '#main-content'
    skipLink.textContent = 'Skip to main content'
    skipLink.className = 'skip-link sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-blue-600 focus:text-white focus:px-4 focus:py-2 focus:rounded focus:text-sm focus:font-medium'
    skipLink.style.position = 'absolute'
    skipLink.style.top = '-40px'
    skipLink.style.left = '6px'
    skipLink.style.transition = 'top 0.3s'

    skipLink.addEventListener('focus', () => {
      skipLink.style.top = '6px'
    })

    skipLink.addEventListener('blur', () => {
      skipLink.style.top = '-40px'
    })

    document.body.insertBefore(skipLink, document.body.firstChild)

    return () => {
      if (document.body.contains(skipLink)) {
        document.body.removeChild(skipLink)
      }
    }
  }, [])
}

/**
 * Hook for managing reduced motion preferences
 * Respects user's motion preferences for animations
 */
export function useReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    // ✅ CRITICAL FIX: Use setTimeout(0) to prevent cascading renders
    setTimeout(() => {
      setPrefersReducedMotion(mediaQuery.matches)
    }, 0)

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches)
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  return prefersReducedMotion
}

/**
 * Utility for generating accessible IDs
 * Creates unique IDs for form controls and ARIA relationships
 */
export function useAccessibleId(prefix: string = 'accessible') {
  const idRef = useRef<string>()

  if (!idRef.current) {
    idRef.current = `${prefix}-${Math.random().toString(36).substr(2, 9)}`
  }

  return idRef.current
}

/**
 * Hook for managing color contrast and high contrast mode
 */
export function useHighContrast() {
  const [highContrast, setHighContrast] = useState(false)

  useEffect(() => {
    // Check for Windows high contrast mode
    const mediaQuery = window.matchMedia('(prefers-contrast: high)')
    // ✅ CRITICAL FIX: Use setTimeout(0) to prevent cascading renders
    setTimeout(() => {
      setHighContrast(mediaQuery.matches)
    }, 0)

    const handleChange = (e: MediaQueryListEvent) => {
      setHighContrast(e.matches)
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  return highContrast
}

/**
 * Utility functions for ARIA labels and descriptions
 */
export const ariaUtils = {
  /**
   * Generates proper ARIA label for form inputs
   */
  getInputAriaProps: (
    label: string,
    required: boolean = false,
    error?: string,
    description?: string
  ) => {
    const props: Record<string, string | boolean> = {
      'aria-label': label,
      'aria-required': required
    }

    if (error) {
      props['aria-invalid'] = true
      props['aria-describedby'] = `${label.toLowerCase().replace(/\s+/g, '-')}-error`
    }

    if (description) {
      props['aria-describedby'] = `${label.toLowerCase().replace(/\s+/g, '-')}-description`
    }

    return props
  },

  /**
   * Generates ARIA properties for buttons
   */
  getButtonAriaProps: (
    label: string,
    pressed?: boolean,
    expanded?: boolean,
    disabled: boolean = false
  ) => {
    const props: Record<string, string | boolean> = {
      'aria-label': label,
      'aria-disabled': disabled
    }

    if (pressed !== undefined) {
      props['aria-pressed'] = pressed
    }

    if (expanded !== undefined) {
      props['aria-expanded'] = expanded
    }

    return props
  },

  /**
   * Generates ARIA properties for lists and grids
   */
  getListAriaProps: (
    itemCount: number,
    _currentIndex?: number, // Currently unused
    multiSelectable: boolean = false
  ) => {
    const props: Record<string, string | boolean | number> = {
      role: 'list',
      'aria-setsize': itemCount
    }

    if (multiSelectable) {
      props['aria-multiselectable'] = true
    }

    return props
  },

  /**
   * Generates ARIA properties for draggable items
   */
  getDraggableAriaProps: (
    label: string,
    isDragging: boolean = false,
    position?: { x: number; y: number }
  ) => {
    const props: Record<string, string | boolean | number> = {
      'aria-label': label,
      'aria-grabbed': isDragging,
      role: 'button',
      tabIndex: 0
    }

    if (position) {
      props['aria-describedby'] = `Position: ${Math.round(position.x)}, ${Math.round(position.y)}`
    }

    return props
  }
}