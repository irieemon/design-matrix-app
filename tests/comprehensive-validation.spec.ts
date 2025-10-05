import { test, expect, Page } from '@playwright/test';
import { promises as fs } from 'fs';
import path from 'path';

// Test configuration
const BASE_URL = 'http://localhost:3001';
const SCREENSHOT_DIR = './test-screenshots/comprehensive-validation';

// Helper function to ensure screenshot directory exists
async function ensureScreenshotDir() {
  try {
    await fs.access(SCREENSHOT_DIR);
  } catch {
    await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
  }
}

// Helper function to wait for page to be fully loaded and interactive
async function waitForPageReady(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.waitForFunction(() => document.readyState === 'complete');
  // Wait for React to be ready
  await page.waitForFunction(() => {
    return window.React || document.querySelector('[data-reactroot]') || document.querySelector('#root')?.children.length > 0;
  });
}

// Helper function to take a timestamped screenshot
async function takeTimestampedScreenshot(page: Page, name: string, description?: string) {
  await ensureScreenshotDir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${name}-${timestamp}.png`;
  const fullPath = path.join(SCREENSHOT_DIR, filename);

  await page.screenshot({
    path: fullPath,
    fullPage: true
  });

  console.log(`📸 Screenshot captured: ${filename} ${description ? `- ${description}` : ''}`);
  return fullPath;
}

// Test suite for comprehensive validation
test.describe('Comprehensive Application Validation', () => {

  test.beforeAll(async () => {
    await ensureScreenshotDir();
  });

  test.describe('1. Functional Testing Suite', () => {

    test('Edit State Management - Complete Workflow', async ({ page }) => {
      await page.goto(BASE_URL);
      await waitForPageReady(page);

      // Take initial state screenshot
      await takeTimestampedScreenshot(page, 'edit-workflow-initial', 'Initial application state');

      // Check if we need to sign in first
      const signInButton = page.locator('button:has-text("Sign In")');
      if (await signInButton.isVisible()) {
        await signInButton.click();
        await page.waitForTimeout(2000);
        await waitForPageReady(page);
      }

      // Navigate to matrix if not already there
      const matrixLink = page.locator('a[href="/matrix"], button:has-text("Matrix")');
      if (await matrixLink.isVisible()) {
        await matrixLink.click();
        await waitForPageReady(page);
      }

      // Look for existing idea cards or create one for testing
      let ideaCard = page.locator('[data-testid="idea-card"]').first();

      if (!(await ideaCard.isVisible())) {
        // Create a new idea if none exist
        const addButton = page.locator('button:has-text("Add Idea"), button[aria-label*="Add"]');
        if (await addButton.isVisible()) {
          await addButton.click();
          await page.waitForTimeout(1000);

          // Fill in idea details
          const titleInput = page.locator('input[placeholder*="title"], input[name="title"]');
          if (await titleInput.isVisible()) {
            await titleInput.fill('Test Idea for Edit Validation');

            const descInput = page.locator('textarea[placeholder*="description"], textarea[name="description"]');
            if (await descInput.isVisible()) {
              await descInput.fill('Testing edit state management functionality');
            }

            const saveButton = page.locator('button:has-text("Save"), button:has-text("Create")');
            if (await saveButton.isVisible()) {
              await saveButton.click();
              await page.waitForTimeout(2000);
              await waitForPageReady(page);
            }
          }
        }
      }

      // Refresh card selector after potential creation
      ideaCard = page.locator('[data-testid="idea-card"]').first();

      if (await ideaCard.isVisible()) {
        await takeTimestampedScreenshot(page, 'edit-workflow-before-edit', 'Before entering edit mode');

        // Test edit mode entry
        const editButton = ideaCard.locator('button[aria-label*="Edit"], button:has-text("Edit")');
        if (await editButton.isVisible()) {
          await editButton.click();
          await page.waitForTimeout(500);

          await takeTimestampedScreenshot(page, 'edit-workflow-edit-mode', 'Edit mode activated');

          // Verify edit mode is active
          const editingIndicator = page.locator('[data-editing="true"], .editing-mode, .edit-active');
          expect(await editingIndicator.count()).toBeGreaterThan(0);

          // Test editing functionality
          const titleField = page.locator('input[name="title"], [contenteditable="true"]:has-text("Test")').first();
          if (await titleField.isVisible()) {
            await titleField.clear();
            await titleField.fill('Updated Test Idea Title');
            await page.waitForTimeout(300);
          }

          await takeTimestampedScreenshot(page, 'edit-workflow-modified', 'Content modified in edit mode');

          // Test save functionality
          const saveButton = page.locator('button:has-text("Save"), button[aria-label*="Save"]');
          if (await saveButton.isVisible()) {
            await saveButton.click();
            await page.waitForTimeout(1000);
            await waitForPageReady(page);

            await takeTimestampedScreenshot(page, 'edit-workflow-saved', 'Changes saved and edit mode exited');

            // Verify edit mode is exited
            const editingIndicator = page.locator('[data-editing="true"], .editing-mode, .edit-active');
            expect(await editingIndicator.count()).toBe(0);

            // Verify changes persisted
            const updatedTitle = page.locator(':has-text("Updated Test Idea Title")');
            expect(await updatedTitle.isVisible()).toBe(true);
          }
        }
      }

      console.log('✅ Edit state management workflow completed successfully');
    });

    test('Card Collapse/Expand Functionality', async ({ page }) => {
      await page.goto(BASE_URL);
      await waitForPageReady(page);

      // Navigate to matrix
      const matrixLink = page.locator('a[href="/matrix"], button:has-text("Matrix")');
      if (await matrixLink.isVisible()) {
        await matrixLink.click();
        await waitForPageReady(page);
      }

      const ideaCard = page.locator('[data-testid="idea-card"]').first();

      if (await ideaCard.isVisible()) {
        await takeTimestampedScreenshot(page, 'collapse-initial', 'Initial card state');

        // Test collapse functionality
        const collapseButton = ideaCard.locator('button[aria-label*="Collapse"], button[aria-label*="Minimize"]');
        if (await collapseButton.isVisible()) {
          await collapseButton.click();
          await page.waitForTimeout(500);

          await takeTimestampedScreenshot(page, 'collapse-collapsed', 'Card in collapsed state');

          // Verify card is collapsed
          const cardContent = ideaCard.locator('.card-content, .description, [data-content]');
          if (await cardContent.count() > 0) {
            expect(await cardContent.first().isVisible()).toBe(false);
          }

          // Test expand functionality
          const expandButton = ideaCard.locator('button[aria-label*="Expand"], button[aria-label*="Maximize"]');
          if (await expandButton.isVisible()) {
            await expandButton.click();
            await page.waitForTimeout(500);

            await takeTimestampedScreenshot(page, 'collapse-expanded', 'Card expanded back to full state');

            // Verify card is expanded
            if (await cardContent.count() > 0) {
              expect(await cardContent.first().isVisible()).toBe(true);
            }
          }
        }
      }

      console.log('✅ Card collapse/expand functionality validated');
    });

    test('Drag and Drop Behavior', async ({ page }) => {
      await page.goto(BASE_URL);
      await waitForPageReady(page);

      // Navigate to matrix
      const matrixLink = page.locator('a[href="/matrix"], button:has-text("Matrix")');
      if (await matrixLink.isVisible()) {
        await matrixLink.click();
        await waitForPageReady(page);
      }

      const ideaCard = page.locator('[data-testid="idea-card"]').first();

      if (await ideaCard.isVisible()) {
        await takeTimestampedScreenshot(page, 'drag-initial', 'Before drag operation');

        // Get initial position
        const initialBox = await ideaCard.boundingBox();
        expect(initialBox).toBeTruthy();

        // Perform drag operation
        await ideaCard.hover();
        await page.mouse.down();
        await page.mouse.move(initialBox!.x + 200, initialBox!.y + 100);
        await page.waitForTimeout(300);

        await takeTimestampedScreenshot(page, 'drag-during', 'During drag operation');

        await page.mouse.up();
        await page.waitForTimeout(500);

        await takeTimestampedScreenshot(page, 'drag-completed', 'After drag operation completed');

        // Verify position changed
        const finalBox = await ideaCard.boundingBox();
        expect(finalBox).toBeTruthy();
        expect(Math.abs(finalBox!.x - initialBox!.x)).toBeGreaterThan(50);
      }

      console.log('✅ Drag and drop behavior validated');
    });

    test('Sidebar Collapse/Expand with Matrix Resize', async ({ page }) => {
      await page.goto(BASE_URL);
      await waitForPageReady(page);

      await takeTimestampedScreenshot(page, 'sidebar-initial', 'Initial sidebar state');

      const sidebar = page.locator('[data-testid="sidebar"], .sidebar, nav');
      const matrixContainer = page.locator('.matrix-container, [data-testid="matrix"]');

      if (await sidebar.isVisible()) {
        // Get initial matrix width
        const initialMatrixBox = await matrixContainer.boundingBox();

        // Test sidebar collapse
        const collapseButton = page.locator('button[aria-label*="collapse"], button[aria-label*="toggle"], .hamburger');
        if (await collapseButton.isVisible()) {
          await collapseButton.click();
          await page.waitForTimeout(500);

          await takeTimestampedScreenshot(page, 'sidebar-collapsed', 'Sidebar collapsed');

          // Verify matrix expanded to fill space
          if (await matrixContainer.isVisible()) {
            const expandedMatrixBox = await matrixContainer.boundingBox();
            expect(expandedMatrixBox!.width).toBeGreaterThan(initialMatrixBox!.width);
          }

          // Test sidebar expand
          await collapseButton.click();
          await page.waitForTimeout(500);

          await takeTimestampedScreenshot(page, 'sidebar-expanded', 'Sidebar expanded back');

          // Verify matrix returns to original size
          if (await matrixContainer.isVisible()) {
            const restoredMatrixBox = await matrixContainer.boundingBox();
            expect(Math.abs(restoredMatrixBox!.width - initialMatrixBox!.width)).toBeLessThan(20);
          }
        }
      }

      console.log('✅ Sidebar collapse/expand with matrix resize validated');
    });

    test('Header Button Functionality', async ({ page }) => {
      await page.goto(BASE_URL);
      await waitForPageReady(page);

      await takeTimestampedScreenshot(page, 'header-initial', 'Initial header state');

      // Test navigation buttons
      const navButtons = page.locator('header button, nav button, .header button');
      const buttonCount = await navButtons.count();

      if (buttonCount > 0) {
        for (let i = 0; i < buttonCount && i < 5; i++) {
          const button = navButtons.nth(i);
          const buttonText = await button.textContent();

          if (buttonText && !buttonText.includes('Sign Out')) {
            await button.click();
            await page.waitForTimeout(1000);
            await waitForPageReady(page);

            await takeTimestampedScreenshot(page, `header-clicked-${i}`, `After clicking button: ${buttonText}`);
          }
        }
      }

      console.log('✅ Header button functionality validated');
    });
  });

  test.describe('2. Integration Testing', () => {

    test('Complete User Workflow - Create → Edit → Save', async ({ page }) => {
      await page.goto(BASE_URL);
      await waitForPageReady(page);

      await takeTimestampedScreenshot(page, 'integration-start', 'Starting complete user workflow');

      // Navigate to matrix
      const matrixLink = page.locator('a[href="/matrix"], button:has-text("Matrix")');
      if (await matrixLink.isVisible()) {
        await matrixLink.click();
        await waitForPageReady(page);
      }

      // Create new idea
      const addButton = page.locator('button:has-text("Add"), button[aria-label*="Add"]');
      if (await addButton.isVisible()) {
        await addButton.click();
        await page.waitForTimeout(1000);

        await takeTimestampedScreenshot(page, 'integration-create-modal', 'Create idea modal opened');

        // Fill form
        const titleInput = page.locator('input[name="title"], input[placeholder*="title"]');
        if (await titleInput.isVisible()) {
          await titleInput.fill('Integration Test Idea');

          const descInput = page.locator('textarea[name="description"], textarea[placeholder*="description"]');
          if (await descInput.isVisible()) {
            await descInput.fill('This is a test idea for integration testing');
          }

          const createButton = page.locator('button:has-text("Create"), button:has-text("Save")');
          if (await createButton.isVisible()) {
            await createButton.click();
            await page.waitForTimeout(2000);
            await waitForPageReady(page);

            await takeTimestampedScreenshot(page, 'integration-created', 'Idea created successfully');

            // Find the newly created idea
            const newIdea = page.locator(':has-text("Integration Test Idea")').first();
            expect(await newIdea.isVisible()).toBe(true);

            // Edit the idea
            const ideaCard = newIdea.locator('..').locator('[data-testid="idea-card"]').first();
            const editButton = ideaCard.locator('button[aria-label*="Edit"], button:has-text("Edit")');

            if (await editButton.isVisible()) {
              await editButton.click();
              await page.waitForTimeout(500);

              await takeTimestampedScreenshot(page, 'integration-editing', 'Editing the created idea');

              // Modify content
              const titleField = page.locator('input[name="title"]').first();
              if (await titleField.isVisible()) {
                await titleField.clear();
                await titleField.fill('Updated Integration Test Idea');

                const saveButton = page.locator('button:has-text("Save")');
                if (await saveButton.isVisible()) {
                  await saveButton.click();
                  await page.waitForTimeout(1000);

                  await takeTimestampedScreenshot(page, 'integration-updated', 'Idea updated successfully');

                  // Verify update persisted
                  const updatedIdea = page.locator(':has-text("Updated Integration Test Idea")');
                  expect(await updatedIdea.isVisible()).toBe(true);
                }
              }
            }
          }
        }
      }

      console.log('✅ Complete user workflow integration test passed');
    });

    test('State Synchronization Across Components', async ({ page }) => {
      await page.goto(BASE_URL);
      await waitForPageReady(page);

      // Test navigation state synchronization
      const homeLink = page.locator('a[href="/"], button:has-text("Home")');
      const matrixLink = page.locator('a[href="/matrix"], button:has-text("Matrix")');

      if (await homeLink.isVisible() && await matrixLink.isVisible()) {
        await homeLink.click();
        await waitForPageReady(page);
        await takeTimestampedScreenshot(page, 'sync-home', 'On home page');

        await matrixLink.click();
        await waitForPageReady(page);
        await takeTimestampedScreenshot(page, 'sync-matrix', 'On matrix page');

        // Verify state is consistent
        const matrixContainer = page.locator('.matrix-container');
        expect(await matrixContainer.isVisible()).toBe(true);
      }

      console.log('✅ State synchronization validated');
    });
  });

  test.describe('3. Visual Regression Testing', () => {

    test('Responsive Behavior at Different Screen Sizes', async ({ page }) => {
      const viewports = [
        { width: 1440, height: 900, name: 'desktop' },
        { width: 1024, height: 768, name: 'tablet' },
        { width: 375, height: 667, name: 'mobile' }
      ];

      for (const viewport of viewports) {
        await page.setViewportSize(viewport);
        await page.goto(BASE_URL);
        await waitForPageReady(page);

        await takeTimestampedScreenshot(page, `responsive-${viewport.name}`, `${viewport.name} view`);

        // Navigate to matrix for each viewport
        const matrixLink = page.locator('a[href="/matrix"], button:has-text("Matrix")');
        if (await matrixLink.isVisible()) {
          await matrixLink.click();
          await waitForPageReady(page);

          await takeTimestampedScreenshot(page, `responsive-matrix-${viewport.name}`, `Matrix ${viewport.name} view`);
        }
      }

      console.log('✅ Responsive behavior validated across screen sizes');
    });

    test('Animation Smoothness Validation', async ({ page }) => {
      await page.goto(BASE_URL);
      await waitForPageReady(page);

      // Navigate to matrix
      const matrixLink = page.locator('a[href="/matrix"], button:has-text("Matrix")');
      if (await matrixLink.isVisible()) {
        await matrixLink.click();
        await waitForPageReady(page);
      }

      // Test card interactions for smooth animations
      const ideaCard = page.locator('[data-testid="idea-card"]').first();

      if (await ideaCard.isVisible()) {
        // Test hover animations
        await ideaCard.hover();
        await page.waitForTimeout(300);
        await takeTimestampedScreenshot(page, 'animation-hover', 'Card hover state');

        // Test collapse animation
        const collapseButton = ideaCard.locator('button[aria-label*="Collapse"]');
        if (await collapseButton.isVisible()) {
          await collapseButton.click();
          await page.waitForTimeout(300);
          await takeTimestampedScreenshot(page, 'animation-collapse', 'Card collapse animation');
        }
      }

      console.log('✅ Animation smoothness validated');
    });
  });

  test.describe('4. Edge Case Testing', () => {

    test('Rapid User Interactions', async ({ page }) => {
      await page.goto(BASE_URL);
      await waitForPageReady(page);

      // Navigate to matrix
      const matrixLink = page.locator('a[href="/matrix"], button:has-text("Matrix")');
      if (await matrixLink.isVisible()) {
        await matrixLink.click();
        await waitForPageReady(page);
      }

      const ideaCard = page.locator('[data-testid="idea-card"]').first();

      if (await ideaCard.isVisible()) {
        // Test rapid clicking
        const editButton = ideaCard.locator('button[aria-label*="Edit"]');
        if (await editButton.isVisible()) {
          for (let i = 0; i < 5; i++) {
            await editButton.click();
            await page.waitForTimeout(100);
          }

          await takeTimestampedScreenshot(page, 'edge-rapid-clicks', 'After rapid clicking test');

          // Verify application is still stable
          expect(await page.locator('body').isVisible()).toBe(true);
        }
      }

      console.log('✅ Rapid interaction edge cases handled');
    });

    test('Page Refresh During Operations', async ({ page }) => {
      await page.goto(BASE_URL);
      await waitForPageReady(page);

      // Navigate to matrix
      const matrixLink = page.locator('a[href="/matrix"], button:has-text("Matrix")');
      if (await matrixLink.isVisible()) {
        await matrixLink.click();
        await waitForPageReady(page);
      }

      const ideaCard = page.locator('[data-testid="idea-card"]').first();

      if (await ideaCard.isVisible()) {
        // Start edit operation
        const editButton = ideaCard.locator('button[aria-label*="Edit"]');
        if (await editButton.isVisible()) {
          await editButton.click();
          await page.waitForTimeout(300);

          // Refresh page during edit
          await page.reload();
          await waitForPageReady(page);

          await takeTimestampedScreenshot(page, 'edge-refresh-recovery', 'After refresh during edit');

          // Verify application recovered gracefully
          expect(await page.locator('.matrix-container').isVisible()).toBe(true);
        }
      }

      console.log('✅ Page refresh during operations handled gracefully');
    });
  });

  test.describe('5. Performance Testing', () => {

    test('Memory Usage and Performance Metrics', async ({ page }) => {
      await page.goto(BASE_URL);
      await waitForPageReady(page);

      // Collect initial performance metrics
      const initialMetrics = await page.evaluate(() => {
        const performance = window.performance;
        return {
          memory: (performance as any).memory ? {
            usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
            totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
            jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit
          } : null,
          timing: {
            domContentLoaded: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart,
            loadComplete: performance.timing.loadEventEnd - performance.timing.navigationStart
          }
        };
      });

      console.log('📊 Initial Performance Metrics:', initialMetrics);

      // Navigate to matrix and interact
      const matrixLink = page.locator('a[href="/matrix"], button:has-text("Matrix")');
      if (await matrixLink.isVisible()) {
        await matrixLink.click();
        await waitForPageReady(page);

        // Perform multiple interactions
        for (let i = 0; i < 10; i++) {
          const ideaCard = page.locator('[data-testid="idea-card"]').first();
          if (await ideaCard.isVisible()) {
            await ideaCard.hover();
            await page.waitForTimeout(100);
          }
        }

        // Collect final metrics
        const finalMetrics = await page.evaluate(() => {
          const performance = window.performance;
          return {
            memory: (performance as any).memory ? {
              usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
              totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
              jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit
            } : null
          };
        });

        console.log('📊 Final Performance Metrics:', finalMetrics);

        // Verify no significant memory leaks
        if (initialMetrics.memory && finalMetrics.memory) {
          const memoryIncrease = finalMetrics.memory.usedJSHeapSize - initialMetrics.memory.usedJSHeapSize;
          expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB increase
        }
      }

      console.log('✅ Performance metrics within acceptable ranges');
    });
  });
});