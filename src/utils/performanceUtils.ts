/**
 * Performance Utilities
 *
 * PERFORMANCE OPTIMIZATION: Utilities for debouncing, throttling, and optimizing
 * expensive operations to prevent performance degradation.
 *
 * Key Benefits:
 * - Debounce: Reduce API calls for search/input (typing delay)
 * - Throttle: Limit scroll/resize handlers (max frequency)
 * - RAF: Smooth animations with requestAnimationFrame
 * - Batch: Combine multiple operations into single execution
 */

/**
 * Debounce function - delays execution until after wait time has elapsed
 * Perfect for: search inputs, form validation, resize handlers
 *
 * @example
 * ```typescript
 * const debouncedSearch = debounce((query: string) => {
 *   searchAPI(query)
 * }, 300)
 *
 * // Only calls searchAPI after user stops typing for 300ms
 * input.addEventListener('input', (e) => debouncedSearch(e.target.value))
 * ```
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null

  return function(this: any, ...args: Parameters<T>) {
    const context = this

    if (timeout) {
      clearTimeout(timeout)
    }

    timeout = setTimeout(() => {
      func.apply(context, args)
      timeout = null
    }, wait)
  }
}

/**
 * Throttle function - ensures function is called at most once per time period
 * Perfect for: scroll handlers, mouse move, window resize
 *
 * @example
 * ```typescript
 * const throttledScroll = throttle(() => {
 *   updateScrollPosition()
 * }, 100)
 *
 * // Only calls updateScrollPosition max once per 100ms
 * window.addEventListener('scroll', throttledScroll)
 * ```
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false
  let lastResult: ReturnType<T>

  return function(this: any, ...args: Parameters<T>) {
    const context = this

    if (!inThrottle) {
      lastResult = func.apply(context, args)
      inThrottle = true

      setTimeout(() => {
        inThrottle = false
      }, wait)
    }

    return lastResult
  }
}

/**
 * RequestAnimationFrame-based throttle for smooth 60fps animations
 * Perfect for: canvas rendering, animation updates, visual effects
 *
 * @example
 * ```typescript
 * const rafScrollHandler = rafThrottle((scrollY: number) => {
 *   updateParallax(scrollY)
 * })
 *
 * window.addEventListener('scroll', () => rafScrollHandler(window.scrollY))
 * ```
 */
export function rafThrottle<T extends (...args: any[]) => any>(
  func: T
): (...args: Parameters<T>) => void {
  let rafId: number | null = null

  return function(this: any, ...args: Parameters<T>) {
    const context = this

    if (rafId !== null) {
      return
    }

    rafId = requestAnimationFrame(() => {
      func.apply(context, args)
      rafId = null
    })
  }
}

/**
 * Batch operations to run in next microtask
 * Perfect for: multiple state updates, DOM batch updates
 *
 * @example
 * ```typescript
 * const batchUpdate = createBatcher((items: string[]) => {
 *   updateUI(items)
 * })
 *
 * // These all get batched into single call with ['a', 'b', 'c']
 * batchUpdate('a')
 * batchUpdate('b')
 * batchUpdate('c')
 * ```
 */
export function createBatcher<T>(
  callback: (items: T[]) => void
): (item: T) => void {
  let batch: T[] = []
  let pending = false

  return (item: T) => {
    batch.push(item)

    if (!pending) {
      pending = true
      queueMicrotask(() => {
        callback(batch)
        batch = []
        pending = false
      })
    }
  }
}

/**
 * Delay execution until browser is idle
 * Perfect for: analytics, non-critical updates, background tasks
 *
 * @example
 * ```typescript
 * runWhenIdle(() => {
 *   sendAnalytics()
 * })
 * ```
 */
export function runWhenIdle(
  callback: () => void,
  options?: IdleRequestOptions
): number {
  if ('requestIdleCallback' in window) {
    return window.requestIdleCallback(callback, options)
  } else {
    // Fallback for browsers without requestIdleCallback
    return setTimeout(callback, 1) as unknown as number
  }
}

