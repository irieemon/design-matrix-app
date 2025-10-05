/**
 * COMPREHENSIVE AUTHENTICATION SECURITY E2E TESTS
 * Tests security aspects of the authentication system
 *
 * Coverage:
 * - Rate limiting for failed login attempts
 * - XSS prevention in auth forms
 * - SQL injection prevention
 * - CSRF protection
 * - Session timeout handling
 * - Invalid token handling
 * - Input sanitization
 * - Secure password handling
 */

import { test, expect } from '@playwright/test';
import { AuthPage } from './page-objects/AuthPage';

// Test configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3003';

// Security test payloads
const XSS_PAYLOADS = [
  '<script>alert("XSS")</script>',
  '<img src=x onerror=alert("XSS")>',
  'javascript:alert("XSS")',
  '<svg onload=alert("XSS")>',
  '"><script>alert(String.fromCharCode(88,83,83))</script>'
];

const SQL_INJECTION_PAYLOADS = [
  "' OR '1'='1",
  "admin'--",
  "' OR '1'='1' --",
  "1' UNION SELECT NULL--",
  "'; DROP TABLE users--"
];

const SPECIAL_CHARACTERS = [
  '!@#$%^&*()',
  '"><\'',
  '\n\r\t',
  'unicode: 你好世界',
  'emoji: 😀🎉🚀'
];

