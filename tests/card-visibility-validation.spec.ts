import { test, expect } from '@playwright/test';

/**
 * Enhanced Card Visibility Validation Tests
 *
 * Critical quality assurance tests specifically targeting card visibility issues
 * in the design matrix system. These tests verify that cards are properly
 * rendered, positioned, and accessible across all supported scenarios.
 */

test.describe('Card Visibility Validation - Critical Quality Gates', () => {

  test.beforeEach(async ({ page }) => {
    // Navigate to matrix page
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Ensure we're on the matrix page
    await expect(page.locator('text=Strategic Priority Matrix')).toBeVisible();
  });

  test('Critical: All cards visible within viewport bounds', async ({ page }) => {
    // Add test cards with known positions
    await page.evaluate(() => {
      const testIdeas = [
        { id: 'vis-1', content: 'Top-left card', matrix_position: { x: 0.1, y: 0.1 }, created_at: new Date().toISOString(), user_id: 'test' },
        { id: 'vis-2', content: 'Top-right card', matrix_position: { x: 0.9, y: 0.1 }, created_at: new Date().toISOString(), user_id: 'test' },
        { id: 'vis-3', content: 'Bottom-left card', matrix_position: { x: 0.1, y: 0.9 }, created_at: new Date().toISOString(), user_id: 'test' },
        { id: 'vis-4', content: 'Bottom-right card', matrix_position: { x: 0.9, y: 0.9 }, created_at: new Date().toISOString(), user_id: 'test' },
        { id: 'vis-5', content: 'Center card', matrix_position: { x: 0.5, y: 0.5 }, created_at: new Date().toISOString(), user_id: 'test' }
      ];
      localStorage.setItem('ideas', JSON.stringify(testIdeas));
    });

    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Allow matrix to stabilize

    // Get viewport dimensions
    const viewport = page.viewportSize();
    expect(viewport).toBeTruthy();

    // Verify all test cards are visible and within bounds
    const cardTexts = ['Top-left card', 'Top-right card', 'Bottom-left card', 'Bottom-right card', 'Center card'];

    for (const cardText of cardTexts) {
      const card = page.locator(`text=${cardText}`).first();

      // Card must be visible
      await expect(card).toBeVisible({ timeout: 10000 });

      // Get card position and dimensions
      const box = await card.boundingBox();
      expect(box).toBeTruthy();

      // Verify card is within viewport bounds
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width);
      expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height);

      console.log(`✅ Card "${cardText}" visible at (${box!.x}, ${box!.y}) size ${box!.width}x${box!.height}`);
    }
  });

  test('Critical: Z-index hierarchy prevents card invisibility', async ({ page }) => {
    // Add test card
    await page.evaluate(() => {
      const testIdea = [{
        id: 'z-test',
        content: 'Z-Index Test Card',
        matrix_position: { x: 0.5, y: 0.5 },
        created_at: new Date().toISOString(),
        user_id: 'test'
      }];
      localStorage.setItem('ideas', JSON.stringify(testIdea));
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify card is visible
    const card = page.locator('text=Z-Index Test Card').first();
    await expect(card).toBeVisible();

    // Check z-index hierarchy
    const zIndexInfo = await page.evaluate(() => {
      const matrix = document.querySelector('.matrix-container');
      const cardElement = Array.from(document.querySelectorAll('*')).find(el =>
        el.textContent?.includes('Z-Index Test Card')
      );

      if (!matrix || !cardElement) return null;

      const matrixZ = getComputedStyle(matrix).zIndex;
      const cardZ = getComputedStyle(cardElement).zIndex;

      return {
        matrixZIndex: parseInt(matrixZ) || 0,
        cardZIndex: parseInt(cardZ) || 0,
        cardComputedVisibility: getComputedStyle(cardElement).visibility,
        cardOpacity: getComputedStyle(cardElement).opacity
      };
    });

    expect(zIndexInfo).toBeTruthy();
    expect(zIndexInfo!.cardZIndex).toBeGreaterThanOrEqual(zIndexInfo!.matrixZIndex);
    expect(zIndexInfo!.cardComputedVisibility).toBe('visible');
    expect(parseFloat(zIndexInfo!.cardOpacity)).toBeGreaterThan(0.5);
  });

  test('Critical: Cards remain visible during responsive transitions', async ({ page }) => {
    // Add test card
    await page.evaluate(() => {
      const testIdea = [{
        id: 'resp-test',
        content: 'Responsive Test Card',
        matrix_position: { x: 0.5, y: 0.5 },
        created_at: new Date().toISOString(),
        user_id: 'test'
      }];
      localStorage.setItem('ideas', JSON.stringify(testIdea));
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Test multiple viewport sizes
    const viewports = [
      { width: 1440, height: 900, name: 'Desktop' },
      { width: 768, height: 1024, name: 'Tablet' },
      { width: 375, height: 667, name: 'Mobile' }
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(1000); // Allow layout to settle

      const card = page.locator('text=Responsive Test Card').first();
      await expect(card).toBeVisible({ timeout: 5000 });

      const box = await card.boundingBox();
      expect(box).toBeTruthy();

      // Verify card is within new viewport bounds
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
      expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);

      console.log(`✅ Card visible in ${viewport.name} (${viewport.width}x${viewport.height})`);
    }
  });

  test('Critical: Edge position cards remain visible', async ({ page }) => {
    // Test cards at extreme positions
    await page.evaluate(() => {
      const extremeIdeas = [
        { id: 'edge-1', content: 'Edge 0,0', matrix_position: { x: 0, y: 0 }, created_at: new Date().toISOString(), user_id: 'test' },
        { id: 'edge-2', content: 'Edge 1,0', matrix_position: { x: 1, y: 0 }, created_at: new Date().toISOString(), user_id: 'test' },
        { id: 'edge-3', content: 'Edge 0,1', matrix_position: { x: 0, y: 1 }, created_at: new Date().toISOString(), user_id: 'test' },
        { id: 'edge-4', content: 'Edge 1,1', matrix_position: { x: 1, y: 1 }, created_at: new Date().toISOString(), user_id: 'test' }
      ];
      localStorage.setItem('ideas', JSON.stringify(extremeIdeas));
    });

    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Verify all edge cards are visible
    const edgeCards = ['Edge 0,0', 'Edge 1,0', 'Edge 0,1', 'Edge 1,1'];

    for (const cardText of edgeCards) {
      const card = page.locator(`text=${cardText}`).first();

      // Must be visible
      await expect(card).toBeVisible({ timeout: 10000 });

      // Should have non-zero dimensions
      const box = await card.boundingBox();
      expect(box).toBeTruthy();
      expect(box!.width).toBeGreaterThan(0);
      expect(box!.height).toBeGreaterThan(0);

      console.log(`✅ Edge card "${cardText}" visible with dimensions ${box!.width}x${box!.height}`);
    }
  });

  test('Performance: Card visibility under load', async ({ page }) => {
    // Generate many cards to test performance
    await page.evaluate(() => {
      const manyIdeas = Array.from({ length: 25 }, (_, i) => ({
        id: `perf-${i}`,
        content: `Performance Test Card ${i}`,
        matrix_position: {
          x: (i % 5) * 0.2 + 0.1,
          y: Math.floor(i / 5) * 0.2 + 0.1
        },
        created_at: new Date().toISOString(),
        user_id: 'test'
      }));
      localStorage.setItem('ideas', JSON.stringify(manyIdeas));
    });

    const startTime = Date.now();
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Wait for all cards to be visible
    await page.waitForFunction(() => {
      const cards = document.querySelectorAll('[data-testid^="idea-card-"], *[class*="card"]');
      return cards.length >= 25;
    }, { timeout: 10000 });

    const loadTime = Date.now() - startTime;

    // Verify performance threshold
    expect(loadTime).toBeLessThan(5000); // 5 second maximum

    // Count visible cards
    const visibleCardCount = await page.locator('text=/Performance Test Card \\d+/').count();
    expect(visibleCardCount).toBe(25);

    console.log(`✅ ${visibleCardCount} cards loaded in ${loadTime}ms`);
  });

  test('Accessibility: Cards are programmatically accessible', async ({ page }) => {
    // Add test card
    await page.evaluate(() => {
      const testIdea = [{
        id: 'a11y-test',
        content: 'Accessibility Test Card',
        matrix_position: { x: 0.5, y: 0.5 },
        created_at: new Date().toISOString(),
        user_id: 'test'
      }];
      localStorage.setItem('ideas', JSON.stringify(testIdea));
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    const card = page.locator('text=Accessibility Test Card').first();
    await expect(card).toBeVisible();

    // Test keyboard navigation
    await page.keyboard.press('Tab');

    // Check if card or its container is focusable
    const focusedElement = await page.locator(':focus').textContent();
    const isCardFocused = focusedElement?.includes('Accessibility Test Card') ||
                         await page.locator(':focus').locator('text=Accessibility Test Card').isVisible().catch(() => false);

    // At minimum, card should be discoverable via screen reader
    const accessibilityInfo = await page.evaluate(() => {
      const cardElement = Array.from(document.querySelectorAll('*')).find(el =>
        el.textContent?.includes('Accessibility Test Card')
      );

      if (!cardElement) return null;

      return {
        hasRole: cardElement.getAttribute('role'),
        hasAriaLabel: cardElement.getAttribute('aria-label'),
        hasTabIndex: cardElement.getAttribute('tabindex'),
        isVisible: getComputedStyle(cardElement).display !== 'none',
        textContent: cardElement.textContent?.trim()
      };
    });

    expect(accessibilityInfo).toBeTruthy();
    expect(accessibilityInfo!.isVisible).toBeTruthy();
    expect(accessibilityInfo!.textContent).toBeTruthy();

    // At least one accessibility feature should be present
    const hasAccessibilityFeature = accessibilityInfo!.hasRole ||
                                   accessibilityInfo!.hasAriaLabel ||
                                   accessibilityInfo!.hasTabIndex ||
                                   isCardFocused;
    expect(hasAccessibilityFeature).toBeTruthy();
  });

  test('Stress Test: Extreme content scenarios', async ({ page }) => {
    // Test with problematic content
    await page.evaluate(() => {
      const extremeIdeas = [
        {
          id: 'empty-1',
          content: '',
          matrix_position: { x: 0.2, y: 0.2 },
          created_at: new Date().toISOString(),
          user_id: 'test'
        },
        {
          id: 'long-1',
          content: 'Very long content that should not break the layout or cause cards to become invisible due to overflow or positioning issues with extremely long text content that keeps going and going and going',
          matrix_position: { x: 0.8, y: 0.2 },
          created_at: new Date().toISOString(),
          user_id: 'test'
        },
        {
          id: 'special-1',
          content: '🚀 Special chars: 中文 العربية <>&"\'',
          matrix_position: { x: 0.5, y: 0.8 },
          created_at: new Date().toISOString(),
          user_id: 'test'
        }
      ];
      localStorage.setItem('ideas', JSON.stringify(extremeIdeas));
    });

    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Verify all extreme content cards are handled gracefully
    const longContentCard = page.locator('text=/Very long content that should not break/').first();
    const specialCharsCard = page.locator('text=🚀 Special chars:').first();

    await expect(longContentCard).toBeVisible();
    await expect(specialCharsCard).toBeVisible();

    // Verify cards don't overflow matrix bounds
    const matrixBounds = await page.locator('.matrix-container').boundingBox();
    expect(matrixBounds).toBeTruthy();

    for (const card of [longContentCard, specialCharsCard]) {
      const cardBounds = await card.boundingBox();
      expect(cardBounds).toBeTruthy();

      // Card should be within matrix container
      expect(cardBounds!.x).toBeGreaterThanOrEqual(matrixBounds!.x);
      expect(cardBounds!.y).toBeGreaterThanOrEqual(matrixBounds!.y);
      expect(cardBounds!.x + cardBounds!.width).toBeLessThanOrEqual(matrixBounds!.x + matrixBounds!.width);
      expect(cardBounds!.y + cardBounds!.height).toBeLessThanOrEqual(matrixBounds!.y + matrixBounds!.height);
    }
  });

  test('Visual Regression: Card visibility baseline', async ({ page }) => {
    // Set up consistent test state
    await page.evaluate(() => {
      const baselineIdeas = [
        { id: 'baseline-1', content: 'Quick Win', matrix_position: { x: 0.25, y: 0.75 }, created_at: new Date().toISOString(), user_id: 'test' },
        { id: 'baseline-2', content: 'Strategic', matrix_position: { x: 0.75, y: 0.75 }, created_at: new Date().toISOString(), user_id: 'test' },
        { id: 'baseline-3', content: 'Reconsider', matrix_position: { x: 0.25, y: 0.25 }, created_at: new Date().toISOString(), user_id: 'test' },
        { id: 'baseline-4', content: 'Avoid', matrix_position: { x: 0.75, y: 0.25 }, created_at: new Date().toISOString(), user_id: 'test' }
      ];
      localStorage.setItem('ideas', JSON.stringify(baselineIdeas));
    });

    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000); // Ensure stability

    // Set consistent viewport
    await page.setViewportSize({ width: 1440, height: 900 });

    // Verify all baseline cards are visible before screenshot
    await expect(page.locator('text=Quick Win')).toBeVisible();
    await expect(page.locator('text=Strategic')).toBeVisible();
    await expect(page.locator('text=Reconsider')).toBeVisible();
    await expect(page.locator('text=Avoid')).toBeVisible();

    // Take baseline screenshot for visual regression
    await expect(page).toHaveScreenshot('card-visibility-baseline.png', {
      fullPage: true,
      threshold: 0.2,
      animations: 'disabled'
    });
  });
});

test.describe('Card Visibility - Error Recovery', () => {

  test('Graceful handling of invalid position data', async ({ page }) => {
    // Test with invalid matrix positions
    await page.evaluate(() => {
      const invalidIdeas = [
        { id: 'invalid-1', content: 'No position', created_at: new Date().toISOString(), user_id: 'test' },
        { id: 'invalid-2', content: 'Negative position', matrix_position: { x: -0.5, y: -0.5 }, created_at: new Date().toISOString(), user_id: 'test' },
        { id: 'invalid-3', content: 'Extreme position', matrix_position: { x: 999, y: 999 }, created_at: new Date().toISOString(), user_id: 'test' },
        { id: 'invalid-4', content: 'Null position', matrix_position: null, created_at: new Date().toISOString(), user_id: 'test' }
      ];
      localStorage.setItem('ideas', JSON.stringify(invalidIdeas));
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Should not crash and should handle invalid data gracefully
    await expect(page.locator('text=Strategic Priority Matrix')).toBeVisible();

    // Check for any visible cards - should fallback to default positions
    const hasVisibleCards = await page.locator('text=/No position|Negative position|Extreme position|Null position/').count();

    // At least some cards should be visible (with fallback positioning)
    expect(hasVisibleCards).toBeGreaterThan(0);

    // Should not have console errors
    const errorLogs: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errorLogs.push(msg.text());
      }
    });

    await page.waitForTimeout(3000);

    // Filter out known acceptable errors
    const criticalErrors = errorLogs.filter(error =>
      !error.includes('Download the React DevTools') &&
      !error.includes('[vite]') &&
      !error.includes('Warning:')
    );

    expect(criticalErrors.length).toBe(0);
  });
});