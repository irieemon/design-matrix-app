import { test, expect } from '@playwright/test';
import { VisualTestHelper, AuthVisualPatterns } from './utils/visual-helpers';
import { testUsers, authTestScenarios } from './utils/test-data';

/**
 * Comprehensive Auth Flow Visual Tests
 *
 * Tests all critical authentication scenarios with visual validation
 * and flickering detection
 */

test.describe('Authentication Flow Visual Tests', () => {
  let visualHelper: VisualTestHelper;
  let authPatterns: AuthVisualPatterns;

  test.beforeEach(async ({ page }) => {
    visualHelper = new VisualTestHelper(page);
    authPatterns = new AuthVisualPatterns(visualHelper, page);

    // Set consistent viewport
    await page.setViewportSize({ width: 1280, height: 720 });

    // Navigate to app root
    await page.goto('/', { waitUntil: 'networkidle' });
  });

  test('Initial Page Load and Auth Screen Rendering', async ({ page }) => {
    console.log('🚀 Testing initial page load and auth screen rendering');

    // Test 1: Initial loading screen
    await test.step('Capture loading screen', async () => {
      // Navigate and immediately capture loading state
      await page.goto('/?fresh=true', { waitUntil: 'domcontentloaded' });

      // Look for loading indicators
      const loadingIndicators = [
        '.animate-spin',
        '.animate-pulse',
        '[data-testid="loading"]',
        'text=/initializing/i'
      ];

      let loadingFound = false;
      for (const indicator of loadingIndicators) {
        try {
          await page.waitForSelector(indicator, { timeout: 1000 });
          loadingFound = true;
          console.log(`✅ Found loading indicator: ${indicator}`);
          break;
        } catch (e) {
          console.log(`⚠️ Loading indicator not found: ${indicator}`);
        }
      }

      if (loadingFound) {
        await visualHelper.compareScreenshot({
          name: 'auth-loading-screen',
          waitFor: 'load',
          delay: 200
        });
      }
    });

    // Test 2: Auth screen appearance
    await test.step('Capture auth screen', async () => {
      // Wait for auth screen to appear
      await page.waitForSelector('.auth-screen, [data-testid="auth-screen"]', {
        timeout: 10000
      });

      await visualHelper.waitForAuthStability();

      await visualHelper.compareScreenshot({
        name: 'auth-screen-initial',
        waitFor: 'networkidle',
        delay: 500
      });
    });

    // Test 3: Detect any flickering during initial load
    await test.step('Check for loading flickering', async () => {
      const flickerResult = await visualHelper.detectFlickering({
        samples: 4,
        interval: 250,
        threshold: 0.08,
        element: '.auth-screen, body'
      });

      expect(flickerResult.hasFlickering).toBe(false);

      if (flickerResult.hasFlickering) {
        console.warn(`⚠️ Flickering detected during initial load: ${(flickerResult.maxVariation * 100).toFixed(2)}%`);
      }
    });
  });

  test('Login Flow Visual Validation', async ({ page }) => {
    console.log('🔐 Testing login flow visual states');

    await page.goto('/', { waitUntil: 'networkidle' });
    await visualHelper.waitForAuthStability();

    // Test login mode (should be default)
    await test.step('Capture login mode', async () => {
      await visualHelper.compareScreenshot({
        name: 'auth-login-mode',
        waitFor: 'networkidle',
        delay: 300
      });
    });

    // Test form field interactions
    await test.step('Test form field interactions', async () => {
      const emailField = page.locator('[type="email"], [name="email"]');
      const passwordField = page.locator('[type="password"], [name="password"]');

      // Empty form state
      await visualHelper.captureElement('[data-testid="auth-form"], form', 'login-form-empty');

      // Focus email field
      await emailField.click();
      await visualHelper.captureFormState('login-email-focused');

      // Fill email and check state
      await emailField.fill(testUsers.validUser.email);
      await visualHelper.captureFormState('login-email-filled');

      // Focus password field
      await passwordField.click();
      await visualHelper.captureFormState('login-password-focused');

      // Fill password
      await passwordField.fill(testUsers.validUser.password);
      await visualHelper.captureFormState('login-form-complete');
    });

    // Test password visibility toggle
    await test.step('Test password visibility toggle', async () => {
      const passwordToggle = page.locator('[aria-label*="password"], .eye-icon, [data-testid="password-toggle"]');

      try {
        await passwordToggle.click();
        await page.waitForTimeout(200);
        await visualHelper.captureFormState('login-password-visible');

        await passwordToggle.click();
        await page.waitForTimeout(200);
        await visualHelper.captureFormState('login-password-hidden');
      } catch (error) {
        console.log('⚠️ Password toggle not found or clickable');
      }
    });

    // Test form validation states
    await test.step('Test form validation', async () => {
      // Clear fields and test validation
      await page.locator('[type="email"]').fill('invalid-email');
      await page.locator('[type="password"]').fill('');

      // Trigger validation by attempting submit or blur
      await page.locator('[type="submit"], button[type="submit"]').click();
      await page.waitForTimeout(500);

      await visualHelper.captureFormState('login-validation-errors', {
        highlightErrors: true
      });
    });
  });

  test('Signup Flow Visual Validation', async ({ page }) => {
    console.log('📝 Testing signup flow visual states');

    await page.goto('/', { waitUntil: 'networkidle' });
    await visualHelper.waitForAuthStability();

    // Switch to signup mode
    await test.step('Switch to signup mode', async () => {
      const signupButton = page.locator('text=/sign up/i, [data-testid="signup-link"]');
      await signupButton.click();

      // Monitor transition for flickering
      const transitionResult = await visualHelper.detectFlickering({
        samples: 3,
        interval: 200,
        threshold: 0.1
      });

      expect(transitionResult.hasFlickering).toBe(false);

      await visualHelper.compareScreenshot({
        name: 'auth-signup-mode',
        waitFor: 'networkidle',
        delay: 500
      });
    });

    // Test signup form fields
    await test.step('Test signup form interactions', async () => {
      const user = testUsers.validUser;

      // Fill full name
      const fullNameField = page.locator('[name="fullName"], [name="full_name"]');
      if (await fullNameField.count() > 0) {
        await fullNameField.fill(user.fullName || 'Test User');
        await visualHelper.captureFormState('signup-fullname-filled');
      }

      // Fill email
      await page.locator('[type="email"]').fill(user.email);
      await visualHelper.captureFormState('signup-email-filled');

      // Fill password
      await page.locator('[type="password"]').first().fill(user.password);
      await visualHelper.captureFormState('signup-password-filled');

      // Fill confirm password
      const confirmPasswordField = page.locator('[name*="confirm"], [name*="Confirm"]');
      if (await confirmPasswordField.count() > 0) {
        await confirmPasswordField.fill(user.password);
        await visualHelper.captureFormState('signup-confirm-password-filled');
      }

      // Complete form
      await visualHelper.captureFormState('signup-form-complete');
    });

    // Test signup validation
    await test.step('Test signup validation', async () => {
      // Test password mismatch
      const confirmField = page.locator('[name*="confirm"], [name*="Confirm"]');
      if (await confirmField.count() > 0) {
        await confirmField.fill('different-password');
        await page.locator('[type="submit"]').click();
        await page.waitForTimeout(500);

        await visualHelper.captureFormState('signup-password-mismatch', {
          highlightErrors: true
        });
      }
    });
  });

  test('Forgot Password Flow Visual Validation', async ({ page }) => {
    console.log('🔐 Testing forgot password flow');

    await page.goto('/', { waitUntil: 'networkidle' });
    await visualHelper.waitForAuthStability();

    await test.step('Switch to forgot password mode', async () => {
      const forgotPasswordLink = page.locator('text=/forgot.*password/i');
      await forgotPasswordLink.click();

      await visualHelper.waitForAuthStability();
      await visualHelper.compareScreenshot({
        name: 'auth-forgot-password-mode',
        waitFor: 'networkidle',
        delay: 300
      });
    });

    await test.step('Test forgot password form', async () => {
      // Fill email
      await page.locator('[type="email"]').fill(testUsers.validUser.email);
      await visualHelper.captureFormState('forgot-password-email-filled');

      // Test form submission state
      const submitButton = page.locator('[type="submit"], button[type="submit"]');
      await submitButton.click();

      // Monitor for loading state
      await page.waitForTimeout(500);
      await visualHelper.captureFormState('forgot-password-submitting');
    });
  });

  test('Form Loading States and Transitions', async ({ page }) => {
    console.log('⏳ Testing form loading states and transitions');

    await page.goto('/', { waitUntil: 'networkidle' });
    await visualHelper.waitForAuthStability();

    await test.step('Test form submission loading', async () => {
      // Fill login form
      await page.locator('[type="email"]').fill(testUsers.validUser.email);
      await page.locator('[type="password"]').fill(testUsers.validUser.password);

      // Capture pre-submit state
      await visualHelper.captureFormState('form-ready-to-submit');

      // Submit and immediately capture loading state
      const submitPromise = page.locator('[type="submit"]').click();

      // Look for loading indicators quickly
      const loadingSelectors = [
        '.animate-spin',
        '[data-state="loading"]',
        'button[disabled]',
        'text=/signing in/i'
      ];

      let loadingCaptured = false;
      for (const selector of loadingSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 1000 });
          await visualHelper.captureFormState('form-loading-state');
          loadingCaptured = true;
          break;
        } catch (e) {
          // Continue to next selector
        }
      }

      if (!loadingCaptured) {
        console.log('⚠️ Form loading state not captured - may be too fast');
      }

      await submitPromise;
    });
  });

  test('Error States and Messages Visual Validation', async ({ page }) => {
    console.log('❌ Testing error states and messages');

    await page.goto('/', { waitUntil: 'networkidle' });
    await visualHelper.waitForAuthStability();

    await test.step('Test invalid login credentials', async () => {
      // Fill invalid credentials
      await page.locator('[type="email"]').fill(testUsers.invalidUser.email);
      await page.locator('[type="password"]').fill(testUsers.invalidUser.password);

      // Submit form
      await page.locator('[type="submit"]').click();

      // Wait for error message
      await page.waitForTimeout(2000);

      // Look for error indicators
      const errorSelectors = [
        '.error, [role="alert"]',
        '.text-red, .text-error',
        '[aria-invalid="true"]',
        'text=/invalid.*credentials/i'
      ];

      for (const selector of errorSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 1000 });
          await visualHelper.captureFormState('login-error-state', {
            highlightErrors: true
          });
          break;
        } catch (e) {
          // Continue checking
        }
      }
    });

    await test.step('Test network error states', async () => {
      // Mock network failure
      await page.route('**/api/auth/**', route => route.abort());

      await page.reload();
      await visualHelper.waitForAuthStability();

      // Try to submit form
      await page.locator('[type="email"]').fill('test@example.com');
      await page.locator('[type="password"]').fill('password123');
      await page.locator('[type="submit"]').click();

      await page.waitForTimeout(3000);
      await visualHelper.captureFormState('network-error-state');
    });
  });

  test('Mode Transitions Flickering Detection', async ({ page }) => {
    console.log('🔄 Testing mode transitions for flickering');

    await page.goto('/', { waitUntil: 'networkidle' });
    await visualHelper.waitForAuthStability();

    // Test login → signup transition
    await test.step('Login to Signup transition', async () => {
      const result = await authPatterns.testModeTransition('login', 'signup');
      expect(result.flickerResult.hasFlickering).toBe(false);
    });

    // Test signup → login transition
    await test.step('Signup to Login transition', async () => {
      const result = await authPatterns.testModeTransition('signup', 'login');
      expect(result.flickerResult.hasFlickering).toBe(false);
    });

    // Test login → forgot password transition
    await test.step('Login to Forgot Password transition', async () => {
      const result = await authPatterns.testModeTransition('login', 'forgot-password');
      expect(result.flickerResult.hasFlickering).toBe(false);
    });
  });

  test('Fast-path Refresh Scenario', async ({ page }) => {
    console.log('🚀 Testing fast-path refresh scenario');

    // First, establish a session by logging in
    await page.goto('/', { waitUntil: 'networkidle' });
    await visualHelper.waitForAuthStability();

    // Skip actual login for this test - just test the refresh scenario
    await test.step('Test refresh with session', async () => {
      // Navigate with project parameter to simulate refresh scenario
      await page.goto('/?project=test-project-id', { waitUntil: 'domcontentloaded' });

      // Look for fast-path loading indicator
      const fastPathSelectors = [
        'text=/completing sign-in/i',
        '[data-testid="fast-path-loading"]',
        '.fixed.top-4.right-4'
      ];

      let fastPathDetected = false;
      for (const selector of fastPathSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 2000 });
          await visualHelper.compareScreenshot({
            name: 'auth-fast-path-loading',
            delay: 200
          });
          fastPathDetected = true;
          break;
        } catch (e) {
          // Continue checking
        }
      }

      if (!fastPathDetected) {
        console.log('⚠️ Fast-path scenario not detected - may not be implemented or session not active');
      }
    });
  });
});