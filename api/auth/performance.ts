// Auth Performance Dashboard API
// Real-time monitoring endpoint for authentication system health

import { VercelRequest, VercelResponse } from '@vercel/node'
import { getPerformanceMonitor } from '../utils/performanceMonitor'
import { getConnectionPool } from '../utils/connectionPool'
import { getQueryOptimizer } from '../utils/queryOptimizer'
import { createRequestLogger } from '../utils/logger'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const logger = createRequestLogger(req, 'auth/performance')

  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    // Check if this is an admin request (basic security)
    const authHeader = req.headers.authorization
    const isAuthorized = authHeader && (
      authHeader.includes('admin') ||
      req.headers['x-admin-key'] === process.env.ADMIN_MONITORING_KEY
    )

    if (!isAuthorized && process.env.NODE_ENV === 'production') {
      return res.status(401).json({ error: 'Unauthorized - admin access required' })
    }

    const monitor = getPerformanceMonitor()
    const pool = getConnectionPool()
    const optimizer = getQueryOptimizer()

    // Get comprehensive performance data
    const dashboardData = monitor.getDashboardData()
    const poolStats = pool.getStats()
    const cacheStats = optimizer.getCacheStats()
    const queryMetrics = optimizer.getMetrics()

    // Calculate health score
    const healthScore = calculateHealthScore(dashboardData, poolStats, cacheStats)

    const performanceReport = {
      timestamp: new Date().toISOString(),
      status: dashboardData.status,
      healthScore,

      // Core KPIs
      authentication: {
        successRate: dashboardData.kpis.authSuccessRate,
        avgResponseTime: dashboardData.kpis.avgAuthTime,
        totalRequests: dashboardData.kpis.totalRequests,
        activeBottlenecks: dashboardData.kpis.activeBottlenecks
      },

      // Connection Pool Health
      connectionPool: {
        totalConnections: poolStats.totalConnections,
        activeConnections: poolStats.inUseConnections,
        availableConnections: poolStats.availableConnections,
        queuedRequests: poolStats.queuedRequests,
        utilizationRate: `${((poolStats.inUseConnections / poolStats.totalConnections) * 100).toFixed(1)}%`
      },

      // Query Performance
      queryCache: {
        size: cacheStats.size,
        hitRate: `${(cacheStats.hitRate * 100).toFixed(1)}%`,
        memoryUsage: cacheStats.memoryUsage
      },

      // Performance Trends
      trends: dashboardData.trends,

      // Active Issues
      alerts: dashboardData.alerts,
      recommendations: dashboardData.recommendations,

      // Detailed Metrics (for debugging)
      detailedMetrics: process.env.NODE_ENV === 'development' ? {
        queryMetrics,
        rawDashboardData: dashboardData
      } : undefined
    }

    // Set appropriate cache headers
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
    res.setHeader('Content-Type', 'application/json')

    logger.info('Performance dashboard data retrieved', {
      statusCode: 200,
      healthScore,
      authSuccessRate: dashboardData.kpis.authSuccessRate,
      activeConnections: poolStats.inUseConnections,
      cacheHitRate: cacheStats.hitRate
    })

    res.status(200).json(performanceReport)

  } catch (error) {
    logger.error('Performance dashboard error', error, {
      statusCode: 500
    })
    res.status(500).json({
      error: 'Performance monitoring unavailable',
      timestamp: new Date().toISOString()
    })
  }
}

function calculateHealthScore(
  dashboardData: any,
  poolStats: any,
  cacheStats: any
): number {
  let score = 100

  // Auth performance (40% of score)
  const avgAuthTimeMs = parseFloat(dashboardData.kpis.avgAuthTime) || 0
  const successRate = parseFloat(dashboardData.kpis.authSuccessRate) / 100 || 0

  if (avgAuthTimeMs > 2000) score -= 20
  else if (avgAuthTimeMs > 1000) score -= 10
  else if (avgAuthTimeMs > 500) score -= 5

  if (successRate < 0.95) score -= 20
  else if (successRate < 0.98) score -= 10

  // Connection pool health (30% of score)
  const utilizationRate = poolStats.inUseConnections / poolStats.totalConnections
  if (utilizationRate > 0.9) score -= 15
  else if (utilizationRate > 0.7) score -= 5

  if (poolStats.queuedRequests > 10) score -= 10
  else if (poolStats.queuedRequests > 5) score -= 5

  // Cache performance (20% of score)
  if (cacheStats.hitRate < 0.7) score -= 10
  else if (cacheStats.hitRate < 0.8) score -= 5

  // Active issues (10% of score)
  score -= Math.min(dashboardData.alerts.length * 3, 10)

  return Math.max(0, Math.min(100, Math.round(score)))
}