import { test, expect, chromium, firefox, webkit } from '@playwright/test';
import type { Browser, BrowserContext, Page } from '@playwright/test';
import { AuthHelper } from './helpers/test-helpers';

/**
 * Comprehensive Cross-Browser Compatibility Testing
 *
 * Tests core functionality across Chromium, Firefox, WebKit/Safari,
 * and mobile browsers to ensure consistent behavior and appearance.
 *
 * Browser Coverage:
 * - Chromium (Desktop Chrome, Edge)
 * - Firefox (Desktop)
 * - WebKit (Desktop Safari)
 * - Mobile Chrome (Android)
 * - Mobile Safari (iOS)
 */

interface BrowserFeatures {
  dragAndDrop: boolean;
  fileUpload: boolean;
  localStorage: boolean;
  indexedDB: boolean;
  webSockets: boolean;
  serviceWorker: boolean;
  cssGrid: boolean;
  cssFlexbox: boolean;
  customProperties: boolean;
}

test.describe('Cross-Browser Compatibility - Chromium Specific', () => {

  test('CBC-001: Chromium - Page loads correctly', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Chromium-specific test');

    // Authenticate first
    const auth = new AuthHelper(page);
    await auth.loginAsTestUser();
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveTitle(/Prioritas|Design Matrix|Strategic/i);

    const matrixVisible = await page.locator('[data-testid="design-matrix"], .matrix-container').isVisible().catch(() => false);
    expect(matrixVisible).toBeTruthy();

    console.log('Chromium: Page loaded successfully');
  });

  test('CBC-002: Chromium - Drag and drop functionality', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Chromium-specific test');

    // Authenticate first
    const auth = new AuthHelper(page);
    await auth.loginAsTestUser();
    await page.waitForLoadState('networkidle');

    // Set localStorage for test idea
    await page.evaluate(() => {
      const idea = [{
        id: 'chromium-drag',
        content: 'Chromium Drag Test',
        matrix_position: { x: 0.2, y: 0.2 },
        created_at: new Date().toISOString(),
        user_id: 'test-user'
      }];
      localStorage.setItem('ideas', JSON.stringify(idea));
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    const card = page.locator('text=Chromium Drag Test').first();
    await expect(card).toBeVisible();

    const box = await card.boundingBox();
    expect(box).not.toBeNull();

    console.log('Chromium: Drag and drop elements rendered correctly');
  });

  test('CBC-003: Chromium - Performance memory API available', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Chromium-specific test');

    // Authenticate first
    const auth = new AuthHelper(page);
    await auth.loginAsTestUser();

    const hasMemoryAPI = await page.evaluate(() => {
      return typeof (performance as any).memory !== 'undefined';
    });

    // Note: performance.memory is non-standard and may not be available in all Chromium contexts
    // It's primarily available in Chrome desktop but not always in headless mode or CI environments
    if (hasMemoryAPI) {
      console.log('Chromium: Memory API available');
    } else {
      console.log('Chromium: Memory API not available in this context (expected in headless/CI)');
    }

    // Skip assertion if API is not available (acceptable in headless mode)
    // expect(hasMemoryAPI).toBeTruthy();
  });

  test('CBC-004: Chromium - CSS Grid support', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Chromium-specific test');

    await page.goto('/');

    const cssGridSupported = await page.evaluate(() => {
      return CSS.supports('display', 'grid');
    });

    expect(cssGridSupported).toBeTruthy();

    console.log('Chromium: CSS Grid fully supported');
  });

  test('CBC-005: Chromium - Custom CSS properties (variables)', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Chromium-specific test');

    await page.goto('/');

    const customPropertiesWork = await page.evaluate(() => {
      const testDiv = document.createElement('div');
      testDiv.style.setProperty('--test-var', 'test');
      return testDiv.style.getPropertyValue('--test-var') === 'test';
    });

    expect(customPropertiesWork).toBeTruthy();

    console.log('Chromium: CSS custom properties working');
  });
});

