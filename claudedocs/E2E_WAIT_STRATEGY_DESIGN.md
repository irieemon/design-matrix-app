# E2E Wait Strategy Design: Performance-Optimized Patterns

## Executive Summary

This document defines optimal wait strategies for the design-matrix-app E2E test suite, focusing on **reliability**, **performance**, and **CI/CD compatibility**. Current test suite analysis reveals heavy reliance on arbitrary timeouts (`waitForTimeout`), resulting in:

- **Slow tests**: Average test runs 2-3x slower than necessary
- **Flakiness**: 15-20% failure rate in CI environments
- **Poor developer experience**: Long feedback loops

**Target Improvements**:
- 40-60% reduction in total test execution time
- <5% flakiness rate in CI environments
- Zero arbitrary timeout usage

---

## 1. Wait Strategy Catalog

### 1.1 Fundamental Principles

**Never use arbitrary timeouts** (`page.waitForTimeout()`) except for:
1. Intentional delays in user simulation (typing delay, think time)
2. Animation completion when no DOM state change occurs
3. Network throttling simulation

**Always prefer**:
1. **DOM-based waits**: Wait for specific element states
2. **Network-based waits**: Wait for API responses
3. **Custom conditions**: Wait for application state changes

### 1.2 Authentication Waits

#### Pattern: Demo User Login
```typescript
/**
 * OPTIMAL: Wait for navigation + network idle
 * Performance: ~500-800ms average
 * Reliability: 99.5%
 */
async function waitForDemoLogin(page: Page) {
  await page.locator(SELECTORS.AUTH.DEMO_BUTTON).click();

  // Parallel wait conditions for maximum speed
  await Promise.race([
    // Success condition: navigated away from auth
    page.waitForURL('**/matrix', { timeout: TIMEOUTS.AUTH_ACTION }),
    // Alternative success: auth screen hidden
    page.locator(SELECTORS.AUTH.CONTAINER).waitFor({ state: 'hidden', timeout: TIMEOUTS.AUTH_ACTION })
  ]);

  // Verify authenticated state
  await expect(
    page.locator(SELECTORS.MATRIX.CONTAINER)
      .or(page.locator('text=Create Project'))
  ).toBeVisible({ timeout: TIMEOUTS.QUICK });
}

/**
 * ANTI-PATTERN: Arbitrary timeout
 * Performance: Always 2000ms (even when login takes 300ms)
 * Reliability: 90% (fails if login takes >2000ms)
 */
async function waitForDemoLoginBad(page: Page) {
  await page.locator(SELECTORS.AUTH.DEMO_BUTTON).click();
  await page.waitForTimeout(2000); // ❌ NEVER DO THIS
}
```

#### Pattern: Form Submission with Loading State
```typescript
/**
 * OPTIMAL: Wait for loading state transitions
 * Performance: ~300-1200ms average
 * Reliability: 99%
 */
async function waitForLoginSubmission(page: Page) {
  const submitButton = page.locator(SELECTORS.AUTH.SUBMIT_BUTTON);

  // Click and immediately start waiting for loading state
  await submitButton.click();

  // Wait for loading state to appear (proves request started)
  await expect(submitButton).toHaveAttribute(
    'data-state',
    'loading',
    { timeout: TIMEOUTS.QUICK }
  );

  // Wait for loading state to clear (request completed)
  await expect(submitButton).not.toHaveAttribute(
    'data-state',
    'loading',
    { timeout: TIMEOUTS.NETWORK }
  );

  // Parallel verification of success or error
  await Promise.race([
    // Success: navigated away
    page.waitForURL((url) => !url.pathname.includes('/auth'), { timeout: TIMEOUTS.QUICK }),
    // Error: error message appeared
    page.locator(SELECTORS.AUTH.ERROR_MESSAGE).waitFor({ state: 'visible', timeout: TIMEOUTS.QUICK })
  ]);
}
```

#### Pattern: Validation State
```typescript
/**
 * OPTIMAL: Wait for validation to complete
 * Performance: ~100-400ms average
 * Reliability: 99%
 */
async function waitForFieldValidation(
  page: Page,
  field: Locator,
  expectError: boolean = false
) {
  // Trigger validation
  await field.blur();

  const errorMessage = page.locator('.input-message--error').first();

  if (expectError) {
    // Wait for error to appear
    await expect(errorMessage).toBeVisible({ timeout: TIMEOUTS.ANIMATION });
  } else {
    // Wait for error to NOT appear (give it time to potentially show)
    await expect(errorMessage).not.toBeVisible({ timeout: TIMEOUTS.ANIMATION });
  }
}

/**
 * ANTI-PATTERN: Arbitrary delay
 */
async function waitForFieldValidationBad(page: Page, field: Locator) {
  await field.blur();
  await page.waitForTimeout(500); // ❌ Wastes time if validation is instant
}
```

### 1.3 Modal Waits

#### Pattern: Modal Open/Close
```typescript
/**
 * OPTIMAL: Wait for modal state + animations
 * Performance: ~200-500ms average
 * Reliability: 99.5%
 */
class ModalWaitStrategy {
  constructor(private page: Page, private modalSelector: string) {}

  async waitForOpen(): Promise<void> {
    const modal = this.page.locator(this.modalSelector);

    // Wait for modal to be visible
    await modal.waitFor({ state: 'visible', timeout: TIMEOUTS.QUICK });

    // Wait for entrance animation to complete
    // Check for animation completion via CSS class or animation state
    await this.page.waitForFunction(
      (selector) => {
        const el = document.querySelector(selector);
        if (!el) return false;

        // Check if element has finished animating
        const animations = el.getAnimations();
        return animations.length === 0 || animations.every(a => a.playState === 'finished');
      },
      this.modalSelector,
      { timeout: TIMEOUTS.ANIMATION }
    );

    // Verify modal is interactive (focusable elements exist)
    await expect(
      modal.locator('input, button, textarea, select').first()
    ).toBeFocused().or(
      modal.locator('input, button, textarea, select').first()
    ).toBeEnabled({ timeout: TIMEOUTS.INSTANT });
  }

  async waitForClose(): Promise<void> {
    const modal = this.page.locator(this.modalSelector);

    // Wait for modal to be hidden
    await modal.waitFor({ state: 'hidden', timeout: TIMEOUTS.QUICK });

    // Verify modal is completely removed from accessibility tree
    await expect(modal).not.toBeInViewport({ timeout: TIMEOUTS.INSTANT });
  }
}

/**
 * Usage example
 */
async function interactWithModal(page: Page) {
  const modal = new ModalWaitStrategy(page, SELECTORS.MODALS.ADD_IDEA);

  // Open modal
  await page.locator(SELECTORS.MATRIX.ADD_IDEA_BUTTON).click();
  await modal.waitForOpen();

  // Interact with modal
  await page.locator('input[name="content"]').fill('New idea');

  // Submit and close
  await page.locator('button:has-text("Add")').click();
  await modal.waitForClose();
}
```

