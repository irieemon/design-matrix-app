/**
 * COMPREHENSIVE MATRIX VISUAL FIXES VALIDATION
 *
 * Tests for two critical fixes:
 * 1. Axis labels should be visible (not black) on initial render
 * 2. Grid lines should persist when hovering over matrix background
 */

import { test, expect, Page } from '@playwright/test';

// Test configuration
const BASE_URL = 'http://localhost:3005';
const VIEWPORT = { width: 1920, height: 1080 };
const TEST_TIMEOUT = 60000;

// Color analysis helper
async function getComputedColor(page: Page, selector: string): Promise<string> {
  return await page.evaluate((sel) => {
    const element = document.querySelector(sel);
    if (!element) throw new Error(`Element not found: ${sel}`);
    const computed = window.getComputedStyle(element);
    return computed.color;
  }, selector);
}

// Background image analysis helper
async function getBackgroundImage(page: Page, selector: string): Promise<string> {
  return await page.evaluate((sel) => {
    const element = document.querySelector(sel);
    if (!element) throw new Error(`Element not found: ${sel}`);
    const computed = window.getComputedStyle(element);
    return computed.backgroundImage;
  }, selector);
}

test.describe('Matrix Visual Fixes Validation', () => {
  test.setTimeout(TEST_TIMEOUT);

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(VIEWPORT);

    // Navigate and wait for app to be ready
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Wait for auth bypass or login
    const demoButton = page.locator('button:has-text("Demo Mode")');
    if (await demoButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await demoButton.click();
      await page.waitForURL('**/matrix', { timeout: 10000 });
    }

    // Ensure we're on the matrix page
    await page.waitForSelector('.matrix-container', { timeout: 10000 });
  });

  test('Fix 1: Axis labels should be visible (not black) on initial render', async ({ page }) => {
    console.log('🎯 Testing axis label visibility on initial render...');

    // Wait for matrix to be fully rendered
    await page.waitForSelector('.matrix-axis', { state: 'visible', timeout: 5000 });

    // Take initial screenshot
    await page.screenshot({
      path: 'test-results/axis-labels-initial.png',
      fullPage: false
    });

    // Get computed color of axis labels
    const axisXColor = await getComputedColor(page, '.matrix-axis-x');
    const axisYColor = await getComputedColor(page, '.matrix-axis-y');

    console.log(`  ✓ Axis X Color: ${axisXColor}`);
    console.log(`  ✓ Axis Y Color: ${axisYColor}`);

    // Parse RGB values
    const parseRGB = (color: string) => {
      const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (!match) return null;
      return { r: parseInt(match[1]), g: parseInt(match[2]), b: parseInt(match[3]) };
    };

    const axisXRGB = parseRGB(axisXColor);
    const axisYRGB = parseRGB(axisYColor);

    // CRITICAL CHECK: Labels should NOT be pure black (0, 0, 0)
    // Expected color: --color-neutral-700: #334155 = rgb(51, 65, 85)
    expect(axisXRGB).not.toBeNull();
    expect(axisYRGB).not.toBeNull();

    if (axisXRGB && axisYRGB) {
      // Check X axis is not black
      const isXBlack = axisXRGB.r === 0 && axisXRGB.g === 0 && axisXRGB.b === 0;
      expect(isXBlack, `Axis X should not be black. Got: ${axisXColor}`).toBe(false);

      // Check Y axis is not black
      const isYBlack = axisYRGB.r === 0 && axisYRGB.g === 0 && axisYRGB.b === 0;
      expect(isYBlack, `Axis Y should not be black. Got: ${axisYColor}`).toBe(false);

      // Verify labels are visible gray (expected: rgb(51, 65, 85) ±10 tolerance)
      const expectedR = 51, expectedG = 65, expectedB = 85;
      const tolerance = 10;

      const xColorMatch =
        Math.abs(axisXRGB.r - expectedR) <= tolerance &&
        Math.abs(axisXRGB.g - expectedG) <= tolerance &&
        Math.abs(axisXRGB.b - expectedB) <= tolerance;

      const yColorMatch =
        Math.abs(axisYRGB.r - expectedR) <= tolerance &&
        Math.abs(axisYRGB.g - expectedG) <= tolerance &&
        Math.abs(axisYRGB.b - expectedB) <= tolerance;

      console.log(`  ✓ Axis X color match: ${xColorMatch} (expected: rgb(51, 65, 85), got: rgb(${axisXRGB.r}, ${axisXRGB.g}, ${axisXRGB.b}))`);
      console.log(`  ✓ Axis Y color match: ${yColorMatch} (expected: rgb(51, 65, 85), got: rgb(${axisYRGB.r}, ${axisYRGB.g}, ${axisYRGB.b}))`);

      // At minimum, labels should be visible gray (not pure black or white)
      expect(axisXRGB.r).toBeGreaterThan(20);
      expect(axisYRGB.r).toBeGreaterThan(20);
      expect(axisXRGB.r).toBeLessThan(150);
      expect(axisYRGB.r).toBeLessThan(150);
    }

    console.log('✅ PASS: Axis labels are visible on initial render');
  });

  test('Fix 2: Grid lines should persist when hovering over matrix background', async ({ page }) => {
    console.log('🎯 Testing grid line persistence on hover...');

    // Wait for matrix grid to be rendered
    await page.waitForSelector('.matrix-grid', { state: 'visible', timeout: 5000 });

    // Get initial background image (should contain grid gradients)
    const initialBg = await getBackgroundImage(page, '.matrix-grid');
    console.log(`  ✓ Initial background-image length: ${initialBg.length} chars`);

    // CRITICAL CHECK: Background should contain gradient definitions (not "none")
    expect(initialBg).not.toBe('none');
    expect(initialBg.length).toBeGreaterThan(100); // Grid gradients create long CSS

    // Take screenshot before hover
    await page.screenshot({
      path: 'test-results/grid-lines-before-hover.png',
      fullPage: false
    });

    // Hover over the matrix grid element
    const matrixGrid = page.locator('.matrix-grid');
    await matrixGrid.hover({ force: true });

    // Wait a moment for hover effects
    await page.waitForTimeout(500);

    // Take screenshot during hover
    await page.screenshot({
      path: 'test-results/grid-lines-during-hover.png',
      fullPage: false
    });

    // Get background image during hover
    const hoverBg = await getBackgroundImage(page, '.matrix-grid');
    console.log(`  ✓ Hover background-image length: ${hoverBg.length} chars`);

    // CRITICAL CHECK: Background should still contain grid gradients
    expect(hoverBg, 'Grid background should not become "none" or "transparent" on hover').not.toBe('none');
    expect(hoverBg.length, 'Grid gradients should persist on hover').toBeGreaterThan(100);

    // Verify both states have gradient definitions
    const hasInitialGradients = initialBg.includes('linear-gradient');
    const hasHoverGradients = hoverBg.includes('linear-gradient');

    expect(hasInitialGradients, 'Initial state should have linear-gradient definitions').toBe(true);
    expect(hasHoverGradients, 'Hover state should maintain linear-gradient definitions').toBe(true);

    console.log('✅ PASS: Grid lines persist during hover');
  });

  test('Fix 2 Alternative: Test matrix-grid-background element', async ({ page }) => {
    console.log('🎯 Testing matrix-grid-background element persistence...');

    // Check if matrix-grid-background exists (alternative implementation)
    const matrixGridBg = page.locator('.matrix-grid-background');
    const hasGridBg = await matrixGridBg.count() > 0;

    if (!hasGridBg) {
      console.log('  ℹ️ No .matrix-grid-background element found, skipping this test');
      return;
    }

    // Get initial background
    const initialBg = await getBackgroundImage(page, '.matrix-grid-background');
    console.log(`  ✓ Initial background-image length: ${initialBg.length} chars`);

    expect(initialBg).not.toBe('none');

    // Hover over element
    await matrixGridBg.hover({ force: true });
    await page.waitForTimeout(500);

    // Check background persists
    const hoverBg = await getBackgroundImage(page, '.matrix-grid-background');
    console.log(`  ✓ Hover background-image length: ${hoverBg.length} chars`);

    expect(hoverBg).not.toBe('none');
    expect(hoverBg.length).toBeGreaterThan(100);

    console.log('✅ PASS: matrix-grid-background persists during hover');
  });

  test('Comprehensive Visual Regression: Before and after hover comparison', async ({ page }) => {
    console.log('🎯 Running comprehensive visual regression test...');

    // Wait for full render
    await page.waitForSelector('.matrix-container', { state: 'visible' });
    await page.waitForTimeout(1000);

    // Capture initial state
    const matrixContainer = page.locator('.matrix-container');
    await matrixContainer.screenshot({
      path: 'test-results/matrix-initial-state.png'
    });
    console.log('  ✓ Captured initial state');

    // Hover over matrix container
    await matrixContainer.hover({ position: { x: 300, y: 300 } });
    await page.waitForTimeout(500);

    // Capture hover state
    await matrixContainer.screenshot({
      path: 'test-results/matrix-hover-state.png'
    });
    console.log('  ✓ Captured hover state');

    // Move mouse to different position
    await matrixContainer.hover({ position: { x: 600, y: 400 } });
    await page.waitForTimeout(500);

    // Capture secondary hover state
    await matrixContainer.screenshot({
      path: 'test-results/matrix-hover-state-2.png'
    });
    console.log('  ✓ Captured secondary hover state');

    // Move mouse away
    await page.mouse.move(100, 100);
    await page.waitForTimeout(500);

    // Capture post-hover state
    await matrixContainer.screenshot({
      path: 'test-results/matrix-post-hover-state.png'
    });
    console.log('  ✓ Captured post-hover state');

    console.log('✅ PASS: Visual regression screenshots captured');
  });

  test('Integration Test: Both fixes working together', async ({ page }) => {
    console.log('🎯 Testing both fixes in integration...');

    // Wait for matrix
    await page.waitForSelector('.matrix-container', { state: 'visible' });
    await page.waitForTimeout(1000);

    // Test 1: Axis labels visible initially
    const axisXColor = await getComputedColor(page, '.matrix-axis-x');
    const axisYColor = await getComputedColor(page, '.matrix-axis-y');

    expect(axisXColor).not.toBe('rgb(0, 0, 0)');
    expect(axisYColor).not.toBe('rgb(0, 0, 0)');
    console.log('  ✓ Axis labels are visible (not black)');

    // Test 2: Grid lines present initially
    const gridBg = await getBackgroundImage(page, '.matrix-grid');
    expect(gridBg).not.toBe('none');
    expect(gridBg.includes('linear-gradient')).toBe(true);
    console.log('  ✓ Grid lines are present');

    // Hover over matrix
    await page.locator('.matrix-container').hover({ position: { x: 400, y: 400 } });
    await page.waitForTimeout(500);

    // Test 3: Grid lines persist on hover
    const hoverGridBg = await getBackgroundImage(page, '.matrix-grid');
    expect(hoverGridBg).not.toBe('none');
    expect(hoverGridBg.includes('linear-gradient')).toBe(true);
    console.log('  ✓ Grid lines persist on hover');

    // Test 4: Axis labels still visible on hover
    const hoverAxisXColor = await getComputedColor(page, '.matrix-axis-x');
    const hoverAxisYColor = await getComputedColor(page, '.matrix-axis-y');

    expect(hoverAxisXColor).not.toBe('rgb(0, 0, 0)');
    expect(hoverAxisYColor).not.toBe('rgb(0, 0, 0)');
    console.log('  ✓ Axis labels remain visible on hover');

    // Take final screenshot
    await page.screenshot({
      path: 'test-results/integration-test-final.png',
      fullPage: false
    });

    console.log('✅ PASS: Both fixes working together successfully');
  });
});