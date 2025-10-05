import { test, expect, Page } from '@playwright/test';
import { VisualTestHelper } from './visual/utils/visual-helpers';

/**
 * Performance Stability Testing Suite
 *
 * Comprehensive performance validation ensuring:
 * 1. 60fps performance during interactions
 * 2. Clean console output (no errors)
 * 3. Memory stability during extended use
 * 4. Network efficiency
 * 5. Frame rate consistency
 */

interface PerformanceMetrics {
  fps: number;
  memoryUsage: number;
  paintTiming: number;
  layoutShifts: number;
  consoleErrors: string[];
  networkRequests: number;
}

test.describe('Performance Stability Validation', () => {
  let visualHelper: VisualTestHelper;
  let performanceMetrics: PerformanceMetrics;

  test.beforeEach(async ({ page }) => {
    visualHelper = new VisualTestHelper(page);

    // Initialize performance monitoring
    performanceMetrics = {
      fps: 0,
      memoryUsage: 0,
      paintTiming: 0,
      layoutShifts: 0,
      consoleErrors: [],
      networkRequests: 0
    };

    // Set up comprehensive monitoring
    await this.setupPerformanceMonitoring(page, performanceMetrics);

    // Navigate with performance tracking
    await page.goto('/matrix');
    await page.waitForLoadState('networkidle');
    await visualHelper.waitForAuthStability();
  });

  test.describe('Frame Rate Performance', () => {
    test('maintains 60fps during matrix interactions', async ({ page }) => {
      console.log('🎯 Testing frame rate performance during interactions');

      await page.waitForSelector('.design-matrix', { timeout: 10000 });
      await page.waitForSelector('.idea-card', { timeout: 5000 });

      // Capture baseline performance
      await visualHelper.compareScreenshot({
        name: 'performance-baseline-fps',
        waitFor: 'networkidle',
        delay: 1000
      });

      // Start FPS monitoring
      const fpsResults = await this.monitorFPS(page, async () => {
        const cards = page.locator('.idea-card');
        const cardCount = await cards.count();

        if (cardCount > 0) {
          console.log('🔄 Performing interaction sequence for FPS testing');

          // Interaction sequence 1: Hover effects
          for (let i = 0; i < Math.min(cardCount, 10); i++) {
            const card = cards.nth(i);
            await card.hover();
            await page.waitForTimeout(50);
            await page.mouse.move(0, 0);
            await page.waitForTimeout(50);
          }

          // Interaction sequence 2: Scrolling
          await page.mouse.wheel(0, 500);
          await page.waitForTimeout(100);
          await page.mouse.wheel(0, -500);
          await page.waitForTimeout(100);

          // Interaction sequence 3: Card selection/deselection
          if (cardCount >= 3) {
            for (let i = 0; i < 3; i++) {
              await cards.nth(i).click();
              await page.waitForTimeout(50);
            }
          }

          // Interaction sequence 4: Double-click modal interactions
          if (cardCount > 0) {
            await cards.first().dblclick();
            await page.waitForTimeout(500);
            await page.keyboard.press('Escape');
            await page.waitForTimeout(300);
          }
        }
      });

      console.log(`📊 Average FPS during interactions: ${fpsResults.averageFPS.toFixed(2)}`);
      console.log(`📊 Minimum FPS: ${fpsResults.minFPS.toFixed(2)}`);
      console.log(`📊 Frame drops: ${fpsResults.frameDrops}`);

      // Validate FPS performance
      expect(fpsResults.averageFPS).toBeGreaterThan(45); // Allow some variance
      expect(fpsResults.minFPS).toBeGreaterThan(30); // Minimum acceptable
      expect(fpsResults.frameDrops).toBeLessThan(10); // Minimal frame drops

      // Capture after performance test
      await visualHelper.compareScreenshot({
        name: 'performance-after-fps-test',
        waitFor: 'networkidle',
        delay: 500
      });

      console.log('✅ FPS performance validation complete');
    });

    test('maintains performance during drag operations', async ({ page }) => {
      console.log('🎯 Testing performance during drag and drop operations');

      await page.waitForSelector('.idea-card', { timeout: 5000 });

      const cards = page.locator('.idea-card');
      const cardCount = await cards.count();

      if (cardCount >= 2) {
        // Monitor FPS during drag operations
        const dragFPSResults = await this.monitorFPS(page, async () => {
          // Perform multiple drag operations
          for (let i = 0; i < Math.min(cardCount - 1, 5); i++) {
            const sourceCard = cards.nth(i);
            const targetCard = cards.nth(i + 1);

            await sourceCard.hover();
            await page.mouse.down();

            // Simulate drag movement
            const sourceBbox = await sourceCard.boundingBox();
            const targetBbox = await targetCard.boundingBox();

            if (sourceBbox && targetBbox) {
              // Move in steps to simulate realistic drag
              const steps = 10;
              const deltaX = (targetBbox.x - sourceBbox.x) / steps;
              const deltaY = (targetBbox.y - sourceBbox.y) / steps;

              for (let step = 1; step <= steps; step++) {
                await page.mouse.move(
                  sourceBbox.x + (deltaX * step),
                  sourceBbox.y + (deltaY * step)
                );
                await page.waitForTimeout(20);
              }
            }

            await page.mouse.up();
            await page.waitForTimeout(100);
          }
        });

        console.log(`📊 Drag operation average FPS: ${dragFPSResults.averageFPS.toFixed(2)}`);

        // Validate drag performance
        expect(dragFPSResults.averageFPS).toBeGreaterThan(40);
        expect(dragFPSResults.frameDrops).toBeLessThan(15);

        console.log('✅ Drag operation performance validation complete');
      }
    });
  });

  test.describe('Console Cleanliness', () => {
    test('maintains clean console output during operations', async ({ page }) => {
      console.log('🎯 Testing console cleanliness during matrix operations');

      // Console monitoring is already set up in beforeEach
      await page.waitForSelector('.idea-card', { timeout: 5000 });

      // Perform comprehensive interaction sequence
      await this.performInteractionSequence(page);

      // Analyze console output
      console.log(`📊 Total console errors: ${performanceMetrics.consoleErrors.length}`);

      if (performanceMetrics.consoleErrors.length > 0) {
        console.log('🚨 Console errors detected:');
        performanceMetrics.consoleErrors.forEach((error, index) => {
          console.log(`  ${index + 1}. ${error}`);
        });
      }

      // Filter out non-critical errors
      const criticalErrors = this.filterCriticalErrors(performanceMetrics.consoleErrors);

      console.log(`📊 Critical console errors: ${criticalErrors.length}`);

      // Validate console cleanliness
      expect(criticalErrors.length).toBe(0);

      // Capture console validation evidence
      await visualHelper.compareScreenshot({
        name: 'console-cleanliness-validated',
        waitFor: 'networkidle',
        delay: 500
      });

      console.log('✅ Console cleanliness validation complete');
    });

    test('no memory leaks during extended operations', async ({ page }) => {
      console.log('🎯 Testing memory stability during extended operations');

      await page.waitForSelector('.idea-card', { timeout: 5000 });

      // Monitor memory usage over time
      const memoryResults = await this.monitorMemoryUsage(page, async () => {
        // Perform extended operation sequence
        for (let cycle = 0; cycle < 5; cycle++) {
          console.log(`🔄 Memory test cycle ${cycle + 1}/5`);

          await this.performInteractionSequence(page);
          await page.waitForTimeout(1000);

          // Force garbage collection if available
          try {
            await page.evaluate(() => {
              if (window.gc) {
                window.gc();
              }
            });
          } catch (error) {
            // GC not available in this environment
          }
        }
      });

      console.log(`📊 Memory usage - Initial: ${memoryResults.initial}MB, Final: ${memoryResults.final}MB`);
      console.log(`📊 Memory increase: ${memoryResults.increase}MB (${memoryResults.increasePercent.toFixed(2)}%)`);

      // Validate memory stability
      expect(memoryResults.increasePercent).toBeLessThan(50); // Less than 50% increase
      expect(memoryResults.increase).toBeLessThan(20); // Less than 20MB increase

      console.log('✅ Memory stability validation complete');
    });
  });

  test.describe('Layout Stability', () => {
    test('minimal layout shifts during interactions', async ({ page }) => {
      console.log('🎯 Testing layout stability during interactions');

      await page.waitForSelector('.design-matrix', { timeout: 10000 });

      // Monitor layout shifts during interactions
      const layoutShiftResult = await visualHelper.detectLayoutShift({
        duration: 5000,
        threshold: 0.1,
        elements: ['.idea-card', '.design-matrix', '.sidebar']
      });

      // Perform interactions while monitoring
      await this.performInteractionSequence(page);

      console.log(`📊 Total layout shift score: ${layoutShiftResult.totalShift.toFixed(4)}`);
      console.log(`📊 Layout shift entries: ${layoutShiftResult.entries.length}`);

      // Validate layout stability
      expect(layoutShiftResult.exceedsThreshold).toBe(false);
      expect(layoutShiftResult.totalShift).toBeLessThan(0.05);

      // Capture layout stability evidence
      await visualHelper.compareScreenshot({
        name: 'layout-stability-validated',
        waitFor: 'networkidle',
        delay: 500
      });

      console.log('✅ Layout stability validation complete');
    });
  });

  test.describe('Network Efficiency', () => {
    test('efficient network usage during operations', async ({ page }) => {
      console.log('🎯 Testing network efficiency during operations');

      // Network monitoring is set up in beforeEach
      const initialRequests = performanceMetrics.networkRequests;

      await page.waitForSelector('.idea-card', { timeout: 5000 });

      // Perform operations
      await this.performInteractionSequence(page);

      const finalRequests = performanceMetrics.networkRequests;
      const requestIncrease = finalRequests - initialRequests;

      console.log(`📊 Network requests during operations: ${requestIncrease}`);

      // Validate network efficiency
      expect(requestIncrease).toBeLessThan(20); // Reasonable request limit

      console.log('✅ Network efficiency validation complete');
    });
  });

  // Helper methods

  async setupPerformanceMonitoring(page: Page, metrics: PerformanceMetrics) {
    // Console error monitoring
    page.on('console', msg => {
      if (msg.type() === 'error') {
        metrics.consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', error => {
      metrics.consoleErrors.push(`Page Error: ${error.message}`);
    });

    // Network request monitoring
    page.on('request', request => {
      metrics.networkRequests++;
    });

    // Inject performance monitoring scripts
    await page.addInitScript(() => {
      // Layout shift monitoring
      window.performanceData = {
        layoutShifts: [],
        paintTimings: [],
        memoryUsage: []
      };

      // Layout shift observer
      if ('PerformanceObserver' in window) {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            window.performanceData.layoutShifts.push({
              value: entry.value,
              startTime: entry.startTime
            });
          }
        });
        observer.observe({ entryTypes: ['layout-shift'] });

        // Paint timing observer
        const paintObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            window.performanceData.paintTimings.push({
              name: entry.name,
              startTime: entry.startTime,
              duration: entry.duration
            });
          }
        });
        paintObserver.observe({ entryTypes: ['paint'] });
      }

      // Memory monitoring
      if ('memory' in performance) {
        setInterval(() => {
          window.performanceData.memoryUsage.push({
            used: performance.memory.usedJSHeapSize,
            total: performance.memory.totalJSHeapSize,
            timestamp: Date.now()
          });
        }, 1000);
      }
    });
  }

  async monitorFPS(page: Page, operation: () => Promise<void>): Promise<{
    averageFPS: number;
    minFPS: number;
    maxFPS: number;
    frameDrops: number;
  }> {
    // Inject FPS monitoring
    await page.evaluate(() => {
      window.fpsData = {
        frames: [],
        lastTime: performance.now()
      };

      function measureFPS() {
        const now = performance.now();
        const delta = now - window.fpsData.lastTime;
        const fps = 1000 / delta;

        window.fpsData.frames.push(fps);
        window.fpsData.lastTime = now;

        requestAnimationFrame(measureFPS);
      }

      requestAnimationFrame(measureFPS);
    });

    // Perform operation
    await operation();

    // Get FPS data
    const fpsData = await page.evaluate(() => window.fpsData.frames);

    const averageFPS = fpsData.reduce((sum, fps) => sum + fps, 0) / fpsData.length;
    const minFPS = Math.min(...fpsData);
    const maxFPS = Math.max(...fpsData);
    const frameDrops = fpsData.filter(fps => fps < 50).length;

    return { averageFPS, minFPS, maxFPS, frameDrops };
  }

  async monitorMemoryUsage(page: Page, operation: () => Promise<void>): Promise<{
    initial: number;
    final: number;
    increase: number;
    increasePercent: number;
  }> {
    // Get initial memory
    const initialMemory = await page.evaluate(() => {
      return performance.memory ? performance.memory.usedJSHeapSize / (1024 * 1024) : 0;
    });

    // Perform operation
    await operation();

    // Get final memory
    const finalMemory = await page.evaluate(() => {
      return performance.memory ? performance.memory.usedJSHeapSize / (1024 * 1024) : 0;
    });

    const increase = finalMemory - initialMemory;
    const increasePercent = (increase / initialMemory) * 100;

    return {
      initial: Math.round(initialMemory * 100) / 100,
      final: Math.round(finalMemory * 100) / 100,
      increase: Math.round(increase * 100) / 100,
      increasePercent
    };
  }

  async performInteractionSequence(page: Page) {
    console.log('🔄 Performing comprehensive interaction sequence');

    const cards = page.locator('.idea-card');
    const cardCount = await cards.count();

    if (cardCount > 0) {
      // Hover sequence
      for (let i = 0; i < Math.min(cardCount, 5); i++) {
        await cards.nth(i).hover();
        await page.waitForTimeout(100);
      }

      // Click sequence
      for (let i = 0; i < Math.min(cardCount, 3); i++) {
        await cards.nth(i).click();
        await page.waitForTimeout(100);
      }

      // Double-click modal test
      await cards.first().dblclick();
      await page.waitForTimeout(500);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);

      // Scroll sequence
      await page.mouse.wheel(0, 300);
      await page.waitForTimeout(200);
      await page.mouse.wheel(0, -300);
      await page.waitForTimeout(200);
    }
  }

  filterCriticalErrors(errors: string[]): string[] {
    return errors.filter(error => {
      const ignoredPatterns = [
        'DevTools',
        'Extension',
        'favicon',
        'chrome-extension',
        'Non-Error promise rejection',
        'ResizeObserver loop limit exceeded'
      ];

      return !ignoredPatterns.some(pattern =>
        error.toLowerCase().includes(pattern.toLowerCase())
      );
    });
  }
});

// Global type extensions
declare global {
  interface Window {
    performanceData: {
      layoutShifts: any[];
      paintTimings: any[];
      memoryUsage: any[];
    };
    fpsData: {
      frames: number[];
      lastTime: number;
    };
    gc?: () => void;
  }
}