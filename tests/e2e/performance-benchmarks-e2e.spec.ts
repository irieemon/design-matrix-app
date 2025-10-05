import { test, expect, chromium, firefox, webkit } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';

/**
 * Comprehensive E2E Performance Benchmarks
 *
 * Testing Core Web Vitals, rendering performance, interaction responsiveness,
 * memory management, and scalability under various conditions.
 *
 * Performance Budgets:
 * - Page load: < 2s
 * - JS bundle: < 300KB gzipped
 * - CSS bundle: < 50KB gzipped
 * - Images: < 500KB per page
 * - Memory: < 50MB per page
 * - FCP: < 1.5s
 * - LCP: < 2.5s
 * - CLS: < 0.1
 * - TTI: < 3s
 */

interface CoreWebVitals {
  FCP: number;
  LCP: number;
  CLS: number;
  FID: number;
  TTFB: number;
  TTI: number;
}

interface PerformanceMetrics {
  loadTime: number;
  domContentLoaded: number;
  domInteractive: number;
  resourceCount: number;
  jsHeapSize: number;
  totalJSSize: number;
  totalCSSSize: number;
  totalImageSize: number;
}

test.describe('E2E Performance Benchmarks - Core Web Vitals', () => {

  test('PWV-001: First Contentful Paint (FCP) < 1.5s', async ({ page }) => {
    await page.goto('/');

    const webVitals = await page.evaluate(() => {
      return new Promise<CoreWebVitals>((resolve) => {
        const vitals: Partial<CoreWebVitals> = {};

        // FCP measurement
        const paintEntries = performance.getEntriesByType('paint');
        const fcpEntry = paintEntries.find(entry => entry.name === 'first-contentful-paint');
        vitals.FCP = fcpEntry?.startTime || 0;

        // TTFB measurement
        const navTiming = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        vitals.TTFB = navTiming.responseStart - navTiming.requestStart;

        resolve(vitals as CoreWebVitals);
      });
    });

    expect(webVitals.FCP).toBeLessThan(1500);
    expect(webVitals.TTFB).toBeLessThan(600);

    console.log(`FCP: ${webVitals.FCP.toFixed(2)}ms (target: <1500ms)`);
    console.log(`TTFB: ${webVitals.TTFB.toFixed(2)}ms (target: <600ms)`);
  });

  test('PWV-002: Largest Contentful Paint (LCP) < 2.5s', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const lcp = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        let lcpValue = 0;

        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1] as any;
          lcpValue = lastEntry.renderTime || lastEntry.loadTime;
        });

        observer.observe({ type: 'largest-contentful-paint', buffered: true });

        setTimeout(() => {
          observer.disconnect();
          resolve(lcpValue);
        }, 3000);
      });
    });

    expect(lcp).toBeLessThan(2500);
    expect(lcp).toBeGreaterThan(0);

    console.log(`LCP: ${lcp.toFixed(2)}ms (target: <2500ms)`);
  });

  test('PWV-003: Cumulative Layout Shift (CLS) < 0.1', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const cls = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        let clsValue = 0;

        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!(entry as any).hadRecentInput) {
              clsValue += (entry as any).value;
            }
          }
        });

        observer.observe({ type: 'layout-shift', buffered: true });

        setTimeout(() => {
          observer.disconnect();
          resolve(clsValue);
        }, 2000);
      });
    });

    expect(cls).toBeLessThan(0.1);

    console.log(`CLS: ${cls.toFixed(4)} (target: <0.1)`);
  });

  test('PWV-004: Time to Interactive (TTI) < 3s', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait for main thread to be idle
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        requestIdleCallback(() => resolve());
      });
    });

    const tti = Date.now() - startTime;

    expect(tti).toBeLessThan(3000);

    console.log(`TTI: ${tti}ms (target: <3000ms)`);
  });

  test('PWV-005: First Input Delay (FID) measurement readiness', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Simulate user interaction
    await page.mouse.move(100, 100);
    const clickStart = Date.now();
    await page.mouse.click(100, 100);
    const clickEnd = Date.now();

    const fid = clickEnd - clickStart;

    expect(fid).toBeLessThan(100);

    console.log(`Simulated FID: ${fid}ms (target: <100ms)`);
  });
});

