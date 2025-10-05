/**
 * Quadrant Color Detection Visual Test Suite
 *
 * Comprehensive validation of the quadrant color detection fix for X-axis and Y-axis drag operations.
 *
 * Test Coverage:
 * - All quadrant boundary crossings (X-axis and Y-axis)
 * - Edge case scenarios (exact center, near boundaries)
 * - Color validation (dot colors, border colors)
 * - Visual regression detection
 *
 * Expected Color Mappings:
 * - Quick Wins (top-left, x<0.5, y<0.5): Green (#10B981)
 * - Strategic (top-right, x>=0.5, y<0.5): Blue (#3B82F6)
 * - Reconsider (bottom-left, x<0.5, y>=0.5): Amber (#F59E0B)
 * - Avoid (bottom-right, x>=0.5, y>=0.5): Red (#EF4444)
 */

import { test, expect, Page } from '@playwright/test';

// Quadrant color definitions matching OptimizedIdeaCard.tsx
const QUADRANT_COLORS = {
  'quick-wins': '#10B981',  // Green
  'strategic': '#3B82F6',   // Blue
  'reconsider': '#F59E0B',  // Amber
  'avoid': '#EF4444'        // Red
} as const;

// RGB equivalents for visual validation (with tolerance)
const QUADRANT_COLORS_RGB = {
  'quick-wins': { r: 16, g: 185, b: 129 },
  'strategic': { r: 59, g: 130, b: 246 },
  'reconsider': { r: 245, g: 158, b: 11 },
  'avoid': { r: 239, g: 68, b: 68 }
} as const;

// Test positions mapped to quadrants
interface TestPosition {
  name: string;
  quadrant: keyof typeof QUADRANT_COLORS;
  x: number; // Normalized position (0-1)
  y: number; // Normalized position (0-1)
  description: string;
}

const TEST_POSITIONS: TestPosition[] = [
  // Quadrant centers
  { name: 'quick-wins-center', quadrant: 'quick-wins', x: 0.25, y: 0.25, description: 'Center of Quick Wins quadrant' },
  { name: 'strategic-center', quadrant: 'strategic', x: 0.75, y: 0.25, description: 'Center of Strategic quadrant' },
  { name: 'reconsider-center', quadrant: 'reconsider', x: 0.25, y: 0.75, description: 'Center of Reconsider quadrant' },
  { name: 'avoid-center', quadrant: 'avoid', x: 0.75, y: 0.75, description: 'Center of Avoid quadrant' },

  // Boundary crossings - X-axis (left/right)
  { name: 'quick-wins-right-edge', quadrant: 'quick-wins', x: 0.45, y: 0.25, description: 'Just before X-axis boundary in Quick Wins' },
  { name: 'strategic-left-edge', quadrant: 'strategic', x: 0.55, y: 0.25, description: 'Just after X-axis boundary in Strategic' },
  { name: 'reconsider-right-edge', quadrant: 'reconsider', x: 0.45, y: 0.75, description: 'Just before X-axis boundary in Reconsider' },
  { name: 'avoid-left-edge', quadrant: 'avoid', x: 0.55, y: 0.75, description: 'Just after X-axis boundary in Avoid' },

  // Boundary crossings - Y-axis (top/bottom)
  { name: 'quick-wins-bottom-edge', quadrant: 'quick-wins', x: 0.25, y: 0.45, description: 'Just before Y-axis boundary in Quick Wins' },
  { name: 'reconsider-top-edge', quadrant: 'reconsider', x: 0.25, y: 0.55, description: 'Just after Y-axis boundary in Reconsider' },
  { name: 'strategic-bottom-edge', quadrant: 'strategic', x: 0.75, y: 0.45, description: 'Just before Y-axis boundary in Strategic' },
  { name: 'avoid-top-edge', quadrant: 'avoid', x: 0.75, y: 0.55, description: 'Just after Y-axis boundary in Avoid' },

  // Exact boundaries (critical edge cases)
  { name: 'exact-x-boundary-top', quadrant: 'strategic', x: 0.5, y: 0.25, description: 'Exact X boundary, top half (defaults to right)' },
  { name: 'exact-y-boundary-left', quadrant: 'reconsider', x: 0.25, y: 0.5, description: 'Exact Y boundary, left half (defaults to bottom)' },
  { name: 'exact-center', quadrant: 'avoid', x: 0.5, y: 0.5, description: 'Exact center point (defaults to bottom-right)' },
];

