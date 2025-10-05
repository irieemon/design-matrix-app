import { chromium, FullConfig } from '@playwright/test';

/**
 * Global Setup for E2E Performance Testing
 *
 * Responsibilities:
 * - Initialize performance monitoring
 * - Set up test environment
 * - Configure network conditions
 * - Prepare test data
 */

async function globalSetup(config: FullConfig) {
  console.log('\n🚀 E2E Performance Testing - Global Setup');
  console.log('='.repeat(60));

  const startTime = Date.now();

  // Launch browser for setup tasks
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Verify application is running
    console.log('📡 Verifying application availability...');
    const baseURL = config.use?.baseURL || 'http://localhost:3003';

    try {
      await page.goto(baseURL, { timeout: 30000 });
      console.log('✅ Application is accessible');
    } catch (error) {
      console.error('❌ Application is not accessible');
      console.error('   Make sure the dev server is running: npm run dev');
      throw error;
    }

    // Clear any existing test data
    console.log('🧹 Clearing test data...');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
      if (typeof indexedDB !== 'undefined') {
        indexedDB.databases?.()?.then((databases) => {
          databases.forEach((db) => {
            if (db.name) {
              indexedDB.deleteDatabase(db.name);
            }
          });
        });
      }
    });
    console.log('✅ Test data cleared');

    // Verify browser capabilities
    console.log('🔍 Verifying browser capabilities...');
    const capabilities = await page.evaluate(() => {
      return {
        localStorage: typeof localStorage !== 'undefined',
        indexedDB: typeof indexedDB !== 'undefined',
        fetch: typeof fetch !== 'undefined',
        performanceAPI: typeof performance !== 'undefined',
        performanceMemory: typeof (performance as any).memory !== 'undefined',
        raf: typeof requestAnimationFrame !== 'undefined',
        cssGrid: CSS.supports('display', 'grid'),
        cssFlexbox: CSS.supports('display', 'flex'),
      };
    });

    console.log('Browser Capabilities:');
    Object.entries(capabilities).forEach(([key, value]) => {
      console.log(`  ${value ? '✅' : '❌'} ${key}`);
    });

    // Measure baseline performance
    console.log('\n📊 Measuring baseline performance...');
    const baselineMetrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        domInteractive: navigation.domInteractive - navigation.fetchStart,
        resourceCount: performance.getEntriesByType('resource').length,
      };
    });

    console.log('Baseline Metrics:');
    console.log(`  DOM Content Loaded: ${baselineMetrics.domContentLoaded.toFixed(2)}ms`);
    console.log(`  DOM Interactive: ${baselineMetrics.domInteractive.toFixed(2)}ms`);
    console.log(`  Resources Loaded: ${baselineMetrics.resourceCount}`);

    // Set up performance budgets
    console.log('\n💰 Performance Budgets:');
    console.log('  Page Load: < 2000ms');
    console.log('  JS Bundle: < 300KB (gzipped)');
    console.log('  CSS Bundle: < 50KB (gzipped)');
    console.log('  Images: < 500KB per page');
    console.log('  Memory: < 50MB per page');
    console.log('  FCP: < 1500ms');
    console.log('  LCP: < 2500ms');
    console.log('  CLS: < 0.1');
    console.log('  TTI: < 3000ms');

    // Display test environment info
    console.log('\n🌐 Test Environment:');
    console.log(`  Base URL: ${baseURL}`);
    console.log(`  Browser: ${browser.version()}`);
    console.log(`  Workers: ${config.workers || 1}`);
    console.log(`  Retries: ${config.retries || 0}`);

  } catch (error) {
    console.error('\n❌ Global setup failed:', error);
    throw error;
  } finally {
    await page.close();
    await context.close();
    await browser.close();
  }

  const setupTime = Date.now() - startTime;
  console.log(`\n✅ Global setup completed in ${setupTime}ms`);
  console.log('='.repeat(60));
  console.log('\n');
}

export default globalSetup;
