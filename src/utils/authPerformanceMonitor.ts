/**
 * Authentication Performance Monitor
 *
 * Tracks authentication flow performance metrics and provides
 * optimization insights for better user experience.
 */

import { logger as loggingService } from '../lib/logging'

export interface AuthPerformanceMetrics {
  sessionCheck: number
  userProfileFetch: number
  projectCheck: number
  totalAuthTime: number
  authState: 'success' | 'timeout' | 'error'
  timestamp: number
  memoryUsage?: number
  networkLatency?: number
  cacheHitRate?: number
  animationFrameRate?: number
  resourceTiming?: PerformanceResourceTiming[]
}

class AuthPerformanceMonitor {
  private metrics: AuthPerformanceMetrics[] = []
  private currentSession: Partial<AuthPerformanceMetrics> = {}
  private sessionStartTime: number = 0
  private logger = loggingService.withContext({ component: 'AuthPerformanceMonitor' })

  // CRITICAL FIX: Performance monitoring must be explicitly enabled to prevent console noise
  private isMonitoringEnabled = import.meta.env.DEV && import.meta.env.VITE_ENABLE_PERFORMANCE_MONITORING === 'true'

  startSession() {
    if (!this.isMonitoringEnabled) return
    this.sessionStartTime = performance.now()
    this.currentSession = {
      timestamp: Date.now(),
      authState: 'success'
    }
    this.logger.debug('⚡ Auth performance monitoring started')
  }

  recordSessionCheck(duration: number) {
    if (!this.isMonitoringEnabled) return
    this.currentSession.sessionCheck = duration
    this.logger.debug('📊 Session check completed:', { duration: `${duration.toFixed(1)}ms` })
  }

  recordUserProfileFetch(duration: number) {
    if (!this.isMonitoringEnabled) return
    this.currentSession.userProfileFetch = duration
    this.logger.debug('📊 User profile fetch completed:', { duration: `${duration.toFixed(1)}ms` })
  }

  recordProjectCheck(duration: number) {
    if (!this.isMonitoringEnabled) return
    this.currentSession.projectCheck = duration
    this.logger.debug('📊 Project check completed:', { duration: `${duration.toFixed(1)}ms` })
  }

  finishSession(state: 'success' | 'timeout' | 'error' = 'success') {
    if (!this.isMonitoringEnabled) return

    const totalTime = performance.now() - this.sessionStartTime

    // Collect additional performance metrics
    const memoryUsage = this.getMemoryUsage()
    const animationFrameRate = this.measureAnimationFrameRate()
    const resourceTiming = this.getResourceTiming()

    const finalMetrics: AuthPerformanceMetrics = {
      sessionCheck: this.currentSession.sessionCheck || 0,
      userProfileFetch: this.currentSession.userProfileFetch || 0,
      projectCheck: this.currentSession.projectCheck || 0,
      totalAuthTime: totalTime,
      authState: state,
      timestamp: this.currentSession.timestamp || Date.now(),
      memoryUsage,
      animationFrameRate,
      resourceTiming
    }

    this.metrics.push(finalMetrics)

    // Keep only last 20 sessions for better trend analysis
    if (this.metrics.length > 20) {
      this.metrics = this.metrics.slice(-20)
    }

    this.logger.debug('📊 Auth session completed:', {
      total: `${totalTime.toFixed(1)}ms`,
      state,
      breakdown: {
        session: `${finalMetrics.sessionCheck.toFixed(1)}ms`,
        profile: `${finalMetrics.userProfileFetch.toFixed(1)}ms`,
        projects: `${finalMetrics.projectCheck.toFixed(1)}ms`
      },
      memory: memoryUsage ? `${memoryUsage.toFixed(1)}MB` : 'N/A',
      fps: finalMetrics.animationFrameRate ? `${finalMetrics.animationFrameRate.toFixed(1)}fps` : 'N/A'
    })

    this.analyzePerformance()
    this.currentSession = {}
  }

