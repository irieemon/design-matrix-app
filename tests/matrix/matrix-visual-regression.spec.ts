/**
 * MATRIX VISUAL REGRESSION TESTING SUITE
 *
 * Comprehensive visual testing to validate:
 * - Card layouts match reference designs
 * - Responsive behavior across screen sizes
 * - State transitions are visually correct
 * - No visual regressions from previous versions
 */

import { test, expect, Page } from '@playwright/test';
import { join } from 'path';

interface VisualTestConfig {
  name: string;
  viewport: { width: number; height: number };
  selector?: string;
  states?: string[];
  interactions?: Array<{ type: 'hover' | 'click' | 'focus'; selector: string; delay?: number }>;
}

const VISUAL_CONFIGS: VisualTestConfig[] = [
  // Desktop layouts
  {
    name: 'desktop-full-matrix',
    viewport: { width: 1440, height: 900 },
    selector: '[data-testid="design-matrix"]'
  },
  {
    name: 'desktop-cards-collapsed',
    viewport: { width: 1440, height: 900 },
    selector: '[data-testid="matrix-grid"]'
  },
  // Tablet layouts
  {
    name: 'tablet-matrix',
    viewport: { width: 768, height: 1024 },
    selector: '[data-testid="design-matrix"]'
  },
  // Mobile layouts
  {
    name: 'mobile-matrix',
    viewport: { width: 375, height: 812 },
    selector: '[data-testid="design-matrix"]'
  },
  {
    name: 'mobile-cards-stacked',
    viewport: { width: 375, height: 812 },
    selector: '[data-testid="matrix-grid"]'
  }
];

const CARD_STATE_CONFIGS: VisualTestConfig[] = [
  {
    name: 'card-collapsed-state',
    viewport: { width: 1440, height: 900 },
    selector: '[data-testid*="matrix-card"]:first-child'
  },
  {
    name: 'card-hover-state',
    viewport: { width: 1440, height: 900 },
    selector: '[data-testid*="matrix-card"]:first-child',
    interactions: [
      { type: 'hover', selector: '[data-testid*="matrix-card"]:first-child', delay: 200 }
    ]
  },
  {
    name: 'card-expanded-state',
    viewport: { width: 1440, height: 900 },
    selector: '[data-testid*="matrix-card"]:first-child',
    interactions: [
      { type: 'click', selector: '[data-testid*="matrix-card"]:first-child', delay: 300 }
    ]
  },
  {
    name: 'multiple-cards-expanded',
    viewport: { width: 1440, height: 900 },
    selector: '[data-testid="matrix-grid"]',
    interactions: [
      { type: 'click', selector: '[data-testid*="matrix-card"]:nth-child(1)', delay: 200 },
      { type: 'click', selector: '[data-testid*="matrix-card"]:nth-child(3)', delay: 200 }
    ]
  }
];

class VisualTestRunner {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async setupPage() {
    // Disable animations for consistent screenshots
    await this.page.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () => {
        const style = document.createElement('style');
        style.textContent = `
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            animation-delay: -0.01ms !important;
            transition-duration: 0.01ms !important;
            transition-delay: -0.01ms !important;
          }
        `;
        document.head.appendChild(style);
      });
    });

    await this.page.goto('/');
    await this.page.waitForSelector('[data-testid="design-matrix"]', { timeout: 10000 });
    await this.page.waitForLoadState('networkidle');

    // Wait for any initial animations to complete
    await this.page.waitForTimeout(500);
  }

  async runVisualTest(config: VisualTestConfig): Promise<void> {
    // Set viewport
    await this.page.setViewportSize(config.viewport);
    await this.page.waitForTimeout(300); // Allow layout to stabilize

    // Perform interactions if specified
    if (config.interactions) {
      for (const interaction of config.interactions) {
        switch (interaction.type) {
          case 'hover':
            await this.page.hover(interaction.selector);
            break;
          case 'click':
            await this.page.click(interaction.selector);
            break;
          case 'focus':
            await this.page.focus(interaction.selector);
            break;
        }

        if (interaction.delay) {
          await this.page.waitForTimeout(interaction.delay);
        }
      }
    }

    // Take screenshot
    const screenshotOptions = {
      fullPage: !config.selector,
      clip: config.selector ? undefined : undefined
    };

    if (config.selector) {
      const element = this.page.locator(config.selector);
      await expect(element).toHaveScreenshot(`${config.name}.png`);
    } else {
      await expect(this.page).toHaveScreenshot(`${config.name}.png`, screenshotOptions);
    }
  }

  async compareCardDimensions(expectedDimensions: { collapsed: number; expanded: number }) {
    const cards = this.page.locator('[data-testid*="matrix-card"]');
    const firstCard = cards.first();

    // Measure collapsed state
    const collapsedBox = await firstCard.boundingBox();
    expect(collapsedBox).not.toBeNull();

    if (collapsedBox) {
      expect(collapsedBox.height).toBeLessThanOrEqual(expectedDimensions.collapsed + 20); // 20px tolerance
    }

    // Expand and measure
    await firstCard.click();
    await this.page.waitForTimeout(300);

    const expandedBox = await firstCard.boundingBox();
    expect(expandedBox).not.toBeNull();

    if (expandedBox && collapsedBox) {
      expect(expandedBox.height).toBeGreaterThan(collapsedBox.height);
      expect(expandedBox.height).toBeGreaterThanOrEqual(expectedDimensions.expanded);
    }
  }
}