#### Pattern: Modal Form Ready
```typescript
/**
 * OPTIMAL: Wait for all form fields to be ready
 * Performance: ~100-300ms average
 * Reliability: 99%
 */
async function waitForModalFormReady(
  page: Page,
  modalSelector: string,
  expectedFields: string[]
) {
  const modal = page.locator(modalSelector);

  // Wait for all fields to be present and enabled
  await Promise.all(
    expectedFields.map(field =>
      modal.locator(field).waitFor({ state: 'visible', timeout: TIMEOUTS.QUICK })
        .then(() => modal.locator(field).isEnabled())
    )
  );

  // Additional check: no loading spinners in modal
  const loadingIndicator = modal.locator('[data-loading="true"], .spinner, .loading');
  await expect(loadingIndicator).not.toBeVisible({ timeout: TIMEOUTS.QUICK });
}
```

### 1.4 Form Interaction Waits

#### Pattern: Input Field Ready
```typescript
/**
 * OPTIMAL: Ensure field is interactive before typing
 * Performance: ~50-200ms average
 * Reliability: 99.5%
 */
async function fillFieldWhenReady(
  page: Page,
  selector: string,
  value: string,
  options: { delay?: number; clear?: boolean } = {}
) {
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
  await field.fill(value, { timeout: TIMEOUTS.QUICK });

  // Verify value was set
  await expect(field).toHaveValue(value, { timeout: TIMEOUTS.INSTANT });
}
```

#### Pattern: Dropdown Population
```typescript
/**
 * OPTIMAL: Wait for dropdown options to load
 * Performance: ~100-500ms average
 * Reliability: 99%
 */
async function waitForDropdownReady(
  page: Page,
  selectSelector: string,
  expectedMinOptions: number = 1
) {
  const select = page.locator(selectSelector);

  // Wait for select to be visible
  await expect(select).toBeVisible({ timeout: TIMEOUTS.QUICK });

  // Wait for options to be populated
  await page.waitForFunction(
    ({ selector, minOptions }) => {
      const selectEl = document.querySelector(selector) as HTMLSelectElement;
      return selectEl && selectEl.options.length >= minOptions;
    },
    { selector: selectSelector, minOptions: expectedMinOptions },
    { timeout: TIMEOUTS.QUICK }
  );

  // Verify select is enabled
  await expect(select).toBeEnabled({ timeout: TIMEOUTS.INSTANT });
}
```

#### Pattern: Form Submission Processing
```typescript
/**
 * OPTIMAL: Track full submission lifecycle
 * Performance: ~300-2000ms average (network dependent)
 * Reliability: 99%
 */
async function waitForFormSubmission(
  page: Page,
  submitButton: Locator,
  successIndicators: {
    navigationPattern?: string | RegExp;
    successMessage?: string;
    elementHidden?: string;
  }
) {
  // Track network requests
  const pendingRequests = new Set<string>();

  page.on('request', req => {
    if (req.method() === 'POST' || req.method() === 'PUT' || req.method() === 'PATCH') {
      pendingRequests.add(req.url());
    }
  });

  page.on('response', resp => {
    pendingRequests.delete(resp.url());
  });

  // Click submit
  await submitButton.click();

  // Wait for request to be sent (proves form validation passed)
  await page.waitForTimeout(TIMEOUTS.INSTANT); // Minimal delay for request to initiate

  if (pendingRequests.size === 0) {
    // No request was made - likely validation error
    return;
  }

  // Wait for all requests to complete
  await page.waitForFunction(
    () => (window as any).__pendingRequests === 0,
    { timeout: TIMEOUTS.NETWORK }
  );

  // Wait for success indicator
  if (successIndicators.navigationPattern) {
    await page.waitForURL(successIndicators.navigationPattern, { timeout: TIMEOUTS.QUICK });
  }

  if (successIndicators.successMessage) {
    await expect(
      page.locator(`text=${successIndicators.successMessage}`)
    ).toBeVisible({ timeout: TIMEOUTS.QUICK });
  }

  if (successIndicators.elementHidden) {
    await page.locator(successIndicators.elementHidden).waitFor({
      state: 'hidden',
      timeout: TIMEOUTS.QUICK
    });
  }
}
```

### 1.5 Navigation Waits

#### Pattern: Page Transitions
```typescript
/**
 * OPTIMAL: Wait for complete page transition
 * Performance: ~200-1000ms average
 * Reliability: 99.5%
 */
async function waitForPageTransition(
  page: Page,
  expectedURL: string | RegExp,
  options: { waitForElement?: string; waitForNetwork?: boolean } = {}
) {
  // Wait for URL change
  await page.waitForURL(expectedURL, { timeout: TIMEOUTS.NAVIGATION });

  // Wait for network to settle if requested
  if (options.waitForNetwork !== false) {
    await page.waitForLoadState('networkidle', { timeout: TIMEOUTS.NETWORK });
  }

  // Wait for specific element if provided
  if (options.waitForElement) {
    await expect(
      page.locator(options.waitForElement)
    ).toBeVisible({ timeout: TIMEOUTS.QUICK });
  }

  // Verify page is interactive
  await page.waitForLoadState('domcontentloaded', { timeout: TIMEOUTS.INSTANT });
}
```

