import React, { useState, useEffect, useCallback } from 'react'
import { Activity, X, Minimize2, Maximize2, BarChart3, AlertCircle } from 'lucide-react'
import { authPerformanceMonitor } from '../../utils/authPerformanceMonitor'
import { authPerformanceValidator } from '../../utils/authPerformanceValidator'

interface PerformanceOverlayProps {
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
}

const PerformanceOverlay: React.FC<PerformanceOverlayProps> = ({
  position = 'bottom-right'
}) => {
  const [isVisible, setIsVisible] = useState(false)
  const [isMinimized, setIsMinimized] = useState(true)
  const [metrics, setMetrics] = useState<any>(null)
  const [validation, setValidation] = useState<any>(null)
  const [memoryUsage, setMemoryUsage] = useState(0)
  const [lastUpdate, setLastUpdate] = useState(Date.now())

  // Update performance data
  const updateMetrics = useCallback(async () => {
    try {
      const currentMetrics = authPerformanceMonitor.getAverageMetrics()
      const currentValidation = await authPerformanceValidator.validateCurrentPerformance()

      setMetrics(currentMetrics)
      setValidation(currentValidation)
      setLastUpdate(Date.now())

      // Update memory usage if available
      if ('memory' in performance) {
        const memory = (performance as any).memory
        const usage = (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100
        setMemoryUsage(usage)
      }
    } catch (error) {
      console.warn('Performance overlay update failed:', error)
    }
  }, [])

  // Auto-update every 3 seconds
  useEffect(() => {
    if (!import.meta.env.DEV) return

    const interval = setInterval(updateMetrics, 3000)
    updateMetrics() // Initial update

    return () => clearInterval(interval)
  }, [updateMetrics])

  // Show overlay automatically if performance issues detected
  useEffect(() => {
    if (validation && !validation.passed && validation.score < 70) {
      setIsVisible(true)
      setIsMinimized(false)
    }
  }, [validation])

  // Don't render in production
  if (!import.meta.env.DEV) return null

  const getPositionClasses = () => {
    switch (position) {
      case 'top-left':
        return 'top-4 left-4'
      case 'top-right':
        return 'top-4 right-4'
      case 'bottom-left':
        return 'bottom-4 left-4'
      case 'bottom-right':
      default:
        return 'bottom-4 right-4'
    }
  }

  const getStatusColor = (score: number) => {
    if (score >= 90) return 'text-green-600 bg-green-100'
    if (score >= 70) return 'text-yellow-600 bg-yellow-100'
    return 'text-red-600 bg-red-100'
  }

  const formatTime = (ms: number) => `${ms.toFixed(0)}ms`

  if (!isVisible) {
    // Floating action button to show overlay
    return (
      <button
        onClick={() => setIsVisible(true)}
        className={`fixed ${getPositionClasses()} z-50 w-12 h-12 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-all duration-200 flex items-center justify-center group`}
        title="Performance Monitor"
      >
        <Activity className="w-5 h-5" />
        {validation && !validation.passed && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
        )}
      </button>
    )
  }

  return (
    <div className={`fixed ${getPositionClasses()} z-50 bg-white rounded-lg shadow-xl border border-gray-200 transition-all duration-300 ${
      isMinimized ? 'w-80' : 'w-96'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 bg-gray-50 rounded-t-lg">
        <div className="flex items-center space-x-2">
          <Activity className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-medium text-gray-900">Performance Monitor</span>
          {validation && !validation.passed && (
            <AlertCircle className="w-4 h-4 text-red-500" />
          )}
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 text-gray-400 hover:text-gray-600"
            title={isMinimized ? 'Expand' : 'Minimize'}
          >
            {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setIsVisible(false)}
            className="p-1 text-gray-400 hover:text-gray-600"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-3 space-y-3">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-2">
          <div className="text-center p-2 bg-blue-50 rounded">
            <div className="text-xs text-gray-600">Total Time</div>
            <div className={`text-sm font-bold ${metrics ?
              (metrics.avgTotalTime < 800 ? 'text-green-600' :
               metrics.avgTotalTime < 1500 ? 'text-yellow-600' : 'text-red-600')
              : 'text-gray-400'
            }`}>
              {metrics ? formatTime(metrics.avgTotalTime) : 'N/A'}
            </div>
          </div>
          <div className="text-center p-2 bg-green-50 rounded">
            <div className="text-xs text-gray-600">Score</div>
            <div className={`text-sm font-bold ${validation ? getStatusColor(validation.score).split(' ')[0] : 'text-gray-400'}`}>
              {validation ? `${validation.score}/100` : 'N/A'}
            </div>
          </div>
        </div>

        {/* Success Rate */}
        {metrics && (
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-600">Success Rate:</span>
            <span className={`text-xs font-medium ${
              metrics.successRate > 0.95 ? 'text-green-600' :
              metrics.successRate > 0.9 ? 'text-yellow-600' : 'text-red-600'
            }`}>
              {(metrics.successRate * 100).toFixed(1)}%
            </span>
          </div>
        )}

        {/* Memory Usage */}
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-600">Memory:</span>
          <span className={`text-xs font-medium ${
            memoryUsage < 70 ? 'text-green-600' :
            memoryUsage < 85 ? 'text-yellow-600' : 'text-red-600'
          }`}>
            {memoryUsage.toFixed(1)}%
          </span>
        </div>

        {/* Expanded View */}
        {!isMinimized && (
          <>
            {/* Detailed Metrics */}
            {metrics && (
              <div className="space-y-2 border-t pt-3">
                <h4 className="text-xs font-medium text-gray-700">Breakdown:</h4>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600">Session:</span>
                    <span className={metrics.avgSessionCheck < 300 ? 'text-green-600' : 'text-yellow-600'}>
                      {formatTime(metrics.avgSessionCheck)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600">Profile:</span>
                    <span className={metrics.avgProfileFetch < 400 ? 'text-green-600' : 'text-yellow-600'}>
                      {formatTime(metrics.avgProfileFetch)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600">Projects:</span>
                    <span className={metrics.avgProjectCheck < 200 ? 'text-green-600' : 'text-yellow-600'}>
                      {formatTime(metrics.avgProjectCheck)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Issues */}
            {validation && validation.issues && validation.issues.length > 0 && (
              <div className="border-t pt-3">
                <h4 className="text-xs font-medium text-red-700 mb-1">Issues:</h4>
                <div className="space-y-1">
                  {validation.issues.slice(0, 3).map((issue: string, index: number) => (
                    <div key={index} className="text-xs text-red-600 bg-red-50 p-1 rounded">
                      {issue.length > 50 ? `${issue.substring(0, 50)}...` : issue}
                    </div>
                  ))}
                  {validation.issues.length > 3 && (
                    <div className="text-xs text-gray-500">
                      +{validation.issues.length - 3} more issues
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="border-t pt-3 flex space-x-2">
              <button
                onClick={() => {
                  console.log('🚀 Performance Report:')
                  console.log(authPerformanceValidator.generatePerformanceReport())
                }}
                className="flex-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                <BarChart3 className="w-3 h-3 inline mr-1" />
                Console Report
              </button>
              <button
                onClick={updateMetrics}
                className="px-2 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Refresh
              </button>
            </div>
          </>
        )}

        {/* Last Update */}
        <div className="text-xs text-gray-400 text-center border-t pt-2">
          Updated {Math.round((Date.now() - lastUpdate) / 1000)}s ago
        </div>
      </div>
    </div>
  )
}

export default PerformanceOverlay