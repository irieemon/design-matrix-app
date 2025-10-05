#!/usr/bin/env node

/**
 * SIMPLE CARD DIMENSION TEST
 * Quick validation to see current page state and apply fixes
 */

import puppeteer from 'puppeteer';
import fs from 'fs/promises';

async function simpleCardTest() {
  console.log('🚀 Starting Simple Card Test...');

  const browser = await puppeteer.launch({
    headless: false,
    devtools: true,
    defaultViewport: { width: 1440, height: 900 }
  });

  const page = await browser.newPage();

  try {
    // Navigate to app
    console.log('📍 Loading http://localhost:3006...');
    await page.goto('http://localhost:3006', {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // Take initial screenshot
    const initialScreenshot = await page.screenshot({
      fullPage: true,
      type: 'png'
    });
    await fs.writeFile('initial-page-state.png', initialScreenshot);
    console.log('📸 Initial screenshot saved as: initial-page-state.png');

    // Check page content
    const pageInfo = await page.evaluate(() => {
      const title = document.title;
      const url = window.location.href;

      // Check for various selectors
      const selectors = [
        '.idea-card-base',
        '.idea-card-base.is-collapsed',
        '.matrix-container',
        '.matrix-canvas',
        '.auth-container',
        '.login-form',
        '[data-testid="auth-screen"]',
        'button',
        'input'
      ];

      const elements = {};
      selectors.forEach(selector => {
        const found = document.querySelectorAll(selector);
        elements[selector] = found.length;
      });

      return {
        title,
        url,
        elements,
        bodyText: document.body.innerText.slice(0, 500)
      };
    });

    console.log('\n📊 PAGE ANALYSIS:');
    console.log('Title:', pageInfo.title);
    console.log('URL:', pageInfo.url);
    console.log('\nElements found:');
    Object.entries(pageInfo.elements).forEach(([selector, count]) => {
      console.log(`  ${selector}: ${count}`);
    });

    console.log('\nPage content preview:');
    console.log(pageInfo.bodyText.slice(0, 200) + '...');

    // If we find cards, apply fixes and test
    if (pageInfo.elements['.idea-card-base'] > 0 || pageInfo.elements['.idea-card-base.is-collapsed'] > 0) {
      console.log('\n🎯 Cards found! Applying emergency fixes...');

      await page.addStyleTag({
        content: `
          /* EMERGENCY CARD FIXES */
          .idea-card-base.is-collapsed {
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
          }

          .idea-card-base:active,
          .idea-card-base.is-dragging {
            background-color: #ffffff !important;
            background-image: none !important;
          }

          .emergency-test-indicator {
            border: 3px solid #10b981 !important;
            animation: pulse 2s infinite !important;
          }

          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
          }
        `
      });

      // Apply test indicators
      await page.evaluate(() => {
        const cards = document.querySelectorAll('.idea-card-base.is-collapsed');
        cards.forEach(card => {
          card.classList.add('emergency-test-indicator');
        });
      });

      // Wait and take after screenshot
      await page.waitForTimeout(2000);
      const afterScreenshot = await page.screenshot({
        fullPage: true,
        type: 'png'
      });
      await fs.writeFile('after-fix-state.png', afterScreenshot);
      console.log('📸 After-fix screenshot saved as: after-fix-state.png');

      // Analyze card dimensions
      const cardAnalysis = await page.evaluate(() => {
        const cards = document.querySelectorAll('.idea-card-base.is-collapsed');
        const cardData = [];

        cards.forEach((card, index) => {
          const rect = card.getBoundingClientRect();
          const style = window.getComputedStyle(card);

          cardData.push({
            index,
            dimensions: {
              width: Math.round(rect.width),
              height: Math.round(rect.height),
              ratio: Math.round((rect.width / rect.height) * 100) / 100
            },
            position: {
              x: Math.round(rect.x),
              y: Math.round(rect.y)
            },
            styles: {
              backgroundColor: style.backgroundColor,
              borderRadius: style.borderRadius
            }
          });
        });

        return cardData;
      });

      console.log('\n📏 CARD ANALYSIS:');
      cardAnalysis.forEach(card => {
        console.log(`Card ${card.index}:`);
        console.log(`  Dimensions: ${card.dimensions.width}×${card.dimensions.height}px`);
        console.log(`  Ratio: ${card.dimensions.ratio}:1`);
        console.log(`  Position: (${card.position.x}, ${card.position.y})`);
        console.log(`  Background: ${card.styles.backgroundColor}`);
      });

      // Check if dimensions match target (80×60px)
      const targetWidth = 80;
      const targetHeight = 60;
      const tolerance = 5;

      const validCards = cardAnalysis.filter(card =>
        Math.abs(card.dimensions.width - targetWidth) <= tolerance &&
        Math.abs(card.dimensions.height - targetHeight) <= tolerance
      );

      console.log(`\n✅ ${validCards.length}/${cardAnalysis.length} cards match target dimensions (80×60px ±${tolerance}px)`);

      if (validCards.length === cardAnalysis.length) {
        console.log('🎉 ALL CARDS FIXED! Emergency CSS is working correctly.');
      } else {
        console.log('⚠️ Some cards may need additional CSS specificity.');
      }

    } else {
      console.log('\n❓ No cards found on page. Possible reasons:');
      console.log('  - Page requires authentication');
      console.log('  - Need to navigate to matrix page');
      console.log('  - Cards are loaded dynamically');

      // Check if this is an auth page
      if (pageInfo.elements['.auth-container'] > 0 ||
          pageInfo.elements['.login-form'] > 0 ||
          pageInfo.elements['[data-testid="auth-screen"]'] > 0) {
        console.log('\n🔐 This appears to be an authentication page.');
        console.log('✅ This is expected - cards will be visible after login.');
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }

  // Keep browser open for manual inspection
  console.log('\n🔍 Browser left open for manual inspection.');
  console.log('📋 You can now manually:');
  console.log('  1. Navigate to the matrix page');
  console.log('  2. Login if needed');
  console.log('  3. Observe card dimensions');
  console.log('  4. Test drag operations');

  // Don't close the browser automatically
  // await browser.close();

  return browser;
}

// Run the test
simpleCardTest().then(browser => {
  console.log('\n🎯 Test complete. Browser instance available for inspection.');
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});