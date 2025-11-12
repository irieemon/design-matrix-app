/**
 * useFullScreenMode - Browser API integration for full-screen mode
 *
 * Provides a React hook interface to the browser's Fullscreen API with
 * proper state management, error handling, and cleanup.
 *
 * Features:
 * - Enter/exit full-screen mode
 * - Track full-screen state
 * - Handle browser compatibility
 * - Cleanup on unmount
 * - Error handling for blocked requests
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { logger } from '../utils/logger'

export interface UseFullScreenModeOptions {
  /** Element to make full-screen (defaults to document.documentElement) */
  element?: HTMLElement | null
  /** Callback when full-screen mode is entered */
  onEnter?: () => void
  /** Callback when full-screen mode is exited */
  onExit?: () => void
  /** Callback when full-screen request fails */
  onError?: (error: Error) => void
}

export interface UseFullScreenModeReturn {
  /** Whether currently in full-screen mode */
  isFullScreen: boolean
  /** Whether full-screen API is supported */
  isSupported: boolean
  /** Enter full-screen mode */
  enterFullScreen: () => Promise<void>
  /** Exit full-screen mode */
  exitFullScreen: () => Promise<void>
  /** Toggle full-screen mode */
  toggleFullScreen: () => Promise<void>
  /** Error from last operation */
  error: Error | null
}

/**
 * Hook for managing full-screen mode with browser Fullscreen API
 *
 * @example
 * ```tsx
 * const { isFullScreen, enterFullScreen, exitFullScreen, toggleFullScreen } = useFullScreenMode({
 *   onEnter: () => console.log('Entered full-screen'),
 *   onExit: () => console.log('Exited full-screen')
 * })
 *
 * return (
 *   <button onClick={toggleFullScreen}>
 *     {isFullScreen ? 'Exit' : 'Enter'} Full Screen
 *   </button>
 * )
 * ```
 */
export function useFullScreenMode(
  options: UseFullScreenModeOptions = {}
): UseFullScreenModeReturn {
  const {
    element,
    onEnter,
    onExit,
    onError
  } = options

  const [isFullScreen, setIsFullScreen] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // Track callbacks in refs to avoid recreating effect
  const onEnterRef = useRef(onEnter)
  const onExitRef = useRef(onExit)
  const onErrorRef = useRef(onError)

  useEffect(() => {
    onEnterRef.current = onEnter
    onExitRef.current = onExit
    onErrorRef.current = onError
  }, [onEnter, onExit, onError])

  // Check if Fullscreen API is supported
  const isSupported = !!(
    document.fullscreenEnabled ||
    // @ts-ignore - Webkit prefix
    document.webkitFullscreenEnabled ||
    // @ts-ignore - Mozilla prefix
    document.mozFullScreenEnabled ||
    // @ts-ignore - MS prefix
    document.msFullscreenEnabled
  )

  /**
   * Get the current full-screen element using browser-prefixed APIs
   */
  const getFullScreenElement = useCallback((): Element | null => {
    return (
      document.fullscreenElement ||
      // @ts-ignore - Webkit prefix
      document.webkitFullscreenElement ||
      // @ts-ignore - Mozilla prefix
      document.mozFullScreenElement ||
      // @ts-ignore - MS prefix
      document.msFullscreenElement ||
      null
    )
  }, [])

  /**
   * Request full-screen mode on the specified element
   */
  const requestFullScreen = useCallback(async (el: HTMLElement): Promise<void> => {
    try {
      if (el.requestFullscreen) {
        await el.requestFullscreen()
      } else if ('webkitRequestFullscreen' in el) {
        // @ts-ignore - Webkit prefix
        await el.webkitRequestFullscreen()
      } else if ('mozRequestFullScreen' in el) {
        // @ts-ignore - Mozilla prefix
        await el.mozRequestFullScreen()
      } else if ('msRequestFullscreen' in el) {
        // @ts-ignore - MS prefix
        await el.msRequestFullscreen()
      } else {
        throw new Error('Fullscreen API not supported')
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to enter full-screen')
      logger.error('Full-screen request failed:', error)
      throw error
    }
  }, [])

  /**
   * Exit full-screen mode using browser-prefixed APIs
   */
  const exitFullScreenInternal = useCallback(async (): Promise<void> => {
    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen()
      } else if ('webkitExitFullscreen' in document) {
        // @ts-ignore - Webkit prefix
        await document.webkitExitFullscreen()
      } else if ('mozCancelFullScreen' in document) {
        // @ts-ignore - Mozilla prefix
        await document.mozCancelFullScreen()
      } else if ('msExitFullscreen' in document) {
        // @ts-ignore - MS prefix
        await document.msExitFullscreen()
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to exit full-screen')
      logger.error('Full-screen exit failed:', error)
      throw error
    }
  }, [])

  /**
   * Enter full-screen mode
   */
  const enterFullScreen = useCallback(async () => {
    if (!isSupported) {
      const error = new Error('Fullscreen API not supported in this browser')
      setError(error)
      onErrorRef.current?.(error)
      return
    }

    if (isFullScreen) {
      logger.debug('Already in full-screen mode')
      return
    }

    try {
      setError(null)
      const targetElement = element || document.documentElement
      await requestFullScreen(targetElement)
      logger.debug('Entered full-screen mode')
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to enter full-screen')
      setError(error)
      onErrorRef.current?.(error)
    }
  }, [isSupported, isFullScreen, element, requestFullScreen])

  /**
   * Exit full-screen mode
   */
  const exitFullScreen = useCallback(async () => {
    if (!isFullScreen) {
      logger.debug('Not in full-screen mode')
      return
    }

    try {
      setError(null)
      await exitFullScreenInternal()
      logger.debug('Exited full-screen mode')
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to exit full-screen')
      setError(error)
      onErrorRef.current?.(error)
    }
  }, [isFullScreen, exitFullScreenInternal])

  /**
   * Toggle full-screen mode
   */
  const toggleFullScreen = useCallback(async () => {
    if (isFullScreen) {
      await exitFullScreen()
    } else {
      await enterFullScreen()
    }
  }, [isFullScreen, enterFullScreen, exitFullScreen])

  /**
   * Handle fullscreenchange events
   */
  useEffect(() => {
    const handleFullScreenChange = () => {
      const isCurrentlyFullScreen = !!getFullScreenElement()
      setIsFullScreen(isCurrentlyFullScreen)

      if (isCurrentlyFullScreen) {
        logger.debug('Full-screen mode entered')
        onEnterRef.current?.()
      } else {
        logger.debug('Full-screen mode exited')
        onExitRef.current?.()
      }
    }

    // Listen to all prefixed fullscreenchange events
    const events = [
      'fullscreenchange',
      'webkitfullscreenchange',
      'mozfullscreenchange',
      'MSFullscreenChange'
    ]

    events.forEach(event => {
      document.addEventListener(event, handleFullScreenChange)
    })

    // Initial check
    handleFullScreenChange()

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleFullScreenChange)
      })
    }
  }, [getFullScreenElement])

  /**
   * Cleanup: Exit full-screen on unmount if currently in full-screen
   */
  useEffect(() => {
    return () => {
      if (isFullScreen) {
        exitFullScreenInternal().catch(err => {
          logger.error('Failed to exit full-screen on unmount:', err)
        })
      }
    }
  }, [isFullScreen, exitFullScreenInternal])

  return {
    isFullScreen,
    isSupported,
    enterFullScreen,
    exitFullScreen,
    toggleFullScreen,
    error
  }
}
