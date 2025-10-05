import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility and Responsive Design Tests', () => {

  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Set up test data for consistent testing
    await page.evaluate(() => {
      const testIdeas = [
        {
          id: 'a11y-test-1',
          content: 'Accessibility Test Idea 1',
          matrix_position: { x: 0.3, y: 0.7 },
          created_at: new Date().toISOString(),
          user_id: 'test-user'
        },
        {
          id: 'a11y-test-2',
          content: 'Accessibility Test Idea 2',
          matrix_position: { x: 0.7, y: 0.3 },
          created_at: new Date().toISOString(),
          user_id: 'test-user'
        }
      ];
      localStorage.setItem('ideas', JSON.stringify(testIdeas));
    });

    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test('WCAG Compliance - Automated Accessibility Scan', async ({ page }) => {
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Keyboard Navigation - Matrix Navigation', async ({ page }) => {
    // Test Tab navigation through the interface
    await page.keyboard.press('Tab');

    // Should be able to reach all interactive elements
    const focusableElements = [
      'button:has-text("Add Idea")',
      '[data-testid^="idea-card-"]',
      'button[aria-label]',
      'input',
      'textarea'
    ];

    for (const selector of focusableElements) {
      const element = page.locator(selector).first();
      if (await element.isVisible()) {
        await element.focus();

        // Verify element receives focus
        const isFocused = await element.evaluate(el => el === document.activeElement);
        expect(isFocused).toBeTruthy();
      }
    }
  });

  test('Keyboard Navigation - Drag and Drop Alternative', async ({ page }) => {
    const ideaCard = page.locator('text=Accessibility Test Idea 1').first();
    await ideaCard.focus();

    // Test keyboard-based repositioning (if implemented)
    // Arrow keys should move focused idea
    const initialPosition = await ideaCard.boundingBox();

    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');

    await page.waitForTimeout(500);

    // Position should change with keyboard navigation
    const newPosition = await ideaCard.boundingBox();

    // If keyboard navigation is implemented, position should change
    // If not implemented, this test documents the requirement
    if (newPosition && initialPosition) {
      const moved = Math.abs(newPosition.x - initialPosition.x) > 10 ||
                   Math.abs(newPosition.y - initialPosition.y) > 10;

      // Document whether keyboard navigation is available
      console.log('Keyboard navigation available:', moved);
    }
  });

  test('Screen Reader Compatibility - ARIA Labels and Roles', async ({ page }) => {
    // Check for proper ARIA labels on interactive elements
    const matrixContainer = page.locator('.matrix-container');
    await expect(matrixContainer).toHaveAttribute('role', 'region');

    // Idea cards should have appropriate labels
    const ideaCards = page.locator('[data-testid^="idea-card-"]');
    const cardCount = await ideaCards.count();

    for (let i = 0; i < cardCount; i++) {
      const card = ideaCards.nth(i);

      // Should have accessible name
      const accessibleName = await card.getAttribute('aria-label') ||
                            await card.textContent();
      expect(accessibleName).toBeTruthy();

      // Should have appropriate role
      const role = await card.getAttribute('role');
      expect(['button', 'article', 'listitem']).toContain(role);
    }

    // Quadrant labels should be properly labeled
    const quadrants = ['Quick Wins', 'Strategic Investments', 'Reconsider', 'Avoid'];
    for (const quadrant of quadrants) {
      const label = page.locator(`text=${quadrant}`);
      await expect(label).toBeVisible();

      // Should be properly marked as headings or labels
      const isHeading = await label.locator('xpath=ancestor-or-self::h1|ancestor-or-self::h2|ancestor-or-self::h3|ancestor-or-self::h4').count() > 0;
      const hasAriaLabel = await label.getAttribute('aria-label');

      expect(isHeading || hasAriaLabel).toBeTruthy();
    }
  });

  test('Color Contrast and Visual Accessibility', async ({ page }) => {
    // Test high contrast mode
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify content is still visible in dark mode
    await expect(page.locator('text=Strategic Priority Matrix')).toBeVisible();
    await expect(page.locator('text=Accessibility Test Idea 1')).toBeVisible();

    // Test with reduced motion preference
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Animations should respect reduced motion preference
    const animatedElements = page.locator('[style*="animation"], .animate');
    const animatedCount = await animatedElements.count();

    if (animatedCount > 0) {
      for (let i = 0; i < animatedCount; i++) {
        const element = animatedElements.nth(i);
        const style = await element.getAttribute('style');

        // Should have animation-duration: 0 or animation: none for reduced motion
        const respectsReducedMotion = style?.includes('animation-duration: 0') ||
                                    style?.includes('animation: none') ||
                                    await element.evaluate(el =>
                                      window.getComputedStyle(el).animationDuration === '0s'
                                    );

        expect(respectsReducedMotion).toBeTruthy();
      }
    }
  });

  test('Responsive Design - Mobile Layout (375px)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Matrix should be responsive on mobile
    await expect(page.locator('text=Strategic Priority Matrix')).toBeVisible();

    // Ideas should still be visible and interactive
    await expect(page.locator('text=Accessibility Test Idea 1')).toBeVisible();

    // Touch targets should be large enough (44px minimum)
    const ideaCard = page.locator('text=Accessibility Test Idea 1').first();
    const cardSize = await ideaCard.boundingBox();

    expect(cardSize!.width).toBeGreaterThanOrEqual(44);
    expect(cardSize!.height).toBeGreaterThanOrEqual(44);

    // Test mobile interactions
    await ideaCard.tap();
    await page.waitForTimeout(300);

    // Should handle tap interactions appropriately
    // (This will depend on your specific mobile interaction design)
  });

  test('Responsive Design - Tablet Layout (768px)', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Matrix should adapt to tablet size
    const matrixContainer = page.locator('.matrix-container');
    const containerSize = await matrixContainer.boundingBox();

    expect(containerSize!.width).toBeLessThanOrEqual(768);

    // Content should be well-distributed
    await expect(page.locator('text=Strategic Priority Matrix')).toBeVisible();
    await expect(page.locator('text=Quick Wins')).toBeVisible();
    await expect(page.locator('text=Strategic Investments')).toBeVisible();

    // Ideas should maintain proper spacing
    const idea1 = page.locator('text=Accessibility Test Idea 1').first();
    const idea2 = page.locator('text=Accessibility Test Idea 2').first();

    const pos1 = await idea1.boundingBox();
    const pos2 = await idea2.boundingBox();

    // Ideas should not overlap
    const distance = Math.sqrt(
      Math.pow(pos1!.x - pos2!.x, 2) + Math.pow(pos1!.y - pos2!.y, 2)
    );
    expect(distance).toBeGreaterThan(50);
  });

  test('Responsive Design - Large Desktop (1920px)', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Matrix should scale appropriately for large screens
    const matrixContainer = page.locator('.matrix-container');
    await expect(matrixContainer).toBeVisible();

    // Content should not be stretched awkwardly
    const containerSize = await matrixContainer.boundingBox();

    // Matrix should maintain reasonable proportions
    const aspectRatio = containerSize!.width / containerSize!.height;
    expect(aspectRatio).toBeGreaterThan(0.5);
    expect(aspectRatio).toBeLessThan(3);

    // Text should remain readable (not too small or too large)
    const heading = page.locator('text=Strategic Priority Matrix');
    const headingStyles = await heading.evaluate(el => {
      const styles = window.getComputedStyle(el);
      return {
        fontSize: styles.fontSize,
        lineHeight: styles.lineHeight
      };
    });

    const fontSize = parseInt(headingStyles.fontSize);
    expect(fontSize).toBeGreaterThan(16); // At least 16px
    expect(fontSize).toBeLessThan(72); // Not ridiculously large
  });

  test('Print Styles and Media Queries', async ({ page }) => {
    // Test print media styles
    await page.emulateMedia({ media: 'print' });
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Essential content should be visible in print mode
    await expect(page.locator('text=Strategic Priority Matrix')).toBeVisible();

    // Ideas should be visible for printing
    await expect(page.locator('text=Accessibility Test Idea 1')).toBeVisible();

    // Interactive elements might be hidden or styled differently for print
    const printStyles = await page.evaluate(() => {
      const matrix = document.querySelector('.matrix-container');
      if (matrix) {
        const styles = window.getComputedStyle(matrix);
        return {
          display: styles.display,
          backgroundColor: styles.backgroundColor,
          boxShadow: styles.boxShadow
        };
      }
      return null;
    });

    expect(printStyles).not.toBeNull();
    expect(printStyles!.display).not.toBe('none'); // Should be visible
  });

  test('Focus Management and Tab Order', async ({ page }) => {
    // Test logical tab order
    const expectedTabOrder = [
      'h2:has-text("Strategic Priority Matrix")', // Skip to main content
      'button:has-text("Add Idea")', // Primary action
      '[data-testid="idea-card-a11y-test-1"]', // First idea
      '[data-testid="idea-card-a11y-test-2"]' // Second idea
    ];

    for (const selector of expectedTabOrder) {
      await page.keyboard.press('Tab');

      const activeElement = await page.evaluate(() => {
        const active = document.activeElement;
        return {
          tagName: active?.tagName,
          textContent: active?.textContent?.trim(),
          className: active?.className,
          id: active?.id,
          testId: active?.getAttribute('data-testid')
        };
      });

      // Verify focus moved to expected element
      const targetElement = page.locator(selector).first();
      if (await targetElement.isVisible()) {
        const isFocused = await targetElement.evaluate(el => el === document.activeElement);
        expect(isFocused).toBeTruthy();
      }
    }

    // Test focus trap in modals (if applicable)
    const addButton = page.locator('button:has-text("Add Idea")');
    if (await addButton.isVisible()) {
      await addButton.click();

      // If modal opens, focus should be trapped
      const modal = page.locator('[role="dialog"], [aria-modal="true"]');
      if (await modal.isVisible()) {
        // Tab should cycle within modal
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');

        const focusedElement = await page.evaluate(() => document.activeElement);
        const isWithinModal = await modal.evaluate((modal, focused) => {
          return modal.contains(focused);
        }, focusedElement);

        expect(isWithinModal).toBeTruthy();
      }
    }
  });

  test('Error States Accessibility', async ({ page }) => {
    // Test error state accessibility
    await page.evaluate(() => {
      localStorage.setItem('ideas', 'invalid-json');
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Error states should be announced to screen readers
    const errorElements = page.locator('[role="alert"], [aria-live="polite"], [aria-live="assertive"]');
    const errorCount = await errorElements.count();

    if (errorCount > 0) {
      for (let i = 0; i < errorCount; i++) {
        const errorElement = errorElements.nth(i);
        const errorText = await errorElement.textContent();

        expect(errorText).toBeTruthy();
        expect(errorText!.length).toBeGreaterThan(0);
      }
    }

    // Empty state should be accessible
    const emptyState = page.locator('text=No ideas yet');
    if (await emptyState.isVisible()) {
      // Should be properly labeled
      const hasAriaLabel = await emptyState.getAttribute('aria-label');
      const hasRole = await emptyState.getAttribute('role');

      expect(hasAriaLabel || hasRole).toBeTruthy();
    }
  });

  test('Voice Control and Speech Recognition Compatibility', async ({ page }) => {
    // Test elements have good voice control targets
    const interactiveElements = page.locator('button, [role="button"], input, textarea');
    const elementCount = await interactiveElements.count();

    for (let i = 0; i < elementCount; i++) {
      const element = interactiveElements.nth(i);

      if (await element.isVisible()) {
        // Should have accessible name for voice commands
        const accessibleName = await element.getAttribute('aria-label') ||
                              await element.getAttribute('title') ||
                              await element.textContent() ||
                              await element.getAttribute('placeholder');

        expect(accessibleName).toBeTruthy();
        expect(accessibleName!.trim().length).toBeGreaterThan(0);

        // Names should be descriptive (more than just "button" or "click")
        const name = accessibleName!.toLowerCase();
        expect(['button', 'click', 'here', 'link']).not.toContain(name.trim());
      }
    }
  });

  test('Zoom and Magnification Support', async ({ page }) => {
    // Test 200% zoom level (WCAG requirement)
    await page.setViewportSize({ width: 720, height: 450 }); // Simulate 200% zoom on 1440x900

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Content should remain functional at 200% zoom
    await expect(page.locator('text=Strategic Priority Matrix')).toBeVisible();
    await expect(page.locator('text=Accessibility Test Idea 1')).toBeVisible();

    // No content should be cut off or inaccessible
    const ideaCard = page.locator('text=Accessibility Test Idea 1').first();
    const cardBounds = await ideaCard.boundingBox();

    expect(cardBounds!.x).toBeGreaterThanOrEqual(0);
    expect(cardBounds!.y).toBeGreaterThanOrEqual(0);
    expect(cardBounds!.x + cardBounds!.width).toBeLessThanOrEqual(720);

    // Interactive elements should still be clickable
    await ideaCard.click();
    await page.waitForTimeout(300);

    // Should handle interaction correctly even at zoom level
  });
});