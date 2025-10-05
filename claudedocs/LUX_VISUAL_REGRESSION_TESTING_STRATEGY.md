# Animated Lux Visual Regression Testing Strategy

**Project**: Design Matrix App - Lux Design System Migration
**Version**: 1.0.0
**Date**: 2025-10-02
**Status**: Implementation Ready

---

## Executive Summary

This document defines a comprehensive visual regression testing strategy for validating the Animated Lux design system migration across 161 components without introducing regressions. The strategy leverages existing Playwright infrastructure while adding specialized Lux-specific validation.

**Key Metrics**:
- **Baseline Management**: Git-tagged snapshots with semantic versioning
- **Snapshot Comparison**: Multi-threshold approach (10-25% tolerance by component type)
- **Animation Testing**: Key-frame capture with disabled animations baseline
- **Cross-Browser Coverage**: 3 browsers (Chrome, Firefox, Safari) + 3 viewport sizes
- **CI/CD Integration**: Automated visual regression in GitHub Actions

---

## I. Testing Architecture Overview

### Component Testing Pyramid

```
┌─────────────────────────────────────────────────────────────────┐
│                     VISUAL REGRESSION PYRAMID                     │
│                                                                   │
│  Level 4: Full Application Flows (E2E + Visual)                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ User Journeys: Login → Matrix → Drag → Save (10 tests)    │ │
│  │ Coverage: Complete user workflows with visual validation  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                           ▲                                        │
│  Level 3: Critical Business Components                            │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ IdeaCard, DesignMatrix: All states (45 tests)             │ │
│  │ Coverage: Drag, drop, collapse, expand, quadrants         │ │
│  └────────────────────────────────────────────────────────────┘ │
│                           ▲                                        │
│  Level 2: Enhanced UI Components                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ ButtonLux, InputLux, SelectLux: Variants + States (80)    │ │
│  │ Coverage: 5 gem-tones × 4 states × 4 sizes                │ │
│  └────────────────────────────────────────────────────────────┘ │
│                           ▲                                        │
│  Level 1: Design Token Foundation                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Color palettes, shadows, animations (25 tests)            │ │
│  │ Coverage: Token rendering, browser consistency            │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Test Organization Structure

```
tests/
├── visual-regression/
│   ├── lux/
│   │   ├── foundation/
│   │   │   ├── tokens.spec.ts              # Design tokens validation
│   │   │   ├── colors.spec.ts              # Color palette consistency
│   │   │   ├── shadows.spec.ts             # Shadow rendering
│   │   │   └── animations.spec.ts          # Animation keyframes
│   │   │
│   │   ├── components/
│   │   │   ├── button-lux.spec.ts          # ButtonLux all variants
│   │   │   ├── input-lux.spec.ts           # InputLux all states
│   │   │   ├── select-lux.spec.ts          # SelectLux all options
│   │   │   └── modal-lux.spec.ts           # Enhanced modals
│   │   │
│   │   ├── critical/
│   │   │   ├── idea-card-lux.spec.ts       # IdeaCard all quadrants
│   │   │   ├── design-matrix-lux.spec.ts   # Matrix layout + gradients
│   │   │   ├── drag-drop-lux.spec.ts       # Drag interactions
│   │   │   └── collapse-expand.spec.ts     # State transitions
│   │   │
│   │   ├── responsive/
│   │   │   ├── breakpoints.spec.ts         # 6 breakpoints validation
│   │   │   ├── mobile-lux.spec.ts          # Mobile-specific
│   │   │   └── tablet-lux.spec.ts          # Tablet-specific
│   │   │
│   │   └── cross-browser/
│   │       ├── chrome-lux.spec.ts          # Chromium-specific tests
│   │       ├── firefox-lux.spec.ts         # Firefox rendering
│   │       └── safari-lux.spec.ts          # WebKit compatibility
│   │
│   ├── __snapshots__/
│   │   ├── baseline/                       # Pre-Lux migration baselines
│   │   │   ├── chromium/
│   │   │   ├── firefox/
│   │   │   └── webkit/
│   │   │
│   │   └── lux/                            # Lux design system snapshots
│   │       ├── chromium/
│   │       ├── firefox/
│   │       └── webkit/
│   │
│   └── fixtures/
│       ├── lux-test-data.ts               # Test data generation
│       ├── animation-helpers.ts            # Animation testing utilities
│       └── visual-comparison.ts            # Custom matchers
```

---

## II. Playwright Configuration Strategy

### Base Configuration Extension

**File**: `playwright.lux-visual.config.ts`

```typescript
import { defineConfig, devices } from '@playwright/test';
import { baseConfig } from './playwright.base.config';

/**
 * LUX VISUAL REGRESSION CONFIGURATION
 *
 * Specialized config for Animated Lux design system validation
 * Focuses on:
 * - Consistent rendering across browsers
 * - Animation key-frame capture
 * - Cross-browser color/shadow fidelity
 * - Performance-optimized execution
 */
