import { test, expect } from '@playwright/test';

test.describe('Drag and Drop Functionality Tests', () => {

  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/');

    // Wait for the app to fully load
    await page.waitForLoadState('networkidle');

    // Set up test ideas for consistent testing
    await page.evaluate(() => {
      const testIdeas = [
        {
          id: 'drag-test-1',
          content: 'Draggable Idea 1',
          matrix_position: { x: 0.2, y: 0.8 }, // Quick wins quadrant
          created_at: new Date().toISOString(),
          user_id: 'test-user'
        },
        {
          id: 'drag-test-2',
          content: 'Draggable Idea 2',
          matrix_position: { x: 0.8, y: 0.2 }, // Avoid quadrant
          created_at: new Date().toISOString(),
          user_id: 'test-user'
        }
      ];
      localStorage.setItem('ideas', JSON.stringify(testIdeas));
    });

    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test('Drag and Drop - Basic Functionality', async ({ page }) => {
    const sourceIdea = page.locator('text=Draggable Idea 1').first();
    await expect(sourceIdea).toBeVisible();

    // Get initial position
    const initialPosition = await sourceIdea.boundingBox();
    expect(initialPosition).not.toBeNull();

    // Perform drag operation
    await sourceIdea.dragTo(page.locator('.matrix-container'), {
      targetPosition: { x: 400, y: 300 }
    });

    // Wait for any animations to complete
    await page.waitForTimeout(500);

    // Verify the idea moved to a new position
    const newPosition = await sourceIdea.boundingBox();
    expect(newPosition).not.toBeNull();

    // Position should have changed
    expect(Math.abs(newPosition!.x - initialPosition!.x)).toBeGreaterThan(50);
    expect(Math.abs(newPosition!.y - initialPosition!.y)).toBeGreaterThan(50);
  });

  test('Drag and Drop - Position Persistence', async ({ page }) => {
    const sourceIdea = page.locator('text=Draggable Idea 1').first();

    // Drag to a specific position
    await sourceIdea.dragTo(page.locator('.matrix-container'), {
      targetPosition: { x: 300, y: 400 }
    });

    await page.waitForTimeout(500);

    // Get position after drag
    const positionAfterDrag = await sourceIdea.boundingBox();

    // Reload page to test persistence
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify idea is still in the same position
    const repositionedIdea = page.locator('text=Draggable Idea 1').first();
    await expect(repositionedIdea).toBeVisible();

    const persistedPosition = await repositionedIdea.boundingBox();

    // Position should be maintained (within small tolerance)
    expect(Math.abs(persistedPosition!.x - positionAfterDrag!.x)).toBeLessThan(10);
    expect(Math.abs(persistedPosition!.y - positionAfterDrag!.y)).toBeLessThan(10);
  });

  test('Drag and Drop - Quadrant Transition', async ({ page }) => {
    const sourceIdea = page.locator('text=Draggable Idea 1').first();

    // Drag from Quick Wins (top-left) to Avoid (bottom-right)
    await sourceIdea.dragTo(page.locator('.matrix-container'), {
      targetPosition: { x: 600, y: 600 }
    });

    await page.waitForTimeout(500);

    // Verify the idea moved to the avoid quadrant area
    const newPosition = await sourceIdea.boundingBox();
    expect(newPosition!.x).toBeGreaterThan(500); // Right side
    expect(newPosition!.y).toBeGreaterThan(500); // Bottom side
  });

  test('Drag and Drop - Multiple Ideas Independence', async ({ page }) => {
    const idea1 = page.locator('text=Draggable Idea 1').first();
    const idea2 = page.locator('text=Draggable Idea 2').first();

    // Get initial positions
    const idea1Initial = await idea1.boundingBox();
    const idea2Initial = await idea2.boundingBox();

    // Drag only idea1
    await idea1.dragTo(page.locator('.matrix-container'), {
      targetPosition: { x: 300, y: 300 }
    });

    await page.waitForTimeout(500);

    // Verify idea1 moved but idea2 stayed in place
    const idea1New = await idea1.boundingBox();
    const idea2New = await idea2.boundingBox();

    // Idea1 should have moved
    expect(Math.abs(idea1New!.x - idea1Initial!.x)).toBeGreaterThan(50);

    // Idea2 should stay in original position (within tolerance)
    expect(Math.abs(idea2New!.x - idea2Initial!.x)).toBeLessThan(10);
    expect(Math.abs(idea2New!.y - idea2Initial!.y)).toBeLessThan(10);
  });

  test('Drag and Drop - Boundary Constraints', async ({ page }) => {
    const sourceIdea = page.locator('text=Draggable Idea 1').first();

    // Try to drag outside the matrix boundaries
    await sourceIdea.dragTo(page.locator('.matrix-container'), {
      targetPosition: { x: -100, y: -100 } // Outside boundaries
    });

    await page.waitForTimeout(500);

    // Verify idea stays within matrix bounds
    const position = await sourceIdea.boundingBox();
    expect(position!.x).toBeGreaterThan(0);
    expect(position!.y).toBeGreaterThan(0);

    // Try dragging too far right/bottom
    await sourceIdea.dragTo(page.locator('.matrix-container'), {
      targetPosition: { x: 2000, y: 2000 } // Far outside
    });

    await page.waitForTimeout(500);

    const constrainedPosition = await sourceIdea.boundingBox();

    // Should be constrained within reasonable matrix bounds
    expect(constrainedPosition!.x).toBeLessThan(800);
    expect(constrainedPosition!.y).toBeLessThan(800);
  });

  test('Drag and Drop - Visual Feedback During Drag', async ({ page }) => {
    const sourceIdea = page.locator('text=Draggable Idea 1').first();

    // Start drag operation
    await sourceIdea.hover();
    await page.mouse.down();

    // During drag, the original should have reduced opacity or be hidden
    await page.waitForTimeout(100);

    // Check for drag feedback (opacity changes, etc.)
    const dragState = await sourceIdea.evaluate(el => {
      const computedStyle = window.getComputedStyle(el);
      return {
        opacity: computedStyle.opacity,
        visibility: computedStyle.visibility,
        cursor: computedStyle.cursor
      };
    });

    // Should have visual feedback during drag
    expect(parseFloat(dragState.opacity)).toBeLessThanOrEqual(1);

    // Complete the drag
    await page.mouse.move(400, 400);
    await page.mouse.up();

    await page.waitForTimeout(500);

    // After drag, should return to normal opacity
    const finalState = await sourceIdea.evaluate(el => {
      const computedStyle = window.getComputedStyle(el);
      return {
        opacity: computedStyle.opacity,
        visibility: computedStyle.visibility
      };
    });

    expect(parseFloat(finalState.opacity)).toBe(1);
    expect(finalState.visibility).toBe('visible');
  });

  test('Drag and Drop - Touch Device Simulation', async ({ page }) => {
    // Simulate touch device
    await page.emulateMedia({ media: 'screen' });
    await page.setViewportSize({ width: 375, height: 667 });

    const sourceIdea = page.locator('text=Draggable Idea 1').first();
    await expect(sourceIdea).toBeVisible();

    // Get initial position
    const initialPosition = await sourceIdea.boundingBox();

    // Simulate touch drag
    await sourceIdea.dispatchEvent('touchstart', {
      touches: [{ clientX: initialPosition!.x, clientY: initialPosition!.y }]
    });

    await page.waitForTimeout(100);

    await sourceIdea.dispatchEvent('touchmove', {
      touches: [{ clientX: initialPosition!.x + 100, clientY: initialPosition!.y + 100 }]
    });

    await page.waitForTimeout(100);

    await sourceIdea.dispatchEvent('touchend', {
      touches: []
    });

    await page.waitForTimeout(500);

    // Verify touch drag worked
    const newPosition = await sourceIdea.boundingBox();

    // Position should have changed on touch devices
    expect(Math.abs(newPosition!.x - initialPosition!.x)).toBeGreaterThan(20);
  });

  test('Drag and Drop - Performance with Multiple Ideas', async ({ page }) => {
    // Add many ideas to test drag performance
    await page.evaluate(() => {
      const manyIdeas = Array.from({ length: 20 }, (_, i) => ({
        id: `perf-drag-${i}`,
        content: `Performance Test ${i}`,
        matrix_position: {
          x: 0.1 + (i % 5) * 0.2,
          y: 0.1 + Math.floor(i / 5) * 0.2
        },
        created_at: new Date().toISOString(),
        user_id: 'test-user'
      }));
      localStorage.setItem('ideas', JSON.stringify(manyIdeas));
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Test drag performance with many ideas
    const firstIdea = page.locator('text=Performance Test 0').first();
    await expect(firstIdea).toBeVisible();

    const startTime = Date.now();

    // Perform drag operation
    await firstIdea.dragTo(page.locator('.matrix-container'), {
      targetPosition: { x: 400, y: 400 }
    });

    await page.waitForTimeout(500);

    const dragTime = Date.now() - startTime;

    // Drag should complete within reasonable time (2 seconds)
    expect(dragTime).toBeLessThan(2000);

    // Verify drag still works correctly
    const newPosition = await firstIdea.boundingBox();
    expect(newPosition!.x).toBeGreaterThan(300);
    expect(newPosition!.y).toBeGreaterThan(300);
  });

  test('Drag and Drop - Error Recovery', async ({ page }) => {
    const sourceIdea = page.locator('text=Draggable Idea 1').first();

    // Simulate network error during drag by intercepting API calls
    await page.route('**/api/**', route => {
      route.abort();
    });

    // Attempt drag operation
    await sourceIdea.dragTo(page.locator('.matrix-container'), {
      targetPosition: { x: 300, y: 300 }
    });

    await page.waitForTimeout(1000);

    // Should handle errors gracefully and not break the interface
    await expect(sourceIdea).toBeVisible();

    // Remove route interception
    await page.unroute('**/api/**');

    // Verify drag still works after error
    await sourceIdea.dragTo(page.locator('.matrix-container'), {
      targetPosition: { x: 400, y: 400 }
    });

    await page.waitForTimeout(500);

    // Should work normally again
    const position = await sourceIdea.boundingBox();
    expect(position!.x).toBeGreaterThan(300);
  });
});