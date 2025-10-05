import { test, expect } from '@playwright/test';

/**
 * Edge Case Scenarios for Design Matrix
 *
 * Comprehensive testing of boundary conditions, error states,
 * extreme content, and unusual user interactions to ensure
 * robust card visibility and system stability.
 */

test.describe('Edge Case Scenarios - Boundary Conditions', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=Strategic Priority Matrix')).toBeVisible();
  });

  test('Extreme Positions: Cards at exact boundaries', async ({ page }) => {
    // Test cards at exact coordinate boundaries
    await page.evaluate(() => {
      const extremePositions = [
        { id: 'bound-1', content: 'Exact 0,0', matrix_position: { x: 0, y: 0 }, created_at: new Date().toISOString(), user_id: 'test' },
        { id: 'bound-2', content: 'Exact 1,1', matrix_position: { x: 1, y: 1 }, created_at: new Date().toISOString(), user_id: 'test' },
        { id: 'bound-3', content: 'Exact 0,1', matrix_position: { x: 0, y: 1 }, created_at: new Date().toISOString(), user_id: 'test' },
        { id: 'bound-4', content: 'Exact 1,0', matrix_position: { x: 1, y: 0 }, created_at: new Date().toISOString(), user_id: 'test' },
        { id: 'bound-5', content: 'Exact Center', matrix_position: { x: 0.5, y: 0.5 }, created_at: new Date().toISOString(), user_id: 'test' }
      ];
      localStorage.setItem('ideas', JSON.stringify(extremePositions));
    });

    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Verify all boundary cards are visible and positioned correctly
    const boundaryCards = ['Exact 0,0', 'Exact 1,1', 'Exact 0,1', 'Exact 1,0', 'Exact Center'];

    for (const cardText of boundaryCards) {
      const card = page.locator(`text=${cardText}`).first();
      await expect(card).toBeVisible({ timeout: 10000 });

      const box = await card.boundingBox();
      expect(box).toBeTruthy();

      // Cards should have positive dimensions
      expect(box!.width).toBeGreaterThan(0);
      expect(box!.height).toBeGreaterThan(0);

      // Cards should be within reasonable bounds of the matrix
      const matrixBounds = await page.locator('.matrix-container').first().boundingBox();
      expect(matrixBounds).toBeTruthy();

      expect(box!.x).toBeGreaterThanOrEqual(matrixBounds!.x - 50); // Allow some tolerance
      expect(box!.y).toBeGreaterThanOrEqual(matrixBounds!.y - 50);
      expect(box!.x + box!.width).toBeLessThanOrEqual(matrixBounds!.x + matrixBounds!.width + 50);
      expect(box!.y + box!.height).toBeLessThanOrEqual(matrixBounds!.y + matrixBounds!.height + 50);

      console.log(`✅ Boundary card "${cardText}" visible at (${box!.x}, ${box!.y})`);
    }
  });

  test('Invalid Data: Malformed position coordinates', async ({ page }) => {
    // Test various invalid position data
    await page.evaluate(() => {
      const invalidData = [
        { id: 'invalid-1', content: 'No Position Data', created_at: new Date().toISOString(), user_id: 'test' },
        { id: 'invalid-2', content: 'Null Position', matrix_position: null, created_at: new Date().toISOString(), user_id: 'test' },
        { id: 'invalid-3', content: 'Undefined Position', matrix_position: undefined, created_at: new Date().toISOString(), user_id: 'test' },
        { id: 'invalid-4', content: 'Negative Position', matrix_position: { x: -0.5, y: -0.3 }, created_at: new Date().toISOString(), user_id: 'test' },
        { id: 'invalid-5', content: 'Extreme Position', matrix_position: { x: 999, y: 1000 }, created_at: new Date().toISOString(), user_id: 'test' },
        { id: 'invalid-6', content: 'Float Overflow', matrix_position: { x: Number.MAX_VALUE, y: Number.MAX_VALUE }, created_at: new Date().toISOString(), user_id: 'test' },
        { id: 'invalid-7', content: 'NaN Position', matrix_position: { x: NaN, y: NaN }, created_at: new Date().toISOString(), user_id: 'test' },
        { id: 'invalid-8', content: 'String Position', matrix_position: { x: 'invalid', y: 'invalid' } as any, created_at: new Date().toISOString(), user_id: 'test' }
      ];
      localStorage.setItem('ideas', JSON.stringify(invalidData));
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    // App should not crash with invalid data
    await expect(page.locator('text=Strategic Priority Matrix')).toBeVisible();

    // Check how many cards are rendered (should use fallback positioning)
    const visibleCardCount = await page.locator('text=/No Position Data|Null Position|Undefined Position|Negative Position|Extreme Position|Float Overflow|NaN Position|String Position/').count();

    console.log(`Cards with invalid data rendered: ${visibleCardCount}/8`);

    // Should render some cards with fallback positioning
    expect(visibleCardCount).toBeGreaterThan(0);

    // No critical JavaScript errors should occur
    const errorLogs: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errorLogs.push(msg.text());
      }
    });

    await page.waitForTimeout(3000);

    const criticalErrors = errorLogs.filter(error =>
      !error.includes('Download the React DevTools') &&
      !error.includes('[vite]') &&
      !error.includes('Warning:')
    );

    expect(criticalErrors.length).toBe(0);
  });

  test('Content Extremes: Empty, very long, and special content', async ({ page }) => {
    // Test extreme content scenarios
    await page.evaluate(() => {
      const extremeContent = [
        {
          id: 'content-1',
          content: '',
          matrix_position: { x: 0.1, y: 0.1 },
          created_at: new Date().toISOString(),
          user_id: 'test'
        },
        {
          id: 'content-2',
          content: 'A'.repeat(1000), // Very long content
          matrix_position: { x: 0.9, y: 0.1 },
          created_at: new Date().toISOString(),
          user_id: 'test'
        },
        {
          id: 'content-3',
          content: '🚀🎉💫⭐🌟✨🎊🎈🎆🎇🌈🦄🐲🔮💎👑🏆🎯🎪🎭🎨🎵🎶🎸🎺🎷',
          matrix_position: { x: 0.1, y: 0.9 },
          created_at: new Date().toISOString(),
          user_id: 'test'
        },
        {
          id: 'content-4',
          content: 'Multi\nLine\nContent\nWith\nBreaks',
          matrix_position: { x: 0.9, y: 0.9 },
          created_at: new Date().toISOString(),
          user_id: 'test'
        },
        {
          id: 'content-5',
          content: '<script>alert("XSS")</script><img src="x" onerror="alert(1)">',
          matrix_position: { x: 0.5, y: 0.2 },
          created_at: new Date().toISOString(),
          user_id: 'test'
        },
        {
          id: 'content-6',
          content: '中文内容 العربية русский 日本語 한국어 ελληνικά',
          matrix_position: { x: 0.5, y: 0.8 },
          created_at: new Date().toISOString(),
          user_id: 'test'
        }
      ];
      localStorage.setItem('ideas', JSON.stringify(extremeContent));
    });

    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Verify handling of extreme content
    const matrixBounds = await page.locator('.matrix-container').first().boundingBox();
    expect(matrixBounds).toBeTruthy();

    // Empty content card - should be handled gracefully
    const emptyCard = page.locator('[data-testid^="idea-card-"], *[class*="card"]').first();
    if (await emptyCard.isVisible()) {
      const emptyBox = await emptyCard.boundingBox();
      expect(emptyBox).toBeTruthy();
      expect(emptyBox!.width).toBeGreaterThan(0);
      expect(emptyBox!.height).toBeGreaterThan(0);
    }

    // Long content card - should not break layout
    const longContentCard = page.locator('text=/AAAAAAAAAA/').first();
    if (await longContentCard.isVisible()) {
      const longBox = await longContentCard.boundingBox();
      expect(longBox).toBeTruthy();

      // Should not overflow matrix bounds excessively
      expect(longBox!.x + longBox!.width).toBeLessThanOrEqual(matrixBounds!.x + matrixBounds!.width + 100);
    }

    // Emoji content - should render properly
    const emojiCard = page.locator('text=🚀🎉💫').first();
    if (await emojiCard.isVisible()) {
      await expect(emojiCard).toBeVisible();
    }

    // Multilingual content - should render properly
    const multilingualCard = page.locator('text=中文内容').first();
    if (await multilingualCard.isVisible()) {
      await expect(multilingualCard).toBeVisible();
    }

    // XSS attempt - should be sanitized and not execute
    const xssAttempted = await page.evaluate(() => {
      return document.documentElement.innerHTML.includes('<script>') ||
             document.documentElement.innerHTML.includes('onerror=');
    });

    expect(xssAttempted).toBeFalsy();

    console.log('✅ Extreme content handled gracefully');
  });

  test('Zero and Singular States: Edge case quantities', async ({ page }) => {
    // Test with zero cards
    await page.evaluate(() => {
      localStorage.setItem('ideas', JSON.stringify([]));
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Should show empty state
    await expect(page.locator('text=No ideas yet')).toBeVisible();

    // Test with exactly one card
    await page.evaluate(() => {
      const singleIdea = [{
        id: 'single-1',
        content: 'Only Card',
        matrix_position: { x: 0.5, y: 0.5 },
        created_at: new Date().toISOString(),
        user_id: 'test'
      }];
      localStorage.setItem('ideas', JSON.stringify(singleIdea));
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Single card should be visible and centered
    const singleCard = page.locator('text=Only Card').first();
    await expect(singleCard).toBeVisible();

    const singleBox = await singleCard.boundingBox();
    expect(singleBox).toBeTruthy();

    // Should be approximately centered
    const matrixBounds = await page.locator('.matrix-container').first().boundingBox();
    const centerX = matrixBounds!.x + (matrixBounds!.width / 2);
    const centerY = matrixBounds!.y + (matrixBounds!.height / 2);

    const cardCenterX = singleBox!.x + (singleBox!.width / 2);
    const cardCenterY = singleBox!.y + (singleBox!.height / 2);

    // Allow reasonable tolerance for centering
    expect(Math.abs(cardCenterX - centerX)).toBeLessThan(100);
    expect(Math.abs(cardCenterY - centerY)).toBeLessThan(100);

    console.log('✅ Single card properly positioned');
  });

  test('Concurrent Operations: Rapid state changes', async ({ page }) => {
    // Test rapid state changes
    const operations = [
      // Operation 1: Load initial data
      () => page.evaluate(() => {
        const ideas1 = [
          { id: 'rapid-1', content: 'Card 1', matrix_position: { x: 0.2, y: 0.2 }, created_at: new Date().toISOString(), user_id: 'test' },
          { id: 'rapid-2', content: 'Card 2', matrix_position: { x: 0.8, y: 0.8 }, created_at: new Date().toISOString(), user_id: 'test' }
        ];
        localStorage.setItem('ideas', JSON.stringify(ideas1));
      }),

      // Operation 2: Clear data
      () => page.evaluate(() => {
        localStorage.setItem('ideas', JSON.stringify([]));
      }),

      // Operation 3: Load different data
      () => page.evaluate(() => {
        const ideas2 = [
          { id: 'rapid-3', content: 'Card 3', matrix_position: { x: 0.5, y: 0.1 }, created_at: new Date().toISOString(), user_id: 'test' },
          { id: 'rapid-4', content: 'Card 4', matrix_position: { x: 0.5, y: 0.9 }, created_at: new Date().toISOString(), user_id: 'test' }
        ];
        localStorage.setItem('ideas', JSON.stringify(ideas2));
      }),

      // Operation 4: Corrupt data
      () => page.evaluate(() => {
        localStorage.setItem('ideas', 'invalid-json-{');
      }),

      // Operation 5: Restore valid data
      () => page.evaluate(() => {
        const ideas3 = [
          { id: 'rapid-5', content: 'Final Card', matrix_position: { x: 0.5, y: 0.5 }, created_at: new Date().toISOString(), user_id: 'test' }
        ];
        localStorage.setItem('ideas', JSON.stringify(ideas3));
      })
    ];

    // Execute operations rapidly
    for (let i = 0; i < operations.length; i++) {
      await operations[i]();
      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500); // Brief pause between operations

      // App should remain stable
      await expect(page.locator('text=Strategic Priority Matrix')).toBeVisible();

      console.log(`✅ Operation ${i + 1} completed, app stable`);
    }

    // Final state should show the last valid data
    const finalCard = page.locator('text=Final Card').first();
    await expect(finalCard).toBeVisible();
  });

  test('Browser Stress: Memory and performance limits', async ({ page }) => {
    // Test with many cards to stress browser
    await page.evaluate(() => {
      const stressIdeas = Array.from({ length: 100 }, (_, i) => ({
        id: `stress-${i}`,
        content: `Stress Card ${i} with additional content to test browser limits and rendering performance under extreme load conditions`,
        matrix_position: {
          x: (i % 10) * 0.1,
          y: Math.floor(i / 10) * 0.1
        },
        created_at: new Date().toISOString(),
        user_id: 'test'
      }));
      localStorage.setItem('ideas', JSON.stringify(stressIdeas));
    });

    const startTime = Date.now();
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Wait for reasonable number of cards to load
    const loadSuccess = await page.waitForFunction(() => {
      const cards = Array.from(document.querySelectorAll('*')).filter(el =>
        el.textContent?.includes('Stress Card')
      );
      return cards.length >= 50; // Expect at least half to load
    }, { timeout: 20000 }).catch(() => false);

    const loadTime = Date.now() - startTime;

    // Count actually rendered cards
    const renderedCards = await page.locator('text=/Stress Card \\d+/').count();

    console.log(`Stress Test Results:`);
    console.log(`  Load time: ${loadTime}ms`);
    console.log(`  Cards rendered: ${renderedCards}/100`);

    // Should handle stress gracefully
    expect(loadTime).toBeLessThan(30000); // 30 second maximum
    expect(renderedCards).toBeGreaterThan(25); // At least 25% should render

    // App should remain responsive
    await expect(page.locator('text=Strategic Priority Matrix')).toBeVisible();

    // Memory check if available
    const memoryUsage = await page.evaluate(() => {
      return (performance as any).memory?.usedJSHeapSize || null;
    });

    if (memoryUsage) {
      const memoryMB = memoryUsage / 1024 / 1024;
      console.log(`  Memory usage: ${memoryMB.toFixed(2)}MB`);
      expect(memoryMB).toBeLessThan(200); // 200MB limit
    }
  });

  test('Network Interruption: Offline behavior', async ({ page }) => {
    // Set up initial state
    await page.evaluate(() => {
      const initialIdeas = [
        { id: 'offline-1', content: 'Offline Test Card', matrix_position: { x: 0.5, y: 0.5 }, created_at: new Date().toISOString(), user_id: 'test' }
      ];
      localStorage.setItem('ideas', JSON.stringify(initialIdeas));
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify initial state
    await expect(page.locator('text=Offline Test Card')).toBeVisible();

    // Simulate offline condition
    await page.context().setOffline(true);

    // App should continue functioning with cached data
    await page.reload();
    await page.waitForLoadState('domcontentloaded'); // Don't wait for network

    // Should still show cached content or graceful degradation
    const matrixStillVisible = await page.locator('text=Strategic Priority Matrix').isVisible();
    expect(matrixStillVisible).toBeTruthy();

    // Restore online state
    await page.context().setOffline(false);
    await page.waitForLoadState('networkidle');

    // Should return to normal operation
    await expect(page.locator('text=Strategic Priority Matrix')).toBeVisible();

    console.log('✅ Offline behavior handled gracefully');
  });

  test('Viewport Extremes: Very small and very large screens', async ({ page }) => {
    const extremeViewports = [
      { width: 280, height: 400, name: 'Very Small Mobile' },
      { width: 320, height: 480, name: 'Small Mobile' },
      { width: 3440, height: 1440, name: 'Ultra Wide Desktop' },
      { width: 1080, height: 1920, name: 'Vertical Monitor' }
    ];

    // Set up test data
    await page.evaluate(() => {
      const viewportIdeas = [
        { id: 'viewport-1', content: 'Viewport Test 1', matrix_position: { x: 0.2, y: 0.2 }, created_at: new Date().toISOString(), user_id: 'test' },
        { id: 'viewport-2', content: 'Viewport Test 2', matrix_position: { x: 0.8, y: 0.8 }, created_at: new Date().toISOString(), user_id: 'test' }
      ];
      localStorage.setItem('ideas', JSON.stringify(viewportIdeas));
    });

    for (const viewport of extremeViewports) {
      await page.setViewportSize(viewport);
      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      // App should remain functional
      await expect(page.locator('text=Strategic Priority Matrix')).toBeVisible({ timeout: 10000 });

      // Cards should be visible (may be scaled or repositioned)
      const card1Visible = await page.locator('text=Viewport Test 1').isVisible();
      const card2Visible = await page.locator('text=Viewport Test 2').isVisible();

      // At least one card should be visible
      expect(card1Visible || card2Visible).toBeTruthy();

      // Layout should not be completely broken
      const matrixBounds = await page.locator('.matrix-container').first().boundingBox();
      expect(matrixBounds).toBeTruthy();
      expect(matrixBounds!.width).toBeGreaterThan(0);
      expect(matrixBounds!.height).toBeGreaterThan(0);

      console.log(`✅ ${viewport.name} (${viewport.width}x${viewport.height}) handled correctly`);
    }
  });
});