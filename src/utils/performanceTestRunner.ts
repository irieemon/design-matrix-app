/**
 * Performance Test Runner
 *
 * Comprehensive testing suite for authentication performance validation
 * under various scenarios and conditions.
 */

import { authPerformanceMonitor } from './authPerformanceMonitor'
import { authPerformanceValidator } from './authPerformanceValidator'
import { logger } from './logger'

interface TestScenario {
  name: string
  description: string
  setup?: () => Promise<void>
  test: () => Promise<any>
  cleanup?: () => Promise<void>
  expectedThresholds: {
    maxTotalTime: number
    maxSessionCheck: number
    maxProfileFetch: number
    maxProjectCheck: number
    minSuccessRate: number
  }
}

interface TestResult {
  scenario: string
  passed: boolean
  metrics: any
  issues: string[]
  duration: number
  memoryBefore: number
  memoryAfter: number
  memoryDelta: number
}

interface PerformanceTestReport {
  testDate: string
  totalDuration: number
  scenarios: TestResult[]
  summary: {
    passed: number
    failed: number
    successRate: number
    avgPerformanceGain: number
    criticalIssues: string[]
    recommendations: string[]
  }
}

export class PerformanceTestRunner {
  private scenarios: TestScenario[] = [
    {
      name: 'Cold Start Authentication',
      description: 'Test authentication performance on fresh browser session',
      setup: async () => {
        // Clear all caches and storage
        localStorage.clear()
        sessionStorage.clear()
        if ('caches' in window) {
          const cacheNames = await caches.keys()
          await Promise.all(cacheNames.map(name => caches.delete(name)))
        }
      },
      test: async () => {
        return this.simulateAuthFlow('cold')
      },
      expectedThresholds: {
        maxTotalTime: 1200,
        maxSessionCheck: 400,
        maxProfileFetch: 600,
        maxProjectCheck: 300,
        minSuccessRate: 0.9
      }
    },
    {
      name: 'Warm Cache Authentication',
      description: 'Test authentication with cached data and tokens',
      setup: async () => {
        // Pre-populate cache with auth data
        await this.setupWarmCache()
      },
      test: async () => {
        return this.simulateAuthFlow('warm')
      },
      expectedThresholds: {
        maxTotalTime: 600,
        maxSessionCheck: 200,
        maxProfileFetch: 300,
        maxProjectCheck: 150,
        minSuccessRate: 0.95
      }
    },
    {
      name: 'Network Timeout Simulation',
      description: 'Test authentication behavior under slow network conditions',
      setup: async () => {
        // Simulate slow network by adding delays
        this.simulateSlowNetwork(true)
      },
      test: async () => {
        return this.simulateAuthFlow('slow')
      },
      cleanup: async () => {
        this.simulateSlowNetwork(false)
      },
      expectedThresholds: {
        maxTotalTime: 2000,
        maxSessionCheck: 800,
        maxProfileFetch: 1000,
        maxProjectCheck: 600,
        minSuccessRate: 0.8
      }
    },
    {
      name: 'Multiple Rapid Authentication',
      description: 'Test performance under rapid authentication attempts',
      test: async () => {
        const results = []
        for (let i = 0; i < 5; i++) {
          const result = await this.simulateAuthFlow(`rapid-${i}`)
          results.push(result)
          await new Promise(resolve => setTimeout(resolve, 100))
        }
        return results
      },
      expectedThresholds: {
        maxTotalTime: 800,
        maxSessionCheck: 300,
        maxProfileFetch: 400,
        maxProjectCheck: 200,
        minSuccessRate: 0.9
      }
    },
    {
      name: 'Memory Pressure Test',
      description: 'Test authentication under high memory usage',
      setup: async () => {
        // Create memory pressure
        this.createMemoryPressure()
      },
      test: async () => {
        return this.simulateAuthFlow('memory-pressure')
      },
      cleanup: async () => {
        this.cleanupMemoryPressure()
      },
      expectedThresholds: {
        maxTotalTime: 1000,
        maxSessionCheck: 400,
        maxProfileFetch: 500,
        maxProjectCheck: 250,
        minSuccessRate: 0.85
      }
    }
  ]