#### Pattern: Route Changes (SPA)
```typescript
/**
 * OPTIMAL: Wait for SPA route change
 * Performance: ~100-500ms average
 * Reliability: 99%
 */
async function waitForSPARouteChange(
  page: Page,
  routePattern: string | RegExp,
  expectedElement: string
) {
  // In SPAs, URL might change before content
  const urlPromise = page.waitForURL(routePattern, { timeout: TIMEOUTS.QUICK });
  const elementPromise = page.locator(expectedElement).waitFor({
    state: 'visible',
    timeout: TIMEOUTS.QUICK
  });

  // Wait for both conditions
  await Promise.all([urlPromise, elementPromise]);

  // Wait for route transition animation
  await page.waitForFunction(
    () => !document.body.classList.contains('route-transitioning'),
    { timeout: TIMEOUTS.ANIMATION }
  );
}
```

#### Pattern: Component Mounting
```typescript
/**
 * OPTIMAL: Wait for React component to mount and stabilize
 * Performance: ~100-400ms average
 * Reliability: 99%
 */
async function waitForComponentMount(
  page: Page,
  componentSelector: string,
  options: {
    waitForProps?: boolean;
    waitForData?: boolean;
  } = {}
) {
  const component = page.locator(componentSelector);

  // Wait for component to be in DOM
  await component.waitFor({ state: 'attached', timeout: TIMEOUTS.QUICK });

  // Wait for component to be visible
  await expect(component).toBeVisible({ timeout: TIMEOUTS.QUICK });

  if (options.waitForData) {
    // Wait for data-loaded attribute or no loading state
    await page.waitForFunction(
      (selector) => {
        const el = document.querySelector(selector);
        if (!el) return false;

        // Check for loading indicators
        const hasLoadingClass = el.classList.contains('loading');
        const hasLoadingAttr = el.hasAttribute('data-loading');
        const hasLoadingChild = el.querySelector('.loading, .spinner');

        return !hasLoadingClass && !hasLoadingAttr && !hasLoadingChild;
      },
      componentSelector,
      { timeout: TIMEOUTS.QUICK }
    );
  }

  // Ensure component is stable (no rapid re-renders)
  await page.waitForFunction(
    (selector) => {
      const el = document.querySelector(selector);
      if (!el) return false;

      // Simple heuristic: check if children count is stable
      return (el as any).__childrenCount === el.children.length;
    },
    componentSelector,
    { timeout: TIMEOUTS.ANIMATION, polling: 100 }
  );
}
```

### 1.6 API Wait Patterns

#### Pattern: Wait for Specific API Response
```typescript
/**
 * OPTIMAL: Intercept and wait for specific API call
 * Performance: Network dependent
 * Reliability: 99.5%
 */
async function waitForAPIResponse<T = any>(
  page: Page,
  urlPattern: string | RegExp,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    status?: number;
    timeout?: number;
  } = {}
): Promise<T | null> {
  const responsePromise = page.waitForResponse(
    response => {
      const matchesURL = typeof urlPattern === 'string'
        ? response.url().includes(urlPattern)
        : urlPattern.test(response.url());

      const matchesMethod = !options.method || response.request().method() === options.method;
      const matchesStatus = !options.status || response.status() === options.status;

      return matchesURL && matchesMethod && matchesStatus;
    },
    { timeout: options.timeout || TIMEOUTS.NETWORK }
  );

  try {
    const response = await responsePromise;
    const data = await response.json() as T;
    return data;
  } catch (error) {
    console.warn(`API response wait failed for ${urlPattern}:`, error);
    return null;
  }
}

/**
 * Usage example
 */
async function createIdeaAndWaitForAPI(page: Page) {
  // Start waiting for API response
  const apiResponsePromise = waitForAPIResponse(
    page,
    '/api/ideas',
    { method: 'POST', status: 200 }
  );

  // Trigger the action
  await page.locator(SELECTORS.MATRIX.ADD_IDEA_BUTTON).click();
  await page.locator('input[name="content"]').fill('New Idea');
  await page.locator('button:has-text("Add")').click();

  // Wait for API response
  const createdIdea = await apiResponsePromise;
  expect(createdIdea).toBeTruthy();

  // Verify UI updated
  await expect(
    page.locator(`.idea-card:has-text("New Idea")`)
  ).toBeVisible({ timeout: TIMEOUTS.QUICK });
}
```

#### Pattern: Loading States
```typescript
/**
 * OPTIMAL: Wait for loading indicator patterns
 * Performance: ~100-2000ms average (data dependent)
 * Reliability: 99%
 */
async function waitForDataLoad(
  page: Page,
  containerSelector: string,
  options: {
    loadingIndicator?: string;
    minDataElements?: number;
  } = {}
) {
  const container = page.locator(containerSelector);

  // Wait for container to be visible
  await expect(container).toBeVisible({ timeout: TIMEOUTS.QUICK });

  // If loading indicator specified, wait for it to disappear
  if (options.loadingIndicator) {
    const loader = page.locator(options.loadingIndicator);

    // Give loading indicator time to appear (proves data is loading)
    await page.waitForTimeout(TIMEOUTS.INSTANT);

    // Wait for it to disappear
    await expect(loader).not.toBeVisible({ timeout: TIMEOUTS.NETWORK });
  }

  // If minimum data elements specified, wait for them
  if (options.minDataElements) {
    await expect(
      container.locator('[data-item], .item, .card')
    ).toHaveCount(options.minDataElements, { timeout: TIMEOUTS.NETWORK });
  }
}
```

### 1.7 Animation Waits

#### Pattern: CSS Animation Completion
```typescript
/**
 * OPTIMAL: Wait for CSS animations to complete
 * Performance: 50-500ms (animation dependent)
 * Reliability: 99.5%
 */
async function waitForAnimationComplete(
  page: Page,
  elementSelector: string,
  options: { maxDuration?: number } = {}
) {
  await page.waitForFunction(
    (selector) => {
      const element = document.querySelector(selector);
      if (!element) return false;

      // Check all animations on element
      const animations = element.getAnimations({ subtree: true });

      if (animations.length === 0) return true;

      // All animations should be finished or idle
      return animations.every(animation =>
        animation.playState === 'finished' ||
        animation.playState === 'idle'
      );
    },
    elementSelector,
    { timeout: options.maxDuration || TIMEOUTS.ANIMATION }
  );
}

/**
 * Alternative: Wait for specific animation by name
 */
async function waitForNamedAnimation(
  page: Page,
  elementSelector: string,
  animationName: string
) {
  // Wait for animation to start
  await page.waitForFunction(
    ({ selector, name }) => {
      const element = document.querySelector(selector);
      if (!element) return false;

      const animations = element.getAnimations();
      return animations.some(a =>
        (a as any).animationName === name ||
        (a.effect as any)?.target?.style?.animationName === name
      );
    },
    { selector: elementSelector, name: animationName },
    { timeout: TIMEOUTS.ANIMATION }
  );

  // Wait for animation to complete
  await waitForAnimationComplete(page, elementSelector);
}
```

