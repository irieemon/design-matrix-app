const { test, expect } = require('@playwright/test');

test.describe('Design Matrix Visual Regression Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
  });

  test('should match desktop matrix screenshot', async ({ page }) => {
    // Set desktop viewport as per claude.md requirements
    await page.setViewportSize({ width: 1440, height: 900 });

    // Wait for matrix to be stable
    await page.waitForSelector('.matrix-container');
    await page.waitForTimeout(1000);

    // Take screenshot of the matrix area
    const matrixContainer = page.locator('.matrix-container');
    await expect(matrixContainer).toHaveScreenshot('matrix-desktop-1440px.png', {
      threshold: 0.3, // Allow for minor differences
      maxDiffPixels: 100
    });
  });

  test('should match full page layout screenshot', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    // Wait for complete page load
    await page.waitForSelector('.matrix-container');
    await page.waitForTimeout(1000);

    // Full page screenshot
    await expect(page).toHaveScreenshot('full-page-desktop.png', {
      fullPage: true,
      threshold: 0.3,
      maxDiffPixels: 200
    });
  });

  test('should match tablet layout', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForSelector('.matrix-container');
    await page.waitForTimeout(1000);

    await expect(page).toHaveScreenshot('matrix-tablet.png', {
      threshold: 0.3,
      maxDiffPixels: 150
    });
  });

  test('should match mobile layout', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForSelector('.matrix-container');
    await page.waitForTimeout(1000);

    await expect(page).toHaveScreenshot('matrix-mobile.png', {
      threshold: 0.3,
      maxDiffPixels: 100
    });
  });

  test('should show card hover states correctly', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    const firstCard = page.locator('div[style*="position: absolute"]').first();
    await firstCard.hover({ force: true });
    await page.waitForTimeout(500);

    // Screenshot with hover state
    const matrixContainer = page.locator('.matrix-container');
    await expect(matrixContainer).toHaveScreenshot('matrix-card-hover.png', {
      threshold: 0.3,
      maxDiffPixels: 100
    });
  });

  test('should display quadrants with correct styling', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    // Focus on quadrant labels area
    const quadrantArea = page.locator('.matrix-container').first();
    await expect(quadrantArea).toHaveScreenshot('matrix-quadrants.png', {
      threshold: 0.2,
      maxDiffPixels: 50
    });
  });

  test('should maintain card scaling and physics', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    // Take screenshot focusing on card scaling differences
    const allCards = page.locator('div[style*="position: absolute"]');
    await expect(allCards.first()).toHaveScreenshot('card-scaling-physics.png', {
      threshold: 0.2,
      maxDiffPixels: 30
    });
  });

  test('should preserve dark mode compatibility', async ({ page }) => {
    // Test if dark mode selector exists and toggle it
    const darkModeToggle = page.locator('[data-testid="theme-toggle"]');

    if (await darkModeToggle.isVisible()) {
      await darkModeToggle.click();
      await page.waitForTimeout(500);

      await expect(page).toHaveScreenshot('matrix-dark-mode.png', {
        threshold: 0.3,
        maxDiffPixels: 200
      });
    } else {
      // If no dark mode toggle, just verify current theme looks good
      await expect(page).toHaveScreenshot('matrix-default-theme.png', {
        threshold: 0.3,
        maxDiffPixels: 100
      });
    }
  });
});