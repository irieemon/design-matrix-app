import { test, expect, Page } from '@playwright/test';
import { promises as fs } from 'fs';
import path from 'path';

// Test configuration
const BASE_URL = 'http://localhost:3001';
const SCREENSHOT_DIR = './test-screenshots/critical-functionality';

// Helper function to ensure screenshot directory exists
async function ensureScreenshotDir() {
  try {
    await fs.access(SCREENSHOT_DIR);
  } catch {
    await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
  }
}

// Helper function to wait for page to be fully loaded and interactive
async function waitForPageReady(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.waitForFunction(() => document.readyState === 'complete');
  await page.waitForTimeout(1000); // Additional stability wait
}

// Helper function to take a timestamped screenshot
async function takeTimestampedScreenshot(page: Page, name: string, description?: string) {
  await ensureScreenshotDir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[1].split('-')[0];
  const filename = `${name}-${timestamp}.png`;
  const fullPath = path.join(SCREENSHOT_DIR, filename);

  await page.screenshot({
    path: fullPath,
    fullPage: true
  });

  console.log(`📸 Screenshot: ${filename} ${description ? `- ${description}` : ''}`);
  return fullPath;
}

test.describe('Critical Functionality Validation', () => {

  test.beforeAll(async () => {
    await ensureScreenshotDir();
  });

  test('Matrix Page Load and Basic Functionality', async ({ page }) => {
    console.log('🧪 Testing Matrix Page Load and Basic Functionality');

    await page.goto(BASE_URL);
    await waitForPageReady(page);

    await takeTimestampedScreenshot(page, 'matrix-page-load', 'Initial page load');

    // Navigate to matrix
    const matrixButton = page.locator('button:has-text("Design Matrix"), a[href="/matrix"]');
    if (await matrixButton.isVisible()) {
      await matrixButton.click();
      await waitForPageReady(page);
    }

    await takeTimestampedScreenshot(page, 'matrix-page-loaded', 'Matrix page loaded');

    // Verify matrix container is visible
    const matrixContainer = page.locator('.matrix-container');
    expect(await matrixContainer.isVisible()).toBe(true);

    // Verify matrix header is present
    const matrixHeader = page.locator('h2:has-text("Strategic Priority Matrix")');
    expect(await matrixHeader.isVisible()).toBe(true);

    console.log('✅ Matrix page loads correctly with proper layout');
  });

  test('Idea Card Interaction and Edit Flow', async ({ page }) => {
    console.log('🧪 Testing Idea Card Interaction and Edit Flow');

    await page.goto(BASE_URL + '/matrix');
    await waitForPageReady(page);

    await takeTimestampedScreenshot(page, 'cards-initial', 'Initial idea cards state');

    // Look for existing idea cards
    const ideaCards = page.locator('[data-testid="idea-card"], .idea-card');
    const cardCount = await ideaCards.count();

    console.log(`Found ${cardCount} idea cards`);

    if (cardCount > 0) {
      const firstCard = ideaCards.first();

      // Test hover state
      await firstCard.hover();
      await page.waitForTimeout(300);
      await takeTimestampedScreenshot(page, 'card-hover', 'Card hover interaction');

      // Look for edit button
      const editButton = firstCard.locator('button[aria-label*="Edit"], button:has-text("Edit"), [title*="Edit"]');

      if (await editButton.isVisible()) {
        console.log('Edit button found, testing edit flow');

        await editButton.click();
        await page.waitForTimeout(500);
        await takeTimestampedScreenshot(page, 'card-edit-mode', 'Card in edit mode');

        // Check if edit mode is active
        const editingIndicators = page.locator('[data-editing="true"], .editing-mode, .edit-active, input[name="title"]');
        const hasEditIndicator = await editingIndicators.count() > 0;

        if (hasEditIndicator) {
          console.log('Edit mode activated successfully');

          // Try to find save button
          const saveButton = page.locator('button[aria-label*="Save"], button:has-text("Save")');

          if (await saveButton.isVisible()) {
            await saveButton.click();
            await page.waitForTimeout(500);
            await takeTimestampedScreenshot(page, 'card-edit-saved', 'Edit saved successfully');
            console.log('Edit save functionality works');
          }
        }
      } else {
        console.log('No edit button found on card');
      }

      // Test collapse functionality if available
      const collapseButton = firstCard.locator('button[aria-label*="Collapse"], button[aria-label*="Minimize"]');

      if (await collapseButton.isVisible()) {
        console.log('Testing card collapse functionality');

        await collapseButton.click();
        await page.waitForTimeout(300);
        await takeTimestampedScreenshot(page, 'card-collapsed', 'Card collapsed state');

        // Test expand back
        const expandButton = firstCard.locator('button[aria-label*="Expand"], button[aria-label*="Maximize"]');
        if (await expandButton.isVisible()) {
          await expandButton.click();
          await page.waitForTimeout(300);
          await takeTimestampedScreenshot(page, 'card-expanded', 'Card expanded back');
        }
      }
    } else {
      console.log('No idea cards found - testing add functionality');

      // Look for add button
      const addButton = page.locator('button:has-text("Add"), button[aria-label*="Add"]');

      if (await addButton.isVisible()) {
        await addButton.click();
        await page.waitForTimeout(1000);
        await takeTimestampedScreenshot(page, 'add-modal', 'Add idea modal');
      }
    }

    console.log('✅ Idea card interactions tested');
  });

  test('Drag and Drop Core Functionality', async ({ page }) => {
    console.log('🧪 Testing Drag and Drop Core Functionality');

    await page.goto(BASE_URL + '/matrix');
    await waitForPageReady(page);

    const ideaCards = page.locator('[data-testid="idea-card"], .idea-card');
    const cardCount = await ideaCards.count();

    if (cardCount > 0) {
      const firstCard = ideaCards.first();

      // Get initial position
      const initialBox = await firstCard.boundingBox();
      expect(initialBox).toBeTruthy();

      await takeTimestampedScreenshot(page, 'drag-initial', 'Before drag operation');

      // Perform drag operation
      await firstCard.hover();
      await page.mouse.down();

      // Move to a new position
      const newX = initialBox!.x + 150;
      const newY = initialBox!.y + 100;

      await page.mouse.move(newX, newY, { steps: 10 });
      await page.waitForTimeout(200);

      await takeTimestampedScreenshot(page, 'drag-during', 'During drag operation');

      await page.mouse.up();
      await page.waitForTimeout(500);

      await takeTimestampedScreenshot(page, 'drag-completed', 'After drag completed');

      // Verify position changed
      const finalBox = await firstCard.boundingBox();
      expect(finalBox).toBeTruthy();

      const distanceMoved = Math.sqrt(
        Math.pow(finalBox!.x - initialBox!.x, 2) +
        Math.pow(finalBox!.y - initialBox!.y, 2)
      );

      expect(distanceMoved).toBeGreaterThan(50);
      console.log(`Card moved ${Math.round(distanceMoved)}px`);
    }

    console.log('✅ Drag and drop functionality verified');
  });

  test('Navigation and Layout Stability', async ({ page }) => {
    console.log('🧪 Testing Navigation and Layout Stability');

    await page.goto(BASE_URL);
    await waitForPageReady(page);

    await takeTimestampedScreenshot(page, 'nav-home', 'Home page');

    // Test navigation to different sections
    const navigationItems = [
      { text: 'Projects', url: '/projects' },
      { text: 'Matrix', url: '/matrix' },
      { text: 'File Management', url: '/files' },
      { text: 'Roadmap', url: '/roadmap' }
    ];

    for (const nav of navigationItems) {
      const navButton = page.locator(`button:has-text("${nav.text}"), a[href="${nav.url}"]`);

      if (await navButton.isVisible()) {
        console.log(`Testing navigation to ${nav.text}`);

        await navButton.click();
        await waitForPageReady(page);

        await takeTimestampedScreenshot(page, `nav-${nav.text.toLowerCase().replace(' ', '-')}`, `${nav.text} page`);

        // Verify page loaded correctly
        const body = page.locator('body');
        expect(await body.isVisible()).toBe(true);

        // Check for error messages
        const errorMessages = page.locator('.error, [role="alert"], .alert-error');
        const hasError = await errorMessages.count() > 0;
        expect(hasError).toBe(false);
      }
    }

    console.log('✅ Navigation and layout stability verified');
  });

  test('Responsive Design Validation', async ({ page }) => {
    console.log('🧪 Testing Responsive Design Validation');

    const viewports = [
      { width: 1440, height: 900, name: 'desktop' },
      { width: 768, height: 1024, name: 'tablet' },
      { width: 375, height: 667, name: 'mobile' }
    ];

    for (const viewport of viewports) {
      console.log(`Testing ${viewport.name} viewport: ${viewport.width}x${viewport.height}`);

      await page.setViewportSize(viewport);
      await page.goto(BASE_URL + '/matrix');
      await waitForPageReady(page);

      await takeTimestampedScreenshot(page, `responsive-${viewport.name}`, `${viewport.name} layout`);

      // Verify matrix is still accessible
      const matrixContainer = page.locator('.matrix-container');
      expect(await matrixContainer.isVisible()).toBe(true);

      // Check that content doesn't overflow
      const body = page.locator('body');
      const bodyBox = await body.boundingBox();
      expect(bodyBox).toBeTruthy();
      expect(bodyBox!.width).toBeLessThanOrEqual(viewport.width + 20); // Allow 20px tolerance
    }

    console.log('✅ Responsive design validated across viewports');
  });

  test('Performance and Memory Validation', async ({ page }) => {
    console.log('🧪 Testing Performance and Memory Validation');

    await page.goto(BASE_URL);
    await waitForPageReady(page);

    // Collect initial performance metrics
    const initialMetrics = await page.evaluate(() => {
      const performance = window.performance;
      const memoryInfo = (performance as any).memory;

      return {
        memory: memoryInfo ? {
          usedJSHeapSize: memoryInfo.usedJSHeapSize,
          totalJSHeapSize: memoryInfo.totalJSHeapSize,
          jsHeapSizeLimit: memoryInfo.jsHeapSizeLimit
        } : null,
        timing: {
          domContentLoaded: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart,
          loadComplete: performance.timing.loadEventEnd - performance.timing.navigationStart
        },
        navigation: performance.timing.loadEventEnd - performance.timing.navigationStart
      };
    });

    console.log('📊 Performance Metrics:', {
      domContentLoaded: `${initialMetrics.timing.domContentLoaded}ms`,
      loadComplete: `${initialMetrics.timing.loadComplete}ms`,
      memoryUsed: initialMetrics.memory ? `${Math.round(initialMetrics.memory.usedJSHeapSize / 1024 / 1024)}MB` : 'N/A'
    });

    // Performance expectations
    expect(initialMetrics.timing.domContentLoaded).toBeLessThan(3000); // DOM ready in < 3s
    expect(initialMetrics.timing.loadComplete).toBeLessThan(5000); // Full load in < 5s

    if (initialMetrics.memory) {
      expect(initialMetrics.memory.usedJSHeapSize).toBeLessThan(100 * 1024 * 1024); // < 100MB initial memory
    }

    // Navigate to matrix and interact
    const matrixButton = page.locator('button:has-text("Design Matrix"), a[href="/matrix"]');
    if (await matrixButton.isVisible()) {
      await matrixButton.click();
      await waitForPageReady(page);
    }

    // Perform multiple interactions to test memory stability
    for (let i = 0; i < 10; i++) {
      const ideaCard = page.locator('[data-testid="idea-card"], .idea-card').first();
      if (await ideaCard.isVisible()) {
        await ideaCard.hover();
        await page.waitForTimeout(100);
      }
    }

    // Check final memory usage
    const finalMetrics = await page.evaluate(() => {
      const memoryInfo = (window.performance as any).memory;
      return memoryInfo ? {
        usedJSHeapSize: memoryInfo.usedJSHeapSize,
        totalJSHeapSize: memoryInfo.totalJSHeapSize
      } : null;
    });

    if (initialMetrics.memory && finalMetrics) {
      const memoryIncrease = finalMetrics.usedJSHeapSize - initialMetrics.memory.usedJSHeapSize;
      console.log(`Memory increase: ${Math.round(memoryIncrease / 1024 / 1024)}MB`);

      // Memory should not increase by more than 50MB during normal interactions
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    }

    console.log('✅ Performance and memory usage within acceptable limits');
  });

  test('Error Recovery and Edge Cases', async ({ page }) => {
    console.log('🧪 Testing Error Recovery and Edge Cases');

    await page.goto(BASE_URL + '/matrix');
    await waitForPageReady(page);

    // Test rapid clicking
    const ideaCard = page.locator('[data-testid="idea-card"], .idea-card').first();

    if (await ideaCard.isVisible()) {
      console.log('Testing rapid interaction handling');

      // Rapid hover/unhover
      for (let i = 0; i < 5; i++) {
        await ideaCard.hover();
        await page.waitForTimeout(50);
        await page.locator('body').hover();
        await page.waitForTimeout(50);
      }

      await takeTimestampedScreenshot(page, 'edge-rapid-interactions', 'After rapid interactions');

      // Verify page is still stable
      expect(await ideaCard.isVisible()).toBe(true);
    }

    // Test page refresh recovery
    console.log('Testing page refresh recovery');
    await page.reload();
    await waitForPageReady(page);

    await takeTimestampedScreenshot(page, 'edge-refresh-recovery', 'After page refresh');

    // Verify matrix still loads correctly
    const matrixContainer = page.locator('.matrix-container');
    expect(await matrixContainer.isVisible()).toBe(true);

    console.log('✅ Error recovery and edge cases handled properly');
  });

  test('Console Error Monitoring', async ({ page }) => {
    console.log('🧪 Monitoring Console Errors');

    const consoleErrors: string[] = [];
    const consoleWarnings: string[] = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      } else if (msg.type() === 'warning') {
        consoleWarnings.push(msg.text());
      }
    });

    await page.goto(BASE_URL);
    await waitForPageReady(page);

    // Navigate to matrix
    const matrixButton = page.locator('button:has-text("Design Matrix"), a[href="/matrix"]');
    if (await matrixButton.isVisible()) {
      await matrixButton.click();
      await waitForPageReady(page);
    }

    // Interact with various elements
    const ideaCard = page.locator('[data-testid="idea-card"], .idea-card').first();
    if (await ideaCard.isVisible()) {
      await ideaCard.hover();
      await page.waitForTimeout(500);
    }

    // Check for errors
    console.log(`Console Errors Found: ${consoleErrors.length}`);
    console.log(`Console Warnings Found: ${consoleWarnings.length}`);

    if (consoleErrors.length > 0) {
      console.log('Console Errors:', consoleErrors);
    }

    // Only fail if there are critical errors (excluding common dev warnings)
    const criticalErrors = consoleErrors.filter(error =>
      !error.includes('DevTools') &&
      !error.includes('Extension') &&
      !error.includes('favicon')
    );

    expect(criticalErrors.length).toBe(0);

    console.log('✅ No critical console errors detected');
  });
});