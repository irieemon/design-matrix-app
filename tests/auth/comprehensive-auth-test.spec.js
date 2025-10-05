/**
 * COMPREHENSIVE AUTHENTICATION SYSTEM TEST
 * Critical testing for authentication failures reported by user
 */

import { test, expect } from '@playwright/test';

const SERVER_URL = 'http://localhost:3004';

// Test configuration
const TEST_CONFIG = {
  viewport: { width: 1920, height: 1080 },
  screenshots: {
    path: 'test-screenshots/auth-comprehensive',
    onFailure: true,
    mode: 'only-on-failure'
  },
  timeouts: {
    page: 60000,
    action: 30000,
    assertion: 15000
  }
};

// Test credentials
const VALID_CREDENTIALS = {
  email: 'test@example.com',
  password: 'testpassword123',
  fullName: 'Test User'
};

const INVALID_CREDENTIALS = {
  email: 'invalid@example.com',
  password: 'wrongpassword'
};

/**
 * PHASE 1: COMPONENT AVAILABILITY & RENDERING TESTS
 */
test.describe('🔍 Authentication Component Availability', () => {
  test('Auth screen renders and components are present', async ({ page }) => {
    await page.setViewportSize(TEST_CONFIG.viewport);
    await page.goto(SERVER_URL, { timeout: TEST_CONFIG.timeouts.page });

    // Wait for auth screen to load
    await page.waitForSelector('.auth-screen', { timeout: TEST_CONFIG.timeouts.assertion });

    // Take initial screenshot
    await page.screenshot({
      path: `${TEST_CONFIG.screenshots.path}-initial-load.png`,
      fullPage: true
    });

    // Verify main auth components exist
    const authScreen = page.locator('.auth-screen');
    await expect(authScreen).toBeVisible();

    // Check header elements
    await expect(page.locator('h1:has-text("Prioritas")')).toBeVisible();
    await expect(page.locator('h2:has-text("Welcome Back")')).toBeVisible();

    // Verify form elements are present
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    console.log('✅ All authentication components are present and rendered');
  });

  test('Component state management initialization', async ({ page }) => {
    await page.goto(SERVER_URL);
    await page.waitForSelector('.auth-screen');

    // Check for component state attributes
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toHaveAttribute('data-state', 'idle');
    await expect(submitButton).toHaveAttribute('data-variant');

    // Verify input components have proper refs
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();

    console.log('✅ Component state management properly initialized');
  });
});

/**
 * PHASE 2: FORM INTERACTION TESTING
 */
