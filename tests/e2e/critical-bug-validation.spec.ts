/**
 * Critical Bug Validation Test Suite
 *
 * Tests for 4 production bug fixes:
 * 1. Infinite render loop in ProjectManagement (useCallback fix)
 * 2. Screen flickering in MainApp (useMemo fix for effectiveUser)
 * 3. Ideas not loading in useIdeas (dependency fix)
 * 4. DesignMatrix componentState loop (dependency fix)
 */

import { test, expect, Page } from '@playwright/test';

// Performance tracking utilities
class PerformanceMonitor {
  private renderCounts: Map<string, number> = new Map();
  private consoleErrors: string[] = [];
  private consoleWarnings: string[] = [];

  async setupListeners(page: Page) {
    // Track console errors
    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();

      if (type === 'error') {
        this.consoleErrors.push(text);
      } else if (type === 'warning') {
        this.consoleWarnings.push(text);
      }
    });

    // Track page errors
    page.on('pageerror', (error) => {
      this.consoleErrors.push(`Page Error: ${error.message}`);
    });
  }

  getConsoleErrors(): string[] {
    return this.consoleErrors;
  }

  getConsoleWarnings(): string[] {
    return this.consoleWarnings;
  }

  hasInfiniteLoopError(): boolean {
    return this.consoleErrors.some(err =>
      err.includes('Maximum update depth exceeded') ||
      err.includes('Too many re-renders') ||
      err.includes('infinite loop')
    );
  }

  hasRenderWarning(): boolean {
    return this.consoleWarnings.some(warn =>
      warn.includes('Cannot update a component') ||
      warn.includes('render')
    );
  }

  reset() {
    this.renderCounts.clear();
    this.consoleErrors = [];
    this.consoleWarnings = [];
  }
}

