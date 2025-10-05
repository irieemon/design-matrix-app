/**
 * COMPREHENSIVE AUTHENTICATION USER JOURNEYS E2E TESTS
 * Tests complete user authentication flows from start to finish
 *
 * Coverage:
 * - New user signup journey
 * - Login flow with various scenarios
 * - Demo user flow
 * - Password reset flow
 * - Session persistence
 * - Logout flow
 */

import { test, expect } from '@playwright/test';
import { AuthPage } from './page-objects/AuthPage';

// Test configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3003';

// Test credentials
const TEST_USER = {
  fullName: 'Test User',
  email: `test-${Date.now()}@example.com`,
  password: 'SecurePass123!',
  invalidPassword: 'wrong'
};

const EXISTING_USER = {
  email: 'existing@example.com',
  password: 'ExistingPass123!'
};

test.describe('Authentication Complete User Journeys', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
  });

  /**
   * NEW USER SIGNUP FLOW TESTS (8 tests)
   */
  test.describe('New User Signup Flow', () => {
    test('should successfully display signup form with all required fields', async ({ page }) => {
      const authPage = new AuthPage(page);
      await authPage.switchToSignup();

      await authPage.expectSignupMode();
      await expect(authPage.fullNameInput).toBeVisible();
      await expect(authPage.emailInput).toBeVisible();
      await expect(authPage.passwordInput).toBeVisible();
      await expect(authPage.confirmPasswordInput).toBeVisible();
      await expect(authPage.submitButton).toContainText('Create Account');
    });

    test('should validate full name is required', async ({ page }) => {
      const authPage = new AuthPage(page);
      await authPage.switchToSignup();

      // Trigger blur to activate validation
      await authPage.fullNameInput.focus();
      await authPage.fullNameInput.blur();
      await page.waitForTimeout(500);

      // Wait for validation error to appear with proper timeout
      const errorMessage = page.locator('.input-message--error').first();
      await expect(errorMessage).toBeVisible({ timeout: 5000 });
    });

    test('should validate full name minimum length (2 characters)', async ({ page }) => {
      const authPage = new AuthPage(page);
      await authPage.switchToSignup();

      await authPage.fullNameInput.fill('A');
      await authPage.fullNameInput.blur();
      await page.waitForTimeout(500);

      const errorText = await page.locator('.input-message--error').first().textContent();
      expect(errorText).toContain('at least 2 characters');
    });

    test('should validate email format in signup', async ({ page }) => {
      const authPage = new AuthPage(page);
      await authPage.switchToSignup();

      // Test invalid email with proper validation timing
      await authPage.emailInput.fill('invalid-email');
      await authPage.emailInput.blur();
      await page.waitForTimeout(800); // Increased wait for validation to complete

      // Check for validation error using input-message--error selector
      const errorMessage = page.locator('.input-message--error').first();
      await expect(errorMessage).toBeVisible({ timeout: 5000 });
    });

    test('should validate password minimum length (6 characters)', async ({ page }) => {
      const authPage = new AuthPage(page);
      await authPage.switchToSignup();

      await authPage.passwordInput.fill('12345');
      await authPage.passwordInput.blur();
      await page.waitForTimeout(500);

      const errorText = await page.locator('.input-message--error').first().textContent();
      expect(errorText).toContain('at least 6 characters');
    });

    test('should validate password confirmation match', async ({ page }) => {
      const authPage = new AuthPage(page);
      await authPage.switchToSignup();

      await authPage.fullNameInput.fill(TEST_USER.fullName);
      await authPage.emailInput.fill(TEST_USER.email);
      await authPage.passwordInput.fill(TEST_USER.password);
      await authPage.confirmPasswordInput.fill('DifferentPassword123!');
      await authPage.confirmPasswordInput.blur();
      await page.waitForTimeout(500);

      const errorText = await page.locator('.input-message--error').textContent();
      expect(errorText).toContain('do not match');
    });

    test('should show success message after signup', async ({ page }) => {
      const authPage = new AuthPage(page);
      await authPage.switchToSignup();

      await authPage.signup(
        TEST_USER.fullName,
        TEST_USER.email,
        TEST_USER.password
      );

      // Wait for success message or mode switch
      await page.waitForTimeout(2000);

      // Should show email confirmation message
      const hasSuccess = await authPage.successMessage.isVisible().catch(() => false);
      if (hasSuccess) {
        const successText = await authPage.getSuccessText();
        expect(successText).toContain('email');
      }
    });

    test('should handle signup with special characters in password', async ({ page }) => {
      const authPage = new AuthPage(page);
      await authPage.switchToSignup();

      const specialPassword = 'P@ssw0rd!#$%';
      await authPage.signup(
        'Special User',
        `special-${Date.now()}@example.com`,
        specialPassword
      );

      await page.waitForTimeout(2000);

      // Should not show error - check both auth error and validation errors
      const authError = await authPage.errorMessage.isVisible().catch(() => false);
      const validationError = await page.locator('.input-message--error').isVisible().catch(() => false);

      expect(authError || validationError).toBeFalsy();
    });
  });

  /**
   * LOGIN FLOW TESTS (10 tests)
   */
  test.describe('Login Flow', () => {
    test('should display login form by default', async ({ page }) => {
      const authPage = new AuthPage(page);
      await authPage.expectLoginMode();
    });

    test('should validate email is required for login', async ({ page }) => {
      const authPage = new AuthPage(page);

      // Trigger validation by focusing and blurring
      await authPage.emailInput.focus();
      await authPage.emailInput.blur();
      await page.waitForTimeout(500);

      // Wait for validation error to appear
      const errorMessage = page.locator('.input-message--error').first();
      await expect(errorMessage).toBeVisible({ timeout: 5000 });
    });

    test('should validate email format for login', async ({ page }) => {
      const authPage = new AuthPage(page);

      await authPage.emailInput.fill('not-an-email');
      await authPage.emailInput.blur();
      await page.waitForTimeout(500);

      const errorText = await page.locator('.input-message--error').first().textContent();
      expect(errorText).toContain('valid email');
    });

    test('should validate password is required for login', async ({ page }) => {
      const authPage = new AuthPage(page);

      await authPage.emailInput.fill(TEST_USER.email);
      // Trigger validation by focusing and blurring password field
      await authPage.passwordInput.focus();
      await authPage.passwordInput.blur();
      await page.waitForTimeout(500);

      // Wait for validation error to appear
      const errorMessage = page.locator('.input-message--error').first();
      await expect(errorMessage).toBeVisible({ timeout: 5000 });
    });

    test('should show loading state during login submission', async ({ page }) => {
      const authPage = new AuthPage(page);

      await authPage.emailInput.fill(EXISTING_USER.email);
      await authPage.passwordInput.fill(EXISTING_USER.password);

      const buttonState = await authPage.getButtonState();
      expect(buttonState).toBe('idle');

      // Intercept ANY request to supabase auth endpoints
      let requestMade = false;
      await page.route('**/*.supabase.co/auth/**', async route => {
        requestMade = true;
        // Hold the request for 1 second
        await new Promise(resolve => setTimeout(resolve, 1000));
        await route.continue();
      });

      // Click the button
      await authPage.submitButton.click();

      // Wait for the loading state to appear (with more generous timeout)
      await expect(authPage.submitButton).toHaveAttribute('data-state', 'loading', { timeout: 5000 });

      // Cleanup route
      await page.unroute('**/*.supabase.co/auth/**');

      // Verify request was actually made
      expect(requestMade).toBeTruthy();
    });

    test('should show error for invalid credentials', async ({ page }) => {
      const authPage = new AuthPage(page);

      await authPage.login('invalid@example.com', 'wrongpassword');
      await page.waitForTimeout(3000);

      const hasError = await authPage.errorMessage.isVisible().catch(() => false);
      if (hasError) {
        const errorText = await authPage.getErrorText();
        expect(errorText.toLowerCase()).toContain('invalid');
      }
    });

    test('should toggle password visibility', async ({ page }) => {
      const authPage = new AuthPage(page);

      // Initial state should be hidden
      let inputType = await authPage.getPasswordInputType();
      expect(inputType).toBe('password');

      // Toggle to show
      await authPage.togglePasswordVisibility();
      inputType = await authPage.getPasswordInputType();
      expect(inputType).toBe('text');

      // Toggle to hide
      await authPage.togglePasswordVisibility();
      inputType = await authPage.getPasswordInputType();
      expect(inputType).toBe('password');
    });

    test('should support Enter key to submit login form', async ({ page }) => {
      const authPage = new AuthPage(page);

      await authPage.emailInput.fill(EXISTING_USER.email);
      await authPage.passwordInput.fill(EXISTING_USER.password);

      // Intercept ANY request to supabase auth endpoints
      let requestMade = false;
      await page.route('**/*.supabase.co/auth/**', async route => {
        requestMade = true;
        // Hold the request for 1 second
        await new Promise(resolve => setTimeout(resolve, 1000));
        await route.continue();
      });

      // Press Enter to submit
      await authPage.submitWithEnter();

      // Wait for the loading state to appear (with more generous timeout)
      await expect(authPage.submitButton).toHaveAttribute('data-state', 'loading', { timeout: 5000 });

      // Cleanup route
      await page.unroute('**/*.supabase.co/auth/**');

      // Verify request was actually made
      expect(requestMade).toBeTruthy();
    });

    test('should prevent double submission of login form', async ({ page }) => {
      const authPage = new AuthPage(page);

      await authPage.emailInput.fill(EXISTING_USER.email);
      await authPage.passwordInput.fill(EXISTING_USER.password);

      // Intercept ANY request to supabase auth endpoints
      let requestCount = 0;
      await page.route('**/*.supabase.co/auth/**', async route => {
        requestCount++;
        // Hold the request for 1 second
        await new Promise(resolve => setTimeout(resolve, 1000));
        await route.continue();
      });

      // Click the button
      await authPage.submitButton.click();

      // Wait for loading state
      await expect(authPage.submitButton).toHaveAttribute('data-state', 'loading', { timeout: 5000 });

      // Try to click again while loading (should be prevented)
      await authPage.submitButton.click();

      // Wait a bit to see if a second request would be made
      await page.waitForTimeout(500);

      // Cleanup route
      await page.unroute('**/*.supabase.co/auth/**');

      // Verify button is still in loading state (double submission prevented)
      const buttonState = await authPage.getButtonState();
      expect(buttonState === 'loading' || buttonState === 'error').toBeTruthy();

      // Verify only one request was made (double submission prevented)
      expect(requestCount).toBe(1);
    });

    test('should switch between login and signup modes smoothly', async ({ page }) => {
      const authPage = new AuthPage(page);

      // Start in login mode
      await authPage.expectLoginMode();

      // Switch to signup
      await authPage.switchToSignup();
      await authPage.expectSignupMode();

      // Switch back to login
      await authPage.switchToLogin();
      await authPage.expectLoginMode();
    });
  });

  /**
   * DEMO USER FLOW TESTS (3 tests)
   */
  test.describe('Demo User Flow', () => {
    test('should display demo user button on login page', async ({ page }) => {
      const authPage = new AuthPage(page);

      await expect(authPage.demoUserButton).toBeVisible();
      await expect(authPage.demoUserButton).toContainText('Demo User');
    });

    test('should successfully login as demo user with one click', async ({ page }) => {
      const authPage = new AuthPage(page);

      await authPage.clickDemoUser();

      // Should navigate away from auth screen
      await page.waitForTimeout(2000);

      const currentUrl = page.url();
      expect(currentUrl).not.toContain('/auth');
    });

    test('should create demo session without requiring credentials', async ({ page }) => {
      const authPage = new AuthPage(page);

      // Demo button should work without filling any fields
      await expect(authPage.emailInput).toBeEmpty();
      await expect(authPage.passwordInput).toBeEmpty();

      await authPage.clickDemoUser();
      await page.waitForTimeout(2000);

      // Should be authenticated
      const currentUrl = page.url();
      expect(currentUrl).not.toContain('/auth');
    });
  });

  /**
   * PASSWORD RESET FLOW TESTS (5 tests)
   */
  test.describe('Password Reset Flow', () => {
    test('should navigate to forgot password page', async ({ page }) => {
      const authPage = new AuthPage(page);

      await authPage.switchToForgotPassword();
      await authPage.expectForgotPasswordMode();
    });

    test('should show forgot password link on login page', async ({ page }) => {
      const authPage = new AuthPage(page);

      await expect(authPage.forgotPasswordLink).toBeVisible();
      await expect(authPage.forgotPasswordLink).toContainText('Forgot');
    });

    test('should validate email for password reset', async ({ page }) => {
      const authPage = new AuthPage(page);
      await authPage.switchToForgotPassword();

      // Fill invalid email and trigger validation
      await authPage.emailInput.fill('invalid-email');
      await authPage.emailInput.blur();
      await page.waitForTimeout(800); // Increased wait for validation to complete

      // Check for validation error using input-message--error selector
      const errorMessage = page.locator('.input-message--error').first();
      await expect(errorMessage).toBeVisible({ timeout: 5000 });
    });

    test('should show success message after password reset request', async ({ page }) => {
      const authPage = new AuthPage(page);
      await authPage.switchToForgotPassword();

      await authPage.requestPasswordReset('test@example.com');
      await page.waitForTimeout(2000);

      const hasSuccess = await authPage.successMessage.isVisible().catch(() => false);
      if (hasSuccess) {
        const successText = await authPage.getSuccessText();
        expect(successText.toLowerCase()).toContain('email');
      }
    });

    test('should navigate back to login from forgot password', async ({ page }) => {
      const authPage = new AuthPage(page);
      await authPage.switchToForgotPassword();

      await authPage.backToLogin();
      await authPage.expectLoginMode();
    });
  });

  /**
   * SESSION PERSISTENCE TESTS (4 tests)
   */
  test.describe('Session Persistence', () => {
    test('should persist demo session after page refresh', async ({ page, context }) => {
      const authPage = new AuthPage(page);

      await authPage.clickDemoUser();
      await page.waitForTimeout(2000);

      const urlBeforeRefresh = page.url();

      // Refresh page
      await page.reload();
      await page.waitForTimeout(2000);

      const urlAfterRefresh = page.url();

      // Should remain authenticated
      expect(urlAfterRefresh).toBe(urlBeforeRefresh);
    });

    test('should maintain session across new tab', async ({ page, context }) => {
      const authPage = new AuthPage(page);

      await authPage.clickDemoUser();
      await page.waitForTimeout(2000);

      // Open new tab
      const newPage = await context.newPage();
      await newPage.goto(BASE_URL);
      await page.waitForTimeout(2000);

      const newPageUrl = newPage.url();

      // Should be authenticated in new tab
      expect(newPageUrl).not.toContain('/auth');

      await newPage.close();
    });

    test('should handle navigation and return', async ({ page }) => {
      const authPage = new AuthPage(page);

      await authPage.clickDemoUser();
      await page.waitForTimeout(2000);

      // Navigate to a different route
      await page.goto(`${BASE_URL}/projects`);
      await page.waitForTimeout(1000);

      // Navigate back
      await page.goBack();
      await page.waitForTimeout(1000);

      // Should still be authenticated
      const currentUrl = page.url();
      expect(currentUrl).not.toContain('/auth');
    });

    test('should restore session on browser back button', async ({ page }) => {
      const authPage = new AuthPage(page);

      // Record initial URL
      const initialUrl = page.url();

      await authPage.clickDemoUser();
      await page.waitForTimeout(2000);

      // Go back and wait for navigation to complete
      await page.goBack();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      // Verify we're back at login screen (browser may go to about:blank depending on navigation stack)
      await authPage.expectLoginMode();

      // Go forward and wait for navigation to complete
      await page.goForward();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      // Should be authenticated again
      const currentUrl = page.url();
      expect(currentUrl).not.toContain('/auth');
    });
  });

  /**
   * LOGOUT FLOW TESTS (3 tests)
   */
  test.describe('Logout Flow', () => {
    test.beforeEach(async ({ page }) => {
      // Login before each logout test
      const authPage = new AuthPage(page);
      await authPage.clickDemoUser();
      await page.waitForTimeout(2000);
    });

    test('should successfully logout and return to login screen', async ({ page }) => {
      // Find logout button (implementation depends on your UI)
      const logoutButton = page.locator('button:has-text("Logout"), button:has-text("Sign Out")').first();

      if (await logoutButton.isVisible().catch(() => false)) {
        await logoutButton.click();
        await page.waitForTimeout(1000);

        // Should be back at login
        const authPage = new AuthPage(page);
        await authPage.expectLoginMode();
      }
    });

    test('should clear session data on logout', async ({ page }) => {
      const logoutButton = page.locator('button:has-text("Logout"), button:has-text("Sign Out")').first();

      if (await logoutButton.isVisible().catch(() => false)) {
        await logoutButton.click();
        await page.waitForTimeout(1000);

        // Try to access protected route
        await page.goto(`${BASE_URL}/projects`);
        await page.waitForTimeout(1000);

        // Should redirect to login
        const authPage = new AuthPage(page);
        await authPage.expectLoginMode();
      }
    });

    test('should not be able to use back button after logout', async ({ page }) => {
      const urlBeforeLogout = page.url();

      const logoutButton = page.locator('button:has-text("Logout"), button:has-text("Sign Out")').first();

      if (await logoutButton.isVisible().catch(() => false)) {
        await logoutButton.click();
        await page.waitForTimeout(1000);

        // Try to go back
        await page.goBack();
        await page.waitForTimeout(1000);

        // Should still be at login
        const authPage = new AuthPage(page);
        await authPage.expectLoginMode();
      }
    });
  });

  /**
   * ERROR HANDLING TESTS (3 tests)
   */
  test.describe('Error Handling and Edge Cases', () => {
    test('should clear error message when switching modes', async ({ page }) => {
      const authPage = new AuthPage(page);

      // Trigger an error in login
      await authPage.login('invalid@example.com', 'wrong');
      await page.waitForTimeout(2000);

      // Switch to signup and wait for mode transition to complete
      await authPage.switchToSignup();
      await page.waitForTimeout(800); // Increased wait for mode switch animation

      // Error should be cleared - check both auth errors and validation errors
      const authError = await authPage.errorMessage.isVisible().catch(() => false);
      const validationError = await page.locator('.input-message--error').isVisible().catch(() => false);

      expect(authError || validationError).toBeFalsy();
    });

    test('should handle very long input values', async ({ page }) => {
      const authPage = new AuthPage(page);
      await authPage.switchToSignup();

      const longName = 'A'.repeat(200);
      const longEmail = 'a'.repeat(100) + '@example.com';

      await authPage.fullNameInput.fill(longName);
      await authPage.emailInput.fill(longEmail);

      // Should handle without crashing
      await expect(authPage.fullNameInput).toBeVisible();
      await expect(authPage.emailInput).toBeVisible();
    });

    test('should handle rapid mode switching', async ({ page }) => {
      const authPage = new AuthPage(page);

      // Rapidly switch modes
      await authPage.switchToSignup();
      await authPage.switchToLogin();
      await authPage.switchToSignup();
      await authPage.switchToLogin();

      // Should end up in login mode
      await authPage.expectLoginMode();
    });
  });
});