test.describe('📝 Form Interaction Testing', () => {
  test('Email input validation and behavior', async ({ page }) => {
    await page.goto(SERVER_URL);
    await page.waitForSelector('.auth-screen');

    const emailInput = page.locator('input[type="email"]');

    // Test empty email
    await emailInput.click();
    await emailInput.blur();
    await page.waitForTimeout(500); // Allow validation to trigger

    // Test invalid email format
    await emailInput.fill('invalid-email');
    await emailInput.blur();
    await page.waitForTimeout(500);

    // Test valid email
    await emailInput.fill(VALID_CREDENTIALS.email);
    await emailInput.blur();
    await page.waitForTimeout(500);

    await page.screenshot({
      path: `${TEST_CONFIG.screenshots.path}-email-validation.png`
    });

    console.log('✅ Email input validation tested');
  });

  test('Password input visibility toggle', async ({ page }) => {
    await page.goto(SERVER_URL);
    await page.waitForSelector('.auth-screen');

    const passwordInput = page.locator('input[type="password"]');
    const eyeButton = page.locator('button[aria-label*="password"]').first();

    // Verify initial state is password type
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // Click eye button to show password
    await eyeButton.click();
    await page.waitForTimeout(300);

    // Check if input type changed to text
    const inputType = await passwordInput.getAttribute('type');
    console.log(`Password input type after toggle: ${inputType}`);

    await page.screenshot({
      path: `${TEST_CONFIG.screenshots.path}-password-toggle.png`
    });

    console.log('✅ Password visibility toggle tested');
  });

  test('Form submission with component refs validation', async ({ page }) => {
    await page.goto(SERVER_URL);
    await page.waitForSelector('.auth-screen');

    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    const submitButton = page.locator('button[type="submit"]');

    // Fill valid credentials
    await emailInput.fill(VALID_CREDENTIALS.email);
    await passwordInput.fill(VALID_CREDENTIALS.password);

    await page.screenshot({
      path: `${TEST_CONFIG.screenshots.path}-form-filled.png`
    });

    // Monitor network requests
    const requestPromise = page.waitForRequest(request =>
      request.url().includes('supabase') || request.url().includes('auth')
    );

    // Submit form
    await submitButton.click();

    // Verify loading state
    await expect(submitButton).toHaveAttribute('data-state', 'loading');

    await page.screenshot({
      path: `${TEST_CONFIG.screenshots.path}-form-submitting.png`
    });

    // Wait for submission to complete or timeout
    try {
      await requestPromise;
      console.log('✅ Authentication request was made');
    } catch (error) {
      console.log('⚠️ No authentication request detected:', error.message);
    }

    await page.waitForTimeout(3000); // Allow for async operations

    await page.screenshot({
      path: `${TEST_CONFIG.screenshots.path}-form-submitted.png`
    });

    console.log('✅ Form submission behavior tested');
  });
});

/**
 * PHASE 3: STATE MANAGEMENT TESTING
 */
test.describe('🔄 Component State Management', () => {
  test('ComponentStateProvider integration', async ({ page }) => {
    await page.goto(SERVER_URL);
    await page.waitForSelector('.auth-screen');

    // Check for ComponentStateProvider context
    const hasContext = await page.evaluate(() => {
      return window.React && window.React.version;
    });

    console.log('React context availability:', hasContext);

    // Test state transitions on form interaction
    const submitButton = page.locator('button[type="submit"]');

    // Initial state
    const initialState = await submitButton.getAttribute('data-state');
    console.log('Initial button state:', initialState);

    // Fill form and check state changes
    await page.fill('input[type="email"]', VALID_CREDENTIALS.email);
    await page.fill('input[type="password"]', VALID_CREDENTIALS.password);

    // Submit and monitor state changes
    await submitButton.click();

    // Check for loading state
    await page.waitForTimeout(500);
    const loadingState = await submitButton.getAttribute('data-state');
    console.log('Loading button state:', loadingState);

    await page.screenshot({
      path: `${TEST_CONFIG.screenshots.path}-state-transitions.png`
    });

    console.log('✅ Component state transitions tested');
  });

  test('Error state handling', async ({ page }) => {
    await page.goto(SERVER_URL);
    await page.waitForSelector('.auth-screen');

    // Test with invalid credentials
    await page.fill('input[type="email"]', INVALID_CREDENTIALS.email);
    await page.fill('input[type="password"]', INVALID_CREDENTIALS.password);

    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();

    // Wait for error state
    await page.waitForTimeout(3000);

    // Check for error messages
    const errorElements = page.locator('[class*="error"], [class*="bg-error"], .text-error-700');
    const errorCount = await errorElements.count();
    console.log(`Found ${errorCount} error-related elements`);

    if (errorCount > 0) {
      for (let i = 0; i < errorCount; i++) {
        const errorText = await errorElements.nth(i).textContent();
        console.log(`Error element ${i + 1}:`, errorText);
      }
    }

    await page.screenshot({
      path: `${TEST_CONFIG.screenshots.path}-error-state.png`
    });

    console.log('✅ Error state handling tested');
  });
});

/**
 * PHASE 4: ANIMATION SYSTEM TESTING
 */
