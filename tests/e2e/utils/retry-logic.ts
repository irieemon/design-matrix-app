/**
 * Retry logic utilities for E2E tests
 *
 * Provides intelligent retry mechanisms with exponential backoff
 * for handling flaky operations in CI environments.
 *
 * Based on E2E Wait Strategy Design v1.0
 * @see claudedocs/E2E_WAIT_STRATEGY_DESIGN.md
 */

import { Page, Locator, expect } from '@playwright/test';
import { TIMEOUTS } from './timeouts';

/**
 * Configuration options for retry operations
 */
export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts?: number;
  /** Initial delay in milliseconds (default: 100) */
  initialDelay?: number;
  /** Maximum delay in milliseconds (default: 2000) */
  maxDelay?: number;
  /** Backoff multiplier for exponential backoff (default: 2) */
  backoffFactor?: number;
  /** Total timeout for all attempts in milliseconds (default: 30000) */
  timeout?: number;
  /** Callback invoked on each retry attempt */
  onRetry?: (attempt: number, error: Error) => void;
}

/**
 * Retry an operation with exponential backoff
 *
 * Automatically retries failed operations with increasing delays,
 * ideal for handling temporary failures in CI environments.
 *
 * @param operation - Async operation to retry
 * @param options - Retry configuration options
 * @returns Result from successful operation
 * @throws Error if all retry attempts fail or timeout is exceeded
 *
 * @example
 * ```typescript
 * // Retry a flaky element interaction
 * await retryOperation(
 *   async () => {
 *     const button = page.locator('button.flaky');
 *     await button.waitFor({ state: 'visible', timeout: 2000 });
 *     await button.click();
 *   },
 *   {
 *     maxAttempts: 3,
 *     initialDelay: 100,
 *     onRetry: (attempt, error) => {
 *       console.log(`Retry ${attempt}: ${error.message}`);
 *     }
 *   }
 * );
 * ```
 */
export async function retryOperation<T>(
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

/**
 * Retry operation with increasing timeout on each attempt
 *
 * Useful when operations may legitimately take longer than expected
 * but you want to fail fast on the first attempt.
 *
 * @param operation - Operation that accepts a timeout parameter
 * @param options - Retry configuration with timeout increment
 * @returns Result from successful operation
 *
 * @example
 * ```typescript
 * await retryWithIncreasingTimeout(
 *   async (timeout) => {
 *     await page.waitForSelector('.slow-element', { timeout });
 *   },
 *   {
 *     maxAttempts: 3,
 *     initialTimeout: 1000,
 *     timeoutIncrement: 2000
 *   }
 * );
 * // First attempt: 1000ms timeout
 * // Second attempt: 3000ms timeout
 * // Third attempt: 5000ms timeout
 * ```
 */
export async function retryWithIncreasingTimeout<T>(
  operation: (timeout: number) => Promise<T>,
  options: {
    maxAttempts?: number;
    initialTimeout?: number;
    timeoutIncrement?: number;
    onRetry?: (attempt: number, timeout: number, error: Error) => void;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialTimeout = 1000,
    timeoutIncrement = 2000,
    onRetry
  } = options;

  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const currentTimeout = initialTimeout + (timeoutIncrement * (attempt - 1));

    try {
      return await operation(currentTimeout);
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxAttempts) {
        throw new Error(
          `Operation failed after ${maxAttempts} attempts with timeout ${currentTimeout}ms: ${lastError.message}`
        );
      }

      if (onRetry) {
        onRetry(attempt, currentTimeout, lastError);
      }
    }
  }

  throw lastError!;
}

/**
 * Find element with retry logic for flaky selectors
 *
 * Handles selectors that may temporarily fail due to DOM updates,
 * animations, or network delays.
 *
 * @param page - Playwright page instance
 * @param selector - CSS selector or test ID
 * @param options - Configuration options
 * @returns Located element
 *
 * @example
 * ```typescript
 * // Retry finding an element that appears after animation
 * const element = await retryFindElement(
 *   page,
 *   '[data-testid="dynamic-content"]',
 *   {
 *     maxAttempts: 3,
 *     visible: true,
 *     enabled: true
 *   }
 * );
 * await element.click();
 * ```
 */
