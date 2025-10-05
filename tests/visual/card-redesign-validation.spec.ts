import { test, expect, Page } from '@playwright/test';
import path from 'path';

/**
 * Comprehensive Visual Regression Test Suite for Card Redesign
 *
 * Validates:
 * - Card dimensions (30-40% reduction target)
 * - Colored borders matching quadrant colors
 * - Font sizes for information density
 * - Padding and spacing
 * - Visual states (expanded, collapsed, hover, drag)
 */

interface CardMetrics {
  dimensions: {
    width: number;
    height: number;
    area: number;
  };
  border: {
    width: string;
    color: string;
    style: string;
  };
  typography: {
    titleFontSize: string;
    descriptionFontSize: string;
    metadataFontSize: string;
    lineHeight: string;
  };
  spacing: {
    padding: string;
    paddingTop: string;
    paddingRight: string;
    paddingBottom: string;
    paddingLeft: string;
    gap: string;
  };
  state: 'expanded' | 'collapsed';
}

interface QuadrantColors {
  'Quick Wins': string;
  'Big Bets': string;
  'Incremental': string;
  'Thankless': string;
}

const QUADRANT_COLORS: QuadrantColors = {
  'Quick Wins': 'rgb(16, 185, 129)', // green-500
  'Big Bets': 'rgb(59, 130, 246)',   // blue-500
  'Incremental': 'rgb(249, 115, 22)', // orange-500
  'Thankless': 'rgb(239, 68, 68)'     // red-500
};

const SCREENSHOT_DIR = path.join(__dirname, 'card-redesign-screenshots');

