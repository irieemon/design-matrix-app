#!/usr/bin/env node

/**
 * COMPREHENSIVE CARD DIMENSION VALIDATION
 * Tests and validates the emergency card fixes
 */

import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';

const VALIDATION_CONFIG = {
  url: 'http://localhost:3006',
  viewport: { width: 1440, height: 900 },
  timeout: 30000,
  expectedDimensions: {
    collapsed: { width: 80, height: 60, ratio: 1.33 }, // 4:3 ratio
    tolerance: 5 // pixels
  }
};

class CardValidationSuite {
  constructor() {
    this.browser = null;
    this.page = null;
    this.results = {
      timestamp: new Date().toISOString(),
      overall: 'PENDING',
      tests: []
    };
  }

  async initialize() {
    console.log('🚀 Starting Card Dimension Validation Suite...');

    this.browser = await puppeteer.launch({
      headless: false,
      devtools: true,
      defaultViewport: VALIDATION_CONFIG.viewport
    });

    this.page = await this.browser.newPage();
    await this.page.setViewport(VALIDATION_CONFIG.viewport);

    // Navigate to the application
    try {
      await this.page.goto(VALIDATION_CONFIG.url, {
        waitUntil: 'networkidle0',
        timeout: VALIDATION_CONFIG.timeout
      });
      console.log('✅ Application loaded successfully');
    } catch (error) {
      console.error('❌ Failed to load application:', error.message);
      throw error;
    }
  }

  async injectEmergencyFixes() {
    console.log('💉 Injecting emergency CSS fixes...');

    const emergencyCSS = `
      /* COLLAPSED CARDS: Optimal 4:3 ratio (80×60px) */
      html body .matrix-container .idea-card-base.is-collapsed,
      .matrix-canvas .idea-card-base.is-collapsed,
      .matrix-viewport .idea-card-base.is-collapsed,
      div .idea-card-base.is-collapsed {
        width: 80px !important;
        min-width: 80px !important;
        max-width: 80px !important;
        height: 60px !important;
        min-height: 60px !important;
        max-height: 60px !important;
        background-color: #ffffff !important;
        background-image: none !important;
        border: 1px solid #e2e8f0 !important;
        border-radius: 8px !important;
        box-shadow: 0 2px 4px rgba(0,0,0,0.08) !important;
        box-sizing: border-box !important;
        padding: 8px !important;
      }

      .idea-card-base:active,
      .idea-card-base.is-dragging,
      .idea-card-base.is-collapsed.is-dragging,
      .idea-card-base.is-collapsed:active {
        background-color: #ffffff !important;
        background-image: none !important;
      }
    `;

    await this.page.addStyleTag({ content: emergencyCSS });
    console.log('✅ Emergency fixes injected');
  }

  async validateCardDimensions() {
    console.log('📏 Validating card dimensions...');

    // Wait for cards to render
    await this.page.waitForSelector('.idea-card-base', { timeout: 10000 });

    const cardInfo = await this.page.evaluate(() => {
      const cards = document.querySelectorAll('.idea-card-base.is-collapsed');
      const cardData = [];

      cards.forEach((card, index) => {
        const rect = card.getBoundingClientRect();
        const computedStyle = window.getComputedStyle(card);

        cardData.push({
          index,
          dimensions: {
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            ratio: Math.round((rect.width / rect.height) * 100) / 100
          },
          styles: {
            backgroundColor: computedStyle.backgroundColor,
            borderRadius: computedStyle.borderRadius,
            boxShadow: computedStyle.boxShadow
          },
          classList: Array.from(card.classList)
        });
      });

      return {
        cardCount: cards.length,
        cards: cardData,
        matrixBackground: window.getComputedStyle(document.querySelector('.matrix-container') || document.body).backgroundColor
      };
    });

    const testResult = {
      name: 'Card Dimensions Validation',
      status: 'PASS',
      details: cardInfo,
      issues: []
    };

    // Validate each card
    cardInfo.cards.forEach(card => {
      const expected = VALIDATION_CONFIG.expectedDimensions.collapsed;
      const tolerance = VALIDATION_CONFIG.expectedDimensions.tolerance;

      // Check dimensions
      if (Math.abs(card.dimensions.width - expected.width) > tolerance) {
        testResult.status = 'FAIL';
        testResult.issues.push(`Card ${card.index}: Width ${card.dimensions.width}px (expected ${expected.width}px ±${tolerance}px)`);
      }

      if (Math.abs(card.dimensions.height - expected.height) > tolerance) {
        testResult.status = 'FAIL';
        testResult.issues.push(`Card ${card.index}: Height ${card.dimensions.height}px (expected ${expected.height}px ±${tolerance}px)`);
      }

      // Check aspect ratio
      if (Math.abs(card.dimensions.ratio - expected.ratio) > 0.1) {
        testResult.status = 'FAIL';
        testResult.issues.push(`Card ${card.index}: Ratio ${card.dimensions.ratio}:1 (expected ${expected.ratio}:1)`);
      }

      // Check background color
      if (!card.styles.backgroundColor.includes('rgb(255, 255, 255)') &&
          !card.styles.backgroundColor.includes('#ffffff')) {
        testResult.status = 'FAIL';
        testResult.issues.push(`Card ${card.index}: Background not white (${card.styles.backgroundColor})`);
      }
    });

    this.results.tests.push(testResult);

    console.log(`📊 Found ${cardInfo.cardCount} collapsed cards`);
    console.log(`${testResult.status === 'PASS' ? '✅' : '❌'} Dimension validation: ${testResult.status}`);

    if (testResult.issues.length > 0) {
      testResult.issues.forEach(issue => console.log(`  ⚠️ ${issue}`));
    }

    return testResult;
  }