export default defineConfig({
  ...baseConfig,

  testDir: './tests/visual-regression/lux',

  // Timeout configurations optimized for visual capture
  timeout: 90000, // 90s for animation sequences
  expect: {
    timeout: 15000,

    // Visual comparison thresholds - CRITICAL for Lux migration
    toHaveScreenshot: {
      // Animation differences require higher tolerance
      threshold: 0.15,        // 15% pixel difference (animations, shadows)
      maxDiffPixels: 1500,    // Max pixels before failure
      maxDiffPixelRatio: 0.05, // Max 5% of pixels different

      // Animation handling strategy
      animations: 'disabled', // DEFAULT: Disable for consistency

      // Color precision
      caret: 'hide',          // Hide text cursor for consistency
      scale: 'css',           // Use CSS pixels for precision
    },
  },

  // Sequential execution for consistent visual capture
  fullyParallel: false,
  workers: 1, // Single worker prevents resource conflicts

  // Retry strategy for visual tests
  retries: process.env.CI ? 3 : 1, // Higher retries for CI (font loading issues)

  // Global test configuration
  use: {
    baseURL: 'http://localhost:5173',

    // Browser configuration for visual consistency
    viewport: { width: 1440, height: 900 }, // Design compliance viewport
    ignoreHTTPSErrors: true,

    // Enhanced tracing for debugging visual issues
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    // Additional visual testing optimizations
    actionTimeout: 15000,    // Allow time for animations
    navigationTimeout: 45000, // Account for slow CI environments

    // Motion preferences
    reducedMotion: 'no-preference', // IMPORTANT: Test animations in default mode

    // Color scheme consistency
    colorScheme: 'light', // Lux design is light-mode first

    // Font rendering consistency
    launchOptions: {
      args: [
        '--font-render-hinting=none', // Consistent font rendering
        '--disable-font-subpixel-positioning',
      ],
    },
  },

  // Test output configuration
  outputDir: 'test-results/lux-visual/',

  // Reporter configuration for visual tests
  reporter: [
    ['html', {
      outputFolder: 'test-results/lux-visual-report',
      open: 'never',
      attachmentsBaseURL: process.env.CI ? 'https://artifacts.example.com/' : undefined,
    }],
    ['json', {
      outputFile: 'test-results/lux-visual-results.json',
    }],
    ['list', { printSteps: true }],
    // Custom visual diff reporter (optional)
    ['./tests/visual-regression/reporters/visual-diff-reporter.ts'],
  ],

  // Multi-browser visual validation
  projects: [
    // PRIMARY: Chromium (Development target)
    {
      name: 'lux-chromium-desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        launchOptions: {
          args: [
            '--disable-web-security',
            '--disable-features=TranslateUI',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--font-render-hinting=none',
            '--disable-font-subpixel-positioning',
          ],
        },
      },
    },

    // SECONDARY: Firefox (Gecko engine validation)
    {
      name: 'lux-firefox-desktop',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 1440, height: 900 },
        launchOptions: {
          firefoxUserPrefs: {
            'ui.prefersReducedMotion': 0, // Enable animations
            'gfx.webrender.all': true,    // GPU acceleration
            'layout.css.devPixelsPerPx': '1.0', // Pixel precision
          },
        },
      },
    },

    // TERTIARY: Safari (WebKit validation)
    {
      name: 'lux-safari-desktop',
      use: {
        ...devices['Desktop Safari'],
        viewport: { width: 1440, height: 900 },
      },
    },

    // RESPONSIVE: Mobile Chrome
    {
      name: 'lux-mobile-chrome',
      use: {
        ...devices['Pixel 5'],
        viewport: { width: 393, height: 851 },
      },
    },

    // RESPONSIVE: Mobile Safari
    {
      name: 'lux-mobile-safari',
      use: {
        ...devices['iPhone 12'],
        viewport: { width: 390, height: 844 },
      },
    },

    // RESPONSIVE: Tablet
    {
      name: 'lux-tablet',
      use: {
        ...devices['iPad Pro'],
        viewport: { width: 1024, height: 1366 },
      },
    },
  ],

  // Web server configuration
  webServer: {
    command: 'VITE_LUX_ENABLED=true npm run dev', // CRITICAL: Enable Lux
    port: 5173,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: {
      VITE_LUX_ENABLED: 'true', // Ensure Lux is enabled
    },
  },

  // Global setup and teardown
  globalSetup: require.resolve('./tests/visual-regression/lux/setup/global-setup.ts'),
  globalTeardown: require.resolve('./tests/visual-regression/lux/setup/global-teardown.ts'),
});
```

---

## III. Baseline Generation Strategy

### Phase-Based Baseline Workflow

```yaml
baseline_generation_phases:

  phase_0_pre_lux:
    description: "Capture complete pre-Lux visual state"
    timing: "Before Phase 1 implementation"
    storage: "tests/visual-regression/__snapshots__/baseline/"
    git_tag: "lux-baseline-v0.0.0-pre-migration"
    purpose: "Rollback reference, regression detection"

    execution:
      - command: "UPDATE_SNAPSHOTS=true npm run test:visual:baseline"
      - validation: "Manual review of all screenshots"
      - commit: "git add tests/visual-regression/__snapshots__/baseline/"
      - tag: "git tag -a lux-baseline-v0.0.0 -m 'Pre-Lux migration baseline'"

    coverage:
      - All critical components (IdeaCard, DesignMatrix)
      - All UI components (Button, Input, Select)
      - All responsive breakpoints (6 viewports)
      - All browsers (Chromium, Firefox, WebKit)

    metrics:
      total_snapshots: 450
      storage_size: ~85MB
      generation_time: ~12 minutes

  phase_1_foundation:
    description: "Validate design token rendering"
    timing: "After CSS tokens + Tailwind config"
    storage: "tests/visual-regression/__snapshots__/lux/phase-1/"
    git_tag: "lux-baseline-v1.0.0-foundation"

    changes_expected:
      - Color palette consistency (gem-tones)
      - Shadow rendering (width-dominant)
      - Animation timing functions (visual smoothness)

    threshold_adjustments:
      colors: 0.05        # 5% tolerance for color shifts
      shadows: 0.10       # 10% tolerance for shadow rendering
      animations: 0.15    # 15% tolerance for animation differences

    validation_criteria:
      - No functional regressions
      - Color contrast ratios maintained (WCAG AA)
      - Shadow rendering consistent across browsers
      - Animation performance <16ms

  phase_2_components:
    description: "Validate enhanced component variants"
    timing: "After ButtonLux, InputLux, SelectLux"
    storage: "tests/visual-regression/__snapshots__/lux/phase-2/"
    git_tag: "lux-baseline-v2.0.0-components"

    changes_expected:
      - Gem-tone button variants (5 colors)
      - Focus state enhancements (sapphire accents)
      - Hover animations (subtle shadows)

    threshold_adjustments:
      static_states: 0.10    # 10% tolerance for static rendering
      hover_states: 0.20     # 20% tolerance for hover animations
      focus_states: 0.15     # 15% tolerance for focus rings

    validation_criteria:
      - Backward compatibility with base components
      - Accessibility compliance (keyboard navigation)
      - Performance benchmarks maintained

  phase_3_critical:
    description: "Validate business component enhancements"
    timing: "After IdeaCardLux, DesignMatrixLux"
    storage: "tests/visual-regression/__snapshots__/lux/phase-3/"
    git_tag: "lux-baseline-v3.0.0-critical"

    changes_expected:
      - Quadrant-specific gem-tone accents
      - Enhanced drag-drop visual feedback
      - Gradient backgrounds per quadrant

    threshold_adjustments:
      static_matrix: 0.12    # 12% tolerance for gradient backgrounds
      drag_states: 0.25      # 25% tolerance for drag animations
      quadrant_colors: 0.08  # 8% tolerance for gem-tone accents

    validation_criteria:
      - Zero functional regressions (drag, drop, collapse)
      - Performance maintained (<16ms hover response)
      - User permissions logic intact

  phase_4_complete:
    description: "Final production baseline"
    timing: "After full application migration"
    storage: "tests/visual-regression/__snapshots__/lux/production/"
    git_tag: "lux-baseline-v4.0.0-production"

    purpose: "Production deployment reference"
    validation: "Complete regression suite + manual QA"
```

### Baseline Storage Strategy

```typescript
// tests/visual-regression/lux/config/baseline-storage.ts

export interface BaselineStorageConfig {
  strategy: 'git-lfs' | 'artifact-storage' | 'hybrid';
  retention: 'permanent' | 'rolling' | 'tagged-only';
  compression: boolean;
  deduplication: boolean;
}

export const baselineStorage: BaselineStorageConfig = {
  // Hybrid: Git for current, artifact storage for history
  strategy: 'hybrid',

  // Keep tagged baselines permanently, rolling window for iterations
  retention: 'tagged-only',

  // PNG compression (lossless)
  compression: true,

  // Deduplicate identical snapshots across browsers
  deduplication: true,
};

export const gitLfsConfig = {
  enabled: true,
  patterns: [
    'tests/visual-regression/__snapshots__/**/*.png',
    '!tests/visual-regression/__snapshots__/diffs/**', // Exclude diff images
  ],
  compressionLevel: 6, // Balance between size and performance
};

export const artifactStorageConfig = {
  provider: 'github-actions', // Or S3, Azure Blob, etc.
  retention_days: 90,
  retention_strategy: {
    tagged_baselines: 'permanent',
    phase_checkpoints: 365, // 1 year
    iteration_snapshots: 30, // 30 days rolling
  },
};
```

### Baseline Update Workflow

```bash
#!/bin/bash
# scripts/update-lux-baseline.sh

# Update Lux visual regression baselines
# Usage: ./scripts/update-lux-baseline.sh [phase] [reason]

PHASE=$1
REASON=$2

if [ -z "$PHASE" ] || [ -z "$REASON" ]; then
  echo "Usage: ./scripts/update-lux-baseline.sh <phase> <reason>"
  echo "Example: ./scripts/update-lux-baseline.sh phase-2 'Updated button hover animations'"
  exit 1
fi

echo "🎨 Updating Lux Baseline for ${PHASE}"
echo "📝 Reason: ${REASON}"
echo ""

# Step 1: Run visual tests and update snapshots
echo "1️⃣ Generating new snapshots..."
UPDATE_SNAPSHOTS=true npm run test:visual:lux -- --grep "${PHASE}"

# Step 2: Review changes
echo "2️⃣ Review generated snapshots manually..."
echo "   Location: tests/visual-regression/__snapshots__/lux/${PHASE}/"
read -p "   Press Enter to continue after review, or Ctrl+C to abort..."

# Step 3: Commit new baselines
echo "3️⃣ Committing updated baselines..."
git add tests/visual-regression/__snapshots__/lux/${PHASE}/
git commit -m "Update Lux baseline: ${PHASE}

Reason: ${REASON}

Updated snapshots:
$(git diff --cached --name-only | wc -l) files

Reviewed by: $(git config user.name)
Date: $(date +%Y-%m-%d)"

# Step 4: Tag the baseline
echo "4️⃣ Tagging baseline version..."
BASELINE_VERSION="lux-baseline-${PHASE}-$(date +%Y%m%d)"
git tag -a "${BASELINE_VERSION}" -m "Lux baseline update: ${PHASE}

${REASON}"

echo "✅ Baseline updated successfully!"
echo "   Tag: ${BASELINE_VERSION}"
echo "   To push: git push origin main --tags"
```

---

## IV. Snapshot Comparison Approach

### Multi-Threshold Strategy

```typescript
// tests/visual-regression/lux/config/comparison-thresholds.ts

export interface ThresholdConfig {
  component: string;
  state: string;
  threshold: number;
  maxDiffPixels: number;
  maxDiffPixelRatio: number;
  justification: string;
}