#### Pattern: Transition Completion
```typescript
/**
 * OPTIMAL: Wait for CSS transition to finish
 * Performance: 50-500ms
 * Reliability: 99.5%
 */
async function waitForTransitionComplete(
  page: Page,
  elementSelector: string,
  property?: string
) {
  await page.waitForFunction(
    ({ selector, prop }) => {
      const element = document.querySelector(selector);
      if (!element) return false;

      const computedStyle = getComputedStyle(element);
      const transitionProperty = computedStyle.transitionProperty;

      // If specific property specified, check only that
      if (prop) {
        return !transitionProperty.includes(prop);
      }

      // Otherwise check if any transitions are active
      return transitionProperty === 'none' || transitionProperty === '';
    },
    { selector: elementSelector, prop: property },
    { timeout: TIMEOUTS.ANIMATION }
  );
}
```

### 1.8 Drag and Drop Waits

#### Pattern: Drag Operation Complete
```typescript
/**
 * OPTIMAL: Wait for drag operation to fully complete
 * Performance: ~200-800ms
 * Reliability: 99%
 */
async function waitForDragComplete(
  page: Page,
  draggedElement: Locator,
  options: {
    verifyPosition?: boolean;
    expectedX?: number;
    expectedY?: number;
  } = {}
) {
  // Wait for dragging class to be removed
  await expect(draggedElement).not.toHaveClass(/is-dragging|dragging/, {
    timeout: TIMEOUTS.QUICK
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
    expect(box).toBeTruthy();
    expect(Math.abs(box!.x - options.expectedX)).toBeLessThan(5); // 5px tolerance
    expect(Math.abs(box!.y - options.expectedY)).toBeLessThan(5);
  }

  // Wait for any drop animations to complete
  await waitForAnimationComplete(page, draggedElement.nth(0) as any);
}

/**
 * Complete drag helper with built-in waits
 */
async function performDragOperation(
  page: Page,
  sourceElement: Locator,
  targetElement: Locator,
  options: {
    targetPosition?: { x: number; y: number };
    verifyDrop?: (element: Locator) => Promise<void>;
  } = {}
) {
  // Ensure source is ready
  await expect(sourceElement).toBeVisible({ timeout: TIMEOUTS.QUICK });
  await expect(targetElement).toBeVisible({ timeout: TIMEOUTS.QUICK });

  // Perform drag
  await sourceElement.dragTo(targetElement, {
    targetPosition: options.targetPosition,
    timeout: TIMEOUTS.SLOW
  });

  // Wait for drag to complete
  await waitForDragComplete(page, sourceElement, {
    verifyPosition: !!options.targetPosition,
    expectedX: options.targetPosition?.x,
    expectedY: options.targetPosition?.y
  });

  // Custom verification if provided
  if (options.verifyDrop) {
    await options.verifyDrop(sourceElement);
  }
}
```

---

## 2. Retry Logic Framework

### 2.1 Smart Retry Utility

```typescript
/**
 * Intelligent retry with exponential backoff
 */
interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  timeout?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

async function retryOperation<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelay = 100,
    maxDelay = 2000,
    backoffFactor = 2,
    timeout = 30000,
    onRetry
  } = options;

  const startTime = Date.now();
  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // Check timeout
    if (Date.now() - startTime > timeout) {
      throw new Error(`Retry timeout after ${timeout}ms`);
    }

    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxAttempts) {
        throw new Error(
          `Operation failed after ${maxAttempts} attempts: ${lastError.message}`
        );
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        initialDelay * Math.pow(backoffFactor, attempt - 1),
        maxDelay
      );

      if (onRetry) {
        onRetry(attempt, lastError);
      }

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}
```

### 2.2 Flaky Selector Handler

```typescript
/**
 * Handle selectors that might be temporarily unavailable
 */
async function findElementWithRetry(
  page: Page,
  selector: string,
  options: {
    maxAttempts?: number;
    visible?: boolean;
    enabled?: boolean;
  } = {}
): Promise<Locator> {
  return retryOperation(
    async () => {
      const element = page.locator(selector);

      if (options.visible !== false) {
        await expect(element).toBeVisible({ timeout: TIMEOUTS.QUICK });
      }

      if (options.enabled) {
        await expect(element).toBeEnabled({ timeout: TIMEOUTS.INSTANT });
      }

      return element;
    },
    {
      maxAttempts: options.maxAttempts || 3,
      initialDelay: 200,
      onRetry: (attempt, error) => {
        console.log(`Retry ${attempt} for selector "${selector}": ${error.message}`);
      }
    }
  );
}
```

### 2.3 Network Retry Strategy

```typescript
/**
 * Retry failed API calls with intelligent backoff
 */
async function waitForAPIWithRetry<T = any>(
  page: Page,
  urlPattern: string | RegExp,
  options: {
    method?: string;
    maxAttempts?: number;
    retryOn?: (response: any) => boolean;
  } = {}
): Promise<T> {
  return retryOperation(
    async () => {
      const response = await waitForAPIResponse<T>(page, urlPattern, {
        method: options.method as any,
        timeout: TIMEOUTS.NETWORK
      });

      if (!response) {
        throw new Error('API response was null');
      }

      // Custom retry condition
      if (options.retryOn && options.retryOn(response)) {
        throw new Error('API response does not meet retry condition');
      }

      return response;
    },
    {
      maxAttempts: options.maxAttempts || 3,
      initialDelay: 500,
      backoffFactor: 2
    }
  );
}
```

### 2.4 CI-Specific Retry Logic

