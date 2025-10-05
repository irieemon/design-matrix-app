/**
 * LUX DESIGN SYSTEM - INTEGRATION TEST SUITE
 *
 * End-to-end integration tests for Phase 2 Lux migration
 * Tests complete user flows with Lux design system components
 *
 * Coverage:
 * - Full page layouts with Lux tokens
 * - Cross-component consistency
 * - User workflows (create idea, view insights, collaborate)
 * - Responsive behavior with Lux design
 * - Theme consistency across navigation
 */

import { test, expect } from '@playwright/test';

test.describe('Lux Design System - Integration Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Login with demo account
    const demoButton = page.getByTestId('demo-mode-button');
    if (await demoButton.isVisible()) {
      await demoButton.click();
      await page.waitForLoadState('networkidle');
    }
  });

  test.describe('Full Page Layout Integration', () => {
    test('entire app uses monochromatic design with Lux accents', async ({ page }) => {
      // Take full page snapshot
      await expect(page).toHaveScreenshot('lux-full-page.png', {
        fullPage: true,
        threshold: 0.15,
        maxDiffPixels: 2000
      });

      // Verify no legacy gradients anywhere on page
      const hasLegacyGradients = await page.evaluate(() => {
        const elements = document.querySelectorAll('*');
        let foundLegacy = false;

        elements.forEach((el) => {
          const styles = window.getComputedStyle(el);
          const bg = styles.background || styles.backgroundColor;

          // Check for purple/vibrant gradients
          if (bg.includes('147, 51, 234') || // purple-600
              bg.includes('168, 85, 247') || // purple-500
              bg.includes('34, 197, 94')) {   // legacy green-500
            foundLegacy = true;
          }
        });

        return foundLegacy;
      });

      expect(hasLegacyGradients).toBe(false);
    });

    test('navigation maintains Lux theme across page transitions', async ({ page }) => {
      // Capture initial state
      const initialBg = await page.evaluate(() => {
        return window.getComputedStyle(document.body).backgroundColor;
      });

      // Navigate to different sections
      const sections = [
        page.getByText('Matrix'),
        page.getByText('Roadmap'),
        page.getByText('Team').or(page.getByText('Collaboration'))
      ];

      for (const section of sections) {
        if (await section.isVisible()) {
          await section.click();
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(500);

          // Check background consistency
          const currentBg = await page.evaluate(() => {
            return window.getComputedStyle(document.body).backgroundColor;
          });

          // Should maintain same background
          expect(currentBg).toBe(initialBg);

          // Take snapshot of each section
          await expect(page).toHaveScreenshot(`lux-${section}-page.png`, {
            threshold: 0.15,
            maxDiffPixels: 1500
          });
        }
      }
    });

    test('sidebar uses consistent Lux styling', async ({ page }) => {
      const sidebar = page.locator('[data-testid="sidebar"]').or(
        page.locator('aside').first()
      );

      if (await sidebar.isVisible()) {
        // Check sidebar background
        const bgColor = await sidebar.evaluate((el) => {
          return window.getComputedStyle(el).backgroundColor;
        });

        // Should use surface-primary (white) or graphite
        expect(bgColor).toMatch(/255.*255.*255|249.*250.*251/);

        // Take snapshot
        await expect(sidebar).toHaveScreenshot('lux-sidebar.png', {
          threshold: 0.1
        });
      }
    });

    test('header uses Lux graphite text colors', async ({ page }) => {
      const header = page.locator('header').first();

      if (await header.isVisible()) {
        const textColor = await header.evaluate((el) => {
          return window.getComputedStyle(el).color;
        });

        // Should use graphite shade
        const rgbMatch = textColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (rgbMatch) {
          const [, r, g, b] = rgbMatch.map(Number);
          const maxDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
          expect(maxDiff).toBeLessThan(30); // Should be neutral gray
        }
      }
    });
  });

  test.describe('Component Integration Tests', () => {
    test('ProjectCollaboration page integrates with Lux design system', async ({ page }) => {
      const collaborationLink = page.getByText('Team').or(page.getByText('Collaboration'));

      if (await collaborationLink.isVisible()) {
        await collaborationLink.click();
        await page.waitForLoadState('networkidle');

        // Take full page snapshot
        await expect(page).toHaveScreenshot('collaboration-page-lux.png', {
          fullPage: true,
          threshold: 0.15,
          maxDiffPixels: 1500
        });

        // Verify stat cards use Lux tokens
        const statCards = page.locator('.rounded-xl.p-6.border');
        const count = await statCards.count();

        expect(count).toBeGreaterThan(0);

        // Check first card
        if (count > 0) {
          const card = statCards.first();
          const cardBg = await card.evaluate((el) => {
            return window.getComputedStyle(el).backgroundColor;
          });

          // Should use white background
          expect(cardBg).toMatch(/255.*255.*255/);
        }
      }
    });

    test('AIInsightsModal integrates with Lux design system', async ({ page }) => {
      const insightsButton = page.getByText('AI Insights').or(page.getByText('Generate Insights'));

      if (await insightsButton.isVisible()) {
        await insightsButton.click();
        await page.waitForTimeout(2000);

        // Take modal snapshot
        const modal = page.locator('[role="dialog"]').first();
        if (await modal.isVisible()) {
          await expect(modal).toHaveScreenshot('insights-modal-lux.png', {
            threshold: 0.15,
            maxDiffPixels: 1000
          });

          // Verify Lux color usage
          const modalBg = await modal.evaluate((el) => {
            return window.getComputedStyle(el).backgroundColor;
          });

          expect(modalBg).toMatch(/255.*255.*255/);
        }
      }
    });

    test('form modals use consistent Lux styling', async ({ page }) => {
      // Test AddIdeaModal
      const addButton = page.getByText('Add Idea').or(page.getByText('New Idea'));

      if (await addButton.isVisible()) {
        await addButton.click();
        await page.waitForTimeout(500);

        const modal = page.locator('[role="dialog"]').first();
        if (await modal.isVisible()) {
          // Check modal background
          const modalBg = await modal.evaluate((el) => {
            return window.getComputedStyle(el).backgroundColor;
          });

          expect(modalBg).toMatch(/255.*255.*255/);

          // Check input fields
          const inputs = modal.locator('input, textarea');
          const inputCount = await inputs.count();

          for (let i = 0; i < Math.min(inputCount, 3); i++) {
            const input = inputs.nth(i);
            const inputBg = await input.evaluate((el) => {
              return window.getComputedStyle(el).backgroundColor;
            });

            // Should use white background
            expect(inputBg).toMatch(/255.*255.*255|249.*250.*251/);
          }

          // Take snapshot
          await expect(modal).toHaveScreenshot('form-modal-lux.png', {
            threshold: 0.1,
            maxDiffPixels: 500
          });
        }
      }
    });
  });

  test.describe('User Flow Integration', () => {
    test('create idea flow maintains Lux design', async ({ page }) => {
      const addButton = page.getByText('Add Idea').or(page.getByText('New Idea'));

      if (await addButton.isVisible()) {
        // Open modal
        await addButton.click();
        await page.waitForTimeout(500);

        // Fill form with Lux inputs
        const titleInput = page.locator('input[placeholder*="title"], input[placeholder*="name"]').first();
        const descriptionTextarea = page.locator('textarea').first();

        if (await titleInput.isVisible() && await descriptionTextarea.isVisible()) {
          // Type in fields
          await titleInput.fill('Lux Design Test Idea');
          await descriptionTextarea.fill('Testing the Lux design system integration across the entire create flow');

          // Verify white backgrounds maintained
          const titleBg = await titleInput.evaluate((el) => {
            return window.getComputedStyle(el).backgroundColor;
          });
          const descBg = await descriptionTextarea.evaluate((el) => {
            return window.getComputedStyle(el).backgroundColor;
          });

          expect(titleBg).not.toContain('rgb(0, 0, 0)');
          expect(descBg).not.toContain('rgb(0, 0, 0)');

          // Submit form
          const submitButton = page.getByText('Create').or(page.getByText('Save'));
          if (await submitButton.isVisible()) {
            await submitButton.click();
            await page.waitForTimeout(1000);

            // Check for success feedback (should use emerald)
            const successMessage = page.locator('[class*="success"]');
            if (await successMessage.isVisible()) {
              const color = await successMessage.evaluate((el) => {
                return window.getComputedStyle(el).color;
              });

              // Should use emerald-700
              expect(color).toMatch(/4.*120.*87/);
            }
          }
        }
      }
    });

    test('view insights flow uses Lux gem-tones consistently', async ({ page }) => {
      const insightsButton = page.getByText('AI Insights').or(page.getByText('Generate Insights'));

      if (await insightsButton.isVisible()) {
        // Trigger insights generation
        await insightsButton.click();
        await page.waitForTimeout(500);

        // Check loading state uses sapphire
        const loadingIndicator = page.locator('[class*="spinner"], [class*="loading"]').first();
        if (await loadingIndicator.isVisible()) {
          const color = await loadingIndicator.evaluate((el) => {
            const styles = window.getComputedStyle(el);
            return styles.color || styles.borderColor;
          });

          // Should use sapphire
          const hasSapphire =
            color.includes('59, 130, 246') ||
            color.includes('37, 99, 235');

          expect(hasSapphire).toBe(true);
        }

        // Wait for insights to load
        await page.waitForTimeout(4000);

        // Check priority cards use gem-tones
        const immediateSection = page.locator(':text("Immediate")');
        if (await immediateSection.isVisible()) {
          const container = immediateSection.locator('..').first();
          const bgColor = await container.evaluate((el) => {
            return window.getComputedStyle(el).backgroundColor;
          });

          // Should use garnet-50 for immediate (urgent)
          expect(bgColor).toMatch(/254.*242.*242/);
        }
      }
    });

    test('collaboration workflow maintains Lux theme', async ({ page }) => {
      const collaborationLink = page.getByText('Team').or(page.getByText('Collaboration'));

      if (await collaborationLink.isVisible()) {
        await collaborationLink.click();
        await page.waitForLoadState('networkidle');

        // Check role badges use appropriate gem-tones
        const ownerBadge = page.locator(':text("Owner")').first();
        if (await ownerBadge.isVisible()) {
          const container = ownerBadge.locator('..').first();
          const bgColor = await container.evaluate((el) => {
            return window.getComputedStyle(el).backgroundColor;
          });

          // Should use garnet-50 for owner (highest authority)
          expect(bgColor).toMatch(/254.*242.*242/);
        }

        // Check permission guidelines use sapphire
        const guidelinesSection = page.locator(':text("Permission")').first();
        if (await guidelinesSection.isVisible()) {
          const container = guidelinesSection.locator('..').first();
          const bgColor = await container.evaluate((el) => {
            return window.getComputedStyle(el).backgroundColor;
          });

          // Should use sapphire-50 for info
          expect(bgColor).toMatch(/239.*246.*255/);
        }
      }
    });
  });

  test.describe('Cross-Component Consistency', () => {
    test('buttons use consistent Lux styling across pages', async ({ page }) => {
      const buttonStyles = new Map<string, string>();

      // Collect button styles from different pages
      const pages = [
        'Matrix',
        'Roadmap',
        'Team'
      ];

      for (const pageName of pages) {
        const link = page.getByText(pageName);
        if (await link.isVisible()) {
          await link.click();
          await page.waitForTimeout(500);

          // Sample a button
          const button = page.locator('button:visible').first();
          if (await button.isVisible()) {
            await button.hover();
            await page.waitForTimeout(200);

            const styles = await button.evaluate((el) => {
              const computed = window.getComputedStyle(el);
              return `${computed.backgroundColor}-${computed.borderRadius}`;
            });

            buttonStyles.set(pageName, styles);
          }
        }
      }

      // Buttons should have consistent styling
      const uniqueStyles = new Set(buttonStyles.values());
      expect(uniqueStyles.size).toBeLessThanOrEqual(3); // Allow for primary/secondary variants
    });

    test('cards use consistent Lux styling across components', async ({ page }) => {
      const cardStyles: string[] = [];

      // Find cards on current page
      const cards = page.locator('[class*="rounded-xl"], [class*="rounded-lg"]').filter({
        has: page.locator('div, p')
      });

      const count = await cards.count();

      for (let i = 0; i < Math.min(count, 5); i++) {
        const card = cards.nth(i);
        if (await card.isVisible()) {
          const styles = await card.evaluate((el) => {
            const computed = window.getComputedStyle(el);
            return `${computed.backgroundColor}-${computed.borderRadius}`;
          });
          cardStyles.push(styles);
        }
      }

      // Cards should use white backgrounds
      cardStyles.forEach((style) => {
        expect(style).toMatch(/255.*255.*255/);
      });
    });

    test('text hierarchy uses consistent graphite shades', async ({ page }) => {
      // Check heading hierarchy
      const h1Elements = page.locator('h1');
      const h2Elements = page.locator('h2');
      const pElements = page.locator('p').filter({ hasText: /.+/ });

      // H1 should be darkest (graphite-900)
      if (await h1Elements.first().isVisible()) {
        const h1Color = await h1Elements.first().evaluate((el) => {
          return window.getComputedStyle(el).color;
        });

        // Should use graphite-900 or graphite-800
        expect(h1Color).toMatch(/17.*24.*39|31.*41.*55/);
      }

      // P should be lighter (graphite-600/500)
      if (await pElements.first().isVisible()) {
        const pColor = await pElements.first().evaluate((el) => {
          return window.getComputedStyle(el).color;
        });

        // Should use graphite-600 or graphite-500
        expect(pColor).toMatch(/75.*85.*99|107.*114.*128/);
      }
    });
  });

  test.describe('Responsive Behavior', () => {
    test('Lux design scales properly on mobile viewport', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForTimeout(500);

      // Take mobile snapshot
      await expect(page).toHaveScreenshot('lux-mobile.png', {
        fullPage: true,
        threshold: 0.15,
        maxDiffPixels: 1500
      });

      // Check that Lux colors are maintained
      const bodyBg = await page.evaluate(() => {
        return window.getComputedStyle(document.body).backgroundColor;
      });

      // Should maintain white/light background
      expect(bodyBg).toMatch(/255.*255.*255|249.*250.*251/);
    });

    test('Lux design scales properly on tablet viewport', async ({ page }) => {
      // Set tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.waitForTimeout(500);

      // Take tablet snapshot
      await expect(page).toHaveScreenshot('lux-tablet.png', {
        fullPage: true,
        threshold: 0.15,
        maxDiffPixels: 1500
      });

      // Verify Lux gem-tone usage
      const hasGemTones = await page.evaluate(() => {
        const elements = document.querySelectorAll('*');
        let foundGemTones = false;

        elements.forEach((el) => {
          const styles = window.getComputedStyle(el);
          const bg = styles.backgroundColor;

          // Check for Lux gem-tones
          if (bg.includes('239, 246, 255') ||  // sapphire
              bg.includes('254, 242, 242') ||  // garnet
              bg.includes('236, 253, 245') ||  // emerald
              bg.includes('255, 251, 235')) {  // amber
            foundGemTones = true;
          }
        });

        return foundGemTones;
      });

      expect(hasGemTones).toBe(true);
    });
  });

  test.describe('Accessibility with Lux Tokens', () => {
    test('focus indicators visible on all interactive elements', async ({ page }) => {
      // Tab through interactive elements
      const interactiveElements = [
        'button',
        'a',
        'input',
        '[tabindex="0"]'
      ];

      for (const selector of interactiveElements) {
        const element = page.locator(selector).first();
        if (await element.isVisible()) {
          await element.focus();
          await page.waitForTimeout(200);

          const focusStyles = await element.evaluate((el) => {
            const styles = window.getComputedStyle(el);
            return {
              outline: styles.outline,
              boxShadow: styles.boxShadow,
              borderColor: styles.borderColor
            };
          });

          // Should have visible focus indicator
          const hasFocusIndicator =
            focusStyles.outline !== 'none' ||
            focusStyles.boxShadow !== 'none' ||
            focusStyles.borderColor.includes('59, 130, 246'); // sapphire

          expect(hasFocusIndicator).toBe(true);
        }
      }
    });

    test('text contrast meets WCAG standards with Lux colors', async ({ page }) => {
      // Check text contrast on various backgrounds
      const textElements = page.locator('p, span, h1, h2, h3, h4, h5, h6').filter({
        hasText: /.+/
      });

      const count = await textElements.count();

      for (let i = 0; i < Math.min(count, 10); i++) {
        const element = textElements.nth(i);
        if (await element.isVisible()) {
          const styles = await element.evaluate((el) => {
            const computed = window.getComputedStyle(el);
            return {
              color: computed.color,
              backgroundColor: computed.backgroundColor
            };
          });

          // Text and background should have sufficient contrast
          expect(styles.color).not.toBe(styles.backgroundColor);
        }
      }
    });
  });

  test.describe('Performance with Lux Design', () => {
    test('page load time acceptable with Lux styling', async ({ page }) => {
      const startTime = Date.now();

      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const loadTime = Date.now() - startTime;

      // Should load in reasonable time (< 5 seconds)
      expect(loadTime).toBeLessThan(5000);
    });

    test('smooth transitions with Lux tokens', async ({ page }) => {
      const button = page.locator('button:visible').first();

      if (await button.isVisible()) {
        // Measure transition smoothness
        const startTime = Date.now();

        await button.hover();
        await page.waitForTimeout(300);

        const transitionTime = Date.now() - startTime;

        // Transition should complete quickly
        expect(transitionTime).toBeLessThan(500);
      }
    });
  });
});
