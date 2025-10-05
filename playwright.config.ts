/**
 * MAIN PLAYWRIGHT CONFIGURATION
 *
 * This is the default configuration used when running:
 * npx playwright test
 *
 * OPTIMIZED CONFIGURATIONS AVAILABLE:
 *
 * For better performance, use specialized configs:
 *
 * - playwright.functional.config.ts
 *   Fast parallel execution for functional tests
 *   Command: npm run test:functional
 *
 * - playwright.performance.config.ts
 *   Sequential execution for accurate performance measurement
 *   Command: npm run test:performance
 *
 * - playwright.visual-regression.config.ts
 *   Consistent rendering for visual regression testing
 *   Command: npm run test:visual
 *
 * - playwright.ci.config.ts
 *   Optimized for GitHub Actions with test sharding
 *   Command: npm run test:ci
 *
 * See claudedocs/PLAYWRIGHT_OPTIMIZATION_GUIDE.md for details
 * See claudedocs/PLAYWRIGHT_QUICK_REFERENCE.md for common commands
 */

import { defineConfig } from '@playwright/test';
import { baseConfig } from './playwright.base.config';

/**
 * Export base configuration as default
 * This provides a reasonable default for quick test runs
 *
 * RECOMMENDATION: Use specialized configs for better performance
 * - Functional tests: 3-5x faster with playwright.functional.config.ts
 * - Performance tests: More accurate with playwright.performance.config.ts
 * - Visual tests: More consistent with playwright.visual-regression.config.ts
 */
export default defineConfig(baseConfig);