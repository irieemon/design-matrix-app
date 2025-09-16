import { useState, useCallback, useRef, useEffect } from 'react'
import { logger } from '../utils/logger'

// Error types and recovery strategies
export type ErrorType = 
  | 'network' 
  | 'timeout' 
  | 'server' 
  | 'validation' 
  | 'auth' 
  | 'quota' 
  | 'worker' 
  | 'unknown'

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical'

export interface AppError {
  id: string
  type: ErrorType
  severity: ErrorSeverity
  message: string
  details?: any
  timestamp: number
  context?: Record<string, any>
  retryable: boolean
  autoRetry: boolean
  userFriendlyMessage: string
}

export interface RetryConfig {
  maxAttempts: number
  baseDelay: number
  backoffMultiplier: number
  maxDelay: number
  jitter: boolean
}

interface ErrorRecoveryOptions {
  defaultRetryConfig?: Partial<RetryConfig>
  onError?: (error: AppError) => void
  onRecovery?: (error: AppError, attempt: number) => void
  onGiveUp?: (error: AppError) => void
}

const defaultRetryConfig: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000,
  backoffMultiplier: 2,
  maxDelay: 10000,
  jitter: true
}

export const useErrorRecovery = (options: ErrorRecoveryOptions = {}) => {
  const [errors, setErrors] = useState<AppError[]>([])
  const [isRecovering, setIsRecovering] = useState(false)
  const retryTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map())
  const retryAttempts = useRef<Map<string, number>>(new Map())

  const { defaultRetryConfig: customRetryConfig, onError, onRecovery, onGiveUp } = options
  const retryConfig = { ...defaultRetryConfig, ...customRetryConfig }

  // Classify error and determine recovery strategy
  const classifyError = useCallback((error: any): { type: ErrorType; severity: ErrorSeverity; retryable: boolean; autoRetry: boolean } => {
    const errorMessage = error?.message?.toLowerCase() || ''
    const statusCode = error?.status || error?.code
    
    // Network errors
    if (errorMessage.includes('network') || errorMessage.includes('fetch') || statusCode === 'NETWORK_ERROR') {
      return { type: 'network', severity: 'medium', retryable: true, autoRetry: true }
    }
    
    // Timeout errors
    if (errorMessage.includes('timeout') || statusCode === 'TIMEOUT') {
      return { type: 'timeout', severity: 'medium', retryable: true, autoRetry: true }
    }
    
    // Server errors (5xx)
    if (statusCode >= 500 && statusCode < 600) {
      return { type: 'server', severity: 'high', retryable: true, autoRetry: true }
    }
    
    // Authentication errors (401, 403)
    if (statusCode === 401 || statusCode === 403) {
      return { type: 'auth', severity: 'high', retryable: false, autoRetry: false }
    }
    
    // Validation errors (400, 422)
    if (statusCode === 400 || statusCode === 422) {
      return { type: 'validation', severity: 'low', retryable: false, autoRetry: false }
    }
    
    // Quota errors (429)
    if (statusCode === 429) {
      return { type: 'quota', severity: 'medium', retryable: true, autoRetry: true }
    }
    
    // Worker errors
    if (errorMessage.includes('worker') || errorMessage.includes('web worker')) {
      return { type: 'worker', severity: 'medium', retryable: true, autoRetry: false }
    }
    
    // Default to unknown
    return { type: 'unknown', severity: 'medium', retryable: false, autoRetry: false }
  }, [])

  // Generate user-friendly error messages
  const generateUserFriendlyMessage = useCallback((type: ErrorType, originalMessage: string): string => {
    switch (type) {
      case 'network':
        return 'Connection issue detected. Please check your internet connection and try again.'
      case 'timeout':
        return 'Request timed out. The server is taking longer than usual to respond.'
      case 'server':
        return 'Server temporarily unavailable. We\'re working to resolve this issue.'
      case 'auth':
        return 'Authentication required. Please log in again to continue.'
      case 'validation':
        return 'Invalid input detected. Please check your data and try again.'
      case 'quota':
        return 'Rate limit exceeded. Please wait a moment before trying again.'
      case 'worker':
        return 'Processing error occurred. Falling back to standard mode.'
      default:
        return originalMessage || 'An unexpected error occurred. Please try again.'
    }
  }, [])

  // Calculate retry delay with exponential backoff and jitter
  const calculateRetryDelay = useCallback((attempt: number, config: RetryConfig): number => {
    const exponentialDelay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1)
    const cappedDelay = Math.min(exponentialDelay, config.maxDelay)
    
    if (config.jitter) {
      // Add ±25% jitter to prevent thundering herd
      const jitterRange = cappedDelay * 0.25
      const jitter = (Math.random() - 0.5) * 2 * jitterRange
      return Math.max(100, cappedDelay + jitter)
    }
    
    return cappedDelay
  }, [])

  // Handle error with automatic classification and recovery
  const handleError = useCallback(async <T>(
    operation: () => Promise<T>,
    context?: Record<string, any>,
    customRetryConfig?: Partial<RetryConfig>
  ): Promise<T> => {
    const config = { ...retryConfig, ...customRetryConfig }
    
    const executeWithRetry = async (attempt: number): Promise<T> => {
      try {
        const result = await operation()
        
        // Clear any previous retry attempts for this operation
        const contextKey = JSON.stringify(context || {})
        retryAttempts.current.delete(contextKey)
        
        return result
      } catch (error) {
        const classification = classifyError(error)
        const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        
        const appError: AppError = {
          id: errorId,
          type: classification.type,
          severity: classification.severity,
          message: error instanceof Error ? error.message : 'Unknown error',
          details: error,
          timestamp: Date.now(),
          context,
          retryable: classification.retryable,
          autoRetry: classification.autoRetry,
          userFriendlyMessage: generateUserFriendlyMessage(classification.type, error instanceof Error ? error.message : 'Unknown error')
        }\n        \n        // Add error to state\n        setErrors(prev => [...prev, appError])\n        onError?.(appError)\n        \n        logger.error(`🚨 Error [${classification.type}/${classification.severity}]:`, {\n          message: appError.message,\n          attempt,\n          context,\n          retryable: classification.retryable\n        })\n        \n        // Determine if we should retry\n        if (classification.retryable && attempt < config.maxAttempts) {\n          const delay = calculateRetryDelay(attempt, config)\n          \n          logger.debug(`🔄 Retrying in ${delay}ms (attempt ${attempt}/${config.maxAttempts})`)\n          \n          if (classification.autoRetry) {\n            setIsRecovering(true)\n            \n            await new Promise(resolve => setTimeout(resolve, delay))\n            \n            onRecovery?.(appError, attempt)\n            return executeWithRetry(attempt + 1)\n          }\n        }\n        \n        // No more retries or not retryable\n        setIsRecovering(false)\n        onGiveUp?.(appError)\n        \n        throw appError\n      }\n    }\n    \n    return executeWithRetry(1)\n  }, [retryConfig, classifyError, generateUserFriendlyMessage, calculateRetryDelay, onError, onRecovery, onGiveUp])\n\n  // Manual retry for user-triggered retries\n  const retryOperation = useCallback(async <T>(\n    operation: () => Promise<T>,\n    errorId: string\n  ): Promise<T> => {\n    const error = errors.find(e => e.id === errorId)\n    if (!error) {\n      throw new Error('Error not found for retry')\n    }\n    \n    logger.debug('🔄 Manual retry triggered for error:', errorId)\n    \n    try {\n      setIsRecovering(true)\n      const result = await operation()\n      \n      // Remove error from state on successful retry\n      setErrors(prev => prev.filter(e => e.id !== errorId))\n      setIsRecovering(false)\n      \n      logger.debug('✅ Manual retry successful for error:', errorId)\n      return result\n    } catch (retryError) {\n      setIsRecovering(false)\n      \n      // Update error with new timestamp but keep same ID\n      const updatedError: AppError = {\n        ...error,\n        message: retryError instanceof Error ? retryError.message : 'Retry failed',\n        timestamp: Date.now()\n      }\n      \n      setErrors(prev => prev.map(e => e.id === errorId ? updatedError : e))\n      throw retryError\n    }\n  }, [errors])\n\n  // Dismiss error\n  const dismissError = useCallback((errorId: string) => {\n    setErrors(prev => prev.filter(e => e.id !== errorId))\n    \n    // Clear any pending retry timeout\n    const timeout = retryTimeouts.current.get(errorId)\n    if (timeout) {\n      clearTimeout(timeout)\n      retryTimeouts.current.delete(errorId)\n    }\n  }, [])\n\n  // Clear all errors\n  const clearAllErrors = useCallback(() => {\n    setErrors([])\n    \n    // Clear all pending timeouts\n    retryTimeouts.current.forEach(timeout => clearTimeout(timeout))\n    retryTimeouts.current.clear()\n    retryAttempts.current.clear()\n  }, [])\n\n  // Get errors by severity\n  const getErrorsBySeverity = useCallback((severity: ErrorSeverity) => {\n    return errors.filter(error => error.severity === severity)\n  }, [errors])\n\n  // Get errors by type\n  const getErrorsByType = useCallback((type: ErrorType) => {\n    return errors.filter(error => error.type === type)\n  }, [errors])\n\n  // Check if there are critical errors\n  const hasCriticalErrors = useCallback(() => {\n    return errors.some(error => error.severity === 'critical')\n  }, [errors])\n\n  // Auto-cleanup old errors\n  useEffect(() => {\n    const cleanup = setInterval(() => {\n      const cutoff = Date.now() - 5 * 60 * 1000 // 5 minutes\n      setErrors(prev => prev.filter(error => \n        error.severity === 'critical' || error.timestamp > cutoff\n      ))\n    }, 60000) // Run every minute\n\n    return () => clearInterval(cleanup)\n  }, [])\n\n  // Cleanup timeouts on unmount\n  useEffect(() => {\n    return () => {\n      retryTimeouts.current.forEach(timeout => clearTimeout(timeout))\n      retryTimeouts.current.clear()\n    }\n  }, [])\n\n  return {\n    errors,\n    isRecovering,\n    handleError,\n    retryOperation,\n    dismissError,\n    clearAllErrors,\n    getErrorsBySeverity,\n    getErrorsByType,\n    hasCriticalErrors\n  }\n}