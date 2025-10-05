#!/usr/bin/env node

/**
 * Quality Gates Framework - Comprehensive Testing and Validation
 *
 * This script defines quality gates for the design matrix system
 * and runs comprehensive validation checks.
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:3000';
const RESULTS_DIR = path.join(process.cwd(), 'quality-results');

// Ensure results directory exists
if (!fs.existsSync(RESULTS_DIR)) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

class QualityGates {
  constructor() {
    this.results = {
      performance: {},
      functionality: {},
      visual: {},
      accessibility: {},
      errors: {},
      coverage: {}
    };
    this.startTime = Date.now();
  }

  async runAllGates() {
    console.log('🎯 Starting comprehensive quality gate validation...\n');

    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 }
    });
    const page = await context.newPage();

    try {
      // Gate 1: Performance Standards
      await this.validatePerformance(page);

      // Gate 2: Functional Requirements
      await this.validateFunctionality(page);

      // Gate 3: Visual Standards
      await this.validateVisual(page);

      // Gate 4: Accessibility Compliance
      await this.validateAccessibility(page);

      // Gate 5: Error Handling
      await this.validateErrorHandling(page);

      // Gate 6: Test Coverage Assessment
      await this.assessTestCoverage();

      // Generate final report
      await this.generateReport();

    } catch (error) {
      console.error('❌ Quality gate validation failed:', error.message);
      this.results.errors.critical = error.message;
    } finally {
      await browser.close();
    }
  }

  async validatePerformance(page) {
    console.log('📊 Gate 1: Performance Standards...');

    // Navigate and measure
    const start = Date.now();
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - start;

    // Wait for matrix stability
    await page.waitForSelector('.matrix-container');
    await page.waitForTimeout(2000);

    const stabilityTime = Date.now() - start;

    // Measure console log rate (should be low after fixes)
    let consoleLogCount = 0;
    const logStart = Date.now();

    page.on('console', () => {
      consoleLogCount++;
    });

    await page.waitForTimeout(5000);
    const logRate = consoleLogCount / ((Date.now() - logStart) / 1000);

    // Get performance metrics
    const performanceMetrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0];
      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0,
        firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0
      };
    });

    this.results.performance = {
      initialLoadTime: loadTime,
      stabilityTime: stabilityTime,
      consoleLogRate: logRate,
      ...performanceMetrics,
      gates: {
        loadTimeUnder3s: loadTime < 3000,
        stabilityUnder5s: stabilityTime < 5000,
        lowLogRate: logRate < 5,
        domContentLoadedUnder2s: performanceMetrics.domContentLoaded < 2000
      }
    };

    const passCount = Object.values(this.results.performance.gates).filter(Boolean).length;
    console.log(`   ✅ Performance: ${passCount}/4 gates passed`);
    console.log(`   Load time: ${loadTime}ms (target: <3000ms)`);
    console.log(`   Console log rate: ${logRate.toFixed(2)}/s (target: <5/s)`);
  }

  async validateFunctionality(page) {
    console.log('🎯 Gate 2: Functional Requirements...');

    // Check matrix presence
    const matrixExists = await page.locator('.matrix-container').isVisible();

    // Check card count
    const cardCount = await page.locator('div[style*="position: absolute"]').count();

    // Check card visibility
    let visibleCards = 0;
    for (let i = 0; i < cardCount; i++) {
      const isVisible = await page.locator('div[style*="position: absolute"]').nth(i).isVisible();
      if (isVisible) visibleCards++;
    }

    // Check quadrant labels (use first() to avoid strict mode violations)
    const quadrantLabels = await Promise.all([
      page.locator('text=Quick Wins').first().isVisible(),
      page.locator('text=Strategic Investments').first().isVisible(),
      page.locator('text=Reconsider').first().isVisible(),
      page.locator('text=Avoid').first().isVisible()
    ]);

    // Check statistics
    const statsExist = await page.locator('text=Total Ideas').first().isVisible();

    this.results.functionality = {
      matrixRendered: matrixExists,
      expectedCardCount: cardCount === 5,
      allCardsVisible: visibleCards === cardCount,
      quadrantLabelsPresent: quadrantLabels.every(Boolean),
      statisticsDisplayed: statsExist,
      cardCount: cardCount,
      visibleCards: visibleCards,
      gates: {
        matrixPresent: matrixExists,
        correctCardCount: cardCount === 5,
        allCardsVisible: visibleCards === cardCount,
        quadrantsLabeled: quadrantLabels.every(Boolean),
        statisticsWork: statsExist
      }
    };

    const passCount = Object.values(this.results.functionality.gates).filter(Boolean).length;
    console.log(`   ✅ Functionality: ${passCount}/5 gates passed`);
    console.log(`   Cards visible: ${visibleCards}/${cardCount}`);
  }

  async validateVisual(page) {
    console.log('🎨 Gate 3: Visual Standards...');

    // Check card positioning spread
    const cardPositions = await page.evaluate(() => {
      const matrixContainer = document.querySelector('.matrix-container');
      if (!matrixContainer) return [];

      const matrixRect = matrixContainer.getBoundingClientRect();
      return Array.from(document.querySelectorAll('div[style*="position: absolute"]')).map(card => {
        const rect = card.getBoundingClientRect();
        return {
          x: (rect.x - matrixRect.x) / matrixRect.width,
          y: (rect.y - matrixRect.y) / matrixRect.height
        };
      });
    });

    // Calculate distribution metrics
    const xPositions = cardPositions.map(pos => pos.x);
    const yPositions = cardPositions.map(pos => pos.y);
    const xSpread = Math.max(...xPositions) - Math.min(...xPositions);
    const ySpread = Math.max(...yPositions) - Math.min(...yPositions);

    // Check responsive behavior
    const viewports = [
      { width: 1440, height: 900 },
      { width: 768, height: 1024 },
      { width: 375, height: 667 }
    ];

    const responsiveResults = [];
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(500);

      const matrixVisible = await page.locator('.matrix-container').isVisible();
      const cardsVisible = await page.locator('div[style*="position: absolute"]').count();

      responsiveResults.push({
        viewport: `${viewport.width}x${viewport.height}`,
        matrixVisible: matrixVisible,
        cardsVisible: cardsVisible
      });
    }

    // Reset to desktop
    await page.setViewportSize({ width: 1440, height: 900 });

    this.results.visual = {
      cardDistribution: {
        xSpread: xSpread,
        ySpread: ySpread
      },
      responsive: responsiveResults,
      gates: {
        goodDistribution: xSpread > 0.3 && ySpread > 0.3,
        responsiveDesktop: responsiveResults[0].matrixVisible && responsiveResults[0].cardsVisible === 5,
        responsiveTablet: responsiveResults[1].matrixVisible && responsiveResults[1].cardsVisible === 5,
        responsiveMobile: responsiveResults[2].matrixVisible && responsiveResults[2].cardsVisible === 5
      }
    };

    const passCount = Object.values(this.results.visual.gates).filter(Boolean).length;
    console.log(`   ✅ Visual: ${passCount}/4 gates passed`);
    console.log(`   Card spread: ${(xSpread * 100).toFixed(1)}% x ${(ySpread * 100).toFixed(1)}%`);
  }

  async validateAccessibility(page) {
    console.log('♿ Gate 4: Accessibility Compliance...');

    // Check for ARIA labels and roles
    const ariaElements = await page.locator('[aria-label], [role], [aria-describedby]').count();

    // Check for focusable elements
    const focusableElements = await page.locator('button, [tabindex], input, [role="button"]').count();

    // Check color contrast (basic check)
    const hasGoodContrast = await page.evaluate(() => {
      const cards = document.querySelectorAll('div[style*="position: absolute"]');
      if (cards.length === 0) return false;

      // Check if cards have visible text content
      return Array.from(cards).every(card => {
        const text = card.textContent?.trim();
        return text && text.length > 0;
      });
    });

    // Check for keyboard navigation
    const firstFocusable = page.locator('button, [tabindex], [role="button"]').first();
    let keyboardAccessible = false;

    try {
      if (await firstFocusable.isVisible()) {
        await firstFocusable.focus();
        keyboardAccessible = await firstFocusable.isFocused();
      }
    } catch (error) {
      keyboardAccessible = false;
    }

    this.results.accessibility = {
      ariaElements: ariaElements,
      focusableElements: focusableElements,
      textVisible: hasGoodContrast,
      keyboardAccessible: keyboardAccessible,
      gates: {
        hasAriaElements: ariaElements > 0,
        hasFocusableElements: focusableElements > 0,
        textIsVisible: hasGoodContrast,
        keyboardNavigation: keyboardAccessible
      }
    };

    const passCount = Object.values(this.results.accessibility.gates).filter(Boolean).length;
    console.log(`   ✅ Accessibility: ${passCount}/4 gates passed`);
  }

  async validateErrorHandling(page) {
    console.log('🚨 Gate 5: Error Handling...');

    const consoleErrors = [];
    const consoleWarnings = [];
    const networkErrors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      } else if (msg.type() === 'warning') {
        consoleWarnings.push(msg.text());
      }
    });

    page.on('response', response => {
      if (response.status() >= 400) {
        networkErrors.push({
          url: response.url(),
          status: response.status()
        });
      }
    });

    // Navigate and wait
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Filter out known acceptable errors
    const criticalErrors = consoleErrors.filter(error =>
      !error.includes('Download the React DevTools') &&
      !error.includes('Warning:') &&
      !error.includes('[vite]')
    );

    this.results.errors = {
      consoleErrors: criticalErrors,
      consoleWarnings: consoleWarnings,
      networkErrors: networkErrors,
      gates: {
        noCriticalErrors: criticalErrors.length === 0,
        noNetworkErrors: networkErrors.length === 0,
        acceptableWarnings: consoleWarnings.length < 10
      }
    };

    const passCount = Object.values(this.results.errors.gates).filter(Boolean).length;
    console.log(`   ✅ Error Handling: ${passCount}/3 gates passed`);
    console.log(`   Critical errors: ${criticalErrors.length}`);
  }

  async assessTestCoverage() {
    console.log('📋 Gate 6: Test Coverage Assessment...');

    // Check for test files
    const testFiles = [
      'tests/e2e/design-matrix.spec.js',
      'tests/visual/matrix-visual.spec.js',
      'tests/integration/component-integration.spec.js',
      'tests/functional/matrix-functionality.spec.js'
    ];

    const coverageAreas = {
      e2e: fs.existsSync(path.join(process.cwd(), testFiles[0])),
      visual: fs.existsSync(path.join(process.cwd(), testFiles[1])),
      integration: fs.existsSync(path.join(process.cwd(), testFiles[2])),
      functional: fs.existsSync(path.join(process.cwd(), testFiles[3]))
    };

    this.results.coverage = {
      testFiles: coverageAreas,
      gates: {
        hasE2ETests: coverageAreas.e2e,
        hasVisualTests: coverageAreas.visual,
        hasIntegrationTests: coverageAreas.integration,
        hasFunctionalTests: coverageAreas.functional
      }
    };

    const passCount = Object.values(this.results.coverage.gates).filter(Boolean).length;
    console.log(`   ✅ Test Coverage: ${passCount}/4 areas covered`);
  }

  async generateReport() {
    console.log('\n📊 Generating comprehensive quality report...');

    const totalTime = Date.now() - this.startTime;

    // Calculate overall score
    const allGates = [
      ...Object.values(this.results.performance.gates),
      ...Object.values(this.results.functionality.gates),
      ...Object.values(this.results.visual.gates),
      ...Object.values(this.results.accessibility.gates),
      ...Object.values(this.results.errors.gates),
      ...Object.values(this.results.coverage.gates)
    ];

    const passedGates = allGates.filter(Boolean).length;
    const totalGates = allGates.length;
    const overallScore = (passedGates / totalGates) * 100;

    const report = {
      timestamp: new Date().toISOString(),
      executionTime: totalTime,
      overallScore: overallScore,
      summary: {
        totalGates: totalGates,
        passedGates: passedGates,
        passRate: `${passedGates}/${totalGates} (${overallScore.toFixed(1)}%)`
      },
      results: this.results,
      recommendations: this.generateRecommendations()
    };

    // Save report
    const reportPath = path.join(RESULTS_DIR, `quality-report-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Print summary
    console.log('\n🎯 QUALITY GATE RESULTS:');
    console.log(`   Overall Score: ${overallScore.toFixed(1)}% (${passedGates}/${totalGates})`);
    console.log(`   Execution Time: ${(totalTime / 1000).toFixed(1)}s`);

    if (overallScore >= 90) {
      console.log('   🎉 EXCELLENT: All critical quality gates passed!');
    } else if (overallScore >= 80) {
      console.log('   ✅ GOOD: Most quality gates passed, minor improvements needed');
    } else if (overallScore >= 70) {
      console.log('   ⚠️  ACCEPTABLE: Some quality issues need attention');
    } else {
      console.log('   ❌ NEEDS WORK: Significant quality improvements required');
    }

    console.log(`\n📂 Detailed report saved: ${reportPath}`);

    return report;
  }

  generateRecommendations() {
    const recommendations = [];

    // Performance recommendations
    if (!this.results.performance.gates.loadTimeUnder3s) {
      recommendations.push('Optimize initial load time (consider code splitting, lazy loading)');
    }
    if (!this.results.performance.gates.lowLogRate) {
      recommendations.push('Reduce console logging in production (use logger with levels)');
    }

    // Functionality recommendations
    if (!this.results.functionality.gates.allCardsVisible) {
      recommendations.push('Fix card visibility issues (check CSS positioning and transforms)');
    }

    // Visual recommendations
    if (!this.results.visual.gates.goodDistribution) {
      recommendations.push('Improve card distribution across matrix quadrants');
    }

    // Accessibility recommendations
    if (!this.results.accessibility.gates.hasAriaElements) {
      recommendations.push('Add ARIA labels and roles for better accessibility');
    }
    if (!this.results.accessibility.gates.keyboardNavigation) {
      recommendations.push('Ensure all interactive elements are keyboard accessible');
    }

    // Error handling recommendations
    if (!this.results.errors.gates.noCriticalErrors) {
      recommendations.push('Fix console errors (check browser developer tools)');
    }

    if (recommendations.length === 0) {
      recommendations.push('Quality standards met! Consider performance optimizations and additional test coverage.');
    }

    return recommendations;
  }
}

// Run quality gates if script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const qualityGates = new QualityGates();
  qualityGates.runAllGates().catch(console.error);
}

export default QualityGates;