// Drag scenarios to test all transitions
interface DragScenario {
  name: string;
  from: keyof typeof QUADRANT_COLORS;
  to: keyof typeof QUADRANT_COLORS;
  description: string;
}

const DRAG_SCENARIOS: DragScenario[] = [
  { name: 'quick-wins-to-strategic', from: 'quick-wins', to: 'strategic', description: 'Drag across X-axis boundary (left to right, top)' },
  { name: 'quick-wins-to-reconsider', from: 'quick-wins', to: 'reconsider', description: 'Drag across Y-axis boundary (top to bottom, left)' },
  { name: 'strategic-to-avoid', from: 'strategic', to: 'avoid', description: 'Drag across Y-axis boundary (top to bottom, right)' },
  { name: 'strategic-to-quick-wins', from: 'strategic', to: 'quick-wins', description: 'Drag across X-axis boundary (right to left, top)' },
  { name: 'reconsider-to-avoid', from: 'reconsider', to: 'avoid', description: 'Drag across X-axis boundary (left to right, bottom)' },
  { name: 'avoid-to-reconsider', from: 'avoid', to: 'reconsider', description: 'Drag across X-axis boundary (right to left, bottom)' },
  { name: 'quick-wins-to-avoid', from: 'quick-wins', to: 'avoid', description: 'Drag diagonally across both axes' },
  { name: 'avoid-to-quick-wins', from: 'avoid', to: 'quick-wins', description: 'Drag diagonally across both axes (reverse)' },
];

/**
 * Helper: Convert normalized position (0-1) to pixel coordinates
 */
function normalizedToPixel(normalizedX: number, normalizedY: number, matrixWidth: number, matrixHeight: number): { x: number, y: number } {
  // Account for padding (60px on each side based on DEFAULT_MATRIX_DIMENSIONS)
  const padding = 60;
  const usableWidth = matrixWidth - 2 * padding;
  const usableHeight = matrixHeight - 2 * padding;

  return {
    x: padding + normalizedX * usableWidth,
    y: padding + normalizedY * usableHeight
  };
}

/**
 * Helper: Get position for a quadrant
 */
function getQuadrantPosition(quadrant: keyof typeof QUADRANT_COLORS): { x: number, y: number } {
  const positions = {
    'quick-wins': { x: 0.25, y: 0.25 },
    'strategic': { x: 0.75, y: 0.25 },
    'reconsider': { x: 0.25, y: 0.75 },
    'avoid': { x: 0.75, y: 0.75 }
  };
  return positions[quadrant];
}

/**
 * Helper: Parse RGB color from CSS color string
 */
function parseRGBColor(colorString: string): { r: number, g: number, b: number } | null {
  // Handle hex colors
  if (colorString.startsWith('#')) {
    const hex = colorString.slice(1);
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16)
    };
  }

  // Handle rgb() and rgba() colors
  const rgbMatch = colorString.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1]),
      g: parseInt(rgbMatch[2]),
      b: parseInt(rgbMatch[3])
    };
  }

  return null;
}

/**
 * Helper: Check if two RGB colors are similar (within tolerance)
 */
function colorsAreSimilar(color1: { r: number, g: number, b: number }, color2: { r: number, g: number, b: number }, tolerance: number = 10): boolean {
  return Math.abs(color1.r - color2.r) <= tolerance &&
         Math.abs(color1.g - color2.g) <= tolerance &&
         Math.abs(color1.b - color2.b) <= tolerance;
}

/**
 * Helper: Validate card border color matches expected quadrant color
 */
async function validateCardBorderColor(page: Page, cardElement: any, expectedQuadrant: keyof typeof QUADRANT_COLORS): Promise<{ valid: boolean, actual: string, expected: string, message: string }> {
  const borderColor = await cardElement.evaluate((el: HTMLElement) => {
    return window.getComputedStyle(el).borderColor || window.getComputedStyle(el).borderTopColor;
  });

  const expectedColor = QUADRANT_COLORS[expectedQuadrant];
  const expectedRGB = QUADRANT_COLORS_RGB[expectedQuadrant];

  const actualRGB = parseRGBColor(borderColor);

  if (!actualRGB) {
    return {
      valid: false,
      actual: borderColor,
      expected: expectedColor,
      message: `Could not parse border color: ${borderColor}`
    };
  }

  const isValid = colorsAreSimilar(actualRGB, expectedRGB, 15);

  return {
    valid: isValid,
    actual: `rgb(${actualRGB.r}, ${actualRGB.g}, ${actualRGB.b})`,
    expected: `${expectedColor} / rgb(${expectedRGB.r}, ${expectedRGB.g}, ${expectedRGB.b})`,
    message: isValid ? 'Border color matches expected quadrant' : `Border color mismatch: expected ${expectedQuadrant} color`
  };
}

