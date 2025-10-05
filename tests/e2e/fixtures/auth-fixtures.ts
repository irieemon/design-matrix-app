/**
 * Authentication Test Fixtures
 * Provides reusable test data and helpers for authentication testing
 */

import { test as base, expect } from '@playwright/test';
import { AuthPage } from '../page-objects/AuthPage';

// Test user types
export interface TestUser {
  fullName: string;
  email: string;
  password: string;
  role?: 'user' | 'admin' | 'super_admin';
}

// Test credentials factory
export class TestCredentials {
  static generateUniqueUser(prefix = 'test'): TestUser {
    return {
      fullName: `${prefix} User ${Date.now()}`,
      email: `${prefix}-${Date.now()}@example.com`,
      password: 'SecurePass123!',
      role: 'user'
    };
  }

  static getValidUser(): TestUser {
    return {
      fullName: 'Valid Test User',
      email: 'valid@example.com',
      password: 'ValidPass123!',
      role: 'user'
    };
  }

  static getInvalidUser(): TestUser {
    return {
      fullName: 'Invalid User',
      email: 'invalid@example.com',
      password: 'WrongPassword123!',
      role: 'user'
    };
  }

  static getAdminUser(): TestUser {
    return {
      fullName: 'Admin User',
      email: 'admin@prioritas.com',
      password: 'AdminPass123!',
      role: 'admin'
    };
  }

  static getDemoUser(): TestUser {
    return {
      fullName: 'Demo User',
      email: 'demo@example.com',
      password: '', // Demo user doesn't need password
      role: 'user'
    };
  }
}

// Invalid email test cases
export const INVALID_EMAILS = [
  'not-an-email',
  '@example.com',
  'user@',
  'user name@example.com',
  'user@example',
  '',
  ' ',
  'user@@example.com',
  'user@.com',
  'user@example..com'
];

// Invalid password test cases
export const INVALID_PASSWORDS = [
  '', // Empty
  '12345', // Too short (< 6 chars)
  '     ', // Only spaces
  'abc' // Too short
];

// Valid password variations
export const VALID_PASSWORDS = [
  'Simple123',
  'Complex!@#$123',
  'VeryLongPasswordWithManyCharacters123!',
  'P@ssw0rd',
  'Test123!'
];

// Extended test fixture with authentication helpers
export const test = base.extend<{
  authPage: AuthPage;
  authenticatedPage: AuthPage;
  testUser: TestUser;
}>({
  // AuthPage fixture - automatically creates AuthPage for each test
  authPage: async ({ page }, use) => {
    const authPage = new AuthPage(page);
    await authPage.goto();
    await use(authPage);
  },

  // Authenticated page fixture - logs in demo user before test
  authenticatedPage: async ({ page }, use) => {
    const authPage = new AuthPage(page);
    await authPage.goto();
    await authPage.clickDemoUser();
    await page.waitForTimeout(2000);
    await use(authPage);
  },

  // Test user fixture - generates unique user for each test
  testUser: async ({}, use) => {
    const user = TestCredentials.generateUniqueUser();
    await use(user);
  }
});

// Custom assertions for authentication
export const authExpect = {
  toBeAuthenticated: async (page) => {
    const url = page.url();
    expect(url).not.toContain('/auth');
    expect(url).not.toBe('/');
  },

  toBeUnauthenticated: async (page) => {
    const authScreen = page.locator('.auth-screen');
    await expect(authScreen).toBeVisible({ timeout: 5000 });
  },

  toHaveValidEmail: async (emailInput) => {
    const value = await emailInput.inputValue();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    expect(emailRegex.test(value)).toBeTruthy();
  },

  toShowLoadingState: async (button) => {
    await expect(button).toHaveAttribute('data-state', 'loading');
  },

  toShowErrorState: async (button) => {
    await expect(button).toHaveAttribute('data-state', 'error');
  },

  toShowIdleState: async (button) => {
    await expect(button).toHaveAttribute('data-state', 'idle');
  }
};

// Viewport presets for responsive testing
export const VIEWPORTS = {
  mobile: { width: 375, height: 667 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1440, height: 900 },
  wide: { width: 1920, height: 1080 }
};

// Browser configurations for cross-browser testing
export const BROWSERS = ['chromium', 'firefox', 'webkit'];

// Test timeouts
export const TIMEOUTS = {
  short: 1000,
  medium: 3000,
  long: 5000,
  veryLong: 10000
};

// Error message expectations
export const ERROR_MESSAGES = {
  invalidCredentials: /invalid.*credentials|incorrect.*password/i,
  emailRequired: /email.*required/i,
  passwordRequired: /password.*required/i,
  emailInvalid: /valid.*email|invalid.*email/i,
  passwordTooShort: /at least.*\d+.*character/i,
  passwordMismatch: /password.*not.*match|password.*different/i,
  fullNameRequired: /name.*required/i,
  fullNameTooShort: /name.*at least.*\d+/i
};

// Success message expectations
export const SUCCESS_MESSAGES = {
  signupSuccess: /check.*email|confirmation.*sent/i,
  passwordResetSent: /reset.*email|password.*reset.*sent/i,
  loginSuccess: /welcome|success/i
};

