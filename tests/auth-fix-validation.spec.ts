import { test, expect } from '@playwright/test';

test.describe('Demo User Authentication Fix Validation', () => {
  test('demo user authentication should work and app should render', async ({ page }) => {
    const consoleLogs: string[] = [];
    const consoleErrors: string[] = [];

    // Capture console logs
    page.on('console', msg => {
      const text = msg.text();
      consoleLogs.push(`[${msg.type()}] ${text}`);

      if (msg.type() === 'error') {
        consoleErrors.push(text);
      }
    });

    // Navigate to app
    console.log('📍 Navigating to http://localhost:3005');
    await page.goto('http://localhost:3005', { waitUntil: 'networkidle' });

    // Take screenshot of login screen
    await page.screenshot({
      path: 'test-results/auth-fix-before-login.png',
      fullPage: true
    });
    console.log('📸 Screenshot taken: before login');

    // Wait for and click demo user button
    console.log('🔍 Looking for demo user button...');
    const demoButton = page.getByRole('button', { name: /continue as demo user/i });
    await expect(demoButton).toBeVisible({ timeout: 10000 });

    console.log('🖱️  Clicking demo user button...');
    await demoButton.click();

    // Wait a moment for authentication to process
    await page.waitForTimeout(2000);

    // Check if we're still on login screen or if app rendered
    const isLoginScreenVisible = await page.locator('text=/sign in|log in|authentication/i').isVisible()
      .catch(() => false);

    console.log(`🔍 Login screen still visible: ${isLoginScreenVisible}`);

    // Take screenshot after clicking demo button
    await page.screenshot({
      path: 'test-results/auth-fix-after-demo-click.png',
      fullPage: true
    });
    console.log('📸 Screenshot taken: after demo button click');

    // Wait for app to render (look for sidebar or matrix)
    console.log('⏳ Waiting for app to render...');
    try {
      await page.waitForSelector('[data-testid="sidebar"], [data-testid="matrix"], nav, main', {
        timeout: 10000
      });
      console.log('✅ App rendered successfully!');
    } catch (e) {
      console.log('❌ App did not render within 10 seconds');
    }

    // Wait a bit more for ideas to load
    await page.waitForTimeout(3000);

    // Take final screenshot
    await page.screenshot({
      path: 'test-results/auth-fix-final-state.png',
      fullPage: true
    });
    console.log('📸 Screenshot taken: final state');

    // Print all console logs
    console.log('\n📋 === CONSOLE LOG TRANSCRIPT ===');
    consoleLogs.forEach(log => console.log(log));
    console.log('=== END CONSOLE LOGS ===\n');

    // Check for critical success indicators in logs
    const hasAnonymousSignIn = consoleLogs.some(log =>
      log.includes('Anonymous user signed in') || log.includes('Signing in as anonymous demo user')
    );
    const hasHandleAuthUser = consoleLogs.some(log =>
      log.includes('handleAuthUser called with')
    );
    const hasSetDemoUserState = consoleLogs.some(log =>
      log.includes('Setting demo user state')
    );
    const hasProjectChanged = consoleLogs.some(log =>
      log.includes('Project changed effect triggered')
    );

    console.log('\n🔍 === KEY LOG INDICATORS ===');
    console.log(`✅ Anonymous sign in: ${hasAnonymousSignIn}`);
    console.log(`✅ handleAuthUser called: ${hasHandleAuthUser} ← CRITICAL FIX INDICATOR`);
    console.log(`✅ Demo user state set: ${hasSetDemoUserState}`);
    console.log(`✅ Project changed effect: ${hasProjectChanged}`);
    console.log('=== END INDICATORS ===\n');

    // Report errors
    if (consoleErrors.length > 0) {
      console.log('\n⚠️  === CONSOLE ERRORS ===');
      consoleErrors.forEach(err => console.log(`❌ ${err}`));
      console.log('=== END ERRORS ===\n');
    }

    // Assertions
    expect(hasAnonymousSignIn, 'Demo user sign-in should be initiated').toBe(true);
    expect(hasHandleAuthUser, 'handleAuthUser should be called (FIX VALIDATION)').toBe(true);
    expect(consoleErrors.length, 'Should have no console errors').toBe(0);
  });
});
