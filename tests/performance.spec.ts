import { test, expect } from '@playwright/test';

test.describe('Performance Monitoring and Error Boundary Tests', () => {

  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Clear any existing data for consistent testing
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test('Performance Metrics - Initial Load Time', async ({ page }) => {
    // Measure initial load performance
    const startTime = Date.now();

    await page.goto('/', { waitUntil: 'networkidle' });

    const loadTime = Date.now() - startTime;

    // Page should load within 3 seconds
    expect(loadTime).toBeLessThan(3000);

    // Check Core Web Vitals
    const webVitals = await page.evaluate(() => {
      return new Promise((resolve) => {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const vitals: Record<string, number> = {};

          entries.forEach((entry) => {
            if (entry.name === 'first-contentful-paint') {
              vitals.fcp = entry.startTime;
            }
            if (entry.name === 'largest-contentful-paint') {
              vitals.lcp = entry.startTime;
            }
          });

          resolve(vitals);
        }).observe({ entryTypes: ['paint', 'largest-contentful-paint'] });

        // Fallback timeout
        setTimeout(() => resolve({}), 2000);
      });
    });

    console.log('Web Vitals:', webVitals);

    // FCP should be under 1.8s (good threshold)
    if ((webVitals as any).fcp) {
      expect((webVitals as any).fcp).toBeLessThan(1800);
    }

    // LCP should be under 2.5s (good threshold)
    if ((webVitals as any).lcp) {
      expect((webVitals as any).lcp).toBeLessThan(2500);
    }
  });

  test('Performance - Memory Usage Monitoring', async ({ page }) => {
    // Monitor memory usage during normal operations
    const initialMemory = await page.evaluate(() => {
      return (performance as any).memory ? {
        usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
        totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
        jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit
      } : null;
    });

    // Create multiple ideas to test memory usage
    const ideas = Array.from({ length: 50 }, (_, i) => ({
      id: `memory-test-${i}`,
      content: `Memory Test Idea ${i}`,
      matrix_position: { x: Math.random(), y: Math.random() },
      created_at: new Date().toISOString(),
      user_id: 'test-user'
    }));

    await page.evaluate((ideas) => {
      localStorage.setItem('ideas', JSON.stringify(ideas));
    }, ideas);

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Perform multiple operations
    for (let i = 0; i < 10; i++) {
      const idea = page.locator(`text=Memory Test Idea ${i}`).first();
      if (await idea.isVisible()) {
        await idea.dragTo(page.locator('.matrix-container'), {
          targetPosition: { x: 300 + i * 10, y: 300 + i * 10 }
        });
        await page.waitForTimeout(100);
      }
    }

    const finalMemory = await page.evaluate(() => {
      return (performance as any).memory ? {
        usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
        totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
        jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit
      } : null;
    });

    if (initialMemory && finalMemory) {
      const memoryIncrease = finalMemory.usedJSHeapSize - initialMemory.usedJSHeapSize;

      // Memory increase should be reasonable (less than 100MB)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);

      console.log('Memory usage:', {
        initial: (initialMemory.usedJSHeapSize / 1024 / 1024).toFixed(2) + 'MB',
        final: (finalMemory.usedJSHeapSize / 1024 / 1024).toFixed(2) + 'MB',
        increase: (memoryIncrease / 1024 / 1024).toFixed(2) + 'MB'
      });
    }
  });

  test('Performance - Drag Operation Response Time', async ({ page }) => {
    // Set up test idea
    await page.evaluate(() => {
      const testIdea = [{
        id: 'perf-drag-test',
        content: 'Performance Drag Test',
        matrix_position: { x: 0.2, y: 0.8 },
        created_at: new Date().toISOString(),
        user_id: 'test-user'
      }];
      localStorage.setItem('ideas', JSON.stringify(testIdea));
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    const idea = page.locator('text=Performance Drag Test').first();
    await expect(idea).toBeVisible();

    // Measure drag operation performance
    const dragTimes: number[] = [];

    for (let i = 0; i < 5; i++) {
      const startTime = performance.now();

      await idea.dragTo(page.locator('.matrix-container'), {
        targetPosition: { x: 300 + i * 50, y: 300 + i * 50 }
      });

      await page.waitForTimeout(100);

      const endTime = performance.now();
      dragTimes.push(endTime - startTime);
    }

    const averageDragTime = dragTimes.reduce((a, b) => a + b, 0) / dragTimes.length;

    // Average drag operation should complete under 500ms
    expect(averageDragTime).toBeLessThan(500);

    console.log('Drag performance:', {
      average: averageDragTime.toFixed(2) + 'ms',
      min: Math.min(...dragTimes).toFixed(2) + 'ms',
      max: Math.max(...dragTimes).toFixed(2) + 'ms'
    });
  });

  test('Performance - Frame Rate During Animations', async ({ page }) => {
    // Monitor frame rate during drag operations
    await page.evaluate(() => {
      const testIdea = [{
        id: 'fps-test',
        content: 'FPS Test Idea',
        matrix_position: { x: 0.5, y: 0.5 },
        created_at: new Date().toISOString(),
        user_id: 'test-user'
      }];
      localStorage.setItem('ideas', JSON.stringify(testIdea));
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Start FPS monitoring
    await page.evaluate(() => {
      (window as any).fps = [];
      (window as any).lastFrameTime = performance.now();

      function measureFPS() {
        const now = performance.now();
        const delta = now - (window as any).lastFrameTime;
        (window as any).lastFrameTime = now;
        (window as any).fps.push(1000 / delta);
        requestAnimationFrame(measureFPS);
      }

      requestAnimationFrame(measureFPS);
    });

    const idea = page.locator('text=FPS Test Idea').first();

    // Perform drag operation while monitoring FPS
    await idea.dragTo(page.locator('.matrix-container'), {
      targetPosition: { x: 400, y: 400 }
    });

    await page.waitForTimeout(1000);

    const fpsData = await page.evaluate(() => {
      const fps = (window as any).fps;
      if (fps.length === 0) return null;

      const averageFPS = fps.reduce((a: number, b: number) => a + b, 0) / fps.length;
      const minFPS = Math.min(...fps);

      return { average: averageFPS, minimum: minFPS, samples: fps.length };
    });

    if (fpsData) {
      // Should maintain reasonable frame rate (>30 FPS average, >20 FPS minimum)
      expect(fpsData.average).toBeGreaterThan(30);
      expect(fpsData.minimum).toBeGreaterThan(20);

      console.log('Animation performance:', {
        averageFPS: fpsData.average.toFixed(1),
        minimumFPS: fpsData.minimum.toFixed(1),
        samples: fpsData.samples
      });
    }
  });

  test('Error Boundary - JavaScript Error Handling', async ({ page }) => {
    // Monitor console errors
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Monitor page errors
    const pageErrors: Error[] = [];
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Trigger potential error by corrupting data
    await page.evaluate(() => {
      localStorage.setItem('ideas', '{"invalid": json}');
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    // App should handle errors gracefully
    await expect(page.locator('text=No ideas yet')).toBeVisible();

    // Should not have unhandled JavaScript errors
    expect(pageErrors).toHaveLength(0);

    // Console errors should be minimal (only expected ones)
    const criticalErrors = errors.filter(error =>
      !error.includes('localStorage') &&
      !error.includes('JSON') &&
      !error.includes('Warning:') // React warnings are acceptable
    );

    expect(criticalErrors).toHaveLength(0);
  });

  test('Error Boundary - Network Failure Handling', async ({ page }) => {
    // Simulate network failures
    await page.route('**/*', route => {
      if (route.request().url().includes('api')) {
        route.abort();
      } else {
        route.continue();
      }
    });

    // App should still function with network failures
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Basic functionality should work offline
    await expect(page.locator('text=Strategic Priority Matrix')).toBeVisible();

    // Should handle failed API calls gracefully
    const addButton = page.locator('button:has-text("Add Idea")');
    if (await addButton.isVisible()) {
      await addButton.click();

      // Should show appropriate error messaging for network failures
      await page.waitForTimeout(2000);

      // App should not crash
      await expect(page.locator('text=Strategic Priority Matrix')).toBeVisible();
    }
  });

  test('Error Boundary - Memory Pressure Simulation', async ({ page }) => {
    // Create memory pressure by generating large datasets
    await page.evaluate(() => {
      // Generate large idea dataset
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        id: `stress-test-${i}`,
        content: `Stress Test Idea ${i} with lots of additional data to increase memory usage and test how the application handles large datasets and memory pressure scenarios`,
        matrix_position: { x: Math.random(), y: Math.random() },
        created_at: new Date().toISOString(),
        user_id: 'test-user',
        additionalData: Array.from({ length: 100 }, (_, j) => `Extra data ${j}`)
      }));

      localStorage.setItem('ideas', JSON.stringify(largeDataset));
    });

    const startTime = Date.now();

    await page.reload();
    await page.waitForLoadState('networkidle');

    const loadTime = Date.now() - startTime;

    // Should handle large datasets within reasonable time (10 seconds)
    expect(loadTime).toBeLessThan(10000);

    // App should remain functional
    await expect(page.locator('text=Strategic Priority Matrix')).toBeVisible();

    // Should be able to interact with a subset of ideas
    const visibleIdeas = await page.locator('[data-testid^="idea-card-"]').count();
    expect(visibleIdeas).toBeGreaterThan(0);

    // Memory usage should be reasonable
    const memoryUsage = await page.evaluate(() => {
      return (performance as any).memory ? {
        used: (performance as any).memory.usedJSHeapSize,
        limit: (performance as any).memory.jsHeapSizeLimit
      } : null;
    });

    if (memoryUsage) {
      const memoryPercentage = (memoryUsage.used / memoryUsage.limit) * 100;

      // Should not use more than 50% of available heap
      expect(memoryPercentage).toBeLessThan(50);

      console.log('Memory usage under stress:', {
        used: (memoryUsage.used / 1024 / 1024).toFixed(2) + 'MB',
        percentage: memoryPercentage.toFixed(1) + '%'
      });
    }
  });

  test('Error Boundary - Component Error Recovery', async ({ page }) => {
    // Set up error monitoring
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Test with malformed component data
    await page.evaluate(() => {
      const malformedIdeas = [
        {
          id: null, // Invalid ID
          content: undefined, // Invalid content
          matrix_position: 'invalid', // Invalid position
          created_at: 'not-a-date',
          user_id: ''
        },
        {
          // Missing required fields
          content: 'Partial Idea'
        }
      ];

      localStorage.setItem('ideas', JSON.stringify(malformedIdeas));
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    // App should handle malformed data gracefully
    // Either show error state or filter out bad data
    const isEmptyState = await page.locator('text=No ideas yet').isVisible();
    const hasErrorBoundary = await page.locator('[data-testid="error-boundary"]').isVisible();
    const hasValidIdeas = await page.locator('[data-testid^="idea-card-"]').count() > 0;

    // One of these should be true - graceful handling
    expect(isEmptyState || hasErrorBoundary || hasValidIdeas).toBeTruthy();

    // Should not have crashed the entire app
    await expect(page.locator('text=Strategic Priority Matrix')).toBeVisible();
  });

  test('Performance - Bundle Size and Loading Optimization', async ({ page }) => {
    // Measure resource loading
    const resources: Array<{ name: string; size: number; duration: number }> = [];

    page.on('response', response => {
      const request = response.request();
      const url = request.url();

      if (url.includes('.js') || url.includes('.css') || url.includes('.wasm')) {
        response.body().then(body => {
          resources.push({
            name: url.split('/').pop() || url,
            size: body.length,
            duration: response.timing().responseEnd
          });
        }).catch(() => {
          // Ignore errors in resource measurement
        });
      }
    });

    await page.goto('/', { waitUntil: 'networkidle' });

    await page.waitForTimeout(2000); // Allow resources to be captured

    // Analyze bundle sizes
    const jsResources = resources.filter(r => r.name.includes('.js'));
    const cssResources = resources.filter(r => r.name.includes('.css'));

    const totalJSSize = jsResources.reduce((sum, r) => sum + r.size, 0);
    const totalCSSSize = cssResources.reduce((sum, r) => sum + r.size, 0);

    // Bundle sizes should be reasonable
    expect(totalJSSize).toBeLessThan(2 * 1024 * 1024); // < 2MB total JS
    expect(totalCSSSize).toBeLessThan(500 * 1024); // < 500KB total CSS

    console.log('Bundle analysis:', {
      totalJS: (totalJSSize / 1024).toFixed(1) + 'KB',
      totalCSS: (totalCSSSize / 1024).toFixed(1) + 'KB',
      jsFiles: jsResources.length,
      cssFiles: cssResources.length
    });

    // Critical resources should load quickly
    const criticalResources = resources.filter(r =>
      r.name.includes('main') || r.name.includes('index')
    );

    criticalResources.forEach(resource => {
      expect(resource.duration).toBeLessThan(2000); // < 2s for critical resources
    });
  });

  test('Performance - Accessibility Performance Impact', async ({ page }) => {
    // Enable screen reader simulation
    await page.addInitScript(() => {
      // Simulate screen reader by adding aria-live regions
      const liveRegion = document.createElement('div');
      liveRegion.setAttribute('aria-live', 'polite');
      liveRegion.setAttribute('aria-atomic', 'true');
      liveRegion.style.position = 'absolute';
      liveRegion.style.left = '-10000px';
      document.body.appendChild(liveRegion);
    });

    await page.evaluate(() => {
      const testIdeas = Array.from({ length: 30 }, (_, i) => ({
        id: `a11y-perf-${i}`,
        content: `Accessibility Performance Test ${i}`,
        matrix_position: { x: Math.random(), y: Math.random() },
        created_at: new Date().toISOString(),
        user_id: 'test-user'
      }));
      localStorage.setItem('ideas', JSON.stringify(testIdeas));
    });

    const startTime = Date.now();

    await page.reload();
    await page.waitForLoadState('networkidle');

    const loadTimeWithA11y = Date.now() - startTime;

    // Accessibility features should not significantly impact performance
    expect(loadTimeWithA11y).toBeLessThan(5000);

    // Test keyboard navigation performance
    const navigationStart = Date.now();

    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(50);
    }

    const navigationTime = Date.now() - navigationStart;

    // Keyboard navigation should be responsive
    expect(navigationTime).toBeLessThan(2000);

    console.log('Accessibility performance:', {
      loadTime: loadTimeWithA11y + 'ms',
      navigationTime: navigationTime + 'ms'
    });
  });
});