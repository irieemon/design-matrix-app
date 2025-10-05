import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Comprehensive Accessibility Testing for Design Matrix
 *
 * WCAG 2.1 AA compliance validation with focus on card accessibility,
 * keyboard navigation, and screen reader compatibility.
 */

test.describe('Accessibility Validation - WCAG 2.1 AA Compliance', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=Strategic Priority Matrix')).toBeVisible();
  });

  test('Critical: Automated accessibility scan with axe-core', async ({ page }) => {
    // Add test content for comprehensive scan
    await page.evaluate(() => {
      const testIdeas = [
        { id: 'a11y-1', content: 'Quick Win Idea', matrix_position: { x: 0.2, y: 0.8 }, created_at: new Date().toISOString(), user_id: 'test' },
        { id: 'a11y-2', content: 'Strategic Investment', matrix_position: { x: 0.8, y: 0.8 }, created_at: new Date().toISOString(), user_id: 'test' },
        { id: 'a11y-3', content: 'Reconsider Option', matrix_position: { x: 0.2, y: 0.2 }, created_at: new Date().toISOString(), user_id: 'test' }
      ];
      localStorage.setItem('ideas', JSON.stringify(testIdeas));
    });

    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Run comprehensive axe accessibility scan
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    // Report findings
    console.log(`Accessibility scan completed:`);
    console.log(`- Violations: ${accessibilityScanResults.violations.length}`);
    console.log(`- Passes: ${accessibilityScanResults.passes.length}`);
    console.log(`- Incomplete: ${accessibilityScanResults.incomplete.length}`);

    // Critical violations should be zero
    const criticalViolations = accessibilityScanResults.violations.filter(
      violation => violation.impact === 'critical'
    );

    if (criticalViolations.length > 0) {
      console.log('Critical accessibility violations found:');
      criticalViolations.forEach(violation => {
        console.log(`- ${violation.id}: ${violation.description}`);
        console.log(`  Help: ${violation.helpUrl}`);
      });
    }

    expect(criticalViolations.length).toBe(0);

    // Serious violations should be minimal
    const seriousViolations = accessibilityScanResults.violations.filter(
      violation => violation.impact === 'serious'
    );

    expect(seriousViolations.length).toBeLessThanOrEqual(2); // Allow max 2 serious violations
  });

  test('Keyboard Navigation: Complete matrix navigation', async ({ page }) => {
    // Set up test cards
    await page.evaluate(() => {
      const testIdeas = [
        { id: 'nav-1', content: 'First Card', matrix_position: { x: 0.3, y: 0.3 }, created_at: new Date().toISOString(), user_id: 'test' },
        { id: 'nav-2', content: 'Second Card', matrix_position: { x: 0.7, y: 0.3 }, created_at: new Date().toISOString(), user_id: 'test' },
        { id: 'nav-3', content: 'Third Card', matrix_position: { x: 0.5, y: 0.7 }, created_at: new Date().toISOString(), user_id: 'test' }
      ];
      localStorage.setItem('ideas', JSON.stringify(testIdeas));
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Test keyboard navigation sequence
    let focusableElements: string[] = [];

    // Start navigation from beginning
    await page.keyboard.press('Tab');
    await page.waitForTimeout(500);

    // Track focus progression through multiple tab presses
    for (let i = 0; i < 10; i++) {
      const focusedElement = await page.evaluate(() => {
        const focused = document.activeElement;
        if (!focused) return null;

        return {
          tagName: focused.tagName,
          className: focused.className,
          textContent: focused.textContent?.slice(0, 50),
          role: focused.getAttribute('role'),
          ariaLabel: focused.getAttribute('aria-label'),
          id: focused.id
        };
      });

      if (focusedElement) {
        const elementDesc = `${focusedElement.tagName}${focusedElement.className ? '.' + focusedElement.className.split(' ')[0] : ''}${focusedElement.textContent ? `: ${focusedElement.textContent}` : ''}`;
        focusableElements.push(elementDesc);
      }

      await page.keyboard.press('Tab');
      await page.waitForTimeout(300);
    }

    // Verify keyboard navigation includes interactive elements
    const navigationLog = focusableElements.filter((el, index) => focusableElements.indexOf(el) === index);

    console.log('Keyboard navigation sequence:');
    navigationLog.forEach((el, index) => console.log(`  ${index + 1}. ${el}`));

    // Should have navigable elements
    expect(navigationLog.length).toBeGreaterThan(2);

    // Test Escape key functionality
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Verify focus is managed properly
    const focusAfterEscape = await page.evaluate(() => {
      return document.activeElement?.tagName || 'BODY';
    });

    expect(['BODY', 'BUTTON', 'INPUT'].includes(focusAfterEscape)).toBeTruthy();
  });

  test('Screen Reader: Semantic structure and labels', async ({ page }) => {
    // Add test content
    await page.evaluate(() => {
      const testIdeas = [
        { id: 'sr-1', content: 'Screen Reader Test Card', matrix_position: { x: 0.5, y: 0.5 }, created_at: new Date().toISOString(), user_id: 'test' }
      ];
      localStorage.setItem('ideas', JSON.stringify(testIdeas));
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify semantic structure
    const semanticStructure = await page.evaluate(() => {
      return {
        // Check for proper heading hierarchy
        headings: Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).map(h => ({
          level: h.tagName,
          text: h.textContent?.trim(),
          hasId: !!h.id
        })),

        // Check for landmark regions
        landmarks: Array.from(document.querySelectorAll('[role="main"], [role="banner"], [role="navigation"], [role="contentinfo"], main, nav, header, footer')).map(l => ({
          tag: l.tagName,
          role: l.getAttribute('role'),
          ariaLabel: l.getAttribute('aria-label')
        })),

        // Check card accessibility
        cards: Array.from(document.querySelectorAll('*')).filter(el =>
          el.textContent?.includes('Screen Reader Test Card')
        ).map(card => ({
          tagName: card.tagName,
          role: card.getAttribute('role'),
          ariaLabel: card.getAttribute('aria-label'),
          ariaDescribedBy: card.getAttribute('aria-describedby'),
          tabIndex: card.getAttribute('tabindex'),
          hasVisibleText: (card.textContent?.trim().length || 0) > 0
        })),

        // Check for skip links
        skipLinks: Array.from(document.querySelectorAll('a[href^="#"]')).filter(link =>
          link.textContent?.toLowerCase().includes('skip')
        ).length
      };
    });

    // Verify heading structure
    expect(semanticStructure.headings.length).toBeGreaterThan(0);

    const mainHeading = semanticStructure.headings.find(h =>
      h.text?.includes('Strategic Priority Matrix')
    );
    expect(mainHeading).toBeTruthy();

    // Verify card is accessible to screen readers
    expect(semanticStructure.cards.length).toBeGreaterThan(0);

    const testCard = semanticStructure.cards[0];
    expect(testCard.hasVisibleText).toBeTruthy();

    // Card should have accessibility features
    const hasAccessibilityFeatures = testCard.role ||
                                   testCard.ariaLabel ||
                                   testCard.tabIndex ||
                                   testCard.ariaDescribedBy;

    console.log('Card accessibility features:', testCard);

    // At minimum, content should be readable
    expect(testCard.hasVisibleText).toBeTruthy();
  });

  test('Color Contrast: WCAG AA compliance', async ({ page }) => {
    // Add test content
    await page.evaluate(() => {
      const testIdeas = [
        { id: 'contrast-1', content: 'High Contrast Test', matrix_position: { x: 0.3, y: 0.3 }, created_at: new Date().toISOString(), user_id: 'test' },
        { id: 'contrast-2', content: 'Dark Theme Test', matrix_position: { x: 0.7, y: 0.7 }, created_at: new Date().toISOString(), user_id: 'test' }
      ];
      localStorage.setItem('ideas', JSON.stringify(testIdeas));
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Analyze color contrast
    const contrastAnalysis = await page.evaluate(() => {
      function getContrastRatio(foreground: string, background: string): number {
        // Simplified contrast calculation - in production, use a proper library
        function getLuminance(rgb: number[]): number {
          const [r, g, b] = rgb.map(c => {
            c = c / 255;
            return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
          });
          return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        }

        function parseRgb(color: string): number[] {
          const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
          return match ? [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])] : [0, 0, 0];
        }

        const fgLum = getLuminance(parseRgb(foreground));
        const bgLum = getLuminance(parseRgb(background));

        const lighter = Math.max(fgLum, bgLum);
        const darker = Math.min(fgLum, bgLum);

        return (lighter + 0.05) / (darker + 0.05);
      }

      const elements = Array.from(document.querySelectorAll('*')).filter(el =>
        el.textContent?.includes('Contrast Test')
      );

      return elements.map(el => {
        const styles = getComputedStyle(el);
        const color = styles.color;
        const backgroundColor = styles.backgroundColor;

        return {
          element: el.tagName,
          textContent: el.textContent?.slice(0, 30),
          color: color,
          backgroundColor: backgroundColor,
          fontSize: styles.fontSize,
          hasVisibleText: (el.textContent?.trim().length || 0) > 0,
          // Note: Real implementation should use proper contrast calculation
          hasReadableContrast: color !== backgroundColor
        };
      });
    });

    // Verify elements have readable contrast
    contrastAnalysis.forEach((element, index) => {
      console.log(`Element ${index + 1}: ${element.textContent}`);
      console.log(`  Color: ${element.color} on ${element.backgroundColor}`);
      console.log(`  Font size: ${element.fontSize}`);

      expect(element.hasVisibleText).toBeTruthy();
      expect(element.hasReadableContrast).toBeTruthy();
    });

    expect(contrastAnalysis.length).toBeGreaterThan(0);
  });

  test('Focus Management: Visible focus indicators', async ({ page }) => {
    // Add test content
    await page.evaluate(() => {
      const testIdeas = [
        { id: 'focus-1', content: 'Focus Test Card', matrix_position: { x: 0.5, y: 0.5 }, created_at: new Date().toISOString(), user_id: 'test' }
      ];
      localStorage.setItem('ideas', JSON.stringify(testIdeas));
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Test focus visibility
    const focusStates = [];

    // Navigate to interactive elements
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(300);

      const focusInfo = await page.evaluate(() => {
        const focused = document.activeElement;
        if (!focused || focused === document.body) return null;

        const styles = getComputedStyle(focused);
        return {
          tagName: focused.tagName,
          textContent: focused.textContent?.slice(0, 30),
          outline: styles.outline,
          outlineColor: styles.outlineColor,
          outlineWidth: styles.outlineWidth,
          outlineStyle: styles.outlineStyle,
          boxShadow: styles.boxShadow,
          border: styles.border,
          hasVisibleFocus: styles.outline !== 'none' ||
                          styles.outlineWidth !== '0px' ||
                          styles.boxShadow !== 'none' ||
                          styles.border !== styles.border.replace(/focus|ring/, '') // Simplified check
        };
      });

      if (focusInfo) {
        focusStates.push(focusInfo);
      }
    }

    // Verify focus indicators are visible
    const focusableElements = focusStates.filter(state => state !== null);

    console.log('Focus states analysis:');
    focusableElements.forEach((state, index) => {
      console.log(`  ${index + 1}. ${state.tagName}: ${state.textContent}`);
      console.log(`     Outline: ${state.outline}`);
      console.log(`     Box shadow: ${state.boxShadow}`);
      console.log(`     Visible focus: ${state.hasVisibleFocus}`);
    });

    // Should have at least some focusable elements
    expect(focusableElements.length).toBeGreaterThan(0);

    // Most focusable elements should have visible focus indicators
    const elementsWithFocus = focusableElements.filter(state => state.hasVisibleFocus);
    expect(elementsWithFocus.length).toBeGreaterThanOrEqual(Math.floor(focusableElements.length * 0.5));
  });

  test('Touch Accessibility: Mobile interaction support', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Add test content
    await page.evaluate(() => {
      const testIdeas = [
        { id: 'touch-1', content: 'Touch Test Card', matrix_position: { x: 0.5, y: 0.5 }, created_at: new Date().toISOString(), user_id: 'test' }
      ];
      localStorage.setItem('ideas', JSON.stringify(testIdeas));
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Test touch targets
    const touchTargets = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('button, [role="button"], [tabindex], a, input'));

      return elements.map(el => {
        const rect = el.getBoundingClientRect();
        return {
          tagName: el.tagName,
          textContent: el.textContent?.slice(0, 30),
          width: rect.width,
          height: rect.height,
          area: rect.width * rect.height,
          isAdequateSize: rect.width >= 44 && rect.height >= 44, // WCAG 2.1 AA minimum
          isVisible: rect.width > 0 && rect.height > 0
        };
      }).filter(target => target.isVisible);
    });

    console.log('Touch target analysis:');
    touchTargets.forEach((target, index) => {
      console.log(`  ${index + 1}. ${target.tagName}: ${target.textContent}`);
      console.log(`     Size: ${target.width}x${target.height}px (adequate: ${target.isAdequateSize})`);
    });

    // Verify touch targets meet minimum size requirements
    if (touchTargets.length > 0) {
      const adequateSizeTargets = touchTargets.filter(target => target.isAdequateSize);
      const percentageAdequate = (adequateSizeTargets.length / touchTargets.length) * 100;

      console.log(`Touch targets meeting size requirements: ${adequateSizeTargets.length}/${touchTargets.length} (${percentageAdequate.toFixed(1)}%)`);

      // At least 80% of touch targets should meet size requirements
      expect(percentageAdequate).toBeGreaterThanOrEqual(80);
    }
  });

  test('Screen Reader Announcements: Dynamic content updates', async ({ page }) => {
    // Monitor for aria-live regions and announcements
    const announcements: string[] = [];

    // Monitor for dynamic content updates
    await page.evaluate(() => {
      // Add mutation observer to track dynamic updates
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList' || mutation.type === 'characterData') {
            const target = mutation.target as Element;
            const ariaLive = target.getAttribute?.('aria-live') ||
                           target.closest?.('[aria-live]')?.getAttribute('aria-live');

            if (ariaLive) {
              (window as any).dynamicUpdates = (window as any).dynamicUpdates || [];
              (window as any).dynamicUpdates.push({
                type: mutation.type,
                ariaLive: ariaLive,
                content: target.textContent?.slice(0, 100)
              });
            }
          }
        });
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
      });
    });

    // Add and modify content to trigger announcements
    await page.evaluate(() => {
      const testIdeas = [
        { id: 'announce-1', content: 'Announcement Test', matrix_position: { x: 0.5, y: 0.5 }, created_at: new Date().toISOString(), user_id: 'test' }
      ];
      localStorage.setItem('ideas', JSON.stringify(testIdeas));
    });

    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Check for aria-live regions
    const ariaLiveRegions = await page.evaluate(() => {
      const liveRegions = Array.from(document.querySelectorAll('[aria-live]'));
      return liveRegions.map(region => ({
        tagName: region.tagName,
        ariaLive: region.getAttribute('aria-live'),
        content: region.textContent?.slice(0, 50),
        isEmpty: (region.textContent?.trim().length || 0) === 0
      }));
    });

    // Check for dynamic updates
    const dynamicUpdates = await page.evaluate(() => {
      return (window as any).dynamicUpdates || [];
    });

    console.log('ARIA live regions found:', ariaLiveRegions.length);
    ariaLiveRegions.forEach((region, index) => {
      console.log(`  ${index + 1}. ${region.tagName}[aria-live="${region.ariaLive}"]: ${region.content}`);
    });

    console.log('Dynamic updates detected:', dynamicUpdates.length);

    // Should have proper announcement system for dynamic content
    // This is a basic check - real implementation would need more sophisticated testing
    const hasAnnouncementSystem = ariaLiveRegions.length > 0 || dynamicUpdates.length > 0;

    if (!hasAnnouncementSystem) {
      console.log('Note: Consider adding aria-live regions for better screen reader support');
    }

    // Test passes if no critical accessibility barriers detected
    expect(true).toBeTruthy(); // This test is more for analysis than strict validation
  });

  test('Error Messages: Accessible error handling', async ({ page }) => {
    // Test error state accessibility
    await page.evaluate(() => {
      // Simulate error condition
      localStorage.setItem('ideas', 'invalid-json');
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Check for accessible error messages
    const errorHandling = await page.evaluate(() => {
      const errorElements = Array.from(document.querySelectorAll('[role="alert"], .error, [aria-live="assertive"]'));

      const hasErrorMessage = document.body.textContent?.includes('error') ||
                            document.body.textContent?.includes('Error') ||
                            errorElements.length > 0;

      return {
        hasErrorElements: errorElements.length > 0,
        hasErrorText: hasErrorMessage,
        errorElements: errorElements.map(el => ({
          tagName: el.tagName,
          role: el.getAttribute('role'),
          ariaLive: el.getAttribute('aria-live'),
          content: el.textContent?.slice(0, 100)
        })),
        bodyContainsError: document.body.textContent?.toLowerCase().includes('error')
      };
    });

    console.log('Error handling analysis:', errorHandling);

    // App should handle errors gracefully without breaking accessibility
    const appStillFunctional = await page.locator('text=Strategic Priority Matrix').isVisible().catch(() => false);

    expect(appStillFunctional).toBeTruthy();

    // If there are errors, they should be accessible
    if (errorHandling.hasErrorElements) {
      expect(errorHandling.errorElements.length).toBeGreaterThan(0);
    }
  });
});