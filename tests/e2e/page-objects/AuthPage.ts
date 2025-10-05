/**
 * Page Object Model for Authentication Pages
 * Provides reusable methods for interacting with auth UI components
 */

import { Page, Locator, expect } from '@playwright/test';

export class AuthPage {
  readonly page: Page;

  // Main containers
  readonly authScreen: Locator;
  readonly authCard: Locator;

  // Header elements
  readonly logo: Locator;
  readonly title: Locator;
  readonly subtitle: Locator;

  // Form elements
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly fullNameInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly submitButton: Locator;

  // Toggle buttons
  readonly passwordToggle: Locator;
  readonly confirmPasswordToggle: Locator;

  // Mode switching links
  readonly signupLink: Locator;
  readonly loginLink: Locator;
  readonly forgotPasswordLink: Locator;
  readonly backToLoginLink: Locator;

  // Demo user button
  readonly demoUserButton: Locator;

  // Message containers
  readonly errorMessage: Locator;
  readonly successMessage: Locator;

  // Feature cards
  readonly featureCards: Locator;

  constructor(page: Page) {
    this.page = page;

    // Main containers
    this.authScreen = page.locator('.auth-screen');
    this.authCard = page.locator('.card-clean').first();

    // Header elements
    this.logo = page.locator('h1:has-text("Prioritas")');
    this.title = page.locator('h2').first();
    this.subtitle = page.locator('.text-secondary').first();

    // Form elements - Use data-testid with fallback
    this.emailInput = page.getByTestId('auth-email-input');
    this.passwordInput = page.getByTestId('auth-password-input');
    this.fullNameInput = page.getByTestId('auth-fullname-input');
    this.confirmPasswordInput = page.getByTestId('auth-confirm-password-input');
    this.submitButton = page.getByTestId('auth-submit-button');

    // Toggle buttons
    this.passwordToggle = page.locator('button[aria-label*="password"]').first();
    this.confirmPasswordToggle = page.locator('button[aria-label*="password"]').nth(1);

    // Mode switching links - Use text-based selectors for mode switcher
    this.signupLink = page.locator('button:has-text("Sign up")');
    this.loginLink = page.locator('button:has-text("Sign in")');
    this.forgotPasswordLink = page.locator('button:has-text("Forgot your password?")');
    this.backToLoginLink = page.locator('button:has-text("Back to sign in")');

    // Demo user button
    this.demoUserButton = page.getByTestId('auth-demo-button');

    // Message containers
    this.errorMessage = page.getByTestId('auth-error-message');
    this.successMessage = page.getByTestId('auth-success-message');

    // Feature cards
    this.featureCards = page.locator('.card-clean-hover');
  }

  /**
   * Navigation Methods
   */
  async goto() {
    await this.page.goto('/');
    await this.waitForLoad();
  }

  async waitForLoad() {
    await this.authScreen.waitFor({ state: 'visible', timeout: 10000 });
  }

