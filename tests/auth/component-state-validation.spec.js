/**
 * COMPONENT STATE VALIDATION TEST
 * Deep testing of ComponentStateProvider and useComponentState integration
 */

import { test, expect } from '@playwright/test';

const SERVER_URL = 'http://localhost:3004';

test.describe('🔄 Component State Provider Deep Validation', () => {
  test('Component state provider context availability', async ({ page }) => {
    await page.goto(SERVER_URL);
    await page.waitForSelector('.auth-screen');

    // Check if ComponentStateProvider context is properly initialized
    const contextAvailable = await page.evaluate(() => {
      // Try to access React DevTools or component state
      return new Promise((resolve) => {
        setTimeout(() => {
          // Check for React component state in DOM
          const buttons = document.querySelectorAll('button[data-state]');
          const inputs = document.querySelectorAll('input[class*="component-state"]');

          resolve({
            buttonStates: Array.from(buttons).map(btn => ({
              state: btn.getAttribute('data-state'),
              variant: btn.getAttribute('data-variant'),
              disabled: btn.disabled,
              classes: btn.className
            })),
            inputStates: Array.from(inputs).length,
            totalStateElements: buttons.length + inputs.length
          });
        }, 1000);
      });
    });

    console.log('Component state analysis:', JSON.stringify(contextAvailable, null, 2));

    await page.screenshot({
      path: 'test-screenshots/component-state-provider-init.png',
      fullPage: true
    });
  });

  test('useComponentState hook behavior validation', async ({ page }) => {
    await page.goto(SERVER_URL);
    await page.waitForSelector('.auth-screen');

    // Test component state transitions by interacting with elements
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    const submitButton = page.locator('button[type="submit"]');

    // Initial state check
    const initialButtonState = await submitButton.getAttribute('data-state');
    console.log('Initial button state:', initialButtonState);

    // Fill email and check for validation state changes
    await emailInput.fill('test@example.com');
    await emailInput.blur();
    await page.waitForTimeout(500);

    // Check if input has validation classes or state indicators
    const emailClasses = await emailInput.getAttribute('class');
    console.log('Email input classes after fill:', emailClasses);

    // Fill password
    await passwordInput.fill('testpassword');
    await passwordInput.blur();
    await page.waitForTimeout(500);

    const passwordClasses = await passwordInput.getAttribute('class');
    console.log('Password input classes after fill:', passwordClasses);

    // Submit and monitor state changes
    await submitButton.click();

    // Check loading state
    await page.waitForTimeout(300);
    const loadingButtonState = await submitButton.getAttribute('data-state');
    console.log('Button state during submission:', loadingButtonState);

    // Wait for state to settle
    await page.waitForTimeout(3000);
    const finalButtonState = await submitButton.getAttribute('data-state');
    console.log('Final button state:', finalButtonState);

    await page.screenshot({
      path: 'test-screenshots/component-state-transitions.png',
      fullPage: true
    });
  });

  test('Component ref validation and error handling', async ({ page }) => {
    await page.goto(SERVER_URL);
    await page.waitForSelector('.auth-screen');

    // Test component ref functionality by triggering validation
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    const submitButton = page.locator('button[type="submit"]');

    // Test empty form submission to trigger ref-based validation
    await submitButton.click();
    await page.waitForTimeout(1000);

    // Check for validation error states
    const formErrors = await page.evaluate(() => {
      const errorElements = document.querySelectorAll('[class*="error"], [aria-invalid="true"]');
      return Array.from(errorElements).map(el => ({
        tagName: el.tagName,
        textContent: el.textContent,
        className: el.className,
        ariaInvalid: el.getAttribute('aria-invalid')
      }));
    });

    console.log('Form validation errors:', JSON.stringify(formErrors, null, 2));

    // Test invalid email format
    await emailInput.fill('invalid-email');
    await emailInput.blur();
    await page.waitForTimeout(500);

    await passwordInput.fill('short');
    await passwordInput.blur();
    await page.waitForTimeout(500);

    await submitButton.click();
    await page.waitForTimeout(1000);

    const validationErrors = await page.evaluate(() => {
      const errorElements = document.querySelectorAll('[class*="error"], [aria-invalid="true"]');
      return Array.from(errorElements).map(el => ({
        tagName: el.tagName,
        textContent: el.textContent,
        className: el.className
      }));
    });

    console.log('Validation errors after invalid input:', JSON.stringify(validationErrors, null, 2));

    await page.screenshot({
      path: 'test-screenshots/component-ref-validation.png',
      fullPage: true
    });
  });

  test('Animation and transition coordination', async ({ page }) => {
    await page.goto(SERVER_URL);
    await page.waitForSelector('.auth-screen');

    // Monitor for CSS transitions and animations
    await page.addStyleTag({
      content: `
        * {
          transition-duration: 0.3s !important;
          animation-duration: 0.3s !important;
        }
      `
    });

    const submitButton = page.locator('button[type="submit"]');

    // Test hover animations
    await submitButton.hover();
    await page.waitForTimeout(500);

    // Capture computed styles during hover
    const hoverStyles = await page.evaluate(() => {
      const btn = document.querySelector('button[type="submit"]');
      if (btn) {
        const computed = window.getComputedStyle(btn);
        return {
          transform: computed.transform,
          boxShadow: computed.boxShadow,
          backgroundColor: computed.backgroundColor,
          borderColor: computed.borderColor,
          transition: computed.transition
        };
      }
      return null;
    });

    console.log('Button hover styles:', JSON.stringify(hoverStyles, null, 2));

    await page.screenshot({
      path: 'test-screenshots/animation-hover-state.png'
    });

    // Test form mode transitions
    const signupLink = page.locator('button:has-text("Sign up")');
    await signupLink.click();
    await page.waitForTimeout(800); // Allow transition time

    // Check if signup form elements appeared
    const signupFormVisible = await page.locator('input[placeholder*="full name"]').isVisible();
    console.log('Signup form visible after transition:', signupFormVisible);

    await page.screenshot({
      path: 'test-screenshots/form-mode-transition.png',
      fullPage: true
    });

    // Switch back to login
    const loginLink = page.locator('button:has-text("Sign in")');
    await loginLink.click();
    await page.waitForTimeout(800);

    const loginFormVisible = await page.locator('h2:has-text("Welcome Back")').isVisible();
    console.log('Login form visible after transition:', loginFormVisible);
  });

  test('Memory leak and performance validation', async ({ page }) => {
    await page.goto(SERVER_URL);
    await page.waitForSelector('.auth-screen');

    // Monitor JavaScript heap and DOM nodes
    const initialMetrics = await page.evaluate(() => {
      return {
        jsHeapSize: performance.memory ? performance.memory.usedJSHeapSize : 0,
        domNodes: document.querySelectorAll('*').length,
        eventListeners: getEventListeners ? Object.keys(getEventListeners(document)).length : 0
      };
    });

    console.log('Initial performance metrics:', initialMetrics);

    // Perform multiple form interactions
    for (let i = 0; i < 5; i++) {
      // Fill and clear form
      await page.fill('input[type="email"]', `test${i}@example.com`);
      await page.fill('input[type="password"]', `password${i}`);

      // Switch to signup and back
      await page.click('button:has-text("Sign up")');
      await page.waitForTimeout(300);
      await page.click('button:has-text("Sign in")');
      await page.waitForTimeout(300);

      // Clear inputs
      await page.fill('input[type="email"]', '');
      await page.fill('input[type="password"]', '');
    }

    // Check metrics after interactions
    const finalMetrics = await page.evaluate(() => {
      return {
        jsHeapSize: performance.memory ? performance.memory.usedJSHeapSize : 0,
        domNodes: document.querySelectorAll('*').length,
        eventListeners: getEventListeners ? Object.keys(getEventListeners(document)).length : 0
      };
    });

    console.log('Final performance metrics:', finalMetrics);

    const heapIncrease = finalMetrics.jsHeapSize - initialMetrics.jsHeapSize;
    const nodeIncrease = finalMetrics.domNodes - initialMetrics.domNodes;

    console.log(`Heap size increase: ${heapIncrease} bytes`);
    console.log(`DOM node increase: ${nodeIncrease} nodes`);

    if (heapIncrease > 1000000) { // 1MB threshold
      console.warn('⚠️ Potential memory leak detected: Large heap increase');
    }

    if (nodeIncrease > 100) {
      console.warn('⚠️ Potential DOM leak detected: Many new nodes');
    }
  });

  test('Component state persistence and recovery', async ({ page }) => {
    await page.goto(SERVER_URL);
    await page.waitForSelector('.auth-screen');

    // Fill form with data
    await page.fill('input[type="email"]', 'persistence-test@example.com');
    await page.fill('input[type="password"]', 'persistpassword');

    // Check if state is persisted in localStorage
    const persistedState = await page.evaluate(() => {
      const keys = Object.keys(localStorage).filter(key =>
        key.includes('componentState') || key.includes('auth') || key.includes('form')
      );

      const state = {};
      keys.forEach(key => {
        try {
          state[key] = JSON.parse(localStorage.getItem(key));
        } catch {
          state[key] = localStorage.getItem(key);
        }
      });

      return state;
    });

    console.log('Persisted component state:', JSON.stringify(persistedState, null, 2));

    // Simulate page refresh
    await page.reload();
    await page.waitForSelector('.auth-screen');

    // Check if form state was restored
    const emailValue = await page.locator('input[type="email"]').inputValue();
    const passwordValue = await page.locator('input[type="password"]').inputValue();

    console.log('After reload - Email value:', emailValue);
    console.log('After reload - Password value:', passwordValue);

    // Check component state restoration
    const restoredButtonState = await page.locator('button[type="submit"]').getAttribute('data-state');
    console.log('Restored button state:', restoredButtonState);

    await page.screenshot({
      path: 'test-screenshots/component-state-persistence.png',
      fullPage: true
    });
  });
});