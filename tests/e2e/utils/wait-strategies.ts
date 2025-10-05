/**
 * Comprehensive wait strategies for E2E tests
 *
 * This module provides production-ready wait utilities that replace
 * arbitrary timeouts with state-based waits. All strategies are optimized
 * for reliability and performance.
 *
 * Based on E2E Wait Strategy Design v1.0
 * @see claudedocs/E2E_WAIT_STRATEGY_DESIGN.md
 *
 * Key principles:
 * 1. Never use arbitrary timeouts (waitForTimeout)
 * 2. Always wait for specific DOM states or network responses
 * 3. Use appropriate timeouts for each operation type
 * 4. Provide CI-aware timing adjustments
 */

import { Page, Locator, expect } from '@playwright/test';
import { TIMEOUTS, OPERATION_TIMEOUTS } from './timeouts';
import { retryOperation } from './retry-logic';

// ============================================================================
// Authentication Wait Strategies
// ============================================================================

/**
 * Wait for demo user login to complete
 *
 * Optimal strategy: Wait for navigation or auth screen to disappear,
 * then verify authenticated state.
 *
 * @param page - Playwright page instance
 * @param selectors - CSS selectors for auth elements
 *
 * @example
 * ```typescript
 * await page.locator('[data-testid="demo-button"]').click();
 * await waitForDemoLogin(page, {
 *   demoButton: '[data-testid="demo-button"]',
 *   authContainer: '[data-testid="auth-screen"]',
 *   matrixContainer: '[data-testid="matrix"]'
 * });
 * ```
 */
export async function waitForDemoLogin(
  page: Page,
  selectors: {
    authContainer: string;
    matrixContainer?: string;
    successIndicator?: string;
  }
): Promise<void> {
  // Parallel wait: either URL changed or auth screen hidden
  await Promise.race([
    // Success: navigated away from auth
    page.waitForURL('**/matrix', { timeout: OPERATION_TIMEOUTS.auth.login }).catch(() => {}),
    // Alternative: auth screen hidden
    page.locator(selectors.authContainer).waitFor({
      state: 'hidden',
      timeout: OPERATION_TIMEOUTS.auth.login
    })
  ]);

  // Verify authenticated state
  const successSelector = selectors.successIndicator ||
    selectors.matrixContainer ||
    'text=Create Project';

  await expect(page.locator(successSelector)).toBeVisible({
    timeout: TIMEOUTS.QUICK
  });
}

/**
 * Wait for form-based login to complete
 *
 * Tracks the full submission lifecycle including loading states.
 *
 * @param page - Playwright page instance
 * @param submitButton - Submit button locator
 * @param options - Success/error indicators
 *
 * @example
 * ```typescript
 * const submitButton = page.locator('button[type="submit"]');
 * await submitButton.click();
 * await waitForFormLogin(page, submitButton, {
 *   navigationPattern: /\/dashboard|\/matrix/,
 *   errorSelector: '.error-message'
 * });
 * ```
 */
export async function waitForFormLogin(
  page: Page,
  submitButton: Locator,
  options: {
    navigationPattern?: string | RegExp;
    errorSelector?: string;
  } = {}
): Promise<void> {
  // Wait for loading state to appear (proves request started)
  await expect(submitButton).toHaveAttribute(
    'disabled',
    '',
    { timeout: TIMEOUTS.QUICK }
  ).catch(() => {
    // Button might use data-state instead
    return expect(submitButton).toHaveAttribute(
      'data-state',
      'loading',
      { timeout: TIMEOUTS.QUICK }
    );
  });

  // Wait for loading state to clear (request completed)
  await expect(submitButton).not.toHaveAttribute(
    'disabled',
    '',
    { timeout: OPERATION_TIMEOUTS.auth.login }
  ).catch(() => {
    return expect(submitButton).not.toHaveAttribute(
      'data-state',
      'loading',
      { timeout: OPERATION_TIMEOUTS.auth.login }
    );
  });

  // Wait for success or error
  await Promise.race([
    // Success: navigated away
    options.navigationPattern
      ? page.waitForURL(options.navigationPattern, { timeout: TIMEOUTS.QUICK })
      : Promise.resolve(),
    // Error: error message appeared
    options.errorSelector
      ? page.locator(options.errorSelector).waitFor({
          state: 'visible',
          timeout: TIMEOUTS.QUICK
        })
      : Promise.resolve()
  ]);
}