test.describe('Matrix Visual Regression Tests', () => {
  let visualRunner: VisualTestRunner;

  test.beforeEach(async ({ page }) => {
    visualRunner = new VisualTestRunner(page);
    await visualRunner.setupPage();
  });

  // Layout tests
  VISUAL_CONFIGS.forEach(config => {
    test(`Visual test: ${config.name}`, async ({ page }) => {
      await visualRunner.runVisualTest(config);
    });
  });

  // Card state tests
  CARD_STATE_CONFIGS.forEach(config => {
    test(`Card state test: ${config.name}`, async ({ page }) => {
      await visualRunner.runVisualTest(config);
    });
  });

  test('Card dimension validation against reference', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    await visualRunner.compareCardDimensions({
      collapsed: 120, // Reference from user requirements
      expanded: 200
    });
  });

  test('Hover state visual consistency', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    const cards = page.locator('[data-testid*="matrix-card"]');
    const cardCount = Math.min(await cards.count(), 4);

    // Test hover state for each card
    for (let i = 0; i < cardCount; i++) {
      const card = cards.nth(i);

      // Hover
      await card.hover();
      await page.waitForTimeout(100);

      // Take screenshot of hover state
      await expect(card).toHaveScreenshot(`card-${i}-hover-state.png`);

      // Move away to reset
      await page.mouse.move(0, 0);
      await page.waitForTimeout(100);
    }
  });

  test('Responsive breakpoint validation', async ({ page }) => {
    const breakpoints = [
      { name: 'mobile-sm', width: 320, height: 568 },
      { name: 'mobile-lg', width: 414, height: 896 },
      { name: 'tablet-portrait', width: 768, height: 1024 },
      { name: 'tablet-landscape', width: 1024, height: 768 },
      { name: 'desktop-sm', width: 1280, height: 720 },
      { name: 'desktop-lg', width: 1920, height: 1080 }
    ];

    for (const breakpoint of breakpoints) {
      await page.setViewportSize({ width: breakpoint.width, height: breakpoint.height });
      await page.waitForTimeout(500); // Allow layout to stabilize

      // Ensure matrix is still functional at this breakpoint
      const matrixContainer = page.locator('[data-testid="design-matrix"]');
      await expect(matrixContainer).toBeVisible();

      // Take screenshot
      await expect(page).toHaveScreenshot(`responsive-${breakpoint.name}.png`);

      // Test interaction at this breakpoint
      const cards = page.locator('[data-testid*="matrix-card"]');
      if (await cards.count() > 0) {
        await cards.first().click();
        await page.waitForTimeout(200);

        // Screenshot of interaction
        await expect(page).toHaveScreenshot(`responsive-${breakpoint.name}-interaction.png`);
      }
    }
  });

  test('Card transition animations visual validation', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    // Re-enable animations for this test
    await page.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () => {
        // Remove animation disabling
        const existingStyle = document.querySelector('style');
        if (existingStyle && existingStyle.textContent?.includes('animation-duration: 0.01ms')) {
          existingStyle.remove();
        }
      });
    });

    await page.reload();
    await page.waitForSelector('[data-testid="design-matrix"]', { timeout: 10000 });

    const firstCard = page.locator('[data-testid*="matrix-card"]').first();

    // Capture before transition
    await expect(firstCard).toHaveScreenshot('card-before-transition.png');

    // Start transition
    await firstCard.click();

    // Capture during transition (if visible)
    await page.waitForTimeout(150); // Mid-transition
    await expect(firstCard).toHaveScreenshot('card-during-transition.png');

    // Capture after transition
    await page.waitForTimeout(300); // Complete transition
    await expect(firstCard).toHaveScreenshot('card-after-transition.png');
  });

  test('Dark mode visual regression (if applicable)', async ({ page }) => {
    // Check if dark mode toggle exists
    const darkModeToggle = page.locator('[data-testid*="dark-mode"], [data-testid*="theme"]');

    if (await darkModeToggle.count() > 0) {
      await page.setViewportSize({ width: 1440, height: 900 });

      // Light mode screenshot
      await expect(page).toHaveScreenshot('matrix-light-mode.png');

      // Switch to dark mode
      await darkModeToggle.click();
      await page.waitForTimeout(300);

      // Dark mode screenshot
      await expect(page).toHaveScreenshot('matrix-dark-mode.png');

      // Test card interactions in dark mode
      const firstCard = page.locator('[data-testid*="matrix-card"]').first();
      await firstCard.hover();
      await page.waitForTimeout(100);
      await expect(firstCard).toHaveScreenshot('card-dark-mode-hover.png');

      await firstCard.click();
      await page.waitForTimeout(300);
      await expect(page).toHaveScreenshot('matrix-dark-mode-expanded.png');
    }
  });

  test('Print layout visual validation', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    // Emulate print media
    await page.emulateMedia({ media: 'print' });

    // Wait for print styles to apply
    await page.waitForTimeout(500);

    // Take print layout screenshot
    await expect(page).toHaveScreenshot('matrix-print-layout.png');

    // Reset to screen media
    await page.emulateMedia({ media: 'screen' });
  });

  test('High DPI display visual validation', async ({ page }) => {
    // Test on high DPI displays
    await page.setViewportSize({ width: 1440, height: 900 });

    // Emulate high DPI
    await page.setExtraHTTPHeaders({ 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' });

    // Take screenshot at different device pixel ratios
    const dprValues = [1, 2, 3];

    for (const dpr of dprValues) {
      await page.emulateViewport({
        width: 1440,
        height: 900,
        deviceScaleFactor: dpr
      });

      await page.waitForTimeout(300);
      await expect(page).toHaveScreenshot(`matrix-dpr-${dpr}x.png`);
    }
  });
});