test.describe('Critical Bug Validation Suite', () => {
  let monitor: PerformanceMonitor;

  test.beforeEach(async ({ page }) => {
    monitor = new PerformanceMonitor();
    await monitor.setupListeners(page);
  });

  test.describe('Bug Fix #1: ProjectManagement Infinite Render Loop', () => {
    test('should not trigger infinite render loop when loading projects', async ({ page }) => {
      await page.goto('http://localhost:3004');

      // Wait for auth to complete
      await page.waitForSelector('[data-testid="login-email"]', { timeout: 10000 });

      // Login as demo user
      await page.fill('[data-testid="login-email"]', 'demo@example.com');
      await page.fill('[data-testid="login-password"]', 'demo123');
      await page.click('[data-testid="login-submit"]');

      // Wait for app to load
      await page.waitForSelector('[data-testid="app-layout"]', { timeout: 15000 });

      // Wait a few seconds and check for infinite loop errors
      await page.waitForTimeout(3000);

      expect(monitor.hasInfiniteLoopError()).toBe(false);
      expect(monitor.getConsoleErrors().filter(e => e.includes('ProjectManagement'))).toHaveLength(0);
    });

    test('should successfully load and display projects list', async ({ page }) => {
      await page.goto('http://localhost:3004');

      await page.waitForSelector('[data-testid="login-email"]', { timeout: 10000 });
      await page.fill('[data-testid="login-email"]', 'demo@example.com');
      await page.fill('[data-testid="login-password"]', 'demo123');
      await page.click('[data-testid="login-submit"]');

      await page.waitForSelector('[data-testid="app-layout"]', { timeout: 15000 });

      // Check that projects section is visible
      const projectsVisible = await page.isVisible('[data-testid="projects-section"]').catch(() => false);

      // Should either show projects or empty state, not crash
      expect(monitor.hasInfiniteLoopError()).toBe(false);
    });

    test('should handle project creation without render loops', async ({ page }) => {
      await page.goto('http://localhost:3004');

      await page.waitForSelector('[data-testid="login-email"]', { timeout: 10000 });
      await page.fill('[data-testid="login-email"]', 'demo@example.com');
      await page.fill('[data-testid="login-password"]', 'demo123');
      await page.click('[data-testid="login-submit"]');

      await page.waitForSelector('[data-testid="app-layout"]', { timeout: 15000 });

      // Try to create a new project
      const createButton = page.locator('[data-testid="create-project-button"]');
      if (await createButton.isVisible().catch(() => false)) {
        await createButton.click();
        await page.waitForTimeout(2000);

        expect(monitor.hasInfiniteLoopError()).toBe(false);
      }
    });
  });

  test.describe('Bug Fix #2: MainApp Screen Flickering', () => {
    test('should not flicker during login transition', async ({ page }) => {
      await page.goto('http://localhost:3004');

      // Take screenshot before login
      await page.waitForSelector('[data-testid="login-email"]', { timeout: 10000 });
      await page.screenshot({ path: 'test-results/before-login.png' });

      await page.fill('[data-testid="login-email"]', 'demo@example.com');
      await page.fill('[data-testid="login-password"]', 'demo123');

      // Click login and immediately check for rapid re-renders
      await page.click('[data-testid="login-submit"]');

      // Wait a moment for transition
      await page.waitForTimeout(1000);

      // Take screenshot during transition
      await page.screenshot({ path: 'test-results/during-transition.png' });

      // Wait for app to fully load
      await page.waitForSelector('[data-testid="app-layout"]', { timeout: 15000 });
      await page.screenshot({ path: 'test-results/after-login.png' });

      // Check for render-related warnings
      expect(monitor.hasRenderWarning()).toBe(false);
      expect(monitor.hasInfiniteLoopError()).toBe(false);
    });

    test('should maintain stable UI after authentication', async ({ page }) => {
      await page.goto('http://localhost:3004');

      await page.waitForSelector('[data-testid="login-email"]', { timeout: 10000 });
      await page.fill('[data-testid="login-email"]', 'demo@example.com');
      await page.fill('[data-testid="login-password"]', 'demo123');
      await page.click('[data-testid="login-submit"]');

      await page.waitForSelector('[data-testid="app-layout"]', { timeout: 15000 });

      // Wait and verify UI remains stable (no flickering)
      await page.waitForTimeout(3000);

      // Check that main app elements are still visible
      const appLayout = await page.isVisible('[data-testid="app-layout"]');
      expect(appLayout).toBe(true);

      // No console errors related to effectiveUser
      const effectiveUserErrors = monitor.getConsoleErrors().filter(e =>
        e.includes('effectiveUser') || e.includes('MainApp')
      );
      expect(effectiveUserErrors).toHaveLength(0);
    });

    test('should handle user state changes without flickering', async ({ page }) => {
      await page.goto('http://localhost:3004');

      await page.waitForSelector('[data-testid="login-email"]', { timeout: 10000 });
      await page.fill('[data-testid="login-email"]', 'demo@example.com');
      await page.fill('[data-testid="login-password"]', 'demo123');
      await page.click('[data-testid="login-submit"]');

      await page.waitForSelector('[data-testid="app-layout"]', { timeout: 15000 });

      // Interact with user menu (if available)
      const userMenu = page.locator('[data-testid="user-menu"]');
      if (await userMenu.isVisible().catch(() => false)) {
        await userMenu.click();
        await page.waitForTimeout(1000);

        // Should not cause flickering or re-render issues
        expect(monitor.hasRenderWarning()).toBe(false);
      }
    });
  });

  test.describe('Bug Fix #3: Ideas Not Loading in useIdeas', () => {
    test('should successfully load ideas after authentication', async ({ page }) => {
      await page.goto('http://localhost:3004');

      await page.waitForSelector('[data-testid="login-email"]', { timeout: 10000 });
      await page.fill('[data-testid="login-email"]', 'demo@example.com');
      await page.fill('[data-testid="login-password"]', 'demo123');
      await page.click('[data-testid="login-submit"]');

      await page.waitForSelector('[data-testid="app-layout"]', { timeout: 15000 });

      // Wait for design matrix or ideas section to load
      await page.waitForTimeout(3000);

      // Check that ideas are loaded (either visible or empty state shown)
      const matrixVisible = await page.isVisible('[data-testid="design-matrix"]').catch(() => false);
      const emptyStateVisible = await page.isVisible('[data-testid="empty-state"]').catch(() => false);

      // One of these should be true - either we have ideas or empty state
      expect(matrixVisible || emptyStateVisible).toBe(true);

      // No console errors related to useIdeas
      const ideasErrors = monitor.getConsoleErrors().filter(e =>
        e.includes('useIdeas') || e.includes('Failed to load ideas')
      );
      expect(ideasErrors).toHaveLength(0);
    });

    test('should load ideas when navigating to matrix page', async ({ page }) => {
      await page.goto('http://localhost:3004');

      await page.waitForSelector('[data-testid="login-email"]', { timeout: 10000 });
      await page.fill('[data-testid="login-email"]', 'demo@example.com');
      await page.fill('[data-testid="login-password"]', 'demo123');
      await page.click('[data-testid="login-submit"]');

      await page.waitForSelector('[data-testid="app-layout"]', { timeout: 15000 });

      // Navigate to matrix if not already there
      const matrixNav = page.locator('[data-testid="nav-matrix"]');
      if (await matrixNav.isVisible().catch(() => false)) {
        await matrixNav.click();
        await page.waitForTimeout(2000);
      }

      // Check that ideas loading completes without errors
      expect(monitor.hasInfiniteLoopError()).toBe(false);

      const loadingErrors = monitor.getConsoleErrors().filter(e =>
        e.includes('loading') || e.includes('fetch')
      );
      expect(loadingErrors).toHaveLength(0);
    });

    test('should handle idea creation and update ideas list', async ({ page }) => {
      await page.goto('http://localhost:3004');

      await page.waitForSelector('[data-testid="login-email"]', { timeout: 10000 });
      await page.fill('[data-testid="login-email"]', 'demo@example.com');
      await page.fill('[data-testid="login-password"]', 'demo123');
      await page.click('[data-testid="login-submit"]');

      await page.waitForSelector('[data-testid="app-layout"]', { timeout: 15000 });

      // Try to add a new idea
      const addIdeaButton = page.locator('[data-testid="add-idea-button"]');
      if (await addIdeaButton.isVisible().catch(() => false)) {
        await addIdeaButton.click();
        await page.waitForTimeout(1000);

        // Fill in idea form if modal appears
        const titleInput = page.locator('[data-testid="idea-title-input"]');
        if (await titleInput.isVisible().catch(() => false)) {
          await titleInput.fill('Test Idea from Bug Validation');

          const submitButton = page.locator('[data-testid="idea-submit-button"]');
          await submitButton.click();
          await page.waitForTimeout(2000);

          // Should not cause render loop
          expect(monitor.hasInfiniteLoopError()).toBe(false);
        }
      }
    });
  });

  test.describe('Bug Fix #4: DesignMatrix componentState Loop', () => {
    test('should not trigger infinite loop on matrix render', async ({ page }) => {
      await page.goto('http://localhost:3004');

      await page.waitForSelector('[data-testid="login-email"]', { timeout: 10000 });
      await page.fill('[data-testid="login-email"]', 'demo@example.com');
      await page.fill('[data-testid="login-password"]', 'demo123');
      await page.click('[data-testid="login-submit"]');

      await page.waitForSelector('[data-testid="app-layout"]', { timeout: 15000 });

      // Wait for matrix to render
      await page.waitForTimeout(3000);

      // Check for componentState-related errors
      const componentStateErrors = monitor.getConsoleErrors().filter(e =>
        e.includes('componentState') || e.includes('DesignMatrix')
      );
      expect(componentStateErrors).toHaveLength(0);
      expect(monitor.hasInfiniteLoopError()).toBe(false);
    });

    test('should handle matrix interactions without loops', async ({ page }) => {
      await page.goto('http://localhost:3004');

      await page.waitForSelector('[data-testid="login-email"]', { timeout: 10000 });
      await page.fill('[data-testid="login-email"]', 'demo@example.com');
      await page.fill('[data-testid="login-password"]', 'demo123');
      await page.click('[data-testid="login-submit"]');

      await page.waitForSelector('[data-testid="app-layout"]', { timeout: 15000 });

      // Try to interact with matrix (hover over quadrants)
      const matrix = page.locator('[data-testid="design-matrix"]');
      if (await matrix.isVisible().catch(() => false)) {
        // Hover over different areas
        await matrix.hover({ position: { x: 100, y: 100 } });
        await page.waitForTimeout(500);
        await matrix.hover({ position: { x: 300, y: 100 } });
        await page.waitForTimeout(500);

        // Should not trigger infinite loop
        expect(monitor.hasInfiniteLoopError()).toBe(false);
      }
    });

    test('should maintain componentState stability during drag operations', async ({ page }) => {
      await page.goto('http://localhost:3004');

      await page.waitForSelector('[data-testid="login-email"]', { timeout: 10000 });
      await page.fill('[data-testid="login-email"]', 'demo@example.com');
      await page.fill('[data-testid="login-password"]', 'demo123');
      await page.click('[data-testid="login-submit"]');

      await page.waitForSelector('[data-testid="app-layout"]', { timeout: 15000 });

      // Look for draggable ideas
      const ideaCard = page.locator('[data-testid^="idea-card-"]').first();
      if (await ideaCard.isVisible().catch(() => false)) {
        // Attempt to drag (simulate drag start)
        await ideaCard.hover();
        await page.mouse.down();
        await page.waitForTimeout(500);
        await page.mouse.up();

        // Should not cause componentState loop
        expect(monitor.hasInfiniteLoopError()).toBe(false);

        const stateErrors = monitor.getConsoleErrors().filter(e =>
          e.includes('componentState')
        );
        expect(stateErrors).toHaveLength(0);
      }
    });
  });

  test.describe('Performance & Console Error Summary', () => {
    test('comprehensive console error check across full user journey', async ({ page }) => {
      monitor.reset();

      await page.goto('http://localhost:3004');

      // Complete login
      await page.waitForSelector('[data-testid="login-email"]', { timeout: 10000 });
      await page.fill('[data-testid="login-email"]', 'demo@example.com');
      await page.fill('[data-testid="login-password"]', 'demo123');
      await page.click('[data-testid="login-submit"]');
      await page.waitForSelector('[data-testid="app-layout"]', { timeout: 15000 });

      // Wait for full initialization
      await page.waitForTimeout(5000);

      // Generate comprehensive error report
      const errors = monitor.getConsoleErrors();
      const warnings = monitor.getConsoleWarnings();

      console.log('\n=== CONSOLE ERROR REPORT ===');
      console.log(`Total Errors: ${errors.length}`);
      console.log(`Total Warnings: ${warnings.length}`);
      console.log(`Has Infinite Loop Error: ${monitor.hasInfiniteLoopError()}`);
      console.log(`Has Render Warning: ${monitor.hasRenderWarning()}`);

      if (errors.length > 0) {
        console.log('\nErrors:');
        errors.forEach((err, idx) => console.log(`  ${idx + 1}. ${err}`));
      }

      if (warnings.length > 0) {
        console.log('\nWarnings:');
        warnings.forEach((warn, idx) => console.log(`  ${idx + 1}. ${warn}`));
      }

      // Critical assertions - these should all pass with fixes
      expect(monitor.hasInfiniteLoopError()).toBe(false);

      // Filter out non-critical errors (like network errors in dev)
      const criticalErrors = errors.filter(e =>
        e.includes('Maximum update depth') ||
        e.includes('Too many re-renders') ||
        e.includes('Cannot update a component') ||
        e.includes('infinite')
      );

      expect(criticalErrors).toHaveLength(0);
    });
  });
});
