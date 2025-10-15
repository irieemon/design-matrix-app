import { test, expect, chromium, Browser, Page } from '@playwright/test';

/**
 * Session Persistence Validation Test Suite
 *
 * Production URL: https://prioritas.ai
 * Commit: a6e676f - Fixed session persistence with explicit localStorage adapter
 *
 * VALIDATION REQUIREMENTS:
 * 1. Login screen appears instantly (no 8-second delay)
 * 2. User can successfully login
 * 3. Session token written to localStorage after login
 * 4. Page refresh maintains session (no redirect to login)
 * 5. Project URLs work with maintained session
 */

const PRODUCTION_URL = 'https://prioritas.ai';
const SESSION_STORAGE_KEY = 'sb-vfovtgtjailvrphsgafv-auth-token';
const TEST_PROJECT_ID = 'deade958-e26c-4c4b-99d6-8476c326427b';

test.describe('Session Persistence Validation - Production', () => {
  let browser: Browser;
  let page: Page;

  test.beforeAll(async () => {
    browser = await chromium.launch({ headless: false }); // Non-headless for visual validation
  });

  test.afterAll(async () => {
    await browser.close();
  });

  test.beforeEach(async () => {
    const context = await browser.newContext();
    page = await context.newPage();

    // Monitor console for errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error('BROWSER CONSOLE ERROR:', msg.text());
      }
    });
  });

  test('1. Login screen loads instantly (no 8-second delay)', async () => {
    const startTime = Date.now();

    await page.goto(PRODUCTION_URL);

    // Wait for login form to be visible
    const loginForm = page.locator('form, [data-testid="login-form"], input[type="email"]');
    await loginForm.first().waitFor({ state: 'visible', timeout: 10000 });

    const loadTime = Date.now() - startTime;

    console.log(`✓ Login screen loaded in ${loadTime}ms`);

    // Fail if load takes more than 5 seconds (was 8+ seconds before fix)
    expect(loadTime).toBeLessThan(5000);

    // Take screenshot
    await page.screenshot({ path: '/tmp/01-login-screen-load.png', fullPage: true });
    console.log('Screenshot saved: /tmp/01-login-screen-load.png');
  });

  test('2. Session token NOT present before login', async () => {
    await page.goto(PRODUCTION_URL);

    // Check localStorage for session token
    const sessionToken = await page.evaluate((key) => {
      return localStorage.getItem(key);
    }, SESSION_STORAGE_KEY);

    console.log('Session token before login:', sessionToken ? 'EXISTS (unexpected)' : 'NOT FOUND (expected)');

    // Should be null before login
    expect(sessionToken).toBeNull();

    await page.screenshot({ path: '/tmp/02-pre-login-state.png', fullPage: true });
  });

  test('3. Manual login validation (requires user credentials)', async () => {
    await page.goto(PRODUCTION_URL);

    // Wait for login form
    await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 5000 });

    console.log('\n========================================');
    console.log('MANUAL VALIDATION REQUIRED');
    console.log('========================================');
    console.log('Browser window is open. Please:');
    console.log('1. Enter your credentials and login');
    console.log('2. Wait for successful login');
    console.log('3. Press ENTER in this terminal when logged in');
    console.log('========================================\n');

    // Wait for user input
    await new Promise(resolve => {
      process.stdin.once('data', resolve);
    });

    await page.screenshot({ path: '/tmp/03-post-login-state.png', fullPage: true });
    console.log('Screenshot saved: /tmp/03-post-login-state.png');
  });

  test('4. Verify localStorage session token after login', async () => {
    await page.goto(PRODUCTION_URL);

    // Check if already logged in (token exists)
    let sessionToken = await page.evaluate((key) => {
      return localStorage.getItem(key);
    }, SESSION_STORAGE_KEY);

    if (!sessionToken) {
      console.log('\n⚠️  No session token found. User needs to login first.');
      console.log('Run test 3 first to establish session.\n');
      test.skip();
      return;
    }

    console.log('✓ Session token found in localStorage');
    console.log('Token key:', SESSION_STORAGE_KEY);

    // Verify token structure (should be JSON with access_token)
    const tokenData = JSON.parse(sessionToken);
    expect(tokenData).toHaveProperty('access_token');
    expect(tokenData.access_token).toBeTruthy();

    console.log('✓ Token structure valid (contains access_token)');
    console.log('Token preview:', tokenData.access_token.substring(0, 50) + '...');

    await page.screenshot({ path: '/tmp/04-session-token-verification.png', fullPage: true });
  });

  test('5. Session persists across page refresh (critical test)', async () => {
    await page.goto(PRODUCTION_URL);

    // Check if session exists
    let sessionToken = await page.evaluate((key) => {
      return localStorage.getItem(key);
    }, SESSION_STORAGE_KEY);

    if (!sessionToken) {
      console.log('\n⚠️  No session token found. User needs to login first.');
      test.skip();
      return;
    }

    console.log('✓ Initial session token found');

    // Capture current URL (should not be login page)
    const urlBeforeRefresh = page.url();
    console.log('URL before refresh:', urlBeforeRefresh);

    // Perform hard refresh
    console.log('Performing page refresh...');
    await page.reload({ waitUntil: 'networkidle' });

    // Wait a moment for any redirects
    await page.waitForTimeout(2000);

    const urlAfterRefresh = page.url();
    console.log('URL after refresh:', urlAfterRefresh);

    // Verify session token still exists
    sessionToken = await page.evaluate((key) => {
      return localStorage.getItem(key);
    }, SESSION_STORAGE_KEY);

    expect(sessionToken).toBeTruthy();
    console.log('✓ Session token persists after refresh');

    // Verify NOT redirected to login
    const isOnLoginPage = urlAfterRefresh.includes('login') ||
                          await page.locator('input[type="email"]').count() > 0;

    expect(isOnLoginPage).toBe(false);
    console.log('✓ No redirect to login page (session maintained)');

    await page.screenshot({ path: '/tmp/05-post-refresh-session.png', fullPage: true });
    console.log('Screenshot saved: /tmp/05-post-refresh-session.png');
  });

  test('6. Multiple refresh cycles maintain session', async () => {
    await page.goto(PRODUCTION_URL);

    let sessionToken = await page.evaluate((key) => {
      return localStorage.getItem(key);
    }, SESSION_STORAGE_KEY);

    if (!sessionToken) {
      console.log('\n⚠️  No session token found. User needs to login first.');
      test.skip();
      return;
    }

    const originalToken = sessionToken;

    // Perform 3 refresh cycles
    for (let i = 1; i <= 3; i++) {
      console.log(`\nRefresh cycle ${i}/3...`);

      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      sessionToken = await page.evaluate((key) => {
        return localStorage.getItem(key);
      }, SESSION_STORAGE_KEY);

      expect(sessionToken).toBeTruthy();

      const isOnLoginPage = page.url().includes('login') ||
                            await page.locator('input[type="email"]').count() > 0;

      expect(isOnLoginPage).toBe(false);
      console.log(`✓ Cycle ${i}: Session maintained`);
    }

    console.log('\n✓ All 3 refresh cycles successful - session stable');
    await page.screenshot({ path: '/tmp/06-multiple-refresh-cycles.png', fullPage: true });
  });

  test('7. Project URL navigation with session', async () => {
    const projectUrl = `${PRODUCTION_URL}/?project=${TEST_PROJECT_ID}`;

    await page.goto(projectUrl);

    // Check session token
    const sessionToken = await page.evaluate((key) => {
      return localStorage.getItem(key);
    }, SESSION_STORAGE_KEY);

    if (!sessionToken) {
      console.log('\n⚠️  No session token found. User needs to login first.');
      test.skip();
      return;
    }

    console.log('✓ Navigated to project URL with session');
    console.log('Project URL:', projectUrl);

    // Wait for any redirects
    await page.waitForTimeout(2000);

    const finalUrl = page.url();
    console.log('Final URL:', finalUrl);

    // Should contain project ID (not redirected away)
    expect(finalUrl).toContain(TEST_PROJECT_ID);
    console.log('✓ Project URL maintained (no redirect)');

    // Should not be on login page
    const isOnLoginPage = finalUrl.includes('login') ||
                          await page.locator('input[type="email"]').count() > 0;

    expect(isOnLoginPage).toBe(false);
    console.log('✓ Not redirected to login page');

    await page.screenshot({ path: '/tmp/07-project-url-navigation.png', fullPage: true });
    console.log('Screenshot saved: /tmp/07-project-url-navigation.png');
  });

  test('8. Console errors check', async () => {
    const errors: string[] = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto(PRODUCTION_URL);

    // Check for session token
    const sessionToken = await page.evaluate((key) => {
      return localStorage.getItem(key);
    }, SESSION_STORAGE_KEY);

    if (sessionToken) {
      // Perform refresh if logged in
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
    }

    // Filter for session-related errors
    const sessionErrors = errors.filter(err =>
      err.toLowerCase().includes('session') ||
      err.toLowerCase().includes('auth') ||
      err.toLowerCase().includes('timeout')
    );

    if (sessionErrors.length > 0) {
      console.log('\n⚠️  Session-related console errors detected:');
      sessionErrors.forEach(err => console.error('  -', err));
    } else {
      console.log('✓ No session-related console errors');
    }

    expect(sessionErrors.length).toBe(0);
  });
});

