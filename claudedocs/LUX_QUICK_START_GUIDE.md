# Animated Lux Implementation - Quick Start Guide

**Read this FIRST before starting implementation**

---

## TL;DR - Implementation Strategy

**Strategy**: Phased rollout with component wrappers
**Timeline**: 12 sessions (24 hours) over 2-3 weeks
**Risk Level**: LOW → HIGH (gradual increase with safeguards)
**Rollback**: Branch-based checkpoints + feature flags

---

## Pre-Flight Checklist (30 minutes)

### 1. Environment Verification
```bash
# Verify Node.js and npm versions
node -v   # Should be >= 18.x
npm -v    # Should be >= 9.x

# Verify all dependencies installed
npm install

# Run baseline tests (MUST PASS)
npm run test
npm run test:visual
npm run build

# Verify clean git status
git status  # Should show clean working tree
```

### 2. Create Baseline Branch
```bash
# Create safety baseline
git checkout -b main-pre-lux
git push -u origin main-pre-lux
git tag lux-baseline-v0.0.0
git push --tags

# Return to main
git checkout main
```

### 3. Capture Visual Baselines
```bash
# Capture pre-migration screenshots
UPDATE_SNAPSHOTS=true npm run test:visual

# Verify snapshots created
ls -la tests/visual/__snapshots__/

# Commit baselines
git add tests/visual/__snapshots__
git commit -m "Baseline: Pre-LUX visual regression snapshots"
git push
```

### 4. Create Phase 1 Branch
```bash
git checkout -b feature/lux-phase-1-foundation
git push -u origin feature/lux-phase-1-foundation
```

**✅ You're ready to start Phase 1!**

---

## Phase 1: Foundation Layer (Sessions 1-2)

### Session 1: CSS Token System (2 hours)

#### Step 1: Create LUX Tokens File
```bash
# Create new file
touch src/styles/lux-tokens.css
```

**File content** (`src/styles/lux-tokens.css`):
```css
/**
 * Animated Lux Design System - CSS Tokens
 *
 * Monochrome-first with gem-tone accents
 */

:root {
  /* ===== MONOCHROME GRADIENT SYSTEM ===== */
  --lux-gradient-subtle: linear-gradient(135deg, #FAFBFC 0%, #F4F6F8 100%);
  --lux-gradient-hover: linear-gradient(135deg, #F9FAFB 0%, #E5E7EB 100%);
  --lux-gradient-active: linear-gradient(135deg, #F4F6F8 0%, #D1D5DB 100%);

  /* ===== GEM-TONE ACCENT COLORS ===== */
  /* Sapphire (High-Impact Quadrant) */
  --lux-sapphire-50: #EFF6FF;
  --lux-sapphire-100: #DBEAFE;
  --lux-sapphire-700: #1D4ED8;
  --lux-sapphire-900: #1E3A8A;

  /* Emerald (Quick-Wins Quadrant) */
  --lux-emerald-50: #ECFDF5;
  --lux-emerald-100: #D1FAE5;
  --lux-emerald-700: #047857;
  --lux-emerald-900: #14532D;

  /* Amber (Strategic Quadrant) */
  --lux-amber-50: #FFFBEB;
  --lux-amber-100: #FEF3C7;
  --lux-amber-700: #B45309;
  --lux-amber-900: #78350F;

  /* Garnet (Delegate Quadrant) */
  --lux-garnet-50: #FEF2F2;
  --lux-garnet-100: #FEE2E2;
  --lux-garnet-700: #B91C1C;
  --lux-garnet-900: #7F1D1D;

  /* ===== SHADOW SYSTEM ===== */
  --lux-shadow-sm: 0px 1px 2px rgba(0, 0, 0, 0.04);
  --lux-shadow-md: 0px 2px 6px rgba(0, 0, 0, 0.06);
  --lux-shadow-lg: 0px 4px 12px rgba(0, 0, 0, 0.08);
  --lux-shadow-xl: 0px 8px 24px rgba(0, 0, 0, 0.10);

  /* Gem-tone shadows (colored accents) */
  --lux-shadow-sapphire: 0px 4px 12px rgba(29, 78, 216, 0.15);
  --lux-shadow-emerald: 0px 4px 12px rgba(4, 120, 87, 0.15);
  --lux-shadow-amber: 0px 4px 12px rgba(180, 83, 9, 0.15);
  --lux-shadow-garnet: 0px 4px 12px rgba(185, 28, 28, 0.15);

  /* ===== ANIMATION TIMING ===== */
  --lux-transition-fast: 150ms;
  --lux-transition-normal: 250ms;
  --lux-transition-slow: 400ms;

  --lux-ease-smooth: cubic-bezier(0.4, 0.0, 0.2, 1);
  --lux-ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);
  --lux-ease-decelerate: cubic-bezier(0.0, 0.0, 0.2, 1);
}
```