  private analyzePerformance() {
    if (this.metrics.length === 0) return

    const recent = this.metrics.slice(-5) // Last 5 sessions
    const avgTotal = recent.reduce((sum, m) => sum + m.totalAuthTime, 0) / recent.length
    const successRate = recent.filter(m => m.authState === 'success').length / recent.length

    // PERFORMANCE CRISIS DETECTION: Much more aggressive thresholds
    if (avgTotal > 2000) {
      this.logger.warn('🚨 CRITICAL: Auth performance crisis detected - average time:', { avgTime: `${avgTotal.toFixed(1)}ms (target: <2000ms)` })
      this.triggerPerformanceAlert('critical', avgTotal, successRate)
    } else if (avgTotal > 1500) {
      this.logger.warn('⚠️ WARNING: Auth performance degraded - average time:', { avgTime: `${avgTotal.toFixed(1)}ms` })
      this.triggerPerformanceAlert('warning', avgTotal, successRate)
    } else if (avgTotal < 1000) {
      this.logger.debug('✅ EXCELLENT: Auth performance optimal:', { avgTime: `${avgTotal.toFixed(1)}ms` })
    } else {
      this.logger.debug('📊 GOOD: Auth performance acceptable:', { avgTime: `${avgTotal.toFixed(1)}ms` })
    }

    if (successRate < 0.95) {
      this.logger.warn('🚨 CRITICAL: Auth reliability crisis - success rate:', { successRate: `${(successRate * 100).toFixed(1)}% (target: >95%)` })
      this.triggerReliabilityAlert(successRate)
    }

    // More aggressive bottleneck identification
    const avgSessionCheck = recent.reduce((sum, m) => sum + m.sessionCheck, 0) / recent.length
    const avgProfileFetch = recent.reduce((sum, m) => sum + m.userProfileFetch, 0) / recent.length
    const avgProjectCheck = recent.reduce((sum, m) => sum + m.projectCheck, 0) / recent.length

    if (avgSessionCheck > 800) {
      this.logger.warn('🐛 Session check bottleneck detected:', { avgTime: `${avgSessionCheck.toFixed(1)}ms avg` })
    }

    if (avgProfileFetch > 600) {
      this.logger.warn('🐛 Profile fetch bottleneck detected:', { avgTime: `${avgProfileFetch.toFixed(1)}ms avg` })
    }

    if (avgProjectCheck > 500) {
      this.logger.warn('🐛 Project check bottleneck detected:', { avgTime: `${avgProjectCheck.toFixed(1)}ms avg` })
    }

    // PERFORMANCE: Check for cache efficiency
    this.analyzeCachePerformance()
  }

  // PERFORMANCE: New alert system for critical issues
  private triggerPerformanceAlert(level: 'warning' | 'critical', avgTime: number, successRate: number) {
    const alertData = {
      level,
      avgAuthTime: avgTime,
      successRate,
      timestamp: new Date().toISOString(),
      recommendations: this.generateRecommendations(avgTime, successRate)
    }

    // Log structured alert data for monitoring systems
    this.logger.warn('Performance threshold exceeded', {
      alertLevel: level,
      avgAuthTime: avgTime,
      successRate,
      recommendations: alertData.recommendations,
      metric: 'authentication_performance'
    })

    // In production, this could trigger external monitoring alerts
    if (typeof window !== 'undefined' && level === 'critical') {
      // Trigger browser-based alert for critical issues
      this.showCriticalAlert(avgTime, successRate)
    }
  }

  private triggerReliabilityAlert(successRate: number) {
    this.logger.error('Reliability threshold breached', undefined, {
      type: 'reliability_crisis',
      successRate,
      severity: 'critical',
      metric: 'auth_success_rate'
    })
  }

  // Generate specific optimization recommendations
  private generateRecommendations(avgTime: number, successRate: number): string[] {
    const recommendations = []

    if (avgTime > 2500) {
      recommendations.push('Reduce API timeout values for faster failure detection')
      recommendations.push('Implement connection pooling and query optimization')
    }

    if (avgTime > 2000) {
      recommendations.push('Increase cache duration for user profiles and sessions')
      recommendations.push('Optimize database queries and add proper indexing')
    }

    if (successRate < 0.9) {
      recommendations.push('Review timeout coordination between frontend and backend')
      recommendations.push('Implement better fallback mechanisms')
    }

    return recommendations
  }

  // Show critical performance alert to user
  private showCriticalAlert(avgTime: number, successRate: number) {
    if (typeof window !== 'undefined') {
      this.logger.error('Critical authentication performance degradation', undefined, {
        avgAuthTime: avgTime,
        target: 2000,
        successRate: successRate,
        targetSuccessRate: 0.95,
        impact: 'user_experience',
        action_required: 'immediate',
        severity: 'critical'
      })
    }
  }

