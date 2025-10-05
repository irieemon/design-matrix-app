import { test, expect } from '@playwright/test';

test('Investigate Ideas Loading Issue', async ({ page }) => {
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

  // Capture network failures
  page.on('requestfailed', request => {
    console.error(`[REQUEST FAILED] ${request.url()} - ${request.failure()?.errorText}`);
  });

  console.log('\n=== STARTING INVESTIGATION ===\n');

  // Navigate to the app
  console.log('Step 1: Navigating to http://localhost:3006');
  await page.goto('http://localhost:3006', { waitUntil: 'networkidle' });

  // Take initial screenshot
  await page.screenshot({ path: 'screenshots/01-initial-load.png', fullPage: true });
  console.log('Screenshot saved: 01-initial-load.png');

  // Wait a bit to see initial console logs
  await page.waitForTimeout(2000);

  // Check if we need to authenticate
  console.log('\nStep 2: Checking authentication state');
  const isAuthScreen = await page.locator('text=/sign in|log in|login/i').isVisible().catch(() => false);

  if (isAuthScreen) {
    console.log('Auth screen detected, attempting login...');

    // Try demo user login
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
    const loginButton = page.locator('button:has-text("Sign In"), button:has-text("Log In")').first();

    await emailInput.fill('demo@designmatrix.app');
    await passwordInput.fill('demo123');
    await loginButton.click();

    console.log('Login submitted, waiting for navigation...');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'screenshots/02-after-login.png', fullPage: true });
  } else {
    console.log('No auth screen detected, proceeding...');
  }

  // Check for project selection
  console.log('\nStep 3: Checking for project selection');
  await page.waitForTimeout(2000);

  // Take screenshot of current state
  await page.screenshot({ path: 'screenshots/03-project-state.png', fullPage: true });

  // Check if project selector is visible
  const projectSelector = page.locator('[data-testid="project-selector"], select, button:has-text("Select Project")').first();
  const hasSelectorVisible = await projectSelector.isVisible().catch(() => false);

  if (hasSelectorVisible) {
    console.log('Project selector found, attempting to select project...');

    // Try to select the first project
    const firstProjectOption = page.locator('option, [role="option"]').nth(1);
    if (await firstProjectOption.isVisible().catch(() => false)) {
      await firstProjectOption.click();
      console.log('Project selected, waiting for ideas to load...');
      await page.waitForTimeout(3000);
    } else {
      // Try clicking the selector to open dropdown
      await projectSelector.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'screenshots/04-project-dropdown.png', fullPage: true });

      // Try to click first option
      const options = page.locator('[role="option"], li').first();
      if (await options.isVisible().catch(() => false)) {
        await options.click();
        await page.waitForTimeout(3000);
      }
    }
  } else {
    console.log('No project selector found - may already have a project selected');
  }

  // Check if "Create Project" flow is needed
  const createProjectBtn = page.locator('button:has-text("Create Project"), button:has-text("New Project")').first();
  if (await createProjectBtn.isVisible().catch(() => false)) {
    console.log('Create Project button found, creating a test project...');
    await createProjectBtn.click();
    await page.waitForTimeout(1000);

    // Fill project name
    const projectNameInput = page.locator('input[name="name"], input[placeholder*="name" i]').first();
    if (await projectNameInput.isVisible().catch(() => false)) {
      await projectNameInput.fill('Test Investigation Project');

      const submitBtn = page.locator('button:has-text("Create"), button[type="submit"]').first();
      await submitBtn.click();
      await page.waitForTimeout(3000);
    }
  }

  // Take screenshot after project selection
  await page.screenshot({ path: 'screenshots/05-after-project-selection.png', fullPage: true });

  // Wait for ideas to potentially load
  console.log('\nStep 4: Waiting for ideas to load (10 seconds)...');
  await page.waitForTimeout(10000);

  // Check DOM for DesignMatrix component
  console.log('\nStep 5: Inspecting DOM for DesignMatrix and ideas');

  const matrixVisible = await page.locator('[data-testid="design-matrix"]').isVisible().catch(() => false);
  console.log(`DesignMatrix component visible: ${matrixVisible}`);

  const ideaCards = await page.locator('[data-testid^="idea-card"]').count();
  console.log(`Idea cards found in DOM: ${ideaCards}`);

  const emptyState = await page.locator('text=/no ideas|empty|get started/i').isVisible().catch(() => false);
  console.log(`Empty state visible: ${emptyState}`);

  const loadingState = await page.locator('text=/loading/i').isVisible().catch(() => false);
  console.log(`Loading state visible: ${loadingState}`);

  // Capture React state using browser context
  console.log('\nStep 6: Capturing React state from browser context');
  const appState = await page.evaluate(() => {
    // Try to access React DevTools or component state
    const results: any = {
      timestamp: new Date().toISOString(),
      localStorage: {},
      sessionStorage: {}
    };

    // Get storage
    try {
      results.localStorage = JSON.parse(JSON.stringify(localStorage));
      results.sessionStorage = JSON.parse(JSON.stringify(sessionStorage));
    } catch (e) {
      results.storageError = String(e);
    }

    // Check for global state managers
    if ((window as any).__REDUX_DEVTOOLS_EXTENSION__) {
      results.hasRedux = true;
    }

    return results;
  });

  console.log('Browser state captured:', JSON.stringify(appState, null, 2));

  // Final screenshot
  await page.screenshot({ path: 'screenshots/06-final-state.png', fullPage: true });

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
  warningLogs.forEach(log => console.log(`  - ${log.text}`));

  // All console messages
  console.log('\n=== ALL CONSOLE MESSAGES (CHRONOLOGICAL) ===\n');
  consoleMessages.forEach((msg, idx) => {
    console.log(`${idx + 1}. [${msg.timestamp.toISOString()}] [${msg.type.toUpperCase()}] ${msg.text}`);
  });

  console.log('\n=== INVESTIGATION COMPLETE ===\n');
  console.log('Screenshots saved in screenshots/ directory');
  console.log('Check the console output above for detailed analysis');
});
