import React, { Component, ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react'

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
  retryCount: number
}

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
  maxRetries?: number
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryTimeoutId: NodeJS.Timeout | null = null

  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({
      error,
      errorInfo
    })

    // Log error for debugging
    console.error('Error Boundary caught an error:', error, errorInfo)
    
    // Call optional error handler
    this.props.onError?.(error, errorInfo)

    // Auto-retry for certain recoverable errors
    if (this.isRecoverableError(error) && this.state.retryCount < (this.props.maxRetries || 3)) {
      this.scheduleRetry()
    }
  }

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId)
    }
  }

  private isRecoverableError = (error: Error): boolean => {
    const recoverablePatterns = [
      /chunk.*load.*failed/i,
      /loading.*chunk.*failed/i,
      /network.*error/i,
      /fetch.*error/i
    ]

    return recoverablePatterns.some(pattern => 
      pattern.test(error.message) || pattern.test(error.name)
    )
  }

  private scheduleRetry = () => {
    const delay = Math.min(1000 * Math.pow(2, this.state.retryCount), 10000) // Exponential backoff
    
    this.retryTimeoutId = setTimeout(() => {
      this.handleRetry()
    }, delay)
  }

  private handleRetry = () => {
    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prevState.retryCount + 1
    }))
  }

  private handleManualRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0
    })
  }

  private handleReload = () => {
    window.location.reload()
  }

  private handleGoHome = () => {
    window.location.href = '/'
  }

  private getErrorSeverity = (): 'low' | 'medium' | 'high' | 'critical' => {
    if (!this.state.error) return 'medium'

    const error = this.state.error
    const criticalPatterns = [
      /cannot.*read.*property/i,
      /undefined.*is.*not.*function/i,
      /maximum.*call.*stack/i
    ]

    const highPatterns = [
      /chunk.*load.*failed/i,
      /script.*error/i,
      /network.*error/i
    ]

    if (criticalPatterns.some(pattern => pattern.test(error.message))) {
      return 'critical'
    }

    if (highPatterns.some(pattern => pattern.test(error.message))) {
      return 'high'
    }

    return 'medium'
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback
      }

      const severity = this.getErrorSeverity()
      const isRecoverable = this.isRecoverableError(this.state.error!)
      const maxRetries = this.props.maxRetries || 3

      return (
        <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-6 text-center">
            {/* Error Icon */}
            <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
              severity === 'critical' ? 'bg-red-100' :
              severity === 'high' ? 'bg-orange-100' :
              'bg-yellow-100'
            }`}>
              <AlertTriangle className={`w-8 h-8 ${
                severity === 'critical' ? 'text-red-600' :
                severity === 'high' ? 'text-orange-600' :
                'text-yellow-600'
              }`} />
            </div>

            {/* Error Title */}
            <h1 className="text-xl font-bold text-gray-900 mb-2">
              {severity === 'critical' ? 'Critical Error' :
               severity === 'high' ? 'Application Error' :
               'Something went wrong'}
            </h1>

            {/* Error Description */}
            <p className="text-gray-600 mb-6">
              {severity === 'critical' 
                ? 'A critical error has occurred that prevents the application from functioning properly.'
                : isRecoverable 
                ? 'A temporary error occurred. The application is attempting to recover automatically.'
                : 'An unexpected error occurred. Please try refreshing the page or contact support if the problem persists.'}
            </p>

            {/* Retry Information */}
            {isRecoverable && this.state.retryCount > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-blue-800">
                  Auto-retry attempt {this.state.retryCount}/{maxRetries}
                </p>
              </div>
            )}

            {/* Error Details (expandable) */}
            <details className="text-left mb-6">
              <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700 flex items-center justify-center space-x-1">
                <Bug className="w-4 h-4" />
                <span>Technical Details</span>
              </summary>
              <div className="mt-3 p-3 bg-gray-50 rounded border text-xs text-gray-600 font-mono">
                <div className="mb-2">
                  <strong>Error:</strong> {this.state.error?.name}
                </div>
                <div className="mb-2">
                  <strong>Message:</strong> {this.state.error?.message}
                </div>
                {this.state.error?.stack && (
                  <div>
                    <strong>Stack Trace:</strong>
                    <pre className="mt-1 whitespace-pre-wrap text-xs">
                      {this.state.error.stack.split('\n').slice(0, 5).join('\n')}
                    </pre>
                  </div>
                )}
              </div>
            </details>

            {/* Action Buttons */}
            <div className="space-y-3">
              {/* Retry Button */}
              <button
                onClick={this.handleManualRetry}
                className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Try Again</span>
              </button>

              {/* Secondary Actions */}
              <div className="flex space-x-3">
                <button
                  onClick={this.handleGoHome}
                  className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Home className="w-4 h-4" />
                  <span>Go Home</span>
                </button>
                
                <button
                  onClick={this.handleReload}
                  className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Reload</span>
                </button>
              </div>
            </div>

            {/* Help Text */}
            <p className="text-xs text-gray-500 mt-4">
              If this problem persists, please contact support with the technical details above.
            </p>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary