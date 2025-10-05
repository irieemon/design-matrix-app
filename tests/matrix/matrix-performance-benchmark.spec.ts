/**
 * MATRIX PERFORMANCE BENCHMARKING SUITE
 *
 * Comprehensive performance testing to validate:
 * - Hover response times <16ms
 * - Frame rates >58fps
 * - GPU acceleration working
 * - No memory leaks
 * - Layout stability
 */

import { test, expect, Page } from '@playwright/test';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

interface PerformanceBenchmark {
  testName: string;
  timestamp: string;
  metrics: {
    hoverResponseTimes: number[];
    frameRates: number[];
    memoryUsage: {
      initial: number;
      final: number;
      growth: number;
    };
    layoutShifts: number;
    paintTimes: number[];
    gpuAccelerated: boolean;
  };
  thresholds: {
    hoverResponseMs: number;
    minFrameRate: number;
    maxMemoryGrowth: number;
    maxLayoutShift: number;
  };
  results: {
    passed: boolean;
    failures: string[];
    score: number; // 0-100
  };
}

class PerformanceBenchmarker {
  private page: Page;
  private benchmark: PerformanceBenchmark;

  constructor(page: Page, testName: string) {
    this.page = page;
    this.benchmark = {
      testName,
      timestamp: new Date().toISOString(),
      metrics: {
        hoverResponseTimes: [],
        frameRates: [],
        memoryUsage: { initial: 0, final: 0, growth: 0 },
        layoutShifts: 0,
        paintTimes: [],
        gpuAccelerated: false
      },
      thresholds: {
        hoverResponseMs: 16,
        minFrameRate: 58,
        maxMemoryGrowth: 0.3, // 30% max growth
        maxLayoutShift: 0.1
      },
      results: {
        passed: false,
        failures: [],
        score: 0
      }
    };
  }

  async setupMonitoring() {
    await this.page.addInitScript(() => {
      // Performance monitoring setup
      (window as any).performanceData = {
        entries: [],
        layoutShifts: [],
        paintTimes: [],
        frameCount: 0,
        startTime: performance.now()
      };

      // Performance Observer for comprehensive metrics
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          (window as any).performanceData.entries.push({
            name: entry.name,
            entryType: entry.entryType,
            startTime: entry.startTime,
            duration: entry.duration
          });

          if (entry.entryType === 'layout-shift') {
            (window as any).performanceData.layoutShifts.push(entry);
          }

          if (entry.entryType === 'paint') {
            (window as any).performanceData.paintTimes.push(entry.startTime);
          }
        }
      });

      observer.observe({
        entryTypes: ['measure', 'paint', 'layout-shift', 'navigation', 'resource']
      });

      // Frame rate monitoring
      let lastFrameTime = performance.now();
      function trackFrames() {
        (window as any).performanceData.frameCount++;
        const now = performance.now();
        const delta = now - lastFrameTime;
        lastFrameTime = now;
        requestAnimationFrame(trackFrames);
      }
      requestAnimationFrame(trackFrames);
    });
  }

  async measureHoverPerformance(selector: string): Promise<number> {
    // Clear any previous measurements
    await this.page.evaluate(() => {
      performance.clearMarks();
      performance.clearMeasures();
    });

    // Start measurement
    await this.page.evaluate(() => performance.mark('hover-start'));

    // Perform hover
    await this.page.hover(selector);

    // Wait for any visual updates
    await this.page.waitForTimeout(20);

    // End measurement
    const hoverTime = await this.page.evaluate(() => {
      performance.mark('hover-end');
      performance.measure('hover-duration', 'hover-start', 'hover-end');
      const entries = performance.getEntriesByName('hover-duration');
      return entries.length > 0 ? entries[0].duration : 0;
    });

    return hoverTime;
  }

  async measureFrameRate(durationMs: number = 1000): Promise<number> {
    return await this.page.evaluate((duration) => {
      return new Promise<number>((resolve) => {
        let frameCount = 0;
        const startTime = performance.now();

        function countFrame() {
          frameCount++;
          const elapsed = performance.now() - startTime;

          if (elapsed < duration) {
            requestAnimationFrame(countFrame);
          } else {
            resolve((frameCount * 1000) / elapsed);
          }
        }

        requestAnimationFrame(countFrame);
      });
    }, durationMs);
  }

  async measureMemoryUsage(): Promise<{ used: number; total: number }> {
    return await this.page.evaluate(() => {
      const memory = (performance as any).memory;
      if (memory) {
        return {
          used: memory.usedJSHeapSize,
          total: memory.totalJSHeapSize
        };
      }
      return { used: 0, total: 0 };
    });
  }

  async checkGPUAcceleration(): Promise<boolean> {
    return await this.page.evaluate(() => {
      // Check WebGL support
      const canvas = document.createElement('canvas');
      const webgl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

      if (!webgl) return false;

      // Check for hardware acceleration indicators
      const debugInfo = webgl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        const renderer = webgl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        return renderer && !renderer.toLowerCase().includes('software');
      }

      return true; // Assume GPU acceleration if we can't determine
    });
  }

  async getLayoutShifts(): Promise<number> {
    return await this.page.evaluate(() => {
      const data = (window as any).performanceData;
      if (!data || !data.layoutShifts) return 0;

      return data.layoutShifts.reduce((sum: number, shift: any) => sum + (shift.value || 0), 0);
    });
  }

  async runComprehensiveBenchmark(): Promise<PerformanceBenchmark> {
    // Initial memory measurement
    const initialMemory = await this.measureMemoryUsage();
    this.benchmark.metrics.memoryUsage.initial = initialMemory.used;

    // GPU acceleration check
    this.benchmark.metrics.gpuAccelerated = await this.checkGPUAcceleration();

    // Test hover performance on multiple cards
    const cards = this.page.locator('[data-testid*="matrix-card"]');
    const cardCount = Math.min(await cards.count(), 4);

    for (let i = 0; i < cardCount; i++) {
      const hoverTime = await this.measureHoverPerformance(`[data-testid*="matrix-card"]:nth-child(${i + 1})`);
      this.benchmark.metrics.hoverResponseTimes.push(hoverTime);

      // Small delay between measurements
      await this.page.waitForTimeout(100);
    }

    // Measure frame rate during interactions
    const frameRatePromise = this.measureFrameRate(2000);

    // Perform various interactions while measuring frame rate
    for (let i = 0; i < cardCount; i++) {
      const card = cards.nth(i);
      await card.hover();
      await this.page.waitForTimeout(100);
      await card.click();
      await this.page.waitForTimeout(200);
    }

    const frameRate = await frameRatePromise;
    this.benchmark.metrics.frameRates.push(frameRate);

    // Final memory measurement
    const finalMemory = await this.measureMemoryUsage();
    this.benchmark.metrics.memoryUsage.final = finalMemory.used;
    this.benchmark.metrics.memoryUsage.growth =
      (finalMemory.used - initialMemory.used) / initialMemory.used;

    // Layout shift measurement
    this.benchmark.metrics.layoutShifts = await this.getLayoutShifts();

    // Calculate results
    this.calculateResults();

    return this.benchmark;
  }

  private calculateResults() {
    const failures: string[] = [];
    let score = 100;

    // Check hover response times
    const maxHoverTime = Math.max(...this.benchmark.metrics.hoverResponseTimes);
    const avgHoverTime = this.benchmark.metrics.hoverResponseTimes.reduce((a, b) => a + b, 0) /
                        this.benchmark.metrics.hoverResponseTimes.length;

    if (maxHoverTime > this.benchmark.thresholds.hoverResponseMs) {
      failures.push(`Max hover response time ${maxHoverTime.toFixed(2)}ms exceeds threshold ${this.benchmark.thresholds.hoverResponseMs}ms`);
      score -= 30;
    }

    if (avgHoverTime > this.benchmark.thresholds.hoverResponseMs * 0.75) {
      failures.push(`Average hover response time ${avgHoverTime.toFixed(2)}ms is too high`);
      score -= 15;
    }

    // Check frame rates
    const minFrameRate = Math.min(...this.benchmark.metrics.frameRates);
    if (minFrameRate < this.benchmark.thresholds.minFrameRate) {
      failures.push(`Frame rate ${minFrameRate.toFixed(2)}fps below threshold ${this.benchmark.thresholds.minFrameRate}fps`);
      score -= 25;
    }

    // Check memory growth
    if (this.benchmark.metrics.memoryUsage.growth > this.benchmark.thresholds.maxMemoryGrowth) {
      failures.push(`Memory growth ${(this.benchmark.metrics.memoryUsage.growth * 100).toFixed(1)}% exceeds threshold ${this.benchmark.thresholds.maxMemoryGrowth * 100}%`);
      score -= 15;
    }

    // Check layout shifts
    if (this.benchmark.metrics.layoutShifts > this.benchmark.thresholds.maxLayoutShift) {
      failures.push(`Layout shift ${this.benchmark.metrics.layoutShifts.toFixed(3)} exceeds threshold ${this.benchmark.thresholds.maxLayoutShift}`);
      score -= 10;
    }

    // Check GPU acceleration
    if (!this.benchmark.metrics.gpuAccelerated) {
      failures.push('GPU acceleration not detected');
      score -= 5;
    }

    this.benchmark.results = {
      passed: failures.length === 0,
      failures,
      score: Math.max(0, score)
    };
  }

  saveBenchmark(filePath: string) {
    writeFileSync(filePath, JSON.stringify(this.benchmark, null, 2));
  }
}

