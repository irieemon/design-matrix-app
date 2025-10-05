#!/usr/bin/env node

/**
 * Comprehensive Fix Validation Runner
 *
 * Executes all validation tests and generates comprehensive evidence report
 * for the fixes implemented:
 * 1. Card Background Visibility
 * 2. Double-Click Functionality
 * 3. Performance Stability (60fps)
 * 4. Visual Evidence Collection
 */

import { execSync } from 'child_process';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class ComprehensiveValidationRunner {
  constructor() {
    this.projectRoot = join(__dirname, '..');
    this.resultsDir = join(this.projectRoot, 'validation-results');
    this.timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.runId = `validation-${this.timestamp}`;
    this.results = {
      runId: this.runId,
      timestamp: new Date().toISOString(),
      summary: {
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        fixesValidated: [],
        criticalIssues: [],
        performanceMetrics: {}
      },
      testSuites: [],
      evidence: {
        screenshots: [],
        reports: []
      }
    };

    this.setupDirectories();
  }

  setupDirectories() {
    if (!existsSync(this.resultsDir)) {
      mkdirSync(this.resultsDir, { recursive: true });
    }

    const runDir = join(this.resultsDir, this.runId);
    if (!existsSync(runDir)) {
      mkdirSync(runDir, { recursive: true });
    }

    this.runDir = runDir;
  }

  async runValidation() {
    console.log('🚀 Starting Comprehensive Fix Validation');
    console.log(`📁 Results will be saved to: ${this.runDir}`);
    console.log('=' .repeat(80));

    try {
      // 1. Run card background validation tests
      await this.runTestSuite('Card Background Validation', [
        'tests/comprehensive-fix-validation.spec.ts --grep "Card Background"'
      ]);

      // 2. Run double-click functionality tests
      await this.runTestSuite('Double-Click Functionality', [
        'tests/double-click-functionality.spec.ts'
      ]);

      // 3. Run performance stability tests
      await this.runTestSuite('Performance Stability', [
        'tests/performance-stability.spec.ts'
      ]);

      // 4. Run visual evidence collection
      await this.runTestSuite('Visual Evidence Collection', [
        'tests/visual-evidence-system.spec.ts'
      ]);

      // 5. Run comprehensive validation
      await this.runTestSuite('Comprehensive Integration', [
        'tests/comprehensive-fix-validation.spec.ts'
      ]);

      // Generate final report
      await this.generateFinalReport();

    } catch (error) {
      console.error('❌ Validation failed:', error.message);
      this.results.summary.criticalIssues.push(`Validation execution failed: ${error.message}`);
    } finally {
      await this.cleanup();
    }
  }

  async runTestSuite(suiteName, testPaths) {
    console.log(`\n🧪 Running ${suiteName}`);
    console.log('-'.repeat(50));

    const suiteResult = {
      name: suiteName,
      startTime: new Date().toISOString(),
      endTime: null,
      status: 'running',
      tests: [],
      error: null
    };

    try {
      for (const testPath of testPaths) {
        console.log(`   📋 Executing: ${testPath}`);

        const startTime = Date.now();
        const result = await this.executeTest(testPath);
        const duration = Date.now() - startTime;

        const testResult = {
          path: testPath,
          duration,
          status: result.success ? 'passed' : 'failed',
          output: result.output,
          error: result.error
        };

        suiteResult.tests.push(testResult);

        if (result.success) {
          console.log(`   ✅ Passed (${duration}ms)`);
          this.results.summary.passedTests++;
        } else {
          console.log(`   ❌ Failed (${duration}ms): ${result.error}`);
          this.results.summary.failedTests++;
          this.results.summary.criticalIssues.push(`${suiteName}: ${result.error}`);
        }

        this.results.summary.totalTests++;
      }

      suiteResult.status = suiteResult.tests.every(t => t.status === 'passed') ? 'passed' : 'failed';
      suiteResult.endTime = new Date().toISOString();

      console.log(`   📊 Suite ${suiteResult.status}: ${suiteResult.tests.filter(t => t.status === 'passed').length}/${suiteResult.tests.length} tests passed`);

    } catch (error) {
      suiteResult.status = 'error';
      suiteResult.error = error.message;
      suiteResult.endTime = new Date().toISOString();

      console.log(`   🚨 Suite error: ${error.message}`);
      this.results.summary.criticalIssues.push(`${suiteName} suite error: ${error.message}`);
    }

    this.results.testSuites.push(suiteResult);

    // Update fixes validated based on suite
    if (suiteResult.status === 'passed') {
      switch (suiteName) {
        case 'Card Background Validation':
          this.results.summary.fixesValidated.push('Card Background Visibility');
          break;
        case 'Double-Click Functionality':
          this.results.summary.fixesValidated.push('Double-Click Modal Opening');
          break;
        case 'Performance Stability':
          this.results.summary.fixesValidated.push('60fps Performance');
          break;
        case 'Visual Evidence Collection':
          this.results.summary.fixesValidated.push('Visual Evidence System');
          break;
      }
    }
  }

  async executeTest(testPath) {
    try {
      const command = `cd "${this.projectRoot}" && npx playwright test "${testPath}" --reporter=json`;
      const output = execSync(command, {
        encoding: 'utf8',
        timeout: 120000, // 2 minutes timeout
        stdio: ['pipe', 'pipe', 'pipe']
      });

      return {
        success: true,
        output: output,
        error: null
      };

    } catch (error) {
      return {
        success: false,
        output: error.stdout || '',
        error: error.message || 'Unknown test execution error'
      };
    }
  }

  async generateFinalReport() {
    console.log('\n📋 Generating Final Validation Report');
    console.log('=' .repeat(80));

    // Collect evidence files
    await this.collectEvidence();

    // Generate JSON report
    const jsonReport = JSON.stringify(this.results, null, 2);
    const jsonPath = join(this.runDir, 'validation-report.json');
    writeFileSync(jsonPath, jsonReport);

    // Generate HTML report
    const htmlReport = this.generateHTMLReport();
    const htmlPath = join(this.runDir, 'validation-report.html');
    writeFileSync(htmlPath, htmlReport);

    // Generate summary report
    const summaryReport = this.generateSummaryReport();
    const summaryPath = join(this.runDir, 'VALIDATION_SUMMARY.md');
    writeFileSync(summaryPath, summaryReport);

    console.log(`📄 Reports generated:`);
    console.log(`   📋 JSON: ${jsonPath}`);
    console.log(`   🌐 HTML: ${htmlPath}`);
    console.log(`   📝 Summary: ${summaryPath}`);

    // Display summary
    this.displaySummary();
  }

  async collectEvidence() {
    try {
      const testResultsDir = join(this.projectRoot, 'test-results');
      if (existsSync(testResultsDir)) {
        const playwrightReportDir = join(testResultsDir, 'playwright-report');
        if (existsSync(playwrightReportDir)) {
          this.results.evidence.reports.push('playwright-report');
        }

        // Look for screenshot directories
        const evidenceDir = join(testResultsDir, 'evidence');
        if (existsSync(evidenceDir)) {
          this.results.evidence.screenshots.push('evidence');
        }
      }
    } catch (error) {
      console.log(`⚠️ Could not collect evidence: ${error.message}`);
    }
  }

  generateHTMLReport() {
    const passRate = this.results.summary.totalTests > 0 ?
      ((this.results.summary.passedTests / this.results.summary.totalTests) * 100).toFixed(1) : 0;

    const statusColor = this.results.summary.criticalIssues.length === 0 ? '#4CAF50' : '#F44336';

    return `
<!DOCTYPE html>
<html>
<head>
    <title>Comprehensive Fix Validation Report</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; border-bottom: 3px solid ${statusColor}; padding-bottom: 20px; margin-bottom: 30px; }
        .status-badge { display: inline-block; padding: 10px 20px; border-radius: 25px; color: white; background: ${statusColor}; font-weight: bold; }
        .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 30px 0; }
        .summary-card { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; border-left: 4px solid ${statusColor}; }
        .summary-card h3 { margin: 0 0 10px 0; color: #333; }
        .summary-card .number { font-size: 2em; font-weight: bold; color: ${statusColor}; }
        .fixes-section { margin: 30px 0; }
        .fix-item { background: #e8f5e8; padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #4CAF50; }
        .issue-item { background: #ffebee; padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #F44336; }
        .test-suite { background: #f8f9fa; margin: 20px 0; padding: 20px; border-radius: 8px; }
        .test-suite h3 { margin: 0 0 15px 0; color: #333; }
        .test-item { padding: 10px; margin: 5px 0; border-radius: 4px; }
        .test-passed { background: #d4edda; color: #155724; }
        .test-failed { background: #f8d7da; color: #721c24; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 2px solid #eee; text-align: center; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔧 Comprehensive Fix Validation Report</h1>
            <div class="status-badge">
                ${this.results.summary.criticalIssues.length === 0 ? '✅ ALL FIXES VALIDATED' : '⚠️ ISSUES DETECTED'}
            </div>
            <p><strong>Run ID:</strong> ${this.results.runId}</p>
            <p><strong>Generated:</strong> ${this.results.timestamp}</p>
        </div>

        <div class="summary-grid">
            <div class="summary-card">
                <h3>Total Tests</h3>
                <div class="number">${this.results.summary.totalTests}</div>
            </div>
            <div class="summary-card">
                <h3>Pass Rate</h3>
                <div class="number">${passRate}%</div>
            </div>
            <div class="summary-card">
                <h3>Fixes Validated</h3>
                <div class="number">${this.results.summary.fixesValidated.length}</div>
            </div>
            <div class="summary-card">
                <h3>Critical Issues</h3>
                <div class="number">${this.results.summary.criticalIssues.length}</div>
            </div>
        </div>

        <div class="fixes-section">
            <h2>✅ Fixes Successfully Validated</h2>
            ${this.results.summary.fixesValidated.length > 0 ?
              this.results.summary.fixesValidated.map(fix => `<div class="fix-item">✅ ${fix}</div>`).join('') :
              '<p>No fixes validated successfully.</p>'
            }
        </div>

        ${this.results.summary.criticalIssues.length > 0 ? `
        <div class="fixes-section">
            <h2>🚨 Critical Issues Detected</h2>
            ${this.results.summary.criticalIssues.map(issue => `<div class="issue-item">⚠️ ${issue}</div>`).join('')}
        </div>
        ` : ''}

        <div class="fixes-section">
            <h2>📋 Test Suite Results</h2>
            ${this.results.testSuites.map(suite => `
            <div class="test-suite">
                <h3>${suite.name} - ${suite.status.toUpperCase()}</h3>
                ${suite.tests.map(test => `
                <div class="test-item ${test.status === 'passed' ? 'test-passed' : 'test-failed'}">
                    ${test.status === 'passed' ? '✅' : '❌'} ${test.path} (${test.duration}ms)
                    ${test.error ? `<br><small>Error: ${test.error}</small>` : ''}
                </div>
                `).join('')}
            </div>
            `).join('')}
        </div>

        <div class="footer">
            <p>Report generated by Comprehensive Fix Validation System</p>
            <p>🎯 Validates: Card Backgrounds • Double-Click Functionality • 60fps Performance • Visual Evidence</p>
        </div>
    </div>
</body>
</html>
    `;
  }

  generateSummaryReport() {
    return `# COMPREHENSIVE FIX VALIDATION SUMMARY

## 🎯 Validation Overview

**Run ID:** ${this.results.runId}
**Generated:** ${this.results.timestamp}
**Status:** ${this.results.summary.criticalIssues.length === 0 ? '✅ ALL FIXES VALIDATED' : '⚠️ ISSUES DETECTED'}

## 📊 Results Summary

- **Total Tests:** ${this.results.summary.totalTests}
- **Passed Tests:** ${this.results.summary.passedTests}
- **Failed Tests:** ${this.results.summary.failedTests}
- **Pass Rate:** ${this.results.summary.totalTests > 0 ? ((this.results.summary.passedTests / this.results.summary.totalTests) * 100).toFixed(1) : 0}%

## ✅ Fixes Successfully Validated

${this.results.summary.fixesValidated.length > 0 ?
  this.results.summary.fixesValidated.map(fix => `- ✅ ${fix}`).join('\n') :
  'No fixes validated successfully.'
}

## 🎯 Target Fixes Status

1. **Card Background Visibility** - ${this.results.summary.fixesValidated.includes('Card Background Visibility') ? '✅ VALIDATED' : '❌ NOT VALIDATED'}
   - Cards must have solid white backgrounds
   - Text must be readable and visible

2. **Double-Click Functionality** - ${this.results.summary.fixesValidated.includes('Double-Click Modal Opening') ? '✅ VALIDATED' : '❌ NOT VALIDATED'}
   - Double-click opens edit modal
   - No blank pages or unwanted navigation

3. **60fps Performance** - ${this.results.summary.fixesValidated.includes('60fps Performance') ? '✅ VALIDATED' : '❌ NOT VALIDATED'}
   - Maintains 60fps during interactions
   - Clean console output

4. **Visual Evidence System** - ${this.results.summary.fixesValidated.includes('Visual Evidence System') ? '✅ VALIDATED' : '❌ NOT VALIDATED'}
   - Screenshots proving all fixes work
   - Comprehensive evidence collection

${this.results.summary.criticalIssues.length > 0 ? `
## 🚨 Critical Issues Detected

${this.results.summary.criticalIssues.map(issue => `- ⚠️ ${issue}`).join('\n')}
` : `
## 🎉 Validation Success

All critical fixes have been successfully validated with visual evidence!
`}

## 📋 Test Suite Breakdown

${this.results.testSuites.map(suite => `
### ${suite.name}
- **Status:** ${suite.status.toUpperCase()}
- **Tests:** ${suite.tests.length}
- **Passed:** ${suite.tests.filter(t => t.status === 'passed').length}
- **Failed:** ${suite.tests.filter(t => t.status === 'failed').length}
`).join('')}

## 📁 Evidence Location

Results and evidence are saved in: \`${this.runDir}\`

## 🎯 Next Steps

${this.results.summary.criticalIssues.length === 0 ? `
✅ **All fixes validated successfully!**

The following issues have been resolved and verified:
- Card backgrounds are now visible and readable
- Double-click functionality opens edit modals correctly
- Performance maintains 60fps with clean console
- Visual evidence proves all fixes are working

**Ready for production deployment.**
` : `
⚠️ **Critical issues detected that need attention:**

${this.results.summary.criticalIssues.map(issue => `1. ${issue}`).join('\n')}

**Recommendation:** Address these issues before deployment.
`}

---
*Generated by Comprehensive Fix Validation System*
*Validates: Card Backgrounds • Double-Click Functionality • 60fps Performance • Visual Evidence*
`;
  }

  displaySummary() {
    console.log('\n' + '='.repeat(80));
    console.log('🎯 COMPREHENSIVE FIX VALIDATION SUMMARY');
    console.log('='.repeat(80));

    console.log(`📊 Results: ${this.results.summary.passedTests}/${this.results.summary.totalTests} tests passed`);
    console.log(`✅ Fixes Validated: ${this.results.summary.fixesValidated.length}`);
    console.log(`🚨 Critical Issues: ${this.results.summary.criticalIssues.length}`);

    if (this.results.summary.fixesValidated.length > 0) {
      console.log('\n✅ Successfully Validated Fixes:');
      this.results.summary.fixesValidated.forEach(fix => {
        console.log(`   ✅ ${fix}`);
      });
    }

    if (this.results.summary.criticalIssues.length > 0) {
      console.log('\n🚨 Critical Issues Detected:');
      this.results.summary.criticalIssues.forEach(issue => {
        console.log(`   ⚠️ ${issue}`);
      });
    }

    console.log(`\n📁 Results saved to: ${this.runDir}`);

    if (this.results.summary.criticalIssues.length === 0) {
      console.log('\n🎉 ALL FIXES VALIDATED SUCCESSFULLY!');
      console.log('   Ready for production deployment.');
    } else {
      console.log('\n⚠️ Issues detected that need attention before deployment.');
    }

    console.log('='.repeat(80));
  }

  async cleanup() {
    // Any cleanup operations
    console.log('\n🧹 Cleanup completed');
  }
}

// Run validation if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const runner = new ComprehensiveValidationRunner();
  runner.runValidation().catch(error => {
    console.error('💥 Validation runner failed:', error);
    process.exit(1);
  });
}

export default ComprehensiveValidationRunner;