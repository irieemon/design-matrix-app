/**
 * Repository Types - Shared types for all repository modules
 *
 * Provides standardized error handling and response patterns
 * for consistent data access layer implementation.
 */

/**
 * Standard API response wrapper for all repository operations
 * Provides consistent error handling across all data access methods
 *
 * @example
 * ```typescript
 * // Success case
 * const result: ApiResponse<Project> = {
 *   success: true,
 *   data: projectData
 * }
 *
 * // Error case
 * const result: ApiResponse<Project> = {
 *   success: false,
 *   error: 'Project not found'
 * }
 * ```
 */
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  code?: string  // Optional error code for specific error handling
}

/**
 * Helper function to create success response
 */
export function createSuccessResponse<T>(data: T): ApiResponse<T> {
  return {
    success: true,
    data
  }
}

/**
 * Helper function to create error response
 */
export function createErrorResponse<T>(error: string, code?: string): ApiResponse<T> {
  return {
    success: false,
    error,
    code
  }
}

/**
 * Helper function to handle Supabase errors and convert to ApiResponse
 */
export function handleSupabaseError<T>(error: any, operation: string): ApiResponse<T> {
  const errorMessage = error?.message || 'Unknown error occurred'
  const errorCode = error?.code || 'UNKNOWN_ERROR'

  // Handle common Supabase error codes
  if (errorCode === 'PGRST116') {
    return createErrorResponse<T>('Resource not found', 'NOT_FOUND')
  }

  if (errorCode === '23505') {
    return createErrorResponse<T>('Resource already exists', 'DUPLICATE')
  }

  if (errorCode === '42501') {
    return createErrorResponse<T>('Permission denied', 'FORBIDDEN')
  }

  return createErrorResponse<T>(`${operation} failed: ${errorMessage}`, errorCode)
}
