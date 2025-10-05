import { test, expect } from '@playwright/test';
import * as fs from 'fs';

test.setTimeout(90000); // 90 second timeout

test('Validate quadrant colors', async ({ page }) => {
  console.log('Step 1: Navigating to app...');
  await page.goto('http://localhost:3003', { waitUntil: 'domcontentloaded', timeout: 15000 });

  console.log('Step 2: Looking for Demo Mode button...');
  const demoButton = page.locator('button:has-text("Demo Mode")');
  await demoButton.waitFor({ state: 'visible', timeout: 15000 });
  await demoButton.click();

  console.log('Step 3: Waiting for navigation...');
  await page.waitForTimeout(3000);

  console.log('Step 4: Finding matrix navigation...');
  const matrixNav = page.locator('text=Design Matrix').first();
  await matrixNav.waitFor({ state: 'visible', timeout: 15000 });
  await matrixNav.click();

  console.log('Step 5: Waiting for matrix to load...');
  await page.waitForTimeout(5000);

  console.log('Step 6: Taking screenshot...');
  await page.screenshot({ path: 'quadrant-validation-screenshot.png', fullPage: true });

  console.log('Step 7: Finding matrix container...');
  const matrixContainer = page.locator('.matrix-workspace, [class*="matrix"]').first();
  await matrixContainer.waitFor({ state: 'visible', timeout: 10000 });

  const matrixBox = await matrixContainer.boundingBox();
  if (!matrixBox) throw new Error('No matrix dimensions');

  const centerX = matrixBox.x + matrixBox.width / 2;
  const centerY = matrixBox.y + matrixBox.height / 2;

  console.log(`Matrix center: (${centerX}, ${centerY})`);

  console.log('Step 8: Finding cards...');
  const cards = page.locator('[class*="card"]').filter({ has: page.locator('text=/./') });
  const count = await cards.count();
  console.log(`Found ${count} cards`);

  const results: any = {
    timestamp: new Date().toISOString(),
    matrixCenter: { x: centerX, y: centerY },
    cards: [],
    mismatches: []
  };

  for (let i = 0; i < Math.min(count, 20); i++) {
    const card = cards.nth(i);
    const box = await card.boundingBox();
    if (!box) continue;

    const cardCenterX = box.x + box.width / 2;
    const cardCenterY = box.y + box.height / 2;

    const quadrant =
      cardCenterY < centerY
        ? (cardCenterX < centerX ? 'top-left' : 'top-right')
        : (cardCenterX < centerX ? 'bottom-left' : 'bottom-right');

    const expectedColors: Record<string, string[]> = {
      'top-left': ['rgb(34, 197, 94)', 'rgb(22, 163, 74)'],
      'top-right': ['rgb(59, 130, 246)', 'rgb(37, 99, 235)'],
      'bottom-left': ['rgb(251, 146, 60)', 'rgb(249, 115, 22)', 'rgb(245, 158, 11)'],
      'bottom-right': ['rgb(239, 68, 68)', 'rgb(220, 38, 38)']
    };

    const borderColor = await card.evaluate(el =>
      window.getComputedStyle(el).borderTopColor || window.getComputedStyle(el).borderColor
    );

    const title = await card.evaluate(el => {
      const t = el.querySelector('[class*="title"], h3, h4');
      return t?.textContent?.trim() || 'Unknown';
    });

    const matches = expectedColors[quadrant].some(c => borderColor.includes(c));

    const cardData = {
      index: i,
      title,
      position: { x: cardCenterX.toFixed(0), y: cardCenterY.toFixed(0) },
      quadrant,
      expectedColor: quadrant,
      actualColor: borderColor,
      matches
    };

    results.cards.push(cardData);
    if (!matches) results.mismatches.push(cardData);

    console.log(`Card ${i}: ${title} @ (${cardCenterX.toFixed(0)},${cardCenterY.toFixed(0)}) - ${quadrant} - ${matches ? '✅' : '❌'}`);
  }

  results.summary = {
    total: results.cards.length,
    correct: results.cards.filter((c: any) => c.matches).length,
    incorrect: results.mismatches.length
  };

  console.log('\n=== SUMMARY ===');
  console.log(`Total: ${results.summary.total}`);
  console.log(`Correct: ${results.summary.correct}`);
  console.log(`Incorrect: ${results.summary.incorrect}`);

  fs.writeFileSync('quadrant-color-actual-validation.json', JSON.stringify(results, null, 2));
  console.log('\n✅ Results saved to quadrant-color-actual-validation.json');

  if (results.mismatches.length > 0) {
    console.log('\n❌ MISMATCHES FOUND:');
    results.mismatches.forEach((m: any, idx: number) => {
      console.log(`${idx + 1}. ${m.title} - Quadrant: ${m.quadrant}, Color: ${m.actualColor}`);
    });
  }
});