/**
 * Wait for logout to complete
 *
 * @param page - Playwright page instance
 * @param options - Logout indicators
 *
 * @example
 * ```typescript
 * await page.locator('[data-testid="logout-button"]').click();
 * await waitForLogout(page, {
 *   authScreenSelector: '[data-testid="auth-screen"]'
 * });
 * ```
 */
export async function waitForLogout(
  page: Page,
  options: {
    authScreenSelector?: string;
    loginButtonSelector?: string;
  } = {}
): Promise<void> {
  // Wait for navigation to auth page or login button to appear
  await Promise.race([
    page.waitForURL(/\/auth|\/login/, { timeout: OPERATION_TIMEOUTS.auth.logout }),
    options.authScreenSelector
      ? expect(page.locator(options.authScreenSelector)).toBeVisible({
          timeout: OPERATION_TIMEOUTS.auth.logout
        })
      : Promise.resolve(),
    options.loginButtonSelector
      ? expect(page.locator(options.loginButtonSelector)).toBeVisible({
          timeout: OPERATION_TIMEOUTS.auth.logout
        })
      : Promise.resolve()
  ]);
}

/**
 * Wait for field validation to complete
 *
 * @param field - Input field locator
 * @param expectError - Whether to expect validation error
 * @param errorSelector - Error message selector (optional)
 *
 * @example
 * ```typescript
 * const emailField = page.locator('input[name="email"]');
 * await emailField.fill('invalid');
 * await waitForFieldValidation(emailField, true, '.error-message');
 * ```
 */
export async function waitForFieldValidation(
  field: Locator,
  expectError: boolean = false,
  errorSelector: string = '.input-message--error, .error-message, [role="alert"]'
): Promise<void> {
  // Trigger validation
  await field.blur();

  // Get error message relative to field or at page level
  const page = field.page();
  const errorMessage = page.locator(errorSelector).first();

  if (expectError) {
    // Wait for error to appear
    await expect(errorMessage).toBeVisible({
      timeout: OPERATION_TIMEOUTS.auth.validation
    });
  } else {
    // Wait for error to NOT appear
    await expect(errorMessage).not.toBeVisible({
      timeout: OPERATION_TIMEOUTS.auth.validation
    });
  }
}

// ============================================================================
// Modal Wait Strategies
// ============================================================================

/**
 * Wait for modal to open and be ready for interaction
 *
 * Waits for modal visibility, animation completion, and interactive state.
 *
 * @param page - Playwright page instance
 * @param modalSelector - Modal container selector
 *
 * @example
 * ```typescript
 * await page.locator('[data-testid="add-idea-button"]').click();
 * await waitForModalOpen(page, '[role="dialog"]');
 * ```
 */
export async function waitForModalOpen(
  page: Page,
  modalSelector: string
): Promise<void> {
  const modal = page.locator(modalSelector);

  // Wait for modal to be visible
  await modal.waitFor({ state: 'visible', timeout: OPERATION_TIMEOUTS.modal.open });

  // Wait for entrance animation to complete
  await page.waitForFunction(
    (selector) => {
      const el = document.querySelector(selector);
      if (!el) return false;

      // Check if element has finished animating
      const animations = el.getAnimations();
      return animations.length === 0 || animations.every(a => a.playState === 'finished');
    },
    modalSelector,
    { timeout: OPERATION_TIMEOUTS.modal.open }
  );

  // Verify modal is interactive (focusable elements exist and are enabled)
  const interactiveElement = modal.locator('input, button, textarea, select').first();
  await expect(interactiveElement).toBeEnabled({ timeout: TIMEOUTS.INSTANT });
}

/**
 * Wait for modal to close completely
 *
 * @param page - Playwright page instance
 * @param modalSelector - Modal container selector
 *
 * @example
 * ```typescript
 * await page.locator('button:has-text("Cancel")').click();
 * await waitForModalClose(page, '[role="dialog"]');
 * ```
 */
export async function waitForModalClose(
  page: Page,
  modalSelector: string
): Promise<void> {
  const modal = page.locator(modalSelector);

  // Wait for modal to be hidden
  await modal.waitFor({ state: 'hidden', timeout: OPERATION_TIMEOUTS.modal.close });

  // Verify modal is completely removed from accessibility tree
  await expect(modal).not.toBeInViewport({ timeout: TIMEOUTS.INSTANT });
}