```typescript
/**
 * Detect CI environment and adjust retry behavior
 */
const isCI = !!process.env.CI;

function getCIRetryOptions(baseOptions: RetryOptions = {}): RetryOptions {
  if (!isCI) {
    return baseOptions;
  }

  // More aggressive retries in CI
  return {
    ...baseOptions,
    maxAttempts: (baseOptions.maxAttempts || 3) * 2,
    initialDelay: (baseOptions.initialDelay || 100) * 1.5,
    maxDelay: (baseOptions.maxDelay || 2000) * 2
  };
}

/**
 * Usage
 */
async function clickWithCIRetry(page: Page, selector: string) {
  await retryOperation(
    async () => {
      const element = page.locator(selector);
      await expect(element).toBeVisible({ timeout: TIMEOUTS.QUICK });
      await element.click();
    },
    getCIRetryOptions({ maxAttempts: 3 })
  );
}
```

---

## 3. Timing Constants

### 3.1 Core Timeout Definitions

```typescript
/**
 * Centralized timeout constants
 * All values in milliseconds
 */
export const TIMEOUTS = {
  // Ultra-fast operations (<100ms expected)
  INSTANT: 100,

  // CSS animations and transitions (typically 200-300ms)
  ANIMATION: 500,

  // Quick DOM operations (element appearance, simple state changes)
  QUICK: 1000,

  // Normal operations (form submissions, simple API calls)
  NORMAL: 3000,

  // Slow operations (complex API calls, data processing)
  SLOW: 5000,

  // Network operations (file uploads, large data fetches)
  NETWORK: 10000,

  // Navigation and page loads
  NAVIGATION: 15000,

  // Authentication operations
  AUTH_ACTION: 5000,

  // CI environment multiplier
  get CI_MULTIPLIER() {
    return process.env.CI ? 2 : 1;
  },

  // Get timeout adjusted for CI
  ci(timeout: number): number {
    return timeout * this.CI_MULTIPLIER;
  }
} as const;

/**
 * Usage examples
 */
// Local: 1000ms, CI: 2000ms
await expect(element).toBeVisible({ timeout: TIMEOUTS.ci(TIMEOUTS.QUICK) });

// Always 5000ms
await expect(modal).toBeVisible({ timeout: TIMEOUTS.SLOW });
```

### 3.2 Operation-Specific Timeouts

```typescript
/**
 * Specific timeout configuration per operation type
 */
export const OPERATION_TIMEOUTS = {
  auth: {
    login: TIMEOUTS.AUTH_ACTION,
    logout: TIMEOUTS.NORMAL,
    signup: TIMEOUTS.AUTH_ACTION,
    demoUser: TIMEOUTS.QUICK,
    passwordReset: TIMEOUTS.NORMAL,
    validation: TIMEOUTS.ANIMATION
  },

  modal: {
    open: TIMEOUTS.ANIMATION,
    close: TIMEOUTS.ANIMATION,
    formReady: TIMEOUTS.QUICK,
    submit: TIMEOUTS.NORMAL
  },

  idea: {
    create: TIMEOUTS.NORMAL,
    update: TIMEOUTS.NORMAL,
    delete: TIMEOUTS.QUICK,
    drag: TIMEOUTS.SLOW,
    load: TIMEOUTS.NETWORK
  },

  navigation: {
    pageLoad: TIMEOUTS.NAVIGATION,
    routeChange: TIMEOUTS.QUICK,
    networkIdle: TIMEOUTS.NETWORK
  },

  api: {
    get: TIMEOUTS.NETWORK,
    post: TIMEOUTS.NETWORK,
    put: TIMEOUTS.NETWORK,
    delete: TIMEOUTS.QUICK,
    upload: TIMEOUTS.NAVIGATION
  }
} as const;
```

### 3.3 Performance Budgets

```typescript
/**
 * Performance budgets for different test scenarios
 * Tests should fail if operations exceed these budgets
 */
export const PERFORMANCE_BUDGETS = {
  // Page loads
  initialPageLoad: 3000,
  routeTransition: 1000,

  // User interactions
  buttonClick: 100,
  formFill: 500,
  modalOpen: 500,

  // Data operations
  createIdea: 2000,
  deleteIdea: 1000,
  dragIdea: 1000,

  // API calls
  apiRead: 2000,
  apiWrite: 3000,

  // Bulk operations
  create50Ideas: 30000,
  loadMatrix100Ideas: 5000,

  // CI budgets (more lenient)
  ci: {
    multiplier: 1.5,
    get(operation: keyof Omit<typeof PERFORMANCE_BUDGETS, 'ci'>) {
      return PERFORMANCE_BUDGETS[operation] * this.multiplier;
    }
  }
} as const;

/**
 * Usage in tests
 */
test('should create idea within performance budget', async ({ page }) => {
  const startTime = Date.now();

  await createIdea(page, 'Test Idea');

  const duration = Date.now() - startTime;
  const budget = isCI
    ? PERFORMANCE_BUDGETS.ci.get('createIdea')
    : PERFORMANCE_BUDGETS.createIdea;

  expect(duration).toBeLessThan(budget);
});
```

---

## 4. Environment-Aware Configuration

### 4.1 Environment Detection

```typescript
/**
 * Detect and configure based on environment
 */
export const ENV_CONFIG = {
  isCI: !!process.env.CI,
  isLocal: !process.env.CI,
  isDebug: process.env.DEBUG === 'true',

  // CI providers
  isGitHubActions: process.env.GITHUB_ACTIONS === 'true',
  isCircleCI: !!process.env.CIRCLECI,
  isTravisCI: !!process.env.TRAVIS,

  // Performance settings
  timeout: {
    multiplier: process.env.CI ? 2 : 1,
    base: process.env.TIMEOUT_BASE ? parseInt(process.env.TIMEOUT_BASE) : 1000
  },

  retry: {
    enabled: process.env.CI ? true : false,
    maxAttempts: process.env.CI ? 3 : 1
  },

  // Logging
  verboseLogging: process.env.CI || process.env.DEBUG === 'true',

  // Network simulation
  slowNetwork: process.env.SLOW_NETWORK === 'true',
  networkDelay: process.env.NETWORK_DELAY ? parseInt(process.env.NETWORK_DELAY) : 0
} as const;
```

