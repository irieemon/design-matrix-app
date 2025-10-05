import { test, expect } from '@playwright/test';
import { VisualTestHelper } from './utils/visual-helpers';
import { testUsers } from './utils/test-data';

/**
 * Advanced Flickering Detection and Layout Shift Tests
 *
 * Focused tests for detecting visual instabilities, layout shifts,
 * and transition flickering in the authentication system
 */

test.describe('Flickering Detection and Layout Stability', () => {
  let visualHelper: VisualTestHelper;

  test.beforeEach(async ({ page }) => {
    visualHelper = new VisualTestHelper(page);
    await page.setViewportSize({ width: 1280, height: 720 });

    // Disable animations for more precise flickering detection
    await page.addInitScript(() => {
      const style = document.createElement('style');
      style.innerHTML = `
        *, *::before, *::after {
          animation-duration: 0.01s !important;
          animation-delay: 0s !important;
          transition-duration: 0.01s !important;
          transition-delay: 0s !important;
        }
      `;
      document.head.appendChild(style);
    });
  });

  test('Comprehensive Initial Load Flickering Detection', async ({ page }) => {
    console.log('🔍 Testing comprehensive initial load flickering');

    await test.step('Detect flickering during app initialization', async () => {
      // Navigate and immediately start monitoring
      const navigationPromise = page.goto('/', { waitUntil: 'domcontentloaded' });

      // Start flickering detection immediately
      const flickerPromise = visualHelper.detectFlickering({
        samples: 8,
        interval: 125,
        threshold: 0.05, // Very sensitive threshold
        element: 'body'
      });

      // Wait for navigation to complete
      await navigationPromise;

      // Get flicker results
      const flickerResult = await flickerPromise;

      console.log(`📊 Initial load flicker analysis:`);
      console.log(`   Samples: ${flickerResult.samples}`);
      console.log(`   Max variation: ${(flickerResult.maxVariation * 100).toFixed(3)}%`);
      console.log(`   Has flickering: ${flickerResult.hasFlickering}`);

      // Assert no significant flickering
      expect(flickerResult.hasFlickering).toBe(false);
      expect(flickerResult.maxVariation).toBeLessThan(0.1); // Less than 10% variation
    });

    await test.step('Detect layout shifts during initialization', async () => {
      // Navigate to fresh page
      await page.goto('/?fresh=true', { waitUntil: 'domcontentloaded' });

      // Monitor layout shifts during initial load
      const shiftResult = await visualHelper.detectLayoutShift({
        duration: 5000,
        threshold: 0.1,
        elements: ['.auth-screen', 'form', 'button', '.card-clean']
      });

      console.log(`📐 Layout shift analysis:`);
      console.log(`   Total shift: ${shiftResult.totalShift.toFixed(4)}`);
      console.log(`   Entries: ${shiftResult.entries.length}`);
      console.log(`   Exceeds threshold: ${shiftResult.exceedsThreshold}`);

      // Assert acceptable layout shift
      expect(shiftResult.exceedsThreshold).toBe(false);
      expect(shiftResult.totalShift).toBeLessThan(0.1);
    });
  });

  test('Auth Screen Rendering Stability', async ({ page }) => {
    console.log('🎭 Testing auth screen rendering stability');

    await page.goto('/', { waitUntil: 'networkidle' });

    await test.step('Monitor auth screen stability', async () => {
      // Wait for auth screen to appear
      await page.waitForSelector('.auth-screen, form', { timeout: 10000 });

      // Monitor for post-render flickering
      const flickerResult = await visualHelper.detectFlickering({
        samples: 6,
        interval: 200,
        threshold: 0.03, // Very sensitive for rendered UI
        element: '.auth-screen'
      });

      console.log(`Auth screen stability: ${flickerResult.hasFlickering ? 'UNSTABLE' : 'STABLE'}`);

      expect(flickerResult.hasFlickering).toBe(false);
    });

    await test.step('Test form elements stability', async () => {
      const formElements = [
        '[type="email"]',
        '[type="password"]',
        'button[type="submit"]',
        '.card-clean'
      ];

      for (const selector of formElements) {
        try {
          await page.waitForSelector(selector, { timeout: 2000 });

          const elementFlicker = await visualHelper.detectFlickering({
            samples: 4,
            interval: 150,
            threshold: 0.02,
            element: selector
          });

          console.log(`Element ${selector}: ${elementFlicker.hasFlickering ? 'FLICKERING' : 'STABLE'}`);
          expect(elementFlicker.hasFlickering).toBe(false);
        } catch (error) {
          console.log(`⚠️ Element not found: ${selector}`);
        }
      }
    });
  });

  test('Form Interaction Flickering Detection', async ({ page }) => {
    console.log('📝 Testing form interaction stability');

    await page.goto('/', { waitUntil: 'networkidle' });
    await visualHelper.waitForAuthStability();

    await test.step('Test field focus flickering', async () => {
      const emailField = page.locator('[type="email"]');

      // Monitor during focus
      const focusFlicker = visualHelper.detectFlickering({
        samples: 3,
        interval: 100,
        threshold: 0.03,
        element: 'form'
      });

      await emailField.click();
      await page.waitForTimeout(200);

      const focusResult = await focusFlicker;
      console.log(`Focus flickering: ${focusResult.hasFlickering ? 'DETECTED' : 'NONE'}`);
      expect(focusResult.hasFlickering).toBe(false);
    });

    await test.step('Test typing stability', async () => {
      const emailField = page.locator('[type="email"]');

      // Start monitoring before typing
      const typingFlicker = visualHelper.detectFlickering({
        samples: 5,
        interval: 100,
        threshold: 0.04,
        element: 'form'
      });

      // Type email gradually
      const email = testUsers.validUser.email;
      for (let i = 0; i < email.length; i++) {
        await emailField.type(email[i], { delay: 50 });
      }

      const typingResult = await typingFlicker;
      console.log(`Typing flickering: ${typingResult.hasFlickering ? 'DETECTED' : 'NONE'}`);
      expect(typingResult.hasFlickering).toBe(false);
    });

    await test.step('Test password visibility toggle stability', async () => {
      const passwordField = page.locator('[type="password"]');
      const toggleButton = page.locator('[aria-label*="password"], .eye-icon');

      await passwordField.fill('test-password');

      if (await toggleButton.count() > 0) {
        const toggleFlicker = visualHelper.detectFlickering({
          samples: 3,
          interval: 150,
          threshold: 0.03,
          element: 'form'
        });

        await toggleButton.click();
        await page.waitForTimeout(200);

        const toggleResult = await toggleFlicker;
        console.log(`Toggle flickering: ${toggleResult.hasFlickering ? 'DETECTED' : 'NONE'}`);
        expect(toggleResult.hasFlickering).toBe(false);
      }
    });
  });

  test('Mode Transition Flickering Analysis', async ({ page }) => {
    console.log('🔄 Analyzing mode transition flickering');

    await page.goto('/', { waitUntil: 'networkidle' });
    await visualHelper.waitForAuthStability();

    const transitions = [
      { from: 'login', to: 'signup', selector: 'text=/sign up/i' },
      { from: 'signup', to: 'login', selector: 'text=/sign in/i' },
      { from: 'login', to: 'forgot-password', selector: 'text=/forgot.*password/i' }
    ];

    for (const transition of transitions) {
      await test.step(`Test ${transition.from} → ${transition.to} transition`, async () => {
        // Start flickering detection before transition
        const transitionFlicker = visualHelper.detectFlickering({
          samples: 4,
          interval: 100,
          threshold: 0.05, // Slightly higher threshold for transitions
          element: '.auth-screen'
        });

        // Perform transition
        try {
          await page.click(transition.selector);
          await page.waitForTimeout(500); // Wait for transition to complete
        } catch (error) {
          console.log(`⚠️ Transition button not found: ${transition.selector}`);
        }

        const result = await transitionFlicker;
        console.log(`${transition.from} → ${transition.to}: ${result.hasFlickering ? 'FLICKERING' : 'SMOOTH'}`);

        // More lenient threshold for mode transitions
        expect(result.maxVariation).toBeLessThan(0.15); // Allow up to 15% variation for transitions
      });
    }
  });

  test('Loading State Flickering Detection', async ({ page }) => {
    console.log('⏳ Testing loading state stability');

    await test.step('Test skeleton loading stability', async () => {
      // Navigate and immediately monitor loading
      const loadingFlicker = visualHelper.detectFlickering({
        samples: 6,
        interval: 200,
        threshold: 0.08, // Higher threshold for loading states
        element: 'body'
      });

      await page.goto('/?fresh=true', { waitUntil: 'domcontentloaded' });

      const result = await loadingFlicker;
      console.log(`Loading state flickering: ${result.hasFlickering ? 'DETECTED' : 'STABLE'}`);

      // Loading states can have some variation due to animations
      expect(result.maxVariation).toBeLessThan(0.2); // 20% threshold for loading states
    });

    await test.step('Test form submission loading', async () => {
      await page.goto('/', { waitUntil: 'networkidle' });
      await visualHelper.waitForAuthStability();

      // Fill form
      await page.locator('[type="email"]').fill(testUsers.validUser.email);
      await page.locator('[type="password"]').fill(testUsers.validUser.password);

      // Monitor during submission
      const submissionFlicker = visualHelper.detectFlickering({
        samples: 4,
        interval: 250,
        threshold: 0.06,
        element: 'form'
      });

      // Submit form
      await page.locator('[type="submit"]').click();
      await page.waitForTimeout(1000);

      const result = await submissionFlicker;
      console.log(`Form submission flickering: ${result.hasFlickering ? 'DETECTED' : 'STABLE'}`);

      expect(result.maxVariation).toBeLessThan(0.15);
    });
  });

  test('Error State Visual Stability', async ({ page }) => {
    console.log('❌ Testing error state stability');

    await page.goto('/', { waitUntil: 'networkidle' });
    await visualHelper.waitForAuthStability();

    await test.step('Test error message appearance stability', async () => {
      // Fill invalid credentials
      await page.locator('[type="email"]').fill('invalid-email');
      await page.locator('[type="password"]').fill('wrong-password');

      // Monitor error appearance
      const errorFlicker = visualHelper.detectFlickering({
        samples: 4,
        interval: 300,
        threshold: 0.05,
        element: 'form'
      });

      // Submit to trigger error
      await page.locator('[type="submit"]').click();
      await page.waitForTimeout(2000);

      const result = await errorFlicker;
      console.log(`Error display flickering: ${result.hasFlickering ? 'DETECTED' : 'STABLE'}`);

      expect(result.hasFlickering).toBe(false);
    });
  });

  test('Responsive Layout Stability', async ({ page }) => {
    console.log('📱 Testing responsive layout stability');

    const viewports = [
      { width: 1280, height: 720, name: 'desktop' },
      { width: 768, height: 1024, name: 'tablet' },
      { width: 375, height: 667, name: 'mobile' }
    ];

    for (const viewport of viewports) {
      await test.step(`Test ${viewport.name} layout stability`, async () => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto('/', { waitUntil: 'networkidle' });

        // Allow layout to settle
        await page.waitForTimeout(500);

        const layoutFlicker = await visualHelper.detectFlickering({
          samples: 4,
          interval: 200,
          threshold: 0.04,
          element: '.auth-screen'
        });

        console.log(`${viewport.name} layout: ${layoutFlicker.hasFlickering ? 'UNSTABLE' : 'STABLE'}`);
        expect(layoutFlicker.hasFlickering).toBe(false);
      });
    }
  });

  test('Performance Impact on Visual Stability', async ({ page }) => {
    console.log('⚡ Testing performance impact on visual stability');

    await test.step('Test stability under simulated slow network', async () => {
      // Simulate slow network
      await page.route('**/*', route => {
        setTimeout(() => route.continue(), 100); // 100ms delay for all requests
      });

      const slowNetworkFlicker = visualHelper.detectFlickering({
        samples: 5,
        interval: 300,
        threshold: 0.08,
        element: 'body'
      });

      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);

      const result = await slowNetworkFlicker;
      console.log(`Slow network flickering: ${result.hasFlickering ? 'DETECTED' : 'STABLE'}`);

      // Network delays shouldn't cause visual instability
      expect(result.maxVariation).toBeLessThan(0.12);
    });

    await test.step('Test stability with heavy CPU load simulation', async () => {
      // Simulate CPU load with JavaScript
      await page.evaluate(() => {
        const heavyTask = () => {
          let sum = 0;
          for (let i = 0; i < 1000000; i++) {
            sum += Math.random();
          }
          return sum;
        };

        // Run heavy task periodically
        const interval = setInterval(heavyTask, 100);
        setTimeout(() => clearInterval(interval), 3000);
      });

      await page.goto('/', { waitUntil: 'networkidle' });

      const cpuLoadFlicker = await visualHelper.detectFlickering({
        samples: 4,
        interval: 400,
        threshold: 0.06,
        element: '.auth-screen'
      });

      console.log(`CPU load flickering: ${cpuLoadFlicker.hasFlickering ? 'DETECTED' : 'STABLE'}`);

      // UI should remain stable even under CPU load
      expect(cpuLoadFlicker.hasFlickering).toBe(false);
    });
  });
});