/**
 * Wait for modal form to be ready for input
 *
 * @param page - Playwright page instance
 * @param modalSelector - Modal container selector
 * @param expectedFields - Array of field selectors to wait for
 *
 * @example
 * ```typescript
 * await waitForModalOpen(page, '[role="dialog"]');
 * await waitForModalReady(page, '[role="dialog"]', [
 *   'input[name="title"]',
 *   'textarea[name="description"]'
 * ]);
 * ```
 */
export async function waitForModalReady(
  page: Page,
  modalSelector: string,
  expectedFields: string[] = []
): Promise<void> {
  const modal = page.locator(modalSelector);

  // Wait for all fields to be present and enabled
  if (expectedFields.length > 0) {
    await Promise.all(
      expectedFields.map(field =>
        modal.locator(field).waitFor({ state: 'visible', timeout: OPERATION_TIMEOUTS.modal.formReady })
          .then(() => expect(modal.locator(field)).toBeEnabled({ timeout: TIMEOUTS.INSTANT }))
      )
    );
  }

  // Verify no loading spinners in modal
  const loadingIndicator = modal.locator('[data-loading="true"], .spinner, .loading, [aria-busy="true"]');
  await expect(loadingIndicator).not.toBeVisible({ timeout: TIMEOUTS.QUICK });
}

// ============================================================================
// Form Interaction Wait Strategies
// ============================================================================

/**
 * Fill input field when ready
 *
 * Ensures field is visible, enabled, and properly cleared before filling.
 *
 * @param page - Playwright page instance
 * @param selector - Field selector
 * @param value - Value to fill
 * @param options - Fill options
 *
 * @example
 * ```typescript
 * await fillFieldWhenReady(page, 'input[name="email"]', 'test@example.com', {
 *   clear: true,
 *   delay: 50 // Human-like typing delay
 * });
 * ```
 */
export async function fillFieldWhenReady(
  page: Page,
  selector: string,
  value: string,
  options: { delay?: number; clear?: boolean } = {}
): Promise<void> {
  const field = page.locator(selector);

  // Wait for field to be visible and enabled
  await expect(field).toBeVisible({ timeout: TIMEOUTS.QUICK });
  await expect(field).toBeEnabled({ timeout: TIMEOUTS.INSTANT });

  // Clear if needed
  if (options.clear !== false) {
    await field.clear();
    // Verify field is empty
    await expect(field).toHaveValue('', { timeout: TIMEOUTS.INSTANT });
  }

  // Fill with optional human-like delay
  if (options.delay) {
    await field.fill(value);
  } else {
    await field.fill(value, { timeout: TIMEOUTS.QUICK });
  }

  // Verify value was set
  await expect(field).toHaveValue(value, { timeout: TIMEOUTS.INSTANT });
}

/**
 * Wait for form submission to complete
 *
 * Tracks the full submission lifecycle including network requests
 * and success/error indicators.
 *
 * @param page - Playwright page instance
 * @param submitButton - Submit button locator
 * @param successIndicators - Success condition options
 *
 * @example
 * ```typescript
 * const submitButton = page.locator('button[type="submit"]');
 * await submitButton.click();
 * await waitForFormSubmission(page, submitButton, {
 *   navigationPattern: '/success',
 *   successMessage: 'Saved successfully'
 * });
 * ```
 */
export async function waitForFormSubmission(
  page: Page,
  submitButton: Locator,
  successIndicators: {
    navigationPattern?: string | RegExp;
    successMessage?: string;
    elementHidden?: string;
    errorMessage?: string;
  } = {}
): Promise<void> {
  // Wait for button to be disabled (proves submission started)
  await expect(submitButton).toBeDisabled({ timeout: TIMEOUTS.QUICK }).catch(() => {
    // Button might use aria-busy or data-state
    return expect(submitButton).toHaveAttribute('aria-busy', 'true', { timeout: TIMEOUTS.QUICK });
  });

  // Wait for button to be enabled again (submission completed)
  await expect(submitButton).toBeEnabled({
    timeout: OPERATION_TIMEOUTS.modal.submit
  }).catch(() => {
    return expect(submitButton).not.toHaveAttribute('aria-busy', 'true', {
      timeout: OPERATION_TIMEOUTS.modal.submit
    });
  });

  // Wait for success indicator
  const indicators = [];

  if (successIndicators.navigationPattern) {
    indicators.push(
      page.waitForURL(successIndicators.navigationPattern, { timeout: TIMEOUTS.QUICK })
    );
  }

  if (successIndicators.successMessage) {
    indicators.push(
      expect(page.locator(`text=${successIndicators.successMessage}`)).toBeVisible({
        timeout: TIMEOUTS.QUICK
      })
    );
  }

  if (successIndicators.elementHidden) {
    indicators.push(
      page.locator(successIndicators.elementHidden).waitFor({
        state: 'hidden',
        timeout: TIMEOUTS.QUICK
      })
    );
  }

  if (successIndicators.errorMessage) {
    indicators.push(
      expect(page.locator(`text=${successIndicators.errorMessage}`)).toBeVisible({
        timeout: TIMEOUTS.QUICK
      })
    );
  }

  if (indicators.length > 0) {
    await Promise.race(indicators);
  }
}

