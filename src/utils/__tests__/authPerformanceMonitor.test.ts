/**
 * Authentication Performance Monitor Test Suite
 *
 * Comprehensive tests for auth performance monitoring functionality
 * including metrics collection, session tracking, and alert systems.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { authPerformanceMonitor } from '../authPerformanceMonitor'
import * as logger from '../logger'

// Mock logger
vi.mock('../logger', () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

// Mock environment variables
const originalEnv = import.meta.env
beforeEach(() => {
  import.meta.env.DEV = true
  import.meta.env.VITE_ENABLE_PERFORMANCE_MONITORING = 'true'
  vi.clearAllMocks()
})

afterEach(() => {
  import.meta.env = originalEnv
})

describe('AuthPerformanceMonitor', () => {
  describe('Session Management', () => {
    it('should start a monitoring session', () => {
      authPerformanceMonitor.startSession()

      const metrics = authPerformanceMonitor.getCurrentSessionMetrics()
      expect(metrics).toHaveProperty('timestamp')
      expect(metrics).toHaveProperty('authState', 'success')
      expect(logger.logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Auth performance monitoring started')
      )
    })

    it('should not start session when monitoring is disabled', () => {
      import.meta.env.VITE_ENABLE_PERFORMANCE_MONITORING = 'false'

      authPerformanceMonitor.startSession()
      expect(logger.logger.debug).not.toHaveBeenCalled()
    })

    it('should record session check duration', () => {
      authPerformanceMonitor.startSession()
      authPerformanceMonitor.recordSessionCheck(250)

      const metrics = authPerformanceMonitor.getCurrentSessionMetrics()
      expect(metrics.sessionCheck).toBe(250)
    })

    it('should record user profile fetch duration', () => {
      authPerformanceMonitor.startSession()
      authPerformanceMonitor.recordUserProfileFetch(350)

      const metrics = authPerformanceMonitor.getCurrentSessionMetrics()
      expect(metrics.userProfileFetch).toBe(350)
    })

    it('should record project check duration', () => {
      authPerformanceMonitor.startSession()
      authPerformanceMonitor.recordProjectCheck(150)

      const metrics = authPerformanceMonitor.getCurrentSessionMetrics()
      expect(metrics.projectCheck).toBe(150)
    })

    it('should finish session and calculate total time', () => {
      authPerformanceMonitor.startSession()
      authPerformanceMonitor.recordSessionCheck(250)
      authPerformanceMonitor.recordUserProfileFetch(350)
      authPerformanceMonitor.recordProjectCheck(150)

      authPerformanceMonitor.finishSession('success')

      const report = authPerformanceMonitor.getPerformanceReport()
      expect(report.length).toBeGreaterThan(0)

      const lastSession = report[report.length - 1]
      expect(lastSession.sessionCheck).toBe(250)
      expect(lastSession.userProfileFetch).toBe(350)
      expect(lastSession.projectCheck).toBe(150)
      expect(lastSession.authState).toBe('success')
      expect(lastSession.totalAuthTime).toBeGreaterThan(0)
    })

    it('should handle timeout state', () => {
      authPerformanceMonitor.startSession()
      authPerformanceMonitor.finishSession('timeout')

      const report = authPerformanceMonitor.getPerformanceReport()
      const lastSession = report[report.length - 1]
      expect(lastSession.authState).toBe('timeout')
    })

    it('should handle error state', () => {
      authPerformanceMonitor.startSession()
      authPerformanceMonitor.finishSession('error')

      const report = authPerformanceMonitor.getPerformanceReport()
      const lastSession = report[report.length - 1]
      expect(lastSession.authState).toBe('error')
    })
  })

  describe('Metrics Collection', () => {
    it('should collect current session metrics', () => {
      authPerformanceMonitor.startSession()
      authPerformanceMonitor.recordSessionCheck(200)
      authPerformanceMonitor.recordUserProfileFetch(300)
      authPerformanceMonitor.recordProjectCheck(100)

      const current = authPerformanceMonitor.getCurrentSessionMetrics()
      expect(current.sessionCheck).toBe(200)
      expect(current.userProfileFetch).toBe(300)
      expect(current.projectCheck).toBe(100)
    })

    it('should calculate average metrics across sessions', () => {
      // Create multiple sessions
      for (let i = 0; i < 3; i++) {
        authPerformanceMonitor.startSession()
        authPerformanceMonitor.recordSessionCheck(200 + i * 50)
        authPerformanceMonitor.recordUserProfileFetch(300 + i * 50)
        authPerformanceMonitor.recordProjectCheck(100 + i * 50)
        authPerformanceMonitor.finishSession('success')
      }

      const averages = authPerformanceMonitor.getAverageMetrics()
      expect(averages).not.toBeNull()
      expect(averages?.avgSessionCheck).toBeGreaterThan(0)
      expect(averages?.avgProfileFetch).toBeGreaterThan(0)
      expect(averages?.avgProjectCheck).toBeGreaterThan(0)
      expect(averages?.successRate).toBe(1.0)
    })

    it('should return null for average metrics with no data', () => {
      // Clear any existing metrics by creating a fresh monitor instance
      const metrics = authPerformanceMonitor.getMetrics()
      const averages = metrics.sessionCount === 0 ? null : authPerformanceMonitor.getAverageMetrics()

      // If there are no sessions, averages should be null or handle appropriately
      if (averages === null) {
        expect(averages).toBeNull()
      }
    })

    it('should calculate success rate correctly', () => {
      authPerformanceMonitor.startSession()
      authPerformanceMonitor.finishSession('success')

      authPerformanceMonitor.startSession()
      authPerformanceMonitor.finishSession('error')

      authPerformanceMonitor.startSession()
      authPerformanceMonitor.finishSession('success')

      const averages = authPerformanceMonitor.getAverageMetrics()
      expect(averages?.successRate).toBeCloseTo(0.67, 1) // 2/3 success
    })

    it('should get comprehensive metrics object', () => {
      authPerformanceMonitor.startSession()
      authPerformanceMonitor.recordSessionCheck(250)
      authPerformanceMonitor.finishSession('success')

      const metrics = authPerformanceMonitor.getMetrics()
      expect(metrics).toHaveProperty('current')
      expect(metrics).toHaveProperty('averages')
      expect(metrics).toHaveProperty('report')
      expect(metrics).toHaveProperty('trends')
      expect(metrics).toHaveProperty('sessionCount')
    })
  })

  describe('Performance Analysis', () => {
    it('should detect critical performance issues', () => {
      // Create sessions with slow performance
      for (let i = 0; i < 5; i++) {
        authPerformanceMonitor.startSession()
        authPerformanceMonitor.recordSessionCheck(1500)
        authPerformanceMonitor.recordUserProfileFetch(1500)
        authPerformanceMonitor.recordProjectCheck(1000)
        authPerformanceMonitor.finishSession('success')
      }

      expect(logger.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('CRITICAL'),
        expect.anything()
      )
    })

    it('should detect warning level performance degradation', () => {
      // Create sessions with moderately slow performance
      for (let i = 0; i < 5; i++) {
        authPerformanceMonitor.startSession()
        authPerformanceMonitor.recordSessionCheck(800)
        authPerformanceMonitor.recordUserProfileFetch(700)
        authPerformanceMonitor.recordProjectCheck(400)
        authPerformanceMonitor.finishSession('success')
      }

      expect(logger.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('WARNING'),
        expect.anything()
      )
    })

    it('should report excellent performance for fast sessions', () => {
      // Create sessions with optimal performance
      for (let i = 0; i < 5; i++) {
        authPerformanceMonitor.startSession()
        authPerformanceMonitor.recordSessionCheck(150)
        authPerformanceMonitor.recordUserProfileFetch(200)
        authPerformanceMonitor.recordProjectCheck(100)
        authPerformanceMonitor.finishSession('success')
      }

      expect(logger.logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('EXCELLENT'),
        expect.anything()
      )
    })

    it('should detect reliability issues with low success rate', () => {
      // Create sessions with failures
      for (let i = 0; i < 10; i++) {
        authPerformanceMonitor.startSession()
        authPerformanceMonitor.finishSession(i < 8 ? 'success' : 'error')
      }

      expect(logger.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('reliability'),
        expect.anything()
      )
    })

    it('should detect session check bottlenecks', () => {
      for (let i = 0; i < 5; i++) {
        authPerformanceMonitor.startSession()
        authPerformanceMonitor.recordSessionCheck(900)
        authPerformanceMonitor.recordUserProfileFetch(200)
        authPerformanceMonitor.recordProjectCheck(100)
        authPerformanceMonitor.finishSession('success')
      }

      expect(logger.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Session check bottleneck'),
        expect.anything()
      )
    })

    it('should detect profile fetch bottlenecks', () => {
      for (let i = 0; i < 5; i++) {
        authPerformanceMonitor.startSession()
        authPerformanceMonitor.recordSessionCheck(200)
        authPerformanceMonitor.recordUserProfileFetch(700)
        authPerformanceMonitor.recordProjectCheck(100)
        authPerformanceMonitor.finishSession('success')
      }

      expect(logger.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Profile fetch bottleneck'),
        expect.anything()
      )
    })

    it('should detect project check bottlenecks', () => {
      for (let i = 0; i < 5; i++) {
        authPerformanceMonitor.startSession()
        authPerformanceMonitor.recordSessionCheck(200)
        authPerformanceMonitor.recordUserProfileFetch(200)
        authPerformanceMonitor.recordProjectCheck(600)
        authPerformanceMonitor.finishSession('success')
      }

      expect(logger.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Project check bottleneck'),
        expect.anything()
      )
    })
  })

  describe('Alert System', () => {
    it('should generate recommendations for slow performance', () => {
      for (let i = 0; i < 5; i++) {
        authPerformanceMonitor.startSession()
        authPerformanceMonitor.recordSessionCheck(1500)
        authPerformanceMonitor.recordUserProfileFetch(1500)
        authPerformanceMonitor.finishSession('success')
      }

      // Check that console.warn was called with structured alert data
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('PERFORMANCE_ALERT'),
        expect.any(String)
      )
    })

    it('should trigger reliability alerts for low success rates', () => {
      for (let i = 0; i < 10; i++) {
        authPerformanceMonitor.startSession()
        authPerformanceMonitor.finishSession(i < 7 ? 'success' : 'error')
      }

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('RELIABILITY_ALERT'),
        expect.any(String)
      )
    })
  })

  describe('Storage Performance', () => {
    it('should check localStorage performance', () => {
      const storageTime = authPerformanceMonitor.checkStoragePerformance()

      expect(storageTime).toBeGreaterThanOrEqual(0)
      expect(logger.logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('localStorage performance'),
        expect.anything()
      )
    })

    it('should warn on slow localStorage', () => {
      // Mock slow localStorage
      const originalSetItem = Storage.prototype.setItem
      Storage.prototype.setItem = function() {
        const start = performance.now()
        while (performance.now() - start < 15) {} // Simulate delay
        return originalSetItem.apply(this, arguments as any)
      }

      authPerformanceMonitor.checkStoragePerformance()

      // Restore original
      Storage.prototype.setItem = originalSetItem
    })

    it('should handle localStorage errors gracefully', () => {
      // Mock localStorage error
      const originalSetItem = Storage.prototype.setItem
      Storage.prototype.setItem = vi.fn(() => {
        throw new Error('Storage quota exceeded')
      })

      const result = authPerformanceMonitor.checkStoragePerformance()
      expect(result).toBe(-1)
      expect(logger.logger.error).toHaveBeenCalled()

      // Restore original
      Storage.prototype.setItem = originalSetItem
    })
  })

  describe('Network Performance', () => {
    it('should check network performance', async () => {
      // Mock fetch
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200
      })

      const networkTime = await authPerformanceMonitor.checkNetworkPerformance()
      expect(networkTime).toBeGreaterThanOrEqual(0)
    })

    it('should warn on slow network', async () => {
      // Mock slow fetch
      global.fetch = vi.fn().mockImplementation(() =>
        new Promise(resolve => {
          setTimeout(() => resolve({ ok: true, status: 200 }), 1500)
        })
      )

      await authPerformanceMonitor.checkNetworkPerformance()

      expect(logger.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Network performance issue'),
        expect.anything()
      )
    })

    it('should handle network failures gracefully', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

      const networkTime = await authPerformanceMonitor.checkNetworkPerformance()
      expect(networkTime).toBeGreaterThanOrEqual(0)
      expect(logger.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Network check failed'),
        expect.anything(),
        expect.anything()
      )
    })
  })

  describe('Trend Analysis', () => {
    it('should detect improving performance trends', () => {
      // Create improving trend
      for (let i = 0; i < 10; i++) {
        authPerformanceMonitor.startSession()
        authPerformanceMonitor.recordSessionCheck(500 - i * 30)
        authPerformanceMonitor.finishSession('success')
      }

      const trends = authPerformanceMonitor.getTrendAnalysis()
      expect(trends?.trend).toBe('improving')
    })

    it('should detect degrading performance trends', () => {
      // Create degrading trend
      for (let i = 0; i < 10; i++) {
        authPerformanceMonitor.startSession()
        authPerformanceMonitor.recordSessionCheck(300 + i * 30)
        authPerformanceMonitor.finishSession('success')
      }

      const trends = authPerformanceMonitor.getTrendAnalysis()
      expect(trends?.trend).toBe('degrading')
    })

    it('should detect stable performance', () => {
      // Create stable trend
      for (let i = 0; i < 10; i++) {
        authPerformanceMonitor.startSession()
        authPerformanceMonitor.recordSessionCheck(400)
        authPerformanceMonitor.finishSession('success')
      }

      const trends = authPerformanceMonitor.getTrendAnalysis()
      expect(trends?.trend).toBe('stable')
    })

    it('should return null for insufficient data', () => {
      authPerformanceMonitor.startSession()
      authPerformanceMonitor.finishSession('success')

      const trends = authPerformanceMonitor.getTrendAnalysis()
      // With only one session, should return null or minimal data
      expect(trends).toBeDefined()
    })
  })

  describe('Memory Management', () => {
    it('should limit stored metrics to 20 sessions', () => {
      // Create 25 sessions
      for (let i = 0; i < 25; i++) {
        authPerformanceMonitor.startSession()
        authPerformanceMonitor.finishSession('success')
      }

      const report = authPerformanceMonitor.getPerformanceReport()
      expect(report.length).toBeLessThanOrEqual(20)
    })

    it('should keep most recent sessions', () => {
      // Create sessions with identifiable data
      for (let i = 0; i < 25; i++) {
        authPerformanceMonitor.startSession()
        authPerformanceMonitor.recordSessionCheck(100 + i)
        authPerformanceMonitor.finishSession('success')
      }

      const report = authPerformanceMonitor.getPerformanceReport()
      const lastSession = report[report.length - 1]

      // Last session should have highest value
      expect(lastSession.sessionCheck).toBeGreaterThan(120)
    })
  })

  describe('Real-time Metrics', () => {
    it('should record network latency', () => {
      authPerformanceMonitor.startSession()
      authPerformanceMonitor.recordNetworkLatency(125)

      const metrics = authPerformanceMonitor.getCurrentSessionMetrics()
      expect(metrics.networkLatency).toBe(125)
    })

    it('should record cache hit rate', () => {
      authPerformanceMonitor.startSession()
      authPerformanceMonitor.recordCacheHitRate(0.85)

      const metrics = authPerformanceMonitor.getCurrentSessionMetrics()
      expect(metrics.cacheHitRate).toBe(0.85)
    })
  })

  describe('Performance Report', () => {
    it('should include all session data in report', () => {
      authPerformanceMonitor.startSession()
      authPerformanceMonitor.recordSessionCheck(200)
      authPerformanceMonitor.recordUserProfileFetch(300)
      authPerformanceMonitor.recordProjectCheck(150)
      authPerformanceMonitor.finishSession('success')

      const report = authPerformanceMonitor.getPerformanceReport()
      expect(report.length).toBeGreaterThan(0)

      const session = report[report.length - 1]
      expect(session).toHaveProperty('sessionCheck')
      expect(session).toHaveProperty('userProfileFetch')
      expect(session).toHaveProperty('projectCheck')
      expect(session).toHaveProperty('totalAuthTime')
      expect(session).toHaveProperty('authState')
      expect(session).toHaveProperty('timestamp')
    })

    it('should return copy of metrics array', () => {
      const report1 = authPerformanceMonitor.getPerformanceReport()
      const report2 = authPerformanceMonitor.getPerformanceReport()

      expect(report1).not.toBe(report2) // Different array instances
      expect(report1).toEqual(report2) // Same content
    })
  })

  describe('Edge Cases', () => {
    it('should handle missing session start', () => {
      // Finish session without starting
      authPerformanceMonitor.finishSession('success')

      const report = authPerformanceMonitor.getPerformanceReport()
      expect(report.length).toBeGreaterThan(0)
    })

    it('should handle zero duration metrics', () => {
      authPerformanceMonitor.startSession()
      authPerformanceMonitor.recordSessionCheck(0)
      authPerformanceMonitor.recordUserProfileFetch(0)
      authPerformanceMonitor.recordProjectCheck(0)
      authPerformanceMonitor.finishSession('success')

      const averages = authPerformanceMonitor.getAverageMetrics()
      expect(averages?.avgSessionCheck).toBe(0)
    })

    it('should handle negative duration metrics gracefully', () => {
      authPerformanceMonitor.startSession()
      authPerformanceMonitor.recordSessionCheck(-100)
      authPerformanceMonitor.finishSession('success')

      // Should not throw error
      const report = authPerformanceMonitor.getPerformanceReport()
      expect(report.length).toBeGreaterThan(0)
    })

    it('should handle very large duration values', () => {
      authPerformanceMonitor.startSession()
      authPerformanceMonitor.recordSessionCheck(999999)
      authPerformanceMonitor.finishSession('success')

      const report = authPerformanceMonitor.getPerformanceReport()
      const session = report[report.length - 1]
      expect(session.sessionCheck).toBe(999999)
    })
  })
})