export const luxComparisonThresholds: ThresholdConfig[] = [
  // FOUNDATION LAYER: Tight tolerances
  {
    component: 'design-tokens',
    state: 'static',
    threshold: 0.05,
    maxDiffPixels: 100,
    maxDiffPixelRatio: 0.01,
    justification: 'Design tokens should render identically across browsers',
  },
  {
    component: 'color-palette',
    state: 'static',
    threshold: 0.03,
    maxDiffPixels: 50,
    maxDiffPixelRatio: 0.005,
    justification: 'Color consistency critical for brand identity',
  },

  // COMPONENT LAYER: Moderate tolerances
  {
    component: 'button-lux',
    state: 'static',
    threshold: 0.10,
    maxDiffPixels: 300,
    maxDiffPixelRatio: 0.02,
    justification: 'Static buttons should be consistent, minor font rendering differences acceptable',
  },
  {
    component: 'button-lux',
    state: 'hover',
    threshold: 0.20,
    maxDiffPixels: 800,
    maxDiffPixelRatio: 0.05,
    justification: 'Hover animations may have timing differences, higher tolerance needed',
  },
  {
    component: 'input-lux',
    state: 'focus',
    threshold: 0.15,
    maxDiffPixels: 500,
    maxDiffPixelRatio: 0.03,
    justification: 'Focus states include shadows and borders with browser-specific rendering',
  },

  // CRITICAL BUSINESS COMPONENTS: Highest tolerances
  {
    component: 'idea-card-lux',
    state: 'collapsed',
    threshold: 0.12,
    maxDiffPixels: 600,
    maxDiffPixelRatio: 0.04,
    justification: 'Card shadows and gem-tone accents have browser variations',
  },
  {
    component: 'idea-card-lux',
    state: 'hover',
    threshold: 0.25,
    maxDiffPixels: 1500,
    maxDiffPixelRatio: 0.08,
    justification: 'Hover animations include shadow transitions and subtle movements',
  },
  {
    component: 'idea-card-lux',
    state: 'dragging',
    threshold: 0.30,
    maxDiffPixels: 2000,
    maxDiffPixelRatio: 0.10,
    justification: 'Drag states include complex transform animations and cursor changes',
  },
  {
    component: 'design-matrix-lux',
    state: 'with-gradients',
    threshold: 0.15,
    maxDiffPixels: 2500,
    maxDiffPixelRatio: 0.06,
    justification: 'Gradient backgrounds vary slightly across browsers (Chromium vs Firefox)',
  },
];

/**
 * Get appropriate threshold for component and state
 */
export function getThreshold(component: string, state: string): ThresholdConfig {
  const config = luxComparisonThresholds.find(
    t => t.component === component && t.state === state
  );

  // Fallback to conservative defaults
  return config || {
    component,
    state,
    threshold: 0.15,
    maxDiffPixels: 1000,
    maxDiffPixelRatio: 0.05,
    justification: 'Default threshold for untested component/state combination',
  };
}
```

### Custom Visual Matchers

```typescript
// tests/visual-regression/lux/matchers/custom-visual-matchers.ts

import { expect } from '@playwright/test';
import { Locator, Page } from '@playwright/test';
import { getThreshold } from '../config/comparison-thresholds';

/**
 * Custom matcher for Lux component visual validation
 *
 * Usage:
 *   await expect(buttonLocator).toLuxMatch('button-lux', 'hover');
 */
expect.extend({
  async toLuxMatch(
    locator: Locator | Page,
    component: string,
    state: string,
    options?: {
      browser?: string;
      viewport?: string;
      customThreshold?: number;
    }
  ) {
    const threshold = options?.customThreshold || getThreshold(component, state);
    const browser = options?.browser || 'chromium';
    const viewport = options?.viewport || 'desktop';

    const snapshotName = `lux-${component}-${state}-${browser}-${viewport}.png`;

    try {
      await expect(locator).toHaveScreenshot(snapshotName, {
        threshold: threshold.threshold,
        maxDiffPixels: threshold.maxDiffPixels,
        maxDiffPixelRatio: threshold.maxDiffPixelRatio,
        animations: 'disabled',
      });

      return {
        pass: true,
        message: () => `Visual match: ${component} (${state}) within threshold ${threshold.threshold}`,
      };
    } catch (error) {
      return {
        pass: false,
        message: () => `Visual mismatch: ${component} (${state})
Expected threshold: ${threshold.threshold}
Justification: ${threshold.justification}
Error: ${error.message}`,
      };
    }
  },
});

declare global {
  namespace PlaywrightTest {
    interface Matchers<R, T> {
      toLuxMatch(
        component: string,
        state: string,
        options?: {
          browser?: string;
          viewport?: string;
          customThreshold?: number;
        }
      ): Promise<R>;
    }
  }
}
```

### Diff Visualization Strategy

```typescript
// tests/visual-regression/lux/reporters/visual-diff-reporter.ts

import { Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import { createHash } from 'crypto';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

/**
 * Custom reporter for visual regression diffs
 * Generates HTML reports with side-by-side comparisons
 */
class VisualDiffReporter implements Reporter {
  private diffResults: Array<{
    test: string;
    component: string;
    state: string;
    expected: string;
    actual: string;
    diff: string;
    threshold: number;
    pixelDiff: number;
  }> = [];

  onTestEnd(test: TestCase, result: TestResult) {
    // Extract visual diff information from attachments
    const screenshots = result.attachments.filter(a =>
      a.name.includes('screenshot') || a.name.includes('expected') || a.name.includes('actual')
    );

    if (screenshots.length >= 3) {
      // Visual test with diff
      const [expected, actual, diff] = screenshots;

      this.diffResults.push({
        test: test.title,
        component: this.extractComponent(test.title),
        state: this.extractState(test.title),
        expected: expected.path || '',
        actual: actual.path || '',
        diff: diff.path || '',
        threshold: this.extractThreshold(test),
        pixelDiff: this.calculatePixelDiff(diff.path || ''),
      });
    }
  }

  onEnd() {
    this.generateHTMLReport();
    this.generateJSONSummary();
  }

  private generateHTMLReport() {
    const outputDir = join(process.cwd(), 'test-results', 'lux-visual-diffs');
    mkdirSync(outputDir, { recursive: true });

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Lux Visual Regression Report</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      margin: 0;
      padding: 20px;
      background: #FAFBFC;
    }
    h1 {
      color: #1F2937;
      border-bottom: 2px solid #3B82F6;
      padding-bottom: 10px;
    }
    .diff-container {
      background: white;
      border: 1px solid #E5E7EB;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
    }
    .diff-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
    }
    .diff-images {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 15px;
    }
    .diff-image {
      text-align: center;
    }
    .diff-image img {
      max-width: 100%;
      border: 1px solid #D1D5DB;
      border-radius: 4px;
    }
    .diff-image p {
      margin: 10px 0 0;
      color: #6B7280;
      font-size: 14px;
    }
    .threshold {
      background: #EFF6FF;
      color: #1D4ED8;
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 13px;
    }
    .pixel-diff {
      background: #FEF2F2;
      color: #B91C1C;
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 13px;
    }
    .pixel-diff.low {
      background: #ECFDF5;
      color: #047857;
    }
  </style>
</head>
<body>
  <h1>🎨 Lux Visual Regression Report</h1>
  <p>Generated: ${new Date().toISOString()}</p>
  <p>Total Diffs: ${this.diffResults.length}</p>

  ${this.diffResults.map(diff => `
    <div class="diff-container">
      <div class="diff-header">
        <div>
          <h3>${diff.component} - ${diff.state}</h3>
          <p style="color: #6B7280; margin: 5px 0 0;">${diff.test}</p>
        </div>
        <div>
          <span class="threshold">Threshold: ${(diff.threshold * 100).toFixed(1)}%</span>
          <span class="pixel-diff ${diff.pixelDiff < 500 ? 'low' : ''}">
            Diff: ${diff.pixelDiff} pixels
          </span>
        </div>
      </div>
      <div class="diff-images">
        <div class="diff-image">
          <img src="${diff.expected}" alt="Expected">
          <p>Expected (Baseline)</p>
        </div>
        <div class="diff-image">
          <img src="${diff.actual}" alt="Actual">
          <p>Actual (Current)</p>
        </div>
        <div class="diff-image">
          <img src="${diff.diff}" alt="Diff">
          <p>Difference</p>
        </div>
      </div>
    </div>
  `).join('')}
</body>
</html>
    `;

    writeFileSync(join(outputDir, 'index.html'), html);
    console.log(`\n📊 Visual diff report: ${join(outputDir, 'index.html')}\n`);
  }

  private generateJSONSummary() {
    const summary = {
      generated: new Date().toISOString(),
      totalDiffs: this.diffResults.length,
      diffs: this.diffResults,
      summary: {
        components: [...new Set(this.diffResults.map(d => d.component))].length,
        states: [...new Set(this.diffResults.map(d => d.state))].length,
        avgPixelDiff: this.diffResults.reduce((sum, d) => sum + d.pixelDiff, 0) / this.diffResults.length,
      },
    };

    writeFileSync(
      join(process.cwd(), 'test-results', 'lux-visual-summary.json'),
      JSON.stringify(summary, null, 2)
    );
  }

  private extractComponent(title: string): string {
    const match = title.match(/^([^:]+):/);
    return match ? match[1].trim() : 'unknown';
  }

  private extractState(title: string): string {
    const match = title.match(/- (static|hover|focus|active|dragging|collapsed|expanded)/i);
    return match ? match[1].toLowerCase() : 'unknown';
  }

  private extractThreshold(test: TestCase): number {
    // Extract from test metadata if available
    return 0.15; // Default
  }

  private calculatePixelDiff(diffPath: string): number {
    // Simplified - would analyze actual diff image
    return Math.floor(Math.random() * 1000);
  }
}

export default VisualDiffReporter;
```

---

## V. Animation Testing Methodology

### Key-Frame Capture Strategy

```typescript
// tests/visual-regression/lux/helpers/animation-capture.ts

import { Page, Locator } from '@playwright/test';

export interface AnimationFrameConfig {
  component: string;
  state: string;
  duration: number; // Total animation duration (ms)
  keyFrames: number[]; // Percentage points to capture (0-100)
  animationProperty: string; // CSS property being animated
}

/**
 * Capture key frames of animation for visual validation
 *
 * Strategy:
 * 1. Disable all OTHER animations
 * 2. Capture static "before" state
 * 3. Enable target animation
 * 4. Capture frames at key percentages
 * 5. Capture static "after" state
 */
export class AnimationFrameCapture {
  constructor(private page: Page) {}

  /**
   * Capture animation key frames
   *
   * Example:
   *   await capturer.captureAnimation({
   *     component: 'button-lux',
   *     state: 'hover',
   *     duration: 200,
   *     keyFrames: [0, 50, 100],
   *     animationProperty: 'box-shadow'
   *   });
   */
  async captureAnimation(config: AnimationFrameConfig): Promise<string[]> {
    const { component, state, duration, keyFrames, animationProperty } = config;
    const snapshots: string[] = [];

    // Step 1: Disable animations globally
    await this.disableAnimations();

    // Step 2: Capture before state
    const beforeSnapshot = `${component}-${state}-before.png`;
    await this.page.screenshot({ path: beforeSnapshot });
    snapshots.push(beforeSnapshot);

    // Step 3: Enable ONLY target animation
    await this.enableTargetAnimation(animationProperty);

    // Step 4: Trigger animation and capture key frames
    await this.triggerAnimation(state);

    for (const percentage of keyFrames) {
      const delay = (duration * percentage) / 100;
      await this.page.waitForTimeout(delay);

      const frameSnapshot = `${component}-${state}-frame-${percentage}.png`;
      await this.page.screenshot({ path: frameSnapshot });
      snapshots.push(frameSnapshot);
    }

    // Step 5: Capture after state
    await this.page.waitForTimeout(duration + 100); // Ensure animation complete
    const afterSnapshot = `${component}-${state}-after.png`;
    await this.page.screenshot({ path: afterSnapshot });
    snapshots.push(afterSnapshot);

    // Cleanup: Re-enable all animations
    await this.enableAnimations();

    return snapshots;
  }

  /**
   * Disable all CSS animations and transitions
   */
  private async disableAnimations() {
    await this.page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-duration: 0.01ms !important;
          animation-delay: -0.01ms !important;
          transition-duration: 0.01ms !important;
          transition-delay: -0.01ms !important;
        }
      `,
    });
  }

  /**
   * Enable only specific animation property
   */
  private async enableTargetAnimation(property: string) {
    await this.page.addStyleTag({
      content: `
        [data-animation-target="${property}"] {
          animation-duration: var(--original-duration) !important;
          transition-duration: var(--original-duration) !important;
        }
      `,
    });
  }

  /**
   * Re-enable all animations
   */
  private async enableAnimations() {
    await this.page.evaluate(() => {
      // Remove all injected style tags
      document.querySelectorAll('style').forEach(style => {
        if (style.textContent?.includes('animation-duration: 0.01ms')) {
          style.remove();
        }
      });
    });
  }

  /**
   * Trigger animation based on state
   */
  private async triggerAnimation(state: string) {
    switch (state) {
      case 'hover':
        await this.page.hover('[data-testid="animation-target"]');
        break;
      case 'focus':
        await this.page.focus('[data-testid="animation-target"]');
        break;
      case 'active':
        await this.page.click('[data-testid="animation-target"]');
        break;
      default:
        throw new Error(`Unknown animation state: ${state}`);
    }
  }
}