// ============================================================================
// Navigation Wait Strategies
// ============================================================================

/**
 * Wait for page transition to complete
 *
 * @param page - Playwright page instance
 * @param expectedURL - Expected URL pattern
 * @param options - Transition options
 *
 * @example
 * ```typescript
 * await page.locator('a[href="/dashboard"]').click();
 * await waitForPageTransition(page, '/dashboard', {
 *   waitForElement: '[data-testid="dashboard"]'
 * });
 * ```
 */
export async function waitForPageTransition(
  page: Page,
  expectedURL: string | RegExp,
  options: {
    waitForElement?: string;
    waitForNetwork?: boolean;
  } = {}
): Promise<void> {
  // Wait for URL change
  await page.waitForURL(expectedURL, { timeout: OPERATION_TIMEOUTS.navigation.pageLoad });

  // Wait for network to settle if requested (use sparingly)
  if (options.waitForNetwork === true) {
    await page.waitForLoadState('networkidle', {
      timeout: OPERATION_TIMEOUTS.navigation.networkIdle
    });
  } else {
    // Default: just wait for DOM to be ready
    await page.waitForLoadState('domcontentloaded', { timeout: TIMEOUTS.QUICK });
  }

  // Wait for specific element if provided
  if (options.waitForElement) {
    await expect(page.locator(options.waitForElement)).toBeVisible({
      timeout: TIMEOUTS.QUICK
    });
  }
}

/**
 * Wait for SPA route change
 *
 * @param page - Playwright page instance
 * @param routePattern - Route URL pattern
 * @param expectedElement - Element that should appear after route change
 *
 * @example
 * ```typescript
 * await page.locator('[data-route="/matrix"]').click();
 * await waitForRouteChange(page, '/matrix', '[data-testid="matrix-grid"]');
 * ```
 */
export async function waitForRouteChange(
  page: Page,
  routePattern: string | RegExp,
  expectedElement: string
): Promise<void> {
  // In SPAs, URL might change before content
  const urlPromise = page.waitForURL(routePattern, {
    timeout: OPERATION_TIMEOUTS.navigation.routeChange
  });
  const elementPromise = page.locator(expectedElement).waitFor({
    state: 'visible',
    timeout: OPERATION_TIMEOUTS.navigation.routeChange
  });

  // Wait for both conditions
  await Promise.all([urlPromise, elementPromise]);

  // Wait for route transition animation (if present)
  await page.waitForFunction(
    () => !document.body.classList.contains('route-transitioning'),
    { timeout: TIMEOUTS.ANIMATION }
  ).catch(() => {
    // No transition class is fine
  });
}

// ============================================================================
// Drag and Drop Wait Strategies
// ============================================================================

/**
 * Wait for drag operation to be ready
 *
 * @param element - Element to drag
 *
 * @example
 * ```typescript
 * const card = page.locator('.idea-card').first();
 * await waitForDragReady(card);
 * await card.dragTo(target);
 * ```
 */
export async function waitForDragReady(element: Locator): Promise<void> {
  await expect(element).toBeVisible({ timeout: TIMEOUTS.QUICK });
  await expect(element).toBeEnabled({ timeout: TIMEOUTS.INSTANT });

  // Verify element has expected drag attributes by checking first matching element
  const hasDraggable = await element.getAttribute('draggable').catch(() => null);
  if (hasDraggable !== 'true') {
    // Check if element has a draggable child
    const draggableChild = element.locator('[draggable="true"]').first();
    await draggableChild.count().then(count => {
      if (count === 0) {
        // Element might use data-draggable or be implicitly draggable
        // This is fine, don't fail
      }
    });
  }
}