export async function retryFindElement(
  page: Page,
  selector: string,
  options: {
    maxAttempts?: number;
    visible?: boolean;
    enabled?: boolean;
    timeout?: number;
  } = {}
): Promise<Locator> {
  const { timeout = TIMEOUTS.QUICK } = options;

  return retryOperation(
    async () => {
      const element = page.locator(selector);

      if (options.visible !== false) {
        await expect(element).toBeVisible({ timeout });
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

/**
 * Retry API response wait with intelligent backoff
 *
 * Handles flaky API responses by retrying with exponential backoff.
 * Useful for operations that may fail due to network issues or race conditions.
 *
 * @param page - Playwright page instance
 * @param urlPattern - URL pattern to match
 * @param options - Configuration options
 * @returns Response data
 *
 * @example
 * ```typescript
 * // Wait for API response with retry
 * const data = await retryAPIResponse(
 *   page,
 *   '/api/ideas',
 *   {
 *     method: 'POST',
 *     maxAttempts: 3,
 *     retryOn: (response) => !response.id
 *   }
 * );
 * ```
 */
export async function retryAPIResponse<T = any>(
  page: Page,
  urlPattern: string | RegExp,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    maxAttempts?: number;
    retryOn?: (response: any) => boolean;
    timeout?: number;
  } = {}
): Promise<T> {
  return retryOperation(
    async () => {
      const responsePromise = page.waitForResponse(
        response => {
          const matchesURL = typeof urlPattern === 'string'
            ? response.url().includes(urlPattern)
            : urlPattern.test(response.url());

          const matchesMethod = !options.method || response.request().method() === options.method;

          return matchesURL && matchesMethod;
        },
        { timeout: options.timeout || TIMEOUTS.NETWORK }
      );

      const response = await responsePromise;
      const data = await response.json() as T;

      if (!data) {
        throw new Error('API response was null or undefined');
      }

      // Custom retry condition
      if (options.retryOn && options.retryOn(data)) {
        throw new Error('API response does not meet retry condition');
      }

      return data;
    },
    {
      maxAttempts: options.maxAttempts || 3,
      initialDelay: 500,
      backoffFactor: 2
    }
  );
}

/**
 * Detect CI environment and adjust retry behavior
 *
 * @returns True if running in CI environment
 */
export function isCI(): boolean {
  return !!process.env.CI;
}

/**
 * Get CI-adjusted retry options
 *
 * Provides more aggressive retry settings in CI environments
 * where flakiness is more common.
 *
 * @param baseOptions - Base retry options
 * @returns Options adjusted for CI if applicable
 *
 * @example
 * ```typescript
 * await retryOperation(
 *   async () => await clickButton(),
 *   getCIRetryOptions({ maxAttempts: 3 })
 * );
 * // Local: 3 attempts with 100ms initial delay
 * // CI: 6 attempts with 150ms initial delay
 * ```
 */
export function getCIRetryOptions(baseOptions: RetryOptions = {}): RetryOptions {
  if (!isCI()) {
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
 * Retry element click with CI-aware configuration
 *
 * Convenience function for retrying click operations with
 * automatic CI environment detection.
 *
 * @param page - Playwright page instance
 * @param selector - Element selector
 * @param options - Retry options
 *
 * @example
 * ```typescript
 * // Click with automatic retry in CI
 * await retryClick(page, 'button.submit-button');
 * ```
 */
export async function retryClick(
  page: Page,
  selector: string,
  options: Partial<RetryOptions> = {}
): Promise<void> {
  await retryOperation(
    async () => {
      const element = page.locator(selector);
      await expect(element).toBeVisible({ timeout: TIMEOUTS.QUICK });
      await element.click();
    },
    getCIRetryOptions({ maxAttempts: 3, ...options })
  );
}

/**
 * Retry element fill operation with validation
 *
 * Retries fill operation and validates the value was set correctly.
 * Useful for inputs that may lose focus or have validation issues.
 *
 * @param page - Playwright page instance
 * @param selector - Input selector
 * @param value - Value to fill
 * @param options - Retry options
 *
 * @example
 * ```typescript
 * // Fill input with retry and validation
 * await retryFill(page, 'input[name="email"]', 'test@example.com');
 * ```
 */
export async function retryFill(
  page: Page,
  selector: string,
  value: string,
  options: Partial<RetryOptions> = {}
): Promise<void> {
  await retryOperation(
    async () => {
      const field = page.locator(selector);
      await expect(field).toBeVisible({ timeout: TIMEOUTS.QUICK });
      await expect(field).toBeEnabled({ timeout: TIMEOUTS.INSTANT });

      await field.clear();
      await expect(field).toHaveValue('', { timeout: TIMEOUTS.INSTANT });

      await field.fill(value);
      await expect(field).toHaveValue(value, { timeout: TIMEOUTS.INSTANT });
    },
    getCIRetryOptions({ maxAttempts: 3, ...options })
  );
}
