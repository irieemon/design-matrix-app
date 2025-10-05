import { FullConfig } from '@playwright/test';
import path from 'path';
import fs from 'fs/promises';

/**
 * Global teardown for visual testing suite
 *
 * Generates test summary, processes results,
 * and cleans up test resources
 */
async function globalTeardown(config: FullConfig) {
  console.log('🎭 Visual Testing Suite - Global Teardown');

  const testResultsDir = path.join(process.cwd(), 'test-results');
  const summaryPath = path.join(testResultsDir, 'visual-summary.json');

  try {
    // Load session metadata
    const metadataPath = path.join(testResultsDir, 'session-metadata.json');
    const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));

    // Load test results if available
    const resultsPath = path.join(testResultsDir, 'visual-results.json');
    let results = null;
    try {
      results = JSON.parse(await fs.readFile(resultsPath, 'utf-8'));
    } catch {
      console.log('⚠️ No results file found - tests may have failed to complete');
    }

    // Generate summary
    const summary = {
      ...metadata,
      endTime: new Date().toISOString(),
      duration: Date.now() - Date.parse(metadata.timestamp),
      results: results ? {
        totalTests: results.stats?.total || 0,
        passed: results.stats?.passed || 0,
        failed: results.stats?.failed || 0,
        skipped: results.stats?.skipped || 0,
        flaky: results.stats?.flaky || 0
      } : null,
      artifacts: {
        screenshots: await countFiles(path.join(testResultsDir, 'screenshots')),
        videos: await countFiles(path.join(testResultsDir, 'visual'), 'webm'),
        traces: await countFiles(path.join(testResultsDir, 'visual'), 'zip')
      }
    };

    await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));

    // Log summary
    console.log('📊 Visual Testing Summary:');
    console.log(`   Duration: ${Math.round(summary.duration / 1000)}s`);
    if (summary.results) {
      console.log(`   Tests: ${summary.results.totalTests} total, ${summary.results.passed} passed, ${summary.results.failed} failed`);
    }
    console.log(`   Artifacts: ${summary.artifacts.screenshots} screenshots, ${summary.artifacts.videos} videos`);

    // Generate simplified report for CI
    if (process.env.CI && summary.results) {
      const ciSummary = {
        status: summary.results.failed > 0 ? 'FAILED' : 'PASSED',
        total: summary.results.totalTests,
        passed: summary.results.passed,
        failed: summary.results.failed,
        duration: Math.round(summary.duration / 1000)
      };

      console.log('🤖 CI Summary:', JSON.stringify(ciSummary));
    }

  } catch (error) {
    console.error('❌ Error during teardown:', error);
  }

  console.log('✅ Visual testing teardown complete');
}

async function countFiles(dir: string, extension?: string): Promise<number> {
  try {
    const entries = await fs.readdir(dir, { recursive: true, withFileTypes: true });
    return entries.filter(entry => {
      if (!entry.isFile()) return false;
      if (!extension) return true;
      return entry.name.endsWith(`.${extension}`);
    }).length;
  } catch {
    return 0;
  }
}

export default globalTeardown;