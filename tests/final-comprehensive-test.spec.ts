import { test, expect, type ConsoleMessage } from '@playwright/test';

test.describe('Final Comprehensive Test: Authentication → Ideas Loading', () => {
  let consoleLogs: string[] = [];
  let consoleErrors: string[] = [];
  let networkRequests: Array<{ url: string; status: number; response?: any }> = [];

  test.beforeEach(async ({ page, context }) => {
    // Clear all storage before test
    await context.clearCookies();
    await page.goto('http://localhost:3003');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Set up console monitoring
    page.on('console', (msg: ConsoleMessage) => {
      const text = msg.text();
      if (msg.type() === 'error') {
        consoleErrors.push(text);
      }
      consoleLogs.push(`[${msg.type()}] ${text}`);
    });

    // Set up network monitoring
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('/api/') || url.includes('supabase')) {
        try {
          const body = await response.text();
          networkRequests.push({
            url,
            status: response.status(),
            response: body.substring(0, 200) // First 200 chars
          });
        } catch (e) {
          networkRequests.push({
            url,
            status: response.status()
          });
        }
      }
    });
  });

  test('Complete flow: Authentication → Ideas Loading', async ({ page }) => {
    console.log('\n========================================');
    console.log('STEP 1: Navigate and verify clean state');
    console.log('========================================\n');

    await page.goto('http://localhost:3003');
    await page.waitForLoadState('networkidle');

    // Wait a bit for initial render
    await page.waitForTimeout(2000);

    console.log('\n========================================');
    console.log('STEP 2: Click "Continue as Demo User"');
    console.log('========================================\n');

    // Look for demo user button
    const demoButton = page.locator('button', { hasText: /continue as demo user/i });
    await expect(demoButton).toBeVisible({ timeout: 10000 });

    console.log('✅ Demo user button found and visible');

    await demoButton.click();
    console.log('✅ Clicked demo user button');

    console.log('\n========================================');
    console.log('STEP 3: Monitor Authentication Chain');
    console.log('========================================\n');

    // Wait for authentication to complete
    await page.waitForTimeout(3000);

    // Check for critical auth logs
    const criticalAuthLogs = [
      '🎭 Signing in as anonymous demo user',
      '✅ Anonymous user signed in',
      '🔐 Auth state changed: SIGNED_IN',
      '🎉 Authentication successful',
      '🔐 handleAuthUser called with'
    ];

    console.log('Checking for critical auth logs:');
    criticalAuthLogs.forEach(log => {
      const found = consoleLogs.some(l => l.includes(log));
      console.log(`  ${found ? '✅' : '❌'} ${log}`);
    });

    console.log('\n========================================');
    console.log('STEP 4: Verify UI Transition');
    console.log('========================================\n');

    // Check if login screen disappeared
    const loginScreenGone = await page.locator('button', { hasText: /continue as demo user/i }).isHidden().catch(() => true);
    console.log(`  ${loginScreenGone ? '✅' : '❌'} Login screen disappeared`);

    // Check if main app rendered
    const mainAppVisible = await page.locator('[data-testid="main-app"], .app-layout, main').isVisible().catch(() => false);
    console.log(`  ${mainAppVisible ? '✅' : '❌'} Main app rendered`);

    // Check if sidebar visible
    const sidebarVisible = await page.locator('[data-testid="sidebar"], aside, nav').first().isVisible().catch(() => false);
    console.log(`  ${sidebarVisible ? '✅' : '❌'} Sidebar visible`);

    console.log('\n========================================');
    console.log('STEP 5: Monitor Ideas Loading');
    console.log('========================================\n');

    // Wait for ideas loading to trigger
    await page.waitForTimeout(3000);

    // Check for ideas loading logs
    const ideasLoadingLogs = [
      'Project changed effect triggered',
      'Loading ideas for project',
      'DIAGNOSTIC: Fetching ideas via API endpoint',
      'DIAGNOSTIC: API response status',
      'DIAGNOSTIC: API returned'
    ];

    console.log('Checking for ideas loading logs:');
    ideasLoadingLogs.forEach(log => {
      const found = consoleLogs.some(l => l.includes(log));
      console.log(`  ${found ? '✅' : '❌'} ${log}`);
    });

    // Check network requests
    console.log('\nNetwork Requests:');
    const ideasRequest = networkRequests.find(r => r.url.includes('/api/ideas'));
    if (ideasRequest) {
      console.log(`  ✅ Ideas API called: ${ideasRequest.url}`);
      console.log(`     Status: ${ideasRequest.status}`);
    } else {
      console.log('  ❌ Ideas API not called');
    }

    // Check for matrix rendering
    const matrixVisible = await page.locator('[data-testid="design-matrix"], .matrix, [class*="matrix"]').first().isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`  ${matrixVisible ? '✅' : '❌'} Matrix rendered`);

    console.log('\n========================================');
    console.log('STEP 6: Check for Errors');
    console.log('========================================\n');

    if (consoleErrors.length > 0) {
      console.log('❌ Console Errors Detected:');
      consoleErrors.forEach(err => console.log(`  - ${err}`));
    } else {
      console.log('✅ No console errors');
    }

    console.log('\n========================================');
    console.log('FULL CONSOLE TRANSCRIPT');
    console.log('========================================\n');

    consoleLogs.forEach(log => console.log(log));

    console.log('\n========================================');
    console.log('NETWORK REQUESTS SUMMARY');
    console.log('========================================\n');

    networkRequests.forEach(req => {
      console.log(`${req.status} ${req.url}`);
      if (req.response) {
        console.log(`  Response: ${req.response}`);
      }
    });

    console.log('\n========================================');
    console.log('SUCCESS CRITERIA EVALUATION');
    console.log('========================================\n');

    const authComplete = criticalAuthLogs.every(log =>
      consoleLogs.some(l => l.includes(log))
    );
    console.log(`  ${authComplete ? '✅' : '❌'} Authentication completes (all logs present)`);

    const uiTransitioned = loginScreenGone && (mainAppVisible || sidebarVisible);
    console.log(`  ${uiTransitioned ? '✅' : '❌'} UI transitions properly`);

    const ideasApiCalled = networkRequests.some(r => r.url.includes('/api/ideas'));
    console.log(`  ${ideasApiCalled ? '✅' : '❌'} Ideas API is called`);

    const matrixRendered = matrixVisible;
    console.log(`  ${matrixRendered ? '✅' : '❌'} Matrix renders correctly`);

    const noErrors = consoleErrors.length === 0;
    console.log(`  ${noErrors ? '✅' : '❌'} No errors in console`);

    const allCriteriaMet = authComplete && uiTransitioned && ideasApiCalled && matrixRendered && noErrors;

    console.log('\n========================================');
    console.log('FINAL VERDICT');
    console.log('========================================\n');

    if (allCriteriaMet) {
      console.log('🎉 IDEAS LOADING ISSUE RESOLVED ✅');
      console.log('\nAll success criteria met:');
      console.log('  ✅ Authentication chain complete');
      console.log('  ✅ UI transitions working');
      console.log('  ✅ Ideas API called successfully');
      console.log('  ✅ Matrix rendering properly');
      console.log('  ✅ No console errors');
    } else {
      console.log('❌ ISSUES REMAIN - Details above');

      if (!authComplete) {
        console.log('\n⚠️  Authentication chain incomplete - check auth logs above');
      }
      if (!uiTransitioned) {
        console.log('\n⚠️  UI transition failed - login screen may still be visible');
      }
      if (!ideasApiCalled) {
        console.log('\n⚠️  Ideas API not called - check network logs and useIdeas hook');
      }
      if (!matrixRendered) {
        console.log('\n⚠️  Matrix not rendering - check component mounting');
      }
      if (!noErrors) {
        console.log('\n⚠️  Console errors present - check error list above');
      }
    }

    // Take screenshot for evidence
    await page.screenshot({
      path: '/Users/sean.mcinerney/Documents/workshop/design-matrix-app/test-results/final-test-screenshot.png',
      fullPage: true
    });
    console.log('\n📸 Screenshot saved to test-results/final-test-screenshot.png');

    // Assert final success
    expect(allCriteriaMet, 'All success criteria should be met').toBe(true);
  });
});
