/**
 * Network Performance Monitor
 *
 * Monitors network performance, API calls, and connection quality
 * for comprehensive authentication performance analysis.
 */

import { logger } from './logger'

interface NetworkRequest {
  url: string
  method: string
  startTime: number
  endTime: number
  duration: number
  status: number
  size: number
  type: 'auth' | 'api' | 'resource' | 'other'
}

interface NetworkMetrics {
  averageLatency: number
  totalRequests: number
  authRequests: number
  apiRequests: number
  failedRequests: number
  slowRequests: number
  connectionType: string
  effectiveType: string
  downlink: number
  rtt: number
}

interface ConnectionQuality {
  score: number
  status: 'excellent' | 'good' | 'poor' | 'offline'
  recommendations: string[]
}

class NetworkPerformanceMonitor {
  private requests: NetworkRequest[] = []
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  // @ts-expect-error - Preserved for future monitoring control
  private _isMonitoring = false
  private originalFetch: typeof fetch

  constructor() {
    this.originalFetch = window.fetch
    this.initializeMonitoring()
  }

  private initializeMonitoring() {
    // Monitor fetch requests
    this.interceptFetch()

    // Monitor connection changes
    this.monitorConnection()

    // Monitor performance entries
    this.monitorResourceTiming()
  }

  private interceptFetch() {
    const self = this
    window.fetch = async function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      const startTime = performance.now()
      const url = typeof input === 'string' ? input : input.toString()
      const method = init?.method || 'GET'

      try {
        const response = await self.originalFetch(input, init)
        const endTime = performance.now()
        const duration = endTime - startTime

        // Categorize request type
        let type: NetworkRequest['type'] = 'other'
        if (url.includes('/api/auth') || url.includes('auth')) type = 'auth'
        else if (url.includes('/api/')) type = 'api'
        else if (url.includes('.js') || url.includes('.css') || url.includes('.png')) type = 'resource'

        // Get response size
        const size = parseInt(response.headers.get('content-length') || '0')

        const request: NetworkRequest = {
          url,
          method,
          startTime,
          endTime,
          duration,
          status: response.status,
          size,
          type
        }

        self.recordRequest(request)

        // Log performance for auth requests
        if (type === 'auth') {
          logger.debug('🌐 Auth request completed:', {
            url: url.split('/').pop(),
            duration: `${duration.toFixed(1)}ms`,
            status: response.status
          })
        }

        return response
      } catch (error) {
        const endTime = performance.now()
        const duration = endTime - startTime

        const request: NetworkRequest = {
          url,
          method,
          startTime,
          endTime,
          duration,
          status: 0,
          size: 0,
          type: url.includes('auth') ? 'auth' : 'other'
        }

        self.recordRequest(request)

        logger.warn('🌐 Network request failed:', {
          url: url.split('/').pop(),
          duration: `${duration.toFixed(1)}ms`,
          error: (error as Error).message
        })

        throw error
      }
    }
  }

  private monitorConnection() {
    // Monitor network information
    if ('connection' in navigator) {
      const connection = (navigator as any).connection

      const logConnectionChange = () => {
        logger.debug('🌐 Connection changed:', {
          effectiveType: connection.effectiveType,
          downlink: connection.downlink,
          rtt: connection.rtt,
          saveData: connection.saveData
        })
      }

      connection.addEventListener('change', logConnectionChange)
      logConnectionChange() // Initial log
    }

    // Monitor online/offline status
    const handleOnline = () => logger.debug('🌐 Connection restored')
    const handleOffline = () => logger.warn('🌐 Connection lost')

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
  }

  private monitorResourceTiming() {
    // Use PerformanceObserver for resource timing
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries()

          entries.forEach((entry) => {
            if (entry.entryType === 'resource') {
              const resourceEntry = entry as PerformanceResourceTiming

              // Focus on auth-related resources
              if (resourceEntry.name.includes('auth') ||
                  resourceEntry.name.includes('supabase') ||
                  resourceEntry.name.includes('/api/')) {

                logger.debug('🌐 Resource timing:', {
                  name: resourceEntry.name.split('/').pop(),
                  duration: `${resourceEntry.duration.toFixed(1)}ms`,
                  size: resourceEntry.transferSize,
                  cached: resourceEntry.transferSize === 0
                })
              }
            }
          })
        })

        observer.observe({ entryTypes: ['resource'] })
      } catch (error) {
        logger.warn('PerformanceObserver not supported:', error)
      }
    }
  }

  private recordRequest(request: NetworkRequest) {
    this.requests.push(request)

    // Keep only recent requests for memory efficiency
    if (this.requests.length > 100) {
      this.requests = this.requests.slice(-50)
    }
  }

  getNetworkMetrics(): NetworkMetrics {
    const recentRequests = this.requests.slice(-20) // Last 20 requests

    const totalRequests = recentRequests.length
    const authRequests = recentRequests.filter(r => r.type === 'auth').length
    const apiRequests = recentRequests.filter(r => r.type === 'api').length
    const failedRequests = recentRequests.filter(r => r.status >= 400 || r.status === 0).length
    const slowRequests = recentRequests.filter(r => r.duration > 1000).length

    const averageLatency = totalRequests > 0
      ? recentRequests.reduce((sum, r) => sum + r.duration, 0) / totalRequests
      : 0

    // Get connection info
    const connection = (navigator as any).connection
    const connectionType = connection?.type || 'unknown'
    const effectiveType = connection?.effectiveType || 'unknown'
    const downlink = connection?.downlink || 0
    const rtt = connection?.rtt || 0

    return {
      averageLatency,
      totalRequests,
      authRequests,
      apiRequests,
      failedRequests,
      slowRequests,
      connectionType,
      effectiveType,
      downlink,
      rtt
    }
  }

  assessConnectionQuality(): ConnectionQuality {
    const metrics = this.getNetworkMetrics()
    const recentAuthRequests = this.requests
      .filter(r => r.type === 'auth')
      .slice(-5) // Last 5 auth requests

    let score = 100
    const recommendations: string[] = []

    // Assess average latency
    if (metrics.averageLatency > 2000) {
      score -= 30
      recommendations.push('Very slow network detected - consider connection optimization')
    } else if (metrics.averageLatency > 1000) {
      score -= 15
      recommendations.push('Slow network detected - authentication may be delayed')
    }

    // Assess auth request performance
    if (recentAuthRequests.length > 0) {
      const avgAuthLatency = recentAuthRequests.reduce((sum, r) => sum + r.duration, 0) / recentAuthRequests.length

      if (avgAuthLatency > 1500) {
        score -= 25
        recommendations.push('Authentication requests are slow - check server performance')
      }
    }

    // Assess failure rate
    const failureRate = metrics.totalRequests > 0 ? metrics.failedRequests / metrics.totalRequests : 0
    if (failureRate > 0.2) {
      score -= 40
      recommendations.push('High request failure rate - check network stability')
    } else if (failureRate > 0.1) {
      score -= 20
      recommendations.push('Some requests failing - monitor network quality')
    }

    // Assess connection type
    if (metrics.effectiveType === 'slow-2g' || metrics.effectiveType === '2g') {
      score -= 30
      recommendations.push('Very slow connection - consider offline functionality')
    } else if (metrics.effectiveType === '3g') {
      score -= 15
      recommendations.push('Slow connection - optimize for mobile networks')
    }

    // Determine status
    let status: ConnectionQuality['status']
    if (score >= 90) status = 'excellent'
    else if (score >= 70) status = 'good'
    else if (score >= 40) status = 'poor'
    else status = 'offline'

    return {
      score: Math.max(0, Math.round(score)),
      status,
      recommendations
    }
  }

  getAuthRequestMetrics() {
    const authRequests = this.requests.filter(r => r.type === 'auth')

    if (authRequests.length === 0) {
      return null
    }

    const totalTime = authRequests.reduce((sum, r) => sum + r.duration, 0)
    const averageTime = totalTime / authRequests.length
    const successRate = authRequests.filter(r => r.status >= 200 && r.status < 400).length / authRequests.length

    return {
      totalRequests: authRequests.length,
      averageTime,
      successRate,
      fastestRequest: Math.min(...authRequests.map(r => r.duration)),
      slowestRequest: Math.max(...authRequests.map(r => r.duration)),
      recentRequests: authRequests.slice(-5)
    }
  }

  // Real-time latency test
  async testLatency(endpoint = '/api/health'): Promise<number> {
    const start = performance.now()

    try {
      await fetch(endpoint, {
        method: 'HEAD',
        cache: 'no-cache',
        signal: AbortSignal.timeout(5000)
      })

      return performance.now() - start
    } catch (error) {
      logger.warn('Latency test failed:', error)
      return -1
    }
  }

  // Network quality test
  async runNetworkQualityTest(): Promise<{
    latency: number
    downloadSpeed: number
    quality: ConnectionQuality
  }> {
    logger.debug('🧪 Running network quality test...')

    // Test latency
    const latency = await this.testLatency()

    // Simple download speed test (small file)
    const downloadStart = performance.now()
    let downloadSpeed = 0

    try {
      const response = await fetch('/favicon.ico', {
        cache: 'no-cache',
        signal: AbortSignal.timeout(5000)
      })

      if (response.ok) {
        await response.blob()
        const downloadTime = performance.now() - downloadStart
        const fileSize = parseInt(response.headers.get('content-length') || '1024')
        downloadSpeed = (fileSize * 8) / (downloadTime / 1000) // bits per second
      }
    } catch (error) {
      logger.warn('Download speed test failed:', error)
    }

    const quality = this.assessConnectionQuality()

    return {
      latency,
      downloadSpeed,
      quality
    }
  }

  startMonitoring() {
    this._isMonitoring = true
    logger.debug('🌐 Network performance monitoring started')
  }

  stopMonitoring() {
    this._isMonitoring = false
    // Restore original fetch
    window.fetch = this.originalFetch
    logger.debug('🌐 Network performance monitoring stopped')
  }

  getRecentRequests(count = 10): NetworkRequest[] {
    return this.requests.slice(-count)
  }

  clearHistory() {
    this.requests = []
    logger.debug('🌐 Network request history cleared')
  }

  generateReport(): string {
    const metrics = this.getNetworkMetrics()
    const quality = this.assessConnectionQuality()
    const authMetrics = this.getAuthRequestMetrics()

    return `
🌐 Network Performance Report
============================

📊 Overall Metrics:
• Average Latency: ${metrics.averageLatency.toFixed(1)}ms
• Total Requests: ${metrics.totalRequests}
• Failed Requests: ${metrics.failedRequests} (${((metrics.failedRequests / metrics.totalRequests) * 100).toFixed(1)}%)
• Slow Requests (>1s): ${metrics.slowRequests}

🔐 Authentication Requests:
${authMetrics ? `
• Total Auth Requests: ${authMetrics.totalRequests}
• Average Time: ${authMetrics.averageTime.toFixed(1)}ms
• Success Rate: ${(authMetrics.successRate * 100).toFixed(1)}%
• Fastest: ${authMetrics.fastestRequest.toFixed(1)}ms
• Slowest: ${authMetrics.slowestRequest.toFixed(1)}ms
` : '• No auth requests recorded'}

🌐 Connection Quality:
• Status: ${quality.status.toUpperCase()}
• Score: ${quality.score}/100
• Connection Type: ${metrics.effectiveType}
• Downlink: ${metrics.downlink}Mbps
• RTT: ${metrics.rtt}ms

${quality.recommendations.length > 0 ? `
🔧 Recommendations:
${quality.recommendations.map(rec => `• ${rec}`).join('\n')}
` : '✅ No performance issues detected'}
    `.trim()
  }
}

// Singleton instance
export const networkPerformanceMonitor = new NetworkPerformanceMonitor()

// Development helper
if (import.meta.env.DEV) {
  ;(window as any).networkPerfMonitor = networkPerformanceMonitor

  // Auto-start monitoring in development
  networkPerformanceMonitor.startMonitoring()
}