import React from 'react'
import { X, RefreshCw, AlertTriangle, AlertCircle, Info, CheckCircle, Wifi, Clock, Server, User, Shield, Zap } from 'lucide-react'
import { AppError, ErrorType, ErrorSeverity } from '../hooks/useErrorRecovery'

interface ErrorNotificationProps {
  error: AppError
  onDismiss: (errorId: string) => void
  onRetry?: (errorId: string) => void
  isRetrying?: boolean
}

const ErrorNotification: React.FC<ErrorNotificationProps> = ({
  error,
  onDismiss,
  onRetry,
  isRetrying = false
}) => {
  const getErrorIcon = (type: ErrorType) => {
    switch (type) {
      case 'network':
        return <Wifi className="w-5 h-5" />
      case 'timeout':
        return <Clock className="w-5 h-5" />
      case 'server':
        return <Server className="w-5 h-5" />
      case 'auth':
        return <User className="w-5 h-5" />
      case 'validation':
        return <AlertTriangle className="w-5 h-5" />
      case 'quota':
        return <Shield className="w-5 h-5" />
      case 'worker':
        return <Zap className="w-5 h-5" />
      default:
        return <AlertCircle className="w-5 h-5" />
    }
  }

  const getSeverityIcon = (severity: ErrorSeverity) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="w-4 h-4" />
      case 'high':
        return <AlertCircle className="w-4 h-4" />
      case 'medium':
        return <Info className="w-4 h-4" />
      case 'low':
        return <CheckCircle className="w-4 h-4" />
      default:
        return <Info className="w-4 h-4" />
    }
  }

  const getSeverityColors = (severity: ErrorSeverity) => {
    switch (severity) {
      case 'critical':
        return {
          bg: 'bg-red-50 border-red-200',
          icon: 'text-red-600',
          text: 'text-red-800',
          button: 'bg-red-600 hover:bg-red-700',
          badge: 'bg-red-100 text-red-800'
        }
      case 'high':
        return {
          bg: 'bg-orange-50 border-orange-200',
          icon: 'text-orange-600',
          text: 'text-orange-800',
          button: 'bg-orange-600 hover:bg-orange-700',
          badge: 'bg-orange-100 text-orange-800'
        }
      case 'medium':
        return {
          bg: 'bg-yellow-50 border-yellow-200',
          icon: 'text-yellow-600',
          text: 'text-yellow-800',
          button: 'bg-yellow-600 hover:bg-yellow-700',
          badge: 'bg-yellow-100 text-yellow-800'
        }
      case 'low':
        return {
          bg: 'bg-blue-50 border-blue-200',
          icon: 'text-blue-600',
          text: 'text-blue-800',
          button: 'bg-blue-600 hover:bg-blue-700',
          badge: 'bg-blue-100 text-blue-800'
        }
      default:
        return {
          bg: 'bg-gray-50 border-gray-200',
          icon: 'text-gray-600',
          text: 'text-gray-800',
          button: 'bg-gray-600 hover:bg-gray-700',
          badge: 'bg-gray-100 text-gray-800'
        }
    }
  }

  const colors = getSeverityColors(error.severity)
  const timeAgo = new Date(error.timestamp).toLocaleTimeString()

  return (
    <div className={`rounded-xl border p-4 mb-3 transition-all duration-300 hover:shadow-md ${colors.bg}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3 flex-1">
          {/* Error Type Icon */}
          <div className={`p-2 rounded-lg bg-white shadow-sm ${colors.icon}`}>
            {getErrorIcon(error.type)}
          </div>
          
          <div className="flex-1 min-w-0">
            {/* Header with severity badge */}
            <div className="flex items-center space-x-2 mb-2">
              <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${colors.badge}`}>
                {getSeverityIcon(error.severity)}
                <span className="capitalize">{error.severity}</span>
              </div>
              <span className="text-xs text-gray-500">{timeAgo}</span>
            </div>
            
            {/* Error Message */}
            <h4 className={`font-semibold ${colors.text} mb-1`}>
              {error.userFriendlyMessage}
            </h4>
            
            {/* Technical Details (collapsible) */}
            {error.details && (
              <details className="mt-2">
                <summary className={`text-xs cursor-pointer ${colors.text} opacity-75 hover:opacity-100`}>
                  Technical Details
                </summary>
                <div className="mt-1 p-2 bg-white rounded border text-xs text-gray-600 font-mono">
                  <div><strong>Type:</strong> {error.type}</div>
                  <div><strong>Message:</strong> {error.message}</div>
                  {error.context && (
                    <div><strong>Context:</strong> {JSON.stringify(error.context, null, 2)}</div>
                  )}
                </div>
              </details>
            )}
            
            {/* Action Buttons */}
            <div className="flex items-center space-x-2 mt-3">
              {error.retryable && onRetry && (
                <button
                  onClick={() => onRetry(error.id)}
                  disabled={isRetrying}
                  className={`flex items-center space-x-1 px-3 py-1.5 text-white text-xs rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${colors.button}`}
                >
                  <RefreshCw className={`w-3 h-3 ${isRetrying ? 'animate-spin' : ''}`} />
                  <span>{isRetrying ? 'Retrying...' : 'Retry'}</span>
                </button>
              )}
              
              <button
                onClick={() => onDismiss(error.id)}
                className="flex items-center space-x-1 px-3 py-1.5 text-gray-600 hover:text-gray-800 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <X className="w-3 h-3" />
                <span>Dismiss</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ErrorNotification