// Network request helpers
export class NetworkHelpers {
  static async interceptAuthRequests(page, handler: (request: any) => void) {
    page.on('request', request => {
      if (request.url().includes('auth') || request.url().includes('supabase')) {
        handler(request);
      }
    });
  }

  static async interceptAuthResponses(page, handler: (response: any) => void) {
    page.on('response', response => {
      if (response.url().includes('auth') || response.url().includes('supabase')) {
        handler(response);
      }
    });
  }

  static async mockAuthSuccess(page) {
    await page.route('**/auth/**', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'mock-user-id',
            email: 'mock@example.com',
            full_name: 'Mock User'
          }
        })
      });
    });
  }

  static async mockAuthFailure(page, status = 401) {
    await page.route('**/auth/**', route => {
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Invalid credentials'
        })
      });
    });
  }

  static async simulateSlowNetwork(page, delayMs = 3000) {
    await page.route('**/*', route => {
      setTimeout(() => route.continue(), delayMs);
    });
  }
}

// Screenshot helpers
export class ScreenshotHelpers {
  static async captureAuthFlow(page, testName: string) {
    const screenshots = [];

    screenshots.push({
      name: `${testName}-1-initial`,
      path: `test-results/screenshots/${testName}-1-initial.png`
    });
    await page.screenshot({ path: screenshots[0].path, fullPage: true });

    return screenshots;
  }

  static async captureBeforeAfter(page, testName: string, action: () => Promise<void>) {
    await page.screenshot({
      path: `test-results/screenshots/${testName}-before.png`,
      fullPage: true
    });

    await action();

    await page.screenshot({
      path: `test-results/screenshots/${testName}-after.png`,
      fullPage: true
    });
  }

  static async captureOnFailure(page, testInfo) {
    if (testInfo.status !== 'passed') {
      await page.screenshot({
        path: `test-results/screenshots/${testInfo.title}-failure.png`,
        fullPage: true
      });
    }
  }
}

// Console monitoring helpers
export class ConsoleHelpers {
  static captureErrors(page): string[] {
    const errors: string[] = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    return errors;
  }

  static captureWarnings(page): string[] {
    const warnings: string[] = [];

    page.on('console', msg => {
      if (msg.type() === 'warning') {
        warnings.push(msg.text());
      }
    });

    return warnings;
  }

  static async expectNoErrors(page) {
    const errors = this.captureErrors(page);

    // Wait a bit to collect any errors
    await page.waitForTimeout(1000);

    expect(errors.length).toBe(0);
  }
}

// Storage helpers
export class StorageHelpers {
  static async clearAllStorage(page) {
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  }

  static async getLocalStorage(page): Promise<Record<string, string>> {
    return await page.evaluate(() => {
      const items: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          items[key] = localStorage.getItem(key) || '';
        }
      }
      return items;
    });
  }

  static async getSessionStorage(page): Promise<Record<string, string>> {
    return await page.evaluate(() => {
      const items: Record<string, string> = {};
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key) {
          items[key] = sessionStorage.getItem(key) || '';
        }
      }
      return items;
    });
  }

  static async expectNoSensitiveDataInStorage(page) {
    const localStorage = await this.getLocalStorage(page);
    const sessionStorage = await this.getSessionStorage(page);

    const allStorage = JSON.stringify({ localStorage, sessionStorage });

    // Check for plaintext passwords
    expect(allStorage.toLowerCase()).not.toContain('password:');

    // Check for long API keys (potential security issue)
    const apiKeyPattern = /[a-zA-Z0-9]{40,}/;
    expect(apiKeyPattern.test(allStorage)).toBeFalsy();
  }
}

// Performance helpers
export class PerformanceHelpers {
  static async measurePageLoad(page): Promise<number> {
    const timing = await page.evaluate(() => {
      const perf = performance.timing;
      return perf.loadEventEnd - perf.navigationStart;
    });
    return timing;
  }

  static async measureAuthSubmission(authPage): Promise<number> {
    const start = Date.now();
    await authPage.submitButton.click();
    await authPage.page.waitForTimeout(1000);
    return Date.now() - start;
  }

  static async expectFastLoad(page, maxMs = 3000) {
    const loadTime = await this.measurePageLoad(page);
    expect(loadTime).toBeLessThan(maxMs);
  }
}

// Accessibility helpers
export class AccessibilityHelpers {
  static async expectProperLabels(page) {
    const inputs = page.locator('input');
    const count = await inputs.count();

    for (let i = 0; i < count; i++) {
      const input = inputs.nth(i);
      const hasLabel = await input.getAttribute('aria-label') ||
                      await input.getAttribute('aria-labelledby') ||
                      await page.locator(`label[for="${await input.getAttribute('id')}"]`).count() > 0;

      expect(hasLabel).toBeTruthy();
    }
  }

  static async expectKeyboardNavigable(authPage) {
    await authPage.emailInput.focus();
    await expect(authPage.emailInput).toBeFocused();

    await authPage.emailInput.press('Tab');
    await authPage.page.waitForTimeout(100);

    const focusedElement = await authPage.page.evaluate(() => document.activeElement?.tagName);
    expect(['INPUT', 'BUTTON'].includes(focusedElement || '')).toBeTruthy();
  }

  static async expectProperAriaRoles(page) {
    const main = page.locator('main');
    await expect(main).toHaveAttribute('role', 'main');
  }
}

export { expect };