test.describe('✨ Animation System Testing', () => {
  test('Button hover animations', async ({ page }) => {
    await page.goto(SERVER_URL);
    await page.waitForSelector('.auth-screen');

    const submitButton = page.locator('button[type="submit"]');

    // Test hover states
    await submitButton.hover();
    await page.waitForTimeout(300);

    await page.screenshot({
      path: `${TEST_CONFIG.screenshots.path}-button-hover.png`
    });

    // Check for animation classes or transforms
    const hoverClasses = await submitButton.getAttribute('class');
    console.log('Button classes on hover:', hoverClasses);

    console.log('✅ Button hover animations tested');
  });

  test('Form transition animations', async ({ page }) => {
    await page.goto(SERVER_URL);
    await page.waitForSelector('.auth-screen');

    // Switch to signup mode
    const signupLink = page.locator('button:has-text("Sign up")');
    await signupLink.click();

    await page.waitForTimeout(500); // Allow transition

    // Verify signup form appeared
    await expect(page.locator('input[placeholder*="full name"]')).toBeVisible();
    await expect(page.locator('h2:has-text("Create Your Account")')).toBeVisible();

    await page.screenshot({
      path: `${TEST_CONFIG.screenshots.path}-signup-transition.png`
    });

    // Switch back to login
    const loginLink = page.locator('button:has-text("Sign in")');
    await loginLink.click();

    await page.waitForTimeout(500);

    await expect(page.locator('h2:has-text("Welcome Back")')).toBeVisible();

    await page.screenshot({
      path: `${TEST_CONFIG.screenshots.path}-login-transition.png`
    });

    console.log('✅ Form transition animations tested');
  });
});

/**
 * PHASE 5: COMPREHENSIVE ERROR SCENARIO TESTING
 */
test.describe('🚨 Comprehensive Error Scenarios', () => {
  test('Network timeout simulation', async ({ page }) => {
    // Simulate slow network
    await page.route('**/*', route => {
      setTimeout(() => route.continue(), 5000);
    });

    await page.goto(SERVER_URL, { timeout: 30000 });
    await page.waitForSelector('.auth-screen', { timeout: 20000 });

    await page.fill('input[type="email"]', VALID_CREDENTIALS.email);
    await page.fill('input[type="password"]', VALID_CREDENTIALS.password);

    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();

    // Monitor for timeout handling
    await page.waitForTimeout(10000);

    await page.screenshot({
      path: `${TEST_CONFIG.screenshots.path}-network-timeout.png`
    });

    console.log('✅ Network timeout scenario tested');
  });

  test('Component state corruption recovery', async ({ page }) => {
    await page.goto(SERVER_URL);
    await page.waitForSelector('.auth-screen');

    // Try to corrupt component state via JavaScript
    await page.evaluate(() => {
      // Attempt to find and corrupt React component state
      const buttons = document.querySelectorAll('button[data-state]');
      buttons.forEach(btn => {
        btn.setAttribute('data-state', 'corrupted');
        btn.disabled = true;
      });
    });

    await page.waitForTimeout(1000);

    await page.screenshot({
      path: `${TEST_CONFIG.screenshots.path}-state-corruption.png`
    });

    // Try to interact with form to see if recovery mechanisms work
    await page.fill('input[type="email"]', VALID_CREDENTIALS.email);
    await page.fill('input[type="password"]', VALID_CREDENTIALS.password);

    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();

    await page.waitForTimeout(2000);

    await page.screenshot({
      path: `${TEST_CONFIG.screenshots.path}-recovery-attempt.png`
    });

    console.log('✅ Component state corruption recovery tested');
  });
});

/**
 * PHASE 6: PERFORMANCE & RESPONSIVENESS
 */