  /**
   * Login Methods
   */
  async switchToLogin() {
    await this.loginLink.click();
    await this.page.waitForTimeout(300);
    await expect(this.title).toContainText('Welcome Back');
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async loginWithValidation(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.emailInput.blur();
    await this.page.waitForTimeout(300);

    await this.passwordInput.fill(password);
    await this.passwordInput.blur();
    await this.page.waitForTimeout(300);

    await this.submitButton.click();
  }

  /**
   * Signup Methods
   */
  async switchToSignup() {
    await this.signupLink.click();
    await this.page.waitForTimeout(300);
    await expect(this.title).toContainText('Create Your Account');
  }

  async signup(fullName: string, email: string, password: string, confirmPassword?: string) {
    await this.fullNameInput.fill(fullName);
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.confirmPasswordInput.fill(confirmPassword || password);
    await this.submitButton.click();
  }

  async signupWithValidation(fullName: string, email: string, password: string, confirmPassword?: string) {
    await this.fullNameInput.fill(fullName);
    await this.fullNameInput.blur();
    await this.page.waitForTimeout(300);

    await this.emailInput.fill(email);
    await this.emailInput.blur();
    await this.page.waitForTimeout(300);

    await this.passwordInput.fill(password);
    await this.passwordInput.blur();
    await this.page.waitForTimeout(300);

    await this.confirmPasswordInput.fill(confirmPassword || password);
    await this.confirmPasswordInput.blur();
    await this.page.waitForTimeout(300);

    await this.submitButton.click();
  }

  /**
   * Password Reset Methods
   */
  async switchToForgotPassword() {
    await this.forgotPasswordLink.click();
    await this.page.waitForTimeout(300);
    await expect(this.title).toContainText('Reset Password');
  }

  async requestPasswordReset(email: string) {
    await this.emailInput.fill(email);
    await this.submitButton.click();
  }

  async backToLogin() {
    await this.backToLoginLink.click();
    await this.page.waitForTimeout(300);
  }

  /**
   * Demo User Methods
   */
  async clickDemoUser() {
    await this.demoUserButton.click();
  }

  /**
   * Password Visibility Methods
   */
  async togglePasswordVisibility() {
    await this.passwordToggle.click();
    await this.page.waitForTimeout(200);
  }

  async toggleConfirmPasswordVisibility() {
    await this.confirmPasswordToggle.click();
    await this.page.waitForTimeout(200);
  }

  async getPasswordInputType(): Promise<string> {
    return await this.passwordInput.getAttribute('type') || 'password';
  }

  /**
   * Validation Methods
   */
  async expectLoginMode() {
    await expect(this.title).toContainText('Welcome Back');
    await expect(this.emailInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
    await expect(this.submitButton).toBeVisible();
    await expect(this.fullNameInput).not.toBeVisible();
  }

  async expectSignupMode() {
    await expect(this.title).toContainText('Create Your Account');
    await expect(this.fullNameInput).toBeVisible();
    await expect(this.emailInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
    await expect(this.confirmPasswordInput).toBeVisible();
    await expect(this.submitButton).toBeVisible();
  }

  async expectForgotPasswordMode() {
    await expect(this.title).toContainText('Reset Password');
    await expect(this.emailInput).toBeVisible();
    await expect(this.submitButton).toBeVisible();
    await expect(this.passwordInput).not.toBeVisible();
  }

  async expectErrorMessage(message?: string) {
    await expect(this.errorMessage).toBeVisible();
    if (message) {
      await expect(this.errorMessage).toContainText(message);
    }
  }

  async expectSuccessMessage(message?: string) {
    await expect(this.successMessage).toBeVisible();
    if (message) {
      await expect(this.successMessage).toContainText(message);
    }
  }

  async expectLoadingState() {
    await expect(this.submitButton).toHaveAttribute('data-state', 'loading');
  }

  async expectIdleState() {
    await expect(this.submitButton).toHaveAttribute('data-state', 'idle');
  }

  async expectErrorState() {
    await expect(this.submitButton).toHaveAttribute('data-state', 'error');
  }

  /**
   * Utility Methods
   */
  async takeScreenshot(name: string) {
    await this.page.screenshot({
      path: `test-results/screenshots/${name}.png`,
      fullPage: true
    });
  }

  async waitForNavigation() {
    await this.page.waitForURL(url => !url.pathname.includes('/auth') && url.pathname !== '/');
  }

  async getButtonState(): Promise<string> {
    return await this.submitButton.getAttribute('data-state') || 'unknown';
  }

  async isEmailValid(): Promise<boolean> {
    const value = await this.emailInput.inputValue();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  }

  async getErrorText(): Promise<string> {
    if (await this.errorMessage.isVisible()) {
      return await this.errorMessage.textContent() || '';
    }
    return '';
  }

  async getSuccessText(): Promise<string> {
    if (await this.successMessage.isVisible()) {
      return await this.successMessage.textContent() || '';
    }
    return '';
  }

  /**
   * Keyboard Navigation Methods
   */
  async navigateWithTab() {
    await this.emailInput.press('Tab');
    await this.page.waitForTimeout(100);
  }

  async submitWithEnter() {
    await this.passwordInput.press('Enter');
  }

  /**
   * Accessibility Methods
   */
  async expectAccessibleForm() {
    // Check for proper labels
    await expect(this.emailInput).toHaveAttribute('type', 'email');
    await expect(this.passwordInput).toHaveAttribute('type', /password|text/);

    // Check for aria-labels on toggle buttons
    await expect(this.passwordToggle).toHaveAttribute('aria-label', /.+password/i);
  }

  async expectProperFocus() {
    // Email should be focusable
    await this.emailInput.focus();
    await expect(this.emailInput).toBeFocused();

    // Tab to password
    await this.emailInput.press('Tab');
    await this.page.waitForTimeout(100);
  }

  /**
   * Performance Methods
   */
  async measureRenderTime(): Promise<number> {
    const startTime = Date.now();
    await this.waitForLoad();
    return Date.now() - startTime;
  }

  async measureSubmissionTime(): Promise<number> {
    const startTime = Date.now();
    await this.submitButton.click();
    await this.page.waitForTimeout(1000);
    return Date.now() - startTime;
  }
}
