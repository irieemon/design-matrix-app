import { test, expect } from '@playwright/test';

test('Investigate Ideas Loading - Demo User Flow', async ({ page }) => {
  // Array to capture all console messages
  const consoleMessages: Array<{type: string, text: string, timestamp: Date}> = [];

  // Capture ALL console messages
  page.on('console', msg => {
    const timestamp = new Date();
    const entry = {
      type: msg.type(),
      text: msg.text(),
      timestamp
    };
    consoleMessages.push(entry);
    console.log(`[${timestamp.toISOString()}] [${msg.type().toUpperCase()}] ${msg.text()}`);
  });

  // Capture page errors
  page.on('pageerror', error => {
    console.error(`[PAGE ERROR] ${error.message}`);
    consoleMessages.push({
      type: 'pageerror',
      text: error.message,
      timestamp: new Date()
    });
  });

  // Capture network requests for API debugging
  const apiRequests: Array<{url: string, method: string, timestamp: Date}> = [];
  page.on('request', request => {
    if (request.url().includes('/api/') || request.url().includes('/ideas')) {
      const entry = {
        url: request.url(),
        method: request.method(),
        timestamp: new Date()
      };
      apiRequests.push(entry);
      console.log(`[API REQUEST] ${request.method()} ${request.url()}`);
    }
  });

  page.on('response', async response => {
    if (response.url().includes('/api/') || response.url().includes('/ideas')) {
      console.log(`[API RESPONSE] ${response.status()} ${response.url()}`);
      try {
        const body = await response.text();
        console.log(`[API RESPONSE BODY] ${body.substring(0, 500)}`);
      } catch (e) {
        console.log('[API RESPONSE BODY] Unable to read');
      }
    }
  });

  console.log('\n=== STARTING INVESTIGATION V2 ===\n');

  // Navigate to the app
  console.log('Step 1: Navigating to http://localhost:3006');
  await page.goto('http://localhost:3006', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Take initial screenshot
  await page.screenshot({ path: 'screenshots/v2-01-initial-load.png', fullPage: true });
  console.log('Screenshot saved: v2-01-initial-load.png');

  // Click "Continue as Demo User" button
  console.log('\nStep 2: Clicking "Continue as Demo User" button');
  const demoButton = page.locator('button:has-text("Continue as Demo User")');
  await demoButton.waitFor({ state: 'visible', timeout: 10000 });
  await demoButton.click();
  console.log('Demo user button clicked, waiting for navigation...');

  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'screenshots/v2-02-after-demo-login.png', fullPage: true });
  console.log('Screenshot saved: v2-02-after-demo-login.png');

  // Check URL after login
  console.log(`Current URL: ${page.url()}`);

  // Wait for potential project selection or matrix to load
  console.log('\nStep 3: Waiting for app to initialize...');
  await page.waitForTimeout(5000);

  // Check if we're on a project page or need to select/create project
  const currentUrl = page.url();
  console.log(`Current URL after wait: ${currentUrl}`);

  // Take screenshot of current state
  await page.screenshot({ path: 'screenshots/v2-03-app-state.png', fullPage: true });
  console.log('Screenshot saved: v2-03-app-state.png');

  // Check for project-related elements
  const hasProjectSelector = await page.locator('[data-testid="project-selector"]').isVisible().catch(() => false);
  const hasCreateProject = await page.locator('button:has-text("Create Project"), button:has-text("New Project")').isVisible().catch(() => false);
  const hasMatrix = await page.locator('[data-testid="design-matrix"]').isVisible().catch(() => false);

  console.log(`\nUI State Check:`);
  console.log(`  - Project selector visible: ${hasProjectSelector}`);
  console.log(`  - Create project button visible: ${hasCreateProject}`);
  console.log(`  - Design matrix visible: ${hasMatrix}`);

  // If we need to create or select a project, do so
  if (hasCreateProject && !hasMatrix) {
    console.log('\nStep 4: Creating a new project...');
    const createBtn = page.locator('button:has-text("Create Project"), button:has-text("New Project")').first();
    await createBtn.click();
    await page.waitForTimeout(2000);

    // Fill in project details
    const nameInput = page.locator('input[name="name"], input[placeholder*="name" i]').first();
    if (await nameInput.isVisible().catch(() => false)) {
      await nameInput.fill('Investigation Test Project');

      const submitBtn = page.locator('button:has-text("Create"), button[type="submit"]').first();
      await submitBtn.click();
      console.log('Project creation submitted');

      await page.waitForTimeout(5000);
      await page.screenshot({ path: 'screenshots/v2-04-after-project-creation.png', fullPage: true });
    }
  } else if (hasProjectSelector && !hasMatrix) {
    console.log('\nStep 4: Selecting existing project...');
    const selector = page.locator('[data-testid="project-selector"]').first();
    await selector.click();
    await page.waitForTimeout(1000);

    // Try to select first project option
    const firstOption = page.locator('[role="option"]').first();
    if (await firstOption.isVisible().catch(() => false)) {
      await firstOption.click();
      console.log('Project selected');
      await page.waitForTimeout(3000);
      await page.screenshot({ path: 'screenshots/v2-04-after-project-selection.png', fullPage: true });
    }
  } else {
    console.log('\nStep 4: Already in project context (or matrix visible)');
  }

  // Wait for ideas to potentially load
  console.log('\nStep 5: Waiting 15 seconds for ideas to load...');
  await page.waitForTimeout(15000);

  // Take final screenshot
  await page.screenshot({ path: 'screenshots/v2-05-final-state.png', fullPage: true });
  console.log('Screenshot saved: v2-05-final-state.png');

  // Check DOM for DesignMatrix and ideas
  console.log('\nStep 6: Inspecting DOM for DesignMatrix and ideas');

  const matrixVisible = await page.locator('[data-testid="design-matrix"]').isVisible().catch(() => false);
  console.log(`DesignMatrix component visible: ${matrixVisible}`);

  const ideaCards = await page.locator('[data-testid^="idea-card"]').count();
  console.log(`Idea cards found in DOM: ${ideaCards}`);

  const emptyState = await page.locator('text=/no ideas|empty|get started/i').isVisible().catch(() => false);
  console.log(`Empty state visible: ${emptyState}`);

  const loadingState = await page.locator('text=/loading/i').isVisible().catch(() => false);
  console.log(`Loading state visible: ${loadingState}`);

  // Get current project info from local storage
  console.log('\nStep 7: Checking browser state');
  const browserState = await page.evaluate(() => {
    return {
      localStorage: JSON.parse(JSON.stringify(localStorage)),
      currentUrl: window.location.href,
      currentPath: window.location.pathname
    };
  });

  console.log('Browser State:', JSON.stringify(browserState, null, 2));

  // Analyze console messages
  console.log('\n=== CONSOLE LOG ANALYSIS ===\n');
  console.log(`Total console messages: ${consoleMessages.length}`);

  // Filter for specific diagnostic messages
  const projectChangedLogs = consoleMessages.filter(m => m.text.includes('Project changed effect triggered'));
  const loadingIdeasLogs = consoleMessages.filter(m => m.text.includes('Loading ideas for project'));
  const fetchingLogs = consoleMessages.filter(m => m.text.includes('DIAGNOSTIC: Fetching ideas'));
  const apiResponseLogs = consoleMessages.filter(m => m.text.includes('DIAGNOSTIC: API response'));
  const apiReturnedLogs = consoleMessages.filter(m => m.text.includes('DIAGNOSTIC: API returned'));
  const errorLogs = consoleMessages.filter(m => m.type === 'error' || m.type === 'pageerror');
  const warningLogs = consoleMessages.filter(m => m.type === 'warning');

  console.log(`\n"Project changed effect triggered" logs: ${projectChangedLogs.length}`);
  projectChangedLogs.forEach(log => console.log(`  - ${log.text}`));

  console.log(`\n"Loading ideas for project" logs: ${loadingIdeasLogs.length}`);
  loadingIdeasLogs.forEach(log => console.log(`  - ${log.text}`));

  console.log(`\n"DIAGNOSTIC: Fetching ideas" logs: ${fetchingLogs.length}`);
  fetchingLogs.forEach(log => console.log(`  - ${log.text}`));

  console.log(`\n"DIAGNOSTIC: API response" logs: ${apiResponseLogs.length}`);
  apiResponseLogs.forEach(log => console.log(`  - ${log.text}`));

  console.log(`\n"DIAGNOSTIC: API returned" logs: ${apiReturnedLogs.length}`);
  apiReturnedLogs.forEach(log => console.log(`  - ${log.text}`));

  console.log(`\nError logs: ${errorLogs.length}`);
  errorLogs.forEach(log => console.log(`  - ${log.text}`));

  console.log(`\nWarning logs: ${warningLogs.length}`);
  warningLogs.slice(0, 10).forEach(log => console.log(`  - ${log.text}`));

  // API Request Analysis
  console.log(`\n=== API REQUEST ANALYSIS ===\n`);
  console.log(`Total API requests: ${apiRequests.length}`);
  apiRequests.forEach((req, idx) => {
    console.log(`${idx + 1}. [${req.timestamp.toISOString()}] ${req.method} ${req.url}`);
  });

  // All console messages
  console.log('\n=== LAST 50 CONSOLE MESSAGES ===\n');
  consoleMessages.slice(-50).forEach((msg, idx) => {
    console.log(`${idx + 1}. [${msg.timestamp.toISOString()}] [${msg.type.toUpperCase()}] ${msg.text}`);
  });

  console.log('\n=== INVESTIGATION V2 COMPLETE ===\n');
});
