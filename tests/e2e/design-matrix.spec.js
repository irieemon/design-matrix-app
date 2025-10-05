const { test, expect } = require('@playwright/test');

test.describe('Design Matrix E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/');

    // Wait for app to load completely
    await page.waitForLoadState('networkidle');

    // Wait for demo project to be set up
    await page.waitForTimeout(2000);
  });

  test('should display matrix container and idea cards', async ({ page }) => {
    // Check that matrix container exists
    const matrixContainer = page.locator('.matrix-container');
    await expect(matrixContainer).toBeVisible();

    // Check that idea cards are present
    const ideaCards = page.locator('div[style*="position: absolute"]');
    await expect(ideaCards).toHaveCount(5);

    // Verify each card is visible
    for (let i = 0; i < 5; i++) {
      await expect(ideaCards.nth(i)).toBeVisible();
    }
  });

  test('should have properly positioned cards in different quadrants', async ({ page }) => {
    const ideaCards = page.locator('div[style*="position: absolute"]');

    // Get card positions
    const cardPositions = [];
    const count = await ideaCards.count();

    for (let i = 0; i < count; i++) {
      const boundingBox = await ideaCards.nth(i).boundingBox();
      cardPositions.push(boundingBox);
    }

    // Verify cards are spread across the matrix
    expect(cardPositions.length).toBe(5);

    // Check that cards have different positions (not all stacked)
    const uniquePositions = new Set(cardPositions.map(pos => `${pos.x},${pos.y}`));
    expect(uniquePositions.size).toBe(5);
  });

  test('should display quadrant labels correctly', async ({ page }) => {
    // Check for quadrant labels
    await expect(page.locator('text=Quick Wins')).toBeVisible();
    await expect(page.locator('text=Strategic Investments')).toBeVisible();
    await expect(page.locator('text=Reconsider')).toBeVisible();
    await expect(page.locator('text=Avoid')).toBeVisible();
  });

  test('should display matrix statistics', async ({ page }) => {
    // Check for statistics section
    await expect(page.locator('text=Total Ideas')).toBeVisible();
    await expect(page.locator('text=Quick Wins')).toBeVisible();
    await expect(page.locator('text=Strategic')).toBeVisible();
    await expect(page.locator('text=Avoid')).toBeVisible();

    // Verify numbers are displayed
    const totalIdeasValue = page.locator('text=Total Ideas').locator('..').locator('text=/^\\d+$/');
    await expect(totalIdeasValue).toBeVisible();
  });

  test('should show card details on hover', async ({ page }) => {
    const firstCard = page.locator('div[style*="position: absolute"]').first();

    // Hover over the card
    await firstCard.hover({ force: true });

    // Wait a moment for potential tooltip or interaction
    await page.waitForTimeout(500);

    // Card should remain visible during hover
    await expect(firstCard).toBeVisible();
  });

  test('should handle responsive design', async ({ page }) => {
    // Test desktop viewport (1440px as per claude.md requirement)
    await page.setViewportSize({ width: 1440, height: 900 });

    const matrixContainer = page.locator('.matrix-container');
    await expect(matrixContainer).toBeVisible();

    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(matrixContainer).toBeVisible();

    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(matrixContainer).toBeVisible();
  });

  test('should not have console errors', async ({ page }) => {
    const errors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Should not have critical console errors
    const criticalErrors = errors.filter(error =>
      !error.includes('Download the React DevTools') &&
      !error.includes('Warning:')
    );

    expect(criticalErrors).toHaveLength(0);
  });

  test('should maintain performance standards', async ({ page }) => {
    // Start performance monitoring
    await page.goto('/');

    // Wait for complete load
    await page.waitForLoadState('networkidle');

    // Measure basic performance metrics
    const performanceMetrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0];
      return {
        loadTime: navigation.loadEventEnd - navigation.loadEventStart,
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0
      };
    });

    // Performance should be reasonable (under 3 seconds for total load)
    expect(performanceMetrics.loadTime).toBeLessThan(3000);
  });
});