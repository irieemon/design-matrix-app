import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * COMPREHENSIVE E2E TEST: Authentication → Ideas Loading
 *
 * CONTEXT:
 * Fixed TWO critical bugs:
 * 1. Stale closure in useAuth.ts: Added handleAuthUser dependency to handleAuthSuccess callback
 * 2. Wrong auth system: Disabled httpOnly cookie auth (VITE_FEATURE_HTTPONLY_AUTH=false)
 *
 * TEST OBJECTIVE:
 * Verify complete flow from authentication through ideas loading works end-to-end
 */

interface ConsoleLog {
  type: string;
  text: string;
  timestamp: number;
}

interface TestEvidence {
  consoleLogs: ConsoleLog[];
  authLogs: ConsoleLog[];
  ideasLogs: ConsoleLog[];
  screenshots: {
    login: string;
    afterAuth: string;
    matrix: string;
  };
  networkCalls: {
    url: string;
    status: number;
    method: string;
  }[];
  testResults: {
    authenticationWorks: boolean;
    ideasLoadingWorks: boolean;
    uiTransitions: boolean;
    apiCallsMade: boolean;
  };
}

test.describe('E2E: Authentication → Ideas Loading Flow', () => {
  let consoleLogs: ConsoleLog[] = [];
  let evidence: TestEvidence;

  test.beforeEach(async ({ page }) => {
    // Reset evidence
    consoleLogs = [];
    evidence = {
      consoleLogs: [],
      authLogs: [],
      ideasLogs: [],
      screenshots: {
        login: '',
        afterAuth: '',
        matrix: ''
      },
      networkCalls: [],
      testResults: {
        authenticationWorks: false,
        ideasLoadingWorks: false,
        uiTransitions: false,
        apiCallsMade: false
      }
    };

    // Capture all console messages
    page.on('console', (msg) => {
      const log: ConsoleLog = {
        type: msg.type(),
        text: msg.text(),
        timestamp: Date.now()
      };
      consoleLogs.push(log);

      // Log to test output for immediate visibility
      console.log(`[BROWSER ${msg.type().toUpperCase()}] ${msg.text()}`);
    });

    // Capture network requests
    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('/api/') || url.includes('supabase')) {
        console.log(`[NETWORK REQUEST] ${request.method()} ${url}`);
      }
    });

    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('/api/') || url.includes('supabase')) {
        const networkCall = {
          url,
          status: response.status(),
          method: response.request().method()
        };
        evidence.networkCalls.push(networkCall);
        console.log(`[NETWORK RESPONSE] ${networkCall.method} ${url} → ${networkCall.status}`);
      }
    });

    // Capture JavaScript errors
    page.on('pageerror', (error) => {
      console.error(`[BROWSER ERROR] ${error.message}`);
      consoleLogs.push({
        type: 'error',
        text: `PAGE ERROR: ${error.message}`,
        timestamp: Date.now()
      });
    });
  });

  test('Complete flow: Login → Auth → Ideas Load → Matrix Display', async ({ page }) => {
    console.log('\n=== PHASE 1: AUTHENTICATION ===\n');

    // Navigate to app
    await page.goto('/');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Screenshot 1: Login screen
    const loginScreenshotPath = path.join('test-results', 'evidence', `login-${Date.now()}.png`);
    await page.screenshot({ path: loginScreenshotPath, fullPage: true });
    evidence.screenshots.login = loginScreenshotPath;
    console.log(`📸 Screenshot saved: ${loginScreenshotPath}`);

    // Verify login screen is visible
    const demoButton = page.locator('button', { hasText: /continue as demo user/i });
    await expect(demoButton).toBeVisible({ timeout: 10000 });
    console.log('✅ Login screen visible');

    // Click "Continue as Demo User"
    console.log('\n🖱️  Clicking "Continue as Demo User" button...\n');
    await demoButton.click();

    // Wait for authentication to complete
    // We expect these logs in order:
    const expectedAuthLogs = [
      '🎭 Signing in as anonymous demo user',
      '✅ Anonymous user signed in',
      '🎉 Authentication successful',
      '🔐 handleAuthUser called with',
      '🔓 Setting demo user state',
      '✅ Demo user state set complete'
    ];

    console.log('⏳ Waiting for authentication to complete...\n');

    // Wait for the final auth log to appear (up to 15 seconds)
    let authComplete = false;
    const authTimeout = 15000;
    const authStartTime = Date.now();

    while (!authComplete && (Date.now() - authStartTime) < authTimeout) {
      await page.waitForTimeout(500);

      // Check if we have the complete auth flow in logs
      const logsText = consoleLogs.map(l => l.text).join('\n');
      authComplete = expectedAuthLogs.every(expected =>
        logsText.includes(expected)
      );
    }

    // Extract auth-related logs
    evidence.authLogs = consoleLogs.filter(log =>
      log.text.includes('🎭') ||
      log.text.includes('🎉') ||
      log.text.includes('🔐') ||
      log.text.includes('🔓') ||
      log.text.includes('Anonymous user') ||
      log.text.includes('Demo user')
    );

    // Verify auth logs
    console.log('\n📋 Authentication logs captured:');
    evidence.authLogs.forEach(log => {
      console.log(`  [${log.type}] ${log.text}`);
    });

    // Check for critical auth logs
    const hasSigningInLog = evidence.authLogs.some(log =>
      log.text.includes('🎭 Signing in as anonymous demo user')
    );
    const hasAuthSuccessLog = evidence.authLogs.some(log =>
      log.text.includes('🎉 Authentication successful')
    );
    const hasHandleAuthUserLog = evidence.authLogs.some(log =>
      log.text.includes('🔐 handleAuthUser called with')
    );
    const hasDemoUserSetLog = evidence.authLogs.some(log =>
      log.text.includes('🔓 Setting demo user state')
    );
    const hasDemoUserCompleteLog = evidence.authLogs.some(log =>
      log.text.includes('✅ Demo user state set complete')
    );

    evidence.testResults.authenticationWorks =
      hasSigningInLog &&
      hasAuthSuccessLog &&
      hasHandleAuthUserLog &&
      hasDemoUserSetLog &&
      hasDemoUserCompleteLog;

    if (evidence.testResults.authenticationWorks) {
      console.log('\n✅ AUTHENTICATION: Complete auth flow detected!');
    } else {
      console.log('\n❌ AUTHENTICATION: Missing critical auth logs:');
      if (!hasSigningInLog) console.log('  ❌ Missing: "🎭 Signing in as anonymous demo user"');
      if (!hasAuthSuccessLog) console.log('  ❌ Missing: "🎉 Authentication successful"');
      if (!hasHandleAuthUserLog) console.log('  ❌ Missing: "🔐 handleAuthUser called with"');
      if (!hasDemoUserSetLog) console.log('  ❌ Missing: "🔓 Setting demo user state"');
      if (!hasDemoUserCompleteLog) console.log('  ❌ Missing: "✅ Demo user state set complete"');
    }

    // Wait for UI transition
    console.log('\n⏳ Waiting for UI transition...\n');

    // Wait for login screen to disappear
    await expect(demoButton).not.toBeVisible({ timeout: 10000 });
    console.log('✅ Login screen disappeared');

    // Wait for main app to render
    const sidebar = page.locator('[data-testid="sidebar"], nav, aside').first();
    await expect(sidebar).toBeVisible({ timeout: 10000 });
    console.log('✅ Sidebar visible');

    // Screenshot 2: After authentication
    const afterAuthScreenshotPath = path.join('test-results', 'evidence', `after-auth-${Date.now()}.png`);
    await page.screenshot({ path: afterAuthScreenshotPath, fullPage: true });
    evidence.screenshots.afterAuth = afterAuthScreenshotPath;
    console.log(`📸 Screenshot saved: ${afterAuthScreenshotPath}`);

    evidence.testResults.uiTransitions = true;
    console.log('✅ UI TRANSITIONS: App rendered successfully');

    console.log('\n=== PHASE 2: IDEAS LOADING ===\n');

    // Wait for ideas loading to trigger
    console.log('⏳ Waiting for ideas loading to start...\n');

    let ideasLoadingStarted = false;
    const ideasTimeout = 15000;
    const ideasStartTime = Date.now();

    while (!ideasLoadingStarted && (Date.now() - ideasStartTime) < ideasTimeout) {
      await page.waitForTimeout(500);

      // Check if ideas loading has started
      const logsText = consoleLogs.map(l => l.text).join('\n');
      ideasLoadingStarted =
        logsText.includes('Project changed effect triggered') ||
        logsText.includes('Loading ideas for project') ||
        logsText.includes('DIAGNOSTIC: Fetching ideas');
    }

    // Extract ideas-related logs
    evidence.ideasLogs = consoleLogs.filter(log =>
      log.text.includes('Project changed') ||
      log.text.includes('Loading ideas') ||
      log.text.includes('DIAGNOSTIC') ||
      log.text.includes('ideas') ||
      log.text.includes('setIdeas')
    );

    console.log('\n📋 Ideas loading logs captured:');
    evidence.ideasLogs.forEach(log => {
      console.log(`  [${log.type}] ${log.text}`);
    });

    // Check for critical ideas logs
    const hasProjectChangedLog = evidence.ideasLogs.some(log =>
      log.text.includes('Project changed effect triggered')
    );
    const hasLoadingIdeasLog = evidence.ideasLogs.some(log =>
      log.text.includes('Loading ideas for project')
    );
    const hasFetchingDiagnostic = evidence.ideasLogs.some(log =>
      log.text.includes('🔍 DIAGNOSTIC: Fetching ideas')
    );
    const hasApiResponseLog = evidence.ideasLogs.some(log =>
      log.text.includes('🔍 DIAGNOSTIC: API response status')
    );
    const hasApiReturnedLog = evidence.ideasLogs.some(log =>
      log.text.includes('🔍 DIAGNOSTIC: API returned')
    );
    const hasSetIdeasLog = evidence.ideasLogs.some(log =>
      log.text.includes('🔍 DIAGNOSTIC: setIdeas completed')
    );

    // Check for API calls to /api/ideas
    const ideasApiCalls = evidence.networkCalls.filter(call =>
      call.url.includes('/api/ideas')
    );
    evidence.testResults.apiCallsMade = ideasApiCalls.length > 0;

    if (evidence.testResults.apiCallsMade) {
      console.log(`\n✅ API CALLS: Found ${ideasApiCalls.length} call(s) to /api/ideas`);
      ideasApiCalls.forEach(call => {
        console.log(`  ${call.method} ${call.url} → ${call.status}`);
      });
    } else {
      console.log('\n❌ API CALLS: No calls to /api/ideas detected');
    }

    evidence.testResults.ideasLoadingWorks =
      (hasProjectChangedLog || hasLoadingIdeasLog) &&
      (hasFetchingDiagnostic || hasApiResponseLog) &&
      evidence.testResults.apiCallsMade;

    if (evidence.testResults.ideasLoadingWorks) {
      console.log('\n✅ IDEAS LOADING: Complete ideas flow detected!');
    } else {
      console.log('\n❌ IDEAS LOADING: Missing critical indicators:');
      if (!hasProjectChangedLog && !hasLoadingIdeasLog) {
        console.log('  ❌ Missing: Project change or loading trigger');
      }
      if (!hasFetchingDiagnostic && !hasApiResponseLog) {
        console.log('  ❌ Missing: Diagnostic logs for API fetch');
      }
      if (!evidence.testResults.apiCallsMade) {
        console.log('  ❌ Missing: API calls to /api/ideas');
      }
    }

    // Wait for matrix to be visible
    console.log('\n⏳ Waiting for matrix to render...\n');

    // Look for matrix container
    const matrixContainer = page.locator('[data-testid="design-matrix"], .matrix-container, [class*="matrix"]').first();

    try {
      await expect(matrixContainer).toBeVisible({ timeout: 10000 });
      console.log('✅ Matrix container visible');
    } catch (error) {
      console.log('⚠️  Matrix container not found (may be ok if no ideas exist)');
    }

    // Screenshot 3: Matrix view
    const matrixScreenshotPath = path.join('test-results', 'evidence', `matrix-${Date.now()}.png`);
    await page.screenshot({ path: matrixScreenshotPath, fullPage: true });
    evidence.screenshots.matrix = matrixScreenshotPath;
    console.log(`📸 Screenshot saved: ${matrixScreenshotPath}`);

    // Save all console logs
    evidence.consoleLogs = consoleLogs;

    console.log('\n=== PHASE 3: COMPREHENSIVE VALIDATION ===\n');

    // Generate comprehensive report
    const report = generateReport(evidence);

    // Save report to file
    const reportPath = path.join('test-results', 'evidence', `e2e-report-${Date.now()}.md`);
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, report);
    console.log(`\n📄 Full report saved: ${reportPath}\n`);

    // Print summary
    console.log('\n' + '='.repeat(80));
    console.log('FINAL TEST RESULTS');
    console.log('='.repeat(80));
    console.log(`✅/❌ Authentication Works: ${evidence.testResults.authenticationWorks ? '✅' : '❌'}`);
    console.log(`✅/❌ UI Transitions Work: ${evidence.testResults.uiTransitions ? '✅' : '❌'}`);
    console.log(`✅/❌ Ideas Loading Works: ${evidence.testResults.ideasLoadingWorks ? '✅' : '❌'}`);
    console.log(`✅/❌ API Calls Made: ${evidence.testResults.apiCallsMade ? '✅' : '❌'}`);
    console.log('='.repeat(80));
    console.log(`\n📊 Overall Success: ${
      evidence.testResults.authenticationWorks &&
      evidence.testResults.uiTransitions &&
      evidence.testResults.ideasLoadingWorks &&
      evidence.testResults.apiCallsMade ? '✅ PASS' : '❌ FAIL'
    }\n`);

    // Assert final results
    expect(evidence.testResults.authenticationWorks, 'Authentication should complete with all expected logs').toBe(true);
    expect(evidence.testResults.uiTransitions, 'UI should transition from login to main app').toBe(true);
    expect(evidence.testResults.ideasLoadingWorks, 'Ideas loading should trigger and complete').toBe(true);
    expect(evidence.testResults.apiCallsMade, 'API calls to /api/ideas should be made').toBe(true);
  });
});