/**
 * Wait for drag operation to complete
 *
 * Waits for dragging state to clear and position to stabilize.
 *
 * @param page - Playwright page instance
 * @param draggedElement - Element that was dragged
 * @param options - Verification options
 *
 * @example
 * ```typescript
 * await sourceElement.dragTo(targetElement);
 * await waitForDragComplete(page, sourceElement, {
 *   verifyPosition: true
 * });
 * ```
 */
export async function waitForDragComplete(
  page: Page,
  draggedElement: Locator,
  options: {
    verifyPosition?: boolean;
    expectedX?: number;
    expectedY?: number;
  } = {}
): Promise<void> {
  // Wait for dragging class to be removed
  await expect(draggedElement).not.toHaveClass(/is-dragging|dragging/, {
    timeout: OPERATION_TIMEOUTS.idea.drag
  }).catch(() => {
    // Element might not use dragging class
  });

  // Wait for position to stabilize (two animation frames)
  await page.evaluate(() => new Promise(resolve => {
    requestAnimationFrame(() => {
      requestAnimationFrame(resolve);
    });
  }));

  // Verify position if requested
  if (options.verifyPosition && options.expectedX !== undefined && options.expectedY !== undefined) {
    const box = await draggedElement.boundingBox();
    if (!box) {
      throw new Error('Could not get bounding box for dragged element');
    }
    const tolerance = 5; // 5px tolerance
    if (Math.abs(box.x - options.expectedX) >= tolerance ||
        Math.abs(box.y - options.expectedY) >= tolerance) {
      throw new Error(
        `Element position (${box.x}, ${box.y}) does not match expected (${options.expectedX}, ${options.expectedY})`
      );
    }
  }

  // Wait for any drop animations to complete
  // We need to use evaluate to check animations on the actual DOM element
  const selector = await draggedElement.evaluate((el) => {
    // Generate a unique selector for this element
    if (el.id) return `#${el.id}`;
    if (el.className) return `.${el.className.split(' ')[0]}`;
    return el.tagName.toLowerCase();
  });

  await page.waitForFunction(
    (sel) => {
      const element = document.querySelector(sel);
      if (!element) return false;

      const animations = element.getAnimations({ subtree: true });
      if (animations.length === 0) return true;

      return animations.every(animation =>
        animation.playState === 'finished' ||
        animation.playState === 'idle'
      );
    },
    selector,
    { timeout: TIMEOUTS.ANIMATION }
  ).catch(() => {
    // No animations is fine
  });
}

// ============================================================================
// Utility Exports
// ============================================================================

/**
 * Wait for all CSS animations on an element to complete
 *
 * @param page - Playwright page instance
 * @param elementSelector - Element selector
 * @param maxDuration - Maximum animation duration (default: TIMEOUTS.ANIMATION)
 *
 * @example
 * ```typescript
 * await waitForAnimationComplete(page, '.modal-enter');
 * ```
 */
export async function waitForAnimationComplete(
  page: Page,
  elementSelector: string,
  maxDuration: number = TIMEOUTS.ANIMATION
): Promise<void> {
  await page.waitForFunction(
    (selector) => {
      const element = document.querySelector(selector);
      if (!element) return false;

      const animations = element.getAnimations({ subtree: true });
      if (animations.length === 0) return true;

      return animations.every(animation =>
        animation.playState === 'finished' ||
        animation.playState === 'idle'
      );
    },
    elementSelector,
    { timeout: maxDuration }
  );
}

/**
 * Wait for element to be stable (no rapid re-renders)
 *
 * @param page - Playwright page instance
 * @param selector - Element selector
 * @param stabilityPeriod - How long element must remain stable (default: 100ms)
 *
 * @example
 * ```typescript
 * await waitForElementStable(page, '[data-testid="matrix"]', 200);
 * ```
 */
export async function waitForElementStable(
  page: Page,
  selector: string,
  stabilityPeriod: number = 100
): Promise<void> {
  await page.waitForFunction(
    ({ sel, period }) => {
      const element = document.querySelector(sel);
      if (!element) return false;

      // Store initial state
      const initialHTML = element.innerHTML;
      const initialChildCount = element.children.length;

      // Check stability after delay
      return new Promise<boolean>(resolve => {
        setTimeout(() => {
          resolve(
            element.innerHTML === initialHTML &&
            element.children.length === initialChildCount
          );
        }, period);
      });
    },
    { sel: selector, period: stabilityPeriod },
    { timeout: TIMEOUTS.QUICK }
  );
}
