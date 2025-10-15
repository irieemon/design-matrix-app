/**
 * Quick Session Persistence Validation Script
 *
 * This script performs rapid validation of the session persistence fix
 * without the overhead of full Playwright test infrastructure.
 */

import { chromium } from 'playwright';

const PRODUCTION_URL = 'https://prioritas.ai';
const SESSION_STORAGE_KEY = 'sb-vfovtgtjailvrphsgafv-auth-token';
const TEST_PROJECT_ID = 'deade958-e26c-4c4b-99d6-8476c326427b';

async function validateSessionPersistence() {
  console.log('\n╔══════════════════════════════════════════════════════════════════╗');
  console.log('║     SESSION PERSISTENCE VALIDATION - PRODUCTION TEST            ║');
  console.log('║     Production: https://prioritas.ai                            ║');
  console.log('║     Commit: a6e676f                                             ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 500 // Slow down for visual validation
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  const results = {
    tests: [],
    passed: 0,
    failed: 0,
    skipped: 0
  };

  function logTest(name, status, message, details = null) {
    const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
    console.log(`\n${icon} TEST: ${name}`);
    console.log(`   Status: ${status}`);
    console.log(`   ${message}`);
    if (details) {
      console.log(`   Details: ${JSON.stringify(details, null, 2)}`);
    }

    results.tests.push({ name, status, message, details });
    if (status === 'PASS') results.passed++;
    else if (status === 'FAIL') results.failed++;
    else results.skipped++;
  }

  // Monitor console errors
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
      console.error('   BROWSER ERROR:', msg.text());
    }
  });

  try {
    // TEST 1: Login Screen Load Time
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('TEST 1: Login Screen Load Time (Should be < 5 seconds)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const startTime = Date.now();
    await page.goto(PRODUCTION_URL, { waitUntil: 'domcontentloaded' });

    // Wait for login form or main content
    try {
      await page.waitForSelector('input[type="email"], input[name="email"], [role="main"]', {
        timeout: 10000
      });
      const loadTime = Date.now() - startTime;

      if (loadTime < 5000) {
        logTest('Login Screen Load Time', 'PASS',
          `Page loaded in ${loadTime}ms (< 5000ms threshold)`,
          { loadTimeMs: loadTime, threshold: 5000 });
      } else {
        logTest('Login Screen Load Time', 'FAIL',
          `Page loaded in ${loadTime}ms (exceeds 5000ms threshold)`,
          { loadTimeMs: loadTime, threshold: 5000 });
      }

      await page.screenshot({ path: '/tmp/01-login-screen-load.png', fullPage: true });
      console.log('   Screenshot: /tmp/01-login-screen-load.png');
    } catch (error) {
      logTest('Login Screen Load Time', 'FAIL',
        `Timeout waiting for page elements: ${error.message}`);
    }

    // TEST 2: Pre-Login localStorage Check
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('TEST 2: Pre-Login localStorage Check (Should be empty)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const preLoginToken = await page.evaluate((key) => {
      return localStorage.getItem(key);
    }, SESSION_STORAGE_KEY);

    if (preLoginToken === null) {
      logTest('Pre-Login localStorage', 'PASS',
        'No session token before login (expected)',
        { token: null });
    } else {
      logTest('Pre-Login localStorage', 'FAIL',
        'Session token exists before login (unexpected)',
        { token: preLoginToken ? 'EXISTS' : null });
    }

    await page.screenshot({ path: '/tmp/02-pre-login-state.png', fullPage: true });
    console.log('   Screenshot: /tmp/02-pre-login-state.png');

    // TEST 3: Check if Already Logged In
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('TEST 3: Existing Session Check');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Refresh page to check for existing session
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const currentUrl = page.url();
    const hasLoginForm = await page.locator('input[type="email"]').count() > 0;

    if (hasLoginForm) {
      console.log('\n   ⚠️  NO EXISTING SESSION FOUND');
      console.log('   ═══════════════════════════════════════════════════════════════');
      console.log('   MANUAL LOGIN REQUIRED TO CONTINUE VALIDATION');
      console.log('   ═══════════════════════════════════════════════════════════════');
      console.log('   Browser window is open at: https://prioritas.ai');
      console.log('   Please:');
      console.log('     1. Enter your credentials in the browser');
      console.log('     2. Click "Sign In"');
      console.log('     3. Wait for successful login (you should see the main app)');
      console.log('     4. Press ENTER in this terminal to continue validation');
      console.log('   ═══════════════════════════════════════════════════════════════\n');

      // Wait for user to login
      await new Promise(resolve => {
        process.stdin.once('data', () => {
          console.log('\n   Continuing with validation...\n');
          resolve();
        });
      });

      await page.screenshot({ path: '/tmp/03-post-login-state.png', fullPage: true });
      console.log('   Screenshot: /tmp/03-post-login-state.png');

      logTest('Existing Session Check', 'SKIP',
        'Manual login completed by user');
    } else {
      logTest('Existing Session Check', 'PASS',
        'Existing session detected - no login required');
      console.log('   ✅ Already logged in, continuing validation...');
    }

    // TEST 4: Post-Login Session Token Verification
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('TEST 4: Post-Login Session Token Verification');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const postLoginToken = await page.evaluate((key) => {
      const token = localStorage.getItem(key);
      if (token) {
        try {
          const parsed = JSON.parse(token);
          return {
            exists: true,
            hasAccessToken: !!parsed.access_token,
            tokenPreview: parsed.access_token ? parsed.access_token.substring(0, 50) + '...' : null,
            expires: parsed.expires_at || null
          };
        } catch (e) {
          return { exists: true, parseError: true };
        }
      }
      return { exists: false };
    }, SESSION_STORAGE_KEY);

    if (postLoginToken.exists && postLoginToken.hasAccessToken) {
      logTest('Session Token Verification', 'PASS',
        'Session token exists with valid structure',
        postLoginToken);
    } else {
      logTest('Session Token Verification', 'FAIL',
        'Session token missing or invalid',
        postLoginToken);
    }

    await page.screenshot({ path: '/tmp/04-session-token-verification.png', fullPage: true });
    console.log('   Screenshot: /tmp/04-session-token-verification.png');

    // TEST 5: Session Persistence Across Refresh (CRITICAL)
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('TEST 5: Session Persistence Across Refresh (CRITICAL TEST)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const urlBeforeRefresh = page.url();
    console.log(`   URL before refresh: ${urlBeforeRefresh}`);

    // Perform hard refresh
    console.log('   Performing hard refresh...');
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(3000); // Wait for any redirects

    const urlAfterRefresh = page.url();
    console.log(`   URL after refresh: ${urlAfterRefresh}`);

    // Check if still logged in
    const stillHasToken = await page.evaluate((key) => {
      return !!localStorage.getItem(key);
    }, SESSION_STORAGE_KEY);

    const redirectedToLogin = urlAfterRefresh.includes('login') ||
                              urlAfterRefresh.includes('auth') ||
                              await page.locator('input[type="email"]').count() > 0;

    if (stillHasToken && !redirectedToLogin) {
      logTest('Session Persistence', 'PASS',
        'Session maintained after refresh - NO redirect to login',
        {
          tokenPersisted: stillHasToken,
          redirectedToLogin: redirectedToLogin,
          urlBeforeRefresh,
          urlAfterRefresh
        });
    } else {
      logTest('Session Persistence', 'FAIL',
        'Session lost after refresh - redirected to login',
        {
          tokenPersisted: stillHasToken,
          redirectedToLogin: redirectedToLogin,
          urlBeforeRefresh,
          urlAfterRefresh
        });
    }

    await page.screenshot({ path: '/tmp/05-post-refresh-session.png', fullPage: true });
    console.log('   Screenshot: /tmp/05-post-refresh-session.png');

    // TEST 6: Multiple Refresh Cycles
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('TEST 6: Multiple Refresh Cycles (Stability Test)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    let allCyclesSuccessful = true;
    const cycleResults = [];

    for (let i = 1; i <= 3; i++) {
      console.log(`\n   Refresh cycle ${i}/3...`);

      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      const hasToken = await page.evaluate((key) => {
        return !!localStorage.getItem(key);
      }, SESSION_STORAGE_KEY);

      const onLoginPage = page.url().includes('login') ||
                          await page.locator('input[type="email"]').count() > 0;

      const success = hasToken && !onLoginPage;
      cycleResults.push({ cycle: i, hasToken, onLoginPage, success });

      if (success) {
        console.log(`   ✅ Cycle ${i}: Session maintained`);
      } else {
        console.log(`   ❌ Cycle ${i}: Session lost`);
        allCyclesSuccessful = false;
      }
    }

    if (allCyclesSuccessful) {
      logTest('Multiple Refresh Cycles', 'PASS',
        'Session stable across 3 refresh cycles',
        { cycles: cycleResults });
    } else {
      logTest('Multiple Refresh Cycles', 'FAIL',
        'Session instability detected',
        { cycles: cycleResults });
    }

    await page.screenshot({ path: '/tmp/06-multiple-refresh-cycles.png', fullPage: true });
    console.log('   Screenshot: /tmp/06-multiple-refresh-cycles.png');

    // TEST 7: Project URL Navigation
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('TEST 7: Project URL Navigation with Session');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const projectUrl = `${PRODUCTION_URL}/?project=${TEST_PROJECT_ID}`;
    console.log(`   Navigating to: ${projectUrl}`);

    await page.goto(projectUrl, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const finalUrl = page.url();
    const containsProjectId = finalUrl.includes(TEST_PROJECT_ID);
    const notRedirectedToLogin = !finalUrl.includes('login') &&
                                  await page.locator('input[type="email"]').count() === 0;

    if (containsProjectId && notRedirectedToLogin) {
      logTest('Project URL Navigation', 'PASS',
        'Project URL maintained with session',
        { projectUrl, finalUrl, containsProjectId, notRedirectedToLogin });
    } else {
      logTest('Project URL Navigation', 'FAIL',
        'Failed to maintain project URL with session',
        { projectUrl, finalUrl, containsProjectId, notRedirectedToLogin });
    }

    await page.screenshot({ path: '/tmp/07-project-url-navigation.png', fullPage: true });
    console.log('   Screenshot: /tmp/07-project-url-navigation.png');

    // TEST 8: Console Errors Check
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('TEST 8: Console Errors Check');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const sessionErrors = consoleErrors.filter(err =>
      err.toLowerCase().includes('session') ||
      err.toLowerCase().includes('auth') ||
      err.toLowerCase().includes('timeout') ||
      err.toLowerCase().includes('token')
    );

    if (sessionErrors.length === 0) {
      logTest('Console Errors', 'PASS',
        'No session-related console errors detected',
        { totalErrors: consoleErrors.length, sessionErrors: 0 });
    } else {
      logTest('Console Errors', 'FAIL',
        'Session-related console errors detected',
        { errors: sessionErrors });
    }

  } catch (error) {
    console.error('\n❌ VALIDATION ERROR:', error.message);
    console.error(error.stack);
  } finally {
    // Final Summary
    console.log('\n\n╔══════════════════════════════════════════════════════════════════╗');
    console.log('║                    VALIDATION SUMMARY                            ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝\n');

    console.log(`Total Tests: ${results.tests.length}`);
    console.log(`✅ Passed: ${results.passed}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`⚠️  Skipped: ${results.skipped}\n`);

    if (results.failed === 0) {
      console.log('═══════════════════════════════════════════════════════════════════');
      console.log('🎉 ALL TESTS PASSED - SESSION PERSISTENCE FIX VALIDATED');
      console.log('═══════════════════════════════════════════════════════════════════\n');
      console.log('✅ Login screen loads quickly (< 5 seconds)');
      console.log('✅ Session token stored in localStorage');
      console.log('✅ Session persists across page refresh');
      console.log('✅ Session stable across multiple refresh cycles');
      console.log('✅ Project URLs work with maintained session');
      console.log('✅ No session-related console errors\n');
      console.log('The fix is working correctly. Session persistence is functioning.');
    } else {
      console.log('═══════════════════════════════════════════════════════════════════');
      console.log('⚠️  SOME TESTS FAILED - ISSUES DETECTED');
      console.log('═══════════════════════════════════════════════════════════════════\n');
      console.log('Failed tests indicate remaining issues with session persistence.');
      console.log('Review the detailed test output above for specific failure reasons.\n');
    }

    console.log('Screenshots saved to:');
    console.log('  /tmp/01-login-screen-load.png');
    console.log('  /tmp/02-pre-login-state.png');
    console.log('  /tmp/03-post-login-state.png (if manual login was required)');
    console.log('  /tmp/04-session-token-verification.png');
    console.log('  /tmp/05-post-refresh-session.png');
    console.log('  /tmp/06-multiple-refresh-cycles.png');
    console.log('  /tmp/07-project-url-navigation.png\n');

    // Keep browser open for manual inspection
    console.log('Browser will remain open for 10 seconds for manual inspection...');
    await page.waitForTimeout(10000);

    await browser.close();
  }
}

// Run validation
validateSessionPersistence().catch(console.error);