/**
 * Cancel idle callback
 */
export function cancelIdleCallback(id: number): void {
  if ('cancelIdleCallback' in window) {
    window.cancelIdleCallback(id)
  } else {
    clearTimeout(id)
  }
}

/**
 * Memoize expensive function results
 * Perfect for: expensive calculations, data transformations
 *
 * @example
 * ```typescript
 * const expensiveCalc = memoize((n: number) => {
 *   return Array.from({ length: n }, (_, i) => fibonacci(i))
 * })
 *
 * expensiveCalc(100) // Calculated
 * expensiveCalc(100) // Cached!
 * ```
 */
export function memoize<T extends (...args: any[]) => any>(
  fn: T,
  getCacheKey?: (...args: Parameters<T>) => string
): T {
  const cache = new Map<string, ReturnType<T>>()

  return ((...args: Parameters<T>) => {
    const key = getCacheKey ? getCacheKey(...args) : JSON.stringify(args)

    if (cache.has(key)) {
      return cache.get(key)!
    }

    const result = fn(...args)
    cache.set(key, result)
    return result
  }) as T
}

/**
 * Once function - ensures function only runs once
 * Perfect for: initialization, one-time setup
 *
 * @example
 * ```typescript
 * const initializeApp = once(() => {
 *   setupAnalytics()
 *   loadSettings()
 * })
 *
 * initializeApp() // Runs
 * initializeApp() // No-op
 * ```
 */
export function once<T extends (...args: any[]) => any>(fn: T): T {
  let called = false
  let result: ReturnType<T>

  return ((...args: Parameters<T>) => {
    if (!called) {
      called = true
      result = fn(...args)
    }
    return result
  }) as T
}

/**
 * Performance measurement utility
 * Perfect for: profiling, optimization identification
 *
 * @example
 * ```typescript
 * const measure = measurePerformance()
 * expensiveOperation()
 * console.log(`Took ${measure()} ms`)
 * ```
 */
export function measurePerformance(): () => number {
  const start = performance.now()
  return () => performance.now() - start
}

/**
 * Async debounce with promise support
 * Perfect for: async API calls, database queries
 *
 * @example
 * ```typescript
 * const debouncedFetch = asyncDebounce(async (query: string) => {
 *   return await fetch(`/api/search?q=${query}`)
 * }, 300)
 *
 * const result = await debouncedFetch('test')
 * ```
 */
export function asyncDebounce<T extends (...args: any[]) => Promise<any>>(
  func: T,
  wait: number
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  let timeout: ReturnType<typeof setTimeout> | null = null
  let resolveList: Array<(value: ReturnType<T>) => void> = []
  let rejectList: Array<(reason?: any) => void> = []

  return function(...args: Parameters<T>): Promise<ReturnType<T>> {
    return new Promise<ReturnType<T>>((resolve, reject) => {
      if (timeout) {
        clearTimeout(timeout)
      }

      resolveList.push(resolve)
      rejectList.push(reject)

      timeout = setTimeout(async () => {
        const currentResolveList = resolveList
        const currentRejectList = rejectList

        resolveList = []
        rejectList = []

        try {
          const result = await func(...args)
          currentResolveList.forEach(r => r(result))
        } catch (error) {
          currentRejectList.forEach(r => r(error))
        }

        timeout = null
      }, wait)
    })
  }
}

/**
 * Leading edge debounce - execute immediately, then debounce
 * Perfect for: button clicks that shouldn't be spammed
 *
 * @example
 * ```typescript
 * const handleSubmit = leadingDebounce(() => {
 *   submitForm()
 * }, 1000)
 *
 * // First click executes immediately
 * // Subsequent clicks within 1s are ignored
 * ```
 */
export function leadingDebounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null

  return function(this: any, ...args: Parameters<T>) {
    const context = this
    const callNow = !timeout

    if (timeout) {
      clearTimeout(timeout)
    }

    timeout = setTimeout(() => {
      timeout = null
    }, wait)

    if (callNow) {
      func.apply(context, args)
    }
  }
}
