/**
 * VISUAL REGRESSION BASELINE CAPTURE
 * Pre-Lux CSS Conversion Screenshot Baselines
 *
 * PURPOSE: Capture screenshots BEFORE converting 81 components from Tailwind to Lux CSS
 * USAGE: Run this test to create baseline screenshots for visual regression testing
 *
 * Coverage:
 * - Login page (AuthScreen) - all button states
 * - Main app after login - Sidebar buttons, matrix buttons
 * - ProjectManagement page - all action buttons
 * - Modal components - button interactions
 *
 * Output: screenshots/baseline-before-lux-conversion/
 */

import { test, expect } from '@playwright/test';
import { AuthPage } from './e2e/page-objects/AuthPage';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3007';
const SCREENSHOT_DIR = 'screenshots/baseline-before-lux-conversion';

/**
 * Helper function to take a screenshot with consistent settings
 */
async function takeBaselineScreenshot(page: any, name: string) {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000); // Allow animations to settle

  await page.screenshot({
    path: `${SCREENSHOT_DIR}/${name}.png`,
    fullPage: true,
    animations: 'disabled',
  });

  console.log(`✓ Captured: ${name}.png`);
}

test.describe('Visual Regression Baseline - Pre-Lux Conversion', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
  });

  /**
   * TEST 1: AUTH SCREEN - LOGIN MODE
   * Captures: Sign In button, Demo User button, mode switcher buttons
   */
  test('01-auth-login-page', async ({ page }) => {
    const authPage = new AuthPage(page);

    // Wait for auth screen to be visible
    await authPage.waitForLoad();
    await authPage.expectLoginMode();

    // Ensure all buttons are visible
    await expect(authPage.submitButton).toBeVisible();
    await expect(authPage.demoUserButton).toBeVisible();
    await expect(authPage.signupLink).toBeVisible();

    // Take screenshot
    await takeBaselineScreenshot(page, '01-auth-login-page');
  });

  /**
   * TEST 2: AUTH SCREEN - SIGNUP MODE
   * Captures: Create Account button, Sign in link, form state
   */
  test('02-auth-signup-page', async ({ page }) => {
    const authPage = new AuthPage(page);

    await authPage.waitForLoad();
    await authPage.switchToSignup();
    await authPage.expectSignupMode();

    // Ensure all buttons are visible
    await expect(authPage.submitButton).toBeVisible();
    await expect(authPage.loginLink).toBeVisible();

    // Take screenshot
    await takeBaselineScreenshot(page, '02-auth-signup-page');
  });

  /**
   * TEST 3: AUTH SCREEN - FORGOT PASSWORD MODE
   * Captures: Send Reset Link button, Back to sign in link
   */
  test('03-auth-forgot-password-page', async ({ page }) => {
    const authPage = new AuthPage(page);

    await authPage.waitForLoad();
    await authPage.switchToForgotPassword();
    await authPage.expectForgotPasswordMode();

    // Ensure all buttons are visible
    await expect(authPage.submitButton).toBeVisible();
    await expect(authPage.backToLoginLink).toBeVisible();

    // Take screenshot
    await takeBaselineScreenshot(page, '03-auth-forgot-password-page');
  });

  /**
   * TEST 4: MAIN APP - AFTER LOGIN
   * Captures: Sidebar buttons, matrix interface, navigation buttons
   */
  test('04-main-app-after-login', async ({ page }) => {
    const authPage = new AuthPage(page);

    // Login as demo user
    await authPage.waitForLoad();
    await authPage.clickDemoUser();

    // Wait for navigation to complete
    await page.waitForURL(url => !url.pathname.includes('/auth'));
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Allow app to fully render

    // Take screenshot of main app
    await takeBaselineScreenshot(page, '04-main-app-after-login');
  });

  /**
   * TEST 5: SIDEBAR - COLLAPSED STATE
   * Captures: Collapsed sidebar with icon buttons
   */
  test('05-sidebar-collapsed', async ({ page }) => {
    const authPage = new AuthPage(page);

    // Login and wait for app
    await authPage.waitForLoad();
    await authPage.clickDemoUser();
    await page.waitForURL(url => !url.pathname.includes('/auth'));
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Find and click collapse button
    const collapseButton = page.locator('[data-testid="sidebar-toggle-button"]');
    if (await collapseButton.isVisible()) {
      await collapseButton.click();
      await page.waitForTimeout(500); // Animation time

      await takeBaselineScreenshot(page, '05-sidebar-collapsed');
    }
  });

  /**
   * TEST 6: PROJECT MANAGEMENT PAGE
   * Captures: Create Project button, project cards, action buttons
   */
  test('06-project-management-page', async ({ page }) => {
    const authPage = new AuthPage(page);

    // Login and navigate to projects
    await authPage.waitForLoad();
    await authPage.clickDemoUser();
    await page.waitForURL(url => !url.pathname.includes('/auth'));
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Navigate to projects page
    const projectsLink = page.locator('[data-testid="nav-projects"], a:has-text("Projects"), button:has-text("Projects")').first();
    if (await projectsLink.isVisible()) {
      await projectsLink.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      await takeBaselineScreenshot(page, '06-project-management-page');
    }
  });

  /**
   * TEST 7: DESIGN MATRIX PAGE
   * Captures: Matrix grid, quadrant buttons, idea cards
   */
  test('07-design-matrix-page', async ({ page }) => {
    const authPage = new AuthPage(page);

    // Login
    await authPage.waitForLoad();
    await authPage.clickDemoUser();
    await page.waitForURL(url => !url.pathname.includes('/auth'));
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Navigate to matrix if not already there
    const matrixLink = page.locator('[data-testid="nav-matrix"], a:has-text("Matrix"), button:has-text("Matrix")').first();
    if (await matrixLink.isVisible()) {
      await matrixLink.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
    }

    // Wait for matrix to be visible
    const matrix = page.locator('.design-matrix, [data-testid="design-matrix"]').first();
    await matrix.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});

    await takeBaselineScreenshot(page, '07-design-matrix-page');
  });

  /**
   * TEST 8: ADD IDEA MODAL
   * Captures: Modal buttons (Add Idea, Cancel)
   */
  test('08-add-idea-modal', async ({ page }) => {
    const authPage = new AuthPage(page);

    // Login and get to matrix
    await authPage.waitForLoad();
    await authPage.clickDemoUser();
    await page.waitForURL(url => !url.pathname.includes('/auth'));
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Try to open Add Idea modal
    const addIdeaButton = page.locator('[data-testid="add-idea-button"], button:has-text("Add Idea"), button:has-text("New Idea")').first();
    if (await addIdeaButton.isVisible()) {
      await addIdeaButton.click();
      await page.waitForTimeout(500);

      // Wait for modal to be visible
      const modal = page.locator('[role="dialog"], .modal, [data-testid*="modal"]').first();
      await modal.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});

      await takeBaselineScreenshot(page, '08-add-idea-modal');
    }
  });

  /**
   * TEST 9: USER SETTINGS PAGE
   * Captures: Settings page with various buttons and controls
   */
  test('09-user-settings-page', async ({ page }) => {
    const authPage = new AuthPage(page);

    // Login
    await authPage.waitForLoad();
    await authPage.clickDemoUser();
    await page.waitForURL(url => !url.pathname.includes('/auth'));
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Navigate to settings
    const settingsLink = page.locator('[data-testid="nav-settings"], a:has-text("Settings"), button:has-text("Settings")').first();
    if (await settingsLink.isVisible()) {
      await settingsLink.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      await takeBaselineScreenshot(page, '09-user-settings-page');
    }
  });

  /**
   * TEST 10: PROJECT ROADMAP PAGE
   * Captures: Roadmap interface with timeline buttons
   */
  test('10-project-roadmap-page', async ({ page }) => {
    const authPage = new AuthPage(page);

    // Login
    await authPage.waitForLoad();
    await authPage.clickDemoUser();
    await page.waitForURL(url => !url.pathname.includes('/auth'));
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Navigate to roadmap
    const roadmapLink = page.locator('[data-testid="nav-roadmap"], a:has-text("Roadmap"), button:has-text("Roadmap")').first();
    if (await roadmapLink.isVisible()) {
      await roadmapLink.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      await takeBaselineScreenshot(page, '10-project-roadmap-page');
    }
  });

  /**
   * TEST 11: BUTTON HOVER STATES (if possible)
   * Captures: Button hover states for primary buttons
   */
  test('11-button-hover-states', async ({ page }) => {
    const authPage = new AuthPage(page);

    await authPage.waitForLoad();
    await authPage.expectLoginMode();

    // Hover over sign in button
    await authPage.submitButton.hover();
    await page.waitForTimeout(300);

    await takeBaselineScreenshot(page, '11-button-hover-states');
  });

  /**
   * TEST 12: BUTTON FOCUS STATES
   * Captures: Button focus states for accessibility
   */
  test('12-button-focus-states', async ({ page }) => {
    const authPage = new AuthPage(page);

    await authPage.waitForLoad();
    await authPage.expectLoginMode();

    // Focus on sign in button
    await authPage.submitButton.focus();
    await page.waitForTimeout(300);

    await takeBaselineScreenshot(page, '12-button-focus-states');
  });
});
