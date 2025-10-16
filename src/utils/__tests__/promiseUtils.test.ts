import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { withTimeout, withFallback } from '../promiseUtils'

describe('promiseUtils', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('withTimeout', () => {
    it('should resolve when promise resolves before timeout', async () => {
      const promise = Promise.resolve('success')
      const resultPromise = withTimeout(promise, 1000)

      const result = await resultPromise
      expect(result).toBe('success')
    })

    it('should reject when timeout is reached', async () => {
      const promise = new Promise((resolve) => {
        setTimeout(() => resolve('too late'), 2000)
      })

      const resultPromise = withTimeout(promise, 1000)

      // Advance timers to trigger timeout
      vi.advanceTimersByTime(1000)

      await expect(resultPromise).rejects.toThrow('Timeout after 1000ms')
    })

    it('should use custom error message when provided', async () => {
      const promise = new Promise((resolve) => {
        setTimeout(() => resolve('too late'), 2000)
      })

      const resultPromise = withTimeout(promise, 1000, 'Custom timeout error')

      // Advance timers to trigger timeout
      vi.advanceTimersByTime(1000)

      await expect(resultPromise).rejects.toThrow('Custom timeout error')
    })

    it('should handle promise rejection before timeout', async () => {
      const promise = Promise.reject(new Error('Promise error'))
      const resultPromise = withTimeout(promise, 1000)

      await expect(resultPromise).rejects.toThrow('Promise error')
    })

    it('should preserve promise return type', async () => {
      interface TestData {
        id: string
        value: number
      }

      const testData: TestData = { id: 'test', value: 42 }
      const promise = Promise.resolve(testData)
      const result = await withTimeout(promise, 1000)

      // TypeScript type check
      expect(result.id).toBe('test')
      expect(result.value).toBe(42)
    })
  })

  describe('withFallback', () => {
    it('should return promise result on success', async () => {
      const promise = Promise.resolve('success')
      const result = await withFallback(promise, 'fallback')

      expect(result).toBe('success')
    })

    it('should return fallback value on error', async () => {
      const promise = Promise.reject(new Error('Failed'))
      const result = await withFallback(promise, 'fallback')

      expect(result).toBe('fallback')
    })

    it('should call fallback function on error', async () => {
      const promise = Promise.reject(new Error('Failed'))
      const fallbackFn = vi.fn(() => 'computed fallback')
      const result = await withFallback(promise, fallbackFn)

      expect(fallbackFn).toHaveBeenCalledOnce()
      expect(result).toBe('computed fallback')
    })

    it('should not call fallback function on success', async () => {
      const promise = Promise.resolve('success')
      const fallbackFn = vi.fn(() => 'fallback')
      const result = await withFallback(promise, fallbackFn)

      expect(fallbackFn).not.toHaveBeenCalled()
      expect(result).toBe('success')
    })

    it('should preserve promise return type with value fallback', async () => {
      interface TestData {
        id: string
        value: number
      }

      const testData: TestData = { id: 'test', value: 42 }
      const fallbackData: TestData = { id: 'fallback', value: 0 }

      const promise = Promise.resolve(testData)
      const result = await withFallback(promise, fallbackData)

      // TypeScript type check
      expect(result.id).toBe('test')
      expect(result.value).toBe(42)
    })

    it('should preserve promise return type with function fallback', async () => {
      interface TestData {
        id: string
        value: number
      }

      const fallbackData: TestData = { id: 'fallback', value: 0 }
      const promise = Promise.reject(new Error('Failed'))
      const result = await withFallback(promise, () => fallbackData)

      // TypeScript type check
      expect(result.id).toBe('fallback')
      expect(result.value).toBe(0)
    })
  })

  describe('combined usage', () => {
    it('should work with withTimeout and withFallback together', async () => {
      const slowPromise = new Promise((resolve) => {
        setTimeout(() => resolve('too late'), 2000)
      })

      const timeoutPromise = withTimeout(slowPromise, 1000, 'Timeout')
      const resultPromise = withFallback(timeoutPromise, 'fallback value')

      // Advance timers to trigger timeout
      vi.advanceTimersByTime(1000)

      const result = await resultPromise
      expect(result).toBe('fallback value')
    })
  })
})