test.describe('Matrix Performance Benchmarking', () => {
  let benchmarker: PerformanceBenchmarker;

  test.beforeEach(async ({ page }) => {
    benchmarker = new PerformanceBenchmarker(page, 'Matrix Performance Test');
    await benchmarker.setupMonitoring();

    await page.goto('/');
    await page.waitForSelector('[data-testid="design-matrix"]', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Allow page to fully initialize
    await page.waitForTimeout(1000);
  });

  test('Comprehensive performance benchmark', async ({ page }) => {
    const benchmark = await benchmarker.runComprehensiveBenchmark();

    // Save benchmark results
    const resultsDir = join(process.cwd(), 'test-results', 'performance');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filePath = join(resultsDir, `matrix-performance-${timestamp}.json`);

    benchmarker.saveBenchmark(filePath);

    // Console output for immediate feedback
    console.log('\n=== MATRIX PERFORMANCE BENCHMARK RESULTS ===');
    console.log(`Test: ${benchmark.testName}`);
    console.log(`Timestamp: ${benchmark.timestamp}`);
    console.log(`Overall Score: ${benchmark.results.score}/100`);
    console.log(`Status: ${benchmark.results.passed ? 'PASSED' : 'FAILED'}\n`);

    console.log('METRICS:');
    console.log(`  Hover Response Times: ${benchmark.metrics.hoverResponseTimes.map(t => t.toFixed(2)).join(', ')}ms`);
    console.log(`  Max Hover Time: ${Math.max(...benchmark.metrics.hoverResponseTimes).toFixed(2)}ms (threshold: ${benchmark.thresholds.hoverResponseMs}ms)`);
    console.log(`  Frame Rates: ${benchmark.metrics.frameRates.map(f => f.toFixed(2)).join(', ')}fps`);
    console.log(`  Min Frame Rate: ${Math.min(...benchmark.metrics.frameRates).toFixed(2)}fps (threshold: ${benchmark.thresholds.minFrameRate}fps)`);
    console.log(`  Memory Growth: ${(benchmark.metrics.memoryUsage.growth * 100).toFixed(1)}% (threshold: ${benchmark.thresholds.maxMemoryGrowth * 100}%)`);
    console.log(`  Layout Shifts: ${benchmark.metrics.layoutShifts.toFixed(3)} (threshold: ${benchmark.thresholds.maxLayoutShift})`);
    console.log(`  GPU Accelerated: ${benchmark.metrics.gpuAccelerated ? 'Yes' : 'No'}`);

    if (benchmark.results.failures.length > 0) {
      console.log('\nFAILURES:');
      benchmark.results.failures.forEach(failure => console.log(`  • ${failure}`));
    }

    console.log(`\nDetailed results saved to: ${filePath}\n`);

    // Assertions for test framework
    expect(benchmark.results.passed).toBeTruthy();
    expect(benchmark.results.score).toBeGreaterThan(85); // Require 85+ score

    // Critical performance assertions
    const maxHoverTime = Math.max(...benchmark.metrics.hoverResponseTimes);
    expect(maxHoverTime).toBeLessThan(benchmark.thresholds.hoverResponseMs);

    const minFrameRate = Math.min(...benchmark.metrics.frameRates);
    expect(minFrameRate).toBeGreaterThan(benchmark.thresholds.minFrameRate);
  });

  test('Stress test performance under load', async ({ page }) => {
    benchmarker = new PerformanceBenchmarker(page, 'Matrix Stress Test');

    // Simulate heavy usage
    const cards = page.locator('[data-testid*="matrix-card"]');
    const cardCount = await cards.count();

    // Initial performance measurement
    const initialFrameRate = await benchmarker.measureFrameRate(1000);

    // Stress test: rapid interactions
    for (let round = 0; round < 5; round++) {
      for (let i = 0; i < cardCount; i++) {
        const card = cards.nth(i);

        // Rapid hover/click sequence
        await card.hover();
        await page.waitForTimeout(10);
        await card.click();
        await page.waitForTimeout(10);

        // Measure hover performance under load
        const hoverTime = await benchmarker.measureHoverPerformance(`[data-testid*="matrix-card"]:nth-child(${i + 1})`);
        expect(hoverTime).toBeLessThan(25); // Slightly more lenient under stress
      }
    }

    // Final performance measurement
    const finalFrameRate = await benchmarker.measureFrameRate(1000);

    // Performance should not degrade significantly
    const frameRateDrop = (initialFrameRate - finalFrameRate) / initialFrameRate;
    expect(frameRateDrop).toBeLessThan(0.2); // Less than 20% frame rate drop

    console.log(`Stress Test Results:`);
    console.log(`  Initial Frame Rate: ${initialFrameRate.toFixed(2)}fps`);
    console.log(`  Final Frame Rate: ${finalFrameRate.toFixed(2)}fps`);
    console.log(`  Frame Rate Drop: ${(frameRateDrop * 100).toFixed(1)}%`);
  });

  test('Performance regression detection', async ({ page }) => {
    const benchmark = await benchmarker.runComprehensiveBenchmark();

    // Compare with baseline if it exists
    const baselinePath = join(process.cwd(), 'test-results', 'performance', 'baseline.json');

    if (existsSync(baselinePath)) {
      const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));

      // Check for performance regressions
      const maxHoverTime = Math.max(...benchmark.metrics.hoverResponseTimes);
      const baselineMaxHover = Math.max(...baseline.metrics.hoverResponseTimes);

      const minFrameRate = Math.min(...benchmark.metrics.frameRates);
      const baselineMinFrameRate = Math.min(...baseline.metrics.frameRates);

      // Allow some variance but flag significant regressions
      const hoverRegression = (maxHoverTime - baselineMaxHover) / baselineMaxHover;
      const frameRateRegression = (baselineMinFrameRate - minFrameRate) / baselineMinFrameRate;

      console.log('Regression Analysis:');
      console.log(`  Hover Time Change: ${(hoverRegression * 100).toFixed(1)}%`);
      console.log(`  Frame Rate Change: ${(frameRateRegression * 100).toFixed(1)}%`);

      // Fail if significant regression (>20% worse)
      expect(hoverRegression).toBeLessThan(0.2);
      expect(frameRateRegression).toBeLessThan(0.2);
    } else {
      // Create baseline
      benchmarker.saveBenchmark(baselinePath);
      console.log('Baseline performance benchmark created');
    }
  });
});