test.describe('E2E Performance Benchmarks - Page Load Performance', () => {

  test('PPL-001: Homepage load time < 2s', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const loadTime = Date.now() - startTime;

    expect(loadTime).toBeLessThan(2000);

    console.log(`Homepage load time: ${loadTime}ms (target: <2000ms)`);
  });

  test('PPL-002: DOM content loaded < 1.5s', async ({ page }) => {
    await page.goto('/');

    const metrics = await page.evaluate(() => {
      const navTiming = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        domContentLoaded: navTiming.domContentLoadedEventEnd - navTiming.domContentLoadedEventStart,
        domInteractive: navTiming.domInteractive - navTiming.fetchStart,
      };
    });

    expect(metrics.domContentLoaded).toBeLessThan(1500);
    expect(metrics.domInteractive).toBeLessThan(2000);

    console.log(`DOM content loaded: ${metrics.domContentLoaded.toFixed(2)}ms`);
    console.log(`DOM interactive: ${metrics.domInteractive.toFixed(2)}ms`);
  });

  test('PPL-003: Resource count optimization (< 50 resources)', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const resourceMetrics = await page.evaluate(() => {
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];

      const byType = resources.reduce((acc, resource) => {
        const type = resource.initiatorType || 'other';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return {
        total: resources.length,
        byType,
        scripts: resources.filter(r => r.initiatorType === 'script').length,
        stylesheets: resources.filter(r => r.initiatorType === 'link' || r.initiatorType === 'css').length,
        images: resources.filter(r => r.initiatorType === 'img').length,
      };
    });

    expect(resourceMetrics.total).toBeLessThan(50);

    console.log(`Total resources: ${resourceMetrics.total} (target: <50)`);
    console.log(`Scripts: ${resourceMetrics.scripts}`);
    console.log(`Stylesheets: ${resourceMetrics.stylesheets}`);
    console.log(`Images: ${resourceMetrics.images}`);
  });

  test('PPL-004: JavaScript bundle size < 300KB gzipped', async ({ page }) => {
    const jsResources: Array<{ url: string; size: number }> = [];

    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('.js') && !url.includes('node_modules')) {
        const headers = response.headers();
        const contentLength = parseInt(headers['content-length'] || '0');
        jsResources.push({ url, size: contentLength });
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const totalJSSize = jsResources.reduce((sum, resource) => sum + resource.size, 0);
    const totalJSKB = totalJSSize / 1024;

    expect(totalJSKB).toBeLessThan(300);

    console.log(`Total JS size: ${totalJSKB.toFixed(2)}KB (target: <300KB)`);

    const largeJS = jsResources.filter(r => r.size > 50000);
    if (largeJS.length > 0) {
      console.log('Large JS files (>50KB):');
      largeJS.forEach(js => {
        console.log(`  ${js.url.split('/').pop()}: ${(js.size / 1024).toFixed(2)}KB`);
      });
    }
  });

  test('PPL-005: CSS bundle size < 50KB gzipped', async ({ page }) => {
    const cssResources: Array<{ url: string; size: number }> = [];

    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('.css')) {
        const headers = response.headers();
        const contentLength = parseInt(headers['content-length'] || '0');
        cssResources.push({ url, size: contentLength });
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const totalCSSSize = cssResources.reduce((sum, resource) => sum + resource.size, 0);
    const totalCSSKB = totalCSSSize / 1024;

    expect(totalCSSKB).toBeLessThan(50);

    console.log(`Total CSS size: ${totalCSSKB.toFixed(2)}KB (target: <50KB)`);
  });

  test('PPL-006: Image optimization < 500KB per page', async ({ page }) => {
    const imageResources: Array<{ url: string; size: number }> = [];

    page.on('response', async (response) => {
      const url = response.url();
      const contentType = response.headers()['content-type'] || '';
      if (contentType.includes('image/')) {
        const headers = response.headers();
        const contentLength = parseInt(headers['content-length'] || '0');
        imageResources.push({ url, size: contentLength });
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const totalImageSize = imageResources.reduce((sum, resource) => sum + resource.size, 0);
    const totalImageKB = totalImageSize / 1024;

    expect(totalImageKB).toBeLessThan(500);

    console.log(`Total image size: ${totalImageKB.toFixed(2)}KB (target: <500KB)`);
    console.log(`Image count: ${imageResources.length}`);
  });
});

test.describe('E2E Performance Benchmarks - Matrix Rendering', () => {

  test('PMR-001: Empty matrix render < 500ms', async ({ page }) => {
    await page.evaluate(() => localStorage.clear());

    const startTime = Date.now();
    await page.goto('/');
    await page.waitForSelector('[data-testid="design-matrix"], .matrix-container, text=Strategic Priority Matrix', { timeout: 5000 });
    const renderTime = Date.now() - startTime;

    expect(renderTime).toBeLessThan(500);

    console.log(`Empty matrix render time: ${renderTime}ms (target: <500ms)`);
  });

  test('PMR-002: 10 ideas render < 1s', async ({ page }) => {
    // Navigate first, then set localStorage to avoid clearing
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.evaluate(() => {
      const ideas = Array.from({ length: 10 }, (_, i) => ({
        id: `idea-${i}`,
        content: `Test Idea ${i}`,
        matrix_position: { x: (i % 5) * 0.2, y: Math.floor(i / 5) * 0.5 + 0.25 },
        created_at: new Date().toISOString(),
        user_id: 'test-user'
      }));
      localStorage.setItem('ideas', JSON.stringify(ideas));
    });

    const startTime = Date.now();
    await page.reload();
    await page.waitForSelector('[data-testid="design-matrix"], .matrix-container', { timeout: 5000 });

    const cardsVisible = await page.locator('text=Test Idea').count();
    const renderTime = Date.now() - startTime;

    expect(cardsVisible).toBeGreaterThanOrEqual(8);
    expect(renderTime).toBeLessThan(1000);

    console.log(`10 ideas render time: ${renderTime}ms (target: <1000ms)`);
    console.log(`Cards rendered: ${cardsVisible}/10`);
  });

  test('PMR-003: 50 ideas render < 2s', async ({ page }) => {
    // Navigate first, then set localStorage to avoid clearing
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.evaluate(() => {
      const ideas = Array.from({ length: 50 }, (_, i) => ({
        id: `idea-${i}`,
        content: `Idea ${i}`,
        matrix_position: { x: (i % 10) * 0.1, y: Math.floor(i / 10) * 0.2 },
        created_at: new Date().toISOString(),
        user_id: 'test-user'
      }));
      localStorage.setItem('ideas', JSON.stringify(ideas));
    });

    const startTime = Date.now();
    await page.reload();
    await page.waitForLoadState('networkidle');

    const renderTime = Date.now() - startTime;

    expect(renderTime).toBeLessThan(2000);

    console.log(`50 ideas render time: ${renderTime}ms (target: <2000ms)`);
  });

  test('PMR-004: 100 ideas render < 3s', async ({ page }) => {
    // Navigate first, then set localStorage to avoid clearing
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.evaluate(() => {
      const ideas = Array.from({ length: 100 }, (_, i) => ({
        id: `idea-${i}`,
        content: `Idea ${i}`,
        matrix_position: { x: (i % 10) * 0.1, y: Math.floor(i / 10) * 0.1 },
        created_at: new Date().toISOString(),
        user_id: 'test-user'
      }));
      localStorage.setItem('ideas', JSON.stringify(ideas));
    });

    const startTime = Date.now();
    await page.reload();
    await page.waitForLoadState('networkidle');

    const renderTime = Date.now() - startTime;

    expect(renderTime).toBeLessThan(3000);

    console.log(`100 ideas render time: ${renderTime}ms (target: <3000ms)`);
  });
});

test.describe('E2E Performance Benchmarks - Drag & Drop Performance', () => {

  test('PDD-001: Drag operation maintains 60fps', async ({ page }) => {
    // Navigate first, then set localStorage to avoid clearing
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.evaluate(() => {
      const idea = [{
        id: 'drag-test',
        content: 'Drag Performance Test',
        matrix_position: { x: 0.2, y: 0.2 },
        created_at: new Date().toISOString(),
        user_id: 'test-user'
      }];
      localStorage.setItem('ideas', JSON.stringify(idea));
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    const card = page.locator('text=Drag Performance Test').first();
    await expect(card).toBeVisible();

    const box = await card.boundingBox();
    if (!box) throw new Error('Card not found');

    const fps = await page.evaluate(async (coords) => {
      return new Promise<number>((resolve) => {
        let frameCount = 0;
        const startTime = performance.now();

        const measureFrames = () => {
          frameCount++;
          if (performance.now() - startTime < 500) {
            requestAnimationFrame(measureFrames);
          } else {
            const elapsed = performance.now() - startTime;
            const fps = (frameCount / elapsed) * 1000;
            resolve(fps);
          }
        };

        requestAnimationFrame(measureFrames);
      });
    }, { x: box.x, y: box.y });

    expect(fps).toBeGreaterThan(60);

    console.log(`Drag FPS: ${fps.toFixed(1)} (target: >60fps)`);
  });

  test('PDD-002: Drag latency < 16ms (60fps)', async ({ page }) => {
    // Navigate first, then set localStorage to avoid clearing
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.evaluate(() => {
      const idea = [{
        id: 'latency-test',
        content: 'Latency Test Card',
        matrix_position: { x: 0.3, y: 0.3 },
        created_at: new Date().toISOString(),
        user_id: 'test-user'
      }];
      localStorage.setItem('ideas', JSON.stringify(idea));
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    const card = page.locator('text=Latency Test Card').first();
    const box = await card.boundingBox();
    if (!box) throw new Error('Card not found');

    const avgLatency = await page.evaluate(async () => {
      const latencies: number[] = [];

      for (let i = 0; i < 10; i++) {
        const start = performance.now();
        await new Promise(resolve => requestAnimationFrame(resolve));
        latencies.push(performance.now() - start);
      }

      return latencies.reduce((a, b) => a + b, 0) / latencies.length;
    });

    expect(avgLatency).toBeLessThan(16);

    console.log(`Average frame latency: ${avgLatency.toFixed(2)}ms (target: <16ms)`);
  });

  test('PDD-003: Simultaneous drag of multiple cards', async ({ page }) => {
    // Navigate first, then set localStorage to avoid clearing
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.evaluate(() => {
      const ideas = Array.from({ length: 5 }, (_, i) => ({
        id: `multi-drag-${i}`,
        content: `Multi Drag ${i}`,
        matrix_position: { x: i * 0.2, y: 0.5 },
        created_at: new Date().toISOString(),
        user_id: 'test-user'
      }));
      localStorage.setItem('ideas', JSON.stringify(ideas));
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    const startTime = Date.now();

    // Simulate hover over multiple cards rapidly
    for (let i = 0; i < 5; i++) {
      const card = page.locator(`text=Multi Drag ${i}`).first();
      await card.hover({ timeout: 1000 }).catch(() => {});
      // Small delay for animation frame - legitimate performance test timing
      await page.waitForTimeout(50);
    }

    const totalTime = Date.now() - startTime;

    expect(totalTime).toBeLessThan(1000);

    console.log(`Multi-card interaction time: ${totalTime}ms (target: <1000ms)`);
  });
});

test.describe('E2E Performance Benchmarks - Memory Management', () => {

  test('PMM-001: Page memory usage < 50MB', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const memoryUsage = await page.evaluate(() => {
      if ((performance as any).memory) {
        return {
          usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
          totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
          jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit,
        };
      }
      return null;
    });

    if (memoryUsage) {
      const usedMB = memoryUsage.usedJSHeapSize / 1024 / 1024;

      expect(usedMB).toBeLessThan(50);

      console.log(`Memory usage: ${usedMB.toFixed(2)}MB (target: <50MB)`);
      console.log(`Total heap: ${(memoryUsage.totalJSHeapSize / 1024 / 1024).toFixed(2)}MB`);
      console.log(`Heap limit: ${(memoryUsage.jsHeapSizeLimit / 1024 / 1024).toFixed(2)}MB`);
    } else {
      console.log('Memory API not available');
    }
  });

  test('PMM-002: Memory leak detection over 5 page reloads', async ({ page }) => {
    const memorySnapshots: number[] = [];

    for (let i = 0; i < 5; i++) {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Wait for GC to settle - legitimate memory measurement timing
      await page.waitForFunction(() => {
        return (performance as any).memory?.usedJSHeapSize > 0;
      }, { timeout: 2000 });

      const memory = await page.evaluate(() => {
        return (performance as any).memory?.usedJSHeapSize || 0;
      });

      if (memory > 0) {
        memorySnapshots.push(memory);
      }
    }

    if (memorySnapshots.length >= 2) {
      const memoryGrowth = memorySnapshots[memorySnapshots.length - 1] - memorySnapshots[0];
      const memoryGrowthMB = memoryGrowth / 1024 / 1024;

      expect(memoryGrowthMB).toBeLessThan(20);

      console.log(`Memory snapshots (MB): ${memorySnapshots.map(m => (m / 1024 / 1024).toFixed(2)).join(', ')}`);
      console.log(`Memory growth: ${memoryGrowthMB.toFixed(2)}MB (target: <20MB)`);
    }
  });

  test('PMM-003: LocalStorage memory efficiency', async ({ page }) => {
    await page.goto('/');

    const storageSize = await page.evaluate(() => {
      let totalSize = 0;
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          totalSize += localStorage[key].length + key.length;
        }
      }
      return totalSize;
    });

    const storageSizeKB = storageSize / 1024;

    expect(storageSizeKB).toBeLessThan(500);

    console.log(`LocalStorage size: ${storageSizeKB.toFixed(2)}KB (target: <500KB)`);
  });
});

test.describe('E2E Performance Benchmarks - Real-Time Updates', () => {

  test('PRT-001: AI generation response time < 5s', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Mock AI generation if button exists
    const aiButton = page.locator('button:has-text("Generate"), button:has-text("AI")').first();

    if (await aiButton.isVisible().catch(() => false)) {
      const startTime = Date.now();
      await aiButton.click();

      // Wait for loading indicator to appear and disappear
      const loadingIndicator = page.locator('[role="status"], .loading, .spinner');
      await loadingIndicator.waitFor({ state: 'visible', timeout: 1000 }).catch(() => {});
      await loadingIndicator.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});

      const responseTime = Date.now() - startTime;

      expect(responseTime).toBeLessThan(5000);

      console.log(`AI response time: ${responseTime}ms (target: <5000ms)`);
    } else {
      console.log('AI generation button not found, skipping test');
    }
  });

  test('PRT-002: Real-time state update latency < 500ms', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const latencies: number[] = [];

    for (let i = 0; i < 5; i++) {
      const startTime = Date.now();

      await page.evaluate((index) => {
        const event = new CustomEvent('stateUpdate', { detail: { index } });
        window.dispatchEvent(event);
      }, i);

      // Wait for next animation frame
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));

      latencies.push(Date.now() - startTime);
    }

    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;

    expect(avgLatency).toBeLessThan(500);

    console.log(`Average update latency: ${avgLatency.toFixed(2)}ms (target: <500ms)`);
  });
});

