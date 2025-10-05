import { Page, Locator, expect } from '@playwright/test';

/**
 * Visual Testing Utilities for Authentication Flow
 *
 * Comprehensive helpers for visual validation, flickering detection,
 * and state transition testing
 */

export interface VisualTestOptions {
  /** Name for screenshot baseline */
  name: string;
  /** Custom threshold for visual comparison (0-1) */
  threshold?: number;
  /** Maximum allowed pixel differences */
  maxDiffPixels?: number;
  /** Areas to mask in screenshots */
  mask?: Locator[];
  /** Wait conditions before capture */
  waitFor?: 'load' | 'networkidle' | 'domcontentloaded';
  /** Additional delay in ms */
  delay?: number;
}

export interface FlickerDetectionOptions {
  /** Number of sequential screenshots to capture */
  samples?: number;
  /** Interval between captures in ms */
  interval?: number;
  /** Threshold for detecting flicker (0-1) */
  threshold?: number;
  /** Element selector to focus on */
  element?: string;
}

export interface LayoutShiftOptions {
  /** Duration to monitor in ms */
  duration?: number;
  /** Expected layout shift score threshold */
  threshold?: number;
  /** Selectors to monitor for shifts */
  elements?: string[];
}

/**
 * Enhanced visual comparison with auth-specific considerations
 */
export class VisualTestHelper {
  constructor(private page: Page) {}

