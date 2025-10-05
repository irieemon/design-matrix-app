#!/usr/bin/env node

/**
 * Visual Testing Suite Runner
 *
 * Advanced test runner with intelligent execution, reporting,
 * and integration with CI/CD pipelines
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const process = require('process');

class VisualTestRunner {
  constructor() {
    this.config = {
      baseUrl: process.env.BASE_URL || 'http://localhost:5173',
      headless: process.env.HEADLESS !== 'false',
      parallel: process.env.PARALLEL !== 'false',
      retries: parseInt(process.env.RETRIES) || 1,
      timeout: parseInt(process.env.TIMEOUT) || 60000,
      updateBaselines: process.env.UPDATE_BASELINES === 'true',
      browsers: (process.env.BROWSERS || 'chrome').split(','),
      verbose: process.env.VERBOSE === 'true'
    };

    this.testSuites = {
      'auth-flow': 'Core authentication flow visual validation',
      'flickering': 'Advanced flickering detection and layout stability',
      'responsive': 'Responsive design validation across viewports',
      'regression': 'Automated visual regression testing'
    };

    this.results = {
      startTime: Date.now(),
      endTime: null,
      totalTests: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      suites: {}
    };
  }

  async run(options = {}) {
    console.log('🎭 Visual Testing Suite Runner');
    console.log('================================');
    console.log(`Base URL: ${this.config.baseUrl}`);
    console.log(`Browsers: ${this.config.browsers.join(', ')}`);
    console.log(`Headless: ${this.config.headless}`);
    console.log(`Update Baselines: ${this.config.updateBaselines}`);
    console.log('');

    try {
      // Setup
      await this.setup();

      // Run test suites
      const suitesToRun = options.suites || Object.keys(this.testSuites);
      for (const suite of suitesToRun) {
        if (this.testSuites[suite]) {
          await this.runSuite(suite);
        } else {
          console.warn(`⚠️ Unknown test suite: ${suite}`);
        }
      }

      // Generate reports
      await this.generateReports();

      // Cleanup
      await this.cleanup();

      this.results.endTime = Date.now();
      this.printSummary();

      // Exit with appropriate code
      process.exit(this.results.failed > 0 ? 1 : 0);
    } catch (error) {
      console.error('❌ Visual testing failed:', error.message);
      if (this.config.verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  }

  async setup() {
    console.log('⚙️ Setting up visual testing environment...');

    // Ensure test results directory exists
    const resultsDirs = [
      'test-results',
      'test-results/visual',
      'test-results/screenshots',
      'test-results/baselines'
    ];

    for (const dir of resultsDirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`📁 Created directory: ${dir}`);
      }
    }

    // Check if development server is running
    if (!await this.isServerRunning()) {
      console.log('🚀 Starting development server...');
      await this.startDevServer();
    } else {
      console.log('✅ Development server is running');
    }

    // Install Playwright browsers if needed
    try {
      execSync('npx playwright install --with-deps', { stdio: 'pipe' });
      console.log('🌐 Playwright browsers ready');
    } catch (error) {
      console.warn('⚠️ Could not install Playwright browsers:', error.message);
    }
  }

  async runSuite(suiteName) {
    console.log(`\n🧪 Running test suite: ${suiteName}`);
    console.log(`Description: ${this.testSuites[suiteName]}`);
    console.log('─'.repeat(60));

    const startTime = Date.now();
    const suiteResults = {
      name: suiteName,
      description: this.testSuites[suiteName],
      startTime,
      endTime: null,
      passed: 0,
      failed: 0,
      skipped: 0,
      tests: []
    };

    try {
      // Build Playwright command
      const testFile = `tests/visual/${suiteName === 'auth-flow' ? 'auth-flow' :
                                     suiteName === 'flickering' ? 'flickering-detection' :
                                     suiteName === 'responsive' ? 'responsive-design' :
                                     'regression-testing'}.test.ts`;

      const playwrightArgs = [
        'test',
        '--config=playwright.visual.config.ts',
        testFile,
        `--reporter=json:test-results/${suiteName}-results.json`,
        '--reporter=html:test-results/html-report',
        this.config.headless ? '--headed=false' : '--headed=true'
      ];

      if (this.config.updateBaselines) {
        playwrightArgs.push('--update-snapshots');
      }

      if (!this.config.parallel) {
        playwrightArgs.push('--workers=1');
      }

      if (this.config.retries > 1) {
        playwrightArgs.push(`--retries=${this.config.retries}`);
      }

      // Run Playwright tests
      const result = await this.runPlaywrightCommand(playwrightArgs);

      // Parse results
      await this.parseTestResults(suiteName, suiteResults);

      suiteResults.endTime = Date.now();
      this.results.suites[suiteName] = suiteResults;

      console.log(`✅ Suite completed: ${suiteName} (${((suiteResults.endTime - startTime) / 1000).toFixed(2)}s)`);
    } catch (error) {
      suiteResults.endTime = Date.now();
      suiteResults.failed = 1;
      this.results.suites[suiteName] = suiteResults;

      console.error(`❌ Suite failed: ${suiteName} - ${error.message}`);
    }
  }

  async runPlaywrightCommand(args) {
    return new Promise((resolve, reject) => {
      const child = spawn('npx', ['playwright', ...args], {
        stdio: this.config.verbose ? 'inherit' : 'pipe',
        env: { ...process.env, BASE_URL: this.config.baseUrl }
      });

      let stdout = '';
      let stderr = '';

      if (!this.config.verbose) {
        child.stdout?.on('data', (data) => {
          stdout += data.toString();
        });

        child.stderr?.on('data', (data) => {
          stderr += data.toString();
        });
      }

      child.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`Playwright exited with code ${code}. stderr: ${stderr}`));
        }
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  }

  async parseTestResults(suiteName, suiteResults) {
    const resultsFile = path.join('test-results', `${suiteName}-results.json`);

    try {
      if (fs.existsSync(resultsFile)) {
        const data = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));

        suiteResults.passed = data.stats?.expected || 0;
        suiteResults.failed = data.stats?.unexpected || 0;
        suiteResults.skipped = data.stats?.skipped || 0;

        this.results.totalTests += suiteResults.passed + suiteResults.failed + suiteResults.skipped;
        this.results.passed += suiteResults.passed;
        this.results.failed += suiteResults.failed;
        this.results.skipped += suiteResults.skipped;

        // Extract individual test results
        if (data.suites && data.suites.length > 0) {
          this.extractTestDetails(data.suites, suiteResults.tests);
        }
      }
    } catch (error) {
      console.warn(`⚠️ Could not parse results for ${suiteName}:`, error.message);
    }
  }

  extractTestDetails(suites, testArray) {
    for (const suite of suites) {
      if (suite.specs) {
        for (const spec of suite.specs) {
          testArray.push({
            title: spec.title,
            file: spec.file,
            status: spec.tests?.[0]?.results?.[0]?.status || 'unknown',
            duration: spec.tests?.[0]?.results?.[0]?.duration || 0,
            error: spec.tests?.[0]?.results?.[0]?.error?.message
          });
        }
      }

      if (suite.suites) {
        this.extractTestDetails(suite.suites, testArray);
      }
    }
  }

  async generateReports() {
    console.log('\n📊 Generating test reports...');

    // Generate summary report
    await this.generateSummaryReport();

    // Generate detailed HTML report
    await this.generateHTMLReport();

    // Generate CI/CD friendly report
    if (process.env.CI) {
      await this.generateCIReport();
    }
  }

  async generateSummaryReport() {
    const report = {
      timestamp: new Date().toISOString(),
      duration: this.results.endTime - this.results.startTime,
      environment: {
        baseUrl: this.config.baseUrl,
        browsers: this.config.browsers,
        headless: this.config.headless,
        parallel: this.config.parallel,
        platform: process.platform,
        nodeVersion: process.version
      },
      configuration: this.config,
      summary: {
        totalTests: this.results.totalTests,
        passed: this.results.passed,
        failed: this.results.failed,
        skipped: this.results.skipped,
        successRate: this.results.totalTests > 0 ?
          ((this.results.passed / this.results.totalTests) * 100).toFixed(2) : 0
      },
      suites: this.results.suites
    };

    const reportFile = path.join('test-results', 'visual-test-summary.json');
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));

    console.log(`📄 Summary report saved: ${reportFile}`);
  }

  async generateHTMLReport() {
    // The HTML report is generated by Playwright automatically
    const htmlReportDir = path.join('test-results', 'html-report');
    if (fs.existsSync(htmlReportDir)) {
      console.log(`🌐 HTML report available: ${htmlReportDir}/index.html`);
    }
  }

  async generateCIReport() {
    const ciReport = {
      status: this.results.failed > 0 ? 'FAILED' : 'PASSED',
      total: this.results.totalTests,
      passed: this.results.passed,
      failed: this.results.failed,
      skipped: this.results.skipped,
      duration: Math.round((this.results.endTime - this.results.startTime) / 1000),
      successRate: this.results.totalTests > 0 ?
        ((this.results.passed / this.results.totalTests) * 100).toFixed(1) : 0
    };

    console.log('\n🤖 CI/CD Summary:');
    console.log(JSON.stringify(ciReport));

    // Save for CI artifact
    fs.writeFileSync('test-results/ci-summary.json', JSON.stringify(ciReport));
  }

  async isServerRunning() {
    try {
      const http = require('http');
      const url = new URL(this.config.baseUrl);

      return new Promise((resolve) => {
        const req = http.get({
          hostname: url.hostname,
          port: url.port,
          path: '/',
          timeout: 3000
        }, (res) => {
          resolve(res.statusCode >= 200 && res.statusCode < 400);
        });

        req.on('error', () => resolve(false));
        req.on('timeout', () => {
          req.destroy();
          resolve(false);
        });
      });
    } catch (error) {
      return false;
    }
  }

  async startDevServer() {
    // This would need to be customized based on your dev server setup
    console.log('⚠️ Please start your development server manually');
    console.log(`Expected URL: ${this.config.baseUrl}`);

    // Wait for user to start server
    await new Promise(resolve => {
      const checkInterval = setInterval(async () => {
        if (await this.isServerRunning()) {
          clearInterval(checkInterval);
          console.log('✅ Development server detected');
          resolve();
        } else {
          console.log('⏳ Waiting for development server...');
        }
      }, 2000);
    });
  }

  async cleanup() {
    console.log('🧹 Cleaning up...');

    // Clean up old screenshots (keep last 3 runs)
    try {
      const screenshotsDir = 'test-results/screenshots';
      if (fs.existsSync(screenshotsDir)) {
        const entries = fs.readdirSync(screenshotsDir, { withFileTypes: true });
        const runDirs = entries
          .filter(entry => entry.isDirectory() && entry.name.startsWith('run-'))
          .map(entry => ({
            name: entry.name,
            path: path.join(screenshotsDir, entry.name),
            created: parseInt(entry.name.split('-')[1]) || 0
          }))
          .sort((a, b) => b.created - a.created);

        // Keep last 3 runs
        const toDelete = runDirs.slice(3);
        for (const run of toDelete) {
          fs.rmSync(run.path, { recursive: true, force: true });
          console.log(`🗑️ Cleaned up old run: ${run.name}`);
        }
      }
    } catch (error) {
      console.warn('⚠️ Cleanup warning:', error.message);
    }
  }

  printSummary() {
    const duration = (this.results.endTime - this.results.startTime) / 1000;
    const successRate = this.results.totalTests > 0 ?
      ((this.results.passed / this.results.totalTests) * 100) : 0;

    console.log('\n🎭 Visual Testing Summary');
    console.log('═'.repeat(50));
    console.log(`Duration: ${duration.toFixed(2)}s`);
    console.log(`Total Tests: ${this.results.totalTests}`);
    console.log(`Passed: ${this.results.passed} ✅`);
    console.log(`Failed: ${this.results.failed} ❌`);
    console.log(`Skipped: ${this.results.skipped} ⏭️`);
    console.log(`Success Rate: ${successRate.toFixed(1)}%`);
    console.log('');

    // Suite breakdown
    console.log('Test Suites:');
    for (const [name, suite] of Object.entries(this.results.suites)) {
      const suiteDuration = ((suite.endTime - suite.startTime) / 1000).toFixed(1);
      const status = suite.failed > 0 ? '❌' : '✅';
      console.log(`  ${status} ${name}: ${suite.passed}P ${suite.failed}F ${suite.skipped}S (${suiteDuration}s)`);
    }

    console.log('');
    if (this.results.failed > 0) {
      console.log('❌ Visual tests failed - check reports for details');
    } else {
      console.log('✅ All visual tests passed!');
    }
  }
}

// CLI Interface
if (require.main === module) {
  const runner = new VisualTestRunner();
  const args = process.argv.slice(2);

  const options = {};

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--suites' && i + 1 < args.length) {
      options.suites = args[i + 1].split(',');
      i++;
    } else if (arg === '--help') {
      console.log(`
Visual Testing Suite Runner

Usage: node run-visual-tests.js [options]

Options:
  --suites <suite1,suite2>  Run specific test suites (auth-flow,flickering,responsive,regression)
  --help                    Show this help message

Environment Variables:
  BASE_URL          Base URL for testing (default: http://localhost:5173)
  HEADLESS          Run in headless mode (default: true)
  PARALLEL          Run tests in parallel (default: true)
  RETRIES           Number of retries (default: 1)
  TIMEOUT           Test timeout in ms (default: 60000)
  UPDATE_BASELINES  Update visual baselines (default: false)
  BROWSERS          Comma-separated browser list (default: chrome)
  VERBOSE           Enable verbose output (default: false)

Examples:
  node run-visual-tests.js
  node run-visual-tests.js --suites auth-flow,flickering
  UPDATE_BASELINES=true node run-visual-tests.js
  HEADLESS=false VERBOSE=true node run-visual-tests.js
      `);
      process.exit(0);
    }
  }

  runner.run(options);
}

module.exports = VisualTestRunner;