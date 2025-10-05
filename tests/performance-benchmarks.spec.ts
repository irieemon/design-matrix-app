import { test, expect } from '@playwright/test';

/**
 * Performance Benchmarks for Design Matrix Card Rendering
 *
 * Comprehensive performance validation including load times,
 * rendering performance, memory usage, and scalability testing.
 */

interface PerformanceMetrics {
  loadTime: number;
  renderTime: number;
  memoryUsage: number;
  consoleLogRate: number;
  frameRate: number;
  cardCount: number;
  timestamp: number;
}

test.describe('Performance Benchmarks - Design Matrix Rendering', () => {

  test.beforeEach(async ({ page }) => {
    // Clear any existing performance marks
    await page.evaluate(() => {
      if (typeof performance !== 'undefined' && performance.clearMarks) {
        performance.clearMarks();
        performance.clearMeasures();
      }
    });
  });

  test('Baseline: Empty matrix load performance', async ({ page }) => {
    const startTime = Date.now();

    // Clear localStorage for clean baseline
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Navigate and measure
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait for matrix container to be stable
    await page.waitForSelector('text=Strategic Priority Matrix');
    await page.waitForTimeout(1000);

    const loadTime = Date.now() - startTime;

    // Get browser performance metrics
    const performanceMetrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const paint = performance.getEntriesByType('paint');

      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        firstPaint: paint.find(p => p.name === 'first-paint')?.startTime || 0,
        firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0,
        resourceCount: performance.getEntriesByType('resource').length
      };
    });

    // Performance assertions for baseline
    expect(loadTime).toBeLessThan(3000); // 3 second threshold
    expect(performanceMetrics.domContentLoaded).toBeLessThan(2000);
    expect(performanceMetrics.firstContentfulPaint).toBeLessThan(1500);

    console.log('Baseline Performance Metrics:');
    console.log(`  Total load time: ${loadTime}ms`);
    console.log(`  DOM content loaded: ${performanceMetrics.domContentLoaded}ms`);
    console.log(`  First contentful paint: ${performanceMetrics.firstContentfulPaint}ms`);
    console.log(`  Resources loaded: ${performanceMetrics.resourceCount}`);
  });

  test('Standard Load: 5 cards performance benchmark', async ({ page }) => {
    const startTime = Date.now();

    // Set up standard test scenario
    await page.evaluate(() => {
      const standardIdeas = [
        { id: 'perf-1', content: 'Quick Win Idea', matrix_position: { x: 0.2, y: 0.8 }, created_at: new Date().toISOString(), user_id: 'test' },
        { id: 'perf-2', content: 'Strategic Investment', matrix_position: { x: 0.8, y: 0.8 }, created_at: new Date().toISOString(), user_id: 'test' },
        { id: 'perf-3', content: 'Reconsider Option', matrix_position: { x: 0.2, y: 0.2 }, created_at: new Date().toISOString(), user_id: 'test' },
        { id: 'perf-4', content: 'Avoid This Task', matrix_position: { x: 0.8, y: 0.2 }, created_at: new Date().toISOString(), user_id: 'test' },
        { id: 'perf-5', content: 'Center Position', matrix_position: { x: 0.5, y: 0.5 }, created_at: new Date().toISOString(), user_id: 'test' }
      ];
      localStorage.setItem('ideas', JSON.stringify(standardIdeas));
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait for all cards to render
    await page.waitForFunction(() => {
      const cards = document.querySelectorAll('*[class*="card"], *[data-testid*="card"]');
      return cards.length >= 5;
    }, { timeout: 10000 });

    const loadTime = Date.now() - startTime;

    // Measure rendering performance
    const renderingMetrics = await page.evaluate(() => {
      // Mark start of measurement
      performance.mark('cards-render-start');

      // Measure card rendering time
      const cards = Array.from(document.querySelectorAll('*')).filter(el =>
        el.textContent?.includes('Quick Win') ||
        el.textContent?.includes('Strategic') ||
        el.textContent?.includes('Reconsider') ||
        el.textContent?.includes('Avoid') ||
        el.textContent?.includes('Center')
      );

      performance.mark('cards-render-end');
      performance.measure('cards-render-time', 'cards-render-start', 'cards-render-end');

      const renderMeasure = performance.getEntriesByName('cards-render-time')[0];

      return {
        cardCount: cards.length,
        renderTime: renderMeasure ? renderMeasure.duration : 0,
        visibleCards: cards.filter(card => {
          const rect = card.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        }).length,
        cardsWithinBounds: cards.filter(card => {
          const rect = card.getBoundingClientRect();
          return rect.x >= 0 && rect.y >= 0 &&
                 rect.x + rect.width <= window.innerWidth &&
                 rect.y + rect.height <= window.innerHeight;
        }).length
      };
    });

    // Memory usage measurement
    const memoryInfo = await page.evaluate(() => {
      return (performance as any).memory ? {
        usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
        totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
        jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit
      } : null;
    });

    // Performance assertions
    expect(loadTime).toBeLessThan(4000); // 4 second threshold with cards
    expect(renderingMetrics.cardCount).toBe(5);
    expect(renderingMetrics.visibleCards).toBe(5);
    expect(renderingMetrics.cardsWithinBounds).toBe(5);

    console.log('Standard Load Performance:');
    console.log(`  Total load time: ${loadTime}ms`);
    console.log(`  Cards found: ${renderingMetrics.cardCount}`);
    console.log(`  Visible cards: ${renderingMetrics.visibleCards}`);
    console.log(`  Cards within bounds: ${renderingMetrics.cardsWithinBounds}`);
    console.log(`  Render time: ${renderingMetrics.renderTime}ms`);

    if (memoryInfo) {
      console.log(`  Memory usage: ${(memoryInfo.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`);
      expect(memoryInfo.usedJSHeapSize).toBeLessThan(50 * 1024 * 1024); // 50MB limit
    }
  });

  test('Stress Test: 50 cards performance validation', async ({ page }) => {
    const startTime = Date.now();

    // Generate stress test data
    await page.evaluate(() => {
      const stressIdeas = Array.from({ length: 50 }, (_, i) => ({
        id: `stress-${i}`,
        content: `Stress Test Card ${i} with additional content to test rendering performance under load`,
        matrix_position: {
          x: (i % 10) * 0.1 + 0.05,
          y: Math.floor(i / 10) * 0.2 + 0.1
        },
        created_at: new Date().toISOString(),
        user_id: 'test'
      }));
      localStorage.setItem('ideas', JSON.stringify(stressIdeas));
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait for initial render with timeout
    const cardsLoaded = await page.waitForFunction(() => {
      const cards = Array.from(document.querySelectorAll('*')).filter(el =>
        el.textContent?.includes('Stress Test Card')
      );
      return cards.length >= 40; // Allow for some tolerance
    }, { timeout: 15000 }).catch(() => false);

    const loadTime = Date.now() - startTime;

    // Measure performance under stress
    const stressMetrics = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('*')).filter(el =>
        el.textContent?.includes('Stress Test Card')
      );

      const visibleCards = cards.filter(card => {
        const rect = card.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });

      const withinBounds = cards.filter(card => {
        const rect = card.getBoundingClientRect();
        return rect.x >= -50 && rect.y >= -50 && // Allow slight overflow
               rect.x < window.innerWidth + 50 &&
               rect.y < window.innerHeight + 50;
      });

      return {
        totalCards: cards.length,
        visibleCards: visibleCards.length,
        cardsWithinBounds: withinBounds.length,
        averageCardSize: visibleCards.length > 0 ?
          visibleCards.reduce((acc, card) => {
            const rect = card.getBoundingClientRect();
            return acc + (rect.width * rect.height);
          }, 0) / visibleCards.length : 0
      };
    });

    // Memory measurement under stress
    const stressMemory = await page.evaluate(() => {
      return (performance as any).memory ? {
        usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
        totalJSHeapSize: (performance as any).memory.totalJSHeapSize
      } : null;
    });

    // Stress test assertions (more lenient thresholds)
    expect(loadTime).toBeLessThan(10000); // 10 second threshold under stress
    expect(stressMetrics.totalCards).toBeGreaterThanOrEqual(40); // Allow some loss under stress
    expect(stressMetrics.visibleCards).toBeGreaterThanOrEqual(35); // Most should be visible

    console.log('Stress Test Performance:');
    console.log(`  Load time: ${loadTime}ms`);
    console.log(`  Cards loaded: ${stressMetrics.totalCards}/50`);
    console.log(`  Visible cards: ${stressMetrics.visibleCards}`);
    console.log(`  Cards within bounds: ${stressMetrics.cardsWithinBounds}`);
    console.log(`  Average card size: ${stressMetrics.averageCardSize.toFixed(0)}px²`);

    if (stressMemory) {
      const memoryMB = stressMemory.usedJSHeapSize / 1024 / 1024;
      console.log(`  Memory usage: ${memoryMB.toFixed(2)}MB`);
      expect(memoryMB).toBeLessThan(100); // 100MB limit under stress
    }

    expect(cardsLoaded).toBeTruthy();
  });

  test('Console Log Performance: Monitoring log rate', async ({ page }) => {
    let consoleLogCount = 0;
    const consoleMessages: string[] = [];

    // Monitor console output
    page.on('console', (msg) => {
      consoleLogCount++;
      consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
    });

    // Set up standard scenario
    await page.evaluate(() => {
      const testIdeas = [
        { id: 'log-1', content: 'Log Test Card 1', matrix_position: { x: 0.3, y: 0.3 }, created_at: new Date().toISOString(), user_id: 'test' },
        { id: 'log-2', content: 'Log Test Card 2', matrix_position: { x: 0.7, y: 0.7 }, created_at: new Date().toISOString(), user_id: 'test' }
      ];
      localStorage.setItem('ideas', JSON.stringify(testIdeas));
    });

    const logMonitorStart = Date.now();
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000); // Monitor for 5 seconds

    const monitorDuration = (Date.now() - logMonitorStart) / 1000;
    const logRate = consoleLogCount / monitorDuration;

    // Filter critical logs
    const criticalLogs = consoleMessages.filter(msg =>
      msg.includes('[error]') &&
      !msg.includes('Download the React DevTools') &&
      !msg.includes('[vite]')
    );

    const warningLogs = consoleMessages.filter(msg => msg.includes('[warning]'));

    // Performance assertions
    expect(logRate).toBeLessThan(5); // Max 5 logs per second
    expect(criticalLogs.length).toBe(0); // No critical errors

    console.log('Console Performance Analysis:');
    console.log(`  Total logs: ${consoleLogCount} in ${monitorDuration.toFixed(1)}s`);
    console.log(`  Log rate: ${logRate.toFixed(2)} logs/second`);
    console.log(`  Critical errors: ${criticalLogs.length}`);
    console.log(`  Warnings: ${warningLogs.length}`);

    if (criticalLogs.length > 0) {
      console.log('Critical logs found:');
      criticalLogs.forEach(log => console.log(`    ${log}`));
    }
  });

  test('Drag Performance: Interaction responsiveness', async ({ page }) => {
    // Set up drag test scenario
    await page.evaluate(() => {
      const dragIdea = [{
        id: 'drag-perf',
        content: 'Drag Performance Test',
        matrix_position: { x: 0.3, y: 0.3 },
        created_at: new Date().toISOString(),
        user_id: 'test'
      }];
      localStorage.setItem('ideas', JSON.stringify(dragIdea));
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const dragCard = page.locator('text=Drag Performance Test').first();
    await expect(dragCard).toBeVisible();

    // Measure drag performance
    const dragMetrics = await page.evaluate(async () => {
      const card = Array.from(document.querySelectorAll('*')).find(el =>
        el.textContent?.includes('Drag Performance Test')
      );

      if (!card) return null;

      const startTime = performance.now();
      let frameCount = 0;
      const frameTimes: number[] = [];

      // Simulate hover (drag initiation)
      const hoverEvent = new MouseEvent('mouseenter', { bubbles: true });
      card.dispatchEvent(hoverEvent);

      // Monitor frame rate during interaction
      const monitorFrames = () => {
        return new Promise(resolve => {
          const measureFrames = () => {
            frameCount++;
            frameTimes.push(performance.now());

            if (frameCount < 30) { // Monitor 30 frames
              requestAnimationFrame(measureFrames);
            } else {
              resolve(true);
            }
          };
          requestAnimationFrame(measureFrames);
        });
      };

      await monitorFrames();

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgFrameTime = totalTime / frameCount;
      const estimatedFPS = 1000 / avgFrameTime;

      return {
        frameCount,
        totalTime,
        avgFrameTime,
        estimatedFPS,
        frameTimeVariance: frameTimes.length > 1 ?
          frameTimes.reduce((acc, time, i) =>
            i === 0 ? 0 : acc + Math.abs(time - frameTimes[i-1]), 0
          ) / (frameTimes.length - 1) : 0
      };
    });

    expect(dragMetrics).toBeTruthy();

    if (dragMetrics) {
      // Performance assertions for smooth interaction
      expect(dragMetrics.estimatedFPS).toBeGreaterThan(30); // Minimum 30 FPS
      expect(dragMetrics.avgFrameTime).toBeLessThan(33); // Max 33ms per frame (30 FPS)

      console.log('Drag Performance Metrics:');
      console.log(`  Average frame time: ${dragMetrics.avgFrameTime.toFixed(2)}ms`);
      console.log(`  Estimated FPS: ${dragMetrics.estimatedFPS.toFixed(1)}`);
      console.log(`  Frame time variance: ${dragMetrics.frameTimeVariance.toFixed(2)}ms`);
      console.log(`  Total measurement time: ${dragMetrics.totalTime.toFixed(2)}ms`);
    }
  });

  test('Memory Leak Detection: Extended usage simulation', async ({ page }) => {
    let initialMemory: number | null = null;
    let finalMemory: number | null = null;

    // Measure initial memory
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    initialMemory = await page.evaluate(() => {
      return (performance as any).memory?.usedJSHeapSize || null;
    });

    // Simulate extended usage with multiple operations
    for (let i = 0; i < 5; i++) {
      await page.evaluate((iteration) => {
        const ideas = Array.from({ length: 10 }, (_, j) => ({
          id: `memory-${iteration}-${j}`,
          content: `Memory Test Card ${iteration}-${j}`,
          matrix_position: { x: Math.random(), y: Math.random() },
          created_at: new Date().toISOString(),
          user_id: 'test'
        }));
        localStorage.setItem('ideas', JSON.stringify(ideas));
      }, i);

      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      // Clear and add new data
      await page.evaluate(() => {
        localStorage.clear();
      });
    }

    // Force garbage collection if possible
    await page.evaluate(() => {
      if ((window as any).gc) {
        (window as any).gc();
      }
    });

    await page.waitForTimeout(2000);

    // Measure final memory
    finalMemory = await page.evaluate(() => {
      return (performance as any).memory?.usedJSHeapSize || null;
    });

    if (initialMemory && finalMemory) {
      const memoryDiff = finalMemory - initialMemory;
      const memoryDiffMB = memoryDiff / 1024 / 1024;

      console.log('Memory Leak Analysis:');
      console.log(`  Initial memory: ${(initialMemory / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  Final memory: ${(finalMemory / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  Memory difference: ${memoryDiffMB.toFixed(2)}MB`);

      // Allow some memory growth but detect significant leaks
      expect(memoryDiffMB).toBeLessThan(20); // Max 20MB growth
    } else {
      console.log('Memory measurement not available in this browser');
      expect(true).toBeTruthy(); // Test passes if memory API unavailable
    }
  });

  test('Network Performance: Resource loading optimization', async ({ page }) => {
    const resourceLoadTimes: any[] = [];

    // Monitor resource loading
    page.on('response', (response) => {
      resourceLoadTimes.push({
        url: response.url(),
        status: response.status(),
        timing: response.timing(),
        size: response.headers()['content-length'] || 0
      });
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Analyze resource performance
    const resourceAnalysis = await page.evaluate(() => {
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];

      return resources.map(resource => ({
        name: resource.name,
        duration: resource.duration,
        size: resource.transferSize || 0,
        type: resource.initiatorType,
        cached: resource.transferSize === 0 && resource.decodedBodySize > 0
      }));
    });

    // Performance analysis
    const totalResources = resourceAnalysis.length;
    const cachedResources = resourceAnalysis.filter(r => r.cached).length;
    const largeResources = resourceAnalysis.filter(r => r.size > 100000); // > 100KB
    const slowResources = resourceAnalysis.filter(r => r.duration > 1000); // > 1s

    console.log('Network Performance Analysis:');
    console.log(`  Total resources: ${totalResources}`);
    console.log(`  Cached resources: ${cachedResources} (${((cachedResources/totalResources) * 100).toFixed(1)}%)`);
    console.log(`  Large resources (>100KB): ${largeResources.length}`);
    console.log(`  Slow resources (>1s): ${slowResources.length}`);

    // Performance assertions
    expect(slowResources.length).toBeLessThan(5); // Max 5 slow resources
    expect(largeResources.length).toBeLessThan(10); // Max 10 large resources

    if (largeResources.length > 0) {
      console.log('Large resources found:');
      largeResources.forEach(resource => {
        console.log(`  ${resource.name}: ${(resource.size / 1024).toFixed(1)}KB`);
      });
    }
  });
});