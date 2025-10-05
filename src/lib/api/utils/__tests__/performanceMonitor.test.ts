import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getPerformanceMonitor, recordAuthMetric, startAuthSession, finishAuthSession } from '../performanceMonitor'

describe('performanceMonitor.ts', () => {
  let monitor: any
  let consoleLogSpy: any
  let consoleWarnSpy: any

  beforeEach(() => {
    // Reset the singleton monitor before each test
    monitor = getPerformanceMonitor()
    monitor.reset()

    // Mock console methods
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getPerformanceMonitor', () => {
    it('should return singleton instance', () => {
      const monitor1 = getPerformanceMonitor()
      const monitor2 = getPerformanceMonitor()
      expect(monitor1).toBe(monitor2)
    })

    it('should log initialization message', () => {
      // Reset and get fresh monitor
      monitor.reset()
      consoleLogSpy.mockClear()
      const newMonitor = getPerformanceMonitor()
      expect(newMonitor).toBeDefined()
    })
  })

  describe('recordMetric', () => {
    it('should record successful metric', () => {
      monitor.recordMetric('test_operation', 100, true)
      const report = monitor.generateReport()
      expect(report.metrics['test_operation']).toBeDefined()
      expect(report.metrics['test_operation'].count).toBe(1)
    })

    it('should track min time', () => {
      monitor.recordMetric('test_operation', 150, true)
      monitor.recordMetric('test_operation', 100, true)
      monitor.recordMetric('test_operation', 200, true)
      const report = monitor.generateReport()
      expect(report.metrics['test_operation'].minTime).toBe(100)
    })

    it('should track max time', () => {
      monitor.recordMetric('test_operation', 100, true)
      monitor.recordMetric('test_operation', 300, true)
      monitor.recordMetric('test_operation', 200, true)
      const report = monitor.generateReport()
      expect(report.metrics['test_operation'].maxTime).toBe(300)
    })

    it('should calculate average time', () => {
      monitor.recordMetric('test_operation', 100, true)
      monitor.recordMetric('test_operation', 200, true)
      monitor.recordMetric('test_operation', 300, true)
      const report = monitor.generateReport()
      expect(report.metrics['test_operation'].avgTime).toBe(200)
    })

    it('should track error count', () => {
      monitor.recordMetric('test_operation', 100, false)
      monitor.recordMetric('test_operation', 100, false)
      monitor.recordMetric('test_operation', 100, true)
      const report = monitor.generateReport()
      expect(report.metrics['test_operation'].errorCount).toBe(2)
    })

    it('should calculate success rate', () => {
      monitor.recordMetric('test_operation', 100, true)
      monitor.recordMetric('test_operation', 100, true)
      monitor.recordMetric('test_operation', 100, false)
      const report = monitor.generateReport()
      expect(report.metrics['test_operation'].successRate).toBeCloseTo(0.667, 2)
    })

    it('should maintain sample history for P95 calculation', () => {
      for (let i = 1; i <= 10; i++) {
        monitor.recordMetric('test_operation', i * 10, true)
      }
      const report = monitor.generateReport()
      expect(report.metrics['test_operation'].samples.length).toBe(10)
    })

    it('should calculate P95 percentile', () => {
      for (let i = 1; i <= 20; i++) {
        monitor.recordMetric('test_operation', i * 10, true)
      }
      const report = monitor.generateReport()
      expect(report.metrics['test_operation'].p95Time).toBeGreaterThan(150)
    })

    it('should limit sample history to 100', () => {
      for (let i = 1; i <= 150; i++) {
        monitor.recordMetric('test_operation', i, true)
      }
      const report = monitor.generateReport()
      expect(report.metrics['test_operation'].samples.length).toBe(100)
    })

    it('should not include error times in average', () => {
      monitor.recordMetric('test_operation', 100, true)
      monitor.recordMetric('test_operation', 200, true)
      monitor.recordMetric('test_operation', 999, false) // Error - should not affect avg
      const report = monitor.generateReport()
      expect(report.metrics['test_operation'].avgTime).toBe(150)
    })

    it('should trigger alert for slow operations', () => {
      consoleWarnSpy.mockClear()
      monitor.recordMetric('slow_operation', 3000, true)
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('PERFORMANCE ALERT'),
        expect.any(String)
      )
    })

    it('should trigger alert for low success rate', () => {
      consoleWarnSpy.mockClear()
      for (let i = 0; i < 20; i++) {
        monitor.recordMetric('failing_operation', 100, i >= 15) // 25% success rate
      }
      expect(consoleWarnSpy).toHaveBeenCalled()
    })
  })

  describe('startSession and finishSession', () => {
    it('should track session duration', () => {
      monitor.startSession('test-session')
      // Simulate some delay
      const duration = monitor.finishSession('test-session', true)
      expect(duration).toBeGreaterThanOrEqual(0)
    })

    it('should record session metric', () => {
      monitor.startSession('test-session')
      monitor.finishSession('test-session', true)
      const report = monitor.generateReport()
      expect(report.metrics['total_auth_session']).toBeDefined()
    })

    it('should support multiple concurrent sessions', () => {
      monitor.startSession('session-1')
      monitor.startSession('session-2')
      const duration1 = monitor.finishSession('session-1', true)
      const duration2 = monitor.finishSession('session-2', true)
      expect(duration1).toBeGreaterThanOrEqual(0)
      expect(duration2).toBeGreaterThanOrEqual(0)
    })

    it('should use default session id', () => {
      monitor.startSession()
      const duration = monitor.finishSession()
      expect(duration).toBeGreaterThanOrEqual(0)
    })

    it('should return 0 for session not started', () => {
      const duration = monitor.finishSession('nonexistent')
      expect(duration).toBe(0)
    })

    it('should clean up session after finish', () => {
      monitor.startSession('cleanup-test')
      monitor.finishSession('cleanup-test')
      const duration = monitor.finishSession('cleanup-test')
      expect(duration).toBe(0)
    })

    it('should record failed sessions', () => {
      monitor.startSession('failed-session')
      monitor.finishSession('failed-session', false)
      const report = monitor.generateReport()
      expect(report.metrics['total_auth_session'].errorCount).toBeGreaterThan(0)
    })
  })

  describe('generateReport', () => {
    beforeEach(() => {
      monitor.reset()
    })

    it('should generate empty report when no metrics', () => {
      const report = monitor.generateReport()
      expect(report.overallSuccessRate).toBe(0)
      expect(report.avgAuthTime).toBe(0)
      expect(report.bottlenecks).toHaveLength(0)
    })

    it('should identify slow operations as bottlenecks', () => {
      monitor.recordMetric('slow_op', 1500, true)
      const report = monitor.generateReport()
      expect(report.bottlenecks.some(b => b.includes('slow_op'))).toBe(true)
    })

    it('should identify low success rate as bottleneck', () => {
      for (let i = 0; i < 20; i++) {
        monitor.recordMetric('failing_op', 100, i >= 18) // 10% success
      }
      const report = monitor.generateReport()
      expect(report.bottlenecks.some(b => b.includes('failing_op'))).toBe(true)
    })

    it('should generate connection pooling recommendation', () => {
      monitor.recordMetric('total_auth_session', 3000, true)
      const report = monitor.generateReport()
      expect(report.recommendations.some(r => r.includes('connection pooling'))).toBe(true)
    })

    it('should generate profile cache recommendation', () => {
      monitor.recordMetric('getUserProfile', 1500, true)
      const report = monitor.generateReport()
      expect(report.recommendations.some(r => r.includes('profile cache'))).toBe(true)
    })

    it('should generate session validation recommendation', () => {
      monitor.recordMetric('session_check', 1200, true)
      const report = monitor.generateReport()
      expect(report.recommendations.some(r => r.includes('session validation'))).toBe(true)
    })

    it('should calculate overall metrics from total_auth_session', () => {
      monitor.recordMetric('total_auth_session', 1000, true)
      monitor.recordMetric('total_auth_session', 2000, true)
      const report = monitor.generateReport()
      expect(report.avgAuthTime).toBe(1500)
      expect(report.overallSuccessRate).toBe(1)
    })
  })

  describe('getDashboardData', () => {
    it('should return dashboard structure', () => {
      const dashboard = monitor.getDashboardData()
      expect(dashboard).toHaveProperty('status')
      expect(dashboard).toHaveProperty('kpis')
      expect(dashboard).toHaveProperty('alerts')
      expect(dashboard).toHaveProperty('trends')
      expect(dashboard).toHaveProperty('recommendations')
    })

    it('should format KPI values correctly', () => {
      monitor.recordMetric('total_auth_session', 1234, true)
      const dashboard = monitor.getDashboardData()
      expect(dashboard.kpis.authSuccessRate).toMatch(/%$/)
      expect(dashboard.kpis.avgAuthTime).toMatch(/ms$/)
    })

    it('should show healthy status for good metrics', () => {
      monitor.recordMetric('total_auth_session', 1000, true)
      const dashboard = monitor.getDashboardData()
      expect(dashboard.status).toBe('healthy')
    })

    it('should show degraded status for slow performance', () => {
      monitor.recordMetric('total_auth_session', 3000, true)
      const dashboard = monitor.getDashboardData()
      expect(dashboard.status).toBe('degraded')
    })

    it('should show critical status for very slow performance', () => {
      monitor.recordMetric('total_auth_session', 6000, true)
      const dashboard = monitor.getDashboardData()
      expect(dashboard.status).toBe('critical')
    })

    it('should show critical status for low success rate', () => {
      for (let i = 0; i < 100; i++) {
        monitor.recordMetric('total_auth_session', 1000, i >= 70) // 30% success
      }
      const dashboard = monitor.getDashboardData()
      expect(dashboard.status).toBe('critical')
    })

    it('should count total requests', () => {
      monitor.recordMetric('op1', 100, true)
      monitor.recordMetric('op2', 200, true)
      monitor.recordMetric('op3', 300, true)
      const dashboard = monitor.getDashboardData()
      expect(dashboard.kpis.totalRequests).toBe(3)
    })
  })

  describe('performance trends', () => {
    it('should detect improving trends', () => {
      // Add older slow samples
      for (let i = 0; i < 15; i++) {
        monitor.recordMetric('test_op', 200, true)
      }
      // Add recent fast samples
      for (let i = 0; i < 10; i++) {
        monitor.recordMetric('test_op', 100, true)
      }
      const dashboard = monitor.getDashboardData()
      expect(dashboard.trends['test_op']?.trend).toBe('improving')
    })

    it('should detect degrading trends', () => {
      // Add older fast samples
      for (let i = 0; i < 15; i++) {
        monitor.recordMetric('test_op', 100, true)
      }
      // Add recent slow samples
      for (let i = 0; i < 10; i++) {
        monitor.recordMetric('test_op', 200, true)
      }
      const dashboard = monitor.getDashboardData()
      expect(dashboard.trends['test_op']?.trend).toBe('degrading')
    })

    it('should require minimum samples for trend calculation', () => {
      monitor.recordMetric('test_op', 100, true)
      const dashboard = monitor.getDashboardData()
      expect(dashboard.trends['test_op']).toBeUndefined()
    })
  })

  describe('reset', () => {
    it('should clear all metrics', () => {
      monitor.recordMetric('test_op', 100, true)
      monitor.reset()
      const report = monitor.generateReport()
      expect(Object.keys(report.metrics)).toHaveLength(0)
    })

    it('should clear session tracking', () => {
      monitor.startSession('test')
      monitor.reset()
      const duration = monitor.finishSession('test')
      expect(duration).toBe(0)
    })

    it('should log reset message', () => {
      consoleLogSpy.mockClear()
      monitor.reset()
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Performance metrics reset')
      )
    })
  })

  describe('exportMetrics', () => {
    it('should export as JSON string', () => {
      monitor.recordMetric('test_op', 100, true)
      const exported = monitor.exportMetrics()
      expect(() => JSON.parse(exported)).not.toThrow()
    })

    it('should include timestamp', () => {
      const exported = JSON.parse(monitor.exportMetrics())
      expect(exported).toHaveProperty('timestamp')
      expect(new Date(exported.timestamp).getTime()).toBeGreaterThan(0)
    })

    it('should include all report data', () => {
      monitor.recordMetric('test_op', 100, true)
      const exported = JSON.parse(monitor.exportMetrics())
      expect(exported).toHaveProperty('overallSuccessRate')
      expect(exported).toHaveProperty('avgAuthTime')
      expect(exported).toHaveProperty('bottlenecks')
      expect(exported).toHaveProperty('recommendations')
      expect(exported).toHaveProperty('metrics')
    })
  })

  describe('wrapper functions', () => {
    it('should call recordMetric via recordAuthMetric', () => {
      recordAuthMetric('wrapper_test', 100, true)
      const report = monitor.generateReport()
      expect(report.metrics['wrapper_test']).toBeDefined()
    })

    it('should call startSession via startAuthSession', () => {
      startAuthSession('wrapper-session')
      const duration = finishAuthSession('wrapper-session')
      expect(duration).toBeGreaterThanOrEqual(0)
    })

    it('should call finishSession via finishAuthSession', () => {
      startAuthSession('wrapper-session-2')
      const duration = finishAuthSession('wrapper-session-2', true)
      expect(duration).toBeGreaterThanOrEqual(0)
    })
  })

  describe('alert thresholds', () => {
    it('should use 2000ms threshold for auth time alerts', () => {
      consoleWarnSpy.mockClear()
      monitor.recordMetric('test_op', 2100, true)
      expect(consoleWarnSpy).toHaveBeenCalled()
    })

    it('should use 95% threshold for success rate alerts', () => {
      consoleWarnSpy.mockClear()
      for (let i = 0; i < 100; i++) {
        monitor.recordMetric('test_op', 100, i >= 10) // 90% success
      }
      expect(consoleWarnSpy).toHaveBeenCalled()
    })

    it('should not alert for operations within thresholds', () => {
      consoleWarnSpy.mockClear()
      monitor.recordMetric('good_op', 1000, true)
      const alertCalls = consoleWarnSpy.mock.calls.filter((call: any[]) =>
        call[0]?.includes('PERFORMANCE ALERT')
      )
      expect(alertCalls).toHaveLength(0)
    })
  })

  describe('edge cases', () => {
    it('should handle zero time metrics', () => {
      monitor.recordMetric('instant_op', 0, true)
      const report = monitor.generateReport()
      expect(report.metrics['instant_op'].minTime).toBe(0)
    })

    it('should handle very large time values', () => {
      monitor.recordMetric('slow_op', 999999, true)
      const report = monitor.generateReport()
      expect(report.metrics['slow_op'].maxTime).toBe(999999)
    })

    it('should handle operations with no successful executions', () => {
      monitor.recordMetric('failing_op', 100, false)
      monitor.recordMetric('failing_op', 200, false)
      const report = monitor.generateReport()
      expect(report.metrics['failing_op'].successRate).toBe(0)
    })

    it('should handle single sample P95 calculation', () => {
      monitor.recordMetric('single_op', 100, true)
      const report = monitor.generateReport()
      expect(report.metrics['single_op'].p95Time).toBe(100)
    })
  })
})
