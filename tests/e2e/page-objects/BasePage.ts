import { Page, Locator } from '@playwright/test';

/**
 * BasePage - Common page object functionality for all pages
 */
export class BasePage {
  constructor(protected page: Page) {}

  /**
   * Wait for page to be fully loaded
   */
  async waitForPageLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Take a screenshot with timestamp
   */
  async takeScreenshot(name: string): Promise<void> {
    const timestamp = Date.now();
    await this.page.screenshot({
      path: `test-results/screenshots/${name}-${timestamp}.png`,
      fullPage: true
    });
  }

  /**
   * Wait for element to be visible
   */
  async waitForVisible(locator: Locator, timeout = 10000): Promise<void> {
    await locator.waitFor({ state: 'visible', timeout });
  }

  /**
   * Wait for element to be hidden
   */
  async waitForHidden(locator: Locator, timeout = 10000): Promise<void> {
    await locator.waitFor({ state: 'hidden', timeout });
  }

  /**
   * Bypass authentication for testing - uses demo mode
   */
  async bypassAuth(userId: string, userEmail: string): Promise<void> {
    // Navigate to app first if not already there
    if (this.page.url() === 'about:blank' || this.page.url().includes('localhost') === false) {
      await this.page.goto('/');
      await this.page.waitForLoadState('networkidle');
    }

    // Check if already logged in
    const isLoggedIn = await this.page.locator('[data-testid="design-matrix"], .matrix-container, text=Create Project').isVisible({ timeout: 2000 }).catch(() => false);
    if (isLoggedIn) return;

    // Check for demo user button
    const demoButton = this.page.locator('button:has-text("Demo User"), button:has-text("Continue as Demo")');

    if (await demoButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Click demo button to authenticate
      await demoButton.click();
      await this.page.waitForURL('**/matrix', { timeout: 5000 }).catch(() => {});
      await this.page.waitForLoadState('networkidle');
    } else {
      // Fallback: Set localStorage after navigation
      await this.page.evaluate(
        ({ userId: uid, userEmail: email }) => {
          localStorage.setItem('demo-mode', 'true');
          localStorage.setItem('user', JSON.stringify({ id: uid, email }));
        },
        { userId, userEmail }
      );
      await this.page.reload();
      await this.page.waitForLoadState('networkidle');
    }

    // Verify authentication worked
    const isAuthenticated = await this.page.locator('[data-testid="design-matrix"], .matrix-container, text=Create Project').isVisible({ timeout: 3000 }).catch(() => false);

    if (!isAuthenticated) {
      throw new Error('Authentication failed - still on login screen');
    }
  }

  /**
   * Clear authentication
   */
  async clearAuth(): Promise<void> {
    await this.page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  }

  /**
   * Get console errors
   */
  async getConsoleErrors(): Promise<string[]> {
    const errors: string[] = [];
    this.page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    return errors;
  }

  /**
   * Mock database operation
   */
  async mockDatabaseOperation(
    operation: string,
    data: Record<string, unknown>
  ): Promise<void> {
    await this.page.evaluate(
      ({ operation, data }) => {
        window.localStorage.setItem(`mock_${operation}`, JSON.stringify(data));
      },
      { operation, data }
    );
  }
}