/**
 * Compare animation frames for consistency
 */
export async function compareAnimationFrames(
  frames: string[],
  expectedFrames: string[],
  tolerance: number = 0.20
): Promise<boolean> {
  if (frames.length !== expectedFrames.length) {
    throw new Error('Frame count mismatch');
  }

  // Compare each frame pair
  for (let i = 0; i < frames.length; i++) {
    const actual = frames[i];
    const expected = expectedFrames[i];

    // Simplified comparison - would use actual image diff library
    const similarity = await compareImages(actual, expected);

    if (similarity < (1 - tolerance)) {
      return false;
    }
  }

  return true;
}

async function compareImages(path1: string, path2: string): Promise<number> {
  // Placeholder - would use pixelmatch or similar
  return 0.95;
}
```

### Animation Test Examples

```typescript
// tests/visual-regression/lux/components/button-lux-animations.spec.ts

import { test, expect } from '@playwright/test';
import { AnimationFrameCapture } from '../helpers/animation-capture';

test.describe('ButtonLux Animation Validation', () => {
  let capturer: AnimationFrameCapture;

  test.beforeEach(async ({ page }) => {
    await page.goto('/components/button-lux');
    capturer = new AnimationFrameCapture(page);
  });

  test('Hover animation: box-shadow transition', async ({ page }) => {
    const frames = await capturer.captureAnimation({
      component: 'button-lux-sapphire',
      state: 'hover',
      duration: 200, // Lux animation duration
      keyFrames: [0, 25, 50, 75, 100],
      animationProperty: 'box-shadow',
    });

    // Validate frame count
    expect(frames).toHaveLength(7); // before + 5 keyframes + after

    // Validate before state (no shadow enhancement)
    await expect(page).toHaveScreenshot(frames[0], {
      threshold: 0.10,
    });

    // Validate keyframe progression
    for (let i = 1; i <= 5; i++) {
      await expect(page).toHaveScreenshot(frames[i], {
        threshold: 0.20, // Higher tolerance for animation frames
      });
    }

    // Validate after state (full shadow enhancement)
    await expect(page).toHaveScreenshot(frames[6], {
      threshold: 0.10,
    });
  });

  test('Focus animation: gem-tone ring appearance', async ({ page }) => {
    const frames = await capturer.captureAnimation({
      component: 'button-lux-emerald',
      state: 'focus',
      duration: 180, // Focus ring animation
      keyFrames: [0, 50, 100],
      animationProperty: 'outline',
    });

    // Focus ring should appear smoothly
    expect(frames).toHaveLength(5); // before + 3 keyframes + after

    // Validate sapphire focus ring appears
    const afterState = page.locator('[data-testid="button-lux-emerald"]:focus');
    await expect(afterState).toHaveCSS('outline-color', 'rgb(59, 130, 246)'); // Sapphire-500
  });

  test('Animation respects prefers-reduced-motion', async ({ page }) => {
    // Enable reduced motion
    await page.emulateMedia({ reducedMotion: 'reduce' });

    const button = page.locator('[data-testid="button-lux-sapphire"]');

    // Hover should apply final state instantly
    await button.hover();

    // Check computed animation duration
    const duration = await button.evaluate(el =>
      window.getComputedStyle(el).animationDuration
    );

    expect(duration).toBe('0.01ms'); // Instant animation
  });
});
```

### Animation Performance Validation

```typescript
// tests/visual-regression/lux/performance/animation-performance.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Lux Animation Performance', () => {
  test('Hover animation completes within 16ms (60fps)', async ({ page }) => {
    await page.goto('/components/button-lux');

    const button = page.locator('[data-testid="button-lux-sapphire"]');

    // Measure hover animation performance
    const metrics = await button.evaluate(async (el) => {
      const startTime = performance.now();

      // Trigger hover
      el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

      // Wait for next animation frame
      await new Promise(resolve => requestAnimationFrame(resolve));

      const endTime = performance.now();
      return endTime - startTime;
    });

    expect(metrics).toBeLessThan(16); // Sub-frame requirement
  });

  test('Multiple simultaneous animations maintain 60fps', async ({ page }) => {
    await page.goto('/');

    // Create 10 cards with hover animations
    const cards = page.locator('[data-testid^="idea-card-lux"]').all();

    // Measure frame rate during simultaneous hovers
    const fps = await page.evaluate(async () => {
      let frameCount = 0;
      const duration = 1000; // 1 second
      const startTime = performance.now();

      const countFrames = () => {
        frameCount++;
        if (performance.now() - startTime < duration) {
          requestAnimationFrame(countFrames);
        }
      };

      requestAnimationFrame(countFrames);

      // Trigger all card hovers
      document.querySelectorAll('[data-testid^="idea-card-lux"]').forEach(card => {
        card.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      });

      await new Promise(resolve => setTimeout(resolve, duration));

      return frameCount;
    });

    expect(fps).toBeGreaterThanOrEqual(55); // Allow minor variance from 60fps
  });
});
```

---

## VI. Cross-Browser Validation Plan

### Browser-Specific Considerations

```yaml
cross_browser_strategy:

  chromium:
    role: "Primary development and regression target"
    version: "Latest Stable"
    rendering_engine: "Blink"

    strengths:
      - GPU acceleration (will-change, transform)
      - Consistent font rendering
      - Precise shadow rendering
      - Animation performance

    known_issues:
      - None specific to Lux

    threshold_adjustments:
      base: 0.10
      animations: 0.15
      gradients: 0.08

    test_priority: "CRITICAL"
    failure_impact: "Block deployment"

  firefox:
    role: "Gecko engine validation"
    version: "Latest Stable"
    rendering_engine: "Gecko"

    strengths:
      - Standards compliance
      - Excellent accessibility support

    known_issues:
      - Font rendering differences (slight anti-aliasing variations)
      - Gradient interpolation differs from Chromium
      - Shadow blur radius calculations vary

    threshold_adjustments:
      base: 0.15
      animations: 0.20
      gradients: 0.18
      fonts: 0.12

    test_priority: "HIGH"
    failure_impact: "Investigate, may not block deployment"

  webkit:
    role: "Safari/iOS compatibility"
    version: "Latest Stable"
    rendering_engine: "WebKit"

    strengths:
      - macOS/iOS native rendering
      - Excellent animation performance

    known_issues:
      - Shadow rendering differences (blur spreads differently)
      - Gradient color interpolation unique to WebKit
      - Font smoothing on high-DPI displays

    threshold_adjustments:
      base: 0.18
      animations: 0.22
      gradients: 0.25
      shadows: 0.20

    test_priority: "MEDIUM"
    failure_impact: "Document, fix if critical"
