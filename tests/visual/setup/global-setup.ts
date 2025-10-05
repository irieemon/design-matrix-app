import { chromium, FullConfig } from '@playwright/test';
import path from 'path';
import fs from 'fs/promises';

/**
 * Global setup for visual testing suite
 *
 * Prepares test environment, cleans previous results,
 * and initializes visual baseline management
 */
async function globalSetup(config: FullConfig) {
  console.log('🎭 Visual Testing Suite - Global Setup');

  // Create test results directories
  const testResultsDir = path.join(process.cwd(), 'test-results');
  const visualDir = path.join(testResultsDir, 'visual');
  const screenshotsDir = path.join(testResultsDir, 'screenshots');
  const baselineDir = path.join(testResultsDir, 'baselines');

  await ensureDir(testResultsDir);
  await ensureDir(visualDir);
  await ensureDir(screenshotsDir);
  await ensureDir(baselineDir);

  // Initialize test session metadata
  const sessionMetadata = {
    timestamp: new Date().toISOString(),
    testRun: `visual-${Date.now()}`,
    environment: {
      node: process.version,
      platform: process.platform,
      ci: !!process.env.CI
    },
    config: {
      baseURL: config.projects[0]?.use?.baseURL || 'http://localhost:5173',
      browsers: config.projects.map(p => p.name),
      parallel: config.fullyParallel
    }
  };

  // Save session metadata
  await fs.writeFile(
    path.join(testResultsDir, 'session-metadata.json'),
    JSON.stringify(sessionMetadata, null, 2)
  );

  // Warm up browser for consistent performance
  console.log('🌡️ Warming up browser instance...');
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Navigate to base URL to warm up application
  try {
    await page.goto(config.projects[0]?.use?.baseURL || 'http://localhost:5173', {
      waitUntil: 'networkidle'
    });
    console.log('✅ Application warmed up successfully');
  } catch (error) {
    console.log('⚠️ Application warmup failed (non-critical):', error.message);
  }

  await browser.close();

  // Clean old screenshots (keep last 5 runs)
  await cleanupOldScreenshots(screenshotsDir);

  console.log('✅ Visual testing environment ready');
}

async function ensureDir(dir: string) {
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
    console.log(`📁 Created directory: ${dir}`);
  }
}

async function cleanupOldScreenshots(screenshotsDir: string) {
  try {
    const entries = await fs.readdir(screenshotsDir, { withFileTypes: true });
    const runDirs = entries
      .filter(entry => entry.isDirectory() && entry.name.startsWith('run-'))
      .map(entry => ({
        name: entry.name,
        path: path.join(screenshotsDir, entry.name),
        created: parseInt(entry.name.split('-')[1]) || 0
      }))
      .sort((a, b) => b.created - a.created);

    // Keep last 5 runs
    const toDelete = runDirs.slice(5);
    for (const run of toDelete) {
      await fs.rm(run.path, { recursive: true, force: true });
      console.log(`🗑️ Cleaned up old test run: ${run.name}`);
    }
  } catch (error) {
    console.log('⚠️ Screenshot cleanup failed (non-critical):', error.message);
  }
}

export default globalSetup;