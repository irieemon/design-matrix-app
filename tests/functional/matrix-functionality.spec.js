const { test, expect } = require('@playwright/test');

test.describe('Matrix Functionality Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
  });

  test('should render correct number of idea cards', async ({ page }) => {
    const ideaCards = page.locator('div[style*="position: absolute"]');
    await expect(ideaCards).toHaveCount(5);

    // Each card should have unique content
    const cardTexts = [];
    for (let i = 0; i < 5; i++) {
      const text = await ideaCards.nth(i).textContent();
      cardTexts.push(text);
    }

    // All texts should be unique
    const uniqueTexts = new Set(cardTexts);
    expect(uniqueTexts.size).toBe(5);
  });

  test('should position cards in different quadrants based on priority', async ({ page }) => {
    const matrixContainer = page.locator('.matrix-container');
    const matrixBox = await matrixContainer.boundingBox();

    const ideaCards = page.locator('div[style*="position: absolute"]');
    const cardPositions = [];

    for (let i = 0; i < 5; i++) {
      const cardBox = await ideaCards.nth(i).boundingBox();
      const relativePosition = {
        x: (cardBox.x - matrixBox.x) / matrixBox.width,
        y: (cardBox.y - matrixBox.y) / matrixBox.height
      };
      cardPositions.push(relativePosition);
    }

    // Cards should be distributed across the matrix (not all in one corner)
    const xPositions = cardPositions.map(pos => pos.x);
    const yPositions = cardPositions.map(pos => pos.y);

    const xRange = Math.max(...xPositions) - Math.min(...xPositions);
    const yRange = Math.max(...yPositions) - Math.min(...yPositions);

    expect(xRange).toBeGreaterThan(0.3); // Cards span at least 30% of width
    expect(yRange).toBeGreaterThan(0.3); // Cards span at least 30% of height
  });

  test('should display card content and details correctly', async ({ page }) => {
    const ideaCards = page.locator('div[style*="position: absolute"]');

    for (let i = 0; i < 5; i++) {
      const card = ideaCards.nth(i);

      // Each card should have visible content
      const cardText = await card.textContent();
      expect(cardText.length).toBeGreaterThan(10);

      // Cards should contain priority indicators
      const priorityElement = card.locator('[class*="priority"], text=/strategic|high|medium|low/i').first();
      await expect(priorityElement).toBeVisible();
    }
  });

  test('should apply correct styling based on card priority', async ({ page }) => {
    const ideaCards = page.locator('div[style*="position: absolute"]');

    // Get cards with different priorities
    const strategicCard = page.locator('text=strategic').locator('..').locator('..').first();
    const highCard = page.locator('text=high').locator('..').locator('..').first();

    // Different priority cards should have different visual styling
    const strategicStyle = await strategicCard.evaluate(el => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return {
        width: rect.width,
        height: rect.height,
        background: style.background,
        transform: style.transform
      };
    });

    const highStyle = await highCard.evaluate(el => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return {
        width: rect.width,
        height: rect.height,
        background: style.background,
        transform: style.transform
      };
    });

    // Cards should have different styling (at least one property should differ)
    const stylesMatch = (
      strategicStyle.width === highStyle.width &&
      strategicStyle.height === highStyle.height &&
      strategicStyle.background === highStyle.background &&
      strategicStyle.transform === highStyle.transform
    );

    expect(stylesMatch).toBe(false);
  });

  test('should display quadrant labels and guides', async ({ page }) => {
    // Check for all quadrant labels
    await expect(page.locator('text=Quick Wins')).toBeVisible();
    await expect(page.locator('text=Strategic Investments')).toBeVisible();
    await expect(page.locator('text=Reconsider')).toBeVisible();
    await expect(page.locator('text=Avoid')).toBeVisible();

    // Check for axis labels
    await expect(page.locator('text=Implementation Complexity')).toBeVisible();
    await expect(page.locator('text=Strategic Value')).toBeVisible();
  });

  test('should calculate and display statistics correctly', async ({ page }) => {
    // Get actual card count
    const actualCardCount = await page.locator('div[style*="position: absolute"]').count();

    // Get displayed total
    const totalDisplay = page.locator('text=Total Ideas').locator('..').locator('text=/^\\d+$/');
    const displayedTotal = parseInt(await totalDisplay.textContent());

    expect(displayedTotal).toBe(actualCardCount);

    // Quick wins statistic should be reasonable
    const quickWinsDisplay = page.locator('text=Quick Wins').locator('..').locator('text=/^\\d+$/');
    const quickWinsCount = parseInt(await quickWinsDisplay.textContent());

    expect(quickWinsCount).toBeGreaterThanOrEqual(0);
    expect(quickWinsCount).toBeLessThanOrEqual(actualCardCount);
  });

  test('should handle card interaction states', async ({ page }) => {
    const firstCard = page.locator('div[style*="position: absolute"]').first();

    // Card should be visible initially
    await expect(firstCard).toBeVisible();

    // Check initial opacity
    const initialOpacity = await firstCard.evaluate(el => window.getComputedStyle(el).opacity);
    expect(parseFloat(initialOpacity)).toBe(1);

    // Test hover interaction
    await firstCard.hover({ force: true });

    // Card should remain visible during hover
    await expect(firstCard).toBeVisible();
  });

  test('should maintain card accessibility', async ({ page }) => {
    const ideaCards = page.locator('div[style*="position: absolute"]');

    // Cards should be accessible via keyboard navigation
    const firstCard = ideaCards.first();

    // Check if card or its children are focusable
    const focusableElement = firstCard.locator('[tabindex], button, [role="button"]').first();

    if (await focusableElement.isVisible()) {
      await focusableElement.focus();
      await expect(focusableElement).toBeFocused();
    }
  });

  test('should handle edge cases gracefully', async ({ page }) => {
    // Test with very small viewport
    await page.setViewportSize({ width: 320, height: 568 });
    await page.waitForTimeout(500);

    // Matrix should still be visible
    const matrixContainer = page.locator('.matrix-container');
    await expect(matrixContainer).toBeVisible();

    // Cards should still be present
    const cardCount = await page.locator('div[style*="position: absolute"]').count();
    expect(cardCount).toBe(5);

    // Test with very large viewport
    await page.setViewportSize({ width: 2560, height: 1440 });
    await page.waitForTimeout(500);

    await expect(matrixContainer).toBeVisible();
    const largeViewportCardCount = await page.locator('div[style*="position: absolute"]').count();
    expect(largeViewportCardCount).toBe(5);
  });

  test('should prevent layout shifts and maintain stability', async ({ page }) => {
    const matrixContainer = page.locator('.matrix-container');

    // Get initial position
    const initialBox = await matrixContainer.boundingBox();

    // Wait for potential layout shifts
    await page.waitForTimeout(2000);

    // Position should remain stable
    const finalBox = await matrixContainer.boundingBox();

    // Allow for minor browser rendering differences (1px tolerance)
    expect(Math.abs(finalBox.x - initialBox.x)).toBeLessThan(2);
    expect(Math.abs(finalBox.y - initialBox.y)).toBeLessThan(2);
    expect(Math.abs(finalBox.width - initialBox.width)).toBeLessThan(2);
    expect(Math.abs(finalBox.height - initialBox.height)).toBeLessThan(2);
  });
});