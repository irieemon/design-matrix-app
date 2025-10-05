/**
 * Logging Service Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { LoggingService } from '../LoggingService'
import type { LogEntry, LogContext } from '../types'

describe('LoggingService', () => {
  let service: LoggingService
  let consoleSpy: {
    log: ReturnType<typeof vi.spyOn>
    warn: ReturnType<typeof vi.spyOn>
    error: ReturnType<typeof vi.spyOn>
  }

  beforeEach(() => {
    // Create fresh service instance
    service = new LoggingService({
      minLevel: 'debug',
      enableRateLimiting: false,
      enableThrottling: false
    })

    // Spy on console methods
    consoleSpy = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {})
    }
  })

  afterEach(() => {
    // Restore console
    consoleSpy.log.mockRestore()
    consoleSpy.warn.mockRestore()
    consoleSpy.error.mockRestore()
  })

  describe('Basic Logging', () => {
    it('should log debug messages', () => {
      const logger = service.createLogger()
      logger.debug('Test debug message')

      expect(consoleSpy.log).toHaveBeenCalled()
    })

    it('should log info messages', () => {
      const logger = service.createLogger()
      logger.info('Test info message')

      expect(consoleSpy.log).toHaveBeenCalled()
    })

    it('should log warn messages', () => {
      const logger = service.createLogger()
      logger.warn('Test warn message')

      expect(consoleSpy.warn).toHaveBeenCalled()
    })

    it('should log error messages with error object', () => {
      const logger = service.createLogger()
      const error = new Error('Test error')
      logger.error('Test error message', error)

      expect(consoleSpy.error).toHaveBeenCalled()
    })
  })

  describe('Structured Logging', () => {
    it('should accept data objects', () => {
      const logger = service.createLogger()
      logger.info('User action', { action: 'login', userId: '123' })

      expect(consoleSpy.log).toHaveBeenCalled()
      const stats = service.getStats()
      expect(stats.totalLogs.info).toBe(1)
    })

    it('should merge context', () => {
      const context: LogContext = {
        component: 'TestComponent',
        userId: '123'
      }

      const logger = service.createLogger(context)
      logger.info('Test message')

      expect(consoleSpy.log).toHaveBeenCalled()
    })

    it('should support scoped loggers', () => {
      const logger = service.createLogger({ component: 'Parent' })
      const scopedLogger = logger.withContext({ userId: '456' })

      scopedLogger.info('Scoped message')

      expect(consoleSpy.log).toHaveBeenCalled()
    })
  })

  describe('Log Levels', () => {
    it('should filter logs below minimum level', () => {
      const serviceWithFilter = new LoggingService({
        minLevel: 'warn',
        enableRateLimiting: false
      })

      const logger = serviceWithFilter.createLogger()

      logger.debug('Should not appear')
      logger.info('Should not appear')
      logger.warn('Should appear')
      logger.error('Should appear')

      expect(consoleSpy.warn).toHaveBeenCalledTimes(1)
      expect(consoleSpy.error).toHaveBeenCalledTimes(1)
    })

    it('should allow debug mode toggle', () => {
      // Reset spy to ignore initialization logs
      consoleSpy.log.mockClear()

      service.setDebugMode(false)
      // Clear the "DEBUG MODE DISABLED" log
      consoleSpy.log.mockClear()

      const logger = service.createLogger()
      logger.debug('Should not appear')
      expect(consoleSpy.log).not.toHaveBeenCalled()

      service.setDebugMode(true)
      // Clear the "DEBUG MODE ENABLED" log
      consoleSpy.log.mockClear()

      logger.debug('Should appear')
      expect(consoleSpy.log).toHaveBeenCalled()
    })
  })

  describe('Rate Limiting', () => {
    it('should enforce rate limits when enabled', () => {
      const rateLimitedService = new LoggingService({
        minLevel: 'debug',
        enableRateLimiting: true,
        enableThrottling: false
      })

      const logger = rateLimitedService.createLogger()

      // Exceed debug rate limit (5 per second)
      for (let i = 0; i < 10; i++) {
        logger.debug(`Message ${i}`)
      }

      const stats = rateLimitedService.getStats()
      expect(stats.totalLogs.debug).toBeLessThanOrEqual(5)
    })

    it('should not rate limit when disabled', () => {
      const logger = service.createLogger() // Rate limiting disabled in beforeEach

      for (let i = 0; i < 10; i++) {
        logger.debug(`Message ${i}`)
      }

      const stats = service.getStats()
      expect(stats.totalLogs.debug).toBe(10)
    })
  })

  describe('Throttling', () => {
    it('should throttle repeated messages', () => {
      const throttledService = new LoggingService({
        minLevel: 'debug',
        enableRateLimiting: false,
        enableThrottling: true
      })

      const logger = throttledService.createLogger()

      // Send same message multiple times rapidly
      for (let i = 0; i < 10; i++) {
        logger.info('Repeated message')
      }

      const stats = throttledService.getStats()
      expect(stats.totalLogs.info).toBeLessThan(10)
    })
  })

  describe('Performance Logging', () => {
    it('should log performance metrics', () => {
      const logger = service.createLogger()

      logger.performance({
        operation: 'test_operation',
        duration: 123,
        success: true
      })

      expect(consoleSpy.log).toHaveBeenCalled()
    })

    it('should include metadata in performance logs', () => {
      const logger = service.createLogger()

      logger.performance({
        operation: 'api_call',
        duration: 456,
        success: false,
        metadata: {
          endpoint: '/api/test',
          statusCode: 500
        }
      })

      expect(consoleSpy.log).toHaveBeenCalled()
    })
  })

  describe('Statistics', () => {
    it('should track total logs by level', () => {
      const logger = service.createLogger()

      logger.debug('debug')
      logger.info('info')
      logger.info('info2')
      logger.warn('warn')

      const stats = service.getStats()
      expect(stats.totalLogs.debug).toBe(1)
      expect(stats.totalLogs.info).toBe(2)
      expect(stats.totalLogs.warn).toBe(1)
      expect(stats.totalLogs.error).toBe(0)
    })

    it('should track dropped logs', () => {
      const rateLimitedService = new LoggingService({
        minLevel: 'debug',
        enableRateLimiting: true
      })

      const logger = rateLimitedService.createLogger()

      // Exceed rate limit
      for (let i = 0; i < 10; i++) {
        logger.debug(`Message ${i}`)
      }

      const stats = rateLimitedService.getStats()
      expect(stats.droppedLogs).toBeGreaterThan(0)
    })

    it('should reset statistics', () => {
      const logger = service.createLogger()

      logger.info('message 1')
      logger.info('message 2')

      service.resetStats()

      const stats = service.getStats()
      expect(stats.totalLogs.info).toBe(0)
      expect(stats.droppedLogs).toBe(0)
    })
  })

  describe('Custom Transport', () => {
    it('should call custom transport function', () => {
      const transportFn = vi.fn()

      const serviceWithTransport = new LoggingService({
        minLevel: 'debug',
        enableRateLimiting: false,
        transport: transportFn
      })

      const logger = serviceWithTransport.createLogger()
      logger.info('Test message')

      expect(transportFn).toHaveBeenCalledTimes(1)
      expect(transportFn).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'info',
          message: 'Test message'
        })
      )
    })

    it('should handle transport errors gracefully', () => {
      const transportFn = vi.fn(() => {
        throw new Error('Transport error')
      })

      const serviceWithTransport = new LoggingService({
        minLevel: 'debug',
        transport: transportFn
      })

      const logger = serviceWithTransport.createLogger()

      // Should not throw
      expect(() => {
        logger.info('Test message')
      }).not.toThrow()
    })
  })

  describe('Error Handling', () => {
    it('should handle non-Error objects in error logs', () => {
      const logger = service.createLogger()

      logger.error('String error', 'not an error object')
      logger.error('Number error', 404)
      logger.error('Object error', { code: 'ERROR' })

      expect(consoleSpy.error).toHaveBeenCalledTimes(3)
    })

    it('should include stack traces in development', () => {
      const logger = service.createLogger()
      const error = new Error('Test error')

      logger.error('Error occurred', error)

      expect(consoleSpy.error).toHaveBeenCalled()
      // Stack trace should be logged in debug mode
    })
  })
})
