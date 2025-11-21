/**
 * BaseService - Shared Service Layer Foundation
 *
 * Provides common utilities, error handling, and patterns used across all services.
 * Extracted from DatabaseService to eliminate duplication and ensure consistency.
 */

import { supabase, createAuthenticatedClientFromLocalStorage } from '../supabase'
import { logger } from '../../utils/logger'
import type {
  ServiceResult,
  ServiceError,
  ServiceErrorCode,
  OperationContext,
  ServiceConfig,
  ValidationResult,
  ServiceMetrics
} from '../../types/service'

export abstract class BaseService {
  // Service configuration with sensible defaults
  protected static readonly config: ServiceConfig = {
    retryAttempts: 3,
    retryDelay: 1000, // 1 second
    timeout: 30000, // 30 seconds
    enableLogging: true
  }

  // Throttled logging to reduce spam
  private static lockDebounceMap = new Map<string, NodeJS.Timeout>()
  private static lastLogTime = new Map<string, number>()

  /**
   * Throttled logging helper to prevent console spam
   */
  protected static throttledLog(
    key: string,
    message: string,
    data?: any,
    throttleMs: number = 1000
  ): void {
    if (!this.config.enableLogging) return

    const now = Date.now()
    const lastLog = this.lastLogTime.get(key) || 0

    if (now - lastLog > throttleMs) {
      logger.debug(message, data)
      this.lastLogTime.set(key, now)
    }
  }

