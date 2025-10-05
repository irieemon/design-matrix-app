import { test, expect } from '@playwright/test';

test.describe('Button Rendering Inspection', () => {
  test('inspect button styles in actual browser', async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:3007');

    // Wait for and click "Continue as Demo User"
    const demoButton = page.getByTestId('auth-demo-button');
    await demoButton.waitFor({ state: 'visible' });
    await demoButton.click();

    // Wait for main app to load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Give time for animations

    // Click "Access Matrix Now" to create demo project and access matrix
    const accessMatrixButton = page.getByRole('button', { name: /Access Matrix Now/i });
    await accessMatrixButton.waitFor({ state: 'visible' });
    await accessMatrixButton.click();

    // Wait for matrix to load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    console.log('\n=== INSPECTING BUTTON RENDERING ===\n');

    // Find and inspect "AI Idea" button (using text since no test ID)
    const aiIdeaButton = page.getByRole('button', { name: /AI Idea/i });
    await aiIdeaButton.waitFor({ state: 'visible', timeout: 15000 });

    const aiIdeaButtonInfo = await aiIdeaButton.evaluate((button) => {
      const computedStyle = window.getComputedStyle(button);

      return {
        tagName: button.tagName,
        className: button.className,
        innerHTML: button.innerHTML,
        computedStyles: {
          background: computedStyle.background,
          backgroundColor: computedStyle.backgroundColor,
          border: computedStyle.border,
          borderRadius: computedStyle.borderRadius,
          boxShadow: computedStyle.boxShadow,
          transform: computedStyle.transform,
          color: computedStyle.color,
          padding: computedStyle.padding,
          fontSize: computedStyle.fontSize,
          fontWeight: computedStyle.fontWeight,
          transition: computedStyle.transition,
        },
        // Check if specific classes are present
        hasClasses: {
          btn: button.classList.contains('btn'),
          btnSapphire: button.classList.contains('btn--sapphire'),
          btnPrimary: button.classList.contains('btn--primary'),
        },
        // Get all classes as array
        allClasses: Array.from(button.classList),
      };
    });

    console.log('\n--- AI Idea Button ---');
    console.log('Tag Name:', aiIdeaButtonInfo?.tagName);
    console.log('Class Name:', aiIdeaButtonInfo?.className);
    console.log('All Classes:', aiIdeaButtonInfo?.allClasses);
    console.log('Has Lux Classes:', aiIdeaButtonInfo?.hasClasses);
    console.log('\nComputed Styles:');
    console.log(JSON.stringify(aiIdeaButtonInfo?.computedStyles, null, 2));

    // Find and inspect "Create New Idea" button
    const createButton = page.getByTestId('add-idea-button');
    await createButton.waitFor({ state: 'visible' });

    const createButtonInfo = await createButton.evaluate((button) => {
      const computedStyle = window.getComputedStyle(button);

      return {
        tagName: button.tagName,
        className: button.className,
        innerHTML: button.innerHTML,
        computedStyles: {
          background: computedStyle.background,
          backgroundColor: computedStyle.backgroundColor,
          border: computedStyle.border,
          borderRadius: computedStyle.borderRadius,
          boxShadow: computedStyle.boxShadow,
          transform: computedStyle.transform,
          color: computedStyle.color,
          padding: computedStyle.padding,
          fontSize: computedStyle.fontSize,
          fontWeight: computedStyle.fontWeight,
          transition: computedStyle.transition,
        },
        hasClasses: {
          btn: button.classList.contains('btn'),
          btnSapphire: button.classList.contains('btn--sapphire'),
          btnPrimary: button.classList.contains('btn--primary'),
        },
        allClasses: Array.from(button.classList),
      };
    });

    console.log('\n--- Create New Idea Button ---');
    console.log('Tag Name:', createButtonInfo?.tagName);
    console.log('Class Name:', createButtonInfo?.className);
    console.log('All Classes:', createButtonInfo?.allClasses);
    console.log('Has Lux Classes:', createButtonInfo?.hasClasses);
    console.log('\nComputed Styles:');
    console.log(JSON.stringify(createButtonInfo?.computedStyles, null, 2));

    // Click "Create New Idea" to open modal
    await createButton.click();

    // Wait for modal to appear
    const modal = page.getByTestId('add-idea-modal');
    await modal.waitFor({ state: 'visible' });
    await page.waitForTimeout(500); // Wait for modal animations

    console.log('\n=== MODAL BUTTONS ===\n');

    // Inspect Cancel button
    const cancelButton = page.getByRole('button', { name: /cancel/i });
    await cancelButton.waitFor({ state: 'visible' });

    const cancelButtonInfo = await cancelButton.evaluate((button) => {
      const computedStyle = window.getComputedStyle(button);

      return {
        tagName: button.tagName,
        className: button.className,
        computedStyles: {
          background: computedStyle.background,
          backgroundColor: computedStyle.backgroundColor,
          border: computedStyle.border,
          borderRadius: computedStyle.borderRadius,
          boxShadow: computedStyle.boxShadow,
          color: computedStyle.color,
          padding: computedStyle.padding,
        },
        hasClasses: {
          btn: button.classList.contains('btn'),
          btnGhost: button.classList.contains('btn--ghost'),
        },
        allClasses: Array.from(button.classList),
      };
    });

    console.log('\n--- Cancel Button ---');
    console.log('Class Name:', cancelButtonInfo?.className);
    console.log('All Classes:', cancelButtonInfo?.allClasses);
    console.log('Has Lux Classes:', cancelButtonInfo?.hasClasses);
    console.log('\nComputed Styles:');
    console.log(JSON.stringify(cancelButtonInfo?.computedStyles, null, 2));

    // Inspect Add Idea button (in modal)
    const addIdeaModalButton = page.getByRole('button', { name: /add idea/i });
    await addIdeaModalButton.waitFor({ state: 'visible' });

    const addIdeaButtonInfo = await addIdeaModalButton.evaluate((button) => {
      const computedStyle = window.getComputedStyle(button);

      return {
        tagName: button.tagName,
        className: button.className,
        computedStyles: {
          background: computedStyle.background,
          backgroundColor: computedStyle.backgroundColor,
          border: computedStyle.border,
          borderRadius: computedStyle.borderRadius,
          boxShadow: computedStyle.boxShadow,
          color: computedStyle.color,
          padding: computedStyle.padding,
        },
        hasClasses: {
          btn: button.classList.contains('btn'),
          btnSapphire: button.classList.contains('btn--sapphire'),
          btnPrimary: button.classList.contains('btn--primary'),
        },
        allClasses: Array.from(button.classList),
      };
    });

    console.log('\n--- Add Idea Button ---');
    console.log('Class Name:', addIdeaButtonInfo?.className);
    console.log('All Classes:', addIdeaButtonInfo?.allClasses);
    console.log('Has Lux Classes:', addIdeaButtonInfo?.hasClasses);
    console.log('\nComputed Styles:');
    console.log(JSON.stringify(addIdeaButtonInfo?.computedStyles, null, 2));

    // Check if button.css is loaded
    const buttonCssInfo = await page.evaluate(() => {
      const styleSheets = Array.from(document.styleSheets);
      const buttonCss = styleSheets.find(sheet => {
        try {
          return sheet.href?.includes('button.css');
        } catch (e) {
          return false;
        }
      });

      if (!buttonCss) return { loaded: false };

      // Try to read some rules from button.css
      try {
        const rules = Array.from(buttonCss.cssRules || []);
        const btnRules = rules.filter(rule => {
          return rule.cssText.includes('.btn');
        });

        return {
          loaded: true,
          href: buttonCss.href,
          ruleCount: rules.length,
          btnRuleCount: btnRules.length,
          sampleRules: btnRules.slice(0, 5).map(r => r.cssText),
        };
      } catch (e) {
        return {
          loaded: true,
          href: buttonCss.href,
          error: 'Cannot read rules (CORS?)',
        };
      }
    });

    console.log('\n=== BUTTON.CSS ANALYSIS ===');
    console.log(JSON.stringify(buttonCssInfo, null, 2));

    // Check for style overrides on AI Idea button
    const overrideAnalysis = await aiIdeaButton.evaluate((button) => {
      // Get all stylesheets that might affect this button
      const styleSheets = Array.from(document.styleSheets);
      const affectingStyles: any[] = [];

      styleSheets.forEach(sheet => {
        try {
          const rules = Array.from(sheet.cssRules || []);
          rules.forEach((rule: any) => {
            if (rule.selectorText && button.matches(rule.selectorText)) {
              affectingStyles.push({
                selector: rule.selectorText,
                stylesheet: sheet.href || 'inline',
                cssText: rule.cssText,
              });
            }
          });
        } catch (e) {
          // CORS or other access issues
        }
      });

      return {
        matchingRules: affectingStyles.length,
        rules: affectingStyles,
      };
    });

    console.log('\n=== STYLE OVERRIDE ANALYSIS ===');
    console.log('Matching Rules Count:', overrideAnalysis?.matchingRules);
    if (overrideAnalysis?.rules && overrideAnalysis.rules.length > 0) {
      console.log('\nRules affecting AI Idea button:');
      overrideAnalysis.rules.forEach((rule: any, index: number) => {
        console.log(`\n${index + 1}. ${rule.selector} (${rule.stylesheet})`);
        console.log(rule.cssText);
      });
    }

    // Create summary report
    const report = {
      aiIdeaButton: {
        hasLuxClasses: aiIdeaButtonInfo?.hasClasses,
        allClasses: aiIdeaButtonInfo?.allClasses,
        backgroundColor: aiIdeaButtonInfo?.computedStyles.backgroundColor,
        boxShadow: aiIdeaButtonInfo?.computedStyles.boxShadow,
      },
      createButton: {
        hasLuxClasses: createButtonInfo?.hasClasses,
        allClasses: createButtonInfo?.allClasses,
        backgroundColor: createButtonInfo?.computedStyles.backgroundColor,
        boxShadow: createButtonInfo?.computedStyles.boxShadow,
      },
      modalButtons: {
        cancel: {
          hasLuxClasses: cancelButtonInfo?.hasClasses,
          allClasses: cancelButtonInfo?.allClasses,
          backgroundColor: cancelButtonInfo?.computedStyles.backgroundColor,
        },
        addIdea: {
          hasLuxClasses: addIdeaButtonInfo?.hasClasses,
          allClasses: addIdeaButtonInfo?.allClasses,
          backgroundColor: addIdeaButtonInfo?.computedStyles.backgroundColor,
          boxShadow: addIdeaButtonInfo?.computedStyles.boxShadow,
        },
      },
      buttonCss: buttonCssInfo,
      styleOverrides: {
        rulesAffectingButtons: overrideAnalysis?.matchingRules || 0,
      },
    };

    console.log('\n=== SUMMARY REPORT ===');
    console.log(JSON.stringify(report, null, 2));

    // Keep browser open for manual inspection
    await page.waitForTimeout(5000);
  });
});
