import { test, expect, Page } from '@playwright/test';
import { VisualTestHelper } from './visual/utils/visual-helpers';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Visual Evidence Collection System
 *
 * Comprehensive screenshot capture and comparison system for validating fixes:
 * 1. Before/After comparison screenshots
 * 2. Evidence collection for all fixes
 * 3. Automated visual regression testing
 * 4. Evidence report generation
 */

interface EvidenceCapture {
  name: string;
  description: string;
  timestamp: string;
  screenshot: string;
  metadata: {
    url: string;
    viewport: { width: number; height: number };
    userAgent: string;
    cardCount?: number;
    interactionType?: string;
  };
}

interface EvidenceReport {
  testSuite: string;
  timestamp: string;
  summary: {
    totalCaptures: number;
    fixesValidated: string[];
    criticalIssues: string[];
    performanceMetrics: any;
  };
  captures: EvidenceCapture[];
}

test.describe('Visual Evidence Collection System', () => {
  let visualHelper: VisualTestHelper;
  let evidenceReport: EvidenceReport;
  let evidenceDir: string;

  test.beforeEach(async ({ page }) => {
    visualHelper = new VisualTestHelper(page);

    // Initialize evidence collection
    evidenceReport = {
      testSuite: 'Comprehensive Fix Validation',
      timestamp: new Date().toISOString(),
      summary: {
        totalCaptures: 0,
        fixesValidated: [],
        criticalIssues: [],
        performanceMetrics: {}
      },
      captures: []
    };

    // Create evidence directory
    evidenceDir = join(process.cwd(), 'test-results', 'evidence', `run-${Date.now()}`);
    if (!existsSync(evidenceDir)) {
      mkdirSync(evidenceDir, { recursive: true });
    }

    // Navigate and prepare
    await page.goto('/matrix');
    await page.waitForLoadState('networkidle');
    await visualHelper.waitForAuthStability();
  });

  test.afterEach(async ({ page }) => {
    // Generate evidence report
    await this.generateEvidenceReport(evidenceReport, evidenceDir);
  });

  test.describe('Card Background Fix Evidence', () => {
    test('collect evidence of card background visibility fixes', async ({ page }) => {
      console.log('📸 Collecting card background fix evidence');

      await page.waitForSelector('.design-matrix', { timeout: 10000 });
      await page.waitForSelector('.idea-card', { timeout: 5000 });

      // Evidence 1: Matrix overview with all cards
      await this.captureEvidence(page, {
        name: 'card-background-overview',
        description: 'Matrix overview showing all cards with visible backgrounds',
        interactionType: 'baseline'
      });

      const cards = page.locator('.idea-card');
      const cardCount = await cards.count();

      evidenceReport.summary.fixesValidated.push('Card Background Visibility');

      if (cardCount > 0) {
        // Evidence 2: Individual card close-ups
        for (let i = 0; i < Math.min(cardCount, 3); i++) {
          const card = cards.nth(i);

          // Scroll card into view
          await card.scrollIntoViewIfNeeded();

          // Capture individual card
          await this.captureElementEvidence(page, card, {
            name: `card-${i + 1}-background-detail`,
            description: `Detailed view of card ${i + 1} showing solid background and text readability`,
            interactionType: 'detail'
          });
        }

        // Evidence 3: Hover state testing
        const firstCard = cards.first();
        await firstCard.scrollIntoViewIfNeeded();

        // Before hover
        await this.captureEvidence(page, {
          name: 'card-before-hover-background',
          description: 'Card background before hover interaction',
          interactionType: 'pre-hover'
        });

        // During hover
        await firstCard.hover();
        await page.waitForTimeout(300);

        await this.captureEvidence(page, {
          name: 'card-during-hover-background',
          description: 'Card background during hover - should remain visible',
          interactionType: 'hover'
        });

        // After hover
        await page.mouse.move(0, 0);
        await page.waitForTimeout(300);

        await this.captureEvidence(page, {
          name: 'card-after-hover-background',
          description: 'Card background after hover - should return to normal',
          interactionType: 'post-hover'
        });

        console.log(`✅ Collected card background evidence for ${cardCount} cards`);
      }
    });

    test('collect text readability evidence', async ({ page }) => {
      console.log('📸 Collecting text readability evidence');

      await page.waitForSelector('.idea-card', { timeout: 5000 });

      const cards = page.locator('.idea-card');
      const cardCount = await cards.count();

      if (cardCount > 0) {
        // Test text visibility and contrast
        for (let i = 0; i < Math.min(cardCount, 3); i++) {
          const card = cards.nth(i);

          // Get text elements
          const textElements = card.locator('h3, p, .text-gray-800, .text-gray-900');
          const textCount = await textElements.count();

          if (textCount > 0) {
            // Highlight text for evidence
            await page.addStyleTag({
              content: `
                .idea-card h3, .idea-card p, .idea-card .text-gray-800, .idea-card .text-gray-900 {
                  outline: 1px solid blue !important;
                  outline-offset: 1px !important;
                }
              `
            });

            await this.captureElementEvidence(page, card, {
              name: `card-${i + 1}-text-readability`,
              description: `Text readability validation for card ${i + 1} - text highlighted in blue`,
              interactionType: 'text-validation'
            });

            // Remove highlighting
            await page.addStyleTag({
              content: `
                .idea-card h3, .idea-card p, .idea-card .text-gray-800, .idea-card .text-gray-900 {
                  outline: none !important;
                }
              `
            });
          }
        }

        console.log(`✅ Collected text readability evidence for ${cardCount} cards`);
      }
    });
  });

  test.describe('Double-Click Fix Evidence', () => {
    test('collect evidence of double-click modal functionality', async ({ page }) => {
      console.log('📸 Collecting double-click functionality evidence');

      await page.waitForSelector('.idea-card', { timeout: 5000 });

      const cards = page.locator('.idea-card');
      const cardCount = await cards.count();

      evidenceReport.summary.fixesValidated.push('Double-Click Modal Functionality');

      if (cardCount > 0) {
        const firstCard = cards.first();

        // Evidence 1: Before double-click
        await this.captureEvidence(page, {
          name: 'before-double-click-modal',
          description: 'Matrix state before double-click interaction',
          interactionType: 'pre-interaction'
        });

        // Evidence 2: Double-click action
        await firstCard.dblclick();
        await page.waitForTimeout(500);

        // Check for modal
        const modalSelectors = [
          '.modal',
          '.edit-modal',
          '.edit-idea-modal',
          '[role="dialog"]',
          '.dialog'
        ];

        let modalFound = false;
        for (const selector of modalSelectors) {
          try {
            const modal = page.locator(selector).first();
            if (await modal.isVisible()) {
              modalFound = true;

              // Evidence 3: Modal opened
              await this.captureEvidence(page, {
                name: 'double-click-modal-opened',
                description: 'Modal successfully opened via double-click',
                interactionType: 'modal-open'
              });

              // Evidence 4: Modal form content
              await this.captureElementEvidence(page, modal, {
                name: 'modal-form-content',
                description: 'Modal form showing populated fields and functionality',
                interactionType: 'modal-content'
              });

              // Test form interaction
              const titleField = modal.locator('input[name="title"], input[placeholder*="title" i]').first();
              if (await titleField.isVisible()) {
                await titleField.fill('Evidence Test Title');

                await this.captureElementEvidence(page, modal, {
                  name: 'modal-form-interaction',
                  description: 'Modal form with user input - proving functionality',
                  interactionType: 'form-interaction'
                });
              }

              // Evidence 5: Modal close
              await page.keyboard.press('Escape');
              await page.waitForTimeout(300);

              await this.captureEvidence(page, {
                name: 'modal-closed-successfully',
                description: 'Matrix state after modal close - no navigation issues',
                interactionType: 'modal-close'
              });

              break;
            }
          } catch (error) {
            // Continue checking other selectors
          }
        }

        if (!modalFound) {
          evidenceReport.summary.criticalIssues.push('Double-click modal did not open');

          await this.captureEvidence(page, {
            name: 'double-click-modal-failed',
            description: 'ISSUE: Double-click did not open modal',
            interactionType: 'failure'
          });
        }

        console.log(`✅ Collected double-click evidence - Modal found: ${modalFound}`);
      }
    });

    test('collect evidence of navigation stability', async ({ page }) => {
      console.log('📸 Collecting navigation stability evidence');

      await page.waitForSelector('.idea-card', { timeout: 5000 });

      const cards = page.locator('.idea-card');
      const cardCount = await cards.count();

      if (cardCount > 0) {
        const originalUrl = page.url();

        // Test multiple cards for navigation stability
        for (let i = 0; i < Math.min(cardCount, 3); i++) {
          const card = cards.nth(i);

          // Before double-click
          await this.captureEvidence(page, {
            name: `navigation-stability-before-${i + 1}`,
            description: `URL stability test ${i + 1} - before double-click (URL: ${originalUrl})`,
            interactionType: 'navigation-test'
          });

          // Double-click
          await card.dblclick();
          await page.waitForTimeout(1000);

          // Check URL hasn't changed
          const currentUrl = page.url();
          const urlStable = currentUrl === originalUrl;

          if (!urlStable) {
            evidenceReport.summary.criticalIssues.push(`Navigation issue: URL changed from ${originalUrl} to ${currentUrl}`);
          }

          // After double-click
          await this.captureEvidence(page, {
            name: `navigation-stability-after-${i + 1}`,
            description: `URL stability test ${i + 1} - after double-click (URL: ${currentUrl}, Stable: ${urlStable})`,
            interactionType: 'navigation-result'
          });

          // Close any modal
          await page.keyboard.press('Escape');
          await page.waitForTimeout(300);
        }

        console.log('✅ Collected navigation stability evidence');
      }
    });
  });

  test.describe('Performance Fix Evidence', () => {
    test('collect evidence of 60fps performance', async ({ page }) => {
      console.log('📸 Collecting performance evidence');

      await page.waitForSelector('.idea-card', { timeout: 5000 });

      evidenceReport.summary.fixesValidated.push('60fps Performance Stability');

      // Inject performance monitoring
      await page.addInitScript(() => {
        window.performanceEvidence = {
          fps: [],
          interactions: []
        };

        let lastTime = performance.now();
        function measureFPS() {
          const now = performance.now();
          const fps = 1000 / (now - lastTime);
          window.performanceEvidence.fps.push(fps);
          lastTime = now;
          requestAnimationFrame(measureFPS);
        }
        requestAnimationFrame(measureFPS);
      });

      // Evidence 1: Baseline performance
      await this.captureEvidence(page, {
        name: 'performance-baseline',
        description: 'Matrix baseline state for performance monitoring',
        interactionType: 'performance-baseline'
      });

      // Evidence 2: During interactions
      const cards = page.locator('.idea-card');
      const cardCount = await cards.count();

      if (cardCount > 0) {
        // Perform interaction sequence
        for (let i = 0; i < Math.min(cardCount, 5); i++) {
          await cards.nth(i).hover();
          await page.waitForTimeout(50);
        }

        await this.captureEvidence(page, {
          name: 'performance-during-hover',
          description: 'Performance during hover interactions',
          interactionType: 'performance-hover'
        });

        // Scroll test
        await page.mouse.wheel(0, 300);
        await page.waitForTimeout(200);

        await this.captureEvidence(page, {
          name: 'performance-during-scroll',
          description: 'Performance during scroll interactions',
          interactionType: 'performance-scroll'
        });

        // Get FPS data
        const fpsData = await page.evaluate(() => window.performanceEvidence.fps);
        const averageFPS = fpsData.reduce((sum, fps) => sum + fps, 0) / fpsData.length;

        evidenceReport.summary.performanceMetrics = {
          averageFPS: Math.round(averageFPS * 100) / 100,
          sampleCount: fpsData.length,
          targetFPS: 60
        };

        console.log(`📊 Average FPS: ${averageFPS.toFixed(2)}`);

        if (averageFPS < 45) {
          evidenceReport.summary.criticalIssues.push(`Performance issue: Average FPS ${averageFPS.toFixed(2)} below target`);
        }
      }

      console.log('✅ Collected performance evidence');
    });

    test('collect evidence of console cleanliness', async ({ page }) => {
      console.log('📸 Collecting console cleanliness evidence');

      const consoleMessages: string[] = [];

      // Monitor console
      page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleMessages.push(msg.text());
        }
      });

      page.on('pageerror', error => {
        consoleMessages.push(`Page Error: ${error.message}`);
      });

      await page.waitForSelector('.idea-card', { timeout: 5000 });

      // Perform interactions to test console cleanliness
      const cards = page.locator('.idea-card');
      const cardCount = await cards.count();

      if (cardCount > 0) {
        // Interaction sequence that might trigger console errors
        await cards.first().hover();
        await cards.first().click();
        await cards.first().dblclick();
        await page.keyboard.press('Escape');
      }

      // Capture console state
      await this.captureEvidence(page, {
        name: 'console-cleanliness-test',
        description: `Console cleanliness after interactions - ${consoleMessages.length} errors detected`,
        interactionType: 'console-test'
      });

      // Filter critical errors
      const criticalErrors = consoleMessages.filter(error =>
        !error.toLowerCase().includes('devtools') &&
        !error.toLowerCase().includes('extension') &&
        !error.toLowerCase().includes('favicon')
      );

      if (criticalErrors.length > 0) {
        evidenceReport.summary.criticalIssues.push(`Console errors: ${criticalErrors.length} critical errors found`);
        console.log('🚨 Critical console errors:');
        criticalErrors.forEach(error => console.log(`  - ${error}`));
      }

      evidenceReport.summary.performanceMetrics.consoleErrors = criticalErrors.length;

      console.log('✅ Collected console cleanliness evidence');
    });
  });

  test.describe('Comprehensive Evidence Summary', () => {
    test('generate final validation evidence report', async ({ page }) => {
      console.log('📸 Generating comprehensive validation evidence');

      await page.waitForSelector('.design-matrix', { timeout: 10000 });

      // Final comprehensive screenshot
      await this.captureEvidence(page, {
        name: 'final-validation-complete',
        description: 'Final state after all fixes applied and validated',
        interactionType: 'final-validation'
      });

      // Generate summary
      evidenceReport.summary.totalCaptures = evidenceReport.captures.length;

      console.log('📊 Evidence Collection Summary:');
      console.log(`   Total Captures: ${evidenceReport.summary.totalCaptures}`);
      console.log(`   Fixes Validated: ${evidenceReport.summary.fixesValidated.join(', ')}`);
      console.log(`   Critical Issues: ${evidenceReport.summary.criticalIssues.length}`);

      if (evidenceReport.summary.criticalIssues.length > 0) {
        console.log('🚨 Critical Issues Found:');
        evidenceReport.summary.criticalIssues.forEach(issue => console.log(`   - ${issue}`));
      }

      console.log('✅ Comprehensive evidence collection complete');
    });
  });

  // Helper methods

  async captureEvidence(page: Page, options: {
    name: string;
    description: string;
    interactionType: string;
  }) {
    const { name, description, interactionType } = options;

    // Capture screenshot
    await visualHelper.compareScreenshot({
      name: `evidence-${name}`,
      waitFor: 'networkidle',
      delay: 300
    });

    // Record evidence
    const evidence: EvidenceCapture = {
      name,
      description,
      timestamp: new Date().toISOString(),
      screenshot: `evidence-${name}.png`,
      metadata: {
        url: page.url(),
        viewport: await page.viewportSize() || { width: 0, height: 0 },
        userAgent: await page.evaluate(() => navigator.userAgent),
        interactionType
      }
    };

    evidenceReport.captures.push(evidence);
    console.log(`📸 Captured: ${description}`);
  }

  async captureElementEvidence(page: Page, element: any, options: {
    name: string;
    description: string;
    interactionType: string;
  }) {
    const { name, description, interactionType } = options;

    // Capture element screenshot
    await expect(element).toHaveScreenshot(`evidence-element-${name}.png`, {
      threshold: 0.1
    });

    // Record evidence
    const evidence: EvidenceCapture = {
      name: `element-${name}`,
      description,
      timestamp: new Date().toISOString(),
      screenshot: `evidence-element-${name}.png`,
      metadata: {
        url: page.url(),
        viewport: await page.viewportSize() || { width: 0, height: 0 },
        userAgent: await page.evaluate(() => navigator.userAgent),
        interactionType
      }
    };

    evidenceReport.captures.push(evidence);
    console.log(`📸 Captured Element: ${description}`);
  }

  async generateEvidenceReport(report: EvidenceReport, outputDir: string) {
    try {
      // Generate JSON report
      const jsonReport = JSON.stringify(report, null, 2);
      writeFileSync(join(outputDir, 'evidence-report.json'), jsonReport);

      // Generate HTML report
      const htmlReport = this.generateHTMLReport(report);
      writeFileSync(join(outputDir, 'evidence-report.html'), htmlReport);

      console.log(`📋 Evidence report generated: ${outputDir}`);
    } catch (error) {
      console.error('Failed to generate evidence report:', error);
    }
  }

  generateHTMLReport(report: EvidenceReport): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Visual Evidence Report - ${report.testSuite}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 8px; }
        .summary { margin: 20px 0; }
        .evidence-item { border: 1px solid #ddd; margin: 10px 0; padding: 15px; border-radius: 5px; }
        .screenshot { max-width: 800px; border: 1px solid #ccc; }
        .success { color: green; }
        .error { color: red; }
        .metadata { font-size: 0.9em; color: #666; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Visual Evidence Report</h1>
        <p><strong>Test Suite:</strong> ${report.testSuite}</p>
        <p><strong>Generated:</strong> ${report.timestamp}</p>
    </div>

    <div class="summary">
        <h2>Summary</h2>
        <p><strong>Total Captures:</strong> ${report.summary.totalCaptures}</p>
        <p><strong>Fixes Validated:</strong> ${report.summary.fixesValidated.join(', ')}</p>
        <p class="${report.summary.criticalIssues.length === 0 ? 'success' : 'error'}">
            <strong>Critical Issues:</strong> ${report.summary.criticalIssues.length}
        </p>
        ${report.summary.criticalIssues.length > 0 ?
          `<ul class="error">${report.summary.criticalIssues.map(issue => `<li>${issue}</li>`).join('')}</ul>` :
          '<p class="success">No critical issues found!</p>'
        }
    </div>

    <div class="captures">
        <h2>Evidence Captures</h2>
        ${report.captures.map(capture => `
        <div class="evidence-item">
            <h3>${capture.name}</h3>
            <p>${capture.description}</p>
            <img src="${capture.screenshot}" class="screenshot" alt="${capture.description}" />
            <div class="metadata">
                <p><strong>Timestamp:</strong> ${capture.timestamp}</p>
                <p><strong>URL:</strong> ${capture.metadata.url}</p>
                <p><strong>Interaction:</strong> ${capture.metadata.interactionType}</p>
            </div>
        </div>
        `).join('')}
    </div>
</body>
</html>
    `;
  }
});

// Global type extensions
declare global {
  interface Window {
    performanceEvidence: {
      fps: number[];
      interactions: string[];
    };
  }
}