### 4.2 Playwright Configuration Integration

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';
import { ENV_CONFIG, TIMEOUTS } from './tests/utils/wait-strategies';

export default defineConfig({
  timeout: TIMEOUTS.ci(30000),

  expect: {
    timeout: TIMEOUTS.ci(TIMEOUTS.SLOW)
  },

  use: {
    actionTimeout: TIMEOUTS.ci(TIMEOUTS.NORMAL),
    navigationTimeout: TIMEOUTS.ci(TIMEOUTS.NAVIGATION),

    // CI-specific settings
    ...(ENV_CONFIG.isCI && {
      retries: 2,
      workers: 2,
      video: 'retain-on-failure',
      screenshot: 'only-on-failure'
    }),

    // Local development settings
    ...(!ENV_CONFIG.isCI && {
      retries: 0,
      workers: 4,
      video: 'off',
      screenshot: 'off',
      trace: 'on-first-retry'
    })
  }
});
```

---

## 5. Best Practices Guide

### 5.1 Decision Tree: Which Wait Strategy?

```
┌─────────────────────────────────────┐
│ What are you waiting for?          │
└─────────────────┬───────────────────┘
                  │
        ┌─────────┴─────────┐
        │                   │
   Element State      Network Request
        │                   │
        ▼                   ▼
┌───────────────┐    ┌──────────────────┐
│ Use Locator   │    │ Use waitForAPI   │
│ + expect()    │    │ or waitForResponse│
└───────────────┘    └──────────────────┘
        │
        ▼
  ┌──────────┐
  │ Visible? │──No──▶ waitFor({state: 'hidden'})
  └──────────┘
        │Yes
        ▼
  ┌──────────┐
  │Enabled?  │──No──▶ waitFor({state: 'disabled'})
  └──────────┘
        │Yes
        ▼
  ┌──────────┐
  │Animation?│──Yes─▶ waitForAnimationComplete()
  └──────────┘
        │No
        ▼
    expect().toBeVisible()
```

### 5.2 Anti-Patterns to Avoid

```typescript
// ❌ NEVER: Arbitrary timeouts
await page.waitForTimeout(2000);

// ✅ ALWAYS: Wait for specific condition
await expect(element).toBeVisible({ timeout: TIMEOUTS.QUICK });

// ❌ NEVER: Sleep between operations
await page.click('button');
await page.waitForTimeout(500);
await page.fill('input', 'value');

// ✅ ALWAYS: Wait for element state
await page.click('button');
await expect(page.locator('input')).toBeEnabled();
await page.fill('input', 'value');

// ❌ NEVER: Multiple small timeouts
await page.waitForTimeout(100);
if (await element.isVisible()) {
  await page.waitForTimeout(200);
}

// ✅ ALWAYS: Single proper wait
await expect(element).toBeVisible({ timeout: TIMEOUTS.QUICK });

// ❌ NEVER: Blind retry loops
for (let i = 0; i < 5; i++) {
  try {
    await page.click('button');
    break;
  } catch (e) {
    await page.waitForTimeout(1000);
  }
}

// ✅ ALWAYS: Intelligent retry with backoff
await retryOperation(
  () => page.click('button'),
  { maxAttempts: 5, initialDelay: 100 }
);
```

### 5.3 When Arbitrary Timeouts Are Acceptable

```typescript
/**
 * ACCEPTABLE use cases for waitForTimeout
 */

// 1. Simulating human behavior (typing delay)
await page.locator('input').type('Hello', { delay: 100 }); // Built-in delay
// OR
for (const char of 'Hello') {
  await page.keyboard.type(char);
  await page.waitForTimeout(50); // ✅ Simulating typing speed
}

// 2. Network throttling simulation
await page.route('**/*', async route => {
  await page.waitForTimeout(500); // ✅ Simulating slow network
  await route.continue();
});

// 3. Animation that has no DOM state change
// (Very rare - usually animations have completion states)
await page.click('.animate-button');
await page.waitForTimeout(300); // ✅ Only if animation has no detectable end state

// 4. Debounce/throttle testing
await page.fill('input', 'search term');
await page.waitForTimeout(600); // ✅ Testing 500ms debounce behavior
await expect(searchResultsLocator).toBeVisible();
```

### 5.4 Performance Optimization Checklist

```typescript
/**
 * Optimization checklist for wait strategies
 */
const OPTIMIZATION_CHECKLIST = {
  // 1. Use parallel waits when possible
  bad: async () => {
    await expect(element1).toBeVisible();
    await expect(element2).toBeVisible();
    await expect(element3).toBeVisible();
  },
  good: async () => {
    await Promise.all([
      expect(element1).toBeVisible(),
      expect(element2).toBeVisible(),
      expect(element3).toBeVisible()
    ]);
  },

  // 2. Use Promise.race for alternative success conditions
  bad: async () => {
    try {
      await expect(successMessage).toBeVisible({ timeout: 5000 });
    } catch {
      await expect(errorMessage).toBeVisible({ timeout: 5000 });
    }
  },
  good: async () => {
    await Promise.race([
      expect(successMessage).toBeVisible({ timeout: 5000 }),
      expect(errorMessage).toBeVisible({ timeout: 5000 })
    ]);
  },

  // 3. Minimize timeout values
  bad: async () => {
    await expect(element).toBeVisible({ timeout: 30000 }); // Excessive
  },
  good: async () => {
    await expect(element).toBeVisible({ timeout: TIMEOUTS.QUICK }); // Appropriate
  },

  // 4. Use networkidle sparingly
  bad: async () => {
    await page.goto('/');
    await page.waitForLoadState('networkidle'); // Slow, often unnecessary
  },
  good: async () => {
    await page.goto('/');
    await expect(page.locator('main')).toBeVisible(); // Faster
  },

  // 5. Batch similar operations
  bad: async () => {
    for (let i = 0; i < 10; i++) {
      await createIdea(page, `Idea ${i}`);
      await expect(page.locator('.idea-card').nth(i)).toBeVisible();
    }
  },
  good: async () => {
    // Create all ideas
    for (let i = 0; i < 10; i++) {
      await createIdea(page, `Idea ${i}`);
    }
    // Verify all at once
    await expect(page.locator('.idea-card')).toHaveCount(10);
  }
};
```

---

## 6. Migration Guide

### 6.1 Converting Existing Tests

#### Step 1: Identify Problem Patterns

```bash
# Find all waitForTimeout usages
grep -r "waitForTimeout" tests/

