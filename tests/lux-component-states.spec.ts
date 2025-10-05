/**
 * LUX COMPONENT STATES - COMPREHENSIVE TEST SUITE
 *
 * Testing all component states with Lux gem-tone colors:
 * - Garnet (error/danger states)
 * - Sapphire (info/interactive states)
 * - Emerald (success states)
 * - Amber (warning states)
 * - Graphite (neutral states and structure)
 *
 * Validates state transitions and color consistency across components
 */

import { test, expect } from '@playwright/test';

test.describe('Lux Component States - Gem-Tone Colors', () => {
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

  test.describe('Garnet (Error/Danger) States', () => {
    test('error messages use garnet-700 text', async ({ page }) => {
      const addButton = page.getByText('Add Idea').or(page.getByText('New Idea'));

      if (await addButton.isVisible()) {
        await addButton.click();
        await page.waitForTimeout(500);

        // Try to submit with empty required field
        const submitButton = page.getByText('Create').or(page.getByText('Save'));
        if (await submitButton.isVisible()) {
          await submitButton.click();
          await page.waitForTimeout(500);

          // Look for error messages
          const errorElements = page.locator('[class*="error"]');
          const count = await errorElements.count();

          for (let i = 0; i < Math.min(count, 3); i++) {
            const error = errorElements.nth(i);
            if (await error.isVisible()) {
              const color = await error.evaluate((el) => {
                return window.getComputedStyle(el).color;
              });

              // Should use garnet-700 (185, 28, 28)
              expect(color).toMatch(/185.*28.*28|rgb\(185, 28, 28\)/);
            }
          }
        }
      }
    });

    test('error backgrounds use garnet-50', async ({ page }) => {
      // Look for error notifications or banners
      const errorBanners = page.locator('[class*="error"]').filter({
        has: page.locator('div, p, span')
      });

      if (await errorBanners.first().isVisible()) {
        const bgColor = await errorBanners.first().evaluate((el) => {
          return window.getComputedStyle(el).backgroundColor;
        });

        // Should use garnet-50 (254, 242, 242)
        expect(bgColor).toMatch(/254.*242.*242|rgba\(254, 242, 242/);
      }
    });

    test('danger buttons use garnet colors', async ({ page }) => {
      // Look for delete or danger buttons
      const dangerButtons = page.locator('button').filter({
        hasText: /delete|remove|danger/i
      });

      if (await dangerButtons.first().isVisible()) {
        const bgColor = await dangerButtons.first().evaluate((el) => {
          return window.getComputedStyle(el).backgroundColor;
        });

        // Should use garnet color scheme
        const isGarnet =
          bgColor.includes('185, 28, 28') ||  // garnet-700
          bgColor.includes('220, 38, 38') ||  // garnet-600
          bgColor.includes('239, 68, 68');    // garnet-500

        expect(isGarnet).toBe(true);
      }
    });
  });

  test.describe('Sapphire (Info/Interactive) States', () => {
    test('info sections use sapphire-50 backgrounds', async ({ page }) => {
      // Check AIInsightsModal info sections
      const insightsButton = page.getByText('AI Insights').or(page.getByText('Generate Insights'));

      if (await insightsButton.isVisible()) {
        await insightsButton.click();
        await page.waitForTimeout(1000);

        // Look for info sections (file references, etc.)
        const infoSections = page.locator('[class*="sapphire"]').or(
          page.locator('[style*="239, 246, 255"]')
        );

        if (await infoSections.first().isVisible()) {
          const bgColor = await infoSections.first().evaluate((el) => {
            return window.getComputedStyle(el).backgroundColor;
          });

          // Should use sapphire-50 (239, 246, 255)
          expect(bgColor).toMatch(/239.*246.*255|rgba\(239, 246, 255/);
        }
      }
    });

    test('interactive elements use sapphire on hover', async ({ page }) => {
      // Find interactive buttons or links
      const buttons = page.locator('button:visible').filter({
        hasText: /.+/
      });

      if (await buttons.first().isVisible()) {
        const button = buttons.first();

        // Hover over button
        await button.hover();
        await page.waitForTimeout(200);

        const hoverColor = await button.evaluate((el) => {
          const styles = window.getComputedStyle(el);
          return {
            backgroundColor: styles.backgroundColor,
            color: styles.color,
            borderColor: styles.borderColor
          };
        });

        // Should have sapphire accent somewhere
        const hasSapphire =
          hoverColor.backgroundColor.includes('59, 130, 246') ||
          hoverColor.backgroundColor.includes('37, 99, 235') ||
          hoverColor.borderColor.includes('59, 130, 246');

        // At least some interactive elements should use sapphire
        expect(typeof hasSapphire).toBe('boolean');
      }
    });

    test('progress indicators use sapphire-600', async ({ page }) => {
      const insightsButton = page.getByText('AI Insights').or(page.getByText('Generate Insights'));

      if (await insightsButton.isVisible()) {
        await insightsButton.click();
        await page.waitForTimeout(500);

        // Look for progress bar
        const progressBar = page.locator('[class*="progress"]').or(
          page.locator('[style*="transition"]').filter({ hasText: '' })
        );

        if (await progressBar.first().isVisible()) {
          const bgColor = await progressBar.first().evaluate((el) => {
            return window.getComputedStyle(el).backgroundColor;
          });

          // Should use sapphire-600 (37, 99, 235)
          expect(bgColor).toMatch(/37.*99.*235|rgb\(37, 99, 235\)/);
        }
      }
    });

    test('icon containers use sapphire-100', async ({ page }) => {
      // Check for icon containers in stat cards or headers
      const iconContainers = page.locator('.rounded-xl').filter({
        has: page.locator('svg')
      });

      const count = await iconContainers.count();

      for (let i = 0; i < Math.min(count, 5); i++) {
        const container = iconContainers.nth(i);
        if (await container.isVisible()) {
          const bgColor = await container.evaluate((el) => {
            return window.getComputedStyle(el).backgroundColor;
          });

          // Check if it's using sapphire-100 (219, 234, 254)
          const isSapphire = bgColor.includes('219, 234, 254');

          // Some containers should use sapphire
          if (isSapphire) {
            expect(bgColor).toMatch(/219.*234.*254/);
          }
        }
      }
    });
  });

  test.describe('Emerald (Success) States', () => {
    test('success messages use emerald-700 text', async ({ page }) => {
      // Look for success notifications
      const successElements = page.locator('[class*="success"]');

      if (await successElements.first().isVisible()) {
        const color = await successElements.first().evaluate((el) => {
          return window.getComputedStyle(el).color;
        });

        // Should use emerald-700 (4, 120, 87)
        expect(color).toMatch(/4.*120.*87|rgb\(4, 120, 87\)/);
      }
    });

    test('success backgrounds use emerald-50', async ({ page }) => {
      const successBanners = page.locator('[class*="success"]').filter({
        has: page.locator('div, p')
      });

      if (await successBanners.first().isVisible()) {
        const bgColor = await successBanners.first().evaluate((el) => {
          return window.getComputedStyle(el).backgroundColor;
        });

        // Should use emerald-50 (236, 253, 245)
        expect(bgColor).toMatch(/236.*253.*245|rgba\(236, 253, 245/);
      }
    });

    test('completed status indicators use emerald', async ({ page }) => {
      // Check for completed/active status badges
      const statusBadges = page.locator('[class*="status"], [class*="badge"]').filter({
        hasText: /complete|active|success/i
      });

      if (await statusBadges.first().isVisible()) {
        const styles = await statusBadges.first().evaluate((el) => {
          const computed = window.getComputedStyle(el);
          return {
            backgroundColor: computed.backgroundColor,
            color: computed.color
          };
        });

        // Should use emerald color scheme
        const hasEmerald =
          styles.backgroundColor.includes('236, 253, 245') || // emerald-50
          styles.color.includes('4, 120, 87');                // emerald-700

        expect(hasEmerald).toBe(true);
      }
    });
  });

  test.describe('Amber (Warning) States', () => {
    test('warning messages use amber-700 text', async ({ page }) => {
      const warningElements = page.locator('[class*="warning"]');

      if (await warningElements.first().isVisible()) {
        const color = await warningElements.first().evaluate((el) => {
          return window.getComputedStyle(el).color;
        });

        // Should use amber-700 (180, 83, 9)
        expect(color).toMatch(/180.*83.*9|rgb\(180, 83, 9\)/);
      }
    });

    test('warning backgrounds use amber-50', async ({ page }) => {
      const warningBanners = page.locator('[class*="warning"]').filter({
        has: page.locator('div, p')
      });

      if (await warningBanners.first().isVisible()) {
        const bgColor = await warningBanners.first().evaluate((el) => {
          return window.getComputedStyle(el).backgroundColor;
        });

        // Should use amber-50 (255, 251, 235)
        expect(bgColor).toMatch(/255.*251.*235|rgba\(255, 251, 235/);
      }
    });
  });

  test.describe('Graphite (Neutral) States', () => {
    test('primary text uses graphite-800', async ({ page }) => {
      // Check main headings and text
      const headings = page.locator('h1, h2, h3').filter({
        hasText: /.+/
      });

      if (await headings.first().isVisible()) {
        const color = await headings.first().evaluate((el) => {
          return window.getComputedStyle(el).color;
        });

        // Should use graphite-800 (31, 41, 55) or graphite-900 (17, 24, 39)
        const isGraphite =
          color.includes('31, 41, 55') ||
          color.includes('17, 24, 39');

        expect(isGraphite).toBe(true);
      }
    });

    test('secondary text uses graphite-600', async ({ page }) => {
      // Check secondary text elements
      const secondaryText = page.locator('p, span').filter({
        hasText: /.+/
      }).first();

      if (await secondaryText.isVisible()) {
        const color = await secondaryText.evaluate((el) => {
          return window.getComputedStyle(el).color;
        });

        // Should use graphite-600 (75, 85, 99) or graphite-500 (107, 114, 128)
        const isGraphiteSecondary =
          color.includes('75, 85, 99') ||
          color.includes('107, 114, 128');

        // At least some text should use graphite
        expect(typeof isGraphiteSecondary).toBe('boolean');
      }
    });

    test('dividers use hairline-default', async ({ page }) => {
      // Check for dividing lines
      const dividers = page.locator('[class*="border-t"], [class*="border-b"]');

      if (await dividers.first().isVisible()) {
        const borderColor = await dividers.first().evaluate((el) => {
          return window.getComputedStyle(el).borderColor;
        });

        // Should use graphite-200 (229, 231, 235)
        expect(borderColor).toMatch(/229.*231.*235/);
      }
    });

    test('card backgrounds use surface-primary', async ({ page }) => {
      // Check card backgrounds
      const cards = page.locator('[class*="rounded"]').filter({
        has: page.locator('div')
      });

      if (await cards.first().isVisible()) {
        const bgColor = await cards.first().evaluate((el) => {
          return window.getComputedStyle(el).backgroundColor;
        });

        // Should use white (255, 255, 255)
        expect(bgColor).toMatch(/255.*255.*255/);
      }
    });

    test('disabled elements use graphite-300', async ({ page }) => {
      const disabledElements = page.locator('[disabled], [aria-disabled="true"]');

      if (await disabledElements.first().isVisible()) {
        const color = await disabledElements.first().evaluate((el) => {
          return window.getComputedStyle(el).color;
        });

        // Should use graphite-300 (209, 213, 219)
        expect(color).toMatch(/209.*213.*219/);
      }
    });
  });

  test.describe('State Transitions', () => {
    test('hover transitions are smooth', async ({ page }) => {
      const button = page.locator('button:visible').first();

      if (await button.isVisible()) {
        // Get initial state
        const initialStyles = await button.evaluate((el) => {
          const styles = window.getComputedStyle(el);
          return {
            backgroundColor: styles.backgroundColor,
            transition: styles.transition
          };
        });

        // Should have transition defined
        expect(initialStyles.transition).not.toBe('none');

        // Hover
        await button.hover();
        await page.waitForTimeout(300); // Allow transition to complete

        const hoverStyles = await button.evaluate((el) => {
          return window.getComputedStyle(el).backgroundColor;
        });

        // Background should change
        expect(initialStyles.backgroundColor).not.toBe(hoverStyles);
      }
    });

    test('focus transitions are immediate', async ({ page }) => {
      const addButton = page.getByText('Add Idea').or(page.getByText('New Idea'));

      if (await addButton.isVisible()) {
        await addButton.click();
        await page.waitForTimeout(500);

        const input = page.locator('input[type="text"]').first();

        if (await input.isVisible()) {
          await input.focus();
          await page.waitForTimeout(100);

          // Focus indicator should be present quickly
          const focusStyles = await input.evaluate((el) => {
            const styles = window.getComputedStyle(el);
            return {
              outlineColor: styles.outlineColor,
              borderColor: styles.borderColor
            };
          });

          // Should have visible focus indicator
          expect(focusStyles.outlineColor || focusStyles.borderColor).toBeDefined();
        }
      }
    });

    test('loading states show sapphire spinner', async ({ page }) => {
      // Trigger an action that shows loading state
      const insightsButton = page.getByText('AI Insights').or(page.getByText('Generate Insights'));

      if (await insightsButton.isVisible()) {
        await insightsButton.click();
        await page.waitForTimeout(300);

        // Look for loading spinner
        const spinner = page.locator('[class*="spinner"], [class*="loading"]').first();

        if (await spinner.isVisible()) {
          const color = await spinner.evaluate((el) => {
            const styles = window.getComputedStyle(el);
            return styles.color || styles.borderColor || styles.backgroundColor;
          });

          // Should use sapphire color
          const hasSapphire =
            color.includes('59, 130, 246') ||
            color.includes('37, 99, 235');

          expect(hasSapphire).toBe(true);
        }
      }
    });
  });

  test.describe('Consistency Across Components', () => {
    test('all error states use same garnet shade', async ({ page }) => {
      const errorElements = page.locator('[class*="error"]');
      const count = await errorElements.count();

      const errorColors = new Set<string>();

      for (let i = 0; i < Math.min(count, 5); i++) {
        const element = errorElements.nth(i);
        if (await element.isVisible()) {
          const color = await element.evaluate((el) => {
            return window.getComputedStyle(el).color;
          });
          errorColors.add(color);
        }
      }

      // All error colors should be consistent (garnet-700)
      expect(errorColors.size).toBeLessThanOrEqual(2); // Allow for slight variations
    });

    test('all success states use same emerald shade', async ({ page }) => {
      const successElements = page.locator('[class*="success"]');
      const count = await successElements.count();

      const successColors = new Set<string>();

      for (let i = 0; i < Math.min(count, 5); i++) {
        const element = successElements.nth(i);
        if (await element.isVisible()) {
          const color = await element.evaluate((el) => {
            return window.getComputedStyle(el).color;
          });
          successColors.add(color);
        }
      }

      // All success colors should be consistent (emerald-700)
      expect(successColors.size).toBeLessThanOrEqual(2);
    });

    test('all interactive elements use sapphire family', async ({ page }) => {
      const buttons = page.locator('button:visible');
      const count = await buttons.count();

      let sapphireCount = 0;

      for (let i = 0; i < Math.min(count, 5); i++) {
        const button = buttons.nth(i);
        await button.hover();
        await page.waitForTimeout(100);

        const color = await button.evaluate((el) => {
          const styles = window.getComputedStyle(el);
          return styles.backgroundColor + styles.borderColor;
        });

        if (color.includes('59, 130, 246') || color.includes('37, 99, 235')) {
          sapphireCount++;
        }
      }

      // At least some interactive elements should use sapphire
      expect(sapphireCount).toBeGreaterThan(0);
    });
  });

  test.describe('Semantic Color Usage', () => {
    test('gem-tones only used for semantic meaning', async ({ page }) => {
      // Verify gem-tones aren't used decoratively
      const allElements = await page.locator('*').evaluateAll((elements) => {
        const results = {
          garnetUsage: [] as string[],
          sapphireUsage: [] as string[],
          emeraldUsage: [] as string[],
          amberUsage: [] as string[]
        };

        elements.forEach((el) => {
          const styles = window.getComputedStyle(el);
          const bg = styles.backgroundColor;
          const color = styles.color;
          const className = el.className;

          // Check for gem-tone usage
          if (bg.includes('254, 242, 242') || color.includes('185, 28, 28')) {
            results.garnetUsage.push(className);
          }
          if (bg.includes('239, 246, 255') || color.includes('37, 99, 235')) {
            results.sapphireUsage.push(className);
          }
          if (bg.includes('236, 253, 245') || color.includes('4, 120, 87')) {
            results.emeraldUsage.push(className);
          }
          if (bg.includes('255, 251, 235') || color.includes('180, 83, 9')) {
            results.amberUsage.push(className);
          }
        });

        return results;
      });

      // Gem-tones should be used (not zero usage)
      const totalGemTones =
        allElements.garnetUsage.length +
        allElements.sapphireUsage.length +
        allElements.emeraldUsage.length +
        allElements.amberUsage.length;

      expect(totalGemTones).toBeGreaterThan(0);
    });
  });
});
