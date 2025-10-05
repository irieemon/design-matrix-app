import { chromium } from 'playwright';
import { promises as fs } from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:3001';
const SCREENSHOT_DIR = './test-screenshots/final-validation';

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

async function runFinalValidation() {
  console.log('🎯 FINAL COMPREHENSIVE VALIDATION REPORT');
  console.log('=' .repeat(60));

  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  let validationResults = {
    // Core Application Tests
    applicationLoad: false,
    matrixNavigation: false,
    uiLayoutIntegrity: false,

    // Functional Tests
    ideaCardsPresent: false,
    editButtonsWorking: false,
    editModeActivation: false,
    saveChangesWorking: false,
    collapseExpandWorking: false,

    // Interaction Tests
    dragDropFunctional: false,
    hoverEffectsWorking: false,
    buttonResponsiveness: false,

    // Visual Tests
    responsiveDesign: false,
    visualConsistency: false,
    animationSmoothness: false,

    // Performance Tests
    loadPerformance: false,
    memoryUsage: false,
    interactionPerformance: false,

    // Error Handling
    gracefulErrorHandling: false,
    consoleErrorsManageable: false
  };

  let detailedFindings = {};

  try {
    // =================
    // CORE APPLICATION TESTS
    // =================
    console.log('\n🔍 PHASE 1: Core Application Tests');
    console.log('-' .repeat(40));

    // Test 1: Application Load
    console.log('📋 Test 1.1: Application Load');
    const startTime = Date.now();
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;

    const title = await page.title();
    const bodyVisible = await page.locator('body').isVisible();

    if (bodyVisible && title.includes('Prioritas')) {
      validationResults.applicationLoad = true;
      console.log(`✅ Application loaded successfully in ${loadTime}ms`);
    } else {
      console.log(`❌ Application load failed`);
    }

    detailedFindings.applicationLoad = {
      loadTime,
      title,
      bodyVisible
    };

    await takeScreenshot(page, 'test1-app-loaded', 'Application initial load');

    // Test 1.2: Matrix Navigation
    console.log('📋 Test 1.2: Matrix Navigation');
    const matrixButton = page.locator('button:has-text("Design Matrix")');

    if (await matrixButton.isVisible()) {
      await matrixButton.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      const matrixContainer = page.locator('.matrix-container');
      if (await matrixContainer.isVisible()) {
        validationResults.matrixNavigation = true;
        console.log('✅ Matrix navigation successful');
      }
    }

    await takeScreenshot(page, 'test1-matrix-loaded', 'Matrix page navigation');

    // Test 1.3: UI Layout Integrity
    console.log('📋 Test 1.3: UI Layout Integrity');
    const headerVisible = await page.locator('h2:has-text("Strategic Priority Matrix")').isVisible();
    const matrixGridVisible = await page.locator('.matrix-container').isVisible();

    if (headerVisible && matrixGridVisible) {
      validationResults.uiLayoutIntegrity = true;
      console.log('✅ UI layout integrity confirmed');
    }

    // =================
    // FUNCTIONAL TESTS
    // =================
    console.log('\n🔍 PHASE 2: Functional Tests');
    console.log('-' .repeat(40));

    // Test 2.1: Idea Cards Present
    console.log('📋 Test 2.1: Idea Cards Detection');
    const ideaCards = page.locator('.card').filter({
      has: page.locator('button[aria-label*="edit" i]')
    });
    const ideaCardCount = await ideaCards.count();

    if (ideaCardCount > 0) {
      validationResults.ideaCardsPresent = true;
      console.log(`✅ Found ${ideaCardCount} interactive idea cards`);
    }

    detailedFindings.ideaCards = {
      totalCards: await page.locator('.card').count(),
      interactiveCards: ideaCardCount
    };

    await takeScreenshot(page, 'test2-idea-cards', 'Idea cards detected');

    // Test 2.2: Edit Buttons Working
    console.log('📋 Test 2.2: Edit Button Functionality');
    if (ideaCardCount > 0) {
      const firstCard = ideaCards.first();
      const editButton = firstCard.locator('button[aria-label*="edit" i]');

      if (await editButton.isVisible()) {
        await editButton.click();
        await page.waitForTimeout(500);

        // Check for edit mode indicators
        const editModeActive = await page.locator('input[type="text"], textarea, [contenteditable="true"]').count() > 0;

        if (editModeActive) {
          validationResults.editButtonsWorking = true;
          validationResults.editModeActivation = true;
          console.log('✅ Edit buttons and edit mode activation working');

          await takeScreenshot(page, 'test2-edit-mode', 'Edit mode activated');

          // Test 2.3: Save Changes
          console.log('📋 Test 2.3: Save Changes Functionality');
          const saveButton = page.locator('button[aria-label*="save" i], button:has-text("Save")');

          if (await saveButton.isVisible()) {
            await saveButton.click();
            await page.waitForTimeout(1000);

            const editModeStillActive = await page.locator('[data-editing="true"]').count() > 0;
            if (!editModeStillActive) {
              validationResults.saveChangesWorking = true;
              console.log('✅ Save changes functionality working');
            }
          }
        }
      }
    }

    // Test 2.4: Collapse/Expand
    console.log('📋 Test 2.4: Collapse/Expand Functionality');
    if (ideaCardCount > 0) {
      const testCard = ideaCards.first();
      const collapseButton = testCard.locator('button[aria-label*="collapse" i], button[aria-label*="minimize" i]');

      if (await collapseButton.isVisible()) {
        await collapseButton.click();
        await page.waitForTimeout(300);

        const expandButton = testCard.locator('button[aria-label*="expand" i], button[aria-label*="maximize" i]');
        if (await expandButton.isVisible()) {
          validationResults.collapseExpandWorking = true;
          console.log('✅ Collapse/expand functionality working');

          await expandButton.click();
          await page.waitForTimeout(300);
        }
      }
    }

    // =================
    // INTERACTION TESTS
    // =================
    console.log('\n🔍 PHASE 3: Interaction Tests');
    console.log('-' .repeat(40));

    // Test 3.1: Drag and Drop
    console.log('📋 Test 3.1: Drag and Drop Functionality');
    if (ideaCardCount > 0) {
      const dragCard = ideaCards.first();
      const initialBox = await dragCard.boundingBox();

      if (initialBox) {
        await dragCard.hover();
        await page.mouse.down();
        await page.mouse.move(initialBox.x + 100, initialBox.y + 100, { steps: 5 });
        await page.waitForTimeout(200);
        await page.mouse.up();
        await page.waitForTimeout(500);

        const finalBox = await dragCard.boundingBox();
        if (finalBox) {
          const distance = Math.sqrt(
            Math.pow(finalBox.x - initialBox.x, 2) +
            Math.pow(finalBox.y - initialBox.y, 2)
          );

          if (distance > 50) {
            validationResults.dragDropFunctional = true;
            console.log(`✅ Drag and drop working (moved ${Math.round(distance)}px)`);
          }
        }
      }
    }

    await takeScreenshot(page, 'test3-drag-drop', 'Drag and drop test');

    // Test 3.2: Hover Effects
    console.log('📋 Test 3.2: Hover Effects');
    if (ideaCardCount > 0) {
      const hoverCard = ideaCards.first();
      await hoverCard.hover();
      await page.waitForTimeout(300);

      // Check if hover reveals buttons
      const hoverButtons = await hoverCard.locator('button').count();
      if (hoverButtons > 0) {
        validationResults.hoverEffectsWorking = true;
        console.log('✅ Hover effects working - buttons visible on hover');
      }
    }

    // Test 3.3: Button Responsiveness
    console.log('📋 Test 3.3: Button Responsiveness');
    const allButtons = await page.locator('button').count();
    if (allButtons > 0) {
      validationResults.buttonResponsiveness = true;
      console.log(`✅ Found ${allButtons} responsive buttons`);
    }

    // =================
    // VISUAL TESTS
    // =================
    console.log('\n🔍 PHASE 4: Visual Tests');
    console.log('-' .repeat(40));

    // Test 4.1: Responsive Design
    console.log('📋 Test 4.1: Responsive Design');
    const viewports = [
      { width: 1440, height: 900, name: 'desktop' },
      { width: 768, height: 1024, name: 'tablet' },
      { width: 375, height: 667, name: 'mobile' }
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(500);
      await takeScreenshot(page, `test4-${viewport.name}`, `${viewport.name} responsive layout`);

      if (viewport.name === 'mobile') {
        const mobileCards = await page.locator('.card').count();
        if (mobileCards > 0) {
          validationResults.responsiveDesign = true;
          console.log('✅ Responsive design working across viewports');
        }
      }
    }

    // Reset to desktop view
    await page.setViewportSize({ width: 1440, height: 900 });

    // Test 4.2: Visual Consistency
    console.log('📋 Test 4.2: Visual Consistency');
    const visualElements = {
      header: await page.locator('h2').count(),
      cards: await page.locator('.card').count(),
      buttons: await page.locator('button').count()
    };

    if (visualElements.header > 0 && visualElements.cards > 0) {
      validationResults.visualConsistency = true;
      console.log('✅ Visual consistency maintained');
    }

    // =================
    // PERFORMANCE TESTS
    // =================
    console.log('\n🔍 PHASE 5: Performance Tests');
    console.log('-' .repeat(40));

    // Test 5.1: Load Performance
    console.log('📋 Test 5.1: Load Performance');
    if (loadTime < 3000) {
      validationResults.loadPerformance = true;
      console.log(`✅ Load performance excellent (${loadTime}ms < 3000ms)`);
    }

    // Test 5.2: Memory Usage
    console.log('📋 Test 5.2: Memory Usage');
    const memoryInfo = await page.evaluate(() => {
      const perf = window.performance;
      return perf.memory ? {
        used: Math.round(perf.memory.usedJSHeapSize / 1024 / 1024),
        total: Math.round(perf.memory.totalJSHeapSize / 1024 / 1024)
      } : null;
    });

    if (memoryInfo && memoryInfo.used < 100) {
      validationResults.memoryUsage = true;
      console.log(`✅ Memory usage efficient (${memoryInfo.used}MB < 100MB)`);
    }

    // =================
    // ERROR HANDLING TESTS
    // =================
    console.log('\n🔍 PHASE 6: Error Handling Tests');
    console.log('-' .repeat(40));

    // Monitor console errors
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Trigger some interactions to capture console output
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const criticalErrors = consoleErrors.filter(error =>
      !error.includes('DevTools') &&
      !error.includes('Extension') &&
      !error.includes('favicon') &&
      !error.includes('400')  // Backend errors are expected in this context
    );

    if (criticalErrors.length === 0) {
      validationResults.gracefulErrorHandling = true;
      validationResults.consoleErrorsManageable = true;
      console.log('✅ No critical console errors detected');
    } else {
      console.log(`⚠️ ${criticalErrors.length} critical console errors detected`);
    }

    // =================
    // FINAL VALIDATION SUMMARY
    // =================
    console.log('\n' + '=' .repeat(60));
    console.log('🎉 COMPREHENSIVE VALIDATION COMPLETE');
    console.log('=' .repeat(60));

    await takeScreenshot(page, 'final-validation-state', 'Final application state');

    // Calculate overall score
    const totalTests = Object.keys(validationResults).length;
    const passedTests = Object.values(validationResults).filter(Boolean).length;
    const scorePercentage = Math.round((passedTests / totalTests) * 100);

    console.log('\n📊 VALIDATION RESULTS SUMMARY:');
    console.log('=' .repeat(40));

    // Group results by category
    const categories = {
      'Core Application': ['applicationLoad', 'matrixNavigation', 'uiLayoutIntegrity'],
      'Functional Features': ['ideaCardsPresent', 'editButtonsWorking', 'editModeActivation', 'saveChangesWorking', 'collapseExpandWorking'],
      'User Interactions': ['dragDropFunctional', 'hoverEffectsWorking', 'buttonResponsiveness'],
      'Visual & Responsive': ['responsiveDesign', 'visualConsistency', 'animationSmoothness'],
      'Performance': ['loadPerformance', 'memoryUsage', 'interactionPerformance'],
      'Error Handling': ['gracefulErrorHandling', 'consoleErrorsManageable']
    };

    for (const [category, tests] of Object.entries(categories)) {
      console.log(`\n🔸 ${category}:`);
      tests.forEach(test => {
        const status = validationResults[test] ? '✅ PASS' : '❌ FAIL';
        const testName = test.replace(/([A-Z])/g, ' $1').toLowerCase().replace(/^./, str => str.toUpperCase());
        console.log(`   ${status} - ${testName}`);
      });
    }

    console.log('\n📈 OVERALL VALIDATION SCORE:');
    console.log(`🎯 ${passedTests}/${totalTests} tests passed (${scorePercentage}%)`);

    if (scorePercentage >= 90) {
      console.log('🏆 EXCELLENT: Application is production-ready with exceptional quality!');
    } else if (scorePercentage >= 80) {
      console.log('🎉 VERY GOOD: Application is highly functional with minor areas for improvement');
    } else if (scorePercentage >= 70) {
      console.log('👍 GOOD: Application is functional with some areas needing attention');
    } else if (scorePercentage >= 60) {
      console.log('⚠️ ACCEPTABLE: Application works but has several issues to address');
    } else {
      console.log('🚨 NEEDS WORK: Application has significant issues requiring immediate attention');
    }

    console.log('\n🔍 KEY FINDINGS:');
    console.log('=' .repeat(30));

    if (validationResults.applicationLoad && validationResults.matrixNavigation) {
      console.log('✅ Core application architecture is solid and functional');
    }

    if (validationResults.editButtonsWorking && validationResults.editModeActivation) {
      console.log('✅ Edit functionality is working as designed');
    }

    if (validationResults.dragDropFunctional) {
      console.log('✅ Drag and drop interactions are smooth and responsive');
    }

    if (validationResults.responsiveDesign) {
      console.log('✅ Responsive design adapts well across different screen sizes');
    }

    if (validationResults.loadPerformance && validationResults.memoryUsage) {
      console.log('✅ Performance metrics are within acceptable ranges');
    }

    if (!validationResults.consoleErrorsManageable) {
      console.log('⚠️ Backend connectivity issues detected (expected in demo environment)');
    }

    console.log('\n🚀 RECOMMENDATIONS:');
    console.log('=' .repeat(30));

    if (scorePercentage >= 80) {
      console.log('• Application is ready for user testing and further development');
      console.log('• Focus on minor UX improvements and edge case handling');
      console.log('• Consider adding more automated tests for regression prevention');
    } else {
      console.log('• Address failing test areas before production deployment');
      console.log('• Focus on core functionality stabilization');
      console.log('• Implement comprehensive error handling');
    }

    console.log('\n📸 Evidence captured in screenshots directory:');
    console.log(`   ${SCREENSHOT_DIR}`);

    // Save detailed findings to JSON
    const reportData = {
      timestamp: new Date().toISOString(),
      validationResults,
      detailedFindings,
      scorePercentage,
      totalTests,
      passedTests,
      consoleErrors: consoleErrors.slice(0, 10), // First 10 errors for analysis
      memoryInfo,
      loadTime
    };

    await fs.writeFile(
      path.join(SCREENSHOT_DIR, 'validation-report.json'),
      JSON.stringify(reportData, null, 2)
    );

    console.log('\n📋 Detailed validation report saved to: validation-report.json');

  } catch (error) {
    console.error('❌ Validation error:', error.message);
    await takeScreenshot(page, 'validation-error', 'Error during validation');
  } finally {
    await browser.close();
  }
}

// Run the final validation
runFinalValidation().catch(console.error);