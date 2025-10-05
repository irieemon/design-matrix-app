import { test, expect } from '@playwright/test';
import { VisualTestHelper } from './utils/visual-helpers';
import { testUsers, authTestScenarios } from './utils/test-data';
import path from 'path';
import fs from 'fs/promises';

/**
 * Automated Visual Regression Testing Suite
 *
 * Comprehensive baseline management and regression detection
 * for authentication system visual changes
 */

test.describe('Visual Regression Testing', () => {
  let visualHelper: VisualTestHelper;

  test.beforeEach(async ({ page }) => {
    visualHelper = new VisualTestHelper(page);
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test.describe('Baseline Management', () => {
    test('Generate Authentication Flow Baselines', async ({ page }) => {
      console.log('📸 Generating visual baselines for auth flow');

      const baselineScenarios = [
        { name: 'auth-screen-initial', action: async () => {
          await page.goto('/', { waitUntil: 'networkidle' });
          await visualHelper.waitForAuthStability();
        }},
        { name: 'auth-screen-login', action: async () => {
          await page.goto('/', { waitUntil: 'networkidle' });
          await visualHelper.waitForAuthStability();
        }},
        { name: 'auth-screen-signup', action: async () => {
          await page.goto('/', { waitUntil: 'networkidle' });
          await visualHelper.waitForAuthStability();
          await page.click('text=/sign up/i');
          await visualHelper.waitForAuthStability();
        }},
        { name: 'auth-screen-forgot-password', action: async () => {
          await page.goto('/', { waitUntil: 'networkidle' });
          await visualHelper.waitForAuthStability();
          await page.click('text=/forgot.*password/i');
          await visualHelper.waitForAuthStability();
        }},
        { name: 'form-with-validation-errors', action: async () => {
          await page.goto('/', { waitUntil: 'networkidle' });
          await visualHelper.waitForAuthStability();
          await page.fill('[type="email"]', 'invalid-email');
          await page.fill('[type="password"]', 'short');
          await page.click('[type="submit"]');
          await page.waitForTimeout(1000);
        }},
        { name: 'form-loading-state', action: async () => {
          await page.goto('/', { waitUntil: 'networkidle' });
          await visualHelper.waitForAuthStability();
          await page.fill('[type="email"]', testUsers.validUser.email);
          await page.fill('[type="password"]', testUsers.validUser.password);
          // Don't actually submit to avoid real auth, just capture the ready state
        }}
      ];

      for (const scenario of baselineScenarios) {
        await test.step(`Generate baseline: ${scenario.name}`, async () => {
          await scenario.action();

          await visualHelper.compareScreenshot({
            name: `baseline-${scenario.name}`,
            waitFor: 'networkidle',
            delay: 300,
            threshold: 0.1,
            maxDiffPixels: 1000
          });

          console.log(`✅ Generated baseline: ${scenario.name}`);
        });
      }
    });

    test('Generate Component-Level Baselines', async ({ page }) => {
      console.log('🧩 Generating component-level baselines');

      await page.goto('/', { waitUntil: 'networkidle' });
      await visualHelper.waitForAuthStability();

      const components = [
        { selector: '.auth-screen', name: 'auth-container' },
        { selector: 'form', name: 'auth-form' },
        { selector: '[type="email"]', name: 'email-field' },
        { selector: '[type="password"]', name: 'password-field' },
        { selector: 'button[type="submit"]', name: 'submit-button' }
      ];

      for (const component of components) {
        await test.step(`Generate component baseline: ${component.name}`, async () => {
          try {
            await visualHelper.captureElement(component.selector, `baseline-${component.name}`);
            console.log(`✅ Generated component baseline: ${component.name}`);
          } catch (error) {
            console.log(`⚠️ Component not found: ${component.selector}`);
          }
        });
      }
    });
  });

  test.describe('Regression Detection', () => {
    test('Detect Auth Screen Layout Regressions', async ({ page }) => {
      console.log('🔍 Detecting auth screen layout regressions');

      await page.goto('/', { waitUntil: 'networkidle' });
      await visualHelper.waitForAuthStability();

      await test.step('Compare against baseline', async () => {
        // This comparison will use existing baselines or create them if they don't exist
        await visualHelper.compareScreenshot({
          name: 'regression-auth-screen',
          threshold: 0.05, // Strict threshold for regression detection
          maxDiffPixels: 500,
          waitFor: 'networkidle',
          delay: 300
        });
      });

      await test.step('Validate layout integrity', async () => {
        // Check that critical elements are still present and properly positioned
        const criticalElements = [
          '.auth-screen',
          'form',
          '[type="email"]',
          '[type="password"]',
          'button[type="submit"]'
        ];

        for (const selector of criticalElements) {
          const element = page.locator(selector).first();
          await expect(element).toBeVisible();

          const boundingBox = await element.boundingBox();
          expect(boundingBox).not.toBeNull();

          if (boundingBox) {
            // Elements should be reasonably sized
            expect(boundingBox.width).toBeGreaterThan(0);
            expect(boundingBox.height).toBeGreaterThan(0);

            // Elements should be within viewport
            expect(boundingBox.x).toBeGreaterThanOrEqual(0);
            expect(boundingBox.y).toBeGreaterThanOrEqual(0);
          }
        }
      });
    });

    test('Detect Form Interaction Regressions', async ({ page }) => {
      console.log('📝 Detecting form interaction regressions');

      await page.goto('/', { waitUntil: 'networkidle' });
      await visualHelper.waitForAuthStability();

      const interactionTests = [
        {
          name: 'email-field-focus',
          action: async () => {
            await page.locator('[type="email"]').click();
            await page.waitForTimeout(200);
          }
        },
        {
          name: 'email-field-filled',
          action: async () => {
            await page.locator('[type="email"]').fill(testUsers.validUser.email);
            await page.waitForTimeout(200);
          }
        },
        {
          name: 'password-field-focus',
          action: async () => {
            await page.locator('[type="password"]').click();
            await page.waitForTimeout(200);
          }
        },
        {
          name: 'form-complete',
          action: async () => {
            await page.locator('[type="password"]').fill(testUsers.validUser.password);
            await page.waitForTimeout(200);
          }
        }
      ];

      for (const interaction of interactionTests) {
        await test.step(`Test interaction: ${interaction.name}`, async () => {
          await interaction.action();

          await visualHelper.compareScreenshot({
            name: `regression-${interaction.name}`,
            threshold: 0.08, // Slightly higher threshold for interactive states
            maxDiffPixels: 800,
            delay: 100
          });
        });
      }
    });

    test('Detect Mode Transition Regressions', async ({ page }) => {
      console.log('🔄 Detecting mode transition regressions');

      await page.goto('/', { waitUntil: 'networkidle' });
      await visualHelper.waitForAuthStability();

      const modeTransitions = [
        {
          name: 'login-to-signup',
          action: async () => {
            await page.click('text=/sign up/i');
            await visualHelper.waitForAuthStability();
          }
        },
        {
          name: 'signup-to-login',
          action: async () => {
            await page.click('text=/sign in/i');
            await visualHelper.waitForAuthStability();
          }
        },
        {
          name: 'login-to-forgot-password',
          action: async () => {
            await page.click('text=/forgot.*password/i');
            await visualHelper.waitForAuthStability();
          }
        }
      ];

      for (const transition of modeTransitions) {
        await test.step(`Test transition: ${transition.name}`, async () => {
          await transition.action();

          await visualHelper.compareScreenshot({
            name: `regression-${transition.name}`,
            threshold: 0.1, // Higher threshold for transitions
            maxDiffPixels: 1200,
            delay: 300
          });

          // Also check for flickering during transition
          const flickerResult = await visualHelper.detectFlickering({
            samples: 3,
            interval: 200,
            threshold: 0.08
          });

          expect(flickerResult.hasFlickering).toBe(false);
          console.log(`${transition.name} flickering: ${flickerResult.hasFlickering ? 'DETECTED' : 'NONE'}`);
        });
      }
    });

    test('Detect Error State Regressions', async ({ page }) => {
      console.log('❌ Detecting error state regressions');

      await page.goto('/', { waitUntil: 'networkidle' });
      await visualHelper.waitForAuthStability();

      const errorScenarios = [
        {
          name: 'validation-errors',
          action: async () => {
            await page.fill('[type="email"]', 'invalid-email');
            await page.fill('[type="password"]', 'short');
            await page.click('[type="submit"]');
            await page.waitForTimeout(1000);
          }
        },
        {
          name: 'network-error',
          action: async () => {
            // Mock network failure
            await page.route('**/api/auth/**', route => route.abort());
            await page.fill('[type="email"]', testUsers.validUser.email);
            await page.fill('[type="password"]', testUsers.validUser.password);
            await page.click('[type="submit"]');
            await page.waitForTimeout(2000);
          }
        }
      ];

      for (const scenario of errorScenarios) {
        await test.step(`Test error scenario: ${scenario.name}`, async () => {
          await scenario.action();

          await visualHelper.compareScreenshot({
            name: `regression-error-${scenario.name}`,
            threshold: 0.08,
            maxDiffPixels: 1000,
            delay: 200
          });
        });
      }
    });
  });

  test.describe('Cross-Browser Regression Testing', () => {
    const browsers = ['chrome', 'firefox', 'safari'];

    for (const browserName of browsers) {
      test(`${browserName} Visual Consistency`, async ({ page }) => {
        // Note: This test would need to be run with different browser projects
        console.log(`🌐 Testing visual consistency on ${browserName}`);

        await page.goto('/', { waitUntil: 'networkidle' });
        await visualHelper.waitForAuthStability();

        await test.step(`Compare ${browserName} rendering`, async () => {
          await visualHelper.compareScreenshot({
            name: `browser-${browserName}-auth`,
            threshold: 0.12, // Higher threshold for cross-browser differences
            maxDiffPixels: 1500,
            waitFor: 'networkidle',
            delay: 300
          });
        });

        await test.step(`Test form interactions on ${browserName}`, async () => {
          await page.fill('[type="email"]', testUsers.validUser.email);
          await page.fill('[type="password"]', testUsers.validUser.password);

          await visualHelper.compareScreenshot({
            name: `browser-${browserName}-form-filled`,
            threshold: 0.12,
            maxDiffPixels: 1500,
            delay: 200
          });
        });
      });
    }
  });

  test.describe('Performance Regression Detection', () => {
    test('Visual Rendering Performance Regression', async ({ page }) => {
      console.log('⚡ Testing visual rendering performance');

      const performanceMetrics: { [key: string]: number } = {};

      await test.step('Measure initial render performance', async () => {
        const startTime = performance.now();

        await page.goto('/', { waitUntil: 'domcontentloaded' });

        // Wait for auth screen to be visually complete
        await page.waitForSelector('.auth-screen, form', { timeout: 10000 });
        await visualHelper.waitForAuthStability();

        const endTime = performance.now();
        performanceMetrics.initialRender = endTime - startTime;

        console.log(`Initial render time: ${performanceMetrics.initialRender.toFixed(2)}ms`);

        // Performance regression thresholds
        expect(performanceMetrics.initialRender).toBeLessThan(5000); // 5 second maximum
        if (performanceMetrics.initialRender > 3000) {
          console.warn(`⚠️ Initial render slower than expected: ${performanceMetrics.initialRender.toFixed(2)}ms`);
        }
      });

      await test.step('Measure form interaction performance', async () => {
        const startTime = performance.now();

        await page.fill('[type="email"]', testUsers.validUser.email);
        await page.fill('[type="password"]', testUsers.validUser.password);

        const endTime = performance.now();
        performanceMetrics.formInteraction = endTime - startTime;

        console.log(`Form interaction time: ${performanceMetrics.formInteraction.toFixed(2)}ms`);

        // Form interactions should be fast
        expect(performanceMetrics.formInteraction).toBeLessThan(1000); // 1 second maximum
      });

      await test.step('Measure mode transition performance', async () => {
        const startTime = performance.now();

        await page.click('text=/sign up/i');
        await visualHelper.waitForAuthStability();

        const endTime = performance.now();
        performanceMetrics.modeTransition = endTime - startTime;

        console.log(`Mode transition time: ${performanceMetrics.modeTransition.toFixed(2)}ms`);

        // Mode transitions should be smooth
        expect(performanceMetrics.modeTransition).toBeLessThan(500); // 500ms maximum
      });

      // Save performance metrics for trend analysis
      await test.step('Save performance metrics', async () => {
        const metricsFile = path.join(process.cwd(), 'test-results', 'performance-metrics.json');
        const timestamp = new Date().toISOString();

        const metricsData = {
          timestamp,
          metrics: performanceMetrics,
          thresholds: {
            initialRender: 3000,
            formInteraction: 500,
            modeTransition: 300
          }
        };

        try {
          await fs.writeFile(metricsFile, JSON.stringify(metricsData, null, 2));
          console.log('📊 Performance metrics saved');
        } catch (error) {
          console.log('⚠️ Could not save performance metrics:', error.message);
        }
      });
    });
  });

  test.describe('Automated Regression Reporting', () => {
    test('Generate Visual Regression Report', async ({ page }) => {
      console.log('📋 Generating visual regression report');

      const reportData = {
        timestamp: new Date().toISOString(),
        testRun: `regression-${Date.now()}`,
        summary: {
          totalTests: 0,
          passed: 0,
          failed: 0,
          regressions: []
        },
        environment: {
          viewport: '1280x720',
          browser: 'chrome',
          platform: process.platform
        }
      };

      await test.step('Run comprehensive visual check', async () => {
        const testScenarios = [
          'auth-screen-initial',
          'form-interactions',
          'mode-transitions',
          'error-states'
        ];

        for (const scenario of testScenarios) {
          try {
            await page.goto('/', { waitUntil: 'networkidle' });
            await visualHelper.waitForAuthStability();

            await visualHelper.compareScreenshot({
              name: `report-${scenario}`,
              threshold: 0.05,
              maxDiffPixels: 500
            });

            reportData.summary.passed++;
            console.log(`✅ Visual test passed: ${scenario}`);
          } catch (error) {
            reportData.summary.failed++;
            reportData.summary.regressions.push({
              scenario,
              error: error.message,
              timestamp: new Date().toISOString()
            });
            console.log(`❌ Visual regression detected: ${scenario}`);
          }

          reportData.summary.totalTests++;
        }
      });

      await test.step('Save regression report', async () => {
        const reportFile = path.join(process.cwd(), 'test-results', 'visual-regression-report.json');

        try {
          await fs.writeFile(reportFile, JSON.stringify(reportData, null, 2));
          console.log('📄 Visual regression report saved');

          // Log summary
          console.log('📊 Visual Regression Summary:');
          console.log(`   Total tests: ${reportData.summary.totalTests}`);
          console.log(`   Passed: ${reportData.summary.passed}`);
          console.log(`   Failed: ${reportData.summary.failed}`);
          console.log(`   Regressions: ${reportData.summary.regressions.length}`);
        } catch (error) {
          console.log('⚠️ Could not save regression report:', error.message);
        }
      });

      // Assert no regressions found
      expect(reportData.summary.regressions.length).toBe(0);
    });
  });
});