#### Step 2: Import LUX Tokens
**Edit** `src/index.css` (add at top):
```css
/* LUX Design System */
@import './styles/lux-tokens.css';

/* Existing imports */
@import './styles/design-tokens.css';
/* ... rest of file unchanged ... */
```

#### Step 3: Extend Tailwind Configuration
**Edit** `tailwind.config.js` (extend colors section):
```javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        // EXISTING COLORS (preserve all)
        brand: { /* ... */ },
        neutral: { /* ... */ },

        // NEW: LUX gem-tone extensions
        'lux-sapphire': {
          50: '#EFF6FF',
          100: '#DBEAFE',
          700: '#1D4ED8',
          900: '#1E3A8A',
        },
        'lux-emerald': {
          50: '#ECFDF5',
          100: '#D1FAE5',
          700: '#047857',
          900: '#14532D',
        },
        'lux-amber': {
          50: '#FFFBEB',
          100: '#FEF3C7',
          700: '#B45309',
          900: '#78350F',
        },
        'lux-garnet': {
          50: '#FEF2F2',
          100: '#FEE2E2',
          700: '#B91C1C',
          900: '#7F1D1D',
        },
      },

      // NEW: LUX shadow extensions
      boxShadow: {
        // EXISTING SHADOWS (preserve all)
        'card': '0px 2px 6px rgba(0, 0, 0, 0.05)',
        // ... rest preserved ...

        // NEW: LUX shadow system
        'lux-sm': '0px 1px 2px rgba(0, 0, 0, 0.04)',
        'lux-md': '0px 2px 6px rgba(0, 0, 0, 0.06)',
        'lux-lg': '0px 4px 12px rgba(0, 0, 0, 0.08)',
        'lux-xl': '0px 8px 24px rgba(0, 0, 0, 0.10)',
        'lux-sapphire': '0px 4px 12px rgba(29, 78, 216, 0.15)',
        'lux-emerald': '0px 4px 12px rgba(4, 120, 87, 0.15)',
        'lux-amber': '0px 4px 12px rgba(180, 83, 9, 0.15)',
        'lux-garnet': '0px 4px 12px rgba(185, 28, 28, 0.15)',
      },

      // NEW: LUX animation extensions
      animation: {
        // EXISTING (preserve all)
        'fade-in': 'fadeIn 0.2s ease-in-out',
        // ... rest preserved ...

        // NEW: LUX animations
        'lux-fade-in': 'luxFadeIn 0.25s var(--lux-ease-smooth)',
        'lux-scale-in': 'luxScaleIn 0.25s var(--lux-ease-smooth)',
        'lux-slide-up': 'luxSlideUp 0.25s var(--lux-ease-smooth)',
      },

      keyframes: {
        // EXISTING (preserve all)
        fadeIn: { /* ... */ },
        // ... rest preserved ...

        // NEW: LUX keyframes
        luxFadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        luxScaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        luxSlideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
};
```

#### Step 4: Verification
```bash
# Rebuild Tailwind
npm run build

# Verify no errors
npm run type-check

# Run tests
npm run test

# CRITICAL: Visual regression test
npm run test:visual
```

**Expected Result**: All tests pass, no visual changes (tokens defined but not yet used)

#### Step 5: Checkpoint
```bash
git add .
git commit -m "Phase 1 Session 1: LUX token system foundation

Completed:
- Created lux-tokens.css with gem-tone colors
- Extended Tailwind config with LUX utilities
- Verified no visual regressions

Next: Visual baseline capture and validation"

git push
```

---

### Session 2: Visual Baseline & Validation (2 hours)

#### Step 1: Create LUX Visual Test Suite
```bash
touch tests/visual/lux-validation.spec.ts
```

