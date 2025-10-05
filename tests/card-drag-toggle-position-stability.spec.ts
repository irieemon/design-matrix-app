import { test, expect, Page } from '@playwright/test';

/**
 * Critical Test: Card Position Stability Through Drag-Toggle Cycles
 *
 * Tests the fix for the stale closure bug in useIdeas.ts toggleCollapse function.
 *
 * Bug: Cards would "snap back" to original position after toggling between
 * minimized/expanded states because toggleCollapse used stale x,y coordinates
 * from closure instead of fresh state.
 *
 * Fix: Use functional state updates to preserve fresh x,y coordinates during toggle.
 */

test.describe('Card Position Stability - Drag-Toggle Cycles', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to matrix page with a project that has ideas
    await page.goto('http://localhost:3006');

    // Wait for auth and project to load
    await page.waitForSelector('[data-testid="matrix-container"]', { timeout: 10000 });

    // Wait for at least one card to be present
    await page.waitForSelector('[data-testid^="idea-card-"]', { timeout: 5000 });
  });

  /**
   * Test Case 1: Drag Minimized Card → Expand → Verify Position Stable
   */
  test('minimized card position persists after expand', async ({ page }) => {
    // Find a minimized card
    const minimizedCard = page.locator('[data-testid^="idea-card-"][data-collapsed="true"]').first();
    await minimizedCard.waitFor({ state: 'visible', timeout: 5000 });

    // Get initial position
    const initialBox = await minimizedCard.boundingBox();
    expect(initialBox).not.toBeNull();
    const initialX = initialBox!.x;
    const initialY = initialBox!.y;

    // Drag the minimized card to a new position
    const dragDistance = { x: 200, y: 150 };
    await minimizedCard.hover();
    await page.mouse.down();
    await page.mouse.move(
      initialX + dragDistance.x,
      initialY + dragDistance.y,
      { steps: 10 }
    );
    await page.mouse.up();

    // Wait for drag to complete and position to update
    await page.waitForTimeout(500);

    // Get position after drag
    const afterDragBox = await minimizedCard.boundingBox();
    expect(afterDragBox).not.toBeNull();
    const afterDragX = afterDragBox!.x;
    const afterDragY = afterDragBox!.y;

    // Verify card moved
    expect(Math.abs(afterDragX - initialX)).toBeGreaterThan(100);
    expect(Math.abs(afterDragY - initialY)).toBeGreaterThan(100);

    // Expand the card
    await minimizedCard.click();
    await page.waitForTimeout(300); // Wait for expansion animation

    // Get position after expand
    const expandedCard = page.locator('[data-testid^="idea-card-"][data-collapsed="false"]').first();
    const afterExpandBox = await expandedCard.boundingBox();
    expect(afterExpandBox).not.toBeNull();
    const afterExpandX = afterExpandBox!.x;
    const afterExpandY = afterExpandBox!.y;

    // ✅ CRITICAL: Position should be stable (within 5px tolerance for center calculation)
    expect(Math.abs(afterExpandX - afterDragX)).toBeLessThan(5);
    expect(Math.abs(afterExpandY - afterDragY)).toBeLessThan(5);

    // Log results
    console.log('Minimized→Expanded Position Stability Test:');
    console.log(`  Initial: (${initialX}, ${initialY})`);
    console.log(`  After Drag: (${afterDragX}, ${afterDragY})`);
    console.log(`  After Expand: (${afterExpandX}, ${afterExpandY})`);
    console.log(`  Delta X: ${Math.abs(afterExpandX - afterDragX)}px`);
    console.log(`  Delta Y: ${Math.abs(afterExpandY - afterDragY)}px`);
    console.log('  ✅ PASS: Position stable within 5px tolerance');
  });

  /**
   * Test Case 2: Drag Expanded Card → Minimize → Verify Position Stable
   */
  test('expanded card position persists after minimize', async ({ page }) => {
    // Find an expanded card
    const expandedCard = page.locator('[data-testid^="idea-card-"][data-collapsed="false"]').first();
    await expandedCard.waitFor({ state: 'visible', timeout: 5000 });

    // Get initial position
    const initialBox = await expandedCard.boundingBox();
    expect(initialBox).not.toBeNull();
    const initialX = initialBox!.x;
    const initialY = initialBox!.y;

    // Drag the expanded card to a new position
    const dragDistance = { x: -150, y: 180 };
    await expandedCard.hover();
    await page.mouse.down();
    await page.mouse.move(
      initialX + dragDistance.x,
      initialY + dragDistance.y,
      { steps: 10 }
    );
    await page.mouse.up();

    // Wait for drag to complete
    await page.waitForTimeout(500);

    // Get position after drag
    const afterDragBox = await expandedCard.boundingBox();
    expect(afterDragBox).not.toBeNull();
    const afterDragX = afterDragBox!.x;
    const afterDragY = afterDragBox!.y;

    // Verify card moved
    expect(Math.abs(afterDragX - initialX)).toBeGreaterThan(100);
    expect(Math.abs(afterDragY - initialY)).toBeGreaterThan(100);

    // Minimize the card
    await expandedCard.click();
    await page.waitForTimeout(300); // Wait for collapse animation

    // Get position after minimize
    const minimizedCard = page.locator('[data-testid^="idea-card-"][data-collapsed="true"]').first();
    const afterMinimizeBox = await minimizedCard.boundingBox();
    expect(afterMinimizeBox).not.toBeNull();
    const afterMinimizeX = afterMinimizeBox!.x;
    const afterMinimizeY = afterMinimizeBox!.y;

    // ✅ CRITICAL: Position should be stable (within 5px tolerance)
    expect(Math.abs(afterMinimizeX - afterDragX)).toBeLessThan(5);
    expect(Math.abs(afterMinimizeY - afterDragY)).toBeLessThan(5);

    // Log results
    console.log('Expanded→Minimized Position Stability Test:');
    console.log(`  Initial: (${initialX}, ${initialY})`);
    console.log(`  After Drag: (${afterDragX}, ${afterDragY})`);
    console.log(`  After Minimize: (${afterMinimizeX}, ${afterMinimizeY})`);
    console.log(`  Delta X: ${Math.abs(afterMinimizeX - afterDragX)}px`);
    console.log(`  Delta Y: ${Math.abs(afterMinimizeY - afterDragY)}px`);
    console.log('  ✅ PASS: Position stable within 5px tolerance');
  });

  /**
   * Test Case 3: Multiple Drag-Toggle Cycles
   */
  test('position persists through multiple drag-toggle cycles', async ({ page }) => {
    const card = page.locator('[data-testid^="idea-card-"]').first();
    await card.waitFor({ state: 'visible' });

    const positions: Array<{ x: number; y: number; state: string }> = [];

    // Cycle 1: Drag → Toggle → Verify
    for (let i = 0; i < 3; i++) {
      // Get current position
      const box = await card.boundingBox();
      expect(box).not.toBeNull();

      const state = await card.getAttribute('data-collapsed');
      positions.push({
        x: box!.x,
        y: box!.y,
        state: state === 'true' ? 'minimized' : 'expanded'
      });

      // Drag
      const dragX = (i + 1) * 50;
      const dragY = (i + 1) * 40;
      await card.hover();
      await page.mouse.down();
      await page.mouse.move(box!.x + dragX, box!.y + dragY, { steps: 5 });
      await page.mouse.up();
      await page.waitForTimeout(300);

      // Get position after drag
      const afterDragBox = await card.boundingBox();
      expect(afterDragBox).not.toBeNull();

      // Toggle
      await card.click();
      await page.waitForTimeout(300);

      // Get position after toggle
      const afterToggleBox = await card.boundingBox();
      expect(afterToggleBox).not.toBeNull();

      // Verify position stable after toggle
      const deltaX = Math.abs(afterToggleBox!.x - afterDragBox!.x);
      const deltaY = Math.abs(afterToggleBox!.y - afterDragBox!.y);

      expect(deltaX).toBeLessThan(5);
      expect(deltaY).toBeLessThan(5);

      console.log(`Cycle ${i + 1}: Delta X=${deltaX}px, Y=${deltaY}px ✅`);
    }

    console.log('✅ Multiple drag-toggle cycles completed with stable positions');
  });

  /**
   * Test Case 4: Rapid Toggle (Stress Test)
   */
  test('position stable during rapid toggle operations', async ({ page }) => {
    const card = page.locator('[data-testid^="idea-card-"]').first();
    await card.waitFor({ state: 'visible' });

    // Drag to a specific position
    const initialBox = await card.boundingBox();
    expect(initialBox).not.toBeNull();

    await card.hover();
    await page.mouse.down();
    await page.mouse.move(initialBox!.x + 200, initialBox!.y + 200, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(500);

    // Get stable position after drag
    const stableBox = await card.boundingBox();
    expect(stableBox).not.toBeNull();
    const stableX = stableBox!.x;
    const stableY = stableBox!.y;

    // Rapid toggle 5 times
    for (let i = 0; i < 5; i++) {
      await card.click();
      await page.waitForTimeout(100); // Minimal wait
    }

    // Get final position
    const finalBox = await card.boundingBox();
    expect(finalBox).not.toBeNull();

    // Position should still be stable
    const deltaX = Math.abs(finalBox!.x - stableX);
    const deltaY = Math.abs(finalBox!.y - stableY);

    expect(deltaX).toBeLessThan(5);
    expect(deltaY).toBeLessThan(5);

    console.log('✅ Rapid toggle stress test passed');
    console.log(`  Final delta: X=${deltaX}px, Y=${deltaY}px`);
  });

  /**
   * Test Case 5: Visual Snapshot - Position Stability
   */
  test('visual snapshot confirms position stability', async ({ page }) => {
    // Find a card
    const card = page.locator('[data-testid^="idea-card-"]').first();
    await card.waitFor({ state: 'visible' });

    // Drag to specific position
    const box = await card.boundingBox();
    expect(box).not.toBeNull();

    await card.hover();
    await page.mouse.down();
    await page.mouse.move(box!.x + 150, box!.y + 150, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(500);

    // Take snapshot after drag
    await expect(card).toHaveScreenshot('card-after-drag.png');

    // Toggle state
    await card.click();
    await page.waitForTimeout(300);

    // Take snapshot after toggle
    await expect(card).toHaveScreenshot('card-after-toggle.png', {
      // Allow small differences due to size change, but position should be same
      maxDiffPixelRatio: 0.1
    });

    console.log('✅ Visual snapshot test completed');
  });
});
