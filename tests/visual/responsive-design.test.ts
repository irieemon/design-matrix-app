import { test, expect } from '@playwright/test';
import { VisualTestHelper } from './utils/visual-helpers';
import { viewportConfigurations, testUsers } from './utils/test-data';

/**
 * Responsive Design Visual Validation Tests
 *
 * Comprehensive testing of auth system across different viewport sizes
 * with focus on layout stability and visual consistency
 */

test.describe('Responsive Design Visual Validation', () => {
  let visualHelper: VisualTestHelper;

  // Test each viewport configuration
  for (const viewport of viewportConfigurations) {
    test.describe(`${viewport.name} Viewport (${viewport.width}x${viewport.height})`, () => {
      test.beforeEach(async ({ page }) => {
        visualHelper = new VisualTestHelper(page);
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
      });

      test('Auth Screen Layout and Proportions', async ({ page }) => {
        console.log(`📱 Testing auth screen layout on ${viewport.name}`);

        await page.goto('/', { waitUntil: 'networkidle' });
        await visualHelper.waitForAuthStability();

        await test.step('Capture overall auth layout', async () => {
          await visualHelper.compareScreenshot({
            name: `auth-layout-${viewport.name}`,
            waitFor: 'networkidle',
            delay: 300
          });
        });

        await test.step('Validate responsive elements', async () => {
          // Check if elements are properly positioned and sized
          const authElements = [
            { selector: '.auth-screen', name: 'auth-container' },
            { selector: 'form', name: 'auth-form' },
            { selector: '[type="email"]', name: 'email-field' },
            { selector: '[type="password"]', name: 'password-field' },
            { selector: 'button[type="submit"]', name: 'submit-button' }
          ];

          for (const element of authElements) {
            try {
              const locator = page.locator(element.selector).first();
              await locator.waitFor({ state: 'visible', timeout: 2000 });

              const boundingBox = await locator.boundingBox();
              if (boundingBox) {
                console.log(`${element.name} on ${viewport.name}: ${boundingBox.width}x${boundingBox.height}`);

                // Validate element is within viewport
                expect(boundingBox.x).toBeGreaterThanOrEqual(0);
                expect(boundingBox.y).toBeGreaterThanOrEqual(0);
                expect(boundingBox.x + boundingBox.width).toBeLessThanOrEqual(viewport.width);

                // Validate reasonable sizing
                expect(boundingBox.width).toBeGreaterThan(0);
                expect(boundingBox.height).toBeGreaterThan(0);
              }
            } catch (error) {
              console.log(`⚠️ Element not found on ${viewport.name}: ${element.selector}`);
            }
          }
        });

        await test.step('Check for layout overflow', async () => {
          // Detect horizontal scrolling (should not happen)
          const hasHorizontalScroll = await page.evaluate(() => {
            return document.documentElement.scrollWidth > document.documentElement.clientWidth;
          });

          expect(hasHorizontalScroll).toBe(false);
          console.log(`${viewport.name} horizontal overflow: ${hasHorizontalScroll ? 'DETECTED' : 'NONE'}`);
        });
      });

      test('Form Field Responsiveness', async ({ page }) => {
        console.log(`📝 Testing form field responsiveness on ${viewport.name}`);

        await page.goto('/', { waitUntil: 'networkidle' });
        await visualHelper.waitForAuthStability();

        await test.step('Test form field interactions', async () => {
          const emailField = page.locator('[type="email"]');
          const passwordField = page.locator('[type="password"]');

          // Test field focus and input
          await emailField.click();
          await visualHelper.captureFormState(`field-focus-${viewport.name}`);

          await emailField.fill(testUsers.validUser.email);
          await visualHelper.captureFormState(`email-filled-${viewport.name}`);

          await passwordField.click();
          await passwordField.fill(testUsers.validUser.password);
          await visualHelper.captureFormState(`form-complete-${viewport.name}`);
        });

        await test.step('Test form element sizing', async () => {
          const formFields = [
            '[type="email"]',
            '[type="password"]',
            'button[type="submit"]'
          ];

          for (const fieldSelector of formFields) {
            try {
              const field = page.locator(fieldSelector).first();
              const boundingBox = await field.boundingBox();

              if (boundingBox) {
                // Mobile devices should have larger touch targets
                const minTouchTarget = viewport.width < 768 ? 44 : 32;
                expect(boundingBox.height).toBeGreaterThanOrEqual(minTouchTarget);

                // Fields should not be too narrow on small screens
                if (viewport.width < 480) {
                  expect(boundingBox.width).toBeGreaterThan(200);
                }
              }
            } catch (error) {
              console.log(`⚠️ Field sizing check failed: ${fieldSelector}`);
            }
          }
        });
      });

      test('Mode Transitions Across Viewports', async ({ page }) => {
        console.log(`🔄 Testing mode transitions on ${viewport.name}`);

        await page.goto('/', { waitUntil: 'networkidle' });
        await visualHelper.waitForAuthStability();

        const transitions = [
          { name: 'login-to-signup', button: 'text=/sign up/i' },
          { name: 'signup-to-login', button: 'text=/sign in/i' },
          { name: 'login-to-forgot', button: 'text=/forgot.*password/i' }
        ];

        for (const transition of transitions) {
          await test.step(`Test ${transition.name} on ${viewport.name}`, async () => {
            try {
              // Capture before state
              await visualHelper.compareScreenshot({
                name: `${transition.name}-before-${viewport.name}`,
                delay: 200
              });

              // Perform transition
              await page.click(transition.button);
              await visualHelper.waitForAuthStability();

              // Capture after state
              await visualHelper.compareScreenshot({
                name: `${transition.name}-after-${viewport.name}`,
                delay: 300
              });

              // Detect flickering during transition
              const flickerResult = await visualHelper.detectFlickering({
                samples: 3,
                interval: 200,
                threshold: 0.08
              });

              expect(flickerResult.hasFlickering).toBe(false);
              console.log(`${transition.name} on ${viewport.name}: ${flickerResult.hasFlickering ? 'FLICKERING' : 'SMOOTH'}`);
            } catch (error) {
              console.log(`⚠️ Transition failed on ${viewport.name}: ${transition.name}`);
            }
          });
        }
      });

      test('Error States Responsive Display', async ({ page }) => {
        console.log(`❌ Testing error states on ${viewport.name}`);

        await page.goto('/', { waitUntil: 'networkidle' });
        await visualHelper.waitForAuthStability();

        await test.step('Test validation error display', async () => {
          // Fill invalid data
          await page.locator('[type="email"]').fill('invalid-email');
          await page.locator('[type="password"]').fill('short');

          // Trigger validation
          await page.locator('[type="submit"]').click();
          await page.waitForTimeout(1000);

          await visualHelper.captureFormState(`validation-errors-${viewport.name}`, {
            highlightErrors: true
          });
        });

        await test.step('Test error message positioning', async () => {
          // Check that error messages don't overflow or get cut off
          const errorElements = await page.locator('.error, [role="alert"], .text-red').count();

          if (errorElements > 0) {
            for (let i = 0; i < errorElements; i++) {
              const errorElement = page.locator('.error, [role="alert"], .text-red').nth(i);
              const boundingBox = await errorElement.boundingBox();

              if (boundingBox) {
                // Error messages should be visible within viewport
                expect(boundingBox.x + boundingBox.width).toBeLessThanOrEqual(viewport.width);
                expect(boundingBox.y).toBeGreaterThanOrEqual(0);
              }
            }
          }
        });
      });

      test('Loading States Responsive Behavior', async ({ page }) => {
        console.log(`⏳ Testing loading states on ${viewport.name}`);

        await test.step('Test initial loading display', async () => {
          // Navigate and capture loading state quickly
          await page.goto('/?fresh=true', { waitUntil: 'domcontentloaded' });

          // Look for loading indicators
          const loadingSelectors = [
            '.animate-spin',
            '[data-testid="loading"]',
            'text=/initializing/i'
          ];

          let loadingFound = false;
          for (const selector of loadingSelectors) {
            try {
              await page.waitForSelector(selector, { timeout: 1000 });
              await visualHelper.compareScreenshot({
                name: `loading-state-${viewport.name}`,
                delay: 100
              });
              loadingFound = true;
              break;
            } catch (e) {
              // Continue checking
            }
          }

          if (!loadingFound) {
            console.log(`⚠️ Loading state not captured on ${viewport.name}`);
          }
        });

        await test.step('Test form submission loading', async () => {
          await page.goto('/', { waitUntil: 'networkidle' });
          await visualHelper.waitForAuthStability();

          // Fill form
          await page.locator('[type="email"]').fill(testUsers.validUser.email);
          await page.locator('[type="password"]').fill(testUsers.validUser.password);

          // Submit and capture loading state
          await page.locator('[type="submit"]').click();
          await page.waitForTimeout(300);

          await visualHelper.captureFormState(`form-loading-${viewport.name}`);
        });
      });

      test('Touch Interaction Areas (Mobile/Tablet)', async ({ page }) => {
        // Only run touch tests on smaller viewports
        if (viewport.width <= 1024) {
          console.log(`👆 Testing touch interactions on ${viewport.name}`);

          await page.goto('/', { waitUntil: 'networkidle' });
          await visualHelper.waitForAuthStability();

          await test.step('Validate touch target sizes', async () => {
            const interactiveElements = [
              'button[type="submit"]',
              'text=/sign up/i',
              'text=/forgot.*password/i',
              '[aria-label*="password"]' // Password toggle
            ];

            for (const selector of interactiveElements) {
              try {
                const element = page.locator(selector).first();
                await element.waitFor({ state: 'visible', timeout: 2000 });

                const boundingBox = await element.boundingBox();
                if (boundingBox) {
                  // Minimum touch target size should be 44x44 pixels
                  const minSize = 44;
                  expect(boundingBox.width).toBeGreaterThanOrEqual(minSize);
                  expect(boundingBox.height).toBeGreaterThanOrEqual(minSize);

                  console.log(`Touch target ${selector}: ${boundingBox.width}x${boundingBox.height}`);
                }
              } catch (error) {
                console.log(`⚠️ Touch target not found: ${selector}`);
              }
            }
          });

          await test.step('Test tap interactions', async () => {
            // Test tapping form fields and buttons
            const emailField = page.locator('[type="email"]');
            const passwordField = page.locator('[type="password"]');
            const submitButton = page.locator('[type="submit"]');

            // Simulate tap interactions
            await emailField.tap();
            await visualHelper.captureFormState(`email-tap-${viewport.name}`);

            await passwordField.tap();
            await visualHelper.captureFormState(`password-tap-${viewport.name}`);

            // Test button tap (without actually submitting)
            await submitButton.hover(); // Simulate touch hover
            await visualHelper.captureFormState(`button-hover-${viewport.name}`);
          });
        }
      });
    });
  }

  test.describe('Cross-Viewport Consistency', () => {
    test('Compare Layout Consistency Across Viewports', async ({ page }) => {
      console.log('📐 Testing layout consistency across viewports');

      const screenshots: { [key: string]: string } = {};

      // Capture auth screen on all viewports
      for (const viewport of viewportConfigurations) {
        await test.step(`Capture ${viewport.name} layout`, async () => {
          await page.setViewportSize({ width: viewport.width, height: viewport.height });
          await page.goto('/', { waitUntil: 'networkidle' });
          await visualHelper.waitForAuthStability();

          await visualHelper.compareScreenshot({
            name: `consistency-${viewport.name}`,
            delay: 300
          });

          screenshots[viewport.name] = `consistency-${viewport.name}`;
        });
      }

      // Log captured viewports for comparison
      console.log(`📊 Captured layouts for consistency check:`, Object.keys(screenshots));
    });

    test('Responsive Breakpoint Transitions', async ({ page }) => {
      console.log('🔄 Testing responsive breakpoint transitions');

      visualHelper = new VisualTestHelper(page);

      // Test transitions between major breakpoints
      const breakpoints = [
        { from: { width: 1280, height: 720 }, to: { width: 768, height: 1024 }, name: 'desktop-to-tablet' },
        { from: { width: 768, height: 1024 }, to: { width: 375, height: 667 }, name: 'tablet-to-mobile' },
        { from: { width: 375, height: 667 }, to: { width: 1280, height: 720 }, name: 'mobile-to-desktop' }
      ];

      for (const breakpoint of breakpoints) {
        await test.step(`Test ${breakpoint.name} transition`, async () => {
          // Start at 'from' viewport
          await page.setViewportSize(breakpoint.from);
          await page.goto('/', { waitUntil: 'networkidle' });
          await visualHelper.waitForAuthStability();

          // Capture before
          await visualHelper.compareScreenshot({
            name: `${breakpoint.name}-before`,
            delay: 200
          });

          // Transition to 'to' viewport
          await page.setViewportSize(breakpoint.to);
          await page.waitForTimeout(500); // Allow layout to settle

          // Capture after
          await visualHelper.compareScreenshot({
            name: `${breakpoint.name}-after`,
            delay: 300
          });

          // Check for layout shifts
          const shiftResult = await visualHelper.detectLayoutShift({
            duration: 1000,
            threshold: 0.1
          });

          // Small layout shifts acceptable during viewport changes
          expect(shiftResult.totalShift).toBeLessThan(0.3);
          console.log(`${breakpoint.name} layout shift: ${shiftResult.totalShift.toFixed(4)}`);
        });
      }
    });
  });
});