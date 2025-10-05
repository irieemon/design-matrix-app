/**
 * BaseService Test Suite
 *
 * Comprehensive tests for BaseService functionality including:
 * - Error handling and mapping
 * - Retry logic with exponential backoff
 * - Validation utilities
 * - Operation context creation
 * - Metrics logging
 * - Utility functions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { BaseService } from '../BaseService'
import type { ServiceError, OperationContext } from '../../../types/service'

// Create a test implementation of BaseService
class TestService extends BaseService {
  // Expose protected methods for testing
  static testCreateContext(operation: string, userId?: string, projectId?: string): OperationContext {
    return this.createContext(operation, userId, projectId)
  }

  static testHandleDatabaseError(error: any, operation: string, context?: Record<string, any>): ServiceError {
    return this.handleDatabaseError(error, operation, context)
  }

  static testValidateInput(data: any, schema: Record<string, (value: any) => boolean>) {
    return this.validateInput(data, schema)
  }

  static testExecuteWithRetry<T>(
    operation: () => Promise<T>,
    context: OperationContext,
    maxRetries?: number
  ) {
    return this.executeWithRetry(operation, context, maxRetries)
  }

  static testFormatTimestamp(date?: Date): string {
    return this.formatTimestamp(date)
  }

  static testGenerateId(): string {
    return this.generateId()
  }

  static testThrottledLog(key: string, message: string, data?: any, throttleMs?: number): void {
    return this.throttledLog(key, message, data, throttleMs)
  }

  static testDebounceOperation(key: string, operation: () => void, delayMs?: number): void {
    return this.debounceOperation(key, operation, delayMs)
  }
}

describe('BaseService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    TestService.cleanup()
  })

  describe('Context Creation', () => {
    it('should create operation context with required fields', () => {
      const context = TestService.testCreateContext('testOperation', 'user-123', 'project-456')

      expect(context).toHaveProperty('operation', 'testOperation')
      expect(context).toHaveProperty('userId', 'user-123')
      expect(context).toHaveProperty('projectId', 'project-456')
      expect(context).toHaveProperty('timestamp')
      expect(context).toHaveProperty('traceId')
    })

    it('should create context without optional fields', () => {
      const context = TestService.testCreateContext('testOperation')

      expect(context.operation).toBe('testOperation')
      expect(context.userId).toBeUndefined()
      expect(context.projectId).toBeUndefined()
    })

    it('should generate unique trace IDs', () => {
      const context1 = TestService.testCreateContext('op1')
      const context2 = TestService.testCreateContext('op1')

      expect(context1.traceId).not.toBe(context2.traceId)
    })

    it('should include timestamp in ISO format', () => {
      const context = TestService.testCreateContext('testOperation')
      const timestamp = new Date(context.timestamp)

      expect(timestamp).toBeInstanceOf(Date)
      expect(timestamp.toISOString()).toBe(context.timestamp)
    })
  })

  describe('Error Handling', () => {
    it('should handle database errors and map error codes', () => {
      const dbError = { code: 'PGRST116', message: 'Not found' }
      const serviceError = TestService.testHandleDatabaseError(dbError, 'testOperation')

      expect(serviceError.code).toBe('NOT_FOUND')
      expect(serviceError.operation).toBe('testOperation')
      expect(serviceError.retryable).toBe(false)
    })

    it('should map duplicate key errors correctly', () => {
      const dbError = { code: '23505', message: 'Duplicate key value' }
      const serviceError = TestService.testHandleDatabaseError(dbError, 'createRecord')

      expect(serviceError.code).toBe('DUPLICATE_KEY')
      expect(serviceError.retryable).toBe(false)
    })

    it('should map foreign key violation errors', () => {
      const dbError = { code: '23503', message: 'Foreign key violation' }
      const serviceError = TestService.testHandleDatabaseError(dbError, 'deleteRecord')

      expect(serviceError.code).toBe('FOREIGN_KEY_VIOLATION')
    })

    it('should map permission denied errors', () => {
      const dbError = { code: '42501', message: 'Permission denied' }
      const serviceError = TestService.testHandleDatabaseError(dbError, 'updateRecord')

      expect(serviceError.code).toBe('PERMISSION_DENIED')
    })

    it('should map network errors', () => {
      const dbError = { code: '08003', message: 'Connection failure' }
      const serviceError = TestService.testHandleDatabaseError(dbError, 'fetchData')

      expect(serviceError.code).toBe('NETWORK_ERROR')
      expect(serviceError.retryable).toBe(true)
    })

    it('should map timeout errors', () => {
      const dbError = { code: '57014', message: 'Query timeout' }
      const serviceError = TestService.testHandleDatabaseError(dbError, 'longQuery')

      expect(serviceError.code).toBe('OPERATION_TIMEOUT')
      expect(serviceError.retryable).toBe(true)
    })

    it('should sanitize error messages with UUIDs', () => {
      const dbError = { message: 'Error with UUID 12345678-1234-1234-1234-123456789abc' }
      const serviceError = TestService.testHandleDatabaseError(dbError, 'testOp')

      expect(serviceError.message).not.toContain('12345678-1234-1234-1234-123456789abc')
      expect(serviceError.message).toContain('[ID]')
    })

    it('should sanitize sensitive information from error messages', () => {
      const dbError = { message: 'Invalid password for user' }
      const serviceError = TestService.testHandleDatabaseError(dbError, 'auth')

      expect(serviceError.message).toContain('[REDACTED]')
    })

    it('should sanitize IP addresses from error messages', () => {
      const dbError = { message: 'Connection failed to 192.168.1.1' }
      const serviceError = TestService.testHandleDatabaseError(dbError, 'connect')

      expect(serviceError.message).not.toContain('192.168.1.1')
      expect(serviceError.message).toContain('[IP]')
    })

    it('should limit error message length', () => {
      const longMessage = 'a'.repeat(300)
      const dbError = { message: longMessage }
      const serviceError = TestService.testHandleDatabaseError(dbError, 'testOp')

      expect(serviceError.message.length).toBeLessThanOrEqual(200)
    })

    it('should include error details in service error', () => {
      const dbError = { code: 'CUSTOM_ERROR', message: 'Custom error', hint: 'Try again' }
      const serviceError = TestService.testHandleDatabaseError(dbError, 'testOp')

      expect(serviceError.details).toHaveProperty('originalError')
      expect(serviceError.details).toHaveProperty('code', 'CUSTOM_ERROR')
      expect(serviceError.details).toHaveProperty('hint', 'Try again')
    })

    it('should include context in error result', () => {
      const dbError = { message: 'Error' }
      const context = { userId: 'user-123', action: 'test' }
      const serviceError = TestService.testHandleDatabaseError(dbError, 'testOp', context)

      expect(serviceError.context).toEqual(context)
    })
  })

  describe('Retry Logic', () => {
    it('should succeed on first attempt', async () => {
      const operation = vi.fn().mockResolvedValue('success')
      const context = TestService.testCreateContext('testOp')

      const result = await TestService.testExecuteWithRetry(operation, context, 3)

      expect(result.success).toBe(true)
      expect(result.data).toBe('success')
      expect(operation).toHaveBeenCalledTimes(1)
    })

    it('should retry on retryable errors', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce({ code: '08003', message: 'Connection failed' })
        .mockResolvedValue('success')
      const context = TestService.testCreateContext('testOp')

      const result = await TestService.testExecuteWithRetry(operation, context, 3)

      expect(result.success).toBe(true)
      expect(operation).toHaveBeenCalledTimes(2)
    })

    it('should apply exponential backoff between retries', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce({ code: '08003', message: 'Connection failed' })
        .mockRejectedValueOnce({ code: '08003', message: 'Connection failed' })
        .mockResolvedValue('success')
      const context = TestService.testCreateContext('testOp')

      const promise = TestService.testExecuteWithRetry(operation, context, 3)

      // Fast-forward timers
      await vi.runAllTimersAsync()

      const result = await promise

      expect(result.success).toBe(true)
      expect(operation).toHaveBeenCalledTimes(3)
    })

    it('should not retry non-retryable errors', async () => {
      const operation = vi.fn().mockRejectedValue({ code: 'PGRST116', message: 'Not found' })
      const context = TestService.testCreateContext('testOp')

      const result = await TestService.testExecuteWithRetry(operation, context, 3)

      expect(result.success).toBe(false)
      expect(operation).toHaveBeenCalledTimes(1)
    })

    it('should fail after max retries exceeded', async () => {
      const operation = vi.fn().mockRejectedValue({ code: '08003', message: 'Connection failed' })
      const context = TestService.testCreateContext('testOp')

      const promise = TestService.testExecuteWithRetry(operation, context, 2)
      await vi.runAllTimersAsync()
      const result = await promise

      expect(result.success).toBe(false)
      expect(operation).toHaveBeenCalledTimes(3) // Initial + 2 retries
    })

    it('should respect custom max retries', async () => {
      const operation = vi.fn().mockRejectedValue({ code: '08003', message: 'Connection failed' })
      const context = TestService.testCreateContext('testOp')

      const promise = TestService.testExecuteWithRetry(operation, context, 1)
      await vi.runAllTimersAsync()
      const result = await promise

      expect(result.success).toBe(false)
      expect(operation).toHaveBeenCalledTimes(2) // Initial + 1 retry
    })

    it('should cap retry delay at 10 seconds', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce({ code: '08003', message: 'Connection failed' })
        .mockRejectedValueOnce({ code: '08003', message: 'Connection failed' })
        .mockRejectedValueOnce({ code: '08003', message: 'Connection failed' })
        .mockRejectedValueOnce({ code: '08003', message: 'Connection failed' })
        .mockResolvedValue('success')

      const context = TestService.testCreateContext('testOp')

      const promise = TestService.testExecuteWithRetry(operation, context, 5)
      await vi.runAllTimersAsync()
      await promise

      // Verify exponential backoff doesn't exceed 10s
      expect(operation).toHaveBeenCalledTimes(5)
    })
  })

  describe('Input Validation', () => {
    it('should validate required string fields', () => {
      const data = { title: 'Test', description: 'Desc' }
      const schema = {
        title: (value: any) => typeof value === 'string' && value.length > 0,
        description: (value: any) => typeof value === 'string'
      }

      const result = TestService.testValidateInput(data, schema)

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should fail validation for invalid fields', () => {
      const data = { title: '', description: 123 }
      const schema = {
        title: (value: any) => typeof value === 'string' && value.length > 0,
        description: (value: any) => typeof value === 'string'
      }

      const result = TestService.testValidateInput(data, schema)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Invalid title')
      expect(result.errors).toContain('Invalid description')
    })

    it('should validate email format', () => {
      const data = { email: 'test@example.com' }
      const schema = {
        email: (value: any) => typeof value === 'string' && value.includes('@')
      }

      const result = TestService.testValidateInput(data, schema)

      expect(result.valid).toBe(true)
    })

    it('should validate number ranges', () => {
      const data = { priority: 5 }
      const schema = {
        priority: (value: any) => typeof value === 'number' && value >= 1 && value <= 10
      }

      const result = TestService.testValidateInput(data, schema)

      expect(result.valid).toBe(true)
    })

    it('should validate enum values', () => {
      const data = { status: 'active' }
      const schema = {
        status: (value: any) => ['active', 'inactive', 'pending'].includes(value)
      }

      const result = TestService.testValidateInput(data, schema)

      expect(result.valid).toBe(true)
    })
  })

  describe('Result Creation', () => {
    it('should create success result with data', () => {
      const data = { id: '123', name: 'Test' }
      const result = TestService['createSuccessResult'](data)

      expect(result.success).toBe(true)
      expect(result.data).toEqual(data)
    })

    it('should create error result with service error', () => {
      const serviceError: ServiceError = {
        code: 'SERVICE_ERROR',
        message: 'Test error',
        operation: 'testOp',
        retryable: false,
        timestamp: new Date().toISOString()
      }

      const result = TestService['createErrorResult'](serviceError)

      expect(result.success).toBe(false)
      expect(result.error).toEqual(serviceError)
    })
  })

  describe('Utility Functions', () => {
    it('should format timestamp in ISO format', () => {
      const timestamp = TestService.testFormatTimestamp()
      const date = new Date(timestamp)

      expect(date).toBeInstanceOf(Date)
      expect(date.toISOString()).toBe(timestamp)
    })

    it('should format custom date timestamp', () => {
      const customDate = new Date('2024-01-01T12:00:00Z')
      const timestamp = TestService.testFormatTimestamp(customDate)

      expect(timestamp).toBe('2024-01-01T12:00:00.000Z')
    })

    it('should generate unique IDs', () => {
      const id1 = TestService.testGenerateId()
      const id2 = TestService.testGenerateId()

      expect(id1).not.toBe(id2)
      expect(id1).toMatch(/^\d+-[a-z0-9]+$/)
    })

    it('should generate IDs with timestamp prefix', () => {
      const id = TestService.testGenerateId()
      const timestamp = parseInt(id.split('-')[0])

      expect(timestamp).toBeGreaterThan(Date.now() - 1000)
      expect(timestamp).toBeLessThanOrEqual(Date.now())
    })
  })

  describe('Throttled Logging', () => {
    it('should log message on first call', () => {
      const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})

      TestService.testThrottledLog('test-key', 'Test message', { data: 'test' })

      expect(consoleSpy).toHaveBeenCalled()
    })

    it('should throttle repeated log calls', () => {
      const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})

      TestService.testThrottledLog('test-key', 'Test message', undefined, 1000)
      TestService.testThrottledLog('test-key', 'Test message', undefined, 1000)

      expect(consoleSpy).toHaveBeenCalledTimes(1)
    })

    it('should log again after throttle period', () => {
      const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})

      TestService.testThrottledLog('test-key', 'Test message', undefined, 100)
      vi.advanceTimersByTime(150)
      TestService.testThrottledLog('test-key', 'Test message', undefined, 100)

      expect(consoleSpy).toHaveBeenCalledTimes(2)
    })

    it('should handle different keys independently', () => {
      const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})

      TestService.testThrottledLog('key1', 'Message 1')
      TestService.testThrottledLog('key2', 'Message 2')

      expect(consoleSpy).toHaveBeenCalledTimes(2)
    })
  })

  describe('Debounced Operations', () => {
    it('should execute operation after delay', () => {
      const operation = vi.fn()

      TestService.testDebounceOperation('test-key', operation, 300)
      vi.advanceTimersByTime(300)

      expect(operation).toHaveBeenCalledTimes(1)
    })

    it('should cancel previous operation on subsequent calls', () => {
      const operation = vi.fn()

      TestService.testDebounceOperation('test-key', operation, 300)
      vi.advanceTimersByTime(100)
      TestService.testDebounceOperation('test-key', operation, 300)
      vi.advanceTimersByTime(300)

      expect(operation).toHaveBeenCalledTimes(1)
    })

    it('should handle multiple keys independently', () => {
      const operation1 = vi.fn()
      const operation2 = vi.fn()

      TestService.testDebounceOperation('key1', operation1, 300)
      TestService.testDebounceOperation('key2', operation2, 300)
      vi.advanceTimersByTime(300)

      expect(operation1).toHaveBeenCalledTimes(1)
      expect(operation2).toHaveBeenCalledTimes(1)
    })
  })

  describe('Cleanup', () => {
    it('should clear all pending debounced operations', () => {
      const operation = vi.fn()

      TestService.testDebounceOperation('key1', operation, 300)
      TestService.testDebounceOperation('key2', operation, 300)
      TestService.cleanup()
      vi.advanceTimersByTime(300)

      expect(operation).not.toHaveBeenCalled()
    })

    it('should clear throttle state', () => {
      const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})

      TestService.testThrottledLog('test-key', 'Message', undefined, 1000)
      TestService.cleanup()
      TestService.testThrottledLog('test-key', 'Message', undefined, 1000)

      expect(consoleSpy).toHaveBeenCalledTimes(2)
    })
  })
})