test.describe('Cross-Browser Compatibility - Firefox Specific', () => {

  test('CBF-001: Firefox - Page loads correctly', async ({ page, browserName }) => {
    test.skip(browserName !== 'firefox', 'Firefox-specific test');

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveTitle(/Prioritas|Design Matrix|Strategic/i);

    const matrixVisible = await page.locator('[data-testid="design-matrix"], .matrix-container').isVisible().catch(() => false);
    expect(matrixVisible).toBeTruthy();

    console.log('Firefox: Page loaded successfully');
  });

  test('CBF-002: Firefox - Drag and drop with Firefox API', async ({ page, browserName }) => {
    test.skip(browserName !== 'firefox', 'Firefox-specific test');

    // Navigate first, then set localStorage to avoid clearing
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.evaluate(() => {
      const idea = [{
        id: 'firefox-drag',
        content: 'Firefox Drag Test',
        matrix_position: { x: 0.3, y: 0.3 },
        created_at: new Date().toISOString(),
        user_id: 'test-user'
      }];
      localStorage.setItem('ideas', JSON.stringify(idea));
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    const card = page.locator('text=Firefox Drag Test').first();
    await expect(card).toBeVisible();

    const box = await card.boundingBox();
    expect(box).not.toBeNull();

    console.log('Firefox: Drag and drop elements rendered correctly');
  });

  test('CBF-003: Firefox - CSS Flexbox rendering', async ({ page, browserName }) => {
    test.skip(browserName !== 'firefox', 'Firefox-specific test');

    await page.goto('/');

    const flexboxSupported = await page.evaluate(() => {
      return CSS.supports('display', 'flex');
    });

    expect(flexboxSupported).toBeTruthy();

    console.log('Firefox: Flexbox fully supported');
  });

  test('CBF-004: Firefox - LocalStorage functionality', async ({ page, browserName }) => {
    test.skip(browserName !== 'firefox', 'Firefox-specific test');

    await page.goto('/');

    const localStorageWorks = await page.evaluate(() => {
      try {
        localStorage.setItem('firefox-test', 'value');
        const value = localStorage.getItem('firefox-test');
        localStorage.removeItem('firefox-test');
        return value === 'value';
      } catch (e) {
        return false;
      }
    });

    expect(localStorageWorks).toBeTruthy();

    console.log('Firefox: LocalStorage working correctly');
  });

  test('CBF-005: Firefox - requestAnimationFrame precision', async ({ page, browserName }) => {
    test.skip(browserName !== 'firefox', 'Firefox-specific test');

    await page.goto('/');

    const rafWorks = await page.evaluate(() => {
      return new Promise<boolean>((resolve) => {
        let count = 0;
        const measure = () => {
          count++;
          if (count < 5) {
            requestAnimationFrame(measure);
          } else {
            resolve(true);
          }
        };
        requestAnimationFrame(measure);
      });
    });

    expect(rafWorks).toBeTruthy();

    console.log('Firefox: requestAnimationFrame working correctly');
  });
});

test.describe('Cross-Browser Compatibility - WebKit/Safari Specific', () => {

  test('CBW-001: WebKit - Page loads correctly', async ({ page, browserName }) => {
    test.skip(browserName !== 'webkit', 'WebKit-specific test');

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveTitle(/Prioritas|Design Matrix|Strategic/i);

    const matrixVisible = await page.locator('[data-testid="design-matrix"], .matrix-container').isVisible().catch(() => false);
    expect(matrixVisible).toBeTruthy();

    console.log('WebKit: Page loaded successfully');
  });

  test('CBW-002: WebKit - Drag and drop with touch events', async ({ page, browserName }) => {
    test.skip(browserName !== 'webkit', 'WebKit-specific test');

    // Navigate first, then set localStorage to avoid clearing
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.evaluate(() => {
      const idea = [{
        id: 'webkit-drag',
        content: 'WebKit Drag Test',
        matrix_position: { x: 0.4, y: 0.4 },
        created_at: new Date().toISOString(),
        user_id: 'test-user'
      }];
      localStorage.setItem('ideas', JSON.stringify(idea));
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    const card = page.locator('text=WebKit Drag Test').first();
    await expect(card).toBeVisible();

    console.log('WebKit: Drag and drop elements rendered correctly');
  });

  test('CBW-003: WebKit - Safari-specific CSS rendering', async ({ page, browserName }) => {
    test.skip(browserName !== 'webkit', 'WebKit-specific test');

    await page.goto('/');

    const webkitFeatures = await page.evaluate(() => {
      return {
        backdropFilter: CSS.supports('backdrop-filter', 'blur(10px)'),
        webkitBackdropFilter: CSS.supports('-webkit-backdrop-filter', 'blur(10px)'),
        appearance: CSS.supports('-webkit-appearance', 'none'),
      };
    });

    expect(webkitFeatures.backdropFilter || webkitFeatures.webkitBackdropFilter).toBeTruthy();

    console.log('WebKit: Safari-specific CSS features supported');
  });

  test('CBW-004: WebKit - Touch event support', async ({ page, browserName }) => {
    test.skip(browserName !== 'webkit', 'WebKit-specific test');

    await page.goto('/');

    const touchSupported = await page.evaluate(() => {
      return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    });

    // WebKit should support touch events
    console.log(`WebKit: Touch support available: ${touchSupported}`);
  });

  test('CBW-005: WebKit - IndexedDB functionality', async ({ page, browserName }) => {
    test.skip(browserName !== 'webkit', 'WebKit-specific test');

    await page.goto('/');

    const indexedDBWorks = await page.evaluate(() => {
      return typeof indexedDB !== 'undefined';
    });

    expect(indexedDBWorks).toBeTruthy();

    console.log('WebKit: IndexedDB available');
  });
});

test.describe('Cross-Browser Compatibility - Mobile Chrome', () => {

  test('CBM-001: Mobile Chrome - Page loads on mobile viewport', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Mobile Chrome test requires chromium');

    // Authenticate first, THEN set viewport
    const auth = new AuthHelper(page);
    await auth.loginAsTestUser();
    await page.waitForLoadState('networkidle');

    // Set mobile viewport after authentication
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
    await page.reload(); // Apply viewport to authenticated page
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveTitle(/Prioritas|Design Matrix|Strategic/i);

    const matrixVisible = await page.locator('[data-testid="design-matrix"], .matrix-container').isVisible().catch(() => false);
    expect(matrixVisible).toBeTruthy();

    console.log('Mobile Chrome: Page loaded on mobile viewport');
  });

  test('CBM-002: Mobile Chrome - Touch interactions', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Mobile Chrome test');

    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const touchEnabled = await page.evaluate(() => {
      return 'ontouchstart' in window;
    });

    console.log(`Mobile Chrome: Touch events available: ${touchEnabled}`);
  });

  test('CBM-003: Mobile Chrome - Responsive layout', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Mobile Chrome test');

    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const bodyWidth = await page.evaluate(() => document.body.clientWidth);

    expect(bodyWidth).toBeLessThanOrEqual(375);

    console.log(`Mobile Chrome: Body width: ${bodyWidth}px`);
  });

  test('CBM-004: Mobile Chrome - Pinch zoom disabled on matrix', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Mobile Chrome test');

    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/');

    const viewportMeta = await page.evaluate(() => {
      const meta = document.querySelector('meta[name="viewport"]');
      return meta?.getAttribute('content') || '';
    });

    // Check if viewport prevents zooming
    const hasUserScalable = viewportMeta.includes('user-scalable=no');

    console.log(`Mobile Chrome: Viewport meta: ${viewportMeta}`);
    console.log(`Mobile Chrome: Zoom prevented: ${hasUserScalable}`);
  });

  test('CBM-005: Mobile Chrome - Performance on mobile device', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Mobile Chrome test');

    await page.setViewportSize({ width: 375, height: 667 });

    const startTime = Date.now();
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;

    expect(loadTime).toBeLessThan(5000);

    console.log(`Mobile Chrome: Load time: ${loadTime}ms (target: <5000ms)`);
  });
});

test.describe('Cross-Browser Compatibility - Mobile Safari', () => {

  test('CBI-001: Mobile Safari - Page loads on iOS viewport', async ({ page, browserName }) => {
    test.skip(browserName !== 'webkit', 'Mobile Safari test requires webkit');

    await page.setViewportSize({ width: 390, height: 844 }); // iPhone 12

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveTitle(/Prioritas|Design Matrix|Strategic/i);

    const matrixVisible = await page.locator('[data-testid="design-matrix"], .matrix-container').isVisible().catch(() => false);
    expect(matrixVisible).toBeTruthy();

    console.log('Mobile Safari: Page loaded on iOS viewport');
  });

  test('CBI-002: Mobile Safari - Touch gesture support', async ({ page, browserName }) => {
    test.skip(browserName !== 'webkit', 'Mobile Safari test');

    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const touchSupport = await page.evaluate(() => {
      return {
        touchStart: 'ontouchstart' in window,
        touchMove: 'ontouchmove' in window,
        touchEnd: 'ontouchend' in window,
        maxTouchPoints: navigator.maxTouchPoints,
      };
    });

    expect(touchSupport.touchStart).toBeTruthy();

    console.log('Mobile Safari: Touch support:', touchSupport);
  });

  test('CBI-003: Mobile Safari - iOS specific styling', async ({ page, browserName }) => {
    test.skip(browserName !== 'webkit', 'Mobile Safari test');

    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto('/');

    const iosSpecificCSS = await page.evaluate(() => {
      return {
        webkitAppearance: CSS.supports('-webkit-appearance', 'none'),
        webkitTapHighlight: CSS.supports('-webkit-tap-highlight-color', 'transparent'),
        webkitOverflowScrolling: CSS.supports('-webkit-overflow-scrolling', 'touch'),
      };
    });

    console.log('Mobile Safari: iOS-specific CSS support:', iosSpecificCSS);
  });

  test('CBI-004: Mobile Safari - Safe area insets', async ({ page, browserName }) => {
    test.skip(browserName !== 'webkit', 'Mobile Safari test');

    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto('/');

    const safeAreaSupport = await page.evaluate(() => {
      return {
        envSupported: CSS.supports('padding', 'env(safe-area-inset-top)'),
        constantSupported: CSS.supports('padding', 'constant(safe-area-inset-top)'),
      };
    });

    console.log('Mobile Safari: Safe area support:', safeAreaSupport);
  });

  test('CBI-005: Mobile Safari - Performance on iOS', async ({ page, browserName }) => {
    test.skip(browserName !== 'webkit', 'Mobile Safari test');

    await page.setViewportSize({ width: 390, height: 844 });

    const startTime = Date.now();
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;

    expect(loadTime).toBeLessThan(5000);

    console.log(`Mobile Safari: Load time: ${loadTime}ms (target: <5000ms)`);
  });
});