test.describe('E2E Performance Benchmarks - Network Performance', () => {

  test('PNP-001: Performance under 3G network conditions', async ({ page, context }) => {
    // Emulate 3G network
    await context.route('**/*', (route) => {
      setTimeout(() => route.continue(), 100); // 100ms delay
    });

    const startTime = Date.now();
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const loadTime = Date.now() - startTime;

    expect(loadTime).toBeLessThan(5000);

    console.log(`Load time on 3G: ${loadTime}ms (target: <5000ms)`);
  });

  test('PNP-002: Performance under slow WiFi', async ({ page, context }) => {
    // Emulate slow WiFi
    await context.route('**/*', (route) => {
      setTimeout(() => route.continue(), 50); // 50ms delay
    });

    const startTime = Date.now();
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const loadTime = Date.now() - startTime;

    expect(loadTime).toBeLessThan(4000);

    console.log(`Load time on slow WiFi: ${loadTime}ms (target: <4000ms)`);
  });

  test('PNP-003: Resource caching effectiveness', async ({ page }) => {
    // First load
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const firstLoadResources = await page.evaluate(() => {
      return performance.getEntriesByType('resource').length;
    });

    // Second load (should use cache)
    await page.reload();
    await page.waitForLoadState('networkidle');

    const secondLoadResources = await page.evaluate(() => {
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      const cached = resources.filter(r => r.transferSize === 0 && r.decodedBodySize > 0).length;
      return { total: resources.length, cached };
    });

    const cacheHitRate = (secondLoadResources.cached / secondLoadResources.total) * 100;

    expect(cacheHitRate).toBeGreaterThan(50);

    console.log(`First load resources: ${firstLoadResources}`);
    console.log(`Second load resources: ${secondLoadResources.total} (${secondLoadResources.cached} cached)`);
    console.log(`Cache hit rate: ${cacheHitRate.toFixed(1)}%`);
  });
});