  /**
   * Capture and compare screenshot with comprehensive options
   */
  async compareScreenshot(options: VisualTestOptions) {
    const {
      name,
      threshold = 0.1,
      maxDiffPixels = 1000,
      mask = [],
      waitFor = 'networkidle',
      delay = 0
    } = options;

    // Wait for stability
    await this.page.waitForLoadState(waitFor);
    if (delay > 0) {
      await this.page.waitForTimeout(delay);
    }

    // Disable animations for consistent capture
    await this.page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-duration: 0s !important;
          animation-delay: 0s !important;
          transition-duration: 0s !important;
          transition-delay: 0s !important;
        }
        .animate-spin, .animate-pulse {
          animation: none !important;
        }
      `
    });

    // Small delay to let style changes apply
    await this.page.waitForTimeout(100);

    // Take screenshot with comparison
    await expect(this.page).toHaveScreenshot(`${name}.png`, {
      threshold,
      maxDiffPixels,
      mask,
      fullPage: false // Focus on viewport for faster comparison
    });
  }

  /**
   * Advanced flicker detection using multiple rapid screenshots
   */
  async detectFlickering(options: FlickerDetectionOptions = {}): Promise<{
    hasFlickering: boolean;
    maxVariation: number;
    samples: number;
    screenshots: string[];
  }> {
    const {
      samples = 5,
      interval = 100,
      threshold = 0.05,
      element
    } = options;

    console.log(`🔍 Flicker detection: ${samples} samples at ${interval}ms intervals`);

    const screenshots: Buffer[] = [];
    const screenshotPaths: string[] = [];

    // Target element or full page
    const target = element ? this.page.locator(element) : this.page;

    // Capture rapid sequential screenshots
    for (let i = 0; i < samples; i++) {
      const screenshot = await target.screenshot({
        animations: 'disabled'
      });
      screenshots.push(screenshot);
      screenshotPaths.push(`flicker-sample-${i}`);

      if (i < samples - 1) {
        await this.page.waitForTimeout(interval);
      }
    }

    // Compare screenshots to detect variation
    const variations: number[] = [];
    for (let i = 1; i < screenshots.length; i++) {
      const variation = await this.compareBuffers(screenshots[i - 1], screenshots[i]);
      variations.push(variation);
    }

    const maxVariation = Math.max(...variations);
    const hasFlickering = maxVariation > threshold;

    console.log(`📊 Flicker analysis: max variation ${(maxVariation * 100).toFixed(2)}%, threshold ${(threshold * 100).toFixed(2)}%`);

    return {
      hasFlickering,
      maxVariation,
      samples,
      screenshots: screenshotPaths
    };
  }

  /**
   * Monitor for layout shifts during auth transitions
   */
  async detectLayoutShift(options: LayoutShiftOptions = {}): Promise<{
    totalShift: number;
    entries: any[];
    exceedsThreshold: boolean;
  }> {
    const {
      duration = 3000,
      threshold = 0.1,
      elements = []
    } = options;

    console.log(`📐 Layout shift monitoring for ${duration}ms`);

    // Inject layout shift observer
    await this.page.addInitScript(() => {
      window.layoutShiftEntries = [];

      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          window.layoutShiftEntries.push({
            value: entry.value,
            sources: entry.sources?.map(source => ({
              node: source.node?.tagName || 'unknown',
              currentRect: source.currentRect,
              previousRect: source.previousRect
            })) || [],
            startTime: entry.startTime
          });
        }
      });

      observer.observe({ entryTypes: ['layout-shift'] });
    });

    // Monitor for specified duration
    const startTime = Date.now();
    while (Date.now() - startTime < duration) {
      await this.page.waitForTimeout(100);
    }

    // Get layout shift data
    const entries = await this.page.evaluate(() => window.layoutShiftEntries || []);
    const totalShift = entries.reduce((sum, entry) => sum + entry.value, 0);

    console.log(`📊 Layout shift analysis: ${totalShift.toFixed(4)} total shift`);

    return {
      totalShift,
      entries,
      exceedsThreshold: totalShift > threshold
    };
  }

  /**
   * Wait for auth-specific elements to be stable
   */
  async waitForAuthStability(timeout = 5000) {
    console.log('⏳ Waiting for auth UI stability...');

    // Wait for common auth elements to be visible and stable
    const authSelectors = [
      '.auth-screen',
      'form',
      '[type="email"]',
      '[type="password"]',
      'button[type="submit"]'
    ];

    for (const selector of authSelectors) {
      try {
        const element = this.page.locator(selector).first();
        await element.waitFor({ state: 'visible', timeout: timeout / authSelectors.length });

        // Wait for element to stop moving
        await this.waitForElementStability(element);
      } catch (error) {
        console.log(`⚠️ Auth element not found: ${selector} (non-critical)`);
      }
    }

    // Wait for animations to complete
    await this.page.waitForTimeout(300);
  }

  /**
   * Wait for specific element to be stable (no movement)
   */
  async waitForElementStability(element: Locator, timeout = 2000) {
    const startTime = Date.now();
    let lastBoundingBox: any = null;

    while (Date.now() - startTime < timeout) {
      try {
        const currentBoundingBox = await element.boundingBox();

        if (lastBoundingBox && currentBoundingBox) {
          const moved = (
            Math.abs(currentBoundingBox.x - lastBoundingBox.x) > 1 ||
            Math.abs(currentBoundingBox.y - lastBoundingBox.y) > 1 ||
            Math.abs(currentBoundingBox.width - lastBoundingBox.width) > 1 ||
            Math.abs(currentBoundingBox.height - lastBoundingBox.height) > 1
          );

          if (!moved) {
            // Element is stable
            return;
          }
        }

        lastBoundingBox = currentBoundingBox;
        await this.page.waitForTimeout(50);
      } catch (error) {
        // Element might not be visible yet
        await this.page.waitForTimeout(50);
      }
    }
  }

  /**
   * Compare two image buffers for similarity
   */
  private async compareBuffers(buffer1: Buffer, buffer2: Buffer): Promise<number> {
    // Simple buffer comparison - in production, use image comparison library
    const diff = Buffer.compare(buffer1, buffer2);
    if (diff === 0) return 0;

    // Calculate rough similarity based on buffer differences
    let differences = 0;
    const minLength = Math.min(buffer1.length, buffer2.length);

    for (let i = 0; i < minLength; i++) {
      if (buffer1[i] !== buffer2[i]) {
        differences++;
      }
    }

    return differences / minLength;
  }

  /**
   * Capture element-specific screenshot
   */
  async captureElement(selector: string, name: string) {
    const element = this.page.locator(selector);
    await element.waitFor({ state: 'visible' });
    await this.waitForElementStability(element);

    await expect(element).toHaveScreenshot(`element-${name}.png`, {
      threshold: 0.1
    });
  }

  /**
   * Capture form state with field highlighting
   */
  async captureFormState(name: string, options: {
    highlightErrors?: boolean;
    highlightActive?: boolean;
  } = {}) {
    const { highlightErrors = true, highlightActive = true } = options;

    // Highlight validation states if requested
    if (highlightErrors || highlightActive) {
      await this.page.addStyleTag({
        content: `
          ${highlightErrors ? '.error, [aria-invalid="true"] { outline: 2px solid red !important; }' : ''}
          ${highlightActive ? ':focus, .focused { outline: 2px solid blue !important; }' : ''}
        `
      });
    }

    await this.compareScreenshot({
      name: `form-${name}`,
      delay: 100
    });
  }
}

/**
 * Auth-specific test patterns
 */
export class AuthVisualPatterns {
  constructor(private helper: VisualTestHelper, private page: Page) {}

  /**
   * Test complete auth mode transition
   */
  async testModeTransition(fromMode: string, toMode: string) {
    console.log(`🔄 Testing auth mode transition: ${fromMode} → ${toMode}`);

    // Capture before state
    await this.helper.compareScreenshot({
      name: `auth-${fromMode}-before`,
      waitFor: 'networkidle'
    });

    // Perform transition (implementation depends on UI)
    await this.triggerModeTransition(toMode);

    // Monitor transition for flickering
    const flickerResult = await this.helper.detectFlickering({
      samples: 3,
      interval: 200,
      threshold: 0.1
    });

    if (flickerResult.hasFlickering) {
      console.warn(`⚠️ Flickering detected during ${fromMode} → ${toMode} transition`);
    }

    // Capture after state
    await this.helper.compareScreenshot({
      name: `auth-${toMode}-after`,
      waitFor: 'networkidle',
      delay: 500
    });

    return { flickerResult };
  }

  /**
   * Test form validation visual states
   */
  async testValidationStates(field: string) {
    console.log(`📝 Testing validation states for ${field}`);

    const fieldSelector = `[name="${field}"], #${field}`;

    // Empty state
    await this.helper.captureElement(fieldSelector, `${field}-empty`);

    // Invalid state
    await this.page.fill(fieldSelector, 'invalid');
    await this.page.blur(fieldSelector);
    await this.page.waitForTimeout(300); // Wait for validation
    await this.helper.captureElement(fieldSelector, `${field}-invalid`);

    // Valid state
    await this.page.fill(fieldSelector, field === 'email' ? 'test@example.com' : 'validvalue');
    await this.page.blur(fieldSelector);
    await this.page.waitForTimeout(300);
    await this.helper.captureElement(fieldSelector, `${field}-valid`);
  }

  /**
   * Helper to trigger mode transitions
   */
  private async triggerModeTransition(toMode: string) {
    const buttonMap: Record<string, string> = {
      'login': 'text=/sign in/i',
      'signup': 'text=/sign up/i',
      'forgot-password': 'text=/forgot.*password/i'
    };

    const buttonSelector = buttonMap[toMode];
    if (buttonSelector) {
      await this.page.click(buttonSelector);
      await this.helper.waitForAuthStability();
    }
  }
}

// Type declarations for injected scripts
declare global {
  interface Window {
    layoutShiftEntries: any[];
  }
}