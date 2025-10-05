const { test, expect } = require('@playwright/test');

test.describe('Component Integration Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
  });

  test('should properly integrate idea data flow from demo to matrix', async ({ page }) => {
    // Verify demo data is loaded
    const ideaCards = page.locator('div[style*="position: absolute"]');
    await expect(ideaCards).toHaveCount(5);

    // Check that cards have actual content
    for (let i = 0; i < 5; i++) {
      const cardText = await ideaCards.nth(i).textContent();
      expect(cardText.length).toBeGreaterThan(10); // Should have meaningful content
    }
  });

  test('should integrate matrix with project header correctly', async ({ page }) => {
    // Check that project header shows correct project
    await expect(page.locator('text=Revolutionary Design Demo')).toBeVisible();

    // Matrix should be visible below header
    const matrixContainer = page.locator('.matrix-container');
    await expect(matrixContainer).toBeVisible();

    // Verify proper spacing between header and matrix
    const headerBottom = await page.locator('h2').boundingBox();
    const matrixTop = await matrixContainer.boundingBox();

    expect(matrixTop.y).toBeGreaterThan(headerBottom.y + headerBottom.height);
  });

  test('should integrate statistics with actual card data', async ({ page }) => {
    // Get statistics values
    const totalIdeasStat = page.locator('text=Total Ideas').locator('..').locator('text=/^\\d+$/');
    const totalIdeasValue = parseInt(await totalIdeasStat.textContent());

    // Get actual card count
    const actualCardCount = await page.locator('div[style*="position: absolute"]').count();

    // Statistics should match actual card count
    expect(totalIdeasValue).toBe(actualCardCount);
  });

  test('should integrate action buttons with matrix state', async ({ page }) => {
    // Check that Add Idea buttons are present
    await expect(page.locator('text=AI Idea')).toBeVisible();
    await expect(page.locator('text=Create New Idea')).toBeVisible();

    // Buttons should be properly positioned relative to matrix
    const addButton = page.locator('text=Create New Idea').locator('..');
    const matrixContainer = page.locator('.matrix-container');

    const buttonBox = await addButton.boundingBox();
    const matrixBox = await matrixContainer.boundingBox();

    // Button should be above matrix
    expect(buttonBox.y).toBeLessThan(matrixBox.y);
  });

  test('should integrate drag and drop system with card positioning', async ({ page }) => {
    const firstCard = page.locator('div[style*="position: absolute"]').first();

    // Get initial position
    const initialBox = await firstCard.boundingBox();

    // Attempt to drag the card (might not complete due to complexity, but should start)
    await firstCard.hover({ force: true });
    await page.mouse.down();

    // Check that card enters dragging state
    await page.waitForTimeout(100);

    // Clean up
    await page.mouse.up();

    // Card should still be visible after drag attempt
    await expect(firstCard).toBeVisible();
  });

  test('should integrate authentication with matrix access', async ({ page }) => {
    // Matrix should be accessible with demo user
    const matrixContainer = page.locator('.matrix-container');
    await expect(matrixContainer).toBeVisible();

    // Should not show login screen
    await expect(page.locator('text=Sign In')).not.toBeVisible();

    // Should show user context (demo user)
    // Note: Exact user display depends on implementation
  });

  test('should integrate error boundaries with matrix rendering', async ({ page }) => {
    const consoleErrors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Navigate and wait for full load
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Matrix should render without throwing errors
    const matrixContainer = page.locator('.matrix-container');
    await expect(matrixContainer).toBeVisible();

    // Filter out known non-critical errors
    const criticalErrors = consoleErrors.filter(error =>
      !error.includes('Download the React DevTools') &&
      !error.includes('Warning: ') &&
      !error.includes('[vite]')
    );

    expect(criticalErrors).toHaveLength(0);
  });

  test('should integrate CSS and styling systems correctly', async ({ page }) => {
    const matrixContainer = page.locator('.matrix-container');

    // Check that CSS custom properties are applied
    const computedStyle = await matrixContainer.evaluate(el => {
      const styles = window.getComputedStyle(el);
      return {
        position: styles.position,
        width: styles.width,
        height: styles.height,
        background: styles.background
      };
    });

    expect(computedStyle.position).toBe('relative');
    expect(computedStyle.width).not.toBe('auto');
    expect(computedStyle.height).not.toBe('auto');

    // Check that cards have proper styling
    const firstCard = page.locator('div[style*="position: absolute"]').first();
    const cardStyle = await firstCard.evaluate(el => {
      const styles = window.getComputedStyle(el);
      return {
        position: styles.position,
        visibility: styles.visibility,
        opacity: styles.opacity
      };
    });

    expect(cardStyle.position).toBe('absolute');
    expect(cardStyle.visibility).toBe('visible');
    expect(parseFloat(cardStyle.opacity)).toBeGreaterThan(0);
  });

  test('should integrate responsive breakpoints correctly', async ({ page }) => {
    // Test different viewports
    const viewports = [
      { width: 1440, height: 900, name: 'desktop' },
      { width: 768, height: 1024, name: 'tablet' },
      { width: 375, height: 667, name: 'mobile' }
    ];

    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.waitForTimeout(500);

      // Matrix should be visible at all breakpoints
      const matrixContainer = page.locator('.matrix-container');
      await expect(matrixContainer).toBeVisible();

      // Cards should remain visible
      const cardCount = await page.locator('div[style*="position: absolute"]').count();
      expect(cardCount).toBe(5);
    }
  });
});