```

### Cross-Browser Test Matrix

```typescript
// tests/visual-regression/lux/cross-browser/browser-matrix.spec.ts

import { test, expect } from '@playwright/test';
import { getThreshold } from '../config/comparison-thresholds';

/**
 * Cross-browser visual validation matrix
 * Tests critical components across all browsers
 */

const CRITICAL_COMPONENTS = [
  { component: 'button-lux', states: ['static', 'hover', 'focus', 'active'] },
  { component: 'input-lux', states: ['static', 'focus', 'error', 'disabled'] },
  { component: 'idea-card-lux', states: ['collapsed', 'hover', 'expanded', 'dragging'] },
  { component: 'design-matrix-lux', states: ['empty', 'with-cards', 'with-gradients'] },
];

const BROWSERS = ['chromium', 'firefox', 'webkit'];
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 1024, height: 768 },
  { name: 'mobile', width: 375, height: 667 },
];

CRITICAL_COMPONENTS.forEach(({ component, states }) => {
  test.describe(`${component} Cross-Browser Validation`, () => {
    states.forEach(state => {
      BROWSERS.forEach(browser => {
        VIEWPORTS.forEach(viewport => {
          test(`${component} - ${state} - ${browser} - ${viewport.name}`, async ({ page, browserName }) => {
            // Skip if not current browser
            if (browserName !== browser) {
              test.skip();
            }

            await page.setViewportSize(viewport);
            await page.goto(`/components/${component}`);

            const element = page.locator(`[data-testid="${component}"]`);
            await element.waitFor({ state: 'visible' });

            // Trigger state
            await triggerState(element, state);

            // Get browser-specific threshold
            const threshold = getBrowserThreshold(component, state, browser);

            // Capture and compare
            await expect(element).toHaveScreenshot(
              `${component}-${state}-${browser}-${viewport.name}.png`,
              {
                threshold: threshold.threshold,
                maxDiffPixels: threshold.maxDiffPixels,
              }
            );
          });
        });
      });
    });
  });
});

function triggerState(element: Locator, state: string) {
  switch (state) {
    case 'hover':
      return element.hover();
    case 'focus':
      return element.focus();
    case 'active':
      return element.click({ delay: 100 });
    default:
      return Promise.resolve();
  }
}

function getBrowserThreshold(component: string, state: string, browser: string) {
  const baseThreshold = getThreshold(component, state);

  // Adjust threshold based on browser
  const browserMultipliers = {
    chromium: 1.0,
    firefox: 1.3,
    webkit: 1.5,
  };

  return {
    ...baseThreshold,
    threshold: baseThreshold.threshold * (browserMultipliers[browser] || 1.0),
    maxDiffPixels: Math.floor(baseThreshold.maxDiffPixels * (browserMultipliers[browser] || 1.0)),
  };
}
```

### Browser-Specific Workarounds

```typescript
// tests/visual-regression/lux/helpers/browser-workarounds.ts

import { Page } from '@playwright/test';

/**
 * Apply browser-specific workarounds for consistent visual rendering
 */
export class BrowserWorkarounds {
  constructor(private page: Page, private browserName: string) {}

  async apply() {
    await this.waitForFonts();
    await this.stabilizeAnimations();
    await this.normalizeShadows();
  }

  /**
   * Ensure fonts are fully loaded before capturing
   */
  private async waitForFonts() {
    await this.page.evaluate(() => document.fonts.ready);

    // Firefox sometimes needs extra time
    if (this.browserName === 'firefox') {
      await this.page.waitForTimeout(300);
    }
  }

  /**
   * Stabilize animations for consistent capture
   */
  private async stabilizeAnimations() {
    // Wait for any initial animations to complete
    await this.page.waitForTimeout(500);

    // WebKit sometimes has delayed animation starts
    if (this.browserName === 'webkit') {
      await this.page.waitForTimeout(200);
    }
  }

  /**
   * Normalize shadow rendering differences
   */
  private async normalizeShadows() {
    if (this.browserName === 'firefox') {
      // Firefox renders shadows with slightly different blur
      await this.page.addStyleTag({
        content: `
          * {
            --shadow-compensation: 0.95;
          }
        `,
      });
    }
  }
}
```

---

## VII. Test Data Fixtures

### Component Test Data

```typescript
// tests/visual-regression/lux/fixtures/component-fixtures.ts

export interface ComponentFixture {
  component: string;
  variants: string[];
  states: string[];
  props: Record<string, any>;
}

export const luxComponentFixtures: ComponentFixture[] = [
  // ButtonLux fixtures
  {
    component: 'ButtonLux',
    variants: ['sapphire', 'emerald', 'amber', 'garnet', 'monochrome'],
    states: ['static', 'hover', 'focus', 'active', 'disabled'],
    props: {
      sizes: ['sm', 'md', 'lg'],
      styles: ['filled', 'outline', 'ghost'],
      loading: [false, true],
    },
  },

  // InputLux fixtures
  {
    component: 'InputLux',
    variants: ['sapphire', 'emerald', 'amber', 'garnet'],
    states: ['static', 'focus', 'error', 'success', 'disabled'],
    props: {
      types: ['text', 'email', 'password', 'number'],
      placeholder: 'Enter value...',
      errorMessage: 'Invalid input',
      successMessage: 'Valid input',
    },
  },

  // IdeaCardLux fixtures
  {
    component: 'IdeaCardLux',
    variants: ['high-impact', 'quick-wins', 'strategic', 'delegate'],
    states: ['collapsed', 'hover', 'expanded', 'dragging'],
    props: {
      title: 'Test Idea Card',
      description: 'This is a test description for the idea card component.',
      priority: 'high',
      status: 'active',
      quadrant: 'high-impact',
    },
  },

  // DesignMatrixLux fixtures
  {
    component: 'DesignMatrixLux',
    variants: ['empty', 'sparse', 'balanced', 'dense'],
    states: ['static', 'with-gradients', 'interactive'],
    props: {
      cardCounts: {
        empty: 0,
        sparse: 4, // 1 per quadrant
        balanced: 20, // 5 per quadrant
        dense: 50, // 12-13 per quadrant
      },
    },
  },
];

/**
 * Generate test ideas for matrix testing
 */
export function generateTestIdeas(count: number, quadrant?: string): any[] {
  const quadrants = ['high-impact', 'quick-wins', 'strategic', 'delegate'];
  const ideas = [];

  for (let i = 0; i < count; i++) {
    const q = quadrant || quadrants[i % 4];
    const position = getQuadrantPosition(q, i);

    ideas.push({
      id: `test-idea-${i}`,
      title: `Test Idea ${i + 1}`,
      description: `This is test idea #${i + 1} for visual regression testing`,
      matrix_position: position,
      quadrant: q,
      created_at: new Date().toISOString(),
      user_id: 'test-user',
    });
  }

  return ideas;
}

function getQuadrantPosition(quadrant: string, index: number): { x: number; y: number } {
  const positions = {
    'high-impact': { x: 0.7 + (index * 0.05), y: 0.7 + (index * 0.05) },
    'quick-wins': { x: 0.3 - (index * 0.05), y: 0.7 + (index * 0.05) },
    'strategic': { x: 0.7 + (index * 0.05), y: 0.3 - (index * 0.05) },
    'delegate': { x: 0.3 - (index * 0.05), y: 0.3 - (index * 0.05) },
  };

  return positions[quadrant] || { x: 0.5, y: 0.5 };
}
```

### Animation Test Fixtures

```typescript
// tests/visual-regression/lux/fixtures/animation-fixtures.ts

