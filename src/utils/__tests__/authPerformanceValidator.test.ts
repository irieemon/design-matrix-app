/**
 * Authentication Performance Validator Test Suite
 *
 * Comprehensive tests for auth performance validation functionality
 * including target validation, performance scoring, and recommendations.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { authPerformanceValidator } from '../authPerformanceValidator'
import { authPerformanceMonitor } from '../authPerformanceMonitor'
import * as logger from '../logger'

// Mock dependencies
vi.mock('../logger', () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

vi.mock('../authPerformanceMonitor', () => ({
  authPerformanceMonitor: {
    getAverageMetrics: vi.fn(),
    checkStoragePerformance: vi.fn(),
    checkNetworkPerformance: vi.fn()
  }
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('AuthPerformanceValidator', () => {
  describe('Performance Validation', () => {
    it('should pass validation with optimal metrics', async () => {
      vi.mocked(authPerformanceMonitor.getAverageMetrics).mockReturnValue({
        avgTotalTime: 600,
        avgSessionCheck: 200,
        avgProfileFetch: 250,
        avgProjectCheck: 150,
        successRate: 0.98,
        sampleSize: 10
      })

      const result = await authPerformanceValidator.validateCurrentPerformance()

      expect(result.passed).toBe(true)
      expect(result.score).toBe(100)
      expect(result.issues).toHaveLength(0)
      expect(result.recommendations).toHaveLength(0)
    })

    it('should fail validation with no metrics available', async () => {
      vi.mocked(authPerformanceMonitor.getAverageMetrics).mockReturnValue(null)

      const result = await authPerformanceValidator.validateCurrentPerformance()

      expect(result.passed).toBe(false)
      expect(result.score).toBe(0)
      expect(result.issues).toContain('No authentication metrics available')
      expect(result.recommendations).toContain('Perform authentication to collect performance data')
    })

    it('should detect slow session check', async () => {
      vi.mocked(authPerformanceMonitor.getAverageMetrics).mockReturnValue({
        avgTotalTime: 1200,
        avgSessionCheck: 500,
        avgProfileFetch: 350,
        avgProjectCheck: 150,
        successRate: 0.95,
        sampleSize: 5
      })

      const result = await authPerformanceValidator.validateCurrentPerformance()

      expect(result.passed).toBe(false)
      expect(result.issues.some(issue => issue.includes('Session check too slow'))).toBe(true)
      expect(result.recommendations.some(rec => rec.includes('session timeout'))).toBe(true)
      expect(result.score).toBeLessThan(100)
    })

    it('should detect slow user profile fetch', async () => {
      vi.mocked(authPerformanceMonitor.getAverageMetrics).mockReturnValue({
        avgTotalTime: 1000,
        avgSessionCheck: 250,
        avgProfileFetch: 600,
        avgProjectCheck: 150,
        successRate: 0.95,
        sampleSize: 5
      })

      const result = await authPerformanceValidator.validateCurrentPerformance()

      expect(result.passed).toBe(false)
      expect(result.issues.some(issue => issue.includes('Profile fetch too slow'))).toBe(true)
      expect(result.recommendations.some(rec => rec.includes('database queries') || rec.includes('caching'))).toBe(true)
    })

    it('should detect slow project check', async () => {
      vi.mocked(authPerformanceMonitor.getAverageMetrics).mockReturnValue({
        avgTotalTime: 900,
        avgSessionCheck: 250,
        avgProfileFetch: 350,
        avgProjectCheck: 300,
        successRate: 0.95,
        sampleSize: 5
      })

      const result = await authPerformanceValidator.validateCurrentPerformance()

      expect(result.passed).toBe(false)
      expect(result.issues.some(issue => issue.includes('Project check too slow'))).toBe(true)
      expect(result.recommendations.some(rec => rec.includes('project data caching'))).toBe(true)
    })

    it('should detect slow total auth time', async () => {
      vi.mocked(authPerformanceMonitor.getAverageMetrics).mockReturnValue({
        avgTotalTime: 1500,
        avgSessionCheck: 250,
        avgProfileFetch: 350,
        avgProjectCheck: 150,
        successRate: 0.95,
        sampleSize: 5
      })

      const result = await authPerformanceValidator.validateCurrentPerformance()

      expect(result.passed).toBe(false)
      expect(result.issues.some(issue => issue.includes('Total auth time too slow'))).toBe(true)
      expect(result.recommendations.some(rec => rec.includes('overall auth flow'))).toBe(true)
    })

    it('should detect low success rate', async () => {
      vi.mocked(authPerformanceMonitor.getAverageMetrics).mockReturnValue({
        avgTotalTime: 700,
        avgSessionCheck: 250,
        avgProfileFetch: 350,
        avgProjectCheck: 150,
        successRate: 0.85,
        sampleSize: 10
      })

      const result = await authPerformanceValidator.validateCurrentPerformance()

      expect(result.passed).toBe(false)
      expect(result.issues.some(issue => issue.includes('Low success rate'))).toBe(true)
      expect(result.recommendations.some(rec => rec.includes('authentication failures'))).toBe(true)
    })

    it('should calculate score correctly with multiple issues', async () => {
      vi.mocked(authPerformanceMonitor.getAverageMetrics).mockReturnValue({
        avgTotalTime: 2000,
        avgSessionCheck: 600,
        avgProfileFetch: 700,
        avgProjectCheck: 400,
        successRate: 0.88,
        sampleSize: 10
      })

      const result = await authPerformanceValidator.validateCurrentPerformance()

      expect(result.passed).toBe(false)
      expect(result.score).toBeGreaterThan(0)
      expect(result.score).toBeLessThan(100)
      expect(result.issues.length).toBeGreaterThan(1)
    })

    it('should not allow negative scores', async () => {
      vi.mocked(authPerformanceMonitor.getAverageMetrics).mockReturnValue({
        avgTotalTime: 5000,
        avgSessionCheck: 2000,
        avgProfileFetch: 2000,
        avgProjectCheck: 1000,
        successRate: 0.5,
        sampleSize: 10
      })

      const result = await authPerformanceValidator.validateCurrentPerformance()

      expect(result.score).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Performance Testing', () => {
    it('should run performance test successfully', async () => {
      vi.mocked(authPerformanceMonitor.checkStoragePerformance).mockReturnValue(5)
      vi.mocked(authPerformanceMonitor.checkNetworkPerformance).mockResolvedValue(100)

      const result = await authPerformanceValidator.runPerformanceTest()

      expect(result.passed).toBe(true)
      expect(result.score).toBe(100)
      expect(result.issues).toHaveLength(0)
    })

    it('should detect slow localStorage', async () => {
      vi.mocked(authPerformanceMonitor.checkStoragePerformance).mockReturnValue(25)
      vi.mocked(authPerformanceMonitor.checkNetworkPerformance).mockResolvedValue(100)

      const result = await authPerformanceValidator.runPerformanceTest()

      expect(result.passed).toBe(false)
      expect(result.issues.some(issue => issue.includes('Slow localStorage'))).toBe(true)
      expect(result.recommendations.some(rec => rec.includes('browser storage'))).toBe(true)
      expect(result.score).toBeLessThan(100)
    })

    it('should detect slow network', async () => {
      vi.mocked(authPerformanceMonitor.checkStoragePerformance).mockReturnValue(5)
      vi.mocked(authPerformanceMonitor.checkNetworkPerformance).mockResolvedValue(2500)

      const result = await authPerformanceValidator.runPerformanceTest()

      expect(result.passed).toBe(false)
      expect(result.issues.some(issue => issue.includes('Slow network'))).toBe(true)
      expect(result.recommendations.some(rec => rec.includes('Network connectivity'))).toBe(true)
    })

    it('should detect storage conflicts', async () => {
      vi.mocked(authPerformanceMonitor.checkStoragePerformance).mockReturnValue(5)
      vi.mocked(authPerformanceMonitor.checkNetworkPerformance).mockResolvedValue(100)

      // Mock localStorage with conflicting keys
      const mockGetItem = vi.fn()
      const mockSetItem = vi.fn()
      const mockRemoveItem = vi.fn()

      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: mockGetItem,
          setItem: mockSetItem,
          removeItem: mockRemoveItem,
          clear: vi.fn(),
          length: 3,
          key: (index: number) => ['auth-old-key', 'user-cache', 'prioritas-data'][index] || null
        },
        writable: true
      })

      Object.defineProperty(window.localStorage, 'length', { value: 3 })
      vi.spyOn(Object, 'keys').mockReturnValue(['auth-old-key', 'user-cache', 'prioritas-data'])

      const result = await authPerformanceValidator.runPerformanceTest()

      expect(result.passed).toBe(false)
      expect(result.issues.some(issue => issue.includes('Storage conflicts'))).toBe(true)
    })

    it('should handle performance test errors gracefully', async () => {
      vi.mocked(authPerformanceMonitor.checkStoragePerformance).mockImplementation(() => {
        throw new Error('Storage error')
      })
      vi.mocked(authPerformanceMonitor.checkNetworkPerformance).mockResolvedValue(100)

      await expect(authPerformanceValidator.runPerformanceTest()).rejects.toThrow()
    })
  })

  describe('Performance Report Generation', () => {
    it('should generate report with metrics', () => {
      vi.mocked(authPerformanceMonitor.getAverageMetrics).mockReturnValue({
        avgTotalTime: 650,
        avgSessionCheck: 220,
        avgProfileFetch: 280,
        avgProjectCheck: 150,
        successRate: 0.97,
        sampleSize: 15
      })

      const report = authPerformanceValidator.generatePerformanceReport()

      expect(report).toContain('Authentication Performance Report')
      expect(report).toContain('650')
      expect(report).toContain('220')
      expect(report).toContain('280')
      expect(report).toContain('150')
      expect(report).toContain('97')
      expect(report).toContain('15 sessions')
    })

    it('should show pass status in report', () => {
      vi.mocked(authPerformanceMonitor.getAverageMetrics).mockReturnValue({
        avgTotalTime: 600,
        avgSessionCheck: 200,
        avgProfileFetch: 250,
        avgProjectCheck: 150,
        successRate: 0.98,
        sampleSize: 10
      })

      const report = authPerformanceValidator.generatePerformanceReport()

      expect(report).toContain('✅')
      expect(report).not.toContain('❌')
    })

    it('should show fail status for metrics exceeding targets', () => {
      vi.mocked(authPerformanceMonitor.getAverageMetrics).mockReturnValue({
        avgTotalTime: 1200,
        avgSessionCheck: 500,
        avgProfileFetch: 600,
        avgProjectCheck: 300,
        successRate: 0.92,
        sampleSize: 10
      })

      const report = authPerformanceValidator.generatePerformanceReport()

      expect(report).toContain('❌')
    })

    it('should return message when no metrics available', () => {
      vi.mocked(authPerformanceMonitor.getAverageMetrics).mockReturnValue(null)

      const report = authPerformanceValidator.generatePerformanceReport()

      expect(report).toContain('No performance data available')
    })

    it('should include optimization impact information', () => {
      vi.mocked(authPerformanceMonitor.getAverageMetrics).mockReturnValue({
        avgTotalTime: 650,
        avgSessionCheck: 220,
        avgProfileFetch: 280,
        avgProjectCheck: 150,
        successRate: 0.97,
        sampleSize: 15
      })

      const report = authPerformanceValidator.generatePerformanceReport()

      expect(report).toContain('Optimization Impact')
      expect(report).toContain('timeout optimization')
      expect(report).toContain('caching')
      expect(report).toContain('Parallel execution')
    })
  })

  describe('Continuous Monitoring', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      import.meta.env.DEV = true
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should start continuous monitoring in dev mode', () => {
      const cleanup = authPerformanceValidator.startContinuousMonitoring(1000)

      expect(cleanup).toBeInstanceOf(Function)
    })

    it('should not start monitoring in production', () => {
      import.meta.env.DEV = false

      const cleanup = authPerformanceValidator.startContinuousMonitoring(1000)

      expect(cleanup).toBeUndefined()
    })

    it('should check performance at intervals', async () => {
      vi.mocked(authPerformanceMonitor.getAverageMetrics).mockReturnValue({
        avgTotalTime: 1500,
        avgSessionCheck: 500,
        avgProfileFetch: 600,
        avgProjectCheck: 400,
        successRate: 0.88,
        sampleSize: 10
      })

      authPerformanceValidator.startContinuousMonitoring(1000)

      await vi.advanceTimersByTimeAsync(1000)

      expect(logger.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Performance issues detected'),
        expect.anything()
      )
    })

    it('should detect severe performance degradation', async () => {
      vi.mocked(authPerformanceMonitor.getAverageMetrics).mockReturnValue({
        avgTotalTime: 3000,
        avgSessionCheck: 1000,
        avgProfileFetch: 1200,
        avgProjectCheck: 800,
        successRate: 0.70,
        sampleSize: 10
      })

      authPerformanceValidator.startContinuousMonitoring(1000)

      await vi.advanceTimersByTimeAsync(1000)

      expect(logger.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Severe performance degradation'),
        expect.anything()
      )
    })

    it('should allow cleanup of monitoring interval', () => {
      const cleanup = authPerformanceValidator.startContinuousMonitoring(1000)

      expect(cleanup).toBeDefined()
      cleanup?.()
    })
  })

  describe('Performance Targets', () => {
    it('should validate against correct performance targets', async () => {
      vi.mocked(authPerformanceMonitor.getAverageMetrics).mockReturnValue({
        avgTotalTime: 600,
        avgSessionCheck: 200,
        avgProfileFetch: 250,
        avgProjectCheck: 150,
        successRate: 0.98,
        sampleSize: 10
      })

      const result = await authPerformanceValidator.validateCurrentPerformance()

      // Check that targets are included in result
      expect(result.metrics.targets).toBeDefined()
      expect(result.metrics.targets.sessionCheck).toBe(300)
      expect(result.metrics.targets.userProfileFetch).toBe(400)
      expect(result.metrics.targets.projectCheck).toBe(200)
      expect(result.metrics.targets.totalAuthTime).toBe(800)
      expect(result.metrics.targets.successRate).toBe(0.95)
    })

    it('should include current metrics in validation result', async () => {
      const mockMetrics = {
        avgTotalTime: 700,
        avgSessionCheck: 250,
        avgProfileFetch: 300,
        avgProjectCheck: 150,
        successRate: 0.96,
        sampleSize: 8
      }

      vi.mocked(authPerformanceMonitor.getAverageMetrics).mockReturnValue(mockMetrics)

      const result = await authPerformanceValidator.validateCurrentPerformance()

      expect(result.metrics.current).toEqual(mockMetrics)
    })
  })

  describe('Edge Cases', () => {
    it('should handle metrics at exact target values', async () => {
      vi.mocked(authPerformanceMonitor.getAverageMetrics).mockReturnValue({
        avgTotalTime: 800,
        avgSessionCheck: 300,
        avgProfileFetch: 400,
        avgProjectCheck: 200,
        successRate: 0.95,
        sampleSize: 10
      })

      const result = await authPerformanceValidator.validateCurrentPerformance()

      expect(result.passed).toBe(true)
      expect(result.score).toBe(100)
    })

    it('should handle metrics slightly over target', async () => {
      vi.mocked(authPerformanceMonitor.getAverageMetrics).mockReturnValue({
        avgTotalTime: 801,
        avgSessionCheck: 301,
        avgProfileFetch: 401,
        avgProjectCheck: 201,
        successRate: 0.949,
        sampleSize: 10
      })

      const result = await authPerformanceValidator.validateCurrentPerformance()

      expect(result.passed).toBe(false)
      expect(result.score).toBeLessThan(100)
      expect(result.score).toBeGreaterThan(90)
    })

    it('should handle extreme performance degradation', async () => {
      vi.mocked(authPerformanceMonitor.getAverageMetrics).mockReturnValue({
        avgTotalTime: 10000,
        avgSessionCheck: 5000,
        avgProfileFetch: 4000,
        avgProjectCheck: 1000,
        successRate: 0.30,
        sampleSize: 10
      })

      const result = await authPerformanceValidator.validateCurrentPerformance()

      expect(result.passed).toBe(false)
      expect(result.score).toBe(0)
      expect(result.issues.length).toBeGreaterThan(3)
      expect(result.recommendations.length).toBeGreaterThan(3)
    })

    it('should handle zero sample size edge case', async () => {
      vi.mocked(authPerformanceMonitor.getAverageMetrics).mockReturnValue({
        avgTotalTime: 0,
        avgSessionCheck: 0,
        avgProfileFetch: 0,
        avgProjectCheck: 0,
        successRate: 0,
        sampleSize: 0
      })

      const result = await authPerformanceValidator.validateCurrentPerformance()

      expect(result).toBeDefined()
    })
  })

  describe('Recommendation Quality', () => {
    it('should provide specific recommendations for session check issues', async () => {
      vi.mocked(authPerformanceMonitor.getAverageMetrics).mockReturnValue({
        avgTotalTime: 1000,
        avgSessionCheck: 600,
        avgProfileFetch: 300,
        avgProjectCheck: 100,
        successRate: 0.95,
        sampleSize: 10
      })

      const result = await authPerformanceValidator.validateCurrentPerformance()

      const hasSessionRecommendation = result.recommendations.some(rec =>
        rec.includes('session') || rec.includes('Supabase')
      )
      expect(hasSessionRecommendation).toBe(true)
    })

    it('should provide specific recommendations for profile fetch issues', async () => {
      vi.mocked(authPerformanceMonitor.getAverageMetrics).mockReturnValue({
        avgTotalTime: 1000,
        avgSessionCheck: 200,
        avgProfileFetch: 700,
        avgProjectCheck: 100,
        successRate: 0.95,
        sampleSize: 10
      })

      const result = await authPerformanceValidator.validateCurrentPerformance()

      const hasProfileRecommendation = result.recommendations.some(rec =>
        rec.includes('database') || rec.includes('caching')
      )
      expect(hasProfileRecommendation).toBe(true)
    })

    it('should provide specific recommendations for project check issues', async () => {
      vi.mocked(authPerformanceMonitor.getAverageMetrics).mockReturnValue({
        avgTotalTime: 900,
        avgSessionCheck: 200,
        avgProfileFetch: 300,
        avgProjectCheck: 400,
        successRate: 0.95,
        sampleSize: 10
      })

      const result = await authPerformanceValidator.validateCurrentPerformance()

      const hasProjectRecommendation = result.recommendations.some(rec =>
        rec.includes('project') || rec.includes('caching')
      )
      expect(hasProjectRecommendation).toBe(true)
    })
  })
})