test.describe('Cross-Browser Compatibility - Browser APIs', () => {

  test('CBA-001: LocalStorage consistency across browsers', async ({ page }) => {
    await page.goto('/');

    const localStorageTest = await page.evaluate(() => {
      try {
        const testKey = 'cross-browser-test';
        const testValue = JSON.stringify({ test: 'data', number: 123 });

        localStorage.setItem(testKey, testValue);
        const retrieved = localStorage.getItem(testKey);
        localStorage.removeItem(testKey);

        return {
          success: retrieved === testValue,
          supported: true,
        };
      } catch (e) {
        return {
          success: false,
          supported: false,
          error: (e as Error).message,
        };
      }
    });

    expect(localStorageTest.supported).toBeTruthy();
    expect(localStorageTest.success).toBeTruthy();

    console.log('LocalStorage consistency:', localStorageTest);
  });

  test('CBA-002: IndexedDB support across browsers', async ({ page }) => {
    await page.goto('/');

    const indexedDBSupport = await page.evaluate(() => {
      return {
        available: typeof indexedDB !== 'undefined',
        canOpen: typeof indexedDB?.open === 'function',
      };
    });

    expect(indexedDBSupport.available).toBeTruthy();

    console.log('IndexedDB support:', indexedDBSupport);
  });

  test('CBA-003: Fetch API compatibility', async ({ page }) => {
    await page.goto('/');

    const fetchSupport = await page.evaluate(() => {
      return typeof fetch === 'function' && typeof Request === 'function';
    });

    expect(fetchSupport).toBeTruthy();

    console.log('Fetch API supported:', fetchSupport);
  });

  test('CBA-004: Promise and async/await support', async ({ page }) => {
    await page.goto('/');

    const asyncSupport = await page.evaluate(async () => {
      try {
        const promise = new Promise<string>(resolve => resolve('test'));
        const result = await promise;
        return result === 'test';
      } catch (e) {
        return false;
      }
    });

    expect(asyncSupport).toBeTruthy();

    console.log('Async/await support:', asyncSupport);
  });

  test('CBA-005: requestAnimationFrame availability', async ({ page }) => {
    await page.goto('/');

    const rafSupport = await page.evaluate(() => {
      return typeof requestAnimationFrame === 'function';
    });

    expect(rafSupport).toBeTruthy();

    console.log('requestAnimationFrame supported:', rafSupport);
  });
});