**File content**:
```typescript
import { test, expect } from '@playwright/test';

test.describe('LUX Design System - Foundation Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('No visual regressions from token addition', async ({ page }) => {
    await page.goto('/project/demo');

    const matrix = page.locator('[data-testid="design-matrix"]');
    await matrix.waitFor({ state: 'visible' });

    // Capture baseline - should be identical to pre-LUX
    await expect(matrix).toHaveScreenshot('matrix-post-tokens.png', {
      threshold: 0.02, // 2% tolerance (font rendering)
      maxDiffPixels: 500,
    });
  });

  test('Tailwind utilities compile correctly', async ({ page }) => {
    // Verify LUX utilities are available
    const testElement = await page.evaluate(() => {
      const div = document.createElement('div');
      div.className = 'shadow-lux-md bg-lux-sapphire-50';
      document.body.appendChild(div);

      const styles = window.getComputedStyle(div);
      const hasShadow = styles.boxShadow !== 'none';
      const hasBg = styles.backgroundColor !== 'rgba(0, 0, 0, 0)';

      div.remove();
      return { hasShadow, hasBg };
    });

    expect(testElement.hasShadow).toBe(true);
    expect(testElement.hasBg).toBe(true);
  });
});
```

#### Step 2: Run Visual Validation
```bash
# Update baselines with LUX tokens
UPDATE_SNAPSHOTS=true npm run test:visual

# Verify visual parity
npm run test:visual
```

**Expected Result**: <2% pixel difference (minor font rendering variations)

#### Step 3: Performance Validation
```bash
# Build and check bundle size
npm run build

# Check build output
ls -lh dist/assets/*.css
ls -lh dist/assets/*.js
```

**Expected Metrics**:
- CSS bundle increase: <5KB
- JS bundle increase: 0KB (no runtime impact)
- Build time increase: <10%

#### Step 4: Create Phase 1 Checkpoint
```bash
# Create checkpoint documentation
cat > claudedocs/lux-phase-1-checkpoint.yaml << 'EOF'
phase: 1
status: completed
timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
duration: 4 hours (2 sessions)

deliverables:
  - src/styles/lux-tokens.css
  - tailwind.config.js (extended)
  - tests/visual/lux-validation.spec.ts

validation_results:
  visual_regression:
    status: PASS
    max_difference: 1.8%
    critical_flows: 5/5 passed

  performance:
    css_bundle_increase: +3.2KB
    js_bundle_increase: 0KB
    build_time: 8.1s (baseline: 7.8s, +3.8%)

  quality:
    unit_tests: PASS (100% coverage maintained)
    type_check: PASS (no errors)
    lint: PASS (no warnings)

baseline_commit: $(git rev-parse HEAD)
rollback_branch: feature/lux-phase-1-foundation

next_phase:
  phase: 2
  focus: Component wrapper layer
  components:
    - ButtonLux
    - InputLux
    - SelectLux
  estimated_duration: 6 hours (3 sessions)
EOF

git add claudedocs/lux-phase-1-checkpoint.yaml
git commit -m "Phase 1 Complete: Foundation layer validated"
git tag lux-phase-1-complete
git push --tags
```

**🎉 Phase 1 Complete!**

---

## Phase 2: Component Wrappers (Sessions 3-5)

### Session 3: ButtonLux Implementation (2 hours)

#### Step 1: Create ButtonLux Component
```bash
touch src/components/ui/ButtonLux.tsx
```