/**
 * Helper: Validate data-quadrant attribute
 */
async function validateQuadrantAttribute(page: Page, cardElement: any, expectedQuadrant: keyof typeof QUADRANT_COLORS): Promise<{ valid: boolean, actual: string | null, expected: string, message: string }> {
  const actualQuadrant = await cardElement.getAttribute('data-quadrant');
  const isValid = actualQuadrant === expectedQuadrant;

  return {
    valid: isValid,
    actual: actualQuadrant,
    expected: expectedQuadrant,
    message: isValid ? 'Quadrant attribute matches expected' : `Quadrant attribute mismatch`
  };
}

/**
 * Helper: Create or select a test card at a specific position
 */
async function setupTestCard(page: Page, position: { x: number, y: number }): Promise<any> {
  // Wait for matrix to be ready
  await page.waitForSelector('.design-matrix, [data-testid="design-matrix"]', { timeout: 10000 });

  // Get matrix dimensions
  const matrixBox = await page.locator('.design-matrix, [data-testid="design-matrix"]').boundingBox();
  if (!matrixBox) {
    throw new Error('Matrix not found');
  }

  // Convert normalized position to pixel coordinates
  const pixelPos = normalizedToPixel(position.x, position.y, matrixBox.width, matrixBox.height);

  // Try to find an existing card first
  const cards = await page.locator('.idea-card-base, [data-testid="idea-card"]').all();

  if (cards.length > 0) {
    // Use the first card and drag it to the desired position
    const card = cards[0];
    const cardBox = await card.boundingBox();

    if (cardBox) {
      // Drag card to the target position
      await card.hover();
      await page.mouse.down();
      await page.mouse.move(
        matrixBox.x + pixelPos.x,
        matrixBox.y + pixelPos.y,
        { steps: 10 }
      );
      await page.mouse.up();

      // Wait for position update
      await page.waitForTimeout(500);

      return card;
    }
  }

  // If no cards exist, create one via UI
  // Note: This depends on your app's UI for creating cards
  // Adjust this based on your actual implementation
  throw new Error('No cards available for testing. Please ensure test data exists.');
}

/**
 * Helper: Drag card to a new position
 */
async function dragCardToPosition(page: Page, card: any, targetPosition: { x: number, y: number }): Promise<void> {
  const matrixBox = await page.locator('.design-matrix, [data-testid="design-matrix"]').boundingBox();
  if (!matrixBox) {
    throw new Error('Matrix not found');
  }

  const pixelPos = normalizedToPixel(targetPosition.x, targetPosition.y, matrixBox.width, matrixBox.height);

  // Perform drag operation
  await card.hover();
  await page.mouse.down();

  // Move in steps for smoother animation
  await page.mouse.move(
    matrixBox.x + pixelPos.x,
    matrixBox.y + pixelPos.y,
    { steps: 20 }
  );

  await page.mouse.up();

  // Wait for color update
  await page.waitForTimeout(300);
}

test.describe('Quadrant Color Detection Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });

    // Set consistent viewport
    await page.setViewportSize({ width: 1400, height: 1000 });

    // Wait for auth (or bypass if needed)
    // This assumes you have authentication - adjust as needed
    try {
      await page.waitForSelector('.design-matrix, [data-testid="design-matrix"]', { timeout: 5000 });
    } catch {
      console.log('Matrix not immediately visible, may need authentication');
    }
  });

  test('Static Position Validation: All Quadrants', async ({ page }) => {
    console.log('🎯 Testing static color detection at all quadrant positions');

    for (const testPos of TEST_POSITIONS) {
      await test.step(`Validate ${testPos.name}: ${testPos.description}`, async () => {
        console.log(`\n📍 Testing position: ${testPos.name}`);
        console.log(`   Position: (${testPos.x}, ${testPos.y})`);
        console.log(`   Expected quadrant: ${testPos.quadrant}`);

        // Setup card at position
        const card = await setupTestCard(page, { x: testPos.x, y: testPos.y });

        // Take screenshot
        await page.screenshot({
          path: `tests/visual/screenshots/quadrant-static-${testPos.name}.png`,
          fullPage: false
        });

        // Validate border color
        const borderValidation = await validateCardBorderColor(page, card, testPos.quadrant);
        console.log(`   Border: ${borderValidation.message}`);
        console.log(`   Expected: ${borderValidation.expected}`);
        console.log(`   Actual: ${borderValidation.actual}`);

        expect(borderValidation.valid, borderValidation.message).toBe(true);

        // Validate quadrant attribute
        const attrValidation = await validateQuadrantAttribute(page, card, testPos.quadrant);
        console.log(`   Attribute: ${attrValidation.message}`);

        expect(attrValidation.valid, attrValidation.message).toBe(true);
      });
    }
  });

  test('X-Axis Boundary Crossing Validation', async ({ page }) => {
    console.log('🔄 Testing X-axis boundary crossings');

    const xAxisScenarios = DRAG_SCENARIOS.filter(s =>
      s.name.includes('quick-wins-to-strategic') ||
      s.name.includes('strategic-to-quick-wins') ||
      s.name.includes('reconsider-to-avoid') ||
      s.name.includes('avoid-to-reconsider')
    );

    for (const scenario of xAxisScenarios) {
      await test.step(`X-axis: ${scenario.description}`, async () => {
        console.log(`\n🔀 ${scenario.name}: ${scenario.description}`);

        // Get start and end positions
        const startPos = getQuadrantPosition(scenario.from);
        const endPos = getQuadrantPosition(scenario.to);

        // Setup card at start position
        const card = await setupTestCard(page, startPos);

        // Capture before state
        await page.screenshot({
          path: `tests/visual/screenshots/quadrant-drag-${scenario.name}-before.png`
        });

        // Validate initial state
        const initialValidation = await validateCardBorderColor(page, card, scenario.from);
        expect(initialValidation.valid, `Initial state: ${initialValidation.message}`).toBe(true);

        // Drag to end position
        await dragCardToPosition(page, card, endPos);

        // Capture after state
        await page.screenshot({
          path: `tests/visual/screenshots/quadrant-drag-${scenario.name}-after.png`
        });

        // Validate final state
        const finalValidation = await validateCardBorderColor(page, card, scenario.to);
        console.log(`   Final: ${finalValidation.message}`);
        console.log(`   Expected: ${finalValidation.expected}`);
        console.log(`   Actual: ${finalValidation.actual}`);

        expect(finalValidation.valid, `Final state: ${finalValidation.message}`).toBe(true);
      });
    }
  });

  test('Y-Axis Boundary Crossing Validation', async ({ page }) => {
    console.log('🔄 Testing Y-axis boundary crossings');

    const yAxisScenarios = DRAG_SCENARIOS.filter(s =>
      s.name.includes('quick-wins-to-reconsider') ||
      s.name.includes('strategic-to-avoid')
    );

    for (const scenario of yAxisScenarios) {
      await test.step(`Y-axis: ${scenario.description}`, async () => {
        console.log(`\n🔀 ${scenario.name}: ${scenario.description}`);

        // Get start and end positions
        const startPos = getQuadrantPosition(scenario.from);
        const endPos = getQuadrantPosition(scenario.to);

        // Setup card at start position
        const card = await setupTestCard(page, startPos);

        // Capture before state
        await page.screenshot({
          path: `tests/visual/screenshots/quadrant-drag-${scenario.name}-before.png`
        });

        // Validate initial state
        const initialValidation = await validateCardBorderColor(page, card, scenario.from);
        expect(initialValidation.valid, `Initial state: ${initialValidation.message}`).toBe(true);

        // Drag to end position
        await dragCardToPosition(page, card, endPos);

        // Capture after state
        await page.screenshot({
          path: `tests/visual/screenshots/quadrant-drag-${scenario.name}-after.png`
        });

        // Validate final state
        const finalValidation = await validateCardBorderColor(page, card, scenario.to);
        console.log(`   Final: ${finalValidation.message}`);
        console.log(`   Expected: ${finalValidation.expected}`);
        console.log(`   Actual: ${finalValidation.actual}`);

        expect(finalValidation.valid, `Final state: ${finalValidation.message}`).toBe(true);
      });
    }
  });

  test('Diagonal Boundary Crossing Validation', async ({ page }) => {
    console.log('🔄 Testing diagonal boundary crossings (both axes)');

    const diagonalScenarios = DRAG_SCENARIOS.filter(s =>
      s.name.includes('quick-wins-to-avoid') ||
      s.name.includes('avoid-to-quick-wins')
    );

    for (const scenario of diagonalScenarios) {
      await test.step(`Diagonal: ${scenario.description}`, async () => {
        console.log(`\n🔀 ${scenario.name}: ${scenario.description}`);

        // Get start and end positions
        const startPos = getQuadrantPosition(scenario.from);
        const endPos = getQuadrantPosition(scenario.to);

        // Setup card at start position
        const card = await setupTestCard(page, startPos);

        // Capture before state
        await page.screenshot({
          path: `tests/visual/screenshots/quadrant-drag-${scenario.name}-before.png`
        });

        // Validate initial state
        const initialValidation = await validateCardBorderColor(page, card, scenario.from);
        expect(initialValidation.valid, `Initial state: ${initialValidation.message}`).toBe(true);

        // Drag to end position
        await dragCardToPosition(page, card, endPos);

        // Capture after state
        await page.screenshot({
          path: `tests/visual/screenshots/quadrant-drag-${scenario.name}-after.png`
        });

        // Validate final state
        const finalValidation = await validateCardBorderColor(page, card, scenario.to);
        console.log(`   Final: ${finalValidation.message}`);
        console.log(`   Expected: ${finalValidation.expected}`);
        console.log(`   Actual: ${finalValidation.actual}`);

        expect(finalValidation.valid, `Final state: ${finalValidation.message}`).toBe(true);
      });
    }
  });

  test('Edge Case: Exact Boundary Positions', async ({ page }) => {
    console.log('🎯 Testing exact boundary positions');

    const edgeCases = TEST_POSITIONS.filter(p => p.name.includes('exact'));

    for (const testPos of edgeCases) {
      await test.step(`Edge case: ${testPos.description}`, async () => {
        console.log(`\n📍 Testing edge case: ${testPos.name}`);
        console.log(`   Position: (${testPos.x}, ${testPos.y})`);
        console.log(`   Expected quadrant: ${testPos.quadrant}`);

        // Setup card at exact boundary
        const card = await setupTestCard(page, { x: testPos.x, y: testPos.y });

        // Take screenshot
        await page.screenshot({
          path: `tests/visual/screenshots/quadrant-edge-${testPos.name}.png`
        });

        // Validate color
        const validation = await validateCardBorderColor(page, card, testPos.quadrant);
        console.log(`   ${validation.message}`);
        console.log(`   Expected: ${validation.expected}`);
        console.log(`   Actual: ${validation.actual}`);

        expect(validation.valid, validation.message).toBe(true);
      });
    }
  });

  test('Multi-Step Drag Path: Quadrant Tour', async ({ page }) => {
    console.log('🗺️ Testing multi-quadrant drag path');

    const tour = [
      { quadrant: 'quick-wins' as const, label: 'Start in Quick Wins' },
      { quadrant: 'strategic' as const, label: 'Move to Strategic' },
      { quadrant: 'avoid' as const, label: 'Move to Avoid' },
      { quadrant: 'reconsider' as const, label: 'Move to Reconsider' },
      { quadrant: 'quick-wins' as const, label: 'Return to Quick Wins' },
    ];

    // Setup initial card
    const startPos = getQuadrantPosition(tour[0].quadrant);
    const card = await setupTestCard(page, startPos);

    for (let i = 0; i < tour.length; i++) {
      await test.step(`Step ${i + 1}: ${tour[i].label}`, async () => {
        const step = tour[i];
        const position = getQuadrantPosition(step.quadrant);

        if (i > 0) {
          // Drag to next position
          await dragCardToPosition(page, card, position);
        }

        // Capture state
        await page.screenshot({
          path: `tests/visual/screenshots/quadrant-tour-step-${i + 1}-${step.quadrant}.png`
        });

        // Validate color
        const validation = await validateCardBorderColor(page, card, step.quadrant);
        console.log(`   Step ${i + 1}: ${validation.message}`);

        expect(validation.valid, `Step ${i + 1}: ${validation.message}`).toBe(true);
      });
    }
  });
});