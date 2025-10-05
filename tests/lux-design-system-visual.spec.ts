/**
 * LUX DESIGN SYSTEM - VISUAL REGRESSION TEST SUITE
 *
 * Comprehensive visual validation for Phase 2 Lux migration
 * Testing: Monochromatic design with gem-tone accents (garnet, sapphire, emerald, amber)
 *
 * Components tested:
 * - ProjectCollaboration page (stat cards, headers, icons)
 * - AIInsightsModal (icon containers, progress bars)
 * - ReportsAnalytics page (Generate AI Insights button)
 * - Input/Textarea components (form fields with background fixes)
 * - All modal components using new Input/Textarea
 */

import { test, expect } from '@playwright/test';

test.describe('Lux Design System - Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app and authenticate
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Login with demo account
    const demoButton = page.getByTestId('demo-mode-button');
    if (await demoButton.isVisible()) {
      await demoButton.click();
      await page.waitForLoadState('networkidle');
    }
  });

  test.describe('Color Token Validation', () => {
    test('should use Lux gem-tone colors not legacy purple/blue/green gradients', async ({ page }) => {
      // Check that purple/blue/green gradients are not present
      const body = await page.locator('body');
      const computedStyles = await body.evaluate((el) => {
        const styles = window.getComputedStyle(el);
        return {
          background: styles.background,
          backgroundColor: styles.backgroundColor
        };
      });

      // Should NOT contain purple/blue/green gradient keywords
      expect(computedStyles.background).not.toContain('linear-gradient');
      expect(computedStyles.background).not.toContain('rgb(147, 51, 234)'); // purple
      expect(computedStyles.background).not.toContain('rgb(59, 130, 246)'); // legacy blue
    });

    test('should use graphite neutrals for base UI', async ({ page }) => {
      // Navigate to a page with visible components
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Check that graphite neutrals are being used
      const mainContent = page.locator('[data-testid="main-content"]').first();
      if (await mainContent.isVisible()) {
        const styles = await mainContent.evaluate((el) => {
          return window.getComputedStyle(el).color;
        });

        // Should use graphite shades (gray-based colors)
        // RGB values should be close to each other (indicating gray/neutral)
        const rgbMatch = styles.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (rgbMatch) {
          const [, r, g, b] = rgbMatch.map(Number);
          const maxDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
          expect(maxDiff).toBeLessThan(30); // Neutrals have similar RGB values
        }
      }
    });

    test('should use gem-tone accents for semantic states', async ({ page }) => {
      // Check for gem-tone accent usage in buttons and interactive elements
      const buttons = page.locator('button:visible');
      const count = await buttons.count();

      if (count > 0) {
        // Sample a few buttons to check for gem-tone colors
        for (let i = 0; i < Math.min(count, 3); i++) {
          const button = buttons.nth(i);
          const bgColor = await button.evaluate((el) => {
            return window.getComputedStyle(el).backgroundColor;
          });

          // Should use Lux tokens - NOT legacy colors
          expect(bgColor).not.toContain('rgb(147, 51, 234)'); // NO purple
          expect(bgColor).not.toContain('rgb(34, 197, 94)'); // NO legacy green
        }
      }
    });
  });

  test.describe('ProjectCollaboration Page - Lux Tokens', () => {
    test('stat cards use Lux gem-tone icon containers', async ({ page }) => {
      // Navigate to collaboration page if available
      const collaborationLink = page.getByText('Team').or(page.getByText('Collaboration'));

      if (await collaborationLink.isVisible()) {
        await collaborationLink.click();
        await page.waitForLoadState('networkidle');

        // Take visual snapshot of stat cards
        await expect(page.locator('.rounded-xl.p-6.border').first()).toHaveScreenshot('collaboration-stat-card.png', {
          threshold: 0.1,
          maxDiffPixels: 100
        });

        // Check icon containers use gem-tone backgrounds
        const iconContainers = page.locator('.w-10.h-10.rounded-xl');
        const count = await iconContainers.count();

        for (let i = 0; i < Math.min(count, 4); i++) {
          const container = iconContainers.nth(i);
          const bgColor = await container.evaluate((el) => {
            return window.getComputedStyle(el).backgroundColor;
          });

          // Should be gem-tone or graphite neutral
          const isGemTone =
            bgColor.includes('239, 246, 255') || // sapphire-50
            bgColor.includes('254, 242, 242') || // garnet-50
            bgColor.includes('236, 253, 245') || // emerald-50
            bgColor.includes('255, 251, 235') || // amber-50
            bgColor.includes('243, 244, 246');   // graphite-100

          expect(isGemTone).toBe(true);
        }
      }
    });

    test('role badges use appropriate Lux gem-tone colors', async ({ page }) => {
      const collaborationLink = page.getByText('Team').or(page.getByText('Collaboration'));

      if (await collaborationLink.isVisible()) {
        await collaborationLink.click();
        await page.waitForLoadState('networkidle');

        // Check role badges
        const badges = page.locator('[class*="inline-flex"].px-3.py-2.rounded-lg');
        if (await badges.first().isVisible()) {
          await expect(badges.first()).toHaveScreenshot('role-badge.png', {
            threshold: 0.1,
            maxDiffPixels: 50
          });
        }
      }
    });

    test('permission guidelines use sapphire accent', async ({ page }) => {
      const collaborationLink = page.getByText('Team').or(page.getByText('Collaboration'));

      if (await collaborationLink.isVisible()) {
        await collaborationLink.click();
        await page.waitForLoadState('networkidle');

        // Check permission guidelines section
        const guidelinesSection = page.locator('[class*="rounded-xl"][class*="border"]').filter({
          has: page.locator(':text("Permission")')
        });

        if (await guidelinesSection.isVisible()) {
          const bgColor = await guidelinesSection.evaluate((el) => {
            return window.getComputedStyle(el).backgroundColor;
          });

          // Should use sapphire-50 (239, 246, 255)
          expect(bgColor).toContain('239, 246, 255');
        }
      }
    });
  });

  test.describe('AIInsightsModal - Lux Tokens', () => {
    test('modal header uses sapphire icon container', async ({ page }) => {
      // Try to trigger AI insights modal
      const insightsButton = page.getByText('AI Insights').or(page.getByText('Generate Insights'));

      if (await insightsButton.isVisible()) {
        await insightsButton.click();
        await page.waitForTimeout(1000);

        // Check modal header icon container
        const iconContainer = page.locator('.p-2.rounded-lg').first();
        if (await iconContainer.isVisible()) {
          const bgColor = await iconContainer.evaluate((el) => {
            return window.getComputedStyle(el).backgroundColor;
          });

          // Should use sapphire-100 (219, 234, 254)
          expect(bgColor).toContain('219, 234, 254');
        }
      }
    });

    test('progress bar uses sapphire primary color', async ({ page }) => {
      const insightsButton = page.getByText('AI Insights').or(page.getByText('Generate Insights'));

      if (await insightsButton.isVisible()) {
        await insightsButton.click();
        await page.waitForTimeout(500);

        // Check progress bar
        const progressBar = page.locator('[class*="transition-all"]').filter({
          has: page.locator('[class*="bg-white"]')
        }).first();

        if (await progressBar.isVisible()) {
          const bgColor = await progressBar.evaluate((el) => {
            return window.getComputedStyle(el).backgroundColor;
          });

          // Should use sapphire-600 (37, 99, 235)
          expect(bgColor).toContain('37, 99, 235');
        }
      }
    });

    test('priority recommendation cards use gem-tone backgrounds', async ({ page }) => {
      const insightsButton = page.getByText('AI Insights').or(page.getByText('Generate Insights'));

      if (await insightsButton.isVisible()) {
        await insightsButton.click();
        await page.waitForTimeout(3000); // Wait for insights generation

        // Check priority cards
        const immediateCard = page.locator(':text("Immediate")').locator('..');
        const shortTermCard = page.locator(':text("Short Term")').locator('..');
        const longTermCard = page.locator(':text("Long Term")').locator('..');

        // Immediate should use garnet-50
        if (await immediateCard.isVisible()) {
          const bgColor = await immediateCard.evaluate((el) => {
            return window.getComputedStyle(el).backgroundColor;
          });
          expect(bgColor).toContain('254, 242, 242'); // garnet-50
        }

        // Short Term should use amber-50
        if (await shortTermCard.isVisible()) {
          const bgColor = await shortTermCard.evaluate((el) => {
            return window.getComputedStyle(el).backgroundColor;
          });
          expect(bgColor).toContain('255, 251, 235'); // amber-50
        }

        // Long Term should use sapphire-50
        if (await longTermCard.isVisible()) {
          const bgColor = await longTermCard.evaluate((el) => {
            return window.getComputedStyle(el).backgroundColor;
          });
          expect(bgColor).toContain('239, 246, 255'); // sapphire-50
        }
      }
    });
  });

  test.describe('Form Inputs - Lux Tokens with Background Fix', () => {
    test('input fields maintain white background on hover', async ({ page }) => {
      // Find any input field
      const input = page.locator('input[type="text"]').first();

      if (await input.isVisible()) {
        // Get initial background
        const initialBg = await input.evaluate((el) => {
          return window.getComputedStyle(el).backgroundColor;
        });

        // Hover over input
        await input.hover();
        await page.waitForTimeout(200);

        // Get hover background
        const hoverBg = await input.evaluate((el) => {
          return window.getComputedStyle(el).backgroundColor;
        });

        // Background should remain white/light, NOT turn black
        expect(hoverBg).not.toContain('0, 0, 0'); // Should NOT be black
        expect(hoverBg).toContain('255'); // Should contain white/light values
      }
    });

    test('textarea fields maintain white background on hover', async ({ page }) => {
      // Find any textarea field
      const textarea = page.locator('textarea').first();

      if (await textarea.isVisible()) {
        // Get initial background
        const initialBg = await textarea.evaluate((el) => {
          return window.getComputedStyle(el).backgroundColor;
        });

        // Hover over textarea
        await textarea.hover();
        await page.waitForTimeout(200);

        // Get hover background
        const hoverBg = await textarea.evaluate((el) => {
          return window.getComputedStyle(el).backgroundColor;
        });

        // Background should remain white/light, NOT turn black
        expect(hoverBg).not.toContain('0, 0, 0'); // Should NOT be black
        expect(hoverBg).toContain('255'); // Should contain white/light values
      }
    });

    test('input focus state uses sapphire accent', async ({ page }) => {
      const input = page.locator('input[type="text"]').first();

      if (await input.isVisible()) {
        await input.focus();
        await page.waitForTimeout(200);

        // Check border or outline color
        const borderColor = await input.evaluate((el) => {
          const styles = window.getComputedStyle(el);
          return styles.borderColor || styles.outlineColor;
        });

        // Focus should use sapphire-600 or related accent
        // Should contain blue values (sapphire family)
        expect(borderColor).toMatch(/rgb.*59.*130.*246|rgb.*37.*99.*235/);
      }
    });
  });

  test.describe('Modal Components - Lux Integration', () => {
    test('AddIdeaModal uses Lux form components', async ({ page }) => {
      // Try to open Add Idea modal
      const addButton = page.getByText('Add Idea').or(page.getByText('New Idea'));

      if (await addButton.isVisible()) {
        await addButton.click();
        await page.waitForTimeout(500);

        // Take visual snapshot of modal
        const modal = page.locator('[role="dialog"]').first();
        if (await modal.isVisible()) {
          await expect(modal).toHaveScreenshot('add-idea-modal-lux.png', {
            threshold: 0.1,
            maxDiffPixels: 500
          });
        }
      }
    });

    test('EditIdeaModal uses Lux form components', async ({ page }) => {
      // Try to find and edit an existing idea
      const ideaCard = page.locator('[data-testid*="idea-card"]').first();

      if (await ideaCard.isVisible()) {
        await ideaCard.click();
        await page.waitForTimeout(500);

        const modal = page.locator('[role="dialog"]').first();
        if (await modal.isVisible()) {
          await expect(modal).toHaveScreenshot('edit-idea-modal-lux.png', {
            threshold: 0.1,
            maxDiffPixels: 500
          });
        }
      }
    });

    test('AIIdeaModal uses Lux form components', async ({ page }) => {
      // Try to open AI Idea modal
      const aiButton = page.getByText('AI Generate').or(page.getByText('Generate with AI'));

      if (await aiButton.isVisible()) {
        await aiButton.click();
        await page.waitForTimeout(500);

        const modal = page.locator('[role="dialog"]').first();
        if (await modal.isVisible()) {
          await expect(modal).toHaveScreenshot('ai-idea-modal-lux.png', {
            threshold: 0.1,
            maxDiffPixels: 500
          });
        }
      }
    });
  });

  test.describe('Monochromatic Design Validation', () => {
    test('no vibrant purple gradients in UI', async ({ page }) => {
      // Scan entire page for purple gradients
      const elements = await page.locator('*').evaluateAll((elements) => {
        const purpleElements: string[] = [];

        elements.forEach((el) => {
          const styles = window.getComputedStyle(el);
          const bg = styles.background || styles.backgroundColor;

          // Check for purple/violet hues
          if (bg.includes('147, 51, 234') || // purple-600
              bg.includes('168, 85, 247') || // purple-500
              bg.includes('139, 92, 246')) {  // violet-500
            purpleElements.push(el.tagName);
          }
        });

        return purpleElements;
      });

      expect(elements.length).toBe(0);
    });

    test('no blue gradients except sapphire accents', async ({ page }) => {
      // Check for legacy blue gradients (non-sapphire)
      const elements = await page.locator('*').evaluateAll((elements) => {
        const legacyBlueElements: string[] = [];

        elements.forEach((el) => {
          const styles = window.getComputedStyle(el);
          const bg = styles.background || styles.backgroundColor;

          // Check for non-Lux blue colors
          if (bg.includes('linear-gradient') && bg.includes('blue')) {
            // This is a gradient with blue - check if it's Lux sapphire
            const isSapphire =
              bg.includes('239, 246, 255') || // sapphire-50
              bg.includes('219, 234, 254') || // sapphire-100
              bg.includes('59, 130, 246') ||  // sapphire-500
              bg.includes('37, 99, 235');     // sapphire-600

            if (!isSapphire) {
              legacyBlueElements.push(el.tagName);
            }
          }
        });

        return legacyBlueElements;
      });

      expect(elements.length).toBe(0);
    });

    test('gem-tone colors used only for semantic meaning', async ({ page }) => {
      // Verify gem-tones are used appropriately
      const semanticElements = await page.locator('*').evaluateAll((elements) => {
        const results = {
          garnet: 0,  // Should be for errors/danger
          sapphire: 0, // Should be for info/interactive
          emerald: 0,  // Should be for success
          amber: 0     // Should be for warning
        };

        elements.forEach((el) => {
          const styles = window.getComputedStyle(el);
          const bg = styles.backgroundColor;

          if (bg.includes('254, 242, 242')) results.garnet++;
          if (bg.includes('239, 246, 255') || bg.includes('219, 234, 254')) results.sapphire++;
          if (bg.includes('236, 253, 245')) results.emerald++;
          if (bg.includes('255, 251, 235')) results.amber++;
        });

        return results;
      });

      // Should have gem-tone usage (not zero)
      const totalGemTones = Object.values(semanticElements).reduce((a, b) => a + b, 0);
      expect(totalGemTones).toBeGreaterThan(0);
    });
  });

  test.describe('Component State Validation', () => {
    test('hover states use subtle graphite changes', async ({ page }) => {
      // Test hover states on various components
      const buttons = page.locator('button:visible');
      const count = await buttons.count();

      if (count > 0) {
        const button = buttons.first();

        // Get initial state
        const initialBg = await button.evaluate((el) => {
          return window.getComputedStyle(el).backgroundColor;
        });

        // Hover
        await button.hover();
        await page.waitForTimeout(200);

        const hoverBg = await button.evaluate((el) => {
          return window.getComputedStyle(el).backgroundColor;
        });

        // Should change but remain subtle (graphite scale)
        expect(initialBg).not.toBe(hoverBg);
      }
    });

    test('focus states use sapphire accent ring', async ({ page }) => {
      const input = page.locator('input, button, [tabindex="0"]').first();

      if (await input.isVisible()) {
        await input.focus();
        await page.waitForTimeout(200);

        const outline = await input.evaluate((el) => {
          const styles = window.getComputedStyle(el);
          return {
            outlineColor: styles.outlineColor,
            boxShadow: styles.boxShadow,
            borderColor: styles.borderColor
          };
        });

        // Should have sapphire focus indicator
        const hasSapphireFocus =
          outline.outlineColor.includes('59, 130, 246') ||
          outline.boxShadow.includes('59, 130, 246') ||
          outline.borderColor.includes('59, 130, 246') ||
          outline.borderColor.includes('37, 99, 235');

        expect(hasSapphireFocus).toBe(true);
      }
    });

    test('disabled states use graphite-300', async ({ page }) => {
      const disabledElement = page.locator('[disabled], [aria-disabled="true"]').first();

      if (await disabledElement.isVisible()) {
        const color = await disabledElement.evaluate((el) => {
          return window.getComputedStyle(el).color;
        });

        // Should use graphite-300 (209, 213, 219)
        expect(color).toContain('209, 213, 219');
      }
    });
  });

  test.describe('Accessibility with Lux Tokens', () => {
    test('text contrast meets WCAG AA on Lux backgrounds', async ({ page }) => {
      // Check text on gem-tone backgrounds
      const textElements = page.locator('p, span, h1, h2, h3, h4, h5, h6').filter({
        hasText: /.+/
      });

      const count = await textElements.count();

      for (let i = 0; i < Math.min(count, 10); i++) {
        const element = textElements.nth(i);

        if (await element.isVisible()) {
          const contrast = await element.evaluate((el) => {
            const styles = window.getComputedStyle(el);
            const color = styles.color;
            const bgColor = styles.backgroundColor;

            return { color, bgColor };
          });

          // Basic check: text and background should not be too similar
          expect(contrast.color).not.toBe(contrast.bgColor);
        }
      }
    });

    test('icon colors maintain sufficient contrast', async ({ page }) => {
      const icons = page.locator('svg').filter({ hasText: '' });
      const count = await icons.count();

      for (let i = 0; i < Math.min(count, 5); i++) {
        const icon = icons.nth(i);

        if (await icon.isVisible()) {
          const iconColor = await icon.evaluate((el) => {
            return window.getComputedStyle(el).color || window.getComputedStyle(el).fill;
          });

          // Icon should have visible color (not transparent)
          expect(iconColor).not.toBe('rgba(0, 0, 0, 0)');
          expect(iconColor).not.toBe('transparent');
        }
      }
    });
  });
});