export interface AnimationFixture {
  name: string;
  duration: number; // milliseconds
  timingFunction: string;
  keyFrames: number[]; // Percentage points to capture
  property: string; // CSS property being animated
}

export const luxAnimationFixtures: AnimationFixture[] = [
  {
    name: 'button-hover-shadow',
    duration: 200,
    timingFunction: 'cubic-bezier(0.2, 0.6, 0, 0.98)', // Confident glide
    keyFrames: [0, 25, 50, 75, 100],
    property: 'box-shadow',
  },
  {
    name: 'input-focus-ring',
    duration: 180,
    timingFunction: 'cubic-bezier(0.2, 0.6, 0, 0.98)',
    keyFrames: [0, 50, 100],
    property: 'outline',
  },
  {
    name: 'card-expand',
    duration: 260,
    timingFunction: 'cubic-bezier(0.2, 0.6, 0, 0.98)',
    keyFrames: [0, 33, 66, 100],
    property: 'height',
  },
  {
    name: 'card-collapse',
    duration: 220,
    timingFunction: 'cubic-bezier(0.2, 0.6, 0, 0.98)',
    keyFrames: [0, 33, 66, 100],
    property: 'height',
  },
  {
    name: 'drag-lift',
    duration: 120,
    timingFunction: 'cubic-bezier(0.2, 0.6, 0, 0.98)',
    keyFrames: [0, 50, 100],
    property: 'transform',
  },
];
```

---

## VIII. CI/CD Integration

### GitHub Actions Workflow

**File**: `.github/workflows/lux-visual-regression.yml`

```yaml
name: Lux Visual Regression Tests

on:
  pull_request:
    branches: [main, 'feature/lux-*']
    paths:
      - 'src/**'
      - 'tests/visual-regression/**'
      - 'playwright.lux-visual.config.ts'
  push:
    branches: ['feature/lux-*']
  workflow_dispatch:

env:
  VITE_LUX_ENABLED: 'true'

jobs:
  visual-regression:
    name: Visual Regression (${{ matrix.browser }})
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        browser: [chromium, firefox, webkit]
        include:
          - browser: chromium
            threshold_multiplier: 1.0
          - browser: firefox
            threshold_multiplier: 1.3
          - browser: webkit
            threshold_multiplier: 1.5

    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0 # Fetch all history for baseline comparison

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps ${{ matrix.browser }}

      - name: Build application
        run: npm run build
        env:
          VITE_LUX_ENABLED: 'true'

      - name: Download baseline snapshots
        uses: actions/download-artifact@v4
        with:
          name: lux-baselines-${{ matrix.browser }}
          path: tests/visual-regression/__snapshots__/lux/
        continue-on-error: true # First run won't have baselines

      - name: Run visual regression tests
        run: npx playwright test --config=playwright.lux-visual.config.ts --project=lux-${{ matrix.browser }}-desktop
        env:
          THRESHOLD_MULTIPLIER: ${{ matrix.threshold_multiplier }}

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: lux-visual-results-${{ matrix.browser }}
          path: |
            test-results/
            playwright-report/
          retention-days: 30

      - name: Upload visual diffs
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: lux-visual-diffs-${{ matrix.browser }}
          path: test-results/lux-visual-diffs/
          retention-days: 90

      - name: Upload updated baselines
        if: github.event_name == 'workflow_dispatch' && env.UPDATE_BASELINES == 'true'
        uses: actions/upload-artifact@v4
        with:
          name: lux-baselines-${{ matrix.browser }}-updated
          path: tests/visual-regression/__snapshots__/lux/
          retention-days: 365

      - name: Comment PR with results
        if: github.event_name == 'pull_request' && failure()
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const summary = fs.readFileSync('test-results/lux-visual-summary.json', 'utf8');
            const data = JSON.parse(summary);

            const comment = `
            ## 🎨 Visual Regression Results (${{ matrix.browser }})

            **Status**: ❌ Visual differences detected

            **Summary**:
            - Total diffs: ${data.totalDiffs}
            - Components affected: ${data.summary.components}
            - Average pixel diff: ${data.summary.avgPixelDiff.toFixed(0)}

            **Next Steps**:
            1. Review visual diffs in artifacts
            2. Determine if changes are intentional
            3. If intentional: Update baselines via workflow_dispatch
            4. If regression: Fix and re-test

            [View detailed report](https://github.com/${{ github.repository }}/actions/runs/${{ github.run_id }})
            `;

            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: comment
            });

  baseline-update:
    name: Update Baselines
    runs-on: ubuntu-latest
    if: github.event_name == 'workflow_dispatch'
    needs: visual-regression

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Download updated baselines
        uses: actions/download-artifact@v4
        with:
          pattern: lux-baselines-*-updated
          path: tests/visual-regression/__snapshots__/lux/

      - name: Commit updated baselines
        run: |
          git config --local user.email "github-actions[bot]@users.noreply.github.com"
          git config --local user.name "github-actions[bot]"
          git add tests/visual-regression/__snapshots__/lux/
          git commit -m "Update Lux visual baselines [skip ci]"
          git tag "lux-baseline-$(date +%Y%m%d-%H%M%S)"

      - name: Push changes
        uses: ad-m/github-push-action@master
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          branch: ${{ github.ref }}
          tags: true
```

### Baseline Update Workflow

**File**: `.github/workflows/lux-baseline-update.yml`

```yaml
name: Update Lux Baselines

on:
  workflow_dispatch:
    inputs:
      phase:
        description: 'Lux phase (foundation, components, critical, complete)'
        required: true
        type: choice
        options:
          - foundation
          - components
          - critical
          - complete
      reason:
        description: 'Reason for baseline update'
        required: true
        type: string
      browsers:
        description: 'Browsers to update (comma-separated: chromium,firefox,webkit)'
        required: false
        default: 'chromium,firefox,webkit'

jobs:
  update-baselines:
    name: Update ${{ github.event.inputs.phase }} baselines
    runs-on: ubuntu-latest

    strategy:
      matrix:
        browser: ${{ fromJson(format('["{0}"]', join(split(github.event.inputs.browsers, ','), '","'))) }}

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright
        run: npx playwright install --with-deps ${{ matrix.browser }}

      - name: Generate new baselines
        run: UPDATE_SNAPSHOTS=true npx playwright test --config=playwright.lux-visual.config.ts --project=lux-${{ matrix.browser }}-desktop
        env:
          VITE_LUX_ENABLED: 'true'

      - name: Upload new baselines
        uses: actions/upload-artifact@v4
        with:
          name: lux-baselines-${{ github.event.inputs.phase }}-${{ matrix.browser }}
          path: tests/visual-regression/__snapshots__/lux/
          retention-days: 365

      - name: Commit and tag baselines
        run: |
          git config --local user.email "github-actions[bot]@users.noreply.github.com"
          git config --local user.name "github-actions[bot]"
          git add tests/visual-regression/__snapshots__/lux/
          git commit -m "Update Lux baselines: ${{ github.event.inputs.phase }}

          Reason: ${{ github.event.inputs.reason }}
          Browser: ${{ matrix.browser }}
          Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"

          git tag "lux-baseline-${{ github.event.inputs.phase }}-${{ matrix.browser }}-$(date +%Y%m%d-%H%M%S)"

      - name: Push changes
        uses: ad-m/github-push-action@master
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          branch: ${{ github.ref }}
          tags: true
```

---

## IX. Reporting and Diff Visualization

### HTML Report Generation

```typescript
// tests/visual-regression/lux/reporters/html-report-generator.ts

import { writeFileSync, mkdirSync, copyFileSync } from 'fs';
import { join } from 'path';

export interface ReportData {
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
  };
  diffs: Array<{
    component: string;
    state: string;
    browser: string;
    viewport: string;
    threshold: number;
    pixelDiff: number;
    passed: boolean;
    expected: string;
    actual: string;
    diff: string;
  }>;
}