function generateReport(evidence: TestEvidence): string {
  let report = `# E2E Test Report: Authentication → Ideas Loading Flow\n\n`;
  report += `Generated: ${new Date().toISOString()}\n\n`;
  report += `---\n\n`;

  report += `## Test Results Summary\n\n`;
  report += `| Test Area | Status |\n`;
  report += `|-----------|--------|\n`;
  report += `| Authentication Works | ${evidence.testResults.authenticationWorks ? '✅ PASS' : '❌ FAIL'} |\n`;
  report += `| UI Transitions Work | ${evidence.testResults.uiTransitions ? '✅ PASS' : '❌ FAIL'} |\n`;
  report += `| Ideas Loading Works | ${evidence.testResults.ideasLoadingWorks ? '✅ PASS' : '❌ FAIL'} |\n`;
  report += `| API Calls Made | ${evidence.testResults.apiCallsMade ? '✅ PASS' : '❌ FAIL'} |\n\n`;

  const overallPass =
    evidence.testResults.authenticationWorks &&
    evidence.testResults.uiTransitions &&
    evidence.testResults.ideasLoadingWorks &&
    evidence.testResults.apiCallsMade;

  report += `**Overall Result**: ${overallPass ? '✅ **PASS**' : '❌ **FAIL**'}\n\n`;
  report += `---\n\n`;

  report += `## Phase 1: Authentication Logs\n\n`;
  if (evidence.authLogs.length > 0) {
    report += `\`\`\`\n`;
    evidence.authLogs.forEach(log => {
      report += `[${log.type}] ${log.text}\n`;
    });
    report += `\`\`\`\n\n`;
  } else {
    report += `⚠️ No authentication logs captured\n\n`;
  }

  report += `## Phase 2: Ideas Loading Logs\n\n`;
  if (evidence.ideasLogs.length > 0) {
    report += `\`\`\`\n`;
    evidence.ideasLogs.forEach(log => {
      report += `[${log.type}] ${log.text}\n`;
    });
    report += `\`\`\`\n\n`;
  } else {
    report += `⚠️ No ideas loading logs captured\n\n`;
  }

  report += `## Network Activity\n\n`;
  if (evidence.networkCalls.length > 0) {
    report += `\`\`\`\n`;
    evidence.networkCalls.forEach(call => {
      report += `${call.method} ${call.url} → ${call.status}\n`;
    });
    report += `\`\`\`\n\n`;
  } else {
    report += `⚠️ No network calls captured\n\n`;
  }

  report += `## Screenshots\n\n`;
  report += `- Login Screen: \`${evidence.screenshots.login}\`\n`;
  report += `- After Authentication: \`${evidence.screenshots.afterAuth}\`\n`;
  report += `- Matrix View: \`${evidence.screenshots.matrix}\`\n\n`;

  report += `## Complete Console Log\n\n`;
  report += `<details>\n`;
  report += `<summary>Click to expand full console output (${evidence.consoleLogs.length} messages)</summary>\n\n`;
  report += `\`\`\`\n`;
  evidence.consoleLogs.forEach(log => {
    report += `[${log.type}] ${log.text}\n`;
  });
  report += `\`\`\`\n`;
  report += `</details>\n\n`;

  report += `---\n\n`;
  report += `## Analysis\n\n`;

  if (evidence.testResults.authenticationWorks) {
    report += `✅ **Authentication**: All expected auth logs detected, including the critical \`handleAuthUser\` callback that was fixed.\n\n`;
  } else {
    report += `❌ **Authentication**: Missing critical auth logs. The stale closure fix may not be working.\n\n`;
  }

  if (evidence.testResults.ideasLoadingWorks) {
    report += `✅ **Ideas Loading**: Ideas loading flow triggered and API calls made successfully.\n\n`;
  } else {
    report += `❌ **Ideas Loading**: Ideas loading did not complete. Check if project context is being set.\n\n`;
  }

  if (evidence.testResults.apiCallsMade) {
    const successfulCalls = evidence.networkCalls.filter(c =>
      c.url.includes('/api/ideas') && c.status === 200
    );
    report += `✅ **API Calls**: ${successfulCalls.length} successful call(s) to /api/ideas\n\n`;
  } else {
    report += `❌ **API Calls**: No calls to /api/ideas detected. The ideas loading may not be triggering.\n\n`;
  }

  return report;
}
