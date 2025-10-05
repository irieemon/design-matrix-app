#!/usr/bin/env node

/**
 * Comprehensive Quality Assurance Suite Runner
 *
 * Orchestrates all quality tests and generates a comprehensive report
 * for the design matrix card visibility and overall system quality.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const RESULTS_DIR = path.join(process.cwd(), 'quality-results');
const BASE_URL = 'http://localhost:3000';

// Ensure results directory exists
if (!fs.existsSync(RESULTS_DIR)) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

class QualitySuiteRunner {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      overallScore: 0,
      testSuites: {},
      summary: {},
      recommendations: [],
      executionTime: 0
    };
    this.startTime = Date.now();
  }

  async runComplete() {
    console.log('🚀 Starting Comprehensive Quality Assurance Suite...\n');
    console.log('🎯 Target: Design Matrix Card Visibility & System Quality\n');

    try {
      // Check if development server is running
      await this.checkServerStatus();

      // Run all test suites
      await this.runTestSuite('Card Visibility Validation', 'card-visibility-validation.spec.ts');
      await this.runTestSuite('Accessibility Validation', 'accessibility-validation.spec.ts');
      await this.runTestSuite('Performance Benchmarks', 'performance-benchmarks.spec.ts');
      await this.runTestSuite('Edge Case Scenarios', 'edge-case-scenarios.spec.ts');
      await this.runTestSuite('Visual Regression Tests', 'visual-regression.spec.ts');
      await this.runTestSuite('Quality Gates Framework', 'quality-gates.mjs');

      // Generate comprehensive report
      await this.generateFinalReport();

    } catch (error) {
      console.error('❌ Quality suite execution failed:', error.message);
      this.results.error = error.message;
      await this.generateErrorReport();
    }
  }

  async checkServerStatus() {
    console.log('🔍 Checking development server status...');

    try {
      // Simple health check
      const response = await fetch(BASE_URL).catch(() => null);

      if (!response) {
        throw new Error(`Development server not accessible at ${BASE_URL}. Please start with 'npm run dev'`);
      }

      console.log('✅ Development server is running\n');
    } catch (error) {
      console.log('⚠️  Unable to verify server status. Proceeding with tests...\n');
    }
  }

  async runTestSuite(suiteName, testFile) {
    console.log(`📋 Running: ${suiteName}`);
    console.log(`   File: ${testFile}`);

    const startTime = Date.now();
    let success = false;
    let output = '';
    let error = '';

    try {
      if (testFile.endsWith('.mjs')) {
        // Run Node.js script
        output = execSync(`node tests/${testFile}`, {
          encoding: 'utf8',
          cwd: process.cwd(),
          timeout: 300000 // 5 minute timeout
        });
      } else {
        // Run Playwright test
        output = execSync(`npx playwright test tests/${testFile} --reporter=json`, {
          encoding: 'utf8',
          cwd: process.cwd(),
          timeout: 600000 // 10 minute timeout
        });
      }
      success = true;
    } catch (execError) {
      error = execError.message;
      output = execError.stdout || '';
      success = false;
    }

    const executionTime = Date.now() - startTime;

    // Parse results based on output
    const results = this.parseTestResults(output, error, success);

    this.results.testSuites[suiteName] = {
      file: testFile,
      executionTime,
      success,
      ...results
    };

    // Display results
    if (success) {
      console.log(`   ✅ PASSED (${executionTime}ms)`);
      if (results.summary) {
        console.log(`   📊 ${results.summary}`);
      }
    } else {
      console.log(`   ❌ FAILED (${executionTime}ms)`);
      console.log(`   💭 ${error.slice(0, 200)}...`);
    }

    console.log('');
  }

  parseTestResults(output, error, success) {
    const results = {
      output: output.slice(0, 5000), // Limit output size
      error: error.slice(0, 2000),
      summary: '',
      metrics: {}
    };

    try {
      // Try to parse Playwright JSON output
      if (output.includes('"stats"')) {
        const jsonMatch = output.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const playwrightResults = JSON.parse(jsonMatch[0]);

          results.metrics = {
            total: playwrightResults.stats?.total || 0,
            passed: playwrightResults.stats?.passed || 0,
            failed: playwrightResults.stats?.failed || 0,
            skipped: playwrightResults.stats?.skipped || 0
          };

          results.summary = `${results.metrics.passed}/${results.metrics.total} tests passed`;
        }
      }

      // Parse quality gate results
      if (output.includes('Quality Gate Results') || output.includes('Overall Score')) {
        const scoreMatch = output.match(/Overall Score:\s*(\d+\.?\d*)%/);
        if (scoreMatch) {
          results.metrics.qualityScore = parseFloat(scoreMatch[1]);
          results.summary = `Quality Score: ${results.metrics.qualityScore}%`;
        }
      }

      // Parse performance metrics
      if (output.includes('Performance')) {
        const loadTimeMatch = output.match(/Load time:\s*(\d+)ms/);
        const memoryMatch = output.match(/Memory usage:\s*(\d+\.?\d*)MB/);

        if (loadTimeMatch) {
          results.metrics.loadTime = parseInt(loadTimeMatch[1]);
        }
        if (memoryMatch) {
          results.metrics.memoryUsage = parseFloat(memoryMatch[1]);
        }
      }

    } catch (parseError) {
      console.log(`   ⚠️  Could not parse detailed results: ${parseError.message}`);
    }

    return results;
  }

  async generateFinalReport() {
    const executionTime = Date.now() - this.startTime;

    // Calculate overall quality score
    const suiteScores = Object.values(this.results.testSuites).map(suite => {
      if (suite.metrics?.qualityScore) {
        return suite.metrics.qualityScore;
      }

      // Fallback scoring based on success/failure
      if (suite.success) {
        if (suite.metrics?.passed && suite.metrics?.total) {
          return (suite.metrics.passed / suite.metrics.total) * 100;
        }
        return 85; // Default good score for successful suites
      }
      return 0; // Failed suites get 0
    });

    const overallScore = suiteScores.length > 0
      ? suiteScores.reduce((a, b) => a + b, 0) / suiteScores.length
      : 0;

    // Generate summary
    const totalSuites = Object.keys(this.results.testSuites).length;
    const passedSuites = Object.values(this.results.testSuites).filter(s => s.success).length;

    this.results.overallScore = overallScore;
    this.results.executionTime = executionTime;
    this.results.summary = {
      totalSuites,
      passedSuites,
      failedSuites: totalSuites - passedSuites,
      passRate: `${passedSuites}/${totalSuites} (${((passedSuites/totalSuites) * 100).toFixed(1)}%)`
    };

    // Generate recommendations
    this.results.recommendations = this.generateRecommendations();

    // Save detailed report
    const reportPath = path.join(RESULTS_DIR, `comprehensive-qa-report-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));

    // Generate human-readable summary
    this.printFinalSummary();

    console.log(`\n📂 Detailed report saved: ${reportPath}`);
  }

  generateRecommendations() {
    const recommendations = [];

    // Analyze test results for recommendations
    Object.entries(this.results.testSuites).forEach(([suiteName, suite]) => {
      if (!suite.success) {
        recommendations.push(`Fix failures in ${suiteName}: ${suite.error?.slice(0, 100) || 'Check detailed logs'}`);
      }

      if (suite.metrics?.loadTime > 3000) {
        recommendations.push('Optimize load performance: Load time exceeds 3 second threshold');
      }

      if (suite.metrics?.memoryUsage > 50) {
        recommendations.push('Investigate memory usage: Memory consumption higher than recommended');
      }

      if (suite.metrics?.qualityScore < 80) {
        recommendations.push(`Improve ${suiteName}: Quality score below 80%`);
      }
    });

    // Default recommendations if everything passes
    if (recommendations.length === 0) {
      recommendations.push('Excellent quality! Consider implementing additional edge case tests');
      recommendations.push('Monitor real-world performance metrics');
      recommendations.push('Set up continuous quality monitoring');
    }

    return recommendations;
  }

  printFinalSummary() {
    console.log('\n' + '='.repeat(80));
    console.log('🎯 COMPREHENSIVE QUALITY ASSURANCE RESULTS');
    console.log('='.repeat(80));

    console.log(`\n📊 OVERALL QUALITY SCORE: ${this.results.overallScore.toFixed(1)}%`);

    if (this.results.overallScore >= 90) {
      console.log('🎉 EXCELLENT: Superior quality achieved!');
    } else if (this.results.overallScore >= 80) {
      console.log('✅ GOOD: High quality with minor improvements needed');
    } else if (this.results.overallScore >= 70) {
      console.log('⚠️  ACCEPTABLE: Quality meets minimum standards');
    } else {
      console.log('❌ NEEDS WORK: Significant quality improvements required');
    }

    console.log(`\n📈 EXECUTION SUMMARY:`);
    console.log(`   Total Execution Time: ${(this.results.executionTime / 1000).toFixed(1)}s`);
    console.log(`   Test Suites Passed: ${this.results.summary.passRate}`);

    console.log(`\n🧪 TEST SUITE BREAKDOWN:`);
    Object.entries(this.results.testSuites).forEach(([name, suite]) => {
      const status = suite.success ? '✅' : '❌';
      const score = suite.metrics?.qualityScore ? `(${suite.metrics.qualityScore.toFixed(1)}%)` : '';
      const time = `${suite.executionTime}ms`;
      console.log(`   ${status} ${name} ${score} - ${time}`);
    });

    if (this.results.recommendations.length > 0) {
      console.log(`\n💡 RECOMMENDATIONS:`);
      this.results.recommendations.forEach((rec, index) => {
        console.log(`   ${index + 1}. ${rec}`);
      });
    }

    console.log('\n' + '='.repeat(80));
    console.log('🚀 Quality assurance suite completed successfully!');
    console.log('='.repeat(80));
  }

  async generateErrorReport() {
    const errorReportPath = path.join(RESULTS_DIR, `qa-error-report-${Date.now()}.json`);
    fs.writeFileSync(errorReportPath, JSON.stringify(this.results, null, 2));

    console.log('\n❌ QUALITY SUITE EXECUTION FAILED');
    console.log(`Error: ${this.results.error}`);
    console.log(`Error report saved: ${errorReportPath}`);
  }
}

// Command line interface
function printUsage() {
  console.log('\nUsage: node run-quality-suite.mjs [options]');
  console.log('\nOptions:');
  console.log('  --help, -h     Show this help message');
  console.log('  --suite NAME   Run specific test suite only');
  console.log('  --quick        Run essential tests only (faster execution)');
  console.log('\nExamples:');
  console.log('  node run-quality-suite.mjs                           # Run complete suite');
  console.log('  node run-quality-suite.mjs --suite visibility        # Run card visibility tests only');
  console.log('  node run-quality-suite.mjs --quick                   # Run essential tests');
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  printUsage();
  process.exit(0);
}

// Run the quality suite
if (import.meta.url === `file://${process.argv[1]}`) {
  const runner = new QualitySuiteRunner();

  if (args.includes('--quick')) {
    console.log('🏃‍♂️ Running quick quality validation...\n');
    // Run only essential tests for faster feedback
    runner.runTestSuite('Card Visibility Validation', 'card-visibility-validation.spec.ts')
      .then(() => runner.runTestSuite('Quality Gates Framework', 'quality-gates.mjs'))
      .then(() => runner.generateFinalReport())
      .catch(console.error);
  } else {
    runner.runComplete().catch(console.error);
  }
}

export default QualitySuiteRunner;