**Component Implementation**:
```typescript
import React from 'react';
import { Button, ButtonProps } from './Button';

export type LuxGemTone = 'sapphire' | 'emerald' | 'amber' | 'garnet' | 'monochrome';
export type LuxIntensity = 'subtle' | 'normal' | 'bold';

export interface ButtonLuxProps extends ButtonProps {
  /** LUX gem-tone variant */
  luxVariant?: LuxGemTone;
  /** Enable LUX animations (default: true) */
  luxAnimated?: boolean;
  /** Animation intensity (default: 'normal') */
  luxIntensity?: LuxIntensity;
}

/**
 * ButtonLux - Enhanced Button with Animated Lux design system
 *
 * Backward compatible wrapper around Button component.
 * Provides gem-tone accents and premium animations.
 *
 * @example
 * // Standard usage (no LUX)
 * <ButtonLux variant="primary">Click</ButtonLux>
 *
 * @example
 * // LUX enhanced
 * <ButtonLux luxVariant="sapphire" luxAnimated>Click</ButtonLux>
 */
export const ButtonLux: React.FC<ButtonLuxProps> = ({
  luxVariant,
  luxAnimated = true,
  luxIntensity = 'normal',
  className = '',
  ...buttonProps
}) => {
  // Build LUX class names
  const luxClasses: string[] = [];

  if (luxVariant) {
    luxClasses.push('lux-button');
    luxClasses.push(`lux-button--${luxVariant}`);
  }

  if (luxAnimated) {
    luxClasses.push('lux-animated');
    luxClasses.push(`lux-animated--${luxIntensity}`);
  }

  const combinedClassName = [className, ...luxClasses]
    .filter(Boolean)
    .join(' ');

  return (
    <Button
      {...buttonProps}
      className={combinedClassName}
      data-lux-variant={luxVariant}
      data-lux-intensity={luxIntensity}
    />
  );
};

ButtonLux.displayName = 'ButtonLux';
```

#### Step 2: Create LUX Button Styles
```bash
touch src/styles/lux-button.css
```

**Style Implementation**:
```css
/**
 * ButtonLux Styles - Gem-tone variants with animations
 */

/* Base LUX button enhancements */
.lux-button {
  position: relative;
  overflow: hidden;
  transition: all var(--lux-transition-normal) var(--lux-ease-smooth);
}

/* Gem-tone variants */
.lux-button--sapphire {
  background: linear-gradient(135deg, var(--lux-sapphire-700) 0%, var(--lux-sapphire-900) 100%);
  box-shadow: var(--lux-shadow-sapphire);
}

.lux-button--sapphire:hover {
  box-shadow: var(--lux-shadow-lg), var(--lux-shadow-sapphire);
  transform: translateY(-2px);
}

.lux-button--emerald {
  background: linear-gradient(135deg, var(--lux-emerald-700) 0%, var(--lux-emerald-900) 100%);
  box-shadow: var(--lux-shadow-emerald);
}

.lux-button--emerald:hover {
  box-shadow: var(--lux-shadow-lg), var(--lux-shadow-emerald);
  transform: translateY(-2px);
}

.lux-button--amber {
  background: linear-gradient(135deg, var(--lux-amber-700) 0%, var(--lux-amber-900) 100%);
  box-shadow: var(--lux-shadow-amber);
}

.lux-button--amber:hover {
  box-shadow: var(--lux-shadow-lg), var(--lux-shadow-amber);
  transform: translateY(-2px);
}

.lux-button--garnet {
  background: linear-gradient(135deg, var(--lux-garnet-700) 0%, var(--lux-garnet-900) 100%);
  box-shadow: var(--lux-shadow-garnet);
}

.lux-button--garnet:hover {
  box-shadow: var(--lux-shadow-lg), var(--lux-shadow-garnet);
  transform: translateY(-2px);
}

.lux-button--monochrome {
  background: var(--lux-gradient-subtle);
  color: var(--brand-primary);
  box-shadow: var(--lux-shadow-md);
}

.lux-button--monochrome:hover {
  background: var(--lux-gradient-hover);
  box-shadow: var(--lux-shadow-lg);
  transform: translateY(-2px);
}

/* Animation intensity variants */
.lux-animated--subtle {
  transition-duration: var(--lux-transition-fast);
}

.lux-animated--subtle:hover {
  transform: translateY(-1px);
}

.lux-animated--normal {
  transition-duration: var(--lux-transition-normal);
}

.lux-animated--bold {
  transition-duration: var(--lux-transition-slow);
  transition-timing-function: var(--lux-ease-bounce);
}

.lux-animated--bold:hover {
  transform: translateY(-4px) scale(1.02);
}

/* Disabled state */
.lux-button:disabled {
  opacity: 0.5;
  transform: none !important;
  box-shadow: none !important;
  cursor: not-allowed;
}
```

**Import in** `src/index.css`:
```css
@import './styles/lux-tokens.css';
@import './styles/lux-button.css';  /* NEW */
```

#### Step 3: Create Unit Tests
```bash
touch src/components/ui/__tests__/ButtonLux.test.tsx
```