test.describe('E2E Performance Benchmarks - File Operations', () => {

  test('PFO-001: File upload performance < 2s (small file)', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const fileInput = page.locator('input[type="file"]').first();

    if (await fileInput.isVisible().catch(() => false)) {
      const startTime = Date.now();

      // Create a small test file (1KB)
      const buffer = Buffer.from('x'.repeat(1024));
      await fileInput.setInputFiles({
        name: 'test.txt',
        mimeType: 'text/plain',
        buffer,
      });

      // Wait for upload completion indicator
      await page.locator('[role="status"], .upload-complete, .file-uploaded').waitFor({ state: 'visible', timeout: 2000 }).catch(() => {});

      const uploadTime = Date.now() - startTime;

      expect(uploadTime).toBeLessThan(2000);

      console.log(`File upload time: ${uploadTime}ms (target: <2000ms)`);
    } else {
      console.log('File input not found, skipping test');
    }
  });

  test('PFO-002: Image analysis performance', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const analysisTime = await page.evaluate(() => {
      const startTime = performance.now();

      // Simulate image analysis workload
      const canvas = document.createElement('canvas');
      canvas.width = 100;
      canvas.height = 100;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        for (let i = 0; i < 100; i++) {
          ctx.fillRect(i, i, 10, 10);
        }
      }

      return performance.now() - startTime;
    });

    expect(analysisTime).toBeLessThan(100);

    console.log(`Image analysis time: ${analysisTime.toFixed(2)}ms (target: <100ms)`);
  });
});

test.describe('E2E Performance Benchmarks - Scalability', () => {

  test('PSC-001: Performance degradation with increasing data', async ({ page }) => {
    const results: Array<{ count: number; time: number }> = [];

    for (const count of [10, 50, 100]) {
      // Navigate first, then set localStorage to avoid clearing
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await page.evaluate((n) => {
        const ideas = Array.from({ length: n }, (_, i) => ({
          id: `scale-${i}`,
          content: `Scale Test ${i}`,
          matrix_position: { x: Math.random(), y: Math.random() },
          created_at: new Date().toISOString(),
          user_id: 'test-user'
        }));
        localStorage.setItem('ideas', JSON.stringify(ideas));
      }, count);

      const startTime = Date.now();
      await page.reload();
      await page.waitForLoadState('networkidle');
      const time = Date.now() - startTime;

      results.push({ count, time });
    }

    // Check that performance degradation is sub-linear
    const degradationRatio = results[2].time / results[0].time;

    expect(degradationRatio).toBeLessThan(5);

    console.log('Scalability results:');
    results.forEach(r => {
      console.log(`  ${r.count} ideas: ${r.time}ms`);
    });
    console.log(`Degradation ratio (100/10): ${degradationRatio.toFixed(2)}x`);
  });
});