test.describe('Visual Comparison with Reference Images', () => {
  test.beforeEach(async ({ page }) => {
    const visualRunner = new VisualTestRunner(page);
    await visualRunner.setupPage();
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test('Collapsed cards match reference design', async ({ page }) => {
    // This test compares against user's reference image #3 (compact collapsed cards)
    const matrixGrid = page.locator('[data-testid="matrix-grid"]');
    await expect(matrixGrid).toHaveScreenshot('collapsed-cards-reference-comparison.png');

    // Validate that cards are compact like in reference
    const cards = page.locator('[data-testid*="matrix-card"]');
    for (let i = 0; i < Math.min(await cards.count(), 4); i++) {
      const card = cards.nth(i);
      const cardBox = await card.boundingBox();

      expect(cardBox).not.toBeNull();
      if (cardBox) {
        // Cards should be compact (height ≤ 120px as per reference)
        expect(cardBox.height).toBeLessThanOrEqual(120);
      }
    }
  });

  test('Edit button positioning matches requirements', async ({ page }) => {
    const firstCard = page.locator('[data-testid*="matrix-card"]').first();

    // Expand card to reveal edit button
    await firstCard.click();
    await page.waitForTimeout(300);

    // Take screenshot with edit button visible
    await expect(firstCard).toHaveScreenshot('card-with-edit-button.png');

    // Validate edit button is properly positioned
    const editButton = firstCard.locator('[data-testid="edit-button"]');
    await expect(editButton).toBeVisible();

    const editButtonBox = await editButton.boundingBox();
    const cardBox = await firstCard.boundingBox();

    expect(editButtonBox).not.toBeNull();
    expect(cardBox).not.toBeNull();

    if (editButtonBox && cardBox) {
      // Edit button should be within card bounds and accessible
      expect(editButtonBox.x).toBeGreaterThanOrEqual(cardBox.x);
      expect(editButtonBox.y).toBeGreaterThanOrEqual(cardBox.y);
      expect(editButtonBox.x + editButtonBox.width).toBeLessThanOrEqual(cardBox.x + cardBox.width);
    }
  });

  test('No blank page navigation issue', async ({ page }) => {
    const initialUrl = page.url();

    // Click cards to ensure they expand in-place
    const cards = page.locator('[data-testid*="matrix-card"]');
    for (let i = 0; i < Math.min(await cards.count(), 2); i++) {
      const card = cards.nth(i);

      // Click and verify no navigation
      await card.click();
      await page.waitForTimeout(200);

      // URL should remain the same
      expect(page.url()).toBe(initialUrl);

      // Matrix should still be visible (no blank page)
      const matrixContainer = page.locator('[data-testid="design-matrix"]');
      await expect(matrixContainer).toBeVisible();
    }

    // Final screenshot showing properly expanded cards
    await expect(page).toHaveScreenshot('cards-expanded-in-place.png');
  });
});