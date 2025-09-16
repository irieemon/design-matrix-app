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
  }\n\n  const getSeverityIcon = (severity: ErrorSeverity) => {\n    switch (severity) {\n      case 'critical':\n        return <AlertTriangle className=\"w-4 h-4\" />\n      case 'high':\n        return <AlertCircle className=\"w-4 h-4\" />\n      case 'medium':\n        return <Info className=\"w-4 h-4\" />\n      case 'low':\n        return <CheckCircle className=\"w-4 h-4\" />\n      default:\n        return <Info className=\"w-4 h-4\" />\n    }\n  }\n\n  const getSeverityColors = (severity: ErrorSeverity) => {\n    switch (severity) {\n      case 'critical':\n        return {\n          bg: 'bg-red-50 border-red-200',\n          icon: 'text-red-600',\n          text: 'text-red-800',\n          button: 'bg-red-600 hover:bg-red-700',\n          badge: 'bg-red-100 text-red-800'\n        }\n      case 'high':\n        return {\n          bg: 'bg-orange-50 border-orange-200',\n          icon: 'text-orange-600',\n          text: 'text-orange-800',\n          button: 'bg-orange-600 hover:bg-orange-700',\n          badge: 'bg-orange-100 text-orange-800'\n        }\n      case 'medium':\n        return {\n          bg: 'bg-yellow-50 border-yellow-200',\n          icon: 'text-yellow-600',\n          text: 'text-yellow-800',\n          button: 'bg-yellow-600 hover:bg-yellow-700',\n          badge: 'bg-yellow-100 text-yellow-800'\n        }\n      case 'low':\n        return {\n          bg: 'bg-blue-50 border-blue-200',\n          icon: 'text-blue-600',\n          text: 'text-blue-800',\n          button: 'bg-blue-600 hover:bg-blue-700',\n          badge: 'bg-blue-100 text-blue-800'\n        }\n      default:\n        return {\n          bg: 'bg-gray-50 border-gray-200',\n          icon: 'text-gray-600',\n          text: 'text-gray-800',\n          button: 'bg-gray-600 hover:bg-gray-700',\n          badge: 'bg-gray-100 text-gray-800'\n        }\n    }\n  }\n\n  const colors = getSeverityColors(error.severity)\n  const timeAgo = new Date(error.timestamp).toLocaleTimeString()\n\n  return (\n    <div className={`rounded-xl border p-4 mb-3 transition-all duration-300 hover:shadow-md ${colors.bg}`}>\n      <div className=\"flex items-start justify-between\">\n        <div className=\"flex items-start space-x-3 flex-1\">\n          {/* Error Type Icon */}\n          <div className={`p-2 rounded-lg bg-white shadow-sm ${colors.icon}`}>\n            {getErrorIcon(error.type)}\n          </div>\n          \n          <div className=\"flex-1 min-w-0\">\n            {/* Header with severity badge */}\n            <div className=\"flex items-center space-x-2 mb-2\">\n              <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${colors.badge}`}>\n                {getSeverityIcon(error.severity)}\n                <span className=\"capitalize\">{error.severity}</span>\n              </div>\n              <span className=\"text-xs text-gray-500\">{timeAgo}</span>\n            </div>\n            \n            {/* Error Message */}\n            <h4 className={`font-semibold ${colors.text} mb-1`}>\n              {error.userFriendlyMessage}\n            </h4>\n            \n            {/* Technical Details (collapsible) */}\n            {error.details && (\n              <details className=\"mt-2\">\n                <summary className={`text-xs cursor-pointer ${colors.text} opacity-75 hover:opacity-100`}>\n                  Technical Details\n                </summary>\n                <div className=\"mt-1 p-2 bg-white rounded border text-xs text-gray-600 font-mono\">\n                  <div><strong>Type:</strong> {error.type}</div>\n                  <div><strong>Message:</strong> {error.message}</div>\n                  {error.context && (\n                    <div><strong>Context:</strong> {JSON.stringify(error.context, null, 2)}</div>\n                  )}\n                </div>\n              </details>\n            )}\n            \n            {/* Action Buttons */}\n            <div className=\"flex items-center space-x-2 mt-3\">\n              {error.retryable && onRetry && (\n                <button\n                  onClick={() => onRetry(error.id)}\n                  disabled={isRetrying}\n                  className={`flex items-center space-x-1 px-3 py-1.5 text-white text-xs rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${colors.button}`}\n                >\n                  <RefreshCw className={`w-3 h-3 ${isRetrying ? 'animate-spin' : ''}`} />\n                  <span>{isRetrying ? 'Retrying...' : 'Retry'}</span>\n                </button>\n              )}\n              \n              <button\n                onClick={() => onDismiss(error.id)}\n                className=\"flex items-center space-x-1 px-3 py-1.5 text-gray-600 hover:text-gray-800 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors\"\n              >\n                <X className=\"w-3 h-3\" />\n                <span>Dismiss</span>\n              </button>\n            </div>\n          </div>\n        </div>\n      </div>\n    </div>\n  )\n}\n\nexport default ErrorNotification"