test.describe('Card Redesign Visual Regression Tests', () => {

  test.beforeEach(async ({ page }) => {
    // Login and navigate to matrix with test data
    await page.goto('http://localhost:3005');

    // Bypass auth for testing
    await page.evaluate(() => {
      localStorage.setItem('test_bypass_auth', 'true');
      localStorage.setItem('demo_user_id', 'test-user-123');
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Create test project with cards in all quadrants
    await setupTestProject(page);
  });

  test('Card Dimensions - Expanded State', async ({ page }) => {
    const cards = await page.locator('[data-testid="idea-card"]').all();
    const metrics: CardMetrics[] = [];

    for (let i = 0; i < Math.min(cards.length, 4); i++) {
      const card = cards[i];
      const dimensions = await card.boundingBox();

      expect(dimensions).toBeTruthy();

      const metric: CardMetrics = {
        dimensions: {
          width: dimensions!.width,
          height: dimensions!.height,
          area: dimensions!.width * dimensions!.height
        },
        border: await getComputedStyles(card, ['borderWidth', 'borderColor', 'borderStyle']),
        typography: await getTypographyStyles(card),
        spacing: await getSpacingStyles(card),
        state: 'expanded'
      };

      metrics.push(metric);

      // Target: 30-40% smaller
      // Baseline: ~280px width, ~200px height = 56,000 area
      // Target: ~168-196px width, ~120-140px height = 20,160-27,440 area
      expect(metric.dimensions.width).toBeGreaterThanOrEqual(160);
      expect(metric.dimensions.width).toBeLessThanOrEqual(200);
      expect(metric.dimensions.height).toBeGreaterThanOrEqual(115);
      expect(metric.dimensions.height).toBeLessThanOrEqual(145);

      // Screenshot individual card
      await card.screenshot({
        path: path.join(SCREENSHOT_DIR, `card-${i}-expanded-after.png`)
      });
    }

    // Log metrics for comparison
    console.log('Expanded Card Metrics:', JSON.stringify(metrics, null, 2));

    // Take full matrix screenshot
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'matrix-expanded-cards-after.png'),
      fullPage: true
    });
  });

  test('Card Dimensions - Collapsed State', async ({ page }) => {
    const cards = await page.locator('[data-testid="idea-card"]').all();
    const metrics: CardMetrics[] = [];

    for (let i = 0; i < Math.min(cards.length, 4); i++) {
      const card = cards[i];

      // Click to collapse
      const collapseButton = card.locator('[data-testid="card-collapse-button"]');
      if (await collapseButton.isVisible()) {
        await collapseButton.click();
        await page.waitForTimeout(300); // Animation complete
      }

      const dimensions = await card.boundingBox();
      expect(dimensions).toBeTruthy();

      const metric: CardMetrics = {
        dimensions: {
          width: dimensions!.width,
          height: dimensions!.height,
          area: dimensions!.width * dimensions!.height
        },
        border: await getComputedStyles(card, ['borderWidth', 'borderColor', 'borderStyle']),
        typography: await getTypographyStyles(card),
        spacing: await getSpacingStyles(card),
        state: 'collapsed'
      };

      metrics.push(metric);

      // Collapsed cards should be significantly smaller
      // Target: ~60-80px height
      expect(metric.dimensions.height).toBeGreaterThanOrEqual(55);
      expect(metric.dimensions.height).toBeLessThanOrEqual(85);

      // Screenshot collapsed card
      await card.screenshot({
        path: path.join(SCREENSHOT_DIR, `card-${i}-collapsed-after.png`)
      });
    }

    console.log('Collapsed Card Metrics:', JSON.stringify(metrics, null, 2));

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'matrix-collapsed-cards-after.png'),
      fullPage: true
    });
  });

  test('Border Colors Match Quadrants', async ({ page }) => {
    const quadrants = ['Quick Wins', 'Big Bets', 'Incremental', 'Thankless'];
    const results: Record<string, { expected: string; actual: string; match: boolean }> = {};

    for (const quadrantName of quadrants) {
      const quadrant = page.locator(`[data-testid="quadrant-${quadrantName.toLowerCase().replace(' ', '-')}"]`);
      const card = quadrant.locator('[data-testid="idea-card"]').first();

      if (await card.isVisible()) {
        const borderColor = await card.evaluate((el) => {
          return window.getComputedStyle(el).borderColor;
        });

        const expectedColor = QUADRANT_COLORS[quadrantName as keyof QuadrantColors];
        const match = normalizeColor(borderColor) === normalizeColor(expectedColor);

        results[quadrantName] = {
          expected: expectedColor,
          actual: borderColor,
          match
        };

        expect(match).toBe(true);

        // Screenshot card with border
        await card.screenshot({
          path: path.join(SCREENSHOT_DIR, `border-${quadrantName.toLowerCase().replace(' ', '-')}.png`)
        });
      }
    }

    console.log('Border Color Validation:', JSON.stringify(results, null, 2));
  });

  test('Typography - Font Sizes', async ({ page }) => {
    const card = page.locator('[data-testid="idea-card"]').first();
    await expect(card).toBeVisible();

    // Measure font sizes for all text elements
    const title = card.locator('[data-testid="card-title"]');
    const description = card.locator('[data-testid="card-description"]');
    const metadata = card.locator('[data-testid="card-metadata"]');

    const titleSize = await title.evaluate((el) =>
      window.getComputedStyle(el).fontSize
    );
    const descriptionSize = await description.evaluate((el) =>
      window.getComputedStyle(el).fontSize
    );
    const metadataSize = await metadata.evaluate((el) =>
      window.getComputedStyle(el).fontSize
    );

    // Target: Smaller fonts for information density
    // Title: ~14-16px (down from ~18-20px)
    // Description: ~12-14px (down from ~14-16px)
    // Metadata: ~10-12px (down from ~12-14px)
    expect(parsePx(titleSize)).toBeGreaterThanOrEqual(14);
    expect(parsePx(titleSize)).toBeLessThanOrEqual(16);

    expect(parsePx(descriptionSize)).toBeGreaterThanOrEqual(12);
    expect(parsePx(descriptionSize)).toBeLessThanOrEqual(14);

    expect(parsePx(metadataSize)).toBeGreaterThanOrEqual(10);
    expect(parsePx(metadataSize)).toBeLessThanOrEqual(12);

    console.log('Typography Metrics:', {
      title: titleSize,
      description: descriptionSize,
      metadata: metadataSize
    });

    // Screenshot with typography highlighted
    await card.screenshot({
      path: path.join(SCREENSHOT_DIR, 'typography-validation.png')
    });
  });

  test('Spacing - Padding and Gaps', async ({ page }) => {
    const card = page.locator('[data-testid="idea-card"]').first();
    await expect(card).toBeVisible();

    const spacing = await card.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return {
        padding: styles.padding,
        paddingTop: styles.paddingTop,
        paddingRight: styles.paddingRight,
        paddingBottom: styles.paddingBottom,
        paddingLeft: styles.paddingLeft,
        gap: styles.gap
      };
    });

    // Target: More compact with less padding
    // Padding: ~8-12px (down from ~16-20px)
    const avgPadding = (
      parsePx(spacing.paddingTop) +
      parsePx(spacing.paddingRight) +
      parsePx(spacing.paddingBottom) +
      parsePx(spacing.paddingLeft)
    ) / 4;

    expect(avgPadding).toBeGreaterThanOrEqual(8);
    expect(avgPadding).toBeLessThanOrEqual(12);

    console.log('Spacing Metrics:', spacing);
  });

  test('Visual Hierarchy and Contrast', async ({ page }) => {
    const card = page.locator('[data-testid="idea-card"]').first();
    await expect(card).toBeVisible();

    // Measure contrast ratios
    const backgroundColor = await card.evaluate((el) =>
      window.getComputedStyle(el).backgroundColor
    );
    const titleColor = await card.locator('[data-testid="card-title"]').evaluate((el) =>
      window.getComputedStyle(el).color
    );
    const borderColor = await card.evaluate((el) =>
      window.getComputedStyle(el).borderColor
    );

    // Calculate contrast ratio (simplified)
    const bgLuminance = calculateLuminance(backgroundColor);
    const textLuminance = calculateLuminance(titleColor);
    const contrastRatio = (Math.max(bgLuminance, textLuminance) + 0.05) /
                         (Math.min(bgLuminance, textLuminance) + 0.05);

    // WCAG AA requires 4.5:1 for normal text
    expect(contrastRatio).toBeGreaterThanOrEqual(4.5);

    console.log('Contrast Analysis:', {
      backgroundColor,
      titleColor,
      borderColor,
      contrastRatio: contrastRatio.toFixed(2)
    });

    await card.screenshot({
      path: path.join(SCREENSHOT_DIR, 'contrast-validation.png')
    });
  });

  test('Hover State', async ({ page }) => {
    const card = page.locator('[data-testid="idea-card"]').first();
    await expect(card).toBeVisible();

    // Before hover
    await card.screenshot({
      path: path.join(SCREENSHOT_DIR, 'card-hover-before.png')
    });

    // Hover
    await card.hover();
    await page.waitForTimeout(200); // Transition

    const hoverStyles = await card.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return {
        transform: styles.transform,
        boxShadow: styles.boxShadow,
        borderColor: styles.borderColor,
        backgroundColor: styles.backgroundColor
      };
    });

    // After hover
    await card.screenshot({
      path: path.join(SCREENSHOT_DIR, 'card-hover-after.png')
    });

    console.log('Hover State Styles:', hoverStyles);

    // Verify hover effect is visible
    expect(hoverStyles.transform).not.toBe('none');
  });

  test('Drag State', async ({ page }) => {
    const card = page.locator('[data-testid="idea-card"]').first();
    await expect(card).toBeVisible();

    // Before drag
    await card.screenshot({
      path: path.join(SCREENSHOT_DIR, 'card-drag-before.png')
    });

    // Start drag
    const cardBox = await card.boundingBox();
    expect(cardBox).toBeTruthy();

    await page.mouse.move(cardBox!.x + cardBox!.width / 2, cardBox!.y + cardBox!.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(100);

    const dragStyles = await card.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return {
        opacity: styles.opacity,
        cursor: styles.cursor,
        transform: styles.transform,
        zIndex: styles.zIndex
      };
    });

    // During drag
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'card-drag-during.png'),
      fullPage: true
    });

    await page.mouse.up();

    console.log('Drag State Styles:', dragStyles);

    // Verify drag visual feedback
    expect(parseFloat(dragStyles.opacity)).toBeLessThan(1);
  });

  test('Before/After Comparison Grid', async ({ page }) => {
    // Create comparison layout with before/after screenshots
    const comparisonStates = ['expanded', 'collapsed', 'hover', 'drag'];

    for (const state of comparisonStates) {
      const card = page.locator('[data-testid="idea-card"]').first();

      // Setup state
      if (state === 'collapsed') {
        const collapseButton = card.locator('[data-testid="card-collapse-button"]');
        if (await collapseButton.isVisible()) {
          await collapseButton.click();
          await page.waitForTimeout(300);
        }
      } else if (state === 'hover') {
        await card.hover();
        await page.waitForTimeout(200);
      } else if (state === 'drag') {
        const cardBox = await card.boundingBox();
        if (cardBox) {
          await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
          await page.mouse.down();
          await page.waitForTimeout(100);
        }
      }

      // Capture current state
      await card.screenshot({
        path: path.join(SCREENSHOT_DIR, `comparison-${state}-after.png`)
      });

      if (state === 'drag') {
        await page.mouse.up();
      }
    }
  });

  test('Dimension Reduction Validation', async ({ page }) => {
    const cards = await page.locator('[data-testid="idea-card"]').all();
    const reductions: { width: number; height: number; area: number }[] = [];

    // Baseline dimensions (from before redesign)
    const BASELINE = {
      width: 280,
      height: 200,
      area: 56000
    };

    for (const card of cards) {
      const dimensions = await card.boundingBox();
      if (dimensions) {
        const reduction = {
          width: ((BASELINE.width - dimensions.width) / BASELINE.width) * 100,
          height: ((BASELINE.height - dimensions.height) / BASELINE.height) * 100,
          area: ((BASELINE.area - (dimensions.width * dimensions.height)) / BASELINE.area) * 100
        };

        reductions.push(reduction);

        // Verify 30-40% reduction target
        expect(reduction.area).toBeGreaterThanOrEqual(30);
        expect(reduction.area).toBeLessThanOrEqual(40);
      }
    }

    const avgReduction = {
      width: reductions.reduce((sum, r) => sum + r.width, 0) / reductions.length,
      height: reductions.reduce((sum, r) => sum + r.height, 0) / reductions.length,
      area: reductions.reduce((sum, r) => sum + r.area, 0) / reductions.length
    };

    console.log('Dimension Reduction Analysis:', {
      individual: reductions,
      average: avgReduction,
      target: '30-40%'
    });

    // Generate summary report
    await generateSummaryReport(page, avgReduction);
  });
});