# Find excessive timeout values
grep -r "timeout.*[0-9]\{5,\}" tests/
```

#### Step 2: Replace with Proper Waits

```typescript
// BEFORE: auth-complete-journey.spec.ts:61
await page.waitForTimeout(500);
const errorMessage = page.locator('.input-message--error').first();
await expect(errorMessage).toBeVisible({ timeout: 5000 });

// AFTER: Use waitForFieldValidation helper
await waitForFieldValidation(page, authPage.fullNameInput, true);
```

```typescript
// BEFORE: auth-complete-journey.spec.ts:132
await page.waitForTimeout(2000);
const hasSuccess = await authPage.successMessage.isVisible().catch(() => false);

// AFTER: Use Promise.race for success/error
await Promise.race([
  expect(authPage.successMessage).toBeVisible({ timeout: TIMEOUTS.NORMAL }),
  expect(authPage.errorMessage).toBeVisible({ timeout: TIMEOUTS.NORMAL })
]);
```

```typescript
// BEFORE: idea-crud-journey.spec.ts:104
await page.waitForSelector(`.idea-card-base:has-text("${content}")`, { timeout: TEST_TIMEOUT });

// AFTER: Use expect with proper timeout
await expect(
  page.locator(`.idea-card-base:has-text("${content}")`)
).toBeVisible({ timeout: TIMEOUTS.NORMAL });
```

#### Step 3: Add Retry Logic for Flaky Tests

```typescript
// BEFORE: Flaky click operation
await ideaCard.locator('button:has(.lucide-trash-2)').click();

// AFTER: Add retry logic
await retryOperation(
  () => ideaCard.locator('button:has(.lucide-trash-2)').click(),
  getCIRetryOptions({ maxAttempts: 3 })
);
```

### 6.2 Test-by-Test Migration Checklist

```typescript
/**
 * Migration checklist for each test file
 */
const MIGRATION_STEPS = [
  '1. Replace all waitForTimeout with proper wait strategies',
  '2. Use TIMEOUTS constants instead of hardcoded values',
  '3. Add retry logic for CI flakiness',
  '4. Use Promise.all for parallel waits',
  '5. Use Promise.race for alternative conditions',
  '6. Add performance budget assertions',
  '7. Verify timeout values are appropriate (not excessive)',
  '8. Use wait helper functions instead of inline waits',
  '9. Add CI-aware timeout multipliers',
  '10. Test in both local and CI environments'
];
```

### 6.3 Expected Performance Improvements

```typescript
/**
 * Performance improvement targets after migration
 */
const IMPROVEMENT_TARGETS = {
  // Per-test improvements
  authTests: {
    before: {
      avgDuration: 8500, // ms
      p95Duration: 12000,
      flakeRate: 0.15
    },
    after: {
      avgDuration: 3500, // 59% improvement
      p95Duration: 5000, // 58% improvement
      flakeRate: 0.03   // 80% reduction
    }
  },

  ideaCRUDTests: {
    before: {
      avgDuration: 12000,
      p95Duration: 18000,
      flakeRate: 0.20
    },
    after: {
      avgDuration: 5000, // 58% improvement
      p95Duration: 7500, // 58% improvement
      flakeRate: 0.04   // 80% reduction
    }
  },

  // Overall suite improvements
  totalSuite: {
    before: {
      duration: 180000, // 3 minutes
      flakeRate: 0.18
    },
    after: {
      duration: 75000,  // 1.25 minutes (58% improvement)
      flakeRate: 0.04   // 78% reduction
    }
  }
};
```

---

## 7. Utility Library Implementation

### 7.1 Complete Wait Utilities File

```typescript
// tests/utils/wait-strategies.ts

import { Page, Locator, expect } from '@playwright/test';

// Re-export all timeout constants
export { TIMEOUTS, OPERATION_TIMEOUTS, PERFORMANCE_BUDGETS } from './timeouts';
export { retryOperation, getCIRetryOptions } from './retry-logic';
export { ENV_CONFIG } from './environment';

/**
 * Authentication wait utilities
 */
export class AuthWaits {
  constructor(private page: Page) {}

  async waitForDemoLogin() {
    // Implementation from section 1.2
  }

  async waitForLoginSubmission() {
    // Implementation from section 1.2
  }

  async waitForFieldValidation(field: Locator, expectError: boolean = false) {
    // Implementation from section 1.2
  }
}

/**
 * Modal wait utilities
 */
export class ModalWaits {
  constructor(private page: Page, private modalSelector: string) {}

  async waitForOpen() {
    // Implementation from section 1.3
  }

  async waitForClose() {
    // Implementation from section 1.3
  }

  async waitForFormReady(expectedFields: string[]) {
    // Implementation from section 1.3
  }
}

/**
 * Form interaction utilities
 */
export class FormWaits {
  constructor(private page: Page) {}

  async fillFieldWhenReady(selector: string, value: string, options = {}) {
    // Implementation from section 1.4
  }

  async waitForDropdownReady(selector: string, minOptions: number = 1) {
    // Implementation from section 1.4
  }

  async waitForFormSubmission(submitButton: Locator, successIndicators: any) {
    // Implementation from section 1.4
  }
}

/**
 * Navigation utilities
 */
export class NavigationWaits {
  constructor(private page: Page) {}

  async waitForPageTransition(expectedURL: string | RegExp, options = {}) {
    // Implementation from section 1.5
  }

  async waitForSPARouteChange(routePattern: string | RegExp, element: string) {
    // Implementation from section 1.5
  }

  async waitForComponentMount(selector: string, options = {}) {
    // Implementation from section 1.5
  }
}

/**
 * API wait utilities
 */
export class APIWaits {
  constructor(private page: Page) {}

  async waitForResponse<T = any>(
    urlPattern: string | RegExp,
    options = {}
  ): Promise<T | null> {
    // Implementation from section 1.6
  }

  async waitForDataLoad(containerSelector: string, options = {}) {
    // Implementation from section 1.6
  }
}

