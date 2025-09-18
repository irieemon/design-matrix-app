import { useState, useCallback } from 'react'
import { logger } from '../../utils/logger'

interface AsyncOperationState<T> {
  data: T | null
  loading: boolean
  error: string | null
  success: boolean
}

interface UseAsyncOperationReturn<T, P extends unknown[]> {
  state: AsyncOperationState<T>
  execute: (...params: P) => Promise<T | null>
  reset: () => void
  setData: (data: T | null) => void
  setError: (error: string | null) => void
}

interface UseAsyncOperationOptions {
  onSuccess?: (data: any) => void
  onError?: (error: string) => void
  logErrors?: boolean
  resetOnExecute?: boolean
}

/**
 * Unified hook for managing async operations with loading, error, and success states
 *
 * @param asyncFunction - The async function to execute
 * @param options - Configuration options
 * @returns Object with state and control functions
 *
 * @example
 * const { state, execute, reset } = useAsyncOperation(
 *   async (userId: string) => DatabaseService.getUser(userId),
 *   {
 *     onSuccess: (user) => console.log('User loaded:', user),
 *     onError: (error) => toast.error(error)
 *   }
 * )
 */
export function useAsyncOperation<T, P extends unknown[]>(
  asyncFunction: (...params: P) => Promise<T>,
  options: UseAsyncOperationOptions = {}
): UseAsyncOperationReturn<T, P> {
  const {
    onSuccess,
    onError,
    logErrors = true,
    resetOnExecute = true
  } = options

  const [state, setState] = useState<AsyncOperationState<T>>({
    data: null,
    loading: false,
    error: null,
    success: false
  })

  const execute = useCallback(async (...params: P): Promise<T | null> => {
    try {
      // Reset state on new execution if configured
      if (resetOnExecute) {
        setState({
          data: null,
          loading: true,
          error: null,
          success: false
        })
      } else {
        setState(prev => ({
          ...prev,
          loading: true,
          error: null,
          success: false
        }))
      }

      const result = await asyncFunction(...params)

      setState({
        data: result,
        loading: false,
        error: null,
        success: true
      })

      if (onSuccess) {
        onSuccess(result)
      }

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'

      setState({
        data: null,
        loading: false,
        error: errorMessage,
        success: false
      })

      if (logErrors) {
        logger.error('Async operation failed:', { error, params })
      }

      if (onError) {
        onError(errorMessage)
      }

      return null
    }
  }, [asyncFunction, onSuccess, onError, logErrors, resetOnExecute])

  const reset = useCallback(() => {
    setState({
      data: null,
      loading: false,
      error: null,
      success: false
    })
  }, [])

  const setData = useCallback((data: T | null) => {
    setState(prev => ({
      ...prev,
      data,
      success: data !== null
    }))
  }, [])

  const setError = useCallback((error: string | null) => {
    setState(prev => ({
      ...prev,
      error,
      success: false
    }))
  }, [])

  return {
    state,
    execute,
    reset,
    setData,
    setError
  }
}

/**
 * Simplified version for operations that don't need parameters
 */
export function useSimpleAsyncOperation<T>(
  asyncFunction: () => Promise<T>,
  options?: UseAsyncOperationOptions
) {
  return useAsyncOperation(asyncFunction, options)
}

/**
 * Predefined async operation for API calls with consistent error handling
 */
export function useApiCall<T, P extends unknown[]>(
  apiFunction: (...params: P) => Promise<T>,
  options?: Omit<UseAsyncOperationOptions, 'logErrors'>
) {
  return useAsyncOperation(apiFunction, {
    ...options,
    logErrors: true // Always log API errors
  })
}