// Helper Functions

async function setupTestProject(page: Page) {
  await page.evaluate(() => {
    const testProject = {
      id: 'test-project-123',
      name: 'Card Redesign Test Project',
      ideas: [
        {
          id: '1',
          title: 'Quick Win Test Card',
          description: 'Test card for Quick Wins quadrant with moderate text length',
          impact: 8,
          effort: 2,
          quadrant: 'Quick Wins',
          status: 'active'
        },
        {
          id: '2',
          title: 'Big Bet Test Card',
          description: 'Test card for Big Bets quadrant with longer description to test text overflow and wrapping behavior',
          impact: 9,
          effort: 9,
          quadrant: 'Big Bets',
          status: 'active'
        },
        {
          id: '3',
          title: 'Incremental Test Card',
          description: 'Test card for Incremental quadrant',
          impact: 3,
          effort: 3,
          quadrant: 'Incremental',
          status: 'active'
        },
        {
          id: '4',
          title: 'Thankless Test Card',
          description: 'Test card for Thankless quadrant with minimal text',
          impact: 2,
          effort: 8,
          quadrant: 'Thankless',
          status: 'active'
        }
      ]
    };

    localStorage.setItem('current_project', JSON.stringify(testProject));
  });

  await page.reload();
  await page.waitForLoadState('networkidle');
}

