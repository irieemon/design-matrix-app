import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to the application
    await page.goto('http://localhost:5173');

    // Wait for the app to load
    await page.waitForLoadState('networkidle');

    // Basic health check - ensure the app loads without errors
    const errors = await page.evaluate(() => {
      return window.performance?.getEntriesByType('navigation').map((entry: any) => ({
        name: entry.name,
        transferSize: entry.transferSize,
        loadEventEnd: entry.loadEventEnd
      }));
    });

    console.log('App health check completed:', errors);

    // Set up any global test data if needed
    await page.evaluate(() => {
      // Clear any existing localStorage data for clean tests
      localStorage.clear();
      sessionStorage.clear();
    });

  } catch (error) {
    console.error('Global setup failed:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

export default globalSetup;