  // Analyze cache performance for optimization opportunities
  private analyzeCachePerformance() {
    const cacheHitRate = this.calculateCacheHitRate()

    if (cacheHitRate < 0.8) {
      this.logger.warn('📊 Low cache hit rate detected:', { hitRate: `${(cacheHitRate * 100).toFixed(1)}% (target: >80%)` })
      this.logger.warn('💡 Recommendation: Increase cache duration or review cache invalidation strategy')
    } else if (cacheHitRate > 0.9) {
      this.logger.debug('✅ Excellent cache performance:', { hitRate: `${(cacheHitRate * 100).toFixed(1)}% hit rate` })
    }
  }

  // Calculate cache hit rate from recent metrics
  private calculateCacheHitRate(): number {
    // This would be calculated from actual cache metrics
    // For now, return a placeholder that can be enhanced with real data
    return 0.85 // Default assumption
  }

  getPerformanceReport(): AuthPerformanceMetrics[] {
    return [...this.metrics]
  }

  getMetrics() {
    return {
      current: this.getCurrentSessionMetrics(),
      averages: this.getAverageMetrics(),
      report: this.getPerformanceReport(),
      trends: this.getTrendAnalysis(),
      sessionCount: this.metrics.length
    }
  }

  getAverageMetrics() {
    if (this.metrics.length === 0) return null

    const successful = this.metrics.filter(m => m.authState === 'success')
    if (successful.length === 0) return null

    return {
      avgTotalTime: successful.reduce((sum, m) => sum + m.totalAuthTime, 0) / successful.length,
      avgSessionCheck: successful.reduce((sum, m) => sum + m.sessionCheck, 0) / successful.length,
      avgProfileFetch: successful.reduce((sum, m) => sum + m.userProfileFetch, 0) / successful.length,
      avgProjectCheck: successful.reduce((sum, m) => sum + m.projectCheck, 0) / successful.length,
      successRate: successful.length / this.metrics.length,
      sampleSize: this.metrics.length
    }
  }

  // Storage optimization check
  checkStoragePerformance() {
    const start = performance.now()

    try {
      // Test localStorage performance
      const testKey = 'auth-perf-test'
      const testData = JSON.stringify({ test: 'data', timestamp: Date.now() })

      localStorage.setItem(testKey, testData)
      localStorage.getItem(testKey)
      localStorage.removeItem(testKey)

      const storageTime = performance.now() - start

      if (storageTime > 10) {
        this.logger.warn('⚠️ localStorage performance issue detected:', { time: `${storageTime.toFixed(1)}ms` })
      } else {
        this.logger.debug('✅ localStorage performance OK:', { time: `${storageTime.toFixed(1)}ms` })
      }

      return storageTime
    } catch (error) {
      this.logger.error('❌ Storage performance check failed:', error as Error)
      return -1
    }
  }

  // Network performance check for auth endpoints
  async checkNetworkPerformance() {
    const start = performance.now()

    try {
      // Basic connectivity check - don't make actual auth calls
      await fetch('/api/health', {
        method: 'HEAD',
        cache: 'no-cache',
        signal: AbortSignal.timeout(2000)
      })

      const networkTime = performance.now() - start

      if (networkTime > 1000) {
        this.logger.warn('⚠️ Network performance issue detected:', { time: `${networkTime.toFixed(1)}ms` })
      } else {
        this.logger.debug('✅ Network performance OK:', { time: `${networkTime.toFixed(1)}ms` })
      }

      return networkTime
    } catch (error) {
      const networkTime = performance.now() - start
      this.logger.warn('⚠️ Network check failed:', { error, time: `${networkTime.toFixed(1)}ms` })
      return networkTime
    }
  }

  // Memory usage monitoring
  private getMemoryUsage(): number | undefined {
    if ('memory' in performance) {
      const memory = (performance as any).memory
      return memory.usedJSHeapSize / 1024 / 1024 // Convert to MB
    }
    return undefined
  }

  // Animation frame rate measurement
  private measureAnimationFrameRate(): number | undefined {
    if (typeof requestAnimationFrame === 'undefined') return undefined

    // Return a default value for immediate use
    // Actual measurement would be done asynchronously
    return 60
  }

  // Async version for actual measurement (currently unused)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  // @ts-expect-error - Preserved for future async measurement
  private async _measureAnimationFrameRateAsync(): Promise<number> {
    if (typeof requestAnimationFrame === 'undefined') return 60

    let frameCount = 0
    let startTime = performance.now()
    const duration = 1000 // Measure for 1 second

    return new Promise<number>((resolve) => {
      function measureFrame() {
        frameCount++
        const currentTime = performance.now()

        if (currentTime - startTime < duration) {
          requestAnimationFrame(measureFrame)
        } else {
          const fps = (frameCount * 1000) / (currentTime - startTime)
          resolve(fps)
        }
      }

      requestAnimationFrame(measureFrame)

      // Fallback timeout
      setTimeout(() => resolve(60), duration + 100)
    })
  }

  // Resource timing for auth-related requests
  private getResourceTiming(): PerformanceResourceTiming[] {
    if (!performance.getEntriesByType) return []

    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[]
    const authResources = resources.filter(resource =>
      resource.name.includes('/api/auth') ||
      resource.name.includes('supabase') ||
      resource.name.includes('auth')
    ).slice(-10) // Last 10 auth-related requests

    return authResources
  }

  // Real-time performance monitoring
  recordNetworkLatency(duration: number) {
    this.currentSession.networkLatency = duration
    this.logger.debug('📊 Network latency recorded:', { duration: `${duration.toFixed(1)}ms` })
  }

  recordCacheHitRate(rate: number) {
    this.currentSession.cacheHitRate = rate
    this.logger.debug('📊 Cache hit rate:', { rate: `${rate.toFixed(1)}%` })
  }

  // Get current session metrics
  getCurrentSessionMetrics() {
    return { ...this.currentSession }
  }

  // Performance trend analysis
  getTrendAnalysis() {
    if (this.metrics.length < 3) return null

    const recent = this.metrics.slice(-5)
    const older = this.metrics.slice(-10, -5)

    if (older.length === 0) return null

    const recentAvg = recent.reduce((sum, m) => sum + m.totalAuthTime, 0) / recent.length
    const olderAvg = older.reduce((sum, m) => sum + m.totalAuthTime, 0) / older.length

    const trend = recentAvg < olderAvg ? 'improving' : recentAvg > olderAvg ? 'degrading' : 'stable'
    const change = Math.abs(recentAvg - olderAvg)
    const changePercent = (change / olderAvg) * 100

    return {
      trend,
      change: change.toFixed(1),
      changePercent: changePercent.toFixed(1),
      recentAvg: recentAvg.toFixed(1),
      olderAvg: olderAvg.toFixed(1)
    }
  }
}

// Singleton instance
export const authPerformanceMonitor = new AuthPerformanceMonitor()

// Development helper for performance debugging
if (import.meta.env.DEV) {
  // Expose monitor to global scope for debugging
  ;(window as any).authPerfMonitor = authPerformanceMonitor

  // Auto-run performance test after authentication events
  let testScheduled = false
  const originalFinishSession = authPerformanceMonitor.finishSession.bind(authPerformanceMonitor)
  authPerformanceMonitor.finishSession = function(state: 'success' | 'timeout' | 'error' = 'success') {
    // CRITICAL FIX: Respect monitoring enabled flag even in development override
    const isMonitoringEnabled = import.meta.env.DEV && import.meta.env.VITE_ENABLE_PERFORMANCE_MONITORING === 'true'

    if (!isMonitoringEnabled) {
      // Skip all monitoring when disabled
      return
    }

    // Call original implementation only if monitoring is enabled
    originalFinishSession(state)

    // Schedule performance test if not already scheduled
    if (!testScheduled && state === 'success') {
      testScheduled = true
      setTimeout(async () => {
        try {
          const { AuthPerformanceTest } = await import('./authPerformanceTest')
          const report = AuthPerformanceTest.generateOptimizationReport()
          authPerformanceMonitor['logger'].debug('Performance report generated', { report })
        } catch (error) {
          authPerformanceMonitor['logger'].warn('Failed to generate performance report', { error: error as Error })
        }
        testScheduled = false
      }, 1000)
    }
  }
}