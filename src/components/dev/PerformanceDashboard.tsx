import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Activity, Clock, Database, Network, AlertTriangle, CheckCircle, TrendingUp, BarChart3, Zap, RefreshCw } from 'lucide-react'
import { authPerformanceMonitor } from '../../utils/authPerformanceMonitor'
import { authPerformanceValidator } from '../../utils/authPerformanceValidator'
import { AuthPerformanceTest } from '../../utils/authPerformanceTest'
import { logger } from '../../utils/logger'

interface PerformanceMetrics {
  sessionCheck: number
  userProfileFetch: number
  projectCheck: number
  totalAuthTime: number
  authState: 'success' | 'timeout' | 'error'
  timestamp: number
  memoryUsage?: number
  networkLatency?: number
  cacheHitRate?: number
}

interface RealTimeStats {
  current: PerformanceMetrics | null
  average: any
  validation: any
  memoryStats: MemoryUsageStats
  networkStats: NetworkStats
  cacheStats: CacheStats
}

interface MemoryUsageStats {
  used: number
  total: number
  percentage: number
  trend: 'up' | 'down' | 'stable'
}

interface NetworkStats {
  latency: number
  status: 'excellent' | 'good' | 'poor' | 'offline'
  lastCheck: number
}

interface CacheStats {
  hitRate: number
  totalRequests: number
  hits: number
  misses: number
}