  /**
   * Create operation context for tracking and debugging
   */
  protected static createContext(
    operation: string,
    userId?: string,
    projectId?: string
  ): OperationContext {
    return {
      operation,
      userId,
      projectId,
      timestamp: new Date().toISOString(),
      traceId: `${operation}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    }
  }

  /**
   * Standardized database error handling
   */
  protected static handleDatabaseError(
    error: any,
    operation: string,
    context?: Record<string, any>
  ): ServiceError {
    logger.error(`Service error in ${operation}:`, error)

    // Map common Supabase/PostgreSQL errors to service error codes
    const errorCode = this.mapErrorCode(error)
    const retryable = this.isRetryableError(error)

    return {
      code: errorCode,
      message: this.sanitizeErrorMessage(error.message || 'Unknown error'),
      operation,
      retryable,
      details: {
        originalError: error.message,
        code: error.code,
        hint: error.hint
      },
      timestamp: new Date().toISOString(),
      context
    }
  }

  /**
   * Map database error codes to service error codes
   */
  private static mapErrorCode(error: any): ServiceErrorCode {
    if (error?.code === 'PGRST116') return 'NOT_FOUND'
    if (error?.code === '23505') return 'DUPLICATE_KEY'
    if (error?.code === '23503') return 'FOREIGN_KEY_VIOLATION'
    if (error?.code === '42501') return 'PERMISSION_DENIED'
    if (error?.code === '08003') return 'NETWORK_ERROR'
    if (error?.code === '08006') return 'NETWORK_ERROR'
    if (error?.code === '57014') return 'OPERATION_TIMEOUT'
    if (error?.message?.includes('timeout')) return 'OPERATION_TIMEOUT'
    if (error?.message?.includes('lock')) return 'RESOURCE_LOCKED'
    if (error?.message?.includes('conflict')) return 'CONCURRENT_MODIFICATION'

    return 'SERVICE_ERROR'
  }

  /**
   * Determine if an error is retryable
   */
  private static isRetryableError(error: any): boolean {
    const retryableCodes = [
      'CONNECTION_ERROR',
      'OPERATION_TIMEOUT',
      'NETWORK_ERROR',
      '08003', // Connection failure
      '08006', // Connection broken
      '57014'  // Query timeout
    ]

    return retryableCodes.includes(error?.code) ||
           retryableCodes.includes(this.mapErrorCode(error)) ||
           error?.message?.includes('network') ||
           error?.message?.includes('timeout')
  }

  /**
   * Sanitize error messages for user consumption
   */
  private static sanitizeErrorMessage(message: string): string {
    // Remove sensitive information and technical details
    return message
      .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[ID]')
      .replace(/password|token|secret|key/gi, '[REDACTED]')
      .replace(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/g, '[IP]')
      .substring(0, 200) // Limit message length
  }

  /**
   * Create successful result
   */
  protected static createSuccessResult<T>(data: T): ServiceResult<T> {
    return {
      success: true,
      data
    }
  }

  /**
   * Create error result
   */
  protected static createErrorResult(error: ServiceError): ServiceResult<never> {
    return {
      success: false,
      error
    }
  }

  /**
   * Execute operation with retry logic
   */
  protected static async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: OperationContext,
    maxRetries: number = this.config.retryAttempts
  ): Promise<ServiceResult<T>> {
    let lastError: any
    let retryCount = 0

    while (retryCount <= maxRetries) {
      try {
        const startTime = Date.now()
        const result = await operation()

        // Log success metrics
        this.logMetrics({
          operation: context.operation,
          duration: Date.now() - startTime,
          success: true,
          retryCount,
          timestamp: new Date().toISOString()
        })

        return this.createSuccessResult(result)
      } catch (_error) {
        lastError = error
        retryCount++

        // Log error metrics
        this.logMetrics({
          operation: context.operation,
          duration: Date.now() - Date.parse(context.timestamp),
          success: false,
          errorCode: this.mapErrorCode(error),
          retryCount,
          timestamp: new Date().toISOString()
        })

        // Check if error is retryable and we have retries left
        if (!this.isRetryableError(error) || retryCount > maxRetries) {
          break
        }

        // Wait before retry with exponential backoff
        const delay = this.config.retryDelay * Math.pow(2, retryCount - 1)
        await this.delay(Math.min(delay, 10000)) // Max 10 second delay
      }
    }

    // All retries exhausted, return error
    const serviceError = this.handleDatabaseError(lastError, context.operation, {
      retryCount,
      maxRetries,
      traceId: context.traceId
    })

    return this.createErrorResult(serviceError)
  }

  /**
   * Input validation helper
   */
  protected static validateInput(
    data: any,
    schema: Record<string, (value: any) => boolean>
  ): ValidationResult {
    const errors: string[] = []

    for (const [field, validator] of Object.entries(schema)) {
      if (!validator(data[field])) {
        errors.push(`Invalid ${field}`)
      }
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * Check user permissions for resource access
   */
  protected static async checkPermissions(
    userId: string,
    resourceId: string,
    _resourceType?: string, // Optional for future use
    _requiredPermission?: 'read' | 'write' | 'delete' | 'share' // Optional for future use
  ): Promise<boolean> {
    try {
      // Implementation depends on your authorization system
      // This is a placeholder that should be implemented based on your auth model

      if (!userId || !resourceId) return false

      // For now, return true for authenticated users
      // In production, implement proper RBAC/ABAC
      return true
    } catch (_error) {
      logger.error('Permission check failed:', error)
      return false
    }
  }

  /**
   * Debounced operation execution
   */
  protected static debounceOperation(
    key: string,
    operation: () => void,
    delayMs: number = 300
  ): void {
    // Clear existing timeout
    const existingTimeout = this.lockDebounceMap.get(key)
    if (existingTimeout) {
      clearTimeout(existingTimeout)
    }

    // Set new timeout
    const timeout = setTimeout(() => {
      operation()
      this.lockDebounceMap.delete(key)
    }, delayMs)

    this.lockDebounceMap.set(key, timeout)
  }

  /**
   * Log service metrics for monitoring
   */
  private static logMetrics(metrics: ServiceMetrics): void {
    if (!this.config.enableLogging) return

    logger.debug('Service metrics:', metrics)

    // In production, send to monitoring service
    // Example: analytics.track('service_operation', metrics)
  }

  /**
   * Simple delay utility
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Get Supabase client instance
   *
   * CRITICAL FIX: Use authenticated client from localStorage for RLS enforcement.
   * The global supabase client doesn't include the user's access token in headers,
   * so RLS policies block queries even when user is authenticated in UI.
   *
   * NOTE: This creates a second Supabase client (with caching), which causes a
   * "Multiple GoTrueClient instances" warning. This is a known limitation
   * because the global client's session loading is asynchronous and doesn't
   * work reliably on page refresh. The warning is harmless and can be ignored.
   */
  protected static getSupabaseClient() {
    // Try to get authenticated client from localStorage first
    const authenticatedClient = this.getAuthenticatedClientFromStorage()

    // Fall back to global client if no authenticated session
    return authenticatedClient || supabase
  }

  /**
   * Get authenticated Supabase client from localStorage tokens
   *
   * Creates a client with the access_token as auth header for RLS enforcement.
   * Returns null if no valid session exists in localStorage.
   *
   * Uses centralized caching from createAuthenticatedClientFromLocalStorage()
   * to minimize the number of client instances created.
   */
  private static getAuthenticatedClientFromStorage() {
    return createAuthenticatedClientFromLocalStorage()
  }

  /**
   * Format timestamp for consistent database storage
   */
  protected static formatTimestamp(date: Date = new Date()): string {
    return date.toISOString()
  }

  /**
   * Generate unique ID for operations
   */
  protected static generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Cleanup method to be called on service shutdown
   */
  public static cleanup(): void {
    // Clear all pending debounced operations
    for (const timeout of this.lockDebounceMap.values()) {
      clearTimeout(timeout)
    }
    this.lockDebounceMap.clear()
    this.lastLogTime.clear()
  }
}