**Test Implementation**:
```typescript
import { render, screen } from '@testing-library/react';
import { Button } from '../Button';
import { ButtonLux } from '../ButtonLux';
import '@testing-library/jest-dom';

describe('ButtonLux', () => {
  it('renders without LUX props (backward compatible)', () => {
    const { container: oldButton } = render(
      <Button variant="primary">Test</Button>
    );
    const { container: luxButton } = render(
      <ButtonLux variant="primary">Test</ButtonLux>
    );

    // Should render identically when no LUX props
    expect(oldButton.innerHTML).toBe(luxButton.innerHTML);
  });

  it('applies LUX classes when luxVariant provided', () => {
    render(<ButtonLux luxVariant="sapphire">Enhanced</ButtonLux>);
    const button = screen.getByRole('button');

    expect(button).toHaveClass('lux-button');
    expect(button).toHaveClass('lux-button--sapphire');
    expect(button).toHaveAttribute('data-lux-variant', 'sapphire');
  });

  it('applies all gem-tone variants', () => {
    const variants: Array<'sapphire' | 'emerald' | 'amber' | 'garnet'> = [
      'sapphire',
      'emerald',
      'amber',
      'garnet',
    ];

    variants.forEach(variant => {
      const { unmount } = render(
        <ButtonLux luxVariant={variant}>{variant}</ButtonLux>
      );
      const button = screen.getByRole('button', { name: variant });

      expect(button).toHaveClass(`lux-button--${variant}`);
      unmount();
    });
  });

  it('applies animation intensity classes', () => {
    const { rerender } = render(
      <ButtonLux luxVariant="sapphire" luxIntensity="subtle">Test</ButtonLux>
    );
    let button = screen.getByRole('button');
    expect(button).toHaveClass('lux-animated--subtle');

    rerender(
      <ButtonLux luxVariant="sapphire" luxIntensity="bold">Test</ButtonLux>
    );
    button = screen.getByRole('button');
    expect(button).toHaveClass('lux-animated--bold');
  });

  it('disables animations when luxAnimated=false', () => {
    render(
      <ButtonLux luxVariant="sapphire" luxAnimated={false}>Test</ButtonLux>
    );
    const button = screen.getByRole('button');

    expect(button).not.toHaveClass('lux-animated');
  });
});
```

#### Step 4: Validation
```bash
# Run unit tests
npm run test -- ButtonLux

# Type check
npm run type-check

# Build
npm run build

# Visual regression
npm run test:visual
```

#### Step 5: Checkpoint
```bash
git add .
git commit -m "Phase 2 Session 3: ButtonLux component

Completed:
- ButtonLux wrapper component (backward compatible)
- LUX button styles with gem-tone variants
- Comprehensive unit tests (100% coverage)
- Visual validation (no regressions)

Next: InputLux and SelectLux components"

git push
```

---

## Critical Success Factors

### ✅ Green Lights (Proceed)
- All tests passing (unit + visual)
- No console errors or warnings
- Build successful
- Performance metrics within targets
- Visual regression <5% difference

### ⚠️ Yellow Lights (Investigate)
- Visual regression 5-10% difference
- Performance degradation 10-20%
- Single test failures (non-critical)
- Bundle size increase 10-15%

### 🛑 Red Lights (STOP - Rollback)
- Visual regression >10% difference
- Performance degradation >20%
- Multiple test failures
- Console errors in production code
- Build failures
- Bundle size increase >20%

---

## Rollback Procedures

### Quick Rollback (Component Level)
```bash
# Rollback last commit
git revert HEAD
npm install
npm run test
npm run build
```

### Phase Rollback
```bash
# Rollback to previous phase
git revert <phase-merge-commit-sha>
npm install
npm run test:visual
npm run build
```

### Emergency Rollback (Full)
```bash
# Return to pre-LUX baseline
git checkout main-pre-lux
git checkout -b emergency-rollback
npm install
npm run test
npm run build
# Deploy immediately
```

---

## Next Steps

1. **Complete Phase 1** (Foundation)
2. **Validate thoroughly** before Phase 2
3. **Continue to Phase 2** (Component Wrappers)
4. **Pause before Phase 3** (review risk assessment)
5. **Execute Phase 3** (Critical Components) with extra caution
6. **Finalize with Phase 4** (Application Shell)

---

**Questions? Review the full architecture document:**
`claudedocs/ANIMATED_LUX_IMPLEMENTATION_ARCHITECTURE.md`

**Need help? Check the rollback procedures above!**