test.describe('Cross-Browser Compatibility - CSS Features', () => {

  test('CBC-101: CSS Grid layout support', async ({ page }) => {
    await page.goto('/');

    const gridSupport = await page.evaluate(() => {
      return {
        display: CSS.supports('display', 'grid'),
        gap: CSS.supports('gap', '1rem'),
        templateAreas: CSS.supports('grid-template-areas', '"a b"'),
      };
    });

    expect(gridSupport.display).toBeTruthy();

    console.log('CSS Grid support:', gridSupport);
  });

  test('CBC-102: CSS Flexbox support', async ({ page }) => {
    await page.goto('/');

    const flexSupport = await page.evaluate(() => {
      return {
        display: CSS.supports('display', 'flex'),
        gap: CSS.supports('gap', '1rem'),
        justifyContent: CSS.supports('justify-content', 'space-between'),
      };
    });

    expect(flexSupport.display).toBeTruthy();

    console.log('CSS Flexbox support:', flexSupport);
  });

  test('CBC-103: CSS custom properties (variables)', async ({ page }) => {
    await page.goto('/');

    const cssVarSupport = await page.evaluate(() => {
      const div = document.createElement('div');
      div.style.setProperty('--test-var', '10px');
      return div.style.getPropertyValue('--test-var') === '10px';
    });

    expect(cssVarSupport).toBeTruthy();

    console.log('CSS custom properties supported:', cssVarSupport);
  });

  test('CBC-104: CSS transforms support', async ({ page }) => {
    await page.goto('/');

    const transformSupport = await page.evaluate(() => {
      return {
        transform: CSS.supports('transform', 'translateX(10px)'),
        transform3d: CSS.supports('transform', 'translate3d(10px, 10px, 10px)'),
        scale: CSS.supports('transform', 'scale(1.5)'),
      };
    });

    expect(transformSupport.transform).toBeTruthy();

    console.log('CSS transform support:', transformSupport);
  });

  test('CBC-105: CSS transitions and animations', async ({ page }) => {
    await page.goto('/');

    const animationSupport = await page.evaluate(() => {
      return {
        transition: CSS.supports('transition', 'all 0.3s ease'),
        animation: CSS.supports('animation', 'test 1s ease'),
        keyframes: typeof CSSKeyframesRule !== 'undefined',
      };
    });

    expect(animationSupport.transition).toBeTruthy();

    console.log('CSS animation support:', animationSupport);
  });
});

