/**
 * DatabaseHelpers - Shared database utility functions
 *
 * Extracted from DatabaseService to provide reusable database operations,
 * error handling, and common patterns used across repositories and services.
 */

import { logger } from '../../../utils/logger'
import type { DatabaseError } from '../../../types'

export class DatabaseHelpers {
  // Console logging throttle to reduce spam
  private static lastLogTime = new Map<string, number>()

  /**
   * Throttled console logging helper to prevent spam
   */
  static throttledLog(
    key: string,
    message: string,
    data?: any,
    throttleMs: number = 1000
  ): void {
    const now = Date.now()
    const lastLog = this.lastLogTime.get(key) || 0

    if (now - lastLog > throttleMs) {
      logger.debug(message, data)
      this.lastLogTime.set(key, now)
    }
  }

  /**
   * Standardized database error handling with error code mapping
   */
  static handleDatabaseError(error: any, operation: string): DatabaseError {
    logger.error(`Database error in ${operation}:`, error)

    // Map common Supabase/PostgreSQL errors to our error types
    if (error?.code === 'PGRST116') {
      return {
        code: 'NOT_FOUND',
        message: 'Resource not found',
        details: { originalError: error.message },
        timestamp: new Date().toISOString()
      }
    }

    if (error?.code === '23505') {
      return {
        code: 'DUPLICATE_KEY',
        message: 'Resource already exists',
        details: { originalError: error.message },
        timestamp: new Date().toISOString()
      }
    }

    if (error?.message?.includes('permission')) {
      return {
        code: 'PERMISSION_DENIED',
        message: 'Insufficient permissions for this operation',
        details: { originalError: error.message },
        timestamp: new Date().toISOString()
      }
    }

    return {
      code: 'UNKNOWN_ERROR',
      message: error?.message || 'An unexpected error occurred',
      details: { originalError: error },
      timestamp: new Date().toISOString()
    }
  }

  /**
   * Format timestamp consistently for database storage
   */
  static formatTimestamp(date: Date = new Date()): string {
    return date.toISOString()
  }

  /**
   * Check if error is a "not found" error
   */
  static isNotFoundError(error: any): boolean {
    return error?.code === 'PGRST116'
  }

  /**
   * Check if error is a permission denied error
   */
  static isPermissionError(error: any): boolean {
    return error?.code === '42501' || error?.message?.includes('permission')
  }

  /**
   * Check if error is a duplicate key error
   */
  static isDuplicateKeyError(error: any): boolean {
    return error?.code === '23505'
  }

  /**
   * Clean up internal state (call on service shutdown)
   */
  static cleanup(): void {
    this.lastLogTime.clear()
  }
}
