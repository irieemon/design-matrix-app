import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

interface CardData {
  ideaId: string;
  title: string;
  visualPosition: {
    x: number;
    y: number;
    width: number;
    height: number;
    centerX: number;
    centerY: number;
  };
  visualQuadrant: string;
  expectedColor: string;
  actualBorderColor: string;
  actualBorderColorRGB: string;
  matches: boolean;
  offsetError?: {
    x: number;
    y: number;
    distance: number;
  };
}

interface ValidationResults {
  timestamp: string;
  matrixDimensions: {
    width: number;
    height: number;
    centerX: number;
    centerY: number;
  };
  cards: CardData[];
  summary: {
    totalCards: number;
    matchingCards: number;
    mismatchedCards: number;
    percentageCorrect: number;
    averageOffsetError?: number;
  };
  mismatches: CardData[];
}

test.describe('Quadrant Color Detection Validation', () => {
  test('Validate actual card positions and colors', async ({ page }) => {
    // Navigate to the application
    await page.goto('http://localhost:3003');
    await page.waitForLoadState('networkidle');

    // Login with Demo Mode
    console.log('Logging in with Demo Mode...');
    const demoButton = page.locator('button:has-text("Demo Mode")');
    await demoButton.waitFor({ state: 'visible', timeout: 10000 });
    await demoButton.click();

    // Wait for navigation and initial load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Navigate to Design Matrix
    console.log('Navigating to Design Matrix...');
    const matrixNavButton = page.locator('button:has-text("Design Matrix"), a:has-text("Design Matrix")').first();
    await matrixNavButton.waitFor({ state: 'visible', timeout: 10000 });
    await matrixNavButton.click();

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Wait for matrix container to be visible
    const matrixContainer = page.locator('[class*="matrix-container"], [class*="design-matrix"], .matrix-workspace, [data-testid="matrix-container"]').first();
    await matrixContainer.waitFor({ state: 'visible', timeout: 10000 });
    await page.waitForTimeout(2000);

    // Take initial screenshot
    await page.screenshot({
      path: 'quadrant-color-validation-full-page.png',
      fullPage: true
    });

    // Get matrix dimensions and center point
    const matrixDimensions = await matrixContainer.boundingBox();
    if (!matrixDimensions) {
      throw new Error('Could not get matrix dimensions');
    }

    const matrixCenterX = matrixDimensions.x + (matrixDimensions.width / 2);
    const matrixCenterY = matrixDimensions.y + (matrixDimensions.height / 2);

    console.log('Matrix dimensions:', {
      x: matrixDimensions.x,
      y: matrixDimensions.y,
      width: matrixDimensions.width,
      height: matrixDimensions.height,
      centerX: matrixCenterX,
      centerY: matrixCenterY
    });

    // Find all idea cards
    const cardSelectors = [
      '[class*="idea-card"]',
      '[class*="card"]',
      '[data-testid="idea-card"]',
      '.draggable-card'
    ];

    let cards = page.locator('');
    for (const selector of cardSelectors) {
      const potentialCards = page.locator(selector);
      const count = await potentialCards.count();
      if (count > 0) {
        cards = potentialCards;
        console.log(`Found ${count} cards using selector: ${selector}`);
        break;
      }
    }

    const cardCount = await cards.count();
    console.log(`Total cards found: ${cardCount}`);

    if (cardCount === 0) {
      throw new Error('No cards found on the matrix');
    }

    // Color definitions based on requirements
    const colorMap: Record<string, { expected: string; variants: string[] }> = {
      'top-left': {
        expected: 'GREEN',
        variants: ['rgb(34, 197, 94)', 'rgb(22, 163, 74)', 'rgb(21, 128, 61)']
      },
      'top-right': {
        expected: 'BLUE',
        variants: ['rgb(59, 130, 246)', 'rgb(37, 99, 235)', 'rgb(29, 78, 216)']
      },
      'bottom-left': {
        expected: 'AMBER/ORANGE',
        variants: ['rgb(251, 146, 60)', 'rgb(249, 115, 22)', 'rgb(234, 88, 12)', 'rgb(245, 158, 11)']
      },
      'bottom-right': {
        expected: 'RED',
        variants: ['rgb(239, 68, 68)', 'rgb(220, 38, 38)', 'rgb(185, 28, 28)']
      }
    };

    // Helper function to determine quadrant based on visual position
    const getVisualQuadrant = (centerX: number, centerY: number): string => {
      const isLeft = centerX < matrixCenterX;
      const isTop = centerY < matrixCenterY;

      if (isTop && isLeft) return 'top-left';
      if (isTop && !isLeft) return 'top-right';
      if (!isTop && isLeft) return 'bottom-left';
      return 'bottom-right';
    };

    // Helper function to check if color matches expected variants
    const matchesExpectedColor = (actualColor: string, expectedVariants: string[]): boolean => {
      return expectedVariants.some(variant => actualColor.includes(variant));
    };

    // Collect data for all cards
    const cardsData: CardData[] = [];

    for (let i = 0; i < cardCount; i++) {
      const card = cards.nth(i);

      // Get card position
      const boundingBox = await card.boundingBox();
      if (!boundingBox) continue;

      const centerX = boundingBox.x + (boundingBox.width / 2);
      const centerY = boundingBox.y + (boundingBox.height / 2);

      // Determine visual quadrant
      const visualQuadrant = getVisualQuadrant(centerX, centerY);
      const expectedColorInfo = colorMap[visualQuadrant];

      // Get computed border color
      const borderColor = await card.evaluate((el) => {
        const styles = window.getComputedStyle(el);
        return {
          borderTopColor: styles.borderTopColor,
          borderRightColor: styles.borderRightColor,
          borderBottomColor: styles.borderBottomColor,
          borderLeftColor: styles.borderLeftColor,
          borderColor: styles.borderColor
        };
      });

      // Use the most prominent border color (usually borderTopColor or borderLeftColor)
      const actualBorderColorRGB = borderColor.borderTopColor || borderColor.borderLeftColor || borderColor.borderColor;

      // Get card title/ID for identification
      const cardTitle = await card.evaluate((el) => {
        const titleEl = el.querySelector('[class*="title"], h3, h4, .card-title');
        return titleEl ? titleEl.textContent?.trim() || 'Unknown' : 'Unknown';
      });

      const ideaId = await card.getAttribute('data-idea-id') || `card-${i}`;

      // Check if color matches
      const matches = matchesExpectedColor(actualBorderColorRGB, expectedColorInfo.variants);

      // Calculate offset error if there's a mismatch
      let offsetError;
      if (!matches) {
        offsetError = {
          x: centerX - matrixCenterX,
          y: centerY - matrixCenterY,
          distance: Math.sqrt(
            Math.pow(centerX - matrixCenterX, 2) +
            Math.pow(centerY - matrixCenterY, 2)
          )
        };
      }

      const cardData: CardData = {
        ideaId,
        title: cardTitle,
        visualPosition: {
          x: boundingBox.x,
          y: boundingBox.y,
          width: boundingBox.width,
          height: boundingBox.height,
          centerX,
          centerY
        },
        visualQuadrant,
        expectedColor: expectedColorInfo.expected,
        actualBorderColor: expectedColorInfo.expected, // We'll update this based on detection
        actualBorderColorRGB,
        matches,
        offsetError
      };

      cardsData.push(cardData);

      console.log(`Card ${i + 1}: ${cardTitle}`);
      console.log(`  Position: (${centerX.toFixed(0)}, ${centerY.toFixed(0)})`);
      console.log(`  Visual Quadrant: ${visualQuadrant}`);
      console.log(`  Expected Color: ${expectedColorInfo.expected}`);
      console.log(`  Actual Border Color: ${actualBorderColorRGB}`);
      console.log(`  Matches: ${matches ? '✅' : '❌'}`);
      if (offsetError) {
        console.log(`  Offset Error: (${offsetError.x.toFixed(0)}, ${offsetError.y.toFixed(0)}) - Distance: ${offsetError.distance.toFixed(0)}px`);
      }
    }

    // Calculate summary statistics
    const matchingCards = cardsData.filter(c => c.matches);
    const mismatchedCards = cardsData.filter(c => !c.matches);
    const averageOffsetError = mismatchedCards.length > 0
      ? mismatchedCards.reduce((sum, c) => sum + (c.offsetError?.distance || 0), 0) / mismatchedCards.length
      : 0;

    const results: ValidationResults = {
      timestamp: new Date().toISOString(),
      matrixDimensions: {
        width: matrixDimensions.width,
        height: matrixDimensions.height,
        centerX: matrixCenterX,
        centerY: matrixCenterY
      },
      cards: cardsData,
      summary: {
        totalCards: cardsData.length,
        matchingCards: matchingCards.length,
        mismatchedCards: mismatchedCards.length,
        percentageCorrect: (matchingCards.length / cardsData.length) * 100,
        averageOffsetError: averageOffsetError
      },
      mismatches: mismatchedCards
    };

    // Save results to file
    const resultsPath = path.join(process.cwd(), 'quadrant-color-actual-validation.json');
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));

    console.log('\n=== VALIDATION SUMMARY ===');
    console.log(`Total Cards: ${results.summary.totalCards}`);
    console.log(`Matching Cards: ${results.summary.matchingCards} (${results.summary.percentageCorrect.toFixed(1)}%)`);
    console.log(`Mismatched Cards: ${results.summary.mismatchedCards}`);
    if (results.summary.averageOffsetError) {
      console.log(`Average Offset Error: ${results.summary.averageOffsetError.toFixed(0)}px`);
    }

    if (mismatchedCards.length > 0) {
      console.log('\n=== MISMATCHES ===');
      mismatchedCards.forEach((card, idx) => {
        console.log(`\n${idx + 1}. ${card.title} (${card.ideaId})`);
        console.log(`   Visual Position: (${card.visualPosition.centerX.toFixed(0)}, ${card.visualPosition.centerY.toFixed(0)})`);
        console.log(`   Visual Quadrant: ${card.visualQuadrant}`);
        console.log(`   Expected: ${card.expectedColor}`);
        console.log(`   Actual: ${card.actualBorderColorRGB}`);
        if (card.offsetError) {
          console.log(`   Offset: (${card.offsetError.x.toFixed(0)}, ${card.offsetError.y.toFixed(0)}) - ${card.offsetError.distance.toFixed(0)}px from center`);
        }
      });
    }

    console.log(`\n✅ Results saved to: ${resultsPath}`);

    // Take final screenshot of matrix only
    await matrixContainer.screenshot({
      path: 'quadrant-color-validation-matrix.png'
    });

    // Fail test if there are mismatches
    expect(mismatchedCards.length).toBe(0);
  });
});