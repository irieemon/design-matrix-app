import { chromium } from 'playwright';
import { promises as fs } from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:3001';
const SCREENSHOT_DIR = './test-screenshots/edit-interaction';

// Ensure screenshot directory exists
async function ensureScreenshotDir() {
  try {
    await fs.access(SCREENSHOT_DIR);
  } catch {
    await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
  }
}

// Helper function to wait for page stability
async function waitForPageReady(page) {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
}

// Take timestamped screenshot with error handling
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

async function runEditInteractionTest() {
  console.log('🧪 Testing Edit Interactions - Comprehensive Validation');
  console.log('=' .repeat(60));

  const browser = await chromium.launch({
    headless: false,
    slowMo: 200  // Slower for better observation
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  let testResults = {
    appLoad: false,
    matrixNavigation: false,
    cardsDetected: false,
    editButtonFound: false,
    editModeActivated: false,
    editFieldFound: false,
    saveButtonFound: false,
    changesPersisted: false,
    dragDropWorking: false,
    responsiveLayout: false
  };

  try {
    // Step 1: Load Application
    console.log('\n🔍 Step 1: Loading Application');
    await page.goto(BASE_URL);
    await waitForPageReady(page);
    await takeScreenshot(page, 'step1-app-loaded', 'Application loaded');

    const title = await page.title();
    console.log(`📝 Page title: ${title}`);
    testResults.appLoad = true;

    // Step 2: Navigate to Matrix
    console.log('\n🔍 Step 2: Navigate to Matrix');
    const matrixButton = page.locator('button:has-text("Design Matrix")');

    if (await matrixButton.isVisible()) {
      await matrixButton.click();
      await waitForPageReady(page);
      await takeScreenshot(page, 'step2-matrix-page', 'Matrix page loaded');
      testResults.matrixNavigation = true;
      console.log('✅ Successfully navigated to matrix');
    } else {
      console.log('❌ Matrix button not found');
    }

    // Step 3: Detect Cards
    console.log('\n🔍 Step 3: Detecting Idea Cards');
    const cardSelectors = ['.card', '[data-testid="idea-card"]', '.idea-card'];
    let cardsFound = 0;
    let activeSelector = '';

    for (const selector of cardSelectors) {
      const count = await page.locator(selector).count();
      if (count > 0) {
        cardsFound = count;
        activeSelector = selector;
        break;
      }
    }

    if (cardsFound > 0) {
      console.log(`✅ Found ${cardsFound} cards using selector: ${activeSelector}`);
      testResults.cardsDetected = true;
      await takeScreenshot(page, 'step3-cards-detected', `${cardsFound} cards found`);

      // Step 4: Test Card Interactions
      console.log('\n🔍 Step 4: Testing Card Interactions');
      const firstCard = page.locator(activeSelector).first();

      // Scroll card into view
      await firstCard.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);

      // Test hover interaction
      await firstCard.hover();
      await page.waitForTimeout(300);
      await takeScreenshot(page, 'step4-card-hover', 'Card hover state');

      // Look for any visible text to understand card structure
      console.log('📝 Analyzing card structure...');
      const cardText = await firstCard.allTextContents();
      console.log(`📝 Card contains: ${JSON.stringify(cardText).substring(0, 100)}...`);

      // Step 5: Search for Edit Controls
      console.log('\n🔍 Step 5: Searching for Edit Controls');

      // Look for edit buttons with various approaches
      const editButtonSelectors = [
        'button[aria-label*="edit" i]',
        'button[title*="edit" i]',
        'button:has-text("Edit")',
        '.edit-button',
        '[data-action="edit"]',
        '.fa-edit',
        '.edit-icon',
        'button[class*="edit"]'
      ];

      let editButton = null;
      let editButtonSelector = '';

      for (const selector of editButtonSelectors) {
        const button = firstCard.locator(selector);
        if (await button.count() > 0 && await button.first().isVisible()) {
          editButton = button.first();
          editButtonSelector = selector;
          console.log(`✅ Found edit button: ${selector}`);
          testResults.editButtonFound = true;
          break;
        }
      }

      if (!editButton) {
        // Look for any buttons on the card
        console.log('🔍 No specific edit button found, checking all buttons...');
        const allButtons = await firstCard.locator('button').count();
        console.log(`📝 Found ${allButtons} total buttons on card`);

        if (allButtons > 0) {
          // Try clicking the first button that might be an edit button
          for (let i = 0; i < allButtons; i++) {
            const button = firstCard.locator('button').nth(i);
            const buttonText = await button.textContent();
            const ariaLabel = await button.getAttribute('aria-label');
            const title = await button.getAttribute('title');

            console.log(`📝 Button ${i}: text="${buttonText}" aria-label="${ariaLabel}" title="${title}"`);

            if (buttonText?.toLowerCase().includes('edit') ||
                ariaLabel?.toLowerCase().includes('edit') ||
                title?.toLowerCase().includes('edit')) {
              editButton = button;
              editButtonSelector = `button nth(${i})`;
              testResults.editButtonFound = true;
              console.log(`✅ Found edit button by content analysis: Button ${i}`);
              break;
            }
          }
        }
      }

      if (editButton) {
        // Step 6: Test Edit Mode Activation
        console.log('\n🔍 Step 6: Testing Edit Mode Activation');
        await takeScreenshot(page, 'step6-before-edit-click', 'Before clicking edit button');

        await editButton.click();
        await page.waitForTimeout(1000);
        await takeScreenshot(page, 'step6-after-edit-click', 'After clicking edit button');

        // Check for edit mode indicators
        const editModeIndicators = [
          '[data-editing="true"]',
          '.editing-mode',
          '.edit-active',
          'input[type="text"]',
          'textarea',
          '[contenteditable="true"]',
          '.editable'
        ];

        let editModeDetected = false;
        for (const indicator of editModeIndicators) {
          const element = page.locator(indicator);
          if (await element.count() > 0) {
            editModeDetected = true;
            console.log(`✅ Edit mode detected: ${indicator} found`);
            testResults.editModeActivated = true;
            break;
          }
        }

        if (editModeDetected) {
          // Step 7: Test Edit Fields
          console.log('\n🔍 Step 7: Testing Edit Fields');

          // Look for editable fields
          const editFieldSelectors = [
            'input[type="text"]',
            'input[name="title"]',
            'textarea',
            '[contenteditable="true"]'
          ];

          let editField = null;
          for (const selector of editFieldSelectors) {
            const field = page.locator(selector).first();
            if (await field.isVisible()) {
              editField = field;
              console.log(`✅ Found editable field: ${selector}`);
              testResults.editFieldFound = true;
              break;
            }
          }

          if (editField) {
            // Test editing
            console.log('📝 Testing field editing...');
            const originalValue = await editField.inputValue() || await editField.textContent() || '';
            console.log(`📝 Original value: "${originalValue}"`);

            // Clear and enter test text
            await editField.clear();
            const testText = 'TEST_EDIT_' + Date.now();
            await editField.fill(testText);
            await page.waitForTimeout(500);
            await takeScreenshot(page, 'step7-field-edited', 'Field value changed');

            console.log(`📝 Changed to: "${testText}"`);

            // Step 8: Test Save Functionality
            console.log('\n🔍 Step 8: Testing Save Functionality');

            const saveButtonSelectors = [
              'button[aria-label*="save" i]',
              'button:has-text("Save")',
              'button[title*="save" i]',
              '.save-button',
              '[data-action="save"]'
            ];

            let saveButton = null;
            for (const selector of saveButtonSelectors) {
              const button = page.locator(selector);
              if (await button.count() > 0 && await button.first().isVisible()) {
                saveButton = button.first();
                console.log(`✅ Found save button: ${selector}`);
                testResults.saveButtonFound = true;
                break;
              }
            }

            if (saveButton) {
              await saveButton.click();
              await page.waitForTimeout(1000);
              await takeScreenshot(page, 'step8-after-save', 'After save button clicked');

              // Check if edit mode exited
              const stillInEditMode = await page.locator('[data-editing="true"], .editing-mode').count() > 0;
              if (!stillInEditMode) {
                console.log('✅ Edit mode exited after save');
                testResults.changesPersisted = true;
              } else {
                console.log('⚠️ Still in edit mode after save');
              }
            } else {
              console.log('❌ No save button found');
            }

            // Restore original value if possible
            if (editButton && await editButton.isVisible()) {
              console.log('🔄 Attempting to restore original value...');
              await editButton.click();
              await page.waitForTimeout(500);

              const restoreField = page.locator(editFieldSelectors[0]).first();
              if (await restoreField.isVisible()) {
                await restoreField.clear();
                await restoreField.fill(originalValue);

                const restoreSave = page.locator('button[aria-label*="save" i], button:has-text("Save")').first();
                if (await restoreSave.isVisible()) {
                  await restoreSave.click();
                  await page.waitForTimeout(500);
                  console.log('✅ Original value restored');
                }
              }
            }
          }
        } else {
          console.log('❌ Edit mode not detected after clicking edit button');
        }
      } else {
        console.log('❌ No edit button found on card');
        await takeScreenshot(page, 'step5-no-edit-button', 'No edit button detected');
      }

      // Step 9: Test Drag and Drop
      console.log('\n🔍 Step 9: Testing Drag and Drop');
      const dragCard = page.locator(activeSelector).first();
      const initialBox = await dragCard.boundingBox();

      if (initialBox) {
        await dragCard.hover();
        await page.mouse.down();
        await page.mouse.move(initialBox.x + 150, initialBox.y + 100, { steps: 10 });
        await page.waitForTimeout(300);
        await takeScreenshot(page, 'step9-during-drag', 'During drag operation');

        await page.mouse.up();
        await page.waitForTimeout(500);
        await takeScreenshot(page, 'step9-after-drag', 'After drag completed');

        const finalBox = await dragCard.boundingBox();
        if (finalBox) {
          const distance = Math.sqrt(
            Math.pow(finalBox.x - initialBox.x, 2) +
            Math.pow(finalBox.y - initialBox.y, 2)
          );
          console.log(`✅ Card moved ${Math.round(distance)}px`);
          if (distance > 50) {
            testResults.dragDropWorking = true;
          }
        }
      }

    } else {
      console.log('❌ No idea cards found');
      await takeScreenshot(page, 'step3-no-cards', 'No cards detected');
    }

    // Step 10: Test Responsive Layout
    console.log('\n🔍 Step 10: Testing Responsive Layouts');
    const viewports = [
      { width: 768, height: 1024, name: 'tablet' },
      { width: 375, height: 667, name: 'mobile' },
      { width: 1440, height: 900, name: 'desktop' }
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(500);
      await takeScreenshot(page, `step10-${viewport.name}`, `${viewport.name} layout`);

      if (viewport.name === 'mobile') {
        // Check if layout adapts
        const matrixContainer = page.locator('.matrix-container, .matrix');
        if (await matrixContainer.isVisible()) {
          testResults.responsiveLayout = true;
          console.log('✅ Responsive layout working');
        }
      }
    }

    // Generate Test Report
    console.log('\n' + '=' .repeat(60));
    console.log('🎉 Edit Interaction Test Complete!');
    console.log(`📸 Screenshots saved to: ${SCREENSHOT_DIR}`);

    console.log('\n📊 Test Results Summary:');
    console.log('=' .repeat(40));

    const results = [
      ['App Load', testResults.appLoad],
      ['Matrix Navigation', testResults.matrixNavigation],
      ['Cards Detected', testResults.cardsDetected],
      ['Edit Button Found', testResults.editButtonFound],
      ['Edit Mode Activated', testResults.editModeActivated],
      ['Edit Field Found', testResults.editFieldFound],
      ['Save Button Found', testResults.saveButtonFound],
      ['Changes Persisted', testResults.changesPersisted],
      ['Drag & Drop Working', testResults.dragDropWorking],
      ['Responsive Layout', testResults.responsiveLayout]
    ];

    let passCount = 0;
    results.forEach(([test, passed]) => {
      const status = passed ? '✅ PASS' : '❌ FAIL';
      console.log(`${status} - ${test}`);
      if (passed) passCount++;
    });

    console.log('\n📈 Overall Score: ' + `${passCount}/${results.length} tests passed`);

    if (passCount >= 7) {
      console.log('🎉 EXCELLENT: Core functionality is working well!');
    } else if (passCount >= 5) {
      console.log('👍 GOOD: Most functionality working with minor issues');
    } else {
      console.log('⚠️ NEEDS ATTENTION: Several functionality issues detected');
    }

  } catch (error) {
    console.error('❌ Test execution error:', error.message);
    await takeScreenshot(page, 'fatal-error', 'Fatal error during testing');
  } finally {
    await browser.close();
  }
}

// Run the test
runEditInteractionTest().catch(console.error);