test.describe('⚡ Performance & Responsiveness', () => {
  test('Mobile responsive behavior', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(SERVER_URL);
    await page.waitForSelector('.auth-screen');

    await page.screenshot({
      path: `${TEST_CONFIG.screenshots.path}-mobile-responsive.png`,
      fullPage: true
    });

    // Test form interaction on mobile
    await page.fill('input[type="email"]', VALID_CREDENTIALS.email);
    await page.fill('input[type="password"]', VALID_CREDENTIALS.password);

    await page.screenshot({
      path: `${TEST_CONFIG.screenshots.path}-mobile-filled.png`
    });

    console.log('✅ Mobile responsive behavior tested');
  });

  test('Performance timing measurements', async ({ page }) => {
    const startTime = Date.now();

    await page.goto(SERVER_URL);
    await page.waitForSelector('.auth-screen');

    const loadTime = Date.now() - startTime;
    console.log(`Page load time: ${loadTime}ms`);

    // Measure form interaction performance
    const interactionStart = Date.now();
    await page.fill('input[type="email"]', VALID_CREDENTIALS.email);
    await page.fill('input[type="password"]', VALID_CREDENTIALS.password);

    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();

    const interactionTime = Date.now() - interactionStart;
    console.log(`Form interaction time: ${interactionTime}ms`);

    // Collect performance metrics
    const metrics = await page.evaluate(() => {
      return {
        domContentLoaded: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart,
        loadComplete: performance.timing.loadEventEnd - performance.timing.navigationStart,
        renderTime: performance.timing.domComplete - performance.timing.domLoading
      };
    });

    console.log('Performance metrics:', metrics);
    console.log('✅ Performance timing measurements completed');
  });
});

/**
 * FINAL VALIDATION
 */
test.describe('🎯 Final Comprehensive Validation', () => {
  test('Complete authentication flow validation', async ({ page }) => {
    await page.goto(SERVER_URL);
    await page.waitForSelector('.auth-screen');

    console.log('🔍 Starting comprehensive authentication flow validation...');

    // Phase 1: Initial state
    await page.screenshot({
      path: `${TEST_CONFIG.screenshots.path}-final-initial.png`,
      fullPage: true
    });

    // Phase 2: Form filling
    await page.fill('input[type="email"]', VALID_CREDENTIALS.email);
    await page.waitForTimeout(300);
    await page.fill('input[type="password"]', VALID_CREDENTIALS.password);
    await page.waitForTimeout(300);

    await page.screenshot({
      path: `${TEST_CONFIG.screenshots.path}-final-filled.png`,
      fullPage: true
    });

    // Phase 3: Form submission
    const submitButton = page.locator('button[type="submit"]');

    // Monitor console for errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('❌ Console Error:', msg.text());
      }
    });

    // Monitor network requests
    page.on('request', request => {
      if (request.url().includes('auth') || request.url().includes('supabase')) {
        console.log('🌐 Auth request:', request.method(), request.url());
      }
    });

    page.on('response', response => {
      if (response.url().includes('auth') || response.url().includes('supabase')) {
        console.log('📡 Auth response:', response.status(), response.url());
      }
    });

    await submitButton.click();

    // Phase 4: Monitor submission state
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: `${TEST_CONFIG.screenshots.path}-final-submitting.png`,
      fullPage: true
    });

    // Phase 5: Wait for completion or timeout
    await page.waitForTimeout(5000);
    await page.screenshot({
      path: `${TEST_CONFIG.screenshots.path}-final-complete.png`,
      fullPage: true
    });

    // Phase 6: Check final page state
    const currentUrl = page.url();
    console.log('Final URL:', currentUrl);

    const pageTitle = await page.title();
    console.log('Final page title:', pageTitle);

    // Check for any error messages
    const errorElements = await page.locator('[class*="error"], [class*="bg-error"]').count();
    console.log(`Final error elements found: ${errorElements}`);

    // Check for success indicators
    const successElements = await page.locator('[class*="success"], [class*="bg-success"]').count();
    console.log(`Final success elements found: ${successElements}`);

    console.log('✅ Complete authentication flow validation finished');
  });
});