const PerformanceDashboard: React.FC = () => {
  const [stats, setStats] = useState<RealTimeStats>({
    current: null,
    average: null,
    validation: null,
    memoryStats: { used: 0, total: 0, percentage: 0, trend: 'stable' },
    networkStats: { latency: 0, status: 'offline', lastCheck: 0 },
    cacheStats: { hitRate: 0, totalRequests: 0, hits: 0, misses: 0 }
  })

  const [isMonitoring, setIsMonitoring] = useState(false)
  const [performanceHistory, setPerformanceHistory] = useState<PerformanceMetrics[]>([])
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const memoryIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const networkIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Memory monitoring
  const checkMemoryUsage = useCallback(() => {
    if ('memory' in performance) {
      const memory = (performance as any).memory
      const used = memory.usedJSHeapSize / 1024 / 1024 // MB
      const total = memory.totalJSHeapSize / 1024 / 1024 // MB
      const percentage = (used / total) * 100

      setStats(prev => ({
        ...prev,
        memoryStats: {
          used: Math.round(used * 100) / 100,
          total: Math.round(total * 100) / 100,
          percentage: Math.round(percentage * 100) / 100,
          trend: used > prev.memoryStats.used ? 'up' : used < prev.memoryStats.used ? 'down' : 'stable'
        }
      }))
    }
  }, [])

  // Network monitoring
  const checkNetworkLatency = useCallback(async () => {
    const start = performance.now()
    try {
      await fetch('/api/health', {
        method: 'HEAD',
        cache: 'no-cache',
        signal: AbortSignal.timeout(5000)
      })
      const latency = performance.now() - start

      let status: NetworkStats['status'] = 'excellent'
      if (latency > 1000) status = 'poor'
      else if (latency > 500) status = 'good'

      setStats(prev => ({
        ...prev,
        networkStats: {
          latency: Math.round(latency),
          status,
          lastCheck: Date.now()
        }
      }))
    } catch (_error) {
      setStats(prev => ({
        ...prev,
        networkStats: {
          latency: -1,
          status: 'offline',
          lastCheck: Date.now()
        }
      }))
    }
  }, [])

  // Cache monitoring (simplified estimation)
  const estimateCacheStats = useCallback(() => {
    const average = authPerformanceMonitor.getAverageMetrics()
    if (average) {
      // Estimate cache performance based on timing
      const profileFetchTime = average.avgProfileFetch
      let hitRate = 0

      if (profileFetchTime < 200) hitRate = 90
      else if (profileFetchTime < 400) hitRate = 70
      else if (profileFetchTime < 600) hitRate = 50
      else hitRate = 30

      setStats(prev => ({
        ...prev,
        cacheStats: {
          hitRate,
          totalRequests: average.sampleSize * 3, // Estimate 3 requests per session
          hits: Math.round((average.sampleSize * 3) * (hitRate / 100)),
          misses: Math.round((average.sampleSize * 3) * (1 - hitRate / 100))
        }
      }))
    }
  }, [])

  // Real-time performance monitoring
  const updatePerformanceStats = useCallback(async () => {
    try {
      // Get current metrics
      const average = authPerformanceMonitor.getAverageMetrics()
      const validation = await authPerformanceValidator.validateCurrentPerformance()

      // Get recent performance data
      const recentMetrics = authPerformanceMonitor.getPerformanceReport()
      const latest = recentMetrics[recentMetrics.length - 1]

      setStats(prev => ({
        ...prev,
        current: latest || null,
        average,
        validation
      }))

      // Update history
      if (latest && !performanceHistory.find(m => m.timestamp === latest.timestamp)) {
        setPerformanceHistory(prev => {
          const updated = [...prev, latest].slice(-20) // Keep last 20 entries
          return updated
        })
      }

      // Update cache stats
      estimateCacheStats()

    } catch (_error) {
      logger.warn('Performance stats update failed:', error)
    }
  }, [performanceHistory, estimateCacheStats])

  // Start/stop monitoring
  const toggleMonitoring = useCallback(() => {
    if (isMonitoring) {
      // Stop monitoring
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (memoryIntervalRef.current) clearInterval(memoryIntervalRef.current)
      if (networkIntervalRef.current) clearInterval(networkIntervalRef.current)
      setIsMonitoring(false)
      logger.info('Performance monitoring stopped')
    } else {
      // Start monitoring with more reasonable intervals to reduce noise
      intervalRef.current = setInterval(updatePerformanceStats, 15000) // Every 15 seconds
      memoryIntervalRef.current = setInterval(checkMemoryUsage, 30000) // Every 30 seconds
      networkIntervalRef.current = setInterval(checkNetworkLatency, 60000) // Every 60 seconds

      // Initial checks
      updatePerformanceStats()
      checkMemoryUsage()
      checkNetworkLatency()

      setIsMonitoring(true)
      logger.info('Performance monitoring started with optimized intervals')
    }
  }, [isMonitoring, updatePerformanceStats, checkMemoryUsage, checkNetworkLatency])

  // Run performance test
  const runPerformanceTest = useCallback(async () => {
    logger.debug('🧪 Running comprehensive performance test...')
    try {
      const result = await AuthPerformanceTest.runPerformanceTest()
      logger.debug('📊 Performance test completed:', result)

      // Generate and log report
      const report = AuthPerformanceTest.generateOptimizationReport()
      logger.debug(report)

      // Update current validation
      const validation = await authPerformanceValidator.validateCurrentPerformance()
      setStats(prev => ({
        ...prev,
        validation
      }))
    } catch (_error) {
      logger.error('❌ Performance test failed:', error)
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (memoryIntervalRef.current) clearInterval(memoryIntervalRef.current)
      if (networkIntervalRef.current) clearInterval(networkIntervalRef.current)
    }
  }, [])

  // Auto-start monitoring in development - but only if debug mode is enabled
  useEffect(() => {
    if (import.meta.env.DEV && !isMonitoring && logger.isDebugEnabled()) {
      logger.info('Auto-starting performance monitoring in debug mode')
      toggleMonitoring()
    }
  }, [])

  const getStatusColor = (value: number, target: number, inverse = false) => {
    const ratio = inverse ? target / value : value / target
    if (ratio <= 0.5) return 'text-green-600'
    if (ratio <= 0.8) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getStatusIcon = (passed: boolean) =>
    passed ? <CheckCircle className="w-4 h-4 text-green-600" /> : <AlertTriangle className="w-4 h-4 text-red-600" />

  const formatTime = (ms: number) => `${ms.toFixed(1)}ms`
  const formatPercentage = (value: number) => `${value.toFixed(1)}%`

  return (
    <div className="performance-dashboard bg-white rounded-lg shadow-lg p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Activity className="w-6 h-6 text-blue-600" />
          <h2 className="text-xl font-bold text-gray-900">Authentication Performance Monitor</h2>
          {isMonitoring && <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />}
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={runPerformanceTest}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 flex items-center space-x-1"
          >
            <BarChart3 className="w-4 h-4" />
            <span>Run Test</span>
          </button>
          <button
            onClick={toggleMonitoring}
            className={`px-3 py-1.5 rounded-md text-sm flex items-center space-x-1 ${
              isMonitoring
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {isMonitoring ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
            <span>{isMonitoring ? 'Stop' : 'Start'} Monitoring</span>
          </button>
        </div>
      </div>

      {/* Current Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <Clock className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-medium text-gray-700">Total Auth Time</span>
          </div>
          <div className="mt-2">
            <div className={`text-2xl font-bold ${stats.average ? getStatusColor(stats.average.avgTotalTime, 800) : 'text-gray-400'}`}>
              {stats.average ? formatTime(stats.average.avgTotalTime) : 'N/A'}
            </div>
            <div className="text-xs text-gray-500">Target: &lt;800ms</div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <Database className="w-5 h-5 text-green-600" />
            <span className="text-sm font-medium text-gray-700">Profile Fetch</span>
          </div>
          <div className="mt-2">
            <div className={`text-2xl font-bold ${stats.average ? getStatusColor(stats.average.avgProfileFetch, 400) : 'text-gray-400'}`}>
              {stats.average ? formatTime(stats.average.avgProfileFetch) : 'N/A'}
            </div>
            <div className="text-xs text-gray-500">Target: &lt;400ms</div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-purple-50 to-violet-50 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <Network className="w-5 h-5 text-purple-600" />
            <span className="text-sm font-medium text-gray-700">Network Latency</span>
          </div>
          <div className="mt-2">
            <div className={`text-2xl font-bold ${stats.networkStats.latency > 0 ? getStatusColor(stats.networkStats.latency, 500) : 'text-gray-400'}`}>
              {stats.networkStats.latency > 0 ? formatTime(stats.networkStats.latency) : 'Offline'}
            </div>
            <div className="text-xs text-gray-500">Status: {stats.networkStats.status}</div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <Zap className="w-5 h-5 text-orange-600" />
            <span className="text-sm font-medium text-gray-700">Cache Hit Rate</span>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-orange-600">
              {formatPercentage(stats.cacheStats.hitRate)}
            </div>
            <div className="text-xs text-gray-500">{stats.cacheStats.hits}/{stats.cacheStats.totalRequests} hits</div>
          </div>
        </div>
      </div>

      {/* Memory Usage */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900">Memory Usage</h3>
          <TrendingUp className={`w-5 h-5 ${
            stats.memoryStats.trend === 'up' ? 'text-red-500' :
            stats.memoryStats.trend === 'down' ? 'text-green-500' : 'text-gray-500'
          }`} />
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex-1">
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>Used: {stats.memoryStats.used}MB</span>
              <span>Total: {stats.memoryStats.total}MB</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, stats.memoryStats.percentage)}%` }}
              />
            </div>
          </div>
          <div className="text-2xl font-bold text-blue-600">
            {formatPercentage(stats.memoryStats.percentage)}
          </div>
        </div>
      </div>

      {/* Performance Validation */}
      {stats.validation && (
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-900">Performance Validation</h3>
            <div className="flex items-center space-x-2">
              {getStatusIcon(stats.validation.passed)}
              <span className="text-sm font-medium">Score: {stats.validation.score}/100</span>
            </div>
          </div>

          {stats.validation.issues && stats.validation.issues.length > 0 && (
            <div className="mb-3">
              <h4 className="text-sm font-medium text-red-700 mb-2">Issues:</h4>
              <ul className="space-y-1">
                {stats.validation.issues.map((issue: string, index: number) => (
                  <li key={index} className="text-sm text-red-600 flex items-start space-x-1">
                    <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    <span>{issue}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {stats.validation.recommendations && stats.validation.recommendations.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-blue-700 mb-2">Recommendations:</h4>
              <ul className="space-y-1">
                {stats.validation.recommendations.map((rec: string, index: number) => (
                  <li key={index} className="text-sm text-blue-600 flex items-start space-x-1">
                    <TrendingUp className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Performance History Chart */}
      {performanceHistory.length > 0 && (
        <div className="bg-white border rounded-lg p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Performance History</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Response Times (ms)</h4>
              <div className="space-y-2">
                {performanceHistory.slice(-5).map((metric, index) => (
                  <div key={index} className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">
                      {new Date(metric.timestamp).toLocaleTimeString()}
                    </span>
                    <div className="flex space-x-2">
                      <span className={getStatusColor(metric.totalAuthTime, 800)}>
                        Total: {formatTime(metric.totalAuthTime)}
                      </span>
                      <span className={getStatusColor(metric.userProfileFetch, 400)}>
                        Profile: {formatTime(metric.userProfileFetch)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Success Rate</h4>
              <div className="space-y-2">
                {performanceHistory.slice(-5).map((metric, index) => (
                  <div key={index} className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">
                      {new Date(metric.timestamp).toLocaleTimeString()}
                    </span>
                    <span className={metric.authState === 'success' ? 'text-green-600' : 'text-red-600'}>
                      {metric.authState === 'success' ? '✅ Success' : '❌ ' + metric.authState}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Development Info */}
      {import.meta.env.DEV && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">Development Tools</h3>
          <div className="text-xs text-blue-700 space-y-1">
            <p>• Access global performance objects: <code>window.authPerfMonitor</code>, <code>window.authPerfValidator</code>, <code>window.authPerfTest</code></p>
            <p>• Monitor console for real-time performance logs</p>
            <p>• Performance targets: Total &lt;800ms, Session &lt;300ms, Profile &lt;400ms, Project &lt;200ms</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default PerformanceDashboard