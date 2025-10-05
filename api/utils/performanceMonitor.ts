// Comprehensive Auth Performance Monitor
// Real-time tracking of authentication bottlenecks and optimization opportunities

interface PerformanceMetric {
  count: number
  totalTime: number
  minTime: number
  maxTime: number
  avgTime: number
  p95Time: number
  errorCount: number
  successRate: number
  samples: number[]
}

interface AuthPerformanceReport {
  overallSuccessRate: number
  avgAuthTime: number
  bottlenecks: string[]
  recommendations: string[]
  metrics: Record<string, PerformanceMetric>
}

class AuthPerformanceMonitor {
  private metrics = new Map<string, PerformanceMetric>()
  private sessionStarts = new Map<string, number>()
  private alertThresholds = {
    authTime: 2000,      // 2s max auth time
    successRate: 0.95,   // 95% min success rate
    errorRate: 0.1       // 10% max error rate
  }

  // Track authentication step timing
  recordMetric(operation: string, timeMs: number, success: boolean = true): void {
    const existing = this.metrics.get(operation) || {
      count: 0,
      totalTime: 0,
      minTime: Infinity,
      maxTime: 0,
      avgTime: 0,
      p95Time: 0,
      errorCount: 0,
      successRate: 1,
      samples: []
    }

    existing.count++
    if (success) {
      existing.totalTime += timeMs
      existing.minTime = Math.min(existing.minTime, timeMs)
      existing.maxTime = Math.max(existing.maxTime, timeMs)
      existing.avgTime = existing.totalTime / (existing.count - existing.errorCount)

      // Keep last 100 samples for percentile calculation
      existing.samples.push(timeMs)
      if (existing.samples.length > 100) {
        existing.samples.shift()
      }

      // Calculate P95
      const sorted = [...existing.samples].sort((a, b) => a - b)
      const p95Index = Math.ceil(sorted.length * 0.95) - 1
      existing.p95Time = sorted[p95Index] || timeMs
    } else {
      existing.errorCount++
    }

    existing.successRate = (existing.count - existing.errorCount) / existing.count

    this.metrics.set(operation, existing)

    // Alert on performance issues
    this.checkAlerts(operation, existing)
  }

  // Start tracking a session
  startSession(sessionId: string = 'default'): void {
    this.sessionStarts.set(sessionId, performance.now())
  }

  // End tracking and record total session time
  finishSession(sessionId: string = 'default', success: boolean = true): number {
    const startTime = this.sessionStarts.get(sessionId)
    if (startTime) {
      const totalTime = performance.now() - startTime
      this.recordMetric('total_auth_session', totalTime, success)
      this.sessionStarts.delete(sessionId)
      return totalTime
    }
    return 0
  }

  // Check for performance alerts
  private checkAlerts(operation: string, metric: PerformanceMetric): void {
    const alerts: string[] = []

    if (metric.avgTime > this.alertThresholds.authTime) {
      alerts.push(`${operation}: Average time ${metric.avgTime.toFixed(0)}ms exceeds ${this.alertThresholds.authTime}ms threshold`)
    }

    if (metric.successRate < this.alertThresholds.successRate) {
      alerts.push(`${operation}: Success rate ${(metric.successRate * 100).toFixed(1)}% below ${(this.alertThresholds.successRate * 100).toFixed(1)}% threshold`)
    }

    if (alerts.length > 0) {
      console.warn(`🚨 PERFORMANCE ALERT:`, alerts.join(', '))
    }
  }

  // Generate comprehensive performance report
  generateReport(): AuthPerformanceReport {
    const totalAuthMetric = this.metrics.get('total_auth_session')
    const bottlenecks: string[] = []
    const recommendations: string[] = []

    // Identify bottlenecks
    for (const [operation, metric] of this.metrics) {
      if (metric.avgTime > 1000) {
        bottlenecks.push(`${operation}: ${metric.avgTime.toFixed(0)}ms avg`)
      }
      if (metric.successRate < 0.9) {
        bottlenecks.push(`${operation}: ${(metric.successRate * 100).toFixed(1)}% success`)
      }
    }

    // Generate recommendations
    if (bottlenecks.some(b => b.includes('total_auth_session'))) {
      recommendations.push('Implement connection pooling to reduce auth latency')
    }
    if (bottlenecks.some(b => b.includes('getUserProfile'))) {
      recommendations.push('Increase profile cache duration or implement database indexing')
    }
    if (bottlenecks.some(b => b.includes('session_check'))) {
      recommendations.push('Optimize Supabase session validation with shorter timeouts')
    }

    // Calculate overall metrics
    const overallSuccessRate = totalAuthMetric?.successRate || 0
    const avgAuthTime = totalAuthMetric?.avgTime || 0

    return {
      overallSuccessRate,
      avgAuthTime,
      bottlenecks,
      recommendations,
      metrics: Object.fromEntries(this.metrics)
    }
  }