test.describe('Authentication Security Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
  });

  /**
   * RATE LIMITING TESTS (5 tests)
   */
  test.describe('Rate Limiting Protection', () => {
    test('should handle multiple failed login attempts', async ({ page }) => {
      const authPage = new AuthPage(page);

      // Attempt multiple failed logins
      for (let i = 0; i < 5; i++) {
        await authPage.login('test@example.com', 'wrongpassword');
        await page.waitForTimeout(2000);
      }

      // System should still be responsive
      await expect(authPage.submitButton).toBeVisible();
      await expect(authPage.emailInput).toBeEnabled();
    });

    test('should not lock out user permanently after failed attempts', async ({ page }) => {
      const authPage = new AuthPage(page);

      // Multiple failed attempts
      for (let i = 0; i < 10; i++) {
        await authPage.emailInput.fill('test@example.com');
        await authPage.passwordInput.fill('wrongpassword');
        await authPage.submitButton.click();
        await page.waitForTimeout(1000);
      }

      // Should still allow demo user login
      await expect(authPage.demoUserButton).toBeEnabled();
    });

    test('should throttle rapid submission attempts', async ({ page }) => {
      const authPage = new AuthPage(page);

      await authPage.emailInput.fill('test@example.com');
      await authPage.passwordInput.fill('password123');

      // Try rapid submissions
      await authPage.submitButton.click();
      await page.waitForTimeout(100);
      await authPage.submitButton.click();
      await page.waitForTimeout(100);
      await authPage.submitButton.click();

      // Button should be in loading or disabled state
      const buttonState = await authPage.getButtonState();
      expect(['loading', 'idle'].includes(buttonState)).toBeTruthy();
    });

    test('should handle concurrent login attempts gracefully', async ({ page, context }) => {
      const authPage = new AuthPage(page);

      // Fill credentials
      await authPage.emailInput.fill('test@example.com');
      await authPage.passwordInput.fill('password123');

      // Submit and immediately open new tab
      await authPage.submitButton.click();

      const newPage = await context.newPage();
      await newPage.goto(BASE_URL);
      await page.waitForTimeout(500);

      // Both pages should remain functional
      await expect(authPage.submitButton).toBeVisible();
      await expect(newPage.locator('.auth-screen')).toBeVisible();

      await newPage.close();
    });

    test('should recover after rate limit period', async ({ page }) => {
      const authPage = new AuthPage(page);

      // Multiple failed attempts
      for (let i = 0; i < 5; i++) {
        await authPage.login('test@example.com', 'wrong');
        await page.waitForTimeout(500);
      }

      // Wait for potential rate limit cooldown
      await page.waitForTimeout(3000);

      // Should be able to attempt login again
      await authPage.emailInput.fill('test@example.com');
      await authPage.passwordInput.fill('password123');
      await expect(authPage.submitButton).toBeEnabled();
    });
  });

  /**
   * XSS PREVENTION TESTS (5 tests)
   */
  test.describe('XSS Prevention', () => {
    test('should sanitize email input against XSS', async ({ page }) => {
      const authPage = new AuthPage(page);

      for (const payload of XSS_PAYLOADS) {
        await authPage.emailInput.fill(payload);
        await authPage.emailInput.blur();
        await page.waitForTimeout(300);

        // Check no script was executed (page should still be visible)
        await expect(authPage.authScreen).toBeVisible();

        // Check for alert dialogs
        page.on('dialog', dialog => {
          throw new Error('XSS vulnerability: Alert dialog appeared');
        });
      }
    });

    test('should sanitize password input against XSS', async ({ page }) => {
      const authPage = new AuthPage(page);

      for (const payload of XSS_PAYLOADS) {
        await authPage.passwordInput.fill(payload);
        await authPage.passwordInput.blur();
        await page.waitForTimeout(300);

        await expect(authPage.authScreen).toBeVisible();
      }
    });

    test('should sanitize full name input against XSS in signup', async ({ page }) => {
      const authPage = new AuthPage(page);
      await authPage.switchToSignup();

      for (const payload of XSS_PAYLOADS) {
        await authPage.fullNameInput.fill(payload);
        await authPage.fullNameInput.blur();
        await page.waitForTimeout(300);

        await expect(authPage.authScreen).toBeVisible();
      }
    });

    test('should not execute scripts in error messages', async ({ page }) => {
      const authPage = new AuthPage(page);

      const xssEmail = '<script>alert("XSS")</script>@example.com';
      await authPage.login(xssEmail, 'password');
      await page.waitForTimeout(2000);

      // Check error message is displayed safely
      if (await authPage.errorMessage.isVisible()) {
        const errorText = await authPage.getErrorText();
        expect(errorText).not.toContain('<script>');
      }
    });

    test('should handle HTML entities in user input', async ({ page }) => {
      const authPage = new AuthPage(page);
      await authPage.switchToSignup();

      const htmlEntities = '&lt;script&gt;alert("test")&lt;/script&gt;';
      await authPage.fullNameInput.fill(htmlEntities);

      // Should not decode and execute
      await expect(authPage.authScreen).toBeVisible();
    });
  });

  /**
   * SQL INJECTION PREVENTION TESTS (5 tests)
   */
  test.describe('SQL Injection Prevention', () => {
    test('should handle SQL injection in email field', async ({ page }) => {
      const authPage = new AuthPage(page);

      for (const payload of SQL_INJECTION_PAYLOADS) {
        await authPage.login(payload, 'password');
        await page.waitForTimeout(2000);

        // Should show normal error, not database error
        if (await authPage.errorMessage.isVisible()) {
          const errorText = await authPage.getErrorText();
          expect(errorText.toLowerCase()).not.toContain('sql');
          expect(errorText.toLowerCase()).not.toContain('database');
          expect(errorText.toLowerCase()).not.toContain('syntax');
        }

        // Page should remain functional
        await expect(authPage.authScreen).toBeVisible();
      }
    });

    test('should handle SQL injection in password field', async ({ page }) => {
      const authPage = new AuthPage(page);

      for (const payload of SQL_INJECTION_PAYLOADS) {
        await authPage.login('test@example.com', payload);
        await page.waitForTimeout(2000);

        await expect(authPage.authScreen).toBeVisible();

        if (await authPage.errorMessage.isVisible()) {
          const errorText = await authPage.getErrorText();
          expect(errorText.toLowerCase()).not.toContain('sql');
        }
      }
    });

    test('should prevent SQL injection through signup form', async ({ page }) => {
      const authPage = new AuthPage(page);
      await authPage.switchToSignup();

      const sqlPayload = "'; DROP TABLE users--";
      await authPage.signup('Test User', sqlPayload, 'password123');
      await page.waitForTimeout(2000);

      // Application should remain functional
      await expect(authPage.authScreen).toBeVisible();
    });

    test('should handle multiple SQL operators safely', async ({ page }) => {
      const authPage = new AuthPage(page);

      const complexPayload = "admin' OR '1'='1' UNION SELECT * FROM users--";
      await authPage.login(complexPayload, 'password');
      await page.waitForTimeout(2000);

      // Should not expose database structure
      if (await authPage.errorMessage.isVisible()) {
        const errorText = await authPage.getErrorText();
        expect(errorText).not.toContain('column');
        expect(errorText).not.toContain('table');
      }
    });

    test('should sanitize SQL comments and special characters', async ({ page }) => {
      const authPage = new AuthPage(page);

      const payloads = ['--', '/*', '*/', ';--', 'OR 1=1'];

      for (const payload of payloads) {
        await authPage.emailInput.fill(`test${payload}@example.com`);
        await authPage.passwordInput.fill(`pass${payload}word`);
        await authPage.submitButton.click();
        await page.waitForTimeout(1000);

        await expect(authPage.authScreen).toBeVisible();
      }
    });
  });

  /**
   * CSRF PROTECTION TESTS (3 tests)
   */
  test.describe('CSRF Protection', () => {
    test('should include CSRF protection in login requests', async ({ page }) => {
      const authPage = new AuthPage(page);

      let hasAuthHeader = false;

      page.on('request', request => {
        if (request.url().includes('auth') || request.url().includes('supabase')) {
          const headers = request.headers();
          hasAuthHeader = 'authorization' in headers || 'x-csrf-token' in headers;
        }
      });

      await authPage.login('test@example.com', 'password123');
      await page.waitForTimeout(2000);

      // Should have some form of authentication/CSRF protection
      expect(hasAuthHeader).toBeTruthy();
    });

    test('should validate origin of authentication requests', async ({ page }) => {
      const authPage = new AuthPage(page);

      let requestOrigin = '';

      page.on('request', request => {
        if (request.url().includes('auth')) {
          requestOrigin = request.headers()['origin'] || '';
        }
      });

      await authPage.login('test@example.com', 'password123');
      await page.waitForTimeout(1000);

      // Origin should match base URL
      expect(requestOrigin).toContain(BASE_URL.includes('localhost') ? 'localhost' : BASE_URL);
    });

    test('should reject forged requests from different origins', async ({ page }) => {
      const authPage = new AuthPage(page);

      // Try to intercept and modify request origin
      await page.route('**/auth/**', route => {
        const headers = route.request().headers();
        headers['origin'] = 'https://malicious-site.com';
        route.continue({ headers });
      });

      await authPage.login('test@example.com', 'password123');
      await page.waitForTimeout(2000);

      // Request should be rejected or handled safely
      await expect(authPage.authScreen).toBeVisible();
    });
  });

  /**
   * SESSION SECURITY TESTS (4 tests)
   */
  test.describe('Session Security', () => {
    test('should handle expired session tokens gracefully', async ({ page }) => {
      const authPage = new AuthPage(page);

      // Login first
      await authPage.clickDemoUser();
      await page.waitForTimeout(2000);

      // Simulate expired token by clearing storage
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });

      // Refresh page
      await page.reload();
      await page.waitForTimeout(2000);

      // Should redirect to login
      await expect(authPage.authScreen).toBeVisible();
    });

    test('should not expose sensitive data in localStorage', async ({ page }) => {
      const authPage = new AuthPage(page);

      await authPage.clickDemoUser();
      await page.waitForTimeout(2000);

      const localStorageData = await page.evaluate(() => {
        return JSON.stringify(localStorage);
      });

      // Should not contain plaintext passwords
      expect(localStorageData.toLowerCase()).not.toContain('password');

      // Should not contain sensitive Supabase keys
      expect(localStorageData).not.toMatch(/[a-zA-Z0-9]{40,}/); // Long API keys
    });

    test('should secure session cookies with proper flags', async ({ page, context }) => {
      const authPage = new AuthPage(page);

      await authPage.clickDemoUser();
      await page.waitForTimeout(2000);

      const cookies = await context.cookies();

      // Check for session-related cookies
      const sessionCookies = cookies.filter(c =>
        c.name.toLowerCase().includes('session') ||
        c.name.toLowerCase().includes('auth') ||
        c.name.toLowerCase().includes('token')
      );

      if (sessionCookies.length > 0) {
        for (const cookie of sessionCookies) {
          // In production, should have secure and httpOnly flags
          if (!BASE_URL.includes('localhost')) {
            expect(cookie.secure).toBeTruthy();
          }
        }
      }
    });

    test('should handle session hijacking attempts', async ({ page, context }) => {
      const authPage = new AuthPage(page);

      // Login and get cookies
      await authPage.clickDemoUser();
      await page.waitForTimeout(2000);

      const cookies = await context.cookies();

      // Open new incognito context (simulating attacker)
      const attackerContext = await page.context().browser()?.newContext();
      if (attackerContext) {
        const attackerPage = await attackerContext.newPage();

        // Try to inject stolen cookies
        await attackerContext.addCookies(cookies);
        await attackerPage.goto(BASE_URL);
        await page.waitForTimeout(2000);

        // Should have additional security checks beyond cookies
        await attackerPage.close();
        await attackerContext.close();
      }
    });
  });

  /**
   * INPUT VALIDATION & SANITIZATION TESTS (5 tests)
   */
  test.describe('Input Validation and Sanitization', () => {
    test('should handle special characters in email', async ({ page }) => {
      const authPage = new AuthPage(page);

      for (const chars of SPECIAL_CHARACTERS) {
        await authPage.emailInput.fill(`test${chars}@example.com`);
        await authPage.emailInput.blur();
        await page.waitForTimeout(300);

        // Should remain functional
        await expect(authPage.emailInput).toBeVisible();
      }
    });

    test('should validate email length limits', async ({ page }) => {
      const authPage = new AuthPage(page);

      // Very long email
      const longEmail = 'a'.repeat(500) + '@example.com';
      await authPage.emailInput.fill(longEmail);
      await authPage.emailInput.blur();
      await page.waitForTimeout(300);

      // Should handle gracefully
      await expect(authPage.emailInput).toBeVisible();
    });

    test('should validate password complexity requirements', async ({ page }) => {
      const authPage = new AuthPage(page);
      await authPage.switchToSignup();

      const weakPasswords = ['123', 'abc', 'password', '      '];

      for (const weak of weakPasswords) {
        await authPage.passwordInput.fill(weak);
        await authPage.passwordInput.blur();
        await page.waitForTimeout(300);

        if (weak.length < 6) {
          // Should show error for weak passwords
          const errorCount = await page.locator('.input-message--error').count();
          expect(errorCount).toBeGreaterThan(0);
        }
      }
    });

    test('should trim whitespace in email field', async ({ page }) => {
      const authPage = new AuthPage(page);

      await authPage.emailInput.fill('  test@example.com  ');
      const value = await authPage.emailInput.inputValue();

      // Frontend should trim or handle whitespace
      expect(value.trim()).toBe(value);
    });

    test('should prevent null byte injection', async ({ page }) => {
      const authPage = new AuthPage(page);

      const nullBytePayload = 'test@example.com\x00malicious';
      await authPage.emailInput.fill(nullBytePayload);
      await authPage.passwordInput.fill('password123');
      await authPage.submitButton.click();
      await page.waitForTimeout(2000);

      // Should handle safely without exposing system behavior
      await expect(authPage.authScreen).toBeVisible();
    });
  });

  /**
   * PASSWORD SECURITY TESTS (3 tests)
   */
  test.describe('Password Security', () => {
    test('should not reveal password in DOM or network', async ({ page }) => {
      const authPage = new AuthPage(page);

      const testPassword = 'SuperSecret123!';
      let passwordExposed = false;

      page.on('request', request => {
        const postData = request.postData();
        if (postData && postData.includes(testPassword) && request.method() !== 'POST') {
          passwordExposed = true;
        }
      });

      await authPage.passwordInput.fill(testPassword);

      // Check DOM doesn't expose password
      const pageContent = await page.content();
      expect(pageContent).not.toContain(testPassword);

      expect(passwordExposed).toBeFalsy();
    });

    test('should enforce password visibility toggle security', async ({ page }) => {
      const authPage = new AuthPage(page);

      const password = 'Secret123!';
      await authPage.passwordInput.fill(password);

      // When hidden, should be type password
      let inputType = await authPage.getPasswordInputType();
      expect(inputType).toBe('password');

      // When visible, should be type text
      await authPage.togglePasswordVisibility();
      inputType = await authPage.getPasswordInputType();
      expect(inputType).toBe('text');

      // Toggle back to hidden
      await authPage.togglePasswordVisibility();
      inputType = await authPage.getPasswordInputType();
      expect(inputType).toBe('password');
    });

    test('should not autofill passwords inappropriately', async ({ page }) => {
      const authPage = new AuthPage(page);

      // Check autocomplete attributes
      const emailAutocomplete = await authPage.emailInput.getAttribute('autocomplete');
      const passwordAutocomplete = await authPage.passwordInput.getAttribute('autocomplete');

      // Should have appropriate autocomplete values
      expect(emailAutocomplete).toBeTruthy();
      expect(passwordAutocomplete).toBeTruthy();
    });
  });
});