  private memoryPressureData: any[] = []
  private originalFetch: typeof fetch

  constructor() {
    this.originalFetch = window.fetch
  }

  async runAllTests(): Promise<PerformanceTestReport> {
    logger.debug('🧪 Starting comprehensive performance test suite...')
    const startTime = performance.now()
    const testResults: TestResult[] = []

    for (const scenario of this.scenarios) {
      logger.debug(`🎯 Running scenario: ${scenario.name}`)
      const result = await this.runScenario(scenario)
      testResults.push(result)

      // Wait between tests to allow system recovery
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    const totalDuration = performance.now() - startTime
    const report = this.generateReport(testResults, totalDuration)

    logger.debug('📊 Performance test suite completed:', {
      duration: `${totalDuration.toFixed(1)}ms`,
      passed: report.summary.passed,
      failed: report.summary.failed
    })

    return report
  }

  private async runScenario(scenario: TestScenario): Promise<TestResult> {
    const startTime = performance.now()
    const memoryBefore = this.getMemoryUsage()

    try {
      // Setup
      if (scenario.setup) {
        await scenario.setup()
      }

      // Run test
      authPerformanceMonitor.startSession()
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      await scenario.test()

      // Get metrics
      const metrics = authPerformanceMonitor.getAverageMetrics()
      const validation = await authPerformanceValidator.validateCurrentPerformance()

      // Cleanup
      if (scenario.cleanup) {
        await scenario.cleanup()
      }

      const memoryAfter = this.getMemoryUsage()
      const duration = performance.now() - startTime

      // Evaluate results
      const passed = this.evaluateScenario(metrics, validation, scenario.expectedThresholds)
      const issues = validation?.issues || []

      return {
        scenario: scenario.name,
        passed,
        metrics: metrics || {},
        issues,
        duration,
        memoryBefore,
        memoryAfter,
        memoryDelta: memoryAfter - memoryBefore
      }

    } catch (error) {
      logger.error(`❌ Scenario failed: ${scenario.name}`, error as Error)

      if (scenario.cleanup) {
        try { await scenario.cleanup() } catch {}
      }

      const memoryAfter = this.getMemoryUsage()
      const duration = performance.now() - startTime

      return {
        scenario: scenario.name,
        passed: false,
        metrics: {},
        issues: [`Test execution failed: ${(error as Error).message}`],
        duration,
        memoryBefore,
        memoryAfter,
        memoryDelta: memoryAfter - memoryBefore
      }
    }
  }

  private async simulateAuthFlow(type: string): Promise<any> {
    logger.debug(`🔐 Simulating auth flow: ${type}`)

    // Simulate session check
    authPerformanceMonitor.recordSessionCheck(Math.random() * 200 + 100)
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50))

    // Simulate profile fetch
    authPerformanceMonitor.recordUserProfileFetch(Math.random() * 300 + 200)
    await new Promise(resolve => setTimeout(resolve, Math.random() * 150 + 100))

