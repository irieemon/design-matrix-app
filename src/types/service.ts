/**
 * Enhanced Service Layer Types
 *
 * Standardized error handling and result patterns for service layer architecture.
 * Provides consistent, type-safe error handling across all services.
 */

import { DatabaseError, DatabaseErrorCode } from './index'

// Enhanced error codes for service layer
export type ServiceErrorCode =
  | DatabaseErrorCode
  | 'SERVICE_ERROR'
  | 'VALIDATION_ERROR'
  | 'PERMISSION_DENIED'
  | 'RESOURCE_LOCKED'
  | 'CONCURRENT_MODIFICATION'
  | 'OPERATION_TIMEOUT'
  | 'DEPENDENCY_ERROR'

// Service-specific error interface
export interface ServiceError extends Omit<DatabaseError, 'code'> {
  code: ServiceErrorCode
  operation: string
  retryable: boolean
  retryAfter?: number // Seconds to wait before retry
  context?: Record<string, any>
}

// Standardized service result pattern
export type ServiceResult<T> = {
  success: true
  data: T
} | {
  success: false
  error: ServiceError
}

// Operation context for debugging and logging
export interface OperationContext {
  operation: string
  userId?: string
  projectId?: string
  timestamp: string
  traceId?: string
}

// Service configuration interface
export interface ServiceConfig {
  retryAttempts: number
  retryDelay: number
  timeout: number
  enableLogging: boolean
}

// Lock information for concurrent operations
export interface LockInfo {
  id: string
  userId: string
  acquired_at: string
  expires_at: string
  operation: string
}

// Validation result interface
export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings?: string[]
}

// Batch operation result
export interface BatchResult<T> {
  successful: T[]
  failed: Array<{
    item: any
    error: ServiceError
  }>
  summary: {
    total: number
    succeeded: number
    failed: number
  }
}

// Service metrics for monitoring
export interface ServiceMetrics {
  operation: string
  duration: number
  success: boolean
  errorCode?: ServiceErrorCode
  retryCount?: number
  timestamp: string
}

// Common service method options
export interface ServiceOptions {
  userId?: string
  timeout?: number
  retryOnError?: boolean
  validateInput?: boolean
  context?: Record<string, any>
}

// Resource access control
export interface ResourceAccess {
  canRead: boolean
  canWrite: boolean
  canDelete: boolean
  canShare: boolean
  role?: string
}