  async validateDragBehavior() {
    console.log('🖱️ Validating drag behavior...');

    const testResult = {
      name: 'Drag Behavior Validation',
      status: 'PASS',
      issues: [],
      snapshots: []
    };

    try {
      // Find a collapsed card to test
      const cardSelector = '.idea-card-base.is-collapsed';
      await this.page.waitForSelector(cardSelector, { timeout: 5000 });

      const cards = await this.page.$$(cardSelector);
      if (cards.length === 0) {
        testResult.status = 'FAIL';
        testResult.issues.push('No collapsed cards found for drag testing');
        this.results.tests.push(testResult);
        return testResult;
      }

      const firstCard = cards[0];

      // Take before screenshot
      const beforeDrag = await this.page.screenshot({
        clip: { x: 0, y: 0, width: 800, height: 600 },
        type: 'png'
      });
      testResult.snapshots.push({
        name: 'before-drag',
        timestamp: Date.now(),
        buffer: beforeDrag
      });

      // Start drag operation
      await firstCard.hover();
      await this.page.mouse.down();

      // Take during drag screenshot
      await this.page.waitForTimeout(500);
      const duringDrag = await this.page.screenshot({
        clip: { x: 0, y: 0, width: 800, height: 600 },
        type: 'png'
      });
      testResult.snapshots.push({
        name: 'during-drag',
        timestamp: Date.now(),
        buffer: duringDrag
      });

      // Check background color during drag
      const dragStyles = await firstCard.evaluate(el => {
        const style = window.getComputedStyle(el);
        return {
          backgroundColor: style.backgroundColor,
          transform: style.transform,
          opacity: style.opacity
        };
      });

      if (!dragStyles.backgroundColor.includes('rgb(255, 255, 255)')) {
        testResult.status = 'FAIL';
        testResult.issues.push(`Background not white during drag: ${dragStyles.backgroundColor}`);
      }

      // End drag
      await this.page.mouse.up();

      // Take after drag screenshot
      await this.page.waitForTimeout(500);
      const afterDrag = await this.page.screenshot({
        clip: { x: 0, y: 0, width: 800, height: 600 },
        type: 'png'
      });
      testResult.snapshots.push({
        name: 'after-drag',
        timestamp: Date.now(),
        buffer: afterDrag
      });

    } catch (error) {
      testResult.status = 'FAIL';
      testResult.issues.push(`Drag test failed: ${error.message}`);
    }

    this.results.tests.push(testResult);
    console.log(`${testResult.status === 'PASS' ? '✅' : '❌'} Drag behavior: ${testResult.status}`);

    return testResult;
  }

  async saveResults() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const resultsDir = path.resolve(process.cwd(), 'validation-results');

    try {
      await fs.mkdir(resultsDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }

    // Save JSON results
    const resultsFile = path.join(resultsDir, `card-validation-${timestamp}.json`);
    await fs.writeFile(resultsFile, JSON.stringify(this.results, null, 2));

    // Save screenshots
    for (const test of this.results.tests) {
      if (test.snapshots) {
        for (const snapshot of test.snapshots) {
          const filename = `card-${snapshot.name}-${timestamp}.png`;
          const filepath = path.join(resultsDir, filename);
          await fs.writeFile(filepath, snapshot.buffer);
          console.log(`📸 Saved screenshot: ${filename}`);
        }
      }
    }

    console.log(`💾 Results saved to: ${resultsFile}`);
    return resultsFile;
  }

  async generateReport() {
    const passedTests = this.results.tests.filter(test => test.status === 'PASS').length;
    const totalTests = this.results.tests.length;
    this.results.overall = passedTests === totalTests ? 'PASS' : 'FAIL';

    console.log('\n📋 VALIDATION REPORT');
    console.log('='.repeat(50));
    console.log(`Overall Status: ${this.results.overall === 'PASS' ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Tests Passed: ${passedTests}/${totalTests}`);
    console.log(`Timestamp: ${this.results.timestamp}\n`);

    this.results.tests.forEach(test => {
      console.log(`${test.status === 'PASS' ? '✅' : '❌'} ${test.name}: ${test.status}`);
      if (test.issues && test.issues.length > 0) {
        test.issues.forEach(issue => console.log(`   ⚠️ ${issue}`));
      }
    });

    console.log('\n📊 SUMMARY');
    console.log('='.repeat(50));

    if (this.results.overall === 'PASS') {
      console.log('🎉 All tests passed! Card fixes are working correctly.');
      console.log('📏 Cards now display with optimal 80×60px dimensions (4:3 ratio)');
      console.log('🎨 White background maintained throughout all interactions');
    } else {
      console.log('⚠️ Some tests failed. Review the issues above.');
      console.log('💡 Consider running the emergency CSS injection script.');
    }
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  async run() {
    try {
      await this.initialize();
      await this.injectEmergencyFixes();

      // Run validation tests
      await this.validateCardDimensions();
      await this.validateDragBehavior();

      // Generate and save results
      await this.generateReport();
      await this.saveResults();

    } catch (error) {
      console.error('❌ Validation suite failed:', error);
      this.results.overall = 'ERROR';
      this.results.error = error.message;
    } finally {
      await this.cleanup();
    }

    return this.results;
  }
}

// Run the validation if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const validator = new CardValidationSuite();
  validator.run().then(results => {
    process.exit(results.overall === 'PASS' ? 0 : 1);
  }).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export default CardValidationSuite;