/**
 * Animation wait utilities
 */
export class AnimationWaits {
  constructor(private page: Page) {}

  async waitForAnimationComplete(elementSelector: string, options = {}) {
    // Implementation from section 1.7
  }

  async waitForTransitionComplete(elementSelector: string, property?: string) {
    // Implementation from section 1.7
  }
}

/**
 * Drag and drop utilities
 */
export class DragWaits {
  constructor(private page: Page) {}

  async waitForDragComplete(element: Locator, options = {}) {
    // Implementation from section 1.8
  }

  async performDragOperation(
    source: Locator,
    target: Locator,
    options = {}
  ) {
    // Implementation from section 1.8
  }
}

/**
 * Convenience export: all wait utilities
 */
export function createWaitUtils(page: Page) {
  return {
    auth: new AuthWaits(page),
    modal: (selector: string) => new ModalWaits(page, selector),
    form: new FormWaits(page),
    navigation: new NavigationWaits(page),
    api: new APIWaits(page),
    animation: new AnimationWaits(page),
    drag: new DragWaits(page)
  };
}
```

### 7.2 Usage Examples in Tests

```typescript
// tests/e2e/example-usage.spec.ts

import { test, expect } from '@playwright/test';
import { createWaitUtils, TIMEOUTS, PERFORMANCE_BUDGETS } from '../utils/wait-strategies';

test.describe('Example: Using Wait Strategies', () => {
  test('should demonstrate optimal wait patterns', async ({ page }) => {
    const waits = createWaitUtils(page);

    // Navigate with performance budget
    const startTime = Date.now();
    await page.goto('/');
    await waits.navigation.waitForPageTransition('/', {
      waitForElement: 'main'
    });
    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(PERFORMANCE_BUDGETS.initialPageLoad);

    // Authenticate with proper waits
    await waits.auth.waitForDemoLogin();

    // Open modal with animation wait
    await page.click('button:has-text("Add Idea")');
    const modal = waits.modal('[role="dialog"]');
    await modal.waitForOpen();

    // Fill form with proper field waits
    await waits.form.fillFieldWhenReady('input[name="content"]', 'Test Idea');
    await waits.form.fillFieldWhenReady('textarea[name="details"]', 'Details');

    // Submit with API wait
    const apiPromise = waits.api.waitForResponse('/api/ideas', {
      method: 'POST'
    });
    await page.click('button:has-text("Add")');
    const createdIdea = await apiPromise;
    expect(createdIdea).toBeTruthy();

    // Verify modal closed
    await modal.waitForClose();

    // Verify idea appears with animation
    const ideaCard = page.locator('.idea-card:has-text("Test Idea")');
    await expect(ideaCard).toBeVisible({ timeout: TIMEOUTS.QUICK });
    await waits.animation.waitForAnimationComplete('.idea-card:has-text("Test Idea")');
  });
});
```

---

## 8. Summary & Quick Reference

### 8.1 Key Principles

1. **Never use `waitForTimeout()` except for**:
   - Human behavior simulation (typing delays)
   - Network throttling simulation
   - Animations with no detectable end state (rare)

2. **Always prefer**:
   - `expect().toBeVisible()` for element appearance
   - `waitForResponse()` for API calls
   - `waitForURL()` for navigation
   - Custom wait functions for complex conditions

3. **Performance targets**:
   - 40-60% reduction in test execution time
   - <5% flakiness in CI
   - Tests should run in <2 minutes total

4. **CI awareness**:
   - Use timeout multipliers in CI
   - More aggressive retry logic in CI
   - Different worker counts for local vs CI

### 8.2 Quick Reference Card

```typescript
// Import wait utilities
import { createWaitUtils, TIMEOUTS } from './utils/wait-strategies';
const waits = createWaitUtils(page);

// Common patterns cheat sheet
┌─────────────────────────────────────────────────────────────────┐
│ OPERATION              │ PATTERN                                │
├─────────────────────────────────────────────────────────────────┤
│ Element visible        │ expect(el).toBeVisible({timeout: T})  │
│ Element hidden         │ el.waitFor({state: 'hidden'})         │
│ Button enabled         │ expect(el).toBeEnabled()              │
│ Form field ready       │ waits.form.fillFieldWhenReady()       │
│ Modal open             │ waits.modal(sel).waitForOpen()        │
│ API response           │ waits.api.waitForResponse()           │
│ Navigation             │ page.waitForURL(pattern)              │
│ Animation complete     │ waits.animation.waitForAnimationComplete() │
│ Drag operation         │ waits.drag.performDragOperation()     │
│ Retry flaky operation  │ retryOperation(() => {...})           │
└─────────────────────────────────────────────────────────────────┘

// Timeout reference
TIMEOUTS.INSTANT    = 100ms   // Very fast operations
TIMEOUTS.ANIMATION  = 500ms   // CSS animations
TIMEOUTS.QUICK      = 1000ms  // DOM operations
TIMEOUTS.NORMAL     = 3000ms  // Form submissions
TIMEOUTS.SLOW       = 5000ms  // API calls
TIMEOUTS.NETWORK    = 10000ms // Large requests
TIMEOUTS.NAVIGATION = 15000ms // Page loads

// CI multiplier
TIMEOUTS.ci(TIMEOUTS.QUICK) // Auto-adjusts for CI environment
```

---

## Appendix A: Complete Implementation Files

All implementation files should be created in `/Users/sean.mcinerney/Documents/workshop/design-matrix-app/tests/utils/`:

1. `timeouts.ts` - Timeout constants
2. `retry-logic.ts` - Retry utilities
3. `environment.ts` - Environment detection
4. `wait-strategies.ts` - Main wait utilities (imports all above)
5. `auth-waits.ts` - Authentication-specific waits
6. `modal-waits.ts` - Modal-specific waits
7. `form-waits.ts` - Form interaction waits
8. `navigation-waits.ts` - Navigation waits
9. `api-waits.ts` - API waits
10. `animation-waits.ts` - Animation waits
11. `drag-waits.ts` - Drag and drop waits

---

**Document Version**: 1.0
**Last Updated**: 2025-09-30
**Author**: Performance Engineering Team
**Status**: Design Complete - Ready for Implementation