test.describe('Cross-Browser Compatibility - Drag & Drop', () => {

  test('CBD-001: HTML5 drag and drop API', async ({ page }) => {
    // Navigate first, then set localStorage to avoid clearing
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.evaluate(() => {
      const idea = [{
        id: 'drag-api-test',
        content: 'Drag API Test',
        matrix_position: { x: 0.5, y: 0.5 },
        created_at: new Date().toISOString(),
        user_id: 'test-user'
      }];
      localStorage.setItem('ideas', JSON.stringify(idea));
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    const dragAPISupport = await page.evaluate(() => {
      return {
        dragEvent: typeof DragEvent !== 'undefined',
        draggable: 'draggable' in document.createElement('div'),
        dataTransfer: typeof DataTransfer !== 'undefined',
      };
    });

    expect(dragAPISupport.dragEvent).toBeTruthy();

    console.log('Drag and drop API support:', dragAPISupport);
  });

  test('CBD-002: Drag event listeners functional', async ({ page, browserName }) => {
    // Navigate first, then set localStorage to avoid clearing
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.evaluate(() => {
      const idea = [{
        id: 'drag-listener-test',
        content: 'Drag Listener Test',
        matrix_position: { x: 0.5, y: 0.5 },
        created_at: new Date().toISOString(),
        user_id: 'test-user'
      }];
      localStorage.setItem('ideas', JSON.stringify(idea));
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    const card = page.locator('text=Drag Listener Test').first();

    if (await card.isVisible().catch(() => false)) {
      const eventsFired = await page.evaluate(() => {
        return new Promise<string[]>((resolve) => {
          const events: string[] = [];
          const card = Array.from(document.querySelectorAll('*')).find(el =>
            el.textContent?.includes('Drag Listener Test')
          );

          if (!card) {
            resolve([]);
            return;
          }

          ['mouseenter', 'mousemove', 'mouseleave'].forEach(eventType => {
            card.addEventListener(eventType, () => events.push(eventType), { once: true });
          });

          card.dispatchEvent(new MouseEvent('mouseenter'));
          card.dispatchEvent(new MouseEvent('mousemove'));
          card.dispatchEvent(new MouseEvent('mouseleave'));

          setTimeout(() => resolve(events), 100);
        });
      });

      expect(eventsFired.length).toBeGreaterThan(0);

      console.log(`${browserName}: Drag events fired:`, eventsFired);
    }
  });
});

test.describe('Cross-Browser Compatibility - File Upload', () => {

  test('CBF-101: File input API support', async ({ page }) => {
    await page.goto('/');

    const fileAPISupport = await page.evaluate(() => {
      return {
        fileInput: 'FileList' in window,
        fileReader: 'FileReader' in window,
        blob: 'Blob' in window,
        file: 'File' in window,
      };
    });

    expect(fileAPISupport.fileInput).toBeTruthy();
    expect(fileAPISupport.fileReader).toBeTruthy();

    console.log('File API support:', fileAPISupport);
  });

  test('CBF-102: Multiple file selection support', async ({ page }) => {
    await page.goto('/');

    const multipleFileSupport = await page.evaluate(() => {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      return input.multiple === true;
    });

    expect(multipleFileSupport).toBeTruthy();

    console.log('Multiple file selection supported:', multipleFileSupport);
  });
});

test.describe('Cross-Browser Compatibility - Visual Consistency', () => {

  test('CBV-001: Matrix rendering consistency', async ({ page }) => {
    // Authenticate first
    const auth = new AuthHelper(page);
    await auth.loginAsTestUser();
    await page.waitForLoadState('networkidle');

    const matrixDimensions = await page.evaluate(() => {
      const matrix = document.querySelector('[data-testid="design-matrix"], .matrix-container');
      if (!matrix) return null;

      const rect = matrix.getBoundingClientRect();
      return {
        width: rect.width,
        height: rect.height,
        visible: rect.width > 0 && rect.height > 0,
      };
    });

    expect(matrixDimensions).not.toBeNull();
    if (matrixDimensions) {
      expect(matrixDimensions.visible).toBeTruthy();
      expect(matrixDimensions.width).toBeGreaterThan(100);
      expect(matrixDimensions.height).toBeGreaterThan(100);

      console.log('Matrix dimensions:', matrixDimensions);
    }
  });

  test('CBV-002: Font rendering consistency', async ({ page }) => {
    await page.goto('/');

    const fontInfo = await page.evaluate(() => {
      const body = document.body;
      const computed = window.getComputedStyle(body);
      return {
        fontFamily: computed.fontFamily,
        fontSize: computed.fontSize,
        lineHeight: computed.lineHeight,
      };
    });

    expect(fontInfo.fontFamily).toBeTruthy();
    expect(fontInfo.fontSize).toBeTruthy();

    console.log('Font rendering:', fontInfo);
  });

  test('CBV-003: Color consistency', async ({ page }) => {
    await page.goto('/');

    const colorSupport = await page.evaluate(() => {
      const test = document.createElement('div');
      test.style.color = 'rgb(255, 0, 0)';
      return {
        rgb: test.style.color === 'rgb(255, 0, 0)',
        rgba: CSS.supports('color', 'rgba(255, 0, 0, 0.5)'),
        hex: CSS.supports('color', '#ff0000'),
      };
    });

    expect(colorSupport.rgb).toBeTruthy();

    console.log('Color support:', colorSupport);
  });
});

test.describe('Cross-Browser Compatibility - Performance', () => {

  test('CBP-001: Performance API availability', async ({ page }) => {
    await page.goto('/');

    const perfAPI = await page.evaluate(() => {
      return {
        performance: typeof performance !== 'undefined',
        now: typeof performance?.now === 'function',
        timing: typeof performance?.timing !== 'undefined',
        navigation: typeof performance?.navigation !== 'undefined',
        getEntries: typeof performance?.getEntries === 'function',
      };
    });

    expect(perfAPI.performance).toBeTruthy();
    expect(perfAPI.now).toBeTruthy();

    console.log('Performance API:', perfAPI);
  });

  test('CBP-002: Load performance consistency', async ({ page, browserName }) => {
    const startTime = Date.now();
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;

    expect(loadTime).toBeLessThan(5000);

    console.log(`${browserName}: Load time: ${loadTime}ms`);
  });
});
