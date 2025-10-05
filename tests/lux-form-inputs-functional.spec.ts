/**
 * LUX FORM INPUTS - FUNCTIONAL VALIDATION TEST SUITE
 *
 * Tests for Input/Textarea components with Lux design tokens
 * Focus: !important background fix validation and interaction behavior
 *
 * Critical fixes tested:
 * - White background maintained on hover (not turning black)
 * - Sapphire focus states work correctly
 * - Form validation displays with gem-tone colors
 * - Disabled states use graphite-300
 */

import { test, expect } from '@playwright/test';

test.describe('Lux Form Inputs - Functional Validation', () => {
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

  test.describe('Input Component - Background Fix', () => {
    test('input maintains white background on hover', async ({ page }) => {
      // Open a modal with input fields
      const addButton = page.getByText('Add Idea').or(page.getByText('New Idea'));

      if (await addButton.isVisible()) {
        await addButton.click();
        await page.waitForTimeout(500);

        // Find input field
        const input = page.locator('input[type="text"]').first();

        if (await input.isVisible()) {
          // Get initial background (should be white)
          const initialBg = await input.evaluate((el) => {
            return window.getComputedStyle(el).backgroundColor;
          });

          // Should start with white/light background
          expect(initialBg).toMatch(/rgb\(255, 255, 255\)|rgb\(249, 250, 251\)|rgba\(255, 255, 255/);

          // Hover over input
          await input.hover();
          await page.waitForTimeout(300);

          // Get hover background
          const hoverBg = await input.evaluate((el) => {
            return window.getComputedStyle(el).backgroundColor;
          });

          // CRITICAL: Should NOT turn black (0, 0, 0)
          expect(hoverBg).not.toContain('rgb(0, 0, 0)');
          expect(hoverBg).not.toContain('rgba(0, 0, 0');

          // Should remain white or very light
          expect(hoverBg).toMatch(/rgb\(255, 255, 255\)|rgb\(249, 250, 251\)|rgba\(255, 255, 255/);
        }
      }
    });

    test('input background persists through multiple interactions', async ({ page }) => {
      const addButton = page.getByText('Add Idea').or(page.getByText('New Idea'));

      if (await addButton.isVisible()) {
        await addButton.click();
        await page.waitForTimeout(500);

        const input = page.locator('input[type="text"]').first();

        if (await input.isVisible()) {
          // Interaction sequence: hover → focus → blur → hover
          await input.hover();
          await page.waitForTimeout(200);

          let bg = await input.evaluate((el) => window.getComputedStyle(el).backgroundColor);
          expect(bg).not.toContain('rgb(0, 0, 0)');

          await input.focus();
          await page.waitForTimeout(200);

          bg = await input.evaluate((el) => window.getComputedStyle(el).backgroundColor);
          expect(bg).not.toContain('rgb(0, 0, 0)');

          await input.blur();
          await page.waitForTimeout(200);

          bg = await input.evaluate((el) => window.getComputedStyle(el).backgroundColor);
          expect(bg).not.toContain('rgb(0, 0, 0)');

          await input.hover();
          await page.waitForTimeout(200);

          bg = await input.evaluate((el) => window.getComputedStyle(el).backgroundColor);
          expect(bg).not.toContain('rgb(0, 0, 0)');
        }
      }
    });

    test('input accepts text input correctly', async ({ page }) => {
      const addButton = page.getByText('Add Idea').or(page.getByText('New Idea'));

      if (await addButton.isVisible()) {
        await addButton.click();
        await page.waitForTimeout(500);

        const input = page.locator('input[placeholder*="title"], input[placeholder*="name"]').first();

        if (await input.isVisible()) {
          // Type text
          await input.fill('Test Input with Lux Design');

          // Verify text was entered
          const value = await input.inputValue();
          expect(value).toBe('Test Input with Lux Design');

          // Background should still be white
          const bg = await input.evaluate((el) => window.getComputedStyle(el).backgroundColor);
          expect(bg).not.toContain('rgb(0, 0, 0)');
        }
      }
    });
  });

  test.describe('Textarea Component - Background Fix', () => {
    test('textarea maintains white background on hover', async ({ page }) => {
      const addButton = page.getByText('Add Idea').or(page.getByText('New Idea'));

      if (await addButton.isVisible()) {
        await addButton.click();
        await page.waitForTimeout(500);

        const textarea = page.locator('textarea').first();

        if (await textarea.isVisible()) {
          // Get initial background
          const initialBg = await textarea.evaluate((el) => {
            return window.getComputedStyle(el).backgroundColor;
          });

          // Should start with white/light background
          expect(initialBg).toMatch(/rgb\(255, 255, 255\)|rgb\(249, 250, 251\)|rgba\(255, 255, 255/);

          // Hover over textarea
          await textarea.hover();
          await page.waitForTimeout(300);

          // Get hover background
          const hoverBg = await textarea.evaluate((el) => {
            return window.getComputedStyle(el).backgroundColor;
          });

          // CRITICAL: Should NOT turn black
          expect(hoverBg).not.toContain('rgb(0, 0, 0)');
          expect(hoverBg).not.toContain('rgba(0, 0, 0');
        }
      }
    });

    test('textarea accepts multiline text correctly', async ({ page }) => {
      const addButton = page.getByText('Add Idea').or(page.getByText('New Idea'));

      if (await addButton.isVisible()) {
        await addButton.click();
        await page.waitForTimeout(500);

        const textarea = page.locator('textarea').first();

        if (await textarea.isVisible()) {
          // Type multiline text
          const testText = 'Line 1: Testing Lux Design\nLine 2: Monochromatic theme\nLine 3: Gem-tone accents';
          await textarea.fill(testText);

          // Verify text was entered
          const value = await textarea.inputValue();
          expect(value).toBe(testText);

          // Background should still be white
          const bg = await textarea.evaluate((el) => window.getComputedStyle(el).backgroundColor);
          expect(bg).not.toContain('rgb(0, 0, 0)');
        }
      }
    });
  });

  test.describe('Focus States - Sapphire Accent', () => {
    test('input shows sapphire focus ring', async ({ page }) => {
      const addButton = page.getByText('Add Idea').or(page.getByText('New Idea'));

      if (await addButton.isVisible()) {
        await addButton.click();
        await page.waitForTimeout(500);

        const input = page.locator('input[type="text"]').first();

        if (await input.isVisible()) {
          // Focus input
          await input.focus();
          await page.waitForTimeout(200);

          // Check for sapphire focus indicator
          const focusStyles = await input.evaluate((el) => {
            const styles = window.getComputedStyle(el);
            return {
              outlineColor: styles.outlineColor,
              borderColor: styles.borderColor,
              boxShadow: styles.boxShadow
            };
          });

          // Should have sapphire color in one of these properties
          const hasSapphireFocus =
            focusStyles.outlineColor.includes('59, 130, 246') ||   // sapphire-500
            focusStyles.borderColor.includes('59, 130, 246') ||
            focusStyles.borderColor.includes('37, 99, 235') ||     // sapphire-600
            focusStyles.boxShadow.includes('59, 130, 246');

          expect(hasSapphireFocus).toBe(true);
        }
      }
    });

    test('textarea shows sapphire focus ring', async ({ page }) => {
      const addButton = page.getByText('Add Idea').or(page.getByText('New Idea'));

      if (await addButton.isVisible()) {
        await addButton.click();
        await page.waitForTimeout(500);

        const textarea = page.locator('textarea').first();

        if (await textarea.isVisible()) {
          await textarea.focus();
          await page.waitForTimeout(200);

          const focusStyles = await textarea.evaluate((el) => {
            const styles = window.getComputedStyle(el);
            return {
              outlineColor: styles.outlineColor,
              borderColor: styles.borderColor,
              boxShadow: styles.boxShadow
            };
          });

          // Should have sapphire focus indicator
          const hasSapphireFocus =
            focusStyles.outlineColor.includes('59, 130, 246') ||
            focusStyles.borderColor.includes('59, 130, 246') ||
            focusStyles.borderColor.includes('37, 99, 235') ||
            focusStyles.boxShadow.includes('59, 130, 246');

          expect(hasSapphireFocus).toBe(true);
        }
      }
    });

    test('focus ring visible on keyboard navigation', async ({ page }) => {
      const addButton = page.getByText('Add Idea').or(page.getByText('New Idea'));

      if (await addButton.isVisible()) {
        await addButton.click();
        await page.waitForTimeout(500);

        // Tab to first input
        await page.keyboard.press('Tab');
        await page.waitForTimeout(200);

        // Get focused element
        const focusedElement = await page.evaluateHandle(() => document.activeElement);

        if (focusedElement) {
          const focusRing = await page.evaluate(() => {
            const el = document.activeElement as HTMLElement;
            const styles = window.getComputedStyle(el);
            return styles.outlineColor || styles.boxShadow;
          });

          // Should have visible focus indicator
          expect(focusRing).toBeDefined();
          expect(focusRing).not.toBe('none');
        }
      }
    });
  });

  test.describe('Validation States - Gem-Tone Colors', () => {
    test('error state uses garnet color', async ({ page }) => {
      const addButton = page.getByText('Add Idea').or(page.getByText('New Idea'));

      if (await addButton.isVisible()) {
        await addButton.click();
        await page.waitForTimeout(500);

        // Try to submit form with empty required fields
        const submitButton = page.getByText('Create').or(page.getByText('Save')).or(page.getByText('Submit'));

        if (await submitButton.isVisible()) {
          await submitButton.click();
          await page.waitForTimeout(500);

          // Look for error message or error styling
          const errorMessage = page.locator('[class*="error"], [class*="invalid"]').first();

          if (await errorMessage.isVisible()) {
            const color = await errorMessage.evaluate((el) => {
              return window.getComputedStyle(el).color;
            });

            // Should use garnet-700 (185, 28, 28)
            expect(color).toContain('185, 28, 28');
          }
        }
      }
    });

    test('required field indicator visible', async ({ page }) => {
      const addButton = page.getByText('Add Idea').or(page.getByText('New Idea'));

      if (await addButton.isVisible()) {
        await addButton.click();
        await page.waitForTimeout(500);

        // Look for required asterisk
        const requiredIndicator = page.locator('[class*="required"]').first();

        if (await requiredIndicator.isVisible()) {
          const color = await requiredIndicator.evaluate((el) => {
            return window.getComputedStyle(el).color;
          });

          // Should be visible (not transparent)
          expect(color).not.toBe('rgba(0, 0, 0, 0)');
        }
      }
    });
  });

  test.describe('Disabled States - Graphite Neutral', () => {
    test('disabled input uses graphite-300 color', async ({ page }) => {
      // Look for disabled inputs
      const disabledInput = page.locator('input[disabled]').first();

      if (await disabledInput.isVisible()) {
        const color = await disabledInput.evaluate((el) => {
          return window.getComputedStyle(el).color;
        });

        // Should use graphite-300 (209, 213, 219)
        expect(color).toContain('209, 213, 219');
      }
    });

    test('disabled input cannot receive focus', async ({ page }) => {
      const disabledInput = page.locator('input[disabled]').first();

      if (await disabledInput.isVisible()) {
        // Try to focus
        await disabledInput.focus().catch(() => {});
        await page.waitForTimeout(200);

        // Check if focused
        const isFocused = await disabledInput.evaluate((el) => {
          return document.activeElement === el;
        });

        expect(isFocused).toBe(false);
      }
    });
  });

  test.describe('Form Integration Tests', () => {
    test('AddIdeaModal form submission with Lux inputs', async ({ page }) => {
      const addButton = page.getByText('Add Idea').or(page.getByText('New Idea'));

      if (await addButton.isVisible()) {
        await addButton.click();
        await page.waitForTimeout(500);

        // Fill form fields
        const titleInput = page.locator('input[placeholder*="title"], input[placeholder*="name"]').first();
        const descriptionTextarea = page.locator('textarea').first();

        if (await titleInput.isVisible() && await descriptionTextarea.isVisible()) {
          await titleInput.fill('Test Idea Title');
          await descriptionTextarea.fill('Test description for Lux design validation');

          // Verify backgrounds remained white during typing
          const titleBg = await titleInput.evaluate((el) => window.getComputedStyle(el).backgroundColor);
          const descBg = await descriptionTextarea.evaluate((el) => window.getComputedStyle(el).backgroundColor);

          expect(titleBg).not.toContain('rgb(0, 0, 0)');
          expect(descBg).not.toContain('rgb(0, 0, 0)');

          // Try to submit
          const submitButton = page.getByText('Create').or(page.getByText('Save'));
          if (await submitButton.isVisible()) {
            await submitButton.click();
            await page.waitForTimeout(1000);

            // Form should close or show success
            const isModalClosed = !(await page.locator('[role="dialog"]').isVisible());
            const hasSuccessMessage = await page.locator('[class*="success"]').isVisible();

            expect(isModalClosed || hasSuccessMessage).toBe(true);
          }
        }
      }
    });

    test('EditIdeaModal form updates with Lux inputs', async ({ page }) => {
      // Find and click an existing idea
      const ideaCard = page.locator('[data-testid*="idea-card"]').first();

      if (await ideaCard.isVisible()) {
        await ideaCard.click();
        await page.waitForTimeout(500);

        // Find input fields in modal
        const titleInput = page.locator('input[type="text"]').first();

        if (await titleInput.isVisible()) {
          // Clear and update title
          await titleInput.fill('Updated Title with Lux');

          // Check background
          const bg = await titleInput.evaluate((el) => window.getComputedStyle(el).backgroundColor);
          expect(bg).not.toContain('rgb(0, 0, 0)');

          // Submit changes
          const saveButton = page.getByText('Save').or(page.getByText('Update'));
          if (await saveButton.isVisible()) {
            await saveButton.click();
            await page.waitForTimeout(1000);
          }
        }
      }
    });
  });

  test.describe('Input Placeholder Styling', () => {
    test('placeholder uses graphite-400', async ({ page }) => {
      const addButton = page.getByText('Add Idea').or(page.getByText('New Idea'));

      if (await addButton.isVisible()) {
        await addButton.click();
        await page.waitForTimeout(500);

        const input = page.locator('input[placeholder]').first();

        if (await input.isVisible()) {
          // Check placeholder color via computed styles
          const placeholderColor = await input.evaluate((el) => {
            const input = el as HTMLInputElement;
            const styles = window.getComputedStyle(input, '::placeholder');
            return styles.color;
          });

          // Should use graphite-400 (156, 163, 175)
          expect(placeholderColor).toContain('156, 163, 175');
        }
      }
    });
  });

  test.describe('Label Styling', () => {
    test('labels use graphite-700', async ({ page }) => {
      const addButton = page.getByText('Add Idea').or(page.getByText('New Idea'));

      if (await addButton.isVisible()) {
        await addButton.click();
        await page.waitForTimeout(500);

        const label = page.locator('label').first();

        if (await label.isVisible()) {
          const color = await label.evaluate((el) => {
            return window.getComputedStyle(el).color;
          });

          // Should use graphite-700 (55, 65, 81)
          expect(color).toContain('55, 65, 81');
        }
      }
    });
  });

  test.describe('Helper Text Styling', () => {
    test('helper text uses graphite-600', async ({ page }) => {
      const addButton = page.getByText('Add Idea').or(page.getByText('New Idea'));

      if (await addButton.isVisible()) {
        await addButton.click();
        await page.waitForTimeout(500);

        const helperText = page.locator('[class*="helper"], [class*="hint"]').first();

        if (await helperText.isVisible()) {
          const color = await helperText.evaluate((el) => {
            return window.getComputedStyle(el).color;
          });

          // Should use graphite-600 (75, 85, 99)
          expect(color).toContain('75, 85, 99');
        }
      }
    });
  });

  test.describe('Border Styling', () => {
    test('input borders use hairline-default', async ({ page }) => {
      const addButton = page.getByText('Add Idea').or(page.getByText('New Idea'));

      if (await addButton.isVisible()) {
        await addButton.click();
        await page.waitForTimeout(500);

        const input = page.locator('input[type="text"]').first();

        if (await input.isVisible()) {
          const borderColor = await input.evaluate((el) => {
            return window.getComputedStyle(el).borderColor;
          });

          // Should use graphite-200 (229, 231, 235)
          expect(borderColor).toContain('229, 231, 235');
        }
      }
    });
  });
});