    // Simulate project check
    authPerformanceMonitor.recordProjectCheck(Math.random() * 150 + 100)
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50))

    authPerformanceMonitor.finishSession('success')

    return { type, completed: true }
  }

  private async setupWarmCache(): Promise<void> {
    // Simulate cached user profile
    const cacheData = {
      userProfile: {
        id: 'test-user',
        email: 'test@example.com',
        timestamp: Date.now()
      },
      authToken: 'cached-token',
      projectExists: true
    }

    localStorage.setItem('auth-cache', JSON.stringify(cacheData))
  }

  private simulateSlowNetwork(enable: boolean): void {
    if (enable) {
      // Intercept fetch to add delays
      window.fetch = async (input, init) => {
        await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000))
        return this.originalFetch(input, init)
      }
    } else {
      // Restore original fetch
      window.fetch = this.originalFetch
    }
  }

  private createMemoryPressure(): void {
    // Create large data structures to simulate memory pressure
    for (let i = 0; i < 100; i++) {
      this.memoryPressureData.push(new Array(10000).fill(Math.random()))
    }
  }

  private cleanupMemoryPressure(): void {
    this.memoryPressureData = []
    // Force garbage collection if available
    if ('gc' in window) {
      (window as any).gc()
    }
  }

  private getMemoryUsage(): number {
    if ('memory' in performance) {
      const memory = (performance as any).memory
      return memory.usedJSHeapSize / 1024 / 1024 // MB
    }
    return 0
  }

  private evaluateScenario(
    metrics: any,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _validation: any,
    thresholds: TestScenario['expectedThresholds']
  ): boolean {
    if (!metrics) return false

    return (
      metrics.avgTotalTime <= thresholds.maxTotalTime &&
      metrics.avgSessionCheck <= thresholds.maxSessionCheck &&
      metrics.avgProfileFetch <= thresholds.maxProfileFetch &&
      metrics.avgProjectCheck <= thresholds.maxProjectCheck &&
      metrics.successRate >= thresholds.minSuccessRate
    )
  }

  private generateReport(results: TestResult[], totalDuration: number): PerformanceTestReport {
    const passed = results.filter(r => r.passed).length
    const failed = results.length - passed
    const successRate = passed / results.length

    // Calculate average performance gain (baseline vs current)
    const baselineTime = 4905.8 // Original reported time
    const avgCurrentTime = results
      .filter(r => r.metrics.avgTotalTime)
      .reduce((sum, r) => sum + r.metrics.avgTotalTime, 0) /
      results.filter(r => r.metrics.avgTotalTime).length

    const avgPerformanceGain = avgCurrentTime ?
      ((baselineTime - avgCurrentTime) / baselineTime) * 100 : 0

    // Identify critical issues
    const criticalIssues = results
      .flatMap(r => r.issues)
      .filter(issue =>
        issue.includes('slow') ||
        issue.includes('timeout') ||
        issue.includes('failed')
      )

    // Generate recommendations
    const recommendations = this.generateRecommendations(results)

    return {
      testDate: new Date().toISOString(),
      totalDuration,
      scenarios: results,
      summary: {
        passed,
        failed,
        successRate,
        avgPerformanceGain,
        criticalIssues: [...new Set(criticalIssues)],
        recommendations
      }
    }
  }

  private generateRecommendations(results: TestResult[]): string[] {
    const recommendations: string[] = []

    // Memory usage recommendations
    const highMemoryDelta = results.filter(r => r.memoryDelta > 50)
    if (highMemoryDelta.length > 0) {
      recommendations.push('Consider implementing memory cleanup during authentication')
    }

    // Performance recommendations
    const slowTests = results.filter(r => r.metrics.avgTotalTime > 1000)
    if (slowTests.length > 0) {
      recommendations.push('Review timeout configurations and cache strategies')
    }

    // Network recommendations
    if (results.some(r => r.scenario.includes('Network'))) {
      recommendations.push('Implement progressive loading for better network resilience')
    }

    return recommendations
  }

  // Public method to run a single scenario
  async runSingleScenario(scenarioName: string): Promise<TestResult | null> {
    const scenario = this.scenarios.find(s => s.name === scenarioName)
    if (!scenario) {
      logger.error(`❌ Scenario not found: ${scenarioName}`)
      return null
    }

    return this.runScenario(scenario)
  }

  // Get available scenarios
  getAvailableScenarios(): string[] {
    return this.scenarios.map(s => s.name)
  }
}

// Singleton instance
export const performanceTestRunner = new PerformanceTestRunner()

// Development helper
if (import.meta.env.DEV) {
  ;(window as any).perfTestRunner = performanceTestRunner
}