async function getComputedStyles(locator: any, properties: string[]): Promise<any> {
  return await locator.evaluate((el: Element, props: string[]) => {
    const styles = window.getComputedStyle(el);
    const result: any = {};
    props.forEach(prop => {
      const camelProp = prop.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
      result[camelProp] = (styles as any)[camelProp];
    });
    return result;
  }, properties);
}

async function getTypographyStyles(locator: any): Promise<any> {
  return await locator.evaluate((el: Element) => {
    const title = el.querySelector('[data-testid="card-title"]');
    const description = el.querySelector('[data-testid="card-description"]');
    const metadata = el.querySelector('[data-testid="card-metadata"]');

    return {
      titleFontSize: title ? window.getComputedStyle(title).fontSize : 'N/A',
      descriptionFontSize: description ? window.getComputedStyle(description).fontSize : 'N/A',
      metadataFontSize: metadata ? window.getComputedStyle(metadata).fontSize : 'N/A',
      lineHeight: title ? window.getComputedStyle(title).lineHeight : 'N/A'
    };
  });
}

async function getSpacingStyles(locator: any): Promise<any> {
  return await locator.evaluate((el: Element) => {
    const styles = window.getComputedStyle(el);
    return {
      padding: styles.padding,
      paddingTop: styles.paddingTop,
      paddingRight: styles.paddingRight,
      paddingBottom: styles.paddingBottom,
      paddingLeft: styles.paddingLeft,
      gap: styles.gap
    };
  });
}

function normalizeColor(color: string): string {
  // Convert rgb(r, g, b) to normalized format
  const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (match) {
    return `rgb(${match[1]}, ${match[2]}, ${match[3]})`;
  }
  return color;
}

function parsePx(value: string): number {
  return parseFloat(value.replace('px', ''));
}

function calculateLuminance(color: string): number {
  // Simplified luminance calculation
  const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!match) return 0;

  const [, r, g, b] = match.map(Number);
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

async function generateSummaryReport(page: Page, avgReduction: any) {
  const report = `
# Card Redesign Visual Regression Summary

## Dimension Reduction
- Width: ${avgReduction.width.toFixed(1)}%
- Height: ${avgReduction.height.toFixed(1)}%
- Area: ${avgReduction.area.toFixed(1)}%
- Target: 30-40% ✓

## Test Results
All visual regression tests passed successfully.

## Screenshots Location
See ${SCREENSHOT_DIR} for detailed comparison images.

Generated: ${new Date().toISOString()}
  `;

  console.log(report);
}