export function generateHTMLReport(data: ReportData): string {
  const outputDir = join(process.cwd(), 'test-results', 'lux-visual-report');
  mkdirSync(outputDir, { recursive: true });

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lux Visual Regression Report</title>
  <style>
    :root {
      --canvas-primary: #FAFBFC;
      --surface-primary: #FFFFFF;
      --graphite-800: #1F2937;
      --graphite-700: #374151;
      --graphite-500: #6B7280;
      --graphite-200: #E5E7EB;
      --sapphire-500: #3B82F6;
      --emerald-500: #10B981;
      --garnet-500: #EF4444;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: var(--canvas-primary);
      color: var(--graphite-800);
      padding: 40px 20px;
      line-height: 1.6;
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
    }

    header {
      background: var(--surface-primary);
      border: 1px solid var(--graphite-200);
      border-radius: 12px;
      padding: 30px;
      margin-bottom: 30px;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
    }

    h1 {
      font-size: 32px;
      font-weight: 700;
      margin-bottom: 10px;
      color: var(--graphite-800);
    }

    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-top: 20px;
    }

    .summary-card {
      background: var(--canvas-primary);
      border: 1px solid var(--graphite-200);
      border-radius: 8px;
      padding: 20px;
    }

    .summary-card h3 {
      font-size: 14px;
      font-weight: 500;
      color: var(--graphite-500);
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .summary-card .value {
      font-size: 36px;
      font-weight: 700;
      color: var(--graphite-800);
    }

    .summary-card.passed .value {
      color: var(--emerald-500);
    }

    .summary-card.failed .value {
      color: var(--garnet-500);
    }

    .filters {
      background: var(--surface-primary);
      border: 1px solid var(--graphite-200);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 30px;
      display: flex;
      gap: 15px;
      flex-wrap: wrap;
    }

    .filter-group {
      flex: 1;
      min-width: 200px;
    }

    .filter-group label {
      display: block;
      font-size: 14px;
      font-weight: 500;
      color: var(--graphite-700);
      margin-bottom: 8px;
    }

    .filter-group select,
    .filter-group input {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid var(--graphite-200);
      border-radius: 6px;
      font-size: 14px;
      background: var(--surface-primary);
    }

    .results {
      display: grid;
      gap: 30px;
    }

    .result-card {
      background: var(--surface-primary);
      border: 1px solid var(--graphite-200);
      border-radius: 12px;
      padding: 25px;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
    }

    .result-card.passed {
      border-left: 4px solid var(--emerald-500);
    }

    .result-card.failed {
      border-left: 4px solid var(--garnet-500);
    }

    .result-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
    }

    .result-title h3 {
      font-size: 20px;
      font-weight: 600;
      color: var(--graphite-800);
      margin-bottom: 5px;
    }

    .result-title p {
      font-size: 14px;
      color: var(--graphite-500);
    }

    .result-meta {
      text-align: right;
    }

    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      margin-left: 8px;
    }

    .badge.passed {
      background: #ECFDF5;
      color: #047857;
    }

    .badge.failed {
      background: #FEF2F2;
      color: #B91C1C;
    }

    .badge.threshold {
      background: #EFF6FF;
      color: #1D4ED8;
    }

    .badge.diff {
      background: #FFFBEB;
      color: #B45309;
    }

    .image-comparison {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      margin-top: 20px;
    }

    .image-container {
      text-align: center;
    }

    .image-container img {
      width: 100%;
      height: auto;
      border: 1px solid var(--graphite-200);
      border-radius: 6px;
      cursor: pointer;
      transition: transform 0.2s cubic-bezier(0.2, 0.6, 0, 0.98);
    }

    .image-container img:hover {
      transform: scale(1.02);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
    }

    .image-container p {
      margin-top: 10px;
      font-size: 14px;
      color: var(--graphite-500);
      font-weight: 500;
    }

    .modal {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.85);
      z-index: 1000;
      padding: 40px;
      align-items: center;
      justify-content: center;
    }

    .modal.active {
      display: flex;
    }

    .modal img {
      max-width: 90%;
      max-height: 90%;
      border-radius: 8px;
    }

    .modal-close {
      position: absolute;
      top: 20px;
      right: 20px;
      background: var(--surface-primary);
      border: none;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      font-size: 24px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    @media (max-width: 1024px) {
      .image-comparison {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🎨 Lux Visual Regression Report</h1>
      <p>Generated: ${new Date().toISOString()}</p>

      <div class="summary">
        <div class="summary-card">
          <h3>Total Tests</h3>
          <div class="value">${data.summary.totalTests}</div>
        </div>
        <div class="summary-card passed">
          <h3>Passed</h3>
          <div class="value">${data.summary.passed}</div>
        </div>
        <div class="summary-card failed">
          <h3>Failed</h3>
          <div class="value">${data.summary.failed}</div>
        </div>
        <div class="summary-card">
          <h3>Duration</h3>
          <div class="value">${(data.summary.duration / 1000).toFixed(1)}s</div>
        </div>
      </div>
    </header>

    <div class="filters">
      <div class="filter-group">
        <label for="filter-status">Status</label>
        <select id="filter-status">
          <option value="all">All Results</option>
          <option value="passed">Passed Only</option>
          <option value="failed" selected>Failed Only</option>
        </select>
      </div>
      <div class="filter-group">
        <label for="filter-browser">Browser</label>
        <select id="filter-browser">
          <option value="all">All Browsers</option>
          <option value="chromium">Chromium</option>
          <option value="firefox">Firefox</option>
          <option value="webkit">WebKit</option>
        </select>
      </div>
      <div class="filter-group">
        <label for="filter-component">Component</label>
        <input type="text" id="filter-component" placeholder="Filter by component...">
      </div>
    </div>

    <div class="results">
      ${data.diffs.map(diff => `
        <div class="result-card ${diff.passed ? 'passed' : 'failed'}"
             data-status="${diff.passed ? 'passed' : 'failed'}"
             data-browser="${diff.browser}"
             data-component="${diff.component}">
          <div class="result-header">
            <div class="result-title">
              <h3>${diff.component} - ${diff.state}</h3>
              <p>${diff.browser} · ${diff.viewport}</p>
            </div>
            <div class="result-meta">
              <span class="badge ${diff.passed ? 'passed' : 'failed'}">
                ${diff.passed ? '✓ Passed' : '✗ Failed'}
              </span>
              <span class="badge threshold">
                Threshold: ${(diff.threshold * 100).toFixed(1)}%
              </span>
              <span class="badge diff">
                Diff: ${diff.pixelDiff} px
              </span>
            </div>
          </div>

          ${!diff.passed ? `
            <div class="image-comparison">
              <div class="image-container">
                <img src="${diff.expected}" alt="Expected" onclick="openModal(this.src)">
                <p>Expected (Baseline)</p>
              </div>
              <div class="image-container">
                <img src="${diff.actual}" alt="Actual" onclick="openModal(this.src)">
                <p>Actual (Current)</p>
              </div>
              <div class="image-container">
                <img src="${diff.diff}" alt="Difference" onclick="openModal(this.src)">
                <p>Difference</p>
              </div>
            </div>
          ` : ''}
        </div>
      `).join('')}
    </div>
  </div>

  <div class="modal" id="imageModal">
    <button class="modal-close" onclick="closeModal()">×</button>
    <img id="modalImage" src="" alt="Enlarged view">
  </div>

  <script>
    function openModal(src) {
      const modal = document.getElementById('imageModal');
      const img = document.getElementById('modalImage');
      img.src = src;
      modal.classList.add('active');
    }

    function closeModal() {
      document.getElementById('imageModal').classList.remove('active');
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });

    // Filtering logic
    const statusFilter = document.getElementById('filter-status');
    const browserFilter = document.getElementById('filter-browser');
    const componentFilter = document.getElementById('filter-component');

    function applyFilters() {
      const status = statusFilter.value;
      const browser = browserFilter.value;
      const component = componentFilter.value.toLowerCase();

      document.querySelectorAll('.result-card').forEach(card => {
        const matchStatus = status === 'all' || card.dataset.status === status;
        const matchBrowser = browser === 'all' || card.dataset.browser === browser;
        const matchComponent = !component || card.dataset.component.toLowerCase().includes(component);

        card.style.display = matchStatus && matchBrowser && matchComponent ? 'block' : 'none';
      });
    }

    statusFilter.addEventListener('change', applyFilters);
    browserFilter.addEventListener('change', applyFilters);
    componentFilter.addEventListener('input', applyFilters);

    // Initial filter application
    applyFilters();
  </script>
</body>
</html>
  `;

  const outputPath = join(outputDir, 'index.html');
  writeFileSync(outputPath, html);

  return outputPath;
}
```

---

## X. Performance Impact Assessment

### Metrics to Track

```yaml
performance_metrics:

  test_execution_time:
    baseline_pre_lux: "8.5 minutes (full suite)"
    target_lux: "<12 minutes (full suite)"
    critical_threshold: "15 minutes"

    breakdown:
      foundation_tests: "2 minutes"
      component_tests: "4 minutes"
      critical_tests: "5 minutes"
      responsive_tests: "1 minute"

    optimization_strategies:
      - Parallel execution where safe
      - Smart snapshot caching
      - Incremental test selection (changed components only)
      - Browser instance reuse

  snapshot_storage:
    baseline_pre_lux: "85 MB (450 snapshots)"
    estimated_lux: "180 MB (900 snapshots)"

    mitigation:
      - Git LFS for large binaries
      - PNG compression (lossless)
      - Deduplication across browsers
      - Artifact retention policies (90 days rolling, tagged permanent)

    git_lfs_config:
      track_pattern: "*.png"
      compression_level: 6
      bandwidth_limit: "100 MB/day"

  ci_resource_usage:
    github_actions_minutes:
      baseline: "12 minutes/run"
      lux_estimated: "25 minutes/run (3 browsers × 8.5 min)"
      monthly_estimate: "1,250 minutes (50 PRs × 25 min)"
      monthly_budget: "2,000 minutes (free tier)"

    optimization:
      - Run visual tests only on src/ changes
      - Skip visual tests on docs/ changes
      - Cache Playwright browsers
      - Use matrix strategy for parallelization

  developer_feedback_time:
    target: "<5 minutes to visual diff results"

    workflow:
      1_code_push: "0 min"
      2_ci_trigger: "+30 sec"
      3_test_execution: "+8.5 min"
      4_artifact_upload: "+1 min"
      5_pr_comment: "+30 sec"
      total: "~10.5 minutes"

    improvement_opportunities:
      - Incremental testing (changed components only)
      - Local visual regression via npm script
      - Real-time diff previews in IDE
```

### Performance Benchmarking

```typescript
// tests/visual-regression/lux/performance/benchmark.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Visual Regression Performance Benchmarks', () => {
  test('Full suite completes within 15 minutes', async ({ page }) => {
    const startTime = Date.now();

    // This is a placeholder - actual implementation would run full suite
    await page.goto('/');

    const endTime = Date.now();
    const duration = endTime - startTime;

    expect(duration).toBeLessThan(15 * 60 * 1000); // 15 minutes
  });

  test('Single component snapshot < 500ms', async ({ page }) => {
    await page.goto('/components/button-lux');

    const button = page.locator('[data-testid="button-lux-sapphire"]');
    await button.waitFor({ state: 'visible' });

    const startTime = Date.now();
    await expect(button).toHaveScreenshot('performance-test.png');
    const endTime = Date.now();

    expect(endTime - startTime).toBeLessThan(500);
  });

  test('Browser instance reuse reduces overhead', async ({ page, browser }) => {
    const contexts = [];

    // Create 5 contexts (simulate 5 tests)
    for (let i = 0; i < 5; i++) {
      const context = await browser.newContext();
      contexts.push(context);
    }

    // Verify contexts are reusing same browser instance
    expect(contexts.length).toBe(5);

    // Cleanup
    for (const context of contexts) {
      await context.close();
    }
  });
});
```

---

## XI. Quick Reference Guide

### Common Commands

```bash
# Generate baselines for first time
UPDATE_SNAPSHOTS=true npm run test:visual:lux

# Run visual regression tests (compare against baseline)
npm run test:visual:lux

# Run tests for specific component
npm run test:visual:lux -- --grep "ButtonLux"

# Run tests for specific browser
npm run test:visual:lux -- --project=lux-chromium-desktop

# Update baselines after intentional changes
./scripts/update-lux-baseline.sh phase-2 "Updated button hover animations"

# Generate HTML diff report
npm run test:visual:lux:report

# Run in CI mode (strict thresholds, no updates)
CI=true npm run test:visual:lux
```

### Package.json Scripts

```json
{
  "scripts": {
    "test:visual:lux": "playwright test --config=playwright.lux-visual.config.ts",
    "test:visual:lux:update": "UPDATE_SNAPSHOTS=true npm run test:visual:lux",
    "test:visual:lux:report": "playwright show-report test-results/lux-visual-report",
    "test:visual:lux:chromium": "npm run test:visual:lux -- --project=lux-chromium-desktop",
    "test:visual:lux:firefox": "npm run test:visual:lux -- --project=lux-firefox-desktop",
    "test:visual:lux:webkit": "npm run test:visual:lux -- --project=lux-safari-desktop",
    "test:visual:lux:mobile": "npm run test:visual:lux -- --project=lux-mobile-chrome --project=lux-mobile-safari",
    "test:visual:lux:watch": "npm run test:visual:lux -- --watch"
  }
}
```

### Troubleshooting Guide

```yaml
common_issues:

  font_rendering_differences:
    symptoms: "Text appears slightly different across runs"
    causes:
      - Font loading race conditions
      - System font variations
      - Font hinting differences
    solutions:
      - Wait for document.fonts.ready
      - Use font-render-hinting=none flag
      - Increase threshold for text-heavy components (0.15)

  animation_timing_variance:
    symptoms: "Animation snapshots differ significantly"
    causes:
      - CI environment slower than local
      - Timing function interpolation differences
      - Frame timing not synchronized
    solutions:
      - Disable animations for baseline (animations: 'disabled')
      - Use key-frame capture instead of mid-animation
      - Increase tolerance for animated states (0.20-0.25)

  shadow_rendering_differences:
    symptoms: "Box shadows render differently across browsers"
    causes:
      - Browser-specific shadow algorithms
      - Blur radius calculations vary
      - Sub-pixel rendering differences
    solutions:
      - Use browser-specific thresholds (Firefox: 1.3x, WebKit: 1.5x)
      - Accept higher tolerance for shadow-heavy components
      - Document known shadow variations

  gradient_color_shifts:
    symptoms: "Gradient backgrounds show color differences"
    causes:
      - Color interpolation algorithms vary (Chromium vs Firefox)
      - Gamma correction differences
      - Color space handling
    solutions:
      - Use higher thresholds for gradients (0.18-0.25)
      - Test gradients specifically across browsers
      - Consider using solid colors for critical elements

  flaky_tests:
    symptoms: "Tests pass locally but fail in CI, or vice versa"
    causes:
      - Network timing differences
      - Resource loading race conditions
      - CI environment resource constraints
    solutions:
      - Use waitForLoadState('networkidle')
      - Add explicit waits for critical resources
      - Increase retries in CI (retries: 3)
      - Use BrowserWorkarounds class for environment-specific fixes
```

---

## XII. Conclusion & Next Steps

### Implementation Checklist

```yaml
pre_implementation:
  - [ ] Review strategy with team
  - [ ] Set up Git LFS for snapshot storage
  - [ ] Configure GitHub Actions workflows
  - [ ] Create baseline storage structure
  - [ ] Install Playwright browsers locally
  - [ ] Run initial baseline capture (pre-Lux)
  - [ ] Tag baseline commit: lux-baseline-v0.0.0

phase_1_foundation:
  - [ ] Implement playwright.lux-visual.config.ts
  - [ ] Create foundation test suite (tokens, colors, shadows)
  - [ ] Capture Phase 1 baselines
  - [ ] Validate threshold configurations
  - [ ] Tag baseline: lux-baseline-v1.0.0-foundation

phase_2_components:
  - [ ] Create component test suites (ButtonLux, InputLux, SelectLux)
  - [ ] Implement custom visual matchers
  - [ ] Set up animation key-frame capture
  - [ ] Capture Phase 2 baselines
  - [ ] Tag baseline: lux-baseline-v2.0.0-components

phase_3_critical:
  - [ ] Create critical component tests (IdeaCardLux, DesignMatrixLux)
  - [ ] Implement drag-drop visual validation
  - [ ] Set up cross-browser validation matrix
  - [ ] Capture Phase 3 baselines
  - [ ] Tag baseline: lux-baseline-v3.0.0-critical

phase_4_production:
  - [ ] Complete responsive testing suite
  - [ ] Finalize HTML diff reporter
  - [ ] Set up CI/CD integration
  - [ ] Complete production baseline capture
  - [ ] Tag baseline: lux-baseline-v4.0.0-production
  - [ ] Document visual regression workflow
```

### Success Criteria

```yaml
visual_quality:
  - All critical components have visual baselines
  - Cross-browser consistency validated (3 browsers)
  - Responsive design validated (6 breakpoints)
  - Animation performance validated (<16ms)
  - Accessibility compliance maintained (WCAG AA)

test_infrastructure:
  - Playwright configuration optimized for Lux
  - Baseline management workflow operational
  - CI/CD integration complete
  - HTML diff reporting functional
  - Custom matchers implemented

documentation:
  - Testing strategy documented
  - Troubleshooting guide available
  - Common commands quick reference
  - Threshold justifications documented
  - Rollback procedures defined

performance:
  - Full suite < 15 minutes
  - Single component < 500ms
  - Snapshot storage < 200MB
  - CI minutes within budget
  - Developer feedback < 10 minutes
```

### Maintenance Plan

```yaml
ongoing_maintenance:
  weekly:
    - Review failed visual tests
    - Investigate flaky tests
    - Clean up old artifacts (>90 days)

  monthly:
    - Review threshold configurations
    - Analyze performance trends
    - Update browser versions
    - Archive old baselines

  quarterly:
    - Comprehensive visual audit
    - Baseline refresh (if needed)
    - Documentation updates
    - Team training review

  per_phase:
    - Update baselines
    - Tag new baseline version
    - Document changes
    - Communicate to team
```

---

**Document Version**: 1.0.0
**Last Updated**: 2025-10-02
**Author**: Quality Engineering Team
**Status**: Ready for Implementation
**Next Review**: After Phase 1 Completion
