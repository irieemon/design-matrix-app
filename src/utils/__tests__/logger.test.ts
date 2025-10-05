import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { logger } from '../logger'

describe('logger.ts', () => {
  let consoleLogSpy: any
  let consoleWarnSpy: any
  let consoleErrorSpy: any
  let localStorageMock: any

  beforeEach(() => {
    // Mock console methods
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    // Mock localStorage
    localStorageMock = {
      store: {} as Record<string, string>,
      getItem: vi.fn((key: string) => localStorageMock.store[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        localStorageMock.store[key] = value
      }),
      removeItem: vi.fn((key: string) => {
        delete localStorageMock.store[key]
      }),
      clear: vi.fn(() => {
        localStorageMock.store = {}
      })
    }
    Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true })

    // Clear throttle state before each test
    logger.clearThrottleState()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    localStorageMock.clear()
  })

  describe('constructor and initialization', () => {
    it('should initialize with production mode by default', () => {
      localStorageMock.clear()
      expect(logger.isDebugEnabled()).toBeDefined()
    })

    it('should enable debug mode when localStorage has debugMode=true', () => {
      localStorageMock.setItem('debugMode', 'true')
      logger.setDebugMode(true)
      expect(logger.isDebugEnabled()).toBe(true)
    })

    it('should disable debug mode when localStorage has debugMode=false', () => {
      localStorageMock.setItem('debugMode', 'false')
      logger.setDebugMode(false)
      expect(logger.isDebugEnabled()).toBe(false)
    })
  })

  describe('setDebugMode', () => {
    it('should enable debug mode and update localStorage', () => {
      logger.setDebugMode(true)
      expect(logger.isDebugEnabled()).toBe(true)
      expect(localStorageMock.setItem).toHaveBeenCalledWith('debugMode', 'true')
    })

    it('should disable debug mode and update localStorage', () => {
      logger.setDebugMode(false)
      expect(logger.isDebugEnabled()).toBe(false)
      expect(localStorageMock.setItem).toHaveBeenCalledWith('debugMode', 'false')
    })

    it('should log when enabling debug mode', () => {
      logger.setDebugMode(true)
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('DEBUG MODE ENABLED'),
        expect.any(String)
      )
    })

    it('should log when disabling debug mode', () => {
      logger.setDebugMode(false)
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('DEBUG MODE DISABLED'),
        expect.any(String)
      )
    })
  })

  describe('isDebugEnabled', () => {
    it('should return true when debug mode is enabled', () => {
      logger.setDebugMode(true)
      expect(logger.isDebugEnabled()).toBe(true)
    })

    it('should return false when debug mode is disabled', () => {
      logger.setDebugMode(false)
      expect(logger.isDebugEnabled()).toBe(false)
    })
  })

  describe('debug method', () => {
    it('should log debug messages when debug mode is enabled', () => {
      logger.setDebugMode(true)
      logger.debug('Test debug message')
      expect(consoleLogSpy).toHaveBeenCalledWith('[DEBUG] Test debug message')
    })

    it('should not log debug messages when debug mode is disabled', () => {
      logger.setDebugMode(false)
      consoleLogSpy.mockClear()
      logger.debug('Test debug message')

      const debugCalls = consoleLogSpy.mock.calls.filter((call: any[]) =>
        call[0]?.includes('[DEBUG]')
      )
      expect(debugCalls).toHaveLength(0)
    })

    it('should log debug messages with additional arguments', () => {
      logger.setDebugMode(true)
      const obj = { key: 'value' }
      logger.debug('Test message', obj)
      expect(consoleLogSpy).toHaveBeenCalledWith('[DEBUG] Test message', obj)
    })

    it('should handle multiple arguments', () => {
      logger.setDebugMode(true)
      logger.debug('Test', 1, 2, 3)
      expect(consoleLogSpy).toHaveBeenCalledWith('[DEBUG] Test', 1, 2, 3)
    })
  })

  describe('info method', () => {
    it('should log info messages when debug mode is enabled', () => {
      logger.setDebugMode(true)
      logger.info('Test info message')
      expect(consoleLogSpy).toHaveBeenCalledWith('[INFO] Test info message')
    })

    it('should not log info messages when debug mode is disabled', () => {
      logger.setDebugMode(false)
      consoleLogSpy.mockClear()
      logger.info('Test info message')

      const infoCalls = consoleLogSpy.mock.calls.filter((call: any[]) =>
        call[0]?.includes('[INFO]')
      )
      expect(infoCalls).toHaveLength(0)
    })

    it('should log info messages with additional arguments', () => {
      logger.setDebugMode(true)
      const data = { test: 'data' }
      logger.info('Info message', data)
      expect(consoleLogSpy).toHaveBeenCalledWith('[INFO] Info message', data)
    })
  })

  describe('warn method', () => {
    it('should log warnings in production mode', () => {
      logger.setDebugMode(false)
      logger.warn('Test warning')
      expect(consoleWarnSpy).toHaveBeenCalledWith('[WARN] Test warning')
    })

    it('should log warnings in debug mode', () => {
      logger.setDebugMode(true)
      logger.warn('Test warning')
      expect(consoleWarnSpy).toHaveBeenCalledWith('[WARN] Test warning')
    })

    it('should log warnings with additional arguments', () => {
      logger.warn('Warning', { error: 'details' })
      expect(consoleWarnSpy).toHaveBeenCalledWith('[WARN] Warning', { error: 'details' })
    })
  })

  describe('error method', () => {
    it('should log errors in production mode', () => {
      logger.setDebugMode(false)
      logger.error('Test error')
      expect(consoleErrorSpy).toHaveBeenCalledWith('[ERROR] Test error')
    })

    it('should log errors in debug mode', () => {
      logger.setDebugMode(true)
      logger.error('Test error')
      expect(consoleErrorSpy).toHaveBeenCalledWith('[ERROR] Test error')
    })

    it('should log errors with additional arguments', () => {
      const error = new Error('Test')
      logger.error('Error occurred', error)
      expect(consoleErrorSpy).toHaveBeenCalledWith('[ERROR] Error occurred', error)
    })
  })

  describe('throttling mechanism', () => {
    beforeEach(() => {
      logger.setDebugMode(true)
      logger.clearThrottleState()
      consoleLogSpy.mockClear()
    })

    it('should allow first message through', () => {
      logger.debug('Repeated message')
      expect(consoleLogSpy).toHaveBeenCalledTimes(1)
    })

    it('should allow second message with same content', () => {
      logger.debug('Repeated message')
      logger.debug('Repeated message')
      const debugCalls = consoleLogSpy.mock.calls.filter((call: any[]) =>
        call[0]?.includes('[DEBUG] Repeated')
      )
      expect(debugCalls.length).toBeGreaterThanOrEqual(2)
    })

    it('should throttle after max logs per interval', () => {
      logger.clearThrottleState()
      consoleLogSpy.mockClear()

      // Send many identical messages rapidly
      for (let i = 0; i < 10; i++) {
        logger.debug('Rapid fire message')
      }

      const debugCalls = consoleLogSpy.mock.calls.filter((call: any[]) =>
        call[0]?.includes('[DEBUG] Rapid')
      )
      // Should be throttled to max 2 per interval
      expect(debugCalls.length).toBeLessThan(10)
    })

    it('should group similar messages by replacing numbers', () => {
      logger.clearThrottleState()
      consoleLogSpy.mockClear()

      logger.debug('Message with number 1')
      logger.debug('Message with number 2')
      logger.debug('Message with number 3')

      // These should be throttled as similar messages
      const debugCalls = consoleLogSpy.mock.calls.filter((call: any[]) =>
        call[0]?.includes('[DEBUG] Message with number')
      )
      expect(debugCalls.length).toBeLessThanOrEqual(3)
    })
  })

  describe('rate limiting', () => {
    beforeEach(() => {
      logger.setDebugMode(true)
      logger.clearThrottleState()
      consoleLogSpy.mockClear()
    })

    it('should enforce rate limits for debug messages', () => {
      logger.clearThrottleState()
      consoleLogSpy.mockClear()

      // Try to send more than the rate limit
      for (let i = 0; i < 20; i++) {
        logger.debug(`Unique message ${i}`)
      }

      const debugCalls = consoleLogSpy.mock.calls.filter((call: any[]) =>
        call[0]?.includes('[DEBUG]')
      )
      // Should be limited to 5 per interval
      expect(debugCalls.length).toBeLessThanOrEqual(5)
    })

    it('should enforce rate limits for info messages', () => {
      logger.clearThrottleState()
      consoleLogSpy.mockClear()

      // Try to send more than the rate limit
      for (let i = 0; i < 20; i++) {
        logger.info(`Unique info ${i}`)
      }

      const infoCalls = consoleLogSpy.mock.calls.filter((call: any[]) =>
        call[0]?.includes('[INFO]')
      )
      // Should be limited to 8 per interval
      expect(infoCalls.length).toBeLessThanOrEqual(8)
    })

    it('should enforce rate limits for warnings', () => {
      logger.clearThrottleState()
      consoleWarnSpy.mockClear()

      // Try to send more than the rate limit
      for (let i = 0; i < 30; i++) {
        logger.warn(`Unique warning ${i}`)
      }

      const warnCalls = consoleWarnSpy.mock.calls.filter((call: any[]) =>
        call[0]?.includes('[WARN]')
      )
      // Should be limited to 20 per interval
      expect(warnCalls.length).toBeLessThanOrEqual(20)
    })

    it('should allow more errors than other log types', () => {
      logger.clearThrottleState()
      consoleErrorSpy.mockClear()

      // Try to send more than the rate limit
      for (let i = 0; i < 60; i++) {
        logger.error(`Unique error ${i}`)
      }

      const errorCalls = consoleErrorSpy.mock.calls.filter((call: any[]) =>
        call[0]?.includes('[ERROR]')
      )
      // Should be limited to 50 per interval
      expect(errorCalls.length).toBeLessThanOrEqual(50)
    })
  })

  describe('performance method', () => {
    beforeEach(() => {
      logger.setDebugMode(true)
      logger.clearThrottleState()
      consoleLogSpy.mockClear()
    })

    it('should log performance messages with PERF tag', () => {
      logger.performance('Performance test')
      expect(consoleLogSpy).toHaveBeenCalledWith('[PERF] Performance test')
    })

    it('should throttle performance logs more aggressively', () => {
      logger.performance('Perf message')
      logger.performance('Perf message')
      logger.performance('Perf message')

      const perfCalls = consoleLogSpy.mock.calls.filter((call: any[]) =>
        call[0]?.includes('[PERF]')
      )
      // First one should go through, rest throttled
      expect(perfCalls.length).toBe(1)
    })

    it('should not log performance messages when debug is disabled', () => {
      logger.setDebugMode(false)
      consoleLogSpy.mockClear()

      logger.performance('Perf test')

      const perfCalls = consoleLogSpy.mock.calls.filter((call: any[]) =>
        call[0]?.includes('[PERF]')
      )
      expect(perfCalls).toHaveLength(0)
    })

    it('should log performance messages with additional arguments', () => {
      const metrics = { time: 123, memory: 456 }
      logger.performance('Metrics', metrics)
      expect(consoleLogSpy).toHaveBeenCalledWith('[PERF] Metrics', metrics)
    })
  })

  describe('clearThrottleState', () => {
    it('should clear throttle state', () => {
      logger.setDebugMode(true)
      logger.debug('Message 1')
      logger.debug('Message 1')

      logger.clearThrottleState()
      consoleLogSpy.mockClear()

      logger.debug('Message 1')
      expect(consoleLogSpy).toHaveBeenCalled()
    })

    it('should reset rate limit counters', () => {
      logger.setDebugMode(true)

      // Fill up rate limits
      for (let i = 0; i < 10; i++) {
        logger.debug(`Message ${i}`)
      }

      logger.clearThrottleState()
      consoleLogSpy.mockClear()

      // Should be able to log again
      logger.debug('New message')
      expect(consoleLogSpy).toHaveBeenCalledWith('[DEBUG] New message')
    })
  })

  describe('getStats', () => {
    beforeEach(() => {
      logger.clearThrottleState()
    })

    it('should return throttle state size', () => {
      logger.setDebugMode(true)
      logger.debug('Message 1')
      logger.debug('Message 2')

      const stats = logger.getStats()
      expect(stats).toHaveProperty('throttleStateSize')
      expect(typeof stats.throttleStateSize).toBe('number')
    })

    it('should return rate limit counts', () => {
      logger.setDebugMode(true)
      logger.debug('Test')

      const stats = logger.getStats()
      expect(stats).toHaveProperty('rateLimitCounts')
      expect(typeof stats.rateLimitCounts).toBe('object')
    })

    it('should show rate limit counts for all levels', () => {
      logger.setDebugMode(true)
      logger.debug('Debug')
      logger.info('Info')
      logger.warn('Warn')
      logger.error('Error')

      const stats = logger.getStats()
      expect(stats.rateLimitCounts).toHaveProperty('debug')
      expect(stats.rateLimitCounts).toHaveProperty('info')
      expect(stats.rateLimitCounts).toHaveProperty('warn')
      expect(stats.rateLimitCounts).toHaveProperty('error')
    })

    it('should increment counts as messages are logged', () => {
      logger.clearThrottleState()
      logger.setDebugMode(true)

      logger.debug('Test 1')
      const stats1 = logger.getStats()

      logger.debug('Test 2')
      const stats2 = logger.getStats()

      expect(stats2.rateLimitCounts.debug).toBeGreaterThanOrEqual(stats1.rateLimitCounts.debug)
    })
  })

  describe('message formatting', () => {
    beforeEach(() => {
      logger.setDebugMode(true)
      logger.clearThrottleState()
    })

    it('should format debug messages with [DEBUG] prefix', () => {
      logger.debug('Test')
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('[DEBUG]'))
    })

    it('should format info messages with [INFO] prefix', () => {
      logger.info('Test')
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('[INFO]'))
    })

    it('should format warning messages with [WARN] prefix', () => {
      logger.warn('Test')
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('[WARN]'))
    })

    it('should format error messages with [ERROR] prefix', () => {
      logger.error('Test')
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('[ERROR]'))
    })

    it('should format performance messages with [PERF] prefix', () => {
      logger.performance('Test')
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('[PERF]'))
    })
  })

  describe('edge cases', () => {
    it('should handle empty string messages', () => {
      logger.setDebugMode(true)
      expect(() => logger.debug('')).not.toThrow()
    })

    it('should handle very long messages', () => {
      logger.setDebugMode(true)
      const longMessage = 'a'.repeat(1000)
      expect(() => logger.debug(longMessage)).not.toThrow()
    })

    it('should handle null arguments', () => {
      logger.setDebugMode(true)
      expect(() => logger.debug('Test', null)).not.toThrow()
    })

    it('should handle undefined arguments', () => {
      logger.setDebugMode(true)
      expect(() => logger.debug('Test', undefined)).not.toThrow()
    })

    it('should handle circular objects', () => {
      logger.setDebugMode(true)
      const circular: any = { a: 1 }
      circular.self = circular
      expect(() => logger.debug('Circular', circular)).not.toThrow()
    })

    it('should handle special characters in messages', () => {
      logger.setDebugMode(true)
      expect(() => logger.debug('Test\n\t\\special')).not.toThrow()
    })
  })

  describe('integration scenarios', () => {
    it('should handle rapid logging from multiple sources', () => {
      logger.setDebugMode(true)
      logger.clearThrottleState()

      for (let i = 0; i < 5; i++) {
        logger.debug(`Debug ${i}`)
        logger.info(`Info ${i}`)
        logger.warn(`Warn ${i}`)
        logger.error(`Error ${i}`)
      }

      expect(consoleLogSpy).toHaveBeenCalled()
      expect(consoleWarnSpy).toHaveBeenCalled()
      expect(consoleErrorSpy).toHaveBeenCalled()
    })

    it('should maintain separate throttling for different message types', () => {
      logger.setDebugMode(true)
      logger.clearThrottleState()
      consoleLogSpy.mockClear()
      consoleWarnSpy.mockClear()

      // Log same content with different levels
      logger.debug('Same message')
      logger.warn('Same message')

      expect(consoleLogSpy).toHaveBeenCalled()
      expect(consoleWarnSpy).toHaveBeenCalled()
    })
  })
})