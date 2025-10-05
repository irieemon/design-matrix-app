import { test, expect } from '@playwright/test';

test.describe('Visual Regression Tests - Design Matrix', () => {

  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/');

    // Wait for the app to fully load
    await page.waitForLoadState('networkidle');

    // Ensure matrix is visible
    await expect(page.locator('[data-testid="design-matrix"]')).toBeVisible();
  });

  test('Design Matrix - Empty State Visual Verification', async ({ page }) => {
    // Clear any existing ideas for clean state
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify empty state renders correctly
    await expect(page.locator('text=No ideas yet')).toBeVisible();

    // Full page screenshot at design compliance viewport (1440px)
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page).toHaveScreenshot('design-matrix-empty-state.png', {
      fullPage: true,
      threshold: 0.2
    });
  });

  test('Design Matrix - With Ideas Visual Verification', async ({ page }) => {
    // Add test ideas via localStorage for consistent testing
    await page.evaluate(() => {
      const testIdeas = [
        {
          id: 'test-1',
          content: 'Quick Win Test Idea',
          matrix_position: { x: 0.2, y: 0.8 }, // Quick wins quadrant
          created_at: new Date().toISOString(),
          user_id: 'test-user'
        },
        {
          id: 'test-2',
          content: 'Strategic Investment',
          matrix_position: { x: 0.8, y: 0.8 }, // Strategic quadrant
          created_at: new Date().toISOString(),
          user_id: 'test-user'
        },
        {
          id: 'test-3',
          content: 'Reconsider Option',
          matrix_position: { x: 0.2, y: 0.2 }, // Reconsider quadrant
          created_at: new Date().toISOString(),
          user_id: 'test-user'
        }
      ];
      localStorage.setItem('ideas', JSON.stringify(testIdeas));
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify ideas are positioned correctly
    await expect(page.locator('text=Quick Win Test Idea')).toBeVisible();
    await expect(page.locator('text=Strategic Investment')).toBeVisible();
    await expect(page.locator('text=Reconsider Option')).toBeVisible();

    // Verify quadrant labels are visible
    await expect(page.locator('text=Quick Wins')).toBeVisible();
    await expect(page.locator('text=Strategic Investments')).toBeVisible();
    await expect(page.locator('text=Reconsider')).toBeVisible();
    await expect(page.locator('text=Avoid')).toBeVisible();

    // Full page screenshot
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page).toHaveScreenshot('design-matrix-with-ideas.png', {
      fullPage: true,
      threshold: 0.2
    });
  });

  test('Design Matrix - Responsive Mobile Layout', async ({ page }) => {
    // Test mobile viewport compliance
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE size

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify matrix is still functional on mobile
    await expect(page.locator('text=Strategic Priority Matrix')).toBeVisible();

    // Mobile screenshot
    await expect(page).toHaveScreenshot('design-matrix-mobile.png', {
      fullPage: true,
      threshold: 0.3 // Slightly higher threshold for responsive layouts
    });
  });

  test('Design Matrix - Tablet Layout', async ({ page }) => {
    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 }); // iPad size

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify layout adapts properly
    await expect(page.locator('text=Strategic Priority Matrix')).toBeVisible();

    // Tablet screenshot
    await expect(page).toHaveScreenshot('design-matrix-tablet.png', {
      fullPage: true,
      threshold: 0.2
    });
  });

  test('Design Matrix - Drag State Visual', async ({ page }) => {
    // Add test idea
    await page.evaluate(() => {
      const testIdea = [{
        id: 'drag-test',
        content: 'Draggable Test Idea',
        matrix_position: { x: 0.5, y: 0.5 },
        created_at: new Date().toISOString(),
        user_id: 'test-user'
      }];
      localStorage.setItem('ideas', JSON.stringify(testIdea));
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    const ideaCard = page.locator('text=Draggable Test Idea').first();
    await expect(ideaCard).toBeVisible();

    // Initiate drag (hover state)
    await ideaCard.hover();

    // Screenshot during hover state
    await expect(page).toHaveScreenshot('design-matrix-hover-state.png', {
      fullPage: true,
      threshold: 0.3
    });
  });

  test('Design Matrix - Error State Handling', async ({ page }) => {
    // Simulate error condition by corrupting localStorage
    await page.evaluate(() => {
      localStorage.setItem('ideas', 'invalid-json');
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Should gracefully handle errors and show empty state or error message
    const hasErrorState = await page.locator('text=No ideas yet').isVisible() ||
                         await page.locator('[data-testid="error-boundary"]').isVisible();

    expect(hasErrorState).toBeTruthy();

    // Screenshot error state
    await expect(page).toHaveScreenshot('design-matrix-error-state.png', {
      fullPage: true,
      threshold: 0.2
    });
  });

  test('Design Matrix - Accessibility Focus States', async ({ page }) => {
    // Add test idea
    await page.evaluate(() => {
      const testIdea = [{
        id: 'focus-test',
        content: 'Focus Test Idea',
        matrix_position: { x: 0.3, y: 0.7 },
        created_at: new Date().toISOString(),
        user_id: 'test-user'
      }];
      localStorage.setItem('ideas', JSON.stringify(testIdea));
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Test keyboard navigation and focus states
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Wait a moment for focus styles to apply
    await page.waitForTimeout(500);

    // Screenshot with focus states
    await expect(page).toHaveScreenshot('design-matrix-focus-states.png', {
      fullPage: true,
      threshold: 0.3
    });
  });

  test('Design Matrix - Performance Under Load', async ({ page }) => {
    // Generate many ideas to test performance
    await page.evaluate(() => {
      const manyIdeas = Array.from({ length: 50 }, (_, i) => ({
        id: `perf-test-${i}`,
        content: `Performance Test Idea ${i}`,
        matrix_position: {
          x: Math.random(),
          y: Math.random()
        },
        created_at: new Date().toISOString(),
        user_id: 'test-user'
      }));
      localStorage.setItem('ideas', JSON.stringify(manyIdeas));
    });

    // Measure load time
    const startTime = Date.now();
    await page.reload();
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;

    // Should load within reasonable time (5 seconds)
    expect(loadTime).toBeLessThan(5000);

    // Verify all ideas rendered
    const ideaCount = await page.locator('[data-testid^="idea-card-"]').count();
    expect(ideaCount).toBe(50);

    // Screenshot performance test
    await expect(page).toHaveScreenshot('design-matrix-performance-load.png', {
      fullPage: true,
      threshold: 0.4 // Higher threshold due to many elements
    });
  });
});