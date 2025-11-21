/**
 * Network Performance Monitor Test Suite
 *
 * Comprehensive tests for network performance monitoring functionality
 * including request tracking, connection quality assessment, and latency testing.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { networkPerformanceMonitor } from '../networkPerformanceMonitor'
import * as logger from '../logger'

// Mock logger
vi.mock('../logger', () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

// Store original fetch
const originalFetch = global.fetch

beforeEach(() => {
  vi.clearAllMocks()

  // Mock fetch by default
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    headers: new Headers({
      'content-length': '1024'
    }),
    blob: vi.fn().mockResolvedValue(new Blob(['test data']))
  })
})

afterEach(() => {
  global.fetch = originalFetch
  networkPerformanceMonitor.clearHistory()
})

describe('NetworkPerformanceMonitor', () => {
  describe('Request Tracking', () => {
    it('should intercept and track fetch requests', async () => {
      await fetch('/api/test')

      const metrics = networkPerformanceMonitor.getNetworkMetrics()
      expect(metrics.totalRequests).toBeGreaterThan(0)
    })

    it('should categorize auth requests correctly', async () => {
      await fetch('/api/auth/login')

      const metrics = networkPerformanceMonitor.getNetworkMetrics()
      expect(metrics.authRequests).toBeGreaterThan(0)
    })

    it('should categorize API requests correctly', async () => {
      await fetch('/api/users')

      const metrics = networkPerformanceMonitor.getNetworkMetrics()
      expect(metrics.apiRequests).toBeGreaterThan(0)
    })

    it('should track request duration', async () => {
      await fetch('/api/test')

      const recent = networkPerformanceMonitor.getRecentRequests(1)
      expect(recent[0].duration).toBeGreaterThanOrEqual(0)
    })

    it('should track request status codes', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        headers: new Headers()
      })

      await fetch('/api/notfound')

      const recent = networkPerformanceMonitor.getRecentRequests(1)
      expect(recent[0].status).toBe(404)
    })

    it('should track request sizes', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({
          'content-length': '2048'
        })
      })

      await fetch('/api/data')

      const recent = networkPerformanceMonitor.getRecentRequests(1)
      expect(recent[0].size).toBe(2048)
    })

    it('should handle requests without content-length', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers()
      })

      await fetch('/api/test')

      const recent = networkPerformanceMonitor.getRecentRequests(1)
      expect(recent[0].size).toBe(0)
    })

    it('should track failed requests', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

      try {
        await fetch('/api/fail')
      } catch (_error) {
        // Expected error
      }

      const metrics = networkPerformanceMonitor.getNetworkMetrics()
      expect(metrics.failedRequests).toBeGreaterThan(0)
    })

    it('should track request method', async () => {
      await fetch('/api/data', { method: 'POST' })

      const recent = networkPerformanceMonitor.getRecentRequests(1)
      expect(recent[0].method).toBe('POST')
    })

    it('should default to GET method when not specified', async () => {
      await fetch('/api/data')

      const recent = networkPerformanceMonitor.getRecentRequests(1)
      expect(recent[0].method).toBe('GET')
    })
  })

  describe('Network Metrics', () => {
    it('should calculate average latency', async () => {
      await fetch('/api/test1')
      await fetch('/api/test2')
      await fetch('/api/test3')

      const metrics = networkPerformanceMonitor.getNetworkMetrics()
      expect(metrics.averageLatency).toBeGreaterThanOrEqual(0)
    })

    it('should count total requests', async () => {
      const requestCount = 5

      for (let i = 0; i < requestCount; i++) {
        await fetch(`/api/test${i}`)
      }

      const metrics = networkPerformanceMonitor.getNetworkMetrics()
      expect(metrics.totalRequests).toBeGreaterThanOrEqual(requestCount)
    })

    it('should count auth requests separately', async () => {
      await fetch('/api/auth/login')
      await fetch('/api/auth/session')
      await fetch('/api/users')

      const metrics = networkPerformanceMonitor.getNetworkMetrics()
      expect(metrics.authRequests).toBeGreaterThanOrEqual(2)
    })

    it('should count API requests separately', async () => {
      await fetch('/api/users')
      await fetch('/api/projects')
      await fetch('/auth/login')

      const metrics = networkPerformanceMonitor.getNetworkMetrics()
      expect(metrics.apiRequests).toBeGreaterThanOrEqual(2)
    })

    it('should count failed requests', async () => {
      global.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, status: 200, headers: new Headers() })
        .mockResolvedValueOnce({ ok: false, status: 500, headers: new Headers() })
        .mockResolvedValueOnce({ ok: false, status: 404, headers: new Headers() })

      await fetch('/api/success')
      await fetch('/api/error1')
      await fetch('/api/error2')

      const metrics = networkPerformanceMonitor.getNetworkMetrics()
      expect(metrics.failedRequests).toBeGreaterThanOrEqual(2)
    })

    it('should count slow requests', async () => {
      // Mock slow request
      global.fetch = vi.fn().mockImplementation(() =>
        new Promise(resolve => {
          setTimeout(() => resolve({
            ok: true,
            status: 200,
            headers: new Headers()
          }), 1100)
        })
      )

      await fetch('/api/slow')

      const metrics = networkPerformanceMonitor.getNetworkMetrics()
      expect(metrics.slowRequests).toBeGreaterThan(0)
    })

    it('should handle empty request history', () => {
      networkPerformanceMonitor.clearHistory()

      const metrics = networkPerformanceMonitor.getNetworkMetrics()

      expect(metrics.totalRequests).toBe(0)
      expect(metrics.averageLatency).toBe(0)
    })
  })

  describe('Connection Quality Assessment', () => {
    it('should assess connection quality', async () => {
      await fetch('/api/test')

      const quality = networkPerformanceMonitor.assessConnectionQuality()

      expect(quality).toHaveProperty('score')
      expect(quality).toHaveProperty('status')
      expect(quality).toHaveProperty('recommendations')
      expect(quality.score).toBeGreaterThanOrEqual(0)
      expect(quality.score).toBeLessThanOrEqual(100)
    })

    it('should return excellent status for fast connections', async () => {
      // Mock fast requests
      for (let i = 0; i < 5; i++) {
        await fetch(`/api/fast${i}`)
      }

      const quality = networkPerformanceMonitor.assessConnectionQuality()
      expect(['excellent', 'good']).toContain(quality.status)
    })

    it('should detect poor connection quality', async () => {
      // Mock slow requests
      global.fetch = vi.fn().mockImplementation(() =>
        new Promise(resolve => {
          setTimeout(() => resolve({
            ok: true,
            status: 200,
            headers: new Headers()
          }), 2500)
        })
      )

      for (let i = 0; i < 5; i++) {
        await fetch(`/api/slow${i}`)
      }

      const quality = networkPerformanceMonitor.assessConnectionQuality()
      expect(quality.score).toBeLessThan(90)
    })

    it('should detect high failure rate', async () => {
      global.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: false, status: 500, headers: new Headers() })
        .mockResolvedValueOnce({ ok: false, status: 503, headers: new Headers() })
        .mockResolvedValueOnce({ ok: false, status: 404, headers: new Headers() })
        .mockResolvedValueOnce({ ok: true, status: 200, headers: new Headers() })

      for (let i = 0; i < 4; i++) {
        await fetch(`/api/test${i}`)
      }

      const quality = networkPerformanceMonitor.assessConnectionQuality()
      expect(quality.recommendations.length).toBeGreaterThan(0)
    })

    it('should provide recommendations for slow connections', async () => {
      // Mock very slow requests
      global.fetch = vi.fn().mockImplementation(() =>
        new Promise(resolve => {
          setTimeout(() => resolve({
            ok: true,
            status: 200,
            headers: new Headers()
          }), 3000)
        })
      )

      await fetch('/api/veryslow')

      const quality = networkPerformanceMonitor.assessConnectionQuality()
      expect(quality.recommendations.length).toBeGreaterThan(0)
    })

    it('should handle no request history gracefully', () => {
      networkPerformanceMonitor.clearHistory()

      const quality = networkPerformanceMonitor.assessConnectionQuality()

      expect(quality).toBeDefined()
      expect(quality.score).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Auth Request Metrics', () => {
    it('should track auth-specific metrics', async () => {
      await fetch('/api/auth/login')
      await fetch('/api/auth/session')
      await fetch('/api/auth/user')

      const authMetrics = networkPerformanceMonitor.getAuthRequestMetrics()

      expect(authMetrics).not.toBeNull()
      expect(authMetrics?.totalRequests).toBeGreaterThanOrEqual(3)
    })

    it('should calculate average auth request time', async () => {
      await fetch('/api/auth/login')
      await fetch('/api/auth/session')

      const authMetrics = networkPerformanceMonitor.getAuthRequestMetrics()

      expect(authMetrics?.averageTime).toBeGreaterThanOrEqual(0)
    })

    it('should calculate auth success rate', async () => {
      global.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, status: 200, headers: new Headers() })
        .mockResolvedValueOnce({ ok: true, status: 200, headers: new Headers() })
        .mockResolvedValueOnce({ ok: false, status: 401, headers: new Headers() })

      await fetch('/api/auth/success1')
      await fetch('/api/auth/success2')
      await fetch('/api/auth/fail')

      const authMetrics = networkPerformanceMonitor.getAuthRequestMetrics()

      expect(authMetrics?.successRate).toBeCloseTo(0.67, 1)
    })

    it('should track fastest and slowest auth requests', async () => {
      await fetch('/api/auth/test1')
      await fetch('/api/auth/test2')
      await fetch('/api/auth/test3')

      const authMetrics = networkPerformanceMonitor.getAuthRequestMetrics()

      expect(authMetrics?.fastestRequest).toBeGreaterThanOrEqual(0)
      expect(authMetrics?.slowestRequest).toBeGreaterThanOrEqual(authMetrics?.fastestRequest || 0)
    })

    it('should return null when no auth requests', () => {
      networkPerformanceMonitor.clearHistory()
      await fetch('/api/users')

      const authMetrics = networkPerformanceMonitor.getAuthRequestMetrics()

      expect(authMetrics).toBeNull()
    })

    it('should include recent auth requests', async () => {
      for (let i = 0; i < 10; i++) {
        await fetch(`/api/auth/test${i}`)
      }

      const authMetrics = networkPerformanceMonitor.getAuthRequestMetrics()

      expect(authMetrics?.recentRequests).toBeDefined()
      expect(authMetrics?.recentRequests.length).toBeLessThanOrEqual(5)
    })
  })

  describe('Latency Testing', () => {
    it('should test latency to endpoint', async () => {
      const latency = await networkPerformanceMonitor.testLatency('/api/health')

      expect(latency).toBeGreaterThanOrEqual(0)
    })

    it('should handle failed latency test', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Connection failed'))

      const latency = await networkPerformanceMonitor.testLatency('/api/health')

      expect(latency).toBe(-1)
      expect(logger.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Latency test failed'),
        expect.anything()
      )
    })

    it('should use HEAD method for latency test', async () => {
      await networkPerformanceMonitor.testLatency('/api/health')

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/health',
        expect.objectContaining({ method: 'HEAD' })
      )
    })

    it('should disable cache for latency test', async () => {
      await networkPerformanceMonitor.testLatency('/api/health')

      expect(global.fetch).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ cache: 'no-cache' })
      )
    })
  })

  describe('Network Quality Test', () => {
    it('should run comprehensive network quality test', async () => {
      const result = await networkPerformanceMonitor.runNetworkQualityTest()

      expect(result).toHaveProperty('latency')
      expect(result).toHaveProperty('downloadSpeed')
      expect(result).toHaveProperty('quality')
    })

    it('should measure latency in quality test', async () => {
      const result = await networkPerformanceMonitor.runNetworkQualityTest()

      expect(result.latency).toBeGreaterThanOrEqual(0)
    })

    it('should measure download speed', async () => {
      const result = await networkPerformanceMonitor.runNetworkQualityTest()

      expect(result.downloadSpeed).toBeGreaterThanOrEqual(0)
    })

    it('should assess overall quality', async () => {
      const result = await networkPerformanceMonitor.runNetworkQualityTest()

      expect(result.quality).toHaveProperty('score')
      expect(result.quality).toHaveProperty('status')
      expect(result.quality).toHaveProperty('recommendations')
    })

    it('should handle failed download speed test', async () => {
      global.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, status: 200, headers: new Headers() }) // Health check
        .mockRejectedValueOnce(new Error('Download failed')) // Favicon download

      const result = await networkPerformanceMonitor.runNetworkQualityTest()

      expect(result.downloadSpeed).toBe(0)
      expect(logger.logger.warn).toHaveBeenCalled()
    })
  })

  describe('Monitoring Control', () => {
    it('should start monitoring', () => {
      networkPerformanceMonitor.startMonitoring()

      expect(logger.logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Network performance monitoring started')
      )
    })

    it('should stop monitoring', () => {
      networkPerformanceMonitor.startMonitoring()
      networkPerformanceMonitor.stopMonitoring()

      expect(logger.logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Network performance monitoring stopped')
      )
    })

    it('should allow restart after stop', () => {
      networkPerformanceMonitor.startMonitoring()
      networkPerformanceMonitor.stopMonitoring()
      networkPerformanceMonitor.startMonitoring()

      expect(logger.logger.debug).toHaveBeenCalledTimes(3)
    })
  })

  describe('Request History Management', () => {
    it('should get recent requests', async () => {
      for (let i = 0; i < 5; i++) {
        await fetch(`/api/test${i}`)
      }

      const recent = networkPerformanceMonitor.getRecentRequests(3)

      expect(recent.length).toBeLessThanOrEqual(3)
    })

    it('should default to 10 recent requests', async () => {
      for (let i = 0; i < 15; i++) {
        await fetch(`/api/test${i}`)
      }

      const recent = networkPerformanceMonitor.getRecentRequests()

      expect(recent.length).toBeLessThanOrEqual(10)
    })

    it('should clear request history', async () => {
      await fetch('/api/test1')
      await fetch('/api/test2')

      networkPerformanceMonitor.clearHistory()

      const recent = networkPerformanceMonitor.getRecentRequests()
      expect(recent.length).toBe(0)
    })

    it('should limit stored requests to prevent memory issues', async () => {
      // Create many requests
      for (let i = 0; i < 150; i++) {
        await fetch(`/api/test${i}`)
      }

      const metrics = networkPerformanceMonitor.getNetworkMetrics()
      // Should only consider recent requests
      expect(metrics.totalRequests).toBeLessThanOrEqual(20)
    })
  })

  describe('Report Generation', () => {
    it('should generate comprehensive network report', async () => {
      await fetch('/api/auth/login')
      await fetch('/api/users')

      const report = networkPerformanceMonitor.generateReport()

      expect(report).toContain('Network Performance Report')
      expect(report).toContain('Overall Metrics')
      expect(report).toContain('Authentication Requests')
      expect(report).toContain('Connection Quality')
    })

    it('should include metrics in report', async () => {
      await fetch('/api/test')

      const report = networkPerformanceMonitor.generateReport()

      expect(report).toContain('Average Latency')
      expect(report).toContain('Total Requests')
      expect(report).toContain('Failed Requests')
    })

    it('should include auth metrics when available', async () => {
      await fetch('/api/auth/login')

      const report = networkPerformanceMonitor.generateReport()

      expect(report).toContain('Total Auth Requests')
      expect(report).toContain('Success Rate')
    })

    it('should show message when no auth requests', () => {
      networkPerformanceMonitor.clearHistory()
      await fetch('/api/users')

      const report = networkPerformanceMonitor.generateReport()

      expect(report).toContain('No auth requests recorded')
    })

    it('should include recommendations in report', async () => {
      const report = networkPerformanceMonitor.generateReport()

      expect(report).toMatch(/Recommendations|No performance issues/)
    })
  })

  describe('Edge Cases', () => {
    it('should handle URL objects in fetch', async () => {
      const url = new URL('http://localhost/api/test')

      await fetch(url)

      const recent = networkPerformanceMonitor.getRecentRequests(1)
      expect(recent[0].url).toContain('/api/test')
    })

    it('should handle Request objects in fetch', async () => {
      const request = new Request('/api/test', { method: 'POST' })

      await fetch(request)

      const recent = networkPerformanceMonitor.getRecentRequests(1)
      expect(recent[0].method).toBe('POST')
    })

    it('should handle network timeout errors', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Request timeout'))

      try {
        await fetch('/api/timeout')
      } catch (_error) {
        // Expected
      }

      const metrics = networkPerformanceMonitor.getNetworkMetrics()
      expect(metrics.failedRequests).toBeGreaterThan(0)
    })

    it('should handle missing headers gracefully', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers()
      })

      await fetch('/api/test')

      const recent = networkPerformanceMonitor.getRecentRequests(1)
      expect(recent[0].size).toBe(0)
    })

    it('should categorize complex URLs correctly', async () => {
      await fetch('https://api.example.com/v1/auth/login?token=abc')

      const recent = networkPerformanceMonitor.getRecentRequests(1)
      expect(recent[0].type).toBe('auth')
    })

    it('should handle very slow requests', async () => {
      global.fetch = vi.fn().mockImplementation(() =>
        new Promise(resolve => {
          setTimeout(() => resolve({
            ok: true,
            status: 200,
            headers: new Headers()
          }), 5000)
        })
      )

      await fetch('/api/veryslow')

      const metrics = networkPerformanceMonitor.getNetworkMetrics()
      expect(metrics.slowRequests).toBeGreaterThan(0)
    })
  })

  describe('Connection Information', () => {
    it('should include connection type in metrics', () => {
      const metrics = networkPerformanceMonitor.getNetworkMetrics()

      expect(metrics).toHaveProperty('connectionType')
      expect(metrics).toHaveProperty('effectiveType')
    })

    it('should include downlink speed in metrics', () => {
      const metrics = networkPerformanceMonitor.getNetworkMetrics()

      expect(metrics).toHaveProperty('downlink')
      expect(metrics.downlink).toBeGreaterThanOrEqual(0)
    })

    it('should include RTT in metrics', () => {
      const metrics = networkPerformanceMonitor.getNetworkMetrics()

      expect(metrics).toHaveProperty('rtt')
      expect(metrics.rtt).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Performance Logging', () => {
    it('should log auth request completion', async () => {
      await fetch('/api/auth/login')

      expect(logger.logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Auth request completed'),
        expect.anything()
      )
    })

    it('should log network request failures', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

      try {
        await fetch('/api/fail')
      } catch (_error) {
        // Expected
      }

      expect(logger.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Network request failed'),
        expect.anything()
      )
    })

    it('should log quality test execution', async () => {
      await networkPerformanceMonitor.runNetworkQualityTest()

      expect(logger.logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Running network quality test')
      )
    })
  })
})