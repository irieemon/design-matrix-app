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
        <div className=\"min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4\">
          <div className=\"max-w-md w-full bg-white rounded-2xl shadow-xl p-6 text-center\">
            {/* Error Icon */}\n            <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${\n              severity === 'critical' ? 'bg-red-100' :\n              severity === 'high' ? 'bg-orange-100' :\n              'bg-yellow-100'\n            }`}>\n              <AlertTriangle className={`w-8 h-8 ${\n                severity === 'critical' ? 'text-red-600' :\n                severity === 'high' ? 'text-orange-600' :\n                'text-yellow-600'\n              }`} />\n            </div>\n\n            {/* Error Title */}\n            <h1 className=\"text-xl font-bold text-gray-900 mb-2\">\n              {severity === 'critical' ? 'Critical Error' :\n               severity === 'high' ? 'Application Error' :\n               'Something went wrong'}\n            </h1>\n\n            {/* Error Description */}\n            <p className=\"text-gray-600 mb-6\">\n              {severity === 'critical' \n                ? 'A critical error has occurred that prevents the application from functioning properly.'\n                : isRecoverable \n                ? 'A temporary error occurred. The application is attempting to recover automatically.'\n                : 'An unexpected error occurred. Please try refreshing the page or contact support if the problem persists.'}\n            </p>\n\n            {/* Retry Information */}\n            {isRecoverable && this.state.retryCount > 0 && (\n              <div className=\"bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4\">\n                <p className=\"text-sm text-blue-800\">\n                  Auto-retry attempt {this.state.retryCount}/{maxRetries}\n                </p>\n              </div>\n            )}\n\n            {/* Error Details (expandable) */}\n            <details className=\"text-left mb-6\">\n              <summary className=\"cursor-pointer text-sm text-gray-500 hover:text-gray-700 flex items-center justify-center space-x-1\">\n                <Bug className=\"w-4 h-4\" />\n                <span>Technical Details</span>\n              </summary>\n              <div className=\"mt-3 p-3 bg-gray-50 rounded border text-xs text-gray-600 font-mono\">\n                <div className=\"mb-2\">\n                  <strong>Error:</strong> {this.state.error?.name}\n                </div>\n                <div className=\"mb-2\">\n                  <strong>Message:</strong> {this.state.error?.message}\n                </div>\n                {this.state.error?.stack && (\n                  <div>\n                    <strong>Stack Trace:</strong>\n                    <pre className=\"mt-1 whitespace-pre-wrap text-xs\">\n                      {this.state.error.stack.split('\\n').slice(0, 5).join('\\n')}\n                    </pre>\n                  </div>\n                )}\n              </div>\n            </details>\n\n            {/* Action Buttons */}\n            <div className=\"space-y-3\">\n              {/* Retry Button */}\n              <button\n                onClick={this.handleManualRetry}\n                className=\"w-full flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium\"\n              >\n                <RefreshCw className=\"w-4 h-4\" />\n                <span>Try Again</span>\n              </button>\n\n              {/* Secondary Actions */}\n              <div className=\"flex space-x-3\">\n                <button\n                  onClick={this.handleGoHome}\n                  className=\"flex-1 flex items-center justify-center space-x-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors\"\n                >\n                  <Home className=\"w-4 h-4\" />\n                  <span>Go Home</span>\n                </button>\n                \n                <button\n                  onClick={this.handleReload}\n                  className=\"flex-1 flex items-center justify-center space-x-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors\"\n                >\n                  <RefreshCw className=\"w-4 h-4\" />\n                  <span>Reload</span>\n                </button>\n              </div>\n            </div>\n\n            {/* Help Text */}\n            <p className=\"text-xs text-gray-500 mt-4\">\n              If this problem persists, please contact support with the technical details above.\n            </p>\n          </div>\n        </div>\n      )\n    }\n\n    return this.props.children\n  }\n}\n\nexport default ErrorBoundary"