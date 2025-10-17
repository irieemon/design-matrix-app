import { test, expect, Page } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * FILES PAGE REFRESH TEST
 *
 * Verifies that the Files page loads correctly after a full page refresh.
 * This test addresses issues where files may not display after browser refresh.
 *
 * Test Scenarios:
 * 1. Navigate to Files page with valid project ID
 * 2. Verify initial files load
 * 3. Perform full page refresh (Cmd+Shift+R simulation)
 * 4. Verify files still display correctly
 * 5. Check for console errors
 * 6. Visual comparison before/after refresh
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOT_DIR = path.join(__dirname, 'files-page-screenshots');
const PROJECT_ID = 'deade958-e26c-4c4b-99d6-8476c326427b';

test.describe('Files Page - Refresh Behavior', () => {
  let consoleErrors: string[] = [];
  let consoleWarnings: string[] = [];

  test.beforeEach(async ({ page }) => {
    // Track console errors and warnings
    consoleErrors = [];
    consoleWarnings = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      } else if (msg.type() === 'warning') {
        consoleWarnings.push(msg.text());
      }
    });

    // Track page errors
    page.on('pageerror', (error) => {
      consoleErrors.push(`PAGE ERROR: ${error.message}`);
    });

    // Navigate to application
    await page.goto('http://localhost:3003');
    await page.waitForLoadState('networkidle');

    // Authenticate as demo user
    const continueAsDemoButton = page.locator('button:has-text("Continue as Demo User")');
    if (await continueAsDemoButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await continueAsDemoButton.click();
      await page.waitForLoadState('networkidle');
      console.log('Authenticated as demo user');
    }
  });

  test('Files page loads correctly after full page refresh', async ({ page }) => {
    // Step 1: Navigate to Files page with project ID
    console.log('Step 1: Navigating to Files page...');
    await navigateToFilesPage(page, PROJECT_ID);

    // Step 2: Verify initial files load
    console.log('Step 2: Verifying initial file load...');
    const initialFileCount = await verifyFilesDisplayed(page);
    console.log(`Initial files displayed: ${initialFileCount}`);

    // Take screenshot before refresh
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'files-page-before-refresh.png'),
      fullPage: true
    });

    // Clear console errors from initial load
    const initialErrors = [...consoleErrors];
    consoleErrors = [];

    // Step 3: Perform full page refresh (Cmd+Shift+R simulation)
    console.log('Step 3: Performing hard page refresh...');
    await page.reload({ waitUntil: 'networkidle' });

    // Wait for page to stabilize
    await page.waitForLoadState('domcontentloaded');
    await page.waitForLoadState('networkidle');

    // Additional wait for any async operations
    await page.waitForTimeout(1000);

    // Step 4: Verify files still display after refresh
    console.log('Step 4: Verifying files after refresh...');
    const refreshedFileCount = await verifyFilesDisplayed(page);
    console.log(`Files after refresh: ${refreshedFileCount}`);

    // Take screenshot after refresh
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'files-page-after-refresh.png'),
      fullPage: true
    });

    // Step 5: Validate results
    console.log('Step 5: Validating test results...');

    // Files should be displayed (not showing empty state)
    expect(refreshedFileCount).toBeGreaterThan(0);

    // File count should remain consistent
    expect(refreshedFileCount).toBe(initialFileCount);

    // Check for file-loading related errors
    const fileLoadingErrors = consoleErrors.filter(err =>
      err.toLowerCase().includes('file') ||
      err.toLowerCase().includes('load') ||
      err.toLowerCase().includes('fetch') ||
      err.toLowerCase().includes('project')
    );

    console.log('\n=== TEST RESULTS ===');
    console.log(`Initial files: ${initialFileCount}`);
    console.log(`After refresh: ${refreshedFileCount}`);
    console.log(`Console errors: ${consoleErrors.length}`);
    console.log(`File-related errors: ${fileLoadingErrors.length}`);

    if (consoleErrors.length > 0) {
      console.log('\nConsole Errors:');
      consoleErrors.forEach(err => console.log(`  - ${err}`));
    }

    if (initialErrors.length > 0) {
      console.log('\nInitial Load Errors:');
      initialErrors.forEach(err => console.log(`  - ${err}`));
    }

    // Assert no file-loading errors
    expect(fileLoadingErrors).toHaveLength(0);
  });

  test('Files page - Empty state vs. Files displayed', async ({ page }) => {
    console.log('Testing empty state detection...');

    await navigateToFilesPage(page, PROJECT_ID);

    // Check for empty state indicators
    const emptyStateExists = await page.locator('[data-testid="empty-state"]').isVisible().catch(() => false);
    const noFilesText = await page.locator('text=/no files/i').isVisible().catch(() => false);
    const uploadPrompt = await page.locator('text=/upload.*first/i').isVisible().catch(() => false);

    // Check for file list
    const fileListExists = await page.locator('[data-testid="file-list"]').isVisible().catch(() => false);
    const fileItems = await page.locator('[data-testid*="file-item"], [data-testid*="file-card"]').count();

    console.log('Empty State Analysis:');
    console.log(`  Empty state component: ${emptyStateExists}`);
    console.log(`  "No files" text: ${noFilesText}`);
    console.log(`  Upload prompt: ${uploadPrompt}`);
    console.log(`  File list exists: ${fileListExists}`);
    console.log(`  File items count: ${fileItems}`);

    // Take diagnostic screenshot
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'files-page-state-analysis.png'),
      fullPage: true
    });

    // If files exist, they should be visible (not empty state)
    if (fileItems > 0) {
      expect(emptyStateExists).toBe(false);
    }
  });

  test('Files page - Tab state persistence after refresh', async ({ page }) => {
    console.log('Testing tab state after refresh...');

    await navigateToFilesPage(page, PROJECT_ID);

    // Get initial tab state
    const uploadTab = page.locator('button:has-text("Upload")');
    const manageTab = page.locator('button:has-text("Manage")');

    // Should default to Manage tab if files exist
    const initialManageActive = await isTabActive(manageTab);
    console.log(`Initial Manage tab active: ${initialManageActive}`);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'files-tabs-before-refresh.png'),
      fullPage: true
    });

    // Refresh page
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Check tab state after refresh
    const afterRefreshManageActive = await isTabActive(manageTab);
    console.log(`After refresh Manage tab active: ${afterRefreshManageActive}`);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'files-tabs-after-refresh.png'),
      fullPage: true
    });

    // If files exist, Manage tab should be active
    const fileCount = await page.locator('[data-testid*="file-item"], [data-testid*="file-card"]').count();
    if (fileCount > 0) {
      expect(afterRefreshManageActive).toBe(true);
    }
  });

  test('Files page - Network requests after refresh', async ({ page }) => {
    console.log('Monitoring network requests...');

    const networkRequests: { url: string; status: number; type: string }[] = [];

    page.on('response', (response) => {
      const url = response.url();
      // Track API calls and file requests
      if (url.includes('/api/') || url.includes('/files') || url.includes('/projects')) {
        networkRequests.push({
          url: url,
          status: response.status(),
          type: response.request().resourceType()
        });
      }
    });

    await navigateToFilesPage(page, PROJECT_ID);

    const initialRequests = [...networkRequests];
    networkRequests.length = 0;

    // Refresh and monitor requests
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    console.log('\n=== NETWORK REQUESTS AFTER REFRESH ===');
    networkRequests.forEach(req => {
      console.log(`  ${req.status} ${req.type}: ${req.url}`);
    });

    // Check for failed requests
    const failedRequests = networkRequests.filter(req => req.status >= 400);

    if (failedRequests.length > 0) {
      console.log('\n=== FAILED REQUESTS ===');
      failedRequests.forEach(req => {
        console.log(`  ${req.status}: ${req.url}`);
      });
    }

    expect(failedRequests).toHaveLength(0);
  });

  test('Files page - Component rendering after refresh', async ({ page }) => {
    console.log('Testing component rendering after refresh...');

    await navigateToFilesPage(page, PROJECT_ID);

    // Check for key components before refresh
    const componentsBeforeRefresh = await checkComponentsRendered(page);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'components-before-refresh.png'),
      fullPage: true
    });

    // Refresh
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Check components after refresh
    const componentsAfterRefresh = await checkComponentsRendered(page);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'components-after-refresh.png'),
      fullPage: true
    });

    console.log('\n=== COMPONENT RENDERING ===');
    console.log('Before Refresh:', componentsBeforeRefresh);
    console.log('After Refresh:', componentsAfterRefresh);

    // All components should render after refresh
    expect(componentsAfterRefresh.header).toBe(true);
    expect(componentsAfterRefresh.tabs).toBe(true);
    expect(componentsAfterRefresh.content).toBe(true);
  });
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function navigateToFilesPage(page: Page, projectId: string) {
  // First, navigate to Projects page and select the project
  console.log(`Setting up project context for: ${projectId}`);

  // Go to Projects page
  await page.goto('http://localhost:3003/#projects');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);

  // Look for the project in the list and click it
  const projectCard = page.locator(`[data-project-id="${projectId}"]`).first();
  const projectExists = await projectCard.isVisible({ timeout: 3000 }).catch(() => false);

  if (projectExists) {
    console.log('Found project, clicking to select...');
    await projectCard.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
  } else {
    console.log('Project not found in list, trying to set in localStorage...');
    // Fallback: Set project directly in localStorage
    await page.evaluate((id) => {
      localStorage.setItem('current_project_id', id);
    }, projectId);
  }

  // Now navigate to Files page
  console.log('Navigating to Files page...');
  await page.goto('http://localhost:3003/#files');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
}