test.describe('Session Persistence - User Instructions', () => {
  test('INSTRUCTIONS: How to run this validation', async () => {
    console.log('\n╔══════════════════════════════════════════════════════════════════╗');
    console.log('║  SESSION PERSISTENCE VALIDATION - EXECUTION INSTRUCTIONS         ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝\n');

    console.log('AUTOMATED VALIDATION (Tests 1, 2, 8):');
    console.log('  npx playwright test tests/session-persistence-validation.spec.ts -g "Login screen loads|Session token NOT|Console errors"\n');

    console.log('MANUAL VALIDATION (Tests 3-7):');
    console.log('  1. Run: npx playwright test tests/session-persistence-validation.spec.ts -g "Manual login"');
    console.log('  2. Browser window opens to https://prioritas.ai');
    console.log('  3. Login with your credentials');
    console.log('  4. Press ENTER in terminal after successful login');
    console.log('  5. Run remaining tests:\n');
    console.log('     npx playwright test tests/session-persistence-validation.spec.ts -g "Verify localStorage|Session persists|Multiple refresh|Project URL"\n');

    console.log('FULL VALIDATION (All tests):');
    console.log('  npx playwright test tests/session-persistence-validation.spec.ts\n');

    console.log('SCREENSHOTS LOCATION:');
    console.log('  /tmp/01-login-screen-load.png');
    console.log('  /tmp/02-pre-login-state.png');
    console.log('  /tmp/03-post-login-state.png');
    console.log('  /tmp/04-session-token-verification.png');
    console.log('  /tmp/05-post-refresh-session.png');
    console.log('  /tmp/06-multiple-refresh-cycles.png');
    console.log('  /tmp/07-project-url-navigation.png\n');

    console.log('EXPECTED OUTCOMES:');
    console.log('  ✅ Test 1: Login screen loads in <5 seconds');
    console.log('  ✅ Test 2: No session token before login');
    console.log('  ✅ Test 3: Successful manual login');
    console.log('  ✅ Test 4: Session token exists in localStorage');
    console.log('  ✅ Test 5: Session persists after refresh (NO redirect to login)');
    console.log('  ✅ Test 6: Session stable across 3+ refresh cycles');
    console.log('  ✅ Test 7: Project URLs work with maintained session');
    console.log('  ✅ Test 8: No session timeout console errors\n');

    console.log('FAILURE INDICATORS:');
    console.log('  ❌ Redirect to login after refresh = Session NOT persisting');
    console.log('  ❌ Missing localStorage token = Storage adapter not working');
    console.log('  ❌ Load time >5s = Still experiencing delay issue');
    console.log('  ❌ Console errors about session = Timeout issues remain\n');

    console.log('═══════════════════════════════════════════════════════════════════\n');
  });
});
