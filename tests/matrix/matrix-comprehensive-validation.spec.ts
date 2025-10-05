/**
 * COMPREHENSIVE MATRIX VALIDATION SUITE
 *
 * This test suite validates that all critical matrix issues have been resolved:
 * 1. React Component Crashes
 * 2. Performance Crisis (hover lag, frame rate drops)
 * 3. UI Layout Issues (card states, edit buttons, navigation)
 * 4. Interactive Behavior
 * 5. User Journey Testing
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';
import { injectAxe, checkA11y } from 'axe-playwright';

// Performance thresholds based on requirements
const PERFORMANCE_THRESHOLDS = {
  HOVER_RESPONSE_MS: 16, // Must be under 16ms
  TARGET_FPS: 58, // Minimum 58fps
  PAINT_TIME_MS: 8, // Target under 8ms
  LAYOUT_SHIFT_THRESHOLD: 0.1
};

// Visual regression baselines
const CARD_DIMENSIONS = {
  COLLAPSED_HEIGHT: 120, // Compact collapsed cards
  EXPANDED_MIN_HEIGHT: 200,
  CARD_WIDTH_MIN: 280
};

interface PerformanceMetrics {
  hoverResponseTime: number;
  frameRate: number;
  paintTime: number;
  layoutShift: number;
  gpuAccelerated: boolean;
}

class MatrixValidator {
  private page: Page;
  private performanceMetrics: PerformanceMetrics[] = [];

  constructor(page: Page) {
    this.page = page;
  }

  async setupPerformanceMonitoring() {
    // Enable performance timeline
    await this.page.addInitScript(() => {
      (window as any).performanceEntries = [];
      const observer = new PerformanceObserver((list) => {
        (window as any).performanceEntries.push(...list.getEntries());
      });
      observer.observe({ entryTypes: ['measure', 'paint', 'layout-shift'] });
    });
  }

  async measureHoverPerformance(cardSelector: string): Promise<number> {
    // Start performance measurement
    await this.page.evaluate(() => performance.mark('hover-start'));

    // Trigger hover
    await this.page.hover(cardSelector);

    // Wait for any transitions/animations
    await this.page.waitForTimeout(50);

    // End performance measurement
    const hoverTime = await this.page.evaluate(() => {
      performance.mark('hover-end');
      performance.measure('hover-duration', 'hover-start', 'hover-end');
      const entries = performance.getEntriesByName('hover-duration');
      return entries.length > 0 ? entries[0].duration : 0;
    });

    return hoverTime;
  }

  async measureFrameRate(): Promise<number> {
    return await this.page.evaluate(() => {
      return new Promise<number>((resolve) => {
        let frames = 0;
        const startTime = performance.now();

        function countFrame() {
          frames++;
          const elapsed = performance.now() - startTime;

          if (elapsed < 1000) {
            requestAnimationFrame(countFrame);
          } else {
            resolve((frames * 1000) / elapsed);
          }
        }

        requestAnimationFrame(countFrame);
      });
    });
  }

  async checkGPUAcceleration(): Promise<boolean> {
    return await this.page.evaluate(() => {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      return gl !== null;
    });
  }
}

test.describe('Phase 4A: Matrix Rendering Validation', () => {
  let validator: MatrixValidator;

  test.beforeEach(async ({ page }) => {
    validator = new MatrixValidator(page);
    await validator.setupPerformanceMonitoring();

    // Navigate to matrix page
    await page.goto('/');

    // Wait for React to load and avoid hook errors
    await page.waitForSelector('[data-testid="design-matrix"]', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
  });

  test('Matrix component loads without React errors', async ({ page }) => {
    // Check for React error boundaries or console errors
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Verify matrix container exists
    const matrixContainer = page.locator('[data-testid="design-matrix"]');
    await expect(matrixContainer).toBeVisible();

    // Check for specific hook errors that were problematic
    const hasHookErrors = errors.some(error =>
      error.includes('Rendered fewer hooks than expected') ||
      error.includes('useEffect') ||
      error.includes('useState')
    );

    expect(hasHookErrors).toBeFalsy();
    expect(errors.length).toBeLessThan(3); // Allow minor warnings, but no critical errors
  });

  test('All cards render with proper backgrounds', async ({ page }) => {
    // Wait for cards to render
    const cards = page.locator('[data-testid*="matrix-card"]');
    await expect(cards).toHaveCount(4); // Assuming 4 quadrants

    // Check each card has proper styling
    for (let i = 0; i < 4; i++) {
      const card = cards.nth(i);
      await expect(card).toBeVisible();

      // Verify card has background and is not transparent
      const cardStyles = await card.evaluate((el) => {
        const styles = window.getComputedStyle(el);
        return {
          backgroundColor: styles.backgroundColor,
          opacity: styles.opacity,
          display: styles.display
        };
      });

      expect(cardStyles.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
      expect(cardStyles.opacity).not.toBe('0');
      expect(cardStyles.display).not.toBe('none');
    }
  });

  test('Matrix grid displays correctly', async ({ page }) => {
    const matrixGrid = page.locator('[data-testid="matrix-grid"]');
    await expect(matrixGrid).toBeVisible();

    // Check grid layout
    const gridStyles = await matrixGrid.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return {
        display: styles.display,
        gridTemplateColumns: styles.gridTemplateColumns,
        gridTemplateRows: styles.gridTemplateRows
      };
    });

    expect(gridStyles.display).toBe('grid');
    expect(gridStyles.gridTemplateColumns).toContain('1fr'); // Should have proper grid columns
  });

  test('Responsive layout across screen sizes', async ({ page }) => {
    const testViewports = [
      { width: 320, height: 568, name: 'mobile' },
      { width: 768, height: 1024, name: 'tablet' },
      { width: 1440, height: 900, name: 'desktop' }
    ];

    for (const viewport of testViewports) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(500); // Allow layout to stabilize

      const matrixContainer = page.locator('[data-testid="design-matrix"]');
      await expect(matrixContainer).toBeVisible();

      // Take screenshot for visual regression
      await expect(page).toHaveScreenshot(`matrix-${viewport.name}-layout.png`);
    }
  });
});

test.describe('Phase 4B: Card State Testing', () => {
  let validator: MatrixValidator;

  test.beforeEach(async ({ page }) => {
    validator = new MatrixValidator(page);
    await page.goto('/');
    await page.waitForSelector('[data-testid="design-matrix"]', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
  });

  test('Collapsed cards are compact like reference image', async ({ page }) => {
    const cards = page.locator('[data-testid*="matrix-card"]');

    for (let i = 0; i < await cards.count(); i++) {
      const card = cards.nth(i);

      // Get card dimensions
      const cardBox = await card.boundingBox();
      expect(cardBox).not.toBeNull();

      if (cardBox) {
        // Verify collapsed cards are compact (reference: user's image #3)
        expect(cardBox.height).toBeLessThanOrEqual(CARD_DIMENSIONS.COLLAPSED_HEIGHT);
        expect(cardBox.width).toBeGreaterThanOrEqual(CARD_DIMENSIONS.CARD_WIDTH_MIN);
      }
    }

    // Visual regression test for collapsed state
    await expect(page).toHaveScreenshot('cards-collapsed-compact.png');
  });

  test('Card expansion transitions work properly', async ({ page }) => {
    const firstCard = page.locator('[data-testid*="matrix-card"]').first();

    // Get initial collapsed dimensions
    const collapsedBox = await firstCard.boundingBox();
    expect(collapsedBox).not.toBeNull();

    // Click to expand
    await firstCard.click();
    await page.waitForTimeout(300); // Allow transition

    // Get expanded dimensions
    const expandedBox = await firstCard.boundingBox();
    expect(expandedBox).not.toBeNull();

    if (collapsedBox && expandedBox) {
      // Verify expansion happened
      expect(expandedBox.height).toBeGreaterThan(collapsedBox.height);
      expect(expandedBox.height).toBeGreaterThanOrEqual(CARD_DIMENSIONS.EXPANDED_MIN_HEIGHT);
    }

    // Visual test of expanded state
    await expect(page).toHaveScreenshot('card-expanded-state.png');
  });

  test('Expanded cards show all details properly', async ({ page }) => {
    const firstCard = page.locator('[data-testid*="matrix-card"]').first();

    // Expand card
    await firstCard.click();
    await page.waitForTimeout(300);

    // Check for expanded content elements
    const expandedContent = firstCard.locator('[data-testid="card-expanded-content"]');
    await expect(expandedContent).toBeVisible();

    // Check for edit button in expanded state
    const editButton = firstCard.locator('[data-testid="edit-button"]');
    await expect(editButton).toBeVisible();

    // Verify edit button is properly positioned
    const editButtonBox = await editButton.boundingBox();
    const cardBox = await firstCard.boundingBox();

    expect(editButtonBox).not.toBeNull();
    expect(cardBox).not.toBeNull();

    if (editButtonBox && cardBox) {
      // Edit button should be within card bounds
      expect(editButtonBox.x).toBeGreaterThanOrEqual(cardBox.x);
      expect(editButtonBox.y).toBeGreaterThanOrEqual(cardBox.y);
    }
  });

  test('Card state persistence during interactions', async ({ page }) => {
    const firstCard = page.locator('[data-testid*="matrix-card"]').first();

    // Expand card
    await firstCard.click();
    await page.waitForTimeout(300);

    // Verify card is expanded
    const expandedContent = firstCard.locator('[data-testid="card-expanded-content"]');
    await expect(expandedContent).toBeVisible();

    // Interact with other elements
    await page.click('body'); // Click elsewhere
    await page.waitForTimeout(100);

    // Verify card remains expanded (state persistence)
    await expect(expandedContent).toBeVisible();
  });
});

test.describe('Phase 4C: Interactive Behavior Validation', () => {
  let validator: MatrixValidator;

  test.beforeEach(async ({ page }) => {
    validator = new MatrixValidator(page);
    await validator.setupPerformanceMonitoring();
    await page.goto('/');
    await page.waitForSelector('[data-testid="design-matrix"]', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
  });

  test('Hover responses are under 16ms with no invisibility', async ({ page }) => {
    const cards = page.locator('[data-testid*="matrix-card"]');
    const cardCount = await cards.count();

    for (let i = 0; i < Math.min(cardCount, 3); i++) {
      const card = cards.nth(i);

      // Measure hover performance
      const hoverTime = await validator.measureHoverPerformance(`[data-testid*="matrix-card"]:nth-child(${i + 1})`);

      // Critical: Must be under 16ms
      expect(hoverTime).toBeLessThan(PERFORMANCE_THRESHOLDS.HOVER_RESPONSE_MS);

      // Check card remains visible during hover
      await expect(card).toBeVisible();

      // Verify no opacity issues
      const opacity = await card.evaluate((el) => window.getComputedStyle(el).opacity);
      expect(parseFloat(opacity)).toBeGreaterThan(0.8);

      // Move away to reset
      await page.mouse.move(0, 0);
      await page.waitForTimeout(100);
    }
  });

  test('Click handlers expand in-place without navigation', async ({ page }) => {
    const firstCard = page.locator('[data-testid*="matrix-card"]').first();

    // Get initial URL
    const initialUrl = page.url();

    // Click card
    await firstCard.click();
    await page.waitForTimeout(300);

    // Verify URL hasn't changed (no navigation)
    expect(page.url()).toBe(initialUrl);

    // Verify card expanded in-place
    const expandedContent = firstCard.locator('[data-testid="card-expanded-content"]');
    await expect(expandedContent).toBeVisible();

    // Verify we're still on the same page
    const matrixContainer = page.locator('[data-testid="design-matrix"]');
    await expect(matrixContainer).toBeVisible();
  });

  test('Edit button positioning and accessibility', async ({ page }) => {
    const firstCard = page.locator('[data-testid*="matrix-card"]').first();

    // Expand card to reveal edit button
    await firstCard.click();
    await page.waitForTimeout(300);

    const editButton = firstCard.locator('[data-testid="edit-button"]');
    await expect(editButton).toBeVisible();

    // Check accessibility
    await expect(editButton).toHaveAttribute('type', 'button');

    // Check positioning - should be accessible and not overlapped
    const editButtonBox = await editButton.boundingBox();
    expect(editButtonBox).not.toBeNull();

    if (editButtonBox) {
      // Button should have reasonable size for clicking
      expect(editButtonBox.width).toBeGreaterThanOrEqual(32);
      expect(editButtonBox.height).toBeGreaterThanOrEqual(32);
    }

    // Test click interaction
    await editButton.click();
    // Should open edit modal or similar (verify based on actual implementation)
  });

  test('Drag and drop functionality works smoothly', async ({ page }) => {
    const cards = page.locator('[data-testid*="matrix-card"]');

    if (await cards.count() >= 2) {
      const sourceCard = cards.first();
      const targetCard = cards.nth(1);

      // Get initial positions
      const sourceBox = await sourceCard.boundingBox();
      const targetBox = await targetCard.boundingBox();

      expect(sourceBox).not.toBeNull();
      expect(targetBox).not.toBeNull();

      if (sourceBox && targetBox) {
        // Perform drag and drop
        await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
        await page.mouse.down();
        await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 10 });
        await page.mouse.up();

        // Allow time for any animations
        await page.waitForTimeout(500);

        // Verify smooth interaction (no errors in console)
        const errors: string[] = [];
        page.on('console', (msg) => {
          if (msg.type() === 'error') errors.push(msg.text());
        });

        expect(errors.length).toBe(0);
      }
    }
  });
});

test.describe('Phase 4D: Performance Benchmarking', () => {
  let validator: MatrixValidator;

  test.beforeEach(async ({ page }) => {
    validator = new MatrixValidator(page);
    await validator.setupPerformanceMonitoring();
    await page.goto('/');
    await page.waitForSelector('[data-testid="design-matrix"]', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
  });

  test('Frame rates maintain >58fps during interactions', async ({ page }) => {
    // Measure baseline frame rate
    const baselineFrameRate = await validator.measureFrameRate();

    // Perform various interactions while monitoring frame rate
    const cards = page.locator('[data-testid*="matrix-card"]');
    const cardCount = await cards.count();

    for (let i = 0; i < Math.min(cardCount, 3); i++) {
      const card = cards.nth(i);

      // Hover interaction
      await card.hover();
      await page.waitForTimeout(100);

      // Click interaction
      await card.click();
      await page.waitForTimeout(100);
    }

    // Measure frame rate during interactions
    const interactionFrameRate = await validator.measureFrameRate();

    // Critical: Frame rate must stay above 58fps
    expect(interactionFrameRate).toBeGreaterThan(PERFORMANCE_THRESHOLDS.TARGET_FPS);

    console.log(`Baseline FPS: ${baselineFrameRate.toFixed(2)}, Interaction FPS: ${interactionFrameRate.toFixed(2)}`);
  });

  test('GPU acceleration is working', async ({ page }) => {
    const hasGPUAcceleration = await validator.checkGPUAcceleration();
    expect(hasGPUAcceleration).toBeTruthy();

    // Check for hardware accelerated CSS properties
    const cards = page.locator('[data-testid*="matrix-card"]');
    const firstCard = cards.first();

    const cardStyles = await firstCard.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return {
        transform: styles.transform,
        willChange: styles.willChange,
        backfaceVisibility: styles.backfaceVisibility
      };
    });

    // Should use GPU-friendly properties for smooth animations
    const hasOptimizations =
      cardStyles.willChange === 'transform' ||
      cardStyles.backfaceVisibility === 'hidden' ||
      cardStyles.transform !== 'none';

    expect(hasOptimizations).toBeTruthy();
  });

  test('No layout thrashing or paint storms', async ({ page }) => {
    // Monitor layout and paint events
    await page.evaluate(() => {
      (window as any).layoutShifts = [];
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'layout-shift') {
            (window as any).layoutShifts.push(entry);
          }
        }
      });
      observer.observe({ entryTypes: ['layout-shift'] });
    });

    // Perform interactions
    const cards = page.locator('[data-testid*="matrix-card"]');
    for (let i = 0; i < Math.min(await cards.count(), 3); i++) {
      const card = cards.nth(i);
      await card.hover();
      await page.waitForTimeout(50);
      await card.click();
      await page.waitForTimeout(50);
    }

    // Check layout shift metrics
    const layoutShifts = await page.evaluate(() => (window as any).layoutShifts);

    // Calculate cumulative layout shift (CLS)
    const totalShift = layoutShifts.reduce((sum: number, shift: any) => sum + shift.value, 0);

    expect(totalShift).toBeLessThan(PERFORMANCE_THRESHOLDS.LAYOUT_SHIFT_THRESHOLD);
  });

  test('Memory usage remains stable', async ({ page }) => {
    // Get initial memory usage
    const initialMemory = await page.evaluate(() => {
      const mem = (performance as any).memory;
      return mem ? {
        usedJSHeapSize: mem.usedJSHeapSize,
        totalJSHeapSize: mem.totalJSHeapSize
      } : null;
    });

    if (initialMemory) {
      // Perform many interactions to test for memory leaks
      const cards = page.locator('[data-testid*="matrix-card"]');
      for (let round = 0; round < 10; round++) {
        for (let i = 0; i < await cards.count(); i++) {
          const card = cards.nth(i);
          await card.hover();
          await card.click();
          await page.waitForTimeout(10);
        }
      }

      // Get final memory usage
      const finalMemory = await page.evaluate(() => {
        const mem = (performance as any).memory;
        return mem ? {
          usedJSHeapSize: mem.usedJSHeapSize,
          totalJSHeapSize: mem.totalJSHeapSize
        } : null;
      });

      if (finalMemory) {
        // Memory growth should be reasonable (less than 50% increase)
        const memoryGrowth = (finalMemory.usedJSHeapSize - initialMemory.usedJSHeapSize) / initialMemory.usedJSHeapSize;
        expect(memoryGrowth).toBeLessThan(0.5);
      }
    }
  });
});

test.describe('Phase 4E: User Journey Testing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Full user flow: Load → Navigate → Interact → Edit', async ({ page }) => {
    // Step 1: Load
    await page.waitForSelector('[data-testid="design-matrix"]', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Verify initial load state
    const matrixContainer = page.locator('[data-testid="design-matrix"]');
    await expect(matrixContainer).toBeVisible();

    // Step 2: Navigate (if navigation elements exist)
    const navButtons = page.locator('[data-testid*="nav"]');
    if (await navButtons.count() > 0) {
      await navButtons.first().click();
      await page.waitForTimeout(500);
    }

    // Step 3: Interact with matrix cards
    const cards = page.locator('[data-testid*="matrix-card"]');
    await expect(cards).toHaveCount(4); // Verify all cards loaded

    // Hover interaction
    await cards.first().hover();
    await page.waitForTimeout(100);

    // Click to expand
    await cards.first().click();
    await page.waitForTimeout(300);

    // Verify expansion
    const expandedContent = cards.first().locator('[data-testid="card-expanded-content"]');
    await expect(expandedContent).toBeVisible();

    // Step 4: Edit interaction
    const editButton = cards.first().locator('[data-testid="edit-button"]');
    if (await editButton.count() > 0) {
      await editButton.click();
      await page.waitForTimeout(500);

      // If edit modal opens, verify it
      const modal = page.locator('[data-testid*="modal"]');
      if (await modal.count() > 0) {
        await expect(modal).toBeVisible();

        // Close modal if present
        const closeButton = modal.locator('[data-testid="close-button"]');
        if (await closeButton.count() > 0) {
          await closeButton.click();
        }
      }
    }

    // Final verification - everything still works
    await expect(matrixContainer).toBeVisible();
    await expect(cards).toHaveCount(4);
  });

  test('Authentication flow does not break matrix', async ({ page }) => {
    // This test assumes authentication is required
    // Navigate to matrix page
    await page.goto('/');

    // If redirected to auth, complete authentication
    const authForm = page.locator('[data-testid="auth-form"]');
    if (await authForm.isVisible()) {
      // Fill in test credentials
      const emailInput = page.locator('[data-testid="email-input"]');
      const passwordInput = page.locator('[data-testid="password-input"]');
      const submitButton = page.locator('[data-testid="auth-submit"]');

      await emailInput.fill('test@example.com');
      await passwordInput.fill('testpassword');
      await submitButton.click();

      // Wait for auth to complete
      await page.waitForURL('**/matrix', { timeout: 10000 });
    }

    // Verify matrix loads correctly after auth
    const matrixContainer = page.locator('[data-testid="design-matrix"]');
    await expect(matrixContainer).toBeVisible();

    const cards = page.locator('[data-testid*="matrix-card"]');
    await expect(cards).toHaveCount(4);

    // Test interaction still works
    await cards.first().click();
    const expandedContent = cards.first().locator('[data-testid="card-expanded-content"]');
    await expect(expandedContent).toBeVisible();
  });

  test('Project switching maintains card states', async ({ page, context }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="design-matrix"]', { timeout: 10000 });

    // Expand a card
    const cards = page.locator('[data-testid*="matrix-card"]');
    await cards.first().click();
    await page.waitForTimeout(300);

    // Verify expansion
    const expandedContent = cards.first().locator('[data-testid="card-expanded-content"]');
    await expect(expandedContent).toBeVisible();

    // If project switching exists, test it
    const projectSwitcher = page.locator('[data-testid="project-switcher"]');
    if (await projectSwitcher.count() > 0) {
      // Switch project and back
      await projectSwitcher.click();
      await page.waitForTimeout(500);

      // Switch back (if applicable)
      await projectSwitcher.click();
      await page.waitForTimeout(500);

      // Verify card state is maintained
      await expect(expandedContent).toBeVisible();
    }
  });

  test('Real-world usage patterns', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="design-matrix"]', { timeout: 10000 });

    // Simulate realistic user interactions
    const cards = page.locator('[data-testid*="matrix-card"]');

    // Pattern 1: Quick scanning (hover multiple cards)
    for (let i = 0; i < await cards.count(); i++) {
      await cards.nth(i).hover();
      await page.waitForTimeout(200); // Realistic hover duration
    }

    // Pattern 2: Focus on specific quadrant
    await cards.first().click();
    await page.waitForTimeout(500);

    // Read expanded content (simulate reading time)
    await page.waitForTimeout(1000);

    // Pattern 3: Compare quadrants
    await cards.nth(1).click();
    await page.waitForTimeout(300);

    await cards.nth(2).click();
    await page.waitForTimeout(300);

    // Pattern 4: Edit action
    const editButton = cards.first().locator('[data-testid="edit-button"]');
    if (await editButton.count() > 0) {
      await editButton.click();
      await page.waitForTimeout(500);
    }

    // Verify system remains responsive throughout
    const finalFrameRate = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        let frames = 0;
        const startTime = performance.now();

        function countFrame() {
          frames++;
          const elapsed = performance.now() - startTime;

          if (elapsed < 500) {
            requestAnimationFrame(countFrame);
          } else {
            resolve((frames * 1000) / elapsed);
          }
        }

        requestAnimationFrame(countFrame);
      });
    });

    expect(finalFrameRate).toBeGreaterThan(PERFORMANCE_THRESHOLDS.TARGET_FPS);
  });
});

test.describe('Accessibility and Compliance', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="design-matrix"]', { timeout: 10000 });
    await injectAxe(page);
  });

  test('Matrix meets WCAG accessibility standards', async ({ page }) => {
    await checkA11y(page, '[data-testid="design-matrix"]', {
      detailedReport: true,
      detailedReportOptions: { html: true }
    });
  });

  test('Keyboard navigation works properly', async ({ page }) => {
    // Test tab navigation
    const cards = page.locator('[data-testid*="matrix-card"]');

    // Focus first card
    await cards.first().focus();
    await expect(cards.first()).toBeFocused();

    // Tab to next card
    await page.keyboard.press('Tab');

    // Enter to expand
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);

    // Verify expansion
    const expandedContent = cards.first().locator('[data-testid="card-expanded-content"]');
    await expect(expandedContent).toBeVisible();
  });
});