async function verifyFilesDisplayed(page: Page): Promise<number> {
  // Wait for either files or empty state
  await page.waitForSelector('[data-testid*="file"], [data-testid="empty-state"], text=/no files/i', {
    timeout: 5000
  }).catch(() => {
    console.warn('Timeout waiting for files or empty state');
  });

  // Count file items using various possible selectors
  const selectors = [
    '[data-testid="file-item"]',
    '[data-testid="file-card"]',
    '[data-file-id]',
    '.file-item',
    '.file-card'
  ];

  let totalFiles = 0;
  for (const selector of selectors) {
    const count = await page.locator(selector).count();
    totalFiles = Math.max(totalFiles, count);
  }

  // Check if empty state is shown
  const emptyStateVisible = await page.locator('text=/no files/i').isVisible().catch(() => false);

  if (emptyStateVisible) {
    console.log('Empty state is displayed');
    return 0;
  }

  // Additional check: Look for Manage tab count
  const manageTabText = await page.locator('button:has-text("Manage")').textContent().catch(() => '');
  const tabCountMatch = manageTabText.match(/\((\d+)\)/);
  if (tabCountMatch) {
    const tabCount = parseInt(tabCountMatch[1]);
    totalFiles = Math.max(totalFiles, tabCount);
  }

  return totalFiles;
}

async function isTabActive(tabLocator: any): Promise<boolean> {
  try {
    const classes = await tabLocator.getAttribute('class');
    // Active tab typically has 'bg-white' or 'shadow' classes
    return classes?.includes('bg-white') || classes?.includes('shadow-sm') || false;
  } catch {
    return false;
  }
}

async function checkComponentsRendered(page: Page): Promise<{
  header: boolean;
  tabs: boolean;
  content: boolean;
  fileCount: number;
}> {
  const header = await page.locator('h2:has-text("File Management"), h2:has-text("Supporting Files")').isVisible().catch(() => false);
  const uploadTab = await page.locator('button:has-text("Upload")').isVisible().catch(() => false);
  const manageTab = await page.locator('button:has-text("Manage")').isVisible().catch(() => false);
  const tabs = uploadTab && manageTab;

  // Check for content area
  const hasContent = await page.locator('.min-h-\\[400px\\]').isVisible().catch(() => false);

  const fileCount = await verifyFilesDisplayed(page);

  return {
    header,
    tabs,
    content: hasContent,
    fileCount
  };
}