  // Get real-time performance dashboard data
  getDashboardData() {
    const report = this.generateReport()
    const recentMetrics = this.getRecentMetrics()

    return {
      status: this.getSystemStatus(),
      kpis: {
        authSuccessRate: `${(report.overallSuccessRate * 100).toFixed(1)}%`,
        avgAuthTime: `${report.avgAuthTime.toFixed(0)}ms`,
        activeBottlenecks: report.bottlenecks.length,
        totalRequests: Array.from(this.metrics.values()).reduce((sum, m) => sum + m.count, 0)
      },
      alerts: report.bottlenecks,
      trends: recentMetrics,
      recommendations: report.recommendations
    }
  }

  // Determine system health status
  private getSystemStatus(): 'healthy' | 'degraded' | 'critical' {
    const report = this.generateReport()

    if (report.avgAuthTime > 5000 || report.overallSuccessRate < 0.8) {
      return 'critical'
    }
    if (report.avgAuthTime > 2000 || report.overallSuccessRate < 0.95) {
      return 'degraded'
    }
    return 'healthy'
  }

  // Get recent performance trends
  private getRecentMetrics(): Record<string, { trend: 'improving' | 'degrading'; change: number; current: number }> {
    const trends: Record<string, { trend: 'improving' | 'degrading'; change: number; current: number }> = {}
    for (const [operation, metric] of this.metrics) {
      if (metric.samples.length >= 10) {
        const recent10 = metric.samples.slice(-10)
        const older10 = metric.samples.slice(-20, -10)

        const recentAvg = recent10.reduce((sum, val) => sum + val, 0) / recent10.length
        const olderAvg = older10.length > 0
          ? older10.reduce((sum, val) => sum + val, 0) / older10.length
          : recentAvg

        trends[operation] = {
          trend: recentAvg > olderAvg ? 'degrading' : 'improving',
          change: Math.abs(recentAvg - olderAvg),
          current: recentAvg
        }
      }
    }
    return trends
  }

  // Reset all metrics (useful for testing)
  reset(): void {
    this.metrics.clear()
    this.sessionStarts.clear()
    console.log('📊 Performance metrics reset')
  }

  // Export metrics for external monitoring
  exportMetrics(): string {
    const report = this.generateReport()
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      ...report
    }, null, 2)
  }
}

// Singleton performance monitor
let monitor: AuthPerformanceMonitor | null = null

export function getPerformanceMonitor(): AuthPerformanceMonitor {
  if (!monitor) {
    monitor = new AuthPerformanceMonitor()
    console.log('📊 Auth performance monitor initialized')
  }
  return monitor
}

// Convenient wrapper functions
export function recordAuthMetric(operation: string, timeMs: number, success: boolean = true) {
  getPerformanceMonitor().recordMetric(operation, timeMs, success)
}

export function startAuthSession(sessionId?: string) {
  getPerformanceMonitor().startSession(sessionId)
}

export function finishAuthSession(sessionId?: string, success: boolean = true) {
  return getPerformanceMonitor().finishSession(sessionId, success)
}

// Auto-report performance every 5 minutes in development
if (process.env.NODE_ENV === 'development') {
  setInterval(() => {
    const monitor = getPerformanceMonitor()
    const report = monitor.generateReport()

    if (report.bottlenecks.length > 0) {
      console.log('📊 PERFORMANCE REPORT:', {
        avgAuthTime: `${report.avgAuthTime.toFixed(0)}ms`,
        successRate: `${(report.overallSuccessRate * 100).toFixed(1)}%`,
        bottlenecks: report.bottlenecks,
        recommendations: report.recommendations
      })
    }
  }, 5 * 60 * 1000)
}