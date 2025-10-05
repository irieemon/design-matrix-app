import { chromium } from 'playwright';
import { promises as fs } from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:3001';
const SCREENSHOT_DIR = './test-screenshots/card-analysis';

// Ensure screenshot directory exists
async function ensureScreenshotDir() {
  try {
    await fs.access(SCREENSHOT_DIR);
  } catch {
    await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
  }
}

// Take timestamped screenshot
async function takeScreenshot(page, name, description) {
  try {
    await ensureScreenshotDir();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[1].split('-')[0];
    const filename = `${name}-${timestamp}.png`;
    const fullPath = path.join(SCREENSHOT_DIR, filename);

    await page.screenshot({
      path: fullPath,
      fullPage: true
    });

    console.log(`📸 ${filename} - ${description || name}`);
    return fullPath;
  } catch (error) {
    console.log(`⚠️ Screenshot failed for ${name}: ${error.message}`);
  }
}

async function analyzeCardStructure() {
  console.log('🔍 Analyzing Card Structure and Components');
  console.log('=' .repeat(50));

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  try {
    // Navigate to matrix
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const matrixButton = page.locator('button:has-text("Design Matrix")');
    if (await matrixButton.isVisible()) {
      await matrixButton.click();
      await page.waitForTimeout(2000);
    }

    await takeScreenshot(page, 'matrix-loaded', 'Matrix page with all cards');

    // Analyze different card selectors
    console.log('\n📋 Card Selector Analysis:');
    const cardSelectors = [
      '.card',
      '[data-testid="idea-card"]',
      '.idea-card',
      '[class*="card"]',
      '.matrix-container .card',
      '.matrix-container [data-testid="idea-card"]'
    ];

    for (const selector of cardSelectors) {
      const count = await page.locator(selector).count();
      console.log(`   ${selector}: ${count} elements`);
    }

    // Focus on the .card selector since it found 8 elements
    console.log('\n🔍 Detailed Analysis of .card Elements:');

    const cards = page.locator('.card');
    const cardCount = await cards.count();

    for (let i = 0; i < Math.min(cardCount, 3); i++) {
      console.log(`\n--- Card ${i + 1} Analysis ---`);
      const card = cards.nth(i);

      // Get all text content
      const textContent = await card.allTextContents();
      console.log(`Text content: ${JSON.stringify(textContent)}`);

      // Get HTML structure
      const innerHTML = await card.innerHTML();
      console.log(`HTML structure: ${innerHTML.substring(0, 200)}...`);

      // Check for specific elements
      const buttons = await card.locator('button').count();
      const links = await card.locator('a').count();
      const icons = await card.locator('svg, [class*="icon"], .fa-').count();

      console.log(`Interactive elements: ${buttons} buttons, ${links} links, ${icons} icons`);

      // Check for data attributes
      const dataAttrs = await card.evaluate(el => {
        const attrs = {};
        for (let attr of el.attributes) {
          if (attr.name.startsWith('data-')) {
            attrs[attr.name] = attr.value;
          }
        }
        return attrs;
      });
      console.log(`Data attributes: ${JSON.stringify(dataAttrs)}`);

      // Check classes
      const classes = await card.getAttribute('class');
      console.log(`Classes: ${classes}`);

      // Take a focused screenshot of this card
      await card.scrollIntoViewIfNeeded();
      await takeScreenshot(page, `card-${i + 1}-analysis`, `Detailed view of card ${i + 1}`);
    }

    // Look for specific IdeaCard components
    console.log('\n🔍 Looking for IdeaCard Components:');

    const ideaCardSelectors = [
      '[data-testid="idea-card"]',
      '.idea-card-component',
      '[class*="IdeaCard"]',
      '.matrix-container [data-testid]'
    ];

    for (const selector of ideaCardSelectors) {
      const elements = page.locator(selector);
      const count = await elements.count();

      if (count > 0) {
        console.log(`✅ Found ${count} elements with selector: ${selector}`);

        const firstElement = elements.first();
        const text = await firstElement.allTextContents();
        const html = await firstElement.innerHTML();

        console.log(`   First element text: ${JSON.stringify(text)}`);
        console.log(`   First element HTML: ${html.substring(0, 150)}...`);

        await takeScreenshot(page, `ideacard-${selector.replace(/[^a-zA-Z0-9]/g, '_')}`, `IdeaCard found with ${selector}`);
      } else {
        console.log(`❌ No elements found with selector: ${selector}`);
      }
    }

    // Check if there are any edit buttons anywhere on the page
    console.log('\n🔍 Global Edit Button Search:');

    const editButtonSelectors = [
      'button[aria-label*="edit" i]',
      'button:has-text("Edit")',
      '.edit-button',
      '[data-action="edit"]',
      'svg[class*="edit"]',
      '.fa-edit',
      '.lucide-edit'
    ];

    for (const selector of editButtonSelectors) {
      const count = await page.locator(selector).count();
      if (count > 0) {
        console.log(`✅ Found ${count} edit buttons with selector: ${selector}`);

        const firstButton = page.locator(selector).first();
        await firstButton.scrollIntoViewIfNeeded();
        await firstButton.hover();
        await takeScreenshot(page, `edit-button-${selector.replace(/[^a-zA-Z0-9]/g, '_')}`, `Edit button found: ${selector}`);
      } else {
        console.log(`❌ No edit buttons found with selector: ${selector}`);
      }
    }

    // Check the entire page structure
    console.log('\n🔍 Matrix Container Structure Analysis:');

    const matrixContainer = page.locator('.matrix-container');
    if (await matrixContainer.isVisible()) {
      const matrixHTML = await matrixContainer.innerHTML();
      console.log(`Matrix container HTML (first 500 chars): ${matrixHTML.substring(0, 500)}...`);

      // Look for any React component markers
      const reactComponents = await page.evaluate(() => {
        const elements = document.querySelectorAll('*');
        const componentNames = new Set();

        elements.forEach(el => {
          // Check for React fiber node
          for (let key in el) {
            if (key.startsWith('__reactInternalInstance') || key.startsWith('__reactFiber')) {
              const fiber = el[key];
              if (fiber && fiber.type && fiber.type.name) {
                componentNames.add(fiber.type.name);
              }
            }
          }
        });

        return Array.from(componentNames);
      });

      console.log(`React components detected: ${JSON.stringify(Array.from(reactComponents))}`);
    }

    // Final comprehensive screenshot
    await takeScreenshot(page, 'final-analysis', 'Complete page analysis view');

    console.log('\n' + '=' .repeat(50));
    console.log('📊 Card Structure Analysis Complete');

  } catch (error) {
    console.error('❌ Analysis error:', error.message);
    await takeScreenshot(page, 'analysis-error', 'Error during card analysis');
  } finally {
    await browser.close();
  }
}

// Run the analysis
analyzeCardStructure().catch(console.error);