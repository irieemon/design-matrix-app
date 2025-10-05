# Animated Lux Design System Implementation Architecture

**Project**: Design Matrix App
**Target LOC**: 59,871 LOC across 161 component files
**Tech Stack**: React 18.2 + TypeScript + Tailwind CSS + Vite
**Objective**: Implement Animated Lux design system while preserving idea cards and matrix functionality

---

## Executive Summary

### Implementation Strategy: **Phased Rollout with Atomic Safeguards**

**Chosen Approach**: Hybrid phased rollout with atomic component migrations and comprehensive rollback capabilities.

**Rationale**:
- Codebase size (59K+ LOC, 161 files) makes atomic migration too risky
- Critical business logic in IdeaCard and DesignMatrix components requires preservation
- Existing visual regression infrastructure supports incremental validation
- Component state architecture already supports progressive enhancement

**Timeline**: 4 phases over 8-12 development sessions with checkpoint-based persistence

---

## I. Architecture Overview

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                     ANIMATED LUX DESIGN SYSTEM                       │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │               DESIGN TOKEN FOUNDATION                           │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │ │
│  │  │ CSS Tokens   │  │  Tailwind    │  │  Component State     │ │ │
│  │  │ - Colors     │  │  Extension   │  │  - Variants          │ │ │
│  │  │ - Shadows    │  │  - Gem Tones │  │  - Sizes             │ │ │
│  │  │ - Animations │  │  - Gradients │  │  - States            │ │ │
│  │  └──────────────┘  └──────────────┘  └──────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │               COMPONENT WRAPPER LAYER                           │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │ │
│  │  │   Enhanced   │  │   Enhanced   │  │     Enhanced         │ │ │
│  │  │   Button     │  │    Input     │  │     Select           │ │ │
│  │  │   Wrapper    │  │   Wrapper    │  │     Wrapper          │ │ │
│  │  └──────────────┘  └──────────────┘  └──────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │            CRITICAL BUSINESS COMPONENTS                         │ │
│  │  ┌─────────────────────────┐  ┌──────────────────────────────┐│ │
│  │  │   IdeaCard Component    │  │   DesignMatrix Component     ││ │
│  │  │   - Drag/Drop           │  │   - Quadrant Layout          ││ │
│  │  │   - Collapse States     │  │   - Multi-card Management    ││ │
│  │  │   - User Permissions    │  │   - Performance Monitoring   ││ │
│  │  └─────────────────────────┘  └──────────────────────────────┘│ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │            VISUAL REGRESSION VALIDATION                         │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │ │
│  │  │  Playwright  │  │   Baseline   │  │   Cross-Browser      │ │ │
│  │  │   E2E Tests  │  │  Screenshots │  │   Validation         │ │ │
│  │  │  (Existing)  │  │   (New LUX)  │  │   (3 browsers)       │ │ │
│  │  └──────────────┘  └──────────────┘  └──────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### Technical Dependency Graph

```
Layer 1: Foundation (CSS Tokens + Tailwind Config)
   │
   ├─→ Layer 2: Design Primitives (Colors, Shadows, Animations)
   │       │
   │       ├─→ Layer 3: Component Wrappers (Button, Input, Select)
   │       │       │
   │       │       ├─→ Layer 4: Composite Components (Cards, Modals, Forms)
   │       │       │       │
   │       │       │       ├─→ Layer 5: Business Logic (IdeaCard, DesignMatrix)
   │       │       │       │       │
   │       │       │       │       └─→ Layer 6: Application Shell (MainApp, Routes)
   │       │       │       │
   │       │       │       └─→ Visual Regression Tests (Parallel Validation)
   │       │       │
   │       │       └─→ Unit Tests (Component Isolation)
   │       │
   │       └─→ Storybook Documentation (Optional, Post-MVP)
   │
   └─→ Rollback Checkpoints (Git branches + Session persistence)
```

---

## II. Phased Rollout Strategy

### Phase 1: Foundation Layer (Sessions 1-2)
**Duration**: 2-3 hours
**Risk Level**: LOW
**Rollback Strategy**: Git branch `feature/lux-phase-1`

#### Deliverables
1. **CSS Token System** (`src/styles/lux-tokens.css`)
   - Gem-tone color palette (sapphire, emerald, amber, garnet)
   - Monochrome gradient system
   - Shadow hierarchy (lux-shadow-sm → lux-shadow-xl)
   - Animation timing functions

2. **Tailwind Configuration Extensions** (`tailwind.config.js`)
   - Extend existing color system with LUX variants
   - Add custom shadow utilities
   - Configure animation keyframes
   - Preserve existing token system (no breaking changes)

3. **Visual Regression Baselines**
   - Capture pre-migration screenshots (all critical flows)
   - Document baseline commit SHA
   - Store in `tests/visual/__snapshots__/lux-baseline/`

#### Implementation Pattern
```typescript
// src/styles/lux-tokens.css
:root {
  /* Gem-Tone Accent System */
  --lux-sapphire-50: #EFF6FF;
  --lux-sapphire-700: #1D4ED8;

  --lux-emerald-50: #ECFDF5;
  --lux-emerald-700: #047857;

  /* Monochrome Gradient Foundations */
  --lux-gradient-subtle: linear-gradient(135deg, #FAFBFC 0%, #F4F6F8 100%);
  --lux-gradient-hover: linear-gradient(135deg, #F9FAFB 0%, #E5E7EB 100%);

  /* Shadow System */
  --lux-shadow-sm: 0px 1px 2px rgba(0, 0, 0, 0.04);
  --lux-shadow-md: 0px 2px 6px rgba(0, 0, 0, 0.06);
  --lux-shadow-lg: 0px 4px 12px rgba(0, 0, 0, 0.08);

  /* Animation Curves */
  --lux-ease-smooth: cubic-bezier(0.4, 0.0, 0.2, 1);
  --lux-ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

#### Success Criteria
- [ ] All existing components render without regression
- [ ] Visual tests pass with <2% pixel difference
- [ ] No console errors or warnings
- [ ] Build time increase <10%
- [ ] Bundle size increase <5KB

#### Checkpoint Documentation
```yaml
# claudedocs/lux-phase-1-checkpoint.yaml
phase: 1
status: completed
timestamp: 2025-10-02T18:30:00Z
baseline_commit: abc123def
visual_baselines: tests/visual/__snapshots__/lux-baseline/
rollback_branch: feature/lux-phase-1
validation_results:
  visual_regression: PASS (1.2% difference)
  unit_tests: PASS (100% coverage maintained)
  build_time: 8.2s (baseline: 7.8s, +5%)
  bundle_size: 512KB (baseline: 508KB, +0.8%)
```

---

### Phase 2: Component Wrapper Layer (Sessions 3-5)
**Duration**: 4-6 hours
**Risk Level**: MEDIUM
**Rollback Strategy**: Git branch `feature/lux-phase-2`

#### Deliverables
1. **Enhanced Button Component** (`src/components/ui/ButtonLux.tsx`)
   - Extend existing Button with LUX animations
   - Backward compatible props API
   - Opt-in `luxVariant` prop for progressive migration

2. **Enhanced Input Component** (`src/components/ui/InputLux.tsx`)
   - Gem-tone focus states
   - Smooth transition animations
   - Preserve existing validation logic

3. **Enhanced Select Component** (`src/components/ui/SelectLux.tsx`)
   - Animated dropdown transitions
   - Custom option styling with gem accents

4. **Component Migration Strategy**
   - Create wrapper components with dual API support
   - Allow gradual migration via feature flags
   - Maintain 100% backward compatibility

#### Implementation Pattern (Backward Compatible Wrapper)
```typescript
// src/components/ui/ButtonLux.tsx
import React from 'react';
import { Button, ButtonProps } from './Button';
import { usePremiumAnimations } from '../../hooks/usePremiumAnimations';

interface ButtonLuxProps extends ButtonProps {
  /** Enable LUX design system enhancements */
  luxVariant?: 'sapphire' | 'emerald' | 'amber' | 'garnet' | 'monochrome';
  /** Enable premium animations (default: true) */
  luxAnimated?: boolean;
  /** Animation intensity (subtle | normal | bold) */
  luxIntensity?: 'subtle' | 'normal' | 'bold';
}

export const ButtonLux: React.FC<ButtonLuxProps> = ({
  luxVariant,
  luxAnimated = true,
  luxIntensity = 'normal',
  className = '',
  ...buttonProps
}) => {
  const animations = usePremiumAnimations({
    enabled: luxAnimated,
    intensity: luxIntensity,
  });

  const luxClasses = luxVariant ? [
    'lux-button',
    `lux-button--${luxVariant}`,
    luxAnimated ? `lux-animated--${luxIntensity}` : '',
  ].filter(Boolean).join(' ') : '';

  return (
    <Button
      {...buttonProps}
      className={`${className} ${luxClasses}`.trim()}
      animated={luxAnimated}
      data-lux-variant={luxVariant}
    />
  );
};

// Usage Examples:
// Old API (no changes): <Button variant="primary">Click</Button>
// New API (opt-in):     <ButtonLux luxVariant="sapphire">Click</ButtonLux>
```

#### Migration Testing Strategy
```typescript
// src/components/ui/__tests__/ButtonLux.test.tsx
import { render, screen } from '@testing-library/react';
import { Button } from './Button';
import { ButtonLux } from './ButtonLux';

describe('ButtonLux Backward Compatibility', () => {
  it('renders identical to Button when no LUX props provided', () => {
    const { container: oldButton } = render(<Button>Test</Button>);
    const { container: luxButton } = render(<ButtonLux>Test</ButtonLux>);

    // Visual parity check
    expect(oldButton.innerHTML).toBe(luxButton.innerHTML);
  });

  it('applies LUX enhancements when luxVariant specified', () => {
    render(<ButtonLux luxVariant="sapphire">Enhanced</ButtonLux>);
    const button = screen.getByRole('button');

    expect(button).toHaveClass('lux-button');
    expect(button).toHaveClass('lux-button--sapphire');
    expect(button).toHaveAttribute('data-lux-variant', 'sapphire');
  });
});
```

#### Success Criteria
- [ ] All wrapper components pass unit tests (100% coverage)
- [ ] Backward compatibility validated (existing usage unchanged)
- [ ] Visual regression tests pass (<3% difference)
- [ ] Performance benchmarks maintained (no >16ms interactions)
- [ ] Accessibility compliance maintained (WCAG 2.1 AA)

#### Checkpoint Documentation
```yaml
# claudedocs/lux-phase-2-checkpoint.yaml
phase: 2
status: completed
timestamp: 2025-10-02T22:45:00Z
components_migrated:
  - ButtonLux (backward compatible)
  - InputLux (backward compatible)
  - SelectLux (backward compatible)
migration_strategy: wrapper_pattern
breaking_changes: none
visual_regression:
  status: PASS
  max_difference: 2.8%
  critical_flows_validated: 12
performance_impact:
  render_time: "+2ms average (acceptable)"
  bundle_increase: "+8KB (minified+gzipped)"
```

---

### Phase 3: Critical Business Components (Sessions 6-8)
**Duration**: 5-7 hours
**Risk Level**: HIGH
**Rollback Strategy**: Git branch `feature/lux-phase-3` + Comprehensive backups

#### Deliverables
1. **IdeaCard LUX Enhancement** (`src/components/IdeaCardLux.tsx`)
   - Preserve ALL drag-drop functionality
   - Preserve collapse state logic
   - Add subtle gem-tone accents based on quadrant
   - Enhance hover animations (sub-16ms requirement)

2. **DesignMatrix LUX Enhancement** (`src/components/DesignMatrixLux.tsx`)
   - Preserve quadrant layout system
   - Preserve performance monitoring hooks
   - Add subtle gradient backgrounds per quadrant
   - Enhance card transition animations

3. **Comprehensive Visual Regression Suite**
   - All quadrant combinations (2x2 = 4 states)
   - Drag-drop interaction flows
   - Collapse/expand animations
   - Multi-card layouts (1, 5, 20, 50 cards)

#### Implementation Pattern (Preserve + Enhance)
```typescript
// src/components/IdeaCardLux.tsx
import React from 'react';
import { IdeaCardComponent, IdeaCardProps } from './IdeaCardComponent';
import { usePremiumAnimations } from '../hooks/usePremiumAnimations';

interface IdeaCardLuxProps extends IdeaCardProps {
  /** Quadrant position for contextual gem-tone accent */
  quadrant?: 'high-impact' | 'quick-wins' | 'strategic' | 'delegate';
  /** Enable LUX design enhancements (default: false for safety) */
  luxEnabled?: boolean;
}

export const IdeaCardLux: React.FC<IdeaCardLuxProps> = ({
  quadrant,
  luxEnabled = false,
  className = '',
  ...ideaCardProps
}) => {
  const animations = usePremiumAnimations({
    enabled: luxEnabled,
    intensity: 'subtle', // CRITICAL: Keep subtle for business logic components
  });

  // Map quadrants to gem-tone accents
  const quadrantGemTone = {
    'high-impact': 'sapphire',
    'quick-wins': 'emerald',
    'strategic': 'amber',
    'delegate': 'garnet',
  }[quadrant];

  const luxClasses = luxEnabled && quadrantGemTone ? [
    'lux-idea-card',
    `lux-accent--${quadrantGemTone}`,
    'lux-hover-enhanced',
  ].filter(Boolean).join(' ') : '';

  return (
    <IdeaCardComponent
      {...ideaCardProps}
      className={`${className} ${luxClasses}`.trim()}
      data-lux-quadrant={quadrant}
      data-lux-enabled={luxEnabled}
    />
  );
};
```

#### Risk Mitigation Strategy
```yaml
critical_business_logic_preservation:
  drag_drop:
    - Verify @dnd-kit/core integration unchanged
    - Test multi-card drag interactions
    - Validate drop zone calculations

  collapse_state:
    - Verify state persistence across renders
    - Test rapid collapse/expand cycles
    - Validate keyboard accessibility

  permissions:
    - Verify user ownership checks
    - Test AI-generated card attribution
    - Validate edit/delete permission logic

visual_regression_coverage:
  matrix_states:
    - Empty matrix (0 cards)
    - Single card per quadrant (4 cards)
    - Balanced load (20 cards, 5 per quadrant)
    - Stress test (50+ cards)

  interaction_flows:
    - Drag card between quadrants
    - Collapse/expand multiple cards
    - Edit card (modal open)
    - Delete card (confirmation flow)

performance_monitoring:
  metrics:
    - Hover response time: <16ms (sub-frame)
    - Drag initiation: <32ms (2 frames)
    - Quadrant transition: <200ms (perceived instant)
    - Card render time: <50ms (individual)

  tools:
    - useMatrixPerformance hook (existing)
    - Chrome DevTools Performance tab
    - React DevTools Profiler
```

#### Success Criteria
- [ ] Zero regressions in drag-drop functionality
- [ ] Zero regressions in collapse state management
- [ ] Zero regressions in user permission logic
- [ ] Visual regression tests pass (<5% difference, higher tolerance for animations)
- [ ] Performance benchmarks maintained (all metrics within thresholds)
- [ ] Accessibility compliance maintained (WCAG 2.1 AA)
- [ ] Manual QA validation (20+ test scenarios)

#### Checkpoint Documentation
```yaml
# claudedocs/lux-phase-3-checkpoint.yaml
phase: 3
status: completed
timestamp: 2025-10-03T14:20:00Z
critical_components:
  - IdeaCardLux (preserves 100% business logic)
  - DesignMatrixLux (preserves 100% layout system)

regression_validation:
  drag_drop: PASS (100% functional parity)
  collapse_state: PASS (100% functional parity)
  permissions: PASS (100% functional parity)
  visual_regression: PASS (4.2% difference, animation variance)

performance_validation:
  hover_response: 12ms average (target: <16ms) ✓
  drag_initiation: 28ms average (target: <32ms) ✓
  card_render: 42ms average (target: <50ms) ✓

accessibility_validation:
  wcag_compliance: AA level maintained
  keyboard_navigation: 100% functional
  screen_reader: Tested with VoiceOver (macOS)

manual_qa_scenarios: 24/24 passed
```

---

### Phase 4: Application Shell & Finalization (Sessions 9-12)
**Duration**: 4-6 hours
**Risk Level**: MEDIUM
**Rollback Strategy**: Git branch `feature/lux-phase-4`

#### Deliverables
1. **Application Shell Migration**
   - MainApp.tsx → Use ButtonLux, InputLux
   - Modals → Add LUX shadow/gradient enhancements
   - Sidebar → Gem-tone active state accents

2. **Feature Flag System**
   - Environment variable: `VITE_LUX_ENABLED`
   - User preference toggle (localStorage)
   - A/B testing support for gradual rollout

3. **Documentation & Handoff**
   - Component usage guide
   - Migration checklist for future components
   - Performance optimization guide
   - Rollback procedure documentation

#### Implementation Pattern (Feature Flag)
```typescript
// src/lib/luxFeatureFlag.ts
export const luxFeatureFlags = {
  enabled: import.meta.env.VITE_LUX_ENABLED === 'true',
  userPreference: localStorage.getItem('lux-enabled') === 'true',

  isLuxEnabled(): boolean {
    return this.enabled || this.userPreference;
  },

  setUserPreference(enabled: boolean): void {
    localStorage.setItem('lux-enabled', String(enabled));
  },
};

// Usage in components:
import { luxFeatureFlags } from '../lib/luxFeatureFlag';

const MyComponent = () => {
  const luxEnabled = luxFeatureFlags.isLuxEnabled();

  return luxEnabled ? (
    <ButtonLux luxVariant="sapphire">Enhanced</ButtonLux>
  ) : (
    <Button variant="primary">Standard</Button>
  );
};
```

#### Success Criteria
- [ ] Feature flag system functional
- [ ] All visual regression tests pass
- [ ] Documentation complete and reviewed
- [ ] Performance benchmarks validated
- [ ] Accessibility compliance maintained
- [ ] Production build successful

---

## III. Visual Regression Testing Strategy

### Testing Infrastructure (Existing → Enhanced)

**Current Infrastructure**:
- Playwright E2E testing framework
- Visual regression config (`playwright.visual-regression.config.ts`)
- Snapshot storage (`tests/visual/__snapshots__/`)
- Cross-browser validation (Chromium, Firefox, WebKit)

**LUX Enhancements**:
```typescript
// tests/visual/lux-validation.spec.ts
import { test, expect } from '@playwright/test';

test.describe('LUX Design System Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    // Enable LUX feature flag for testing
    await page.addInitScript(() => {
      localStorage.setItem('lux-enabled', 'true');
    });

    // Wait for animations to stabilize
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500); // Allow CSS animations to complete
  });

  test('IdeaCard LUX rendering - all quadrants', async ({ page }) => {
    // Navigate to matrix view
    await page.goto('/project/test-project');

    // Capture baseline for each quadrant
    const quadrants = ['high-impact', 'quick-wins', 'strategic', 'delegate'];

    for (const quadrant of quadrants) {
      const card = page.locator(`[data-lux-quadrant="${quadrant}"]`).first();
      await card.waitFor({ state: 'visible' });

      // Capture static state
      await expect(card).toHaveScreenshot(`idea-card-${quadrant}-static.png`, {
        threshold: 0.15,
        maxDiffPixels: 500,
      });

      // Capture hover state
      await card.hover();
      await page.waitForTimeout(200); // Allow hover animation
      await expect(card).toHaveScreenshot(`idea-card-${quadrant}-hover.png`, {
        threshold: 0.2, // Higher tolerance for animations
        maxDiffPixels: 1000,
      });
    }
  });

  test('DesignMatrix LUX rendering - gradient backgrounds', async ({ page }) => {
    await page.goto('/project/test-project');

    const matrix = page.locator('[data-testid="design-matrix"]');
    await matrix.waitFor({ state: 'visible' });

    // Capture full matrix with LUX enhancements
    await expect(matrix).toHaveScreenshot('design-matrix-lux-full.png', {
      threshold: 0.15,
      maxDiffPixels: 2000,
      animations: 'disabled',
    });
  });

  test('Button LUX gem-tone variants', async ({ page }) => {
    await page.goto('/components/buttons');

    const variants = ['sapphire', 'emerald', 'amber', 'garnet', 'monochrome'];

    for (const variant of variants) {
      const button = page.locator(`[data-lux-variant="${variant}"]`);
      await button.waitFor({ state: 'visible' });

      await expect(button).toHaveScreenshot(`button-lux-${variant}.png`, {
        threshold: 0.1,
        maxDiffPixels: 300,
      });
    }
  });
});
```

### Baseline Management Strategy

```yaml
baseline_workflow:
  initial_capture:
    - Run with UPDATE_SNAPSHOTS=true
    - Review all generated screenshots manually
    - Commit baselines to git
    - Tag commit: "lux-baseline-v1.0.0"

  regression_detection:
    - Run tests on every commit
    - Flag differences >15% for manual review
    - Auto-fail on differences >25%
    - Generate visual diff reports (HTML)

  baseline_updates:
    - Document reason for update
    - Require manual approval for critical components
    - Store previous baselines in git history
    - Tag new baselines: "lux-baseline-v1.1.0"

cross_browser_strategy:
  browsers:
    - Chromium (primary development target)
    - Firefox (gecko engine validation)
    - WebKit (Safari simulation)

  tolerance_adjustments:
    chromium: 0.15 (15% threshold)
    firefox: 0.20 (20% threshold, font rendering differences)
    webkit: 0.18 (18% threshold, shadow rendering differences)

  failure_handling:
    - Single browser failure: WARNING (investigate)
    - Multiple browser failures: CRITICAL (block merge)
    - All browsers fail: REGRESSION CONFIRMED (rollback)
```

### Performance Regression Testing

```typescript
// tests/performance/lux-performance.spec.ts
import { test, expect } from '@playwright/test';

test.describe('LUX Performance Benchmarks', () => {
  test('IdeaCard hover response time <16ms', async ({ page }) => {
    await page.goto('/project/test-project');

    const card = page.locator('[data-testid="idea-card"]').first();
    await card.waitFor({ state: 'visible' });

    // Measure hover performance
    const metrics = await page.evaluate(async (cardSelector) => {
      const card = document.querySelector(cardSelector);
      const startTime = performance.now();

      // Trigger hover
      card.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

      // Wait for animation frame
      await new Promise(resolve => requestAnimationFrame(resolve));

      const endTime = performance.now();
      return endTime - startTime;
    }, '[data-testid="idea-card"]');

    expect(metrics).toBeLessThan(16); // Sub-frame requirement
  });

  test('DesignMatrix initial render <500ms', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/project/test-project');
    await page.waitForSelector('[data-testid="design-matrix"]', {
      state: 'visible',
    });

    const renderTime = Date.now() - startTime;
    expect(renderTime).toBeLessThan(500);
  });
});
```

---

## IV. Session Persistence Strategy

### Checkpoint System Architecture

```yaml
session_persistence:
  git_strategy:
    branch_naming: "feature/lux-phase-{N}-session-{DATE}"
    commit_frequency: "Every 30 minutes OR after major milestone"
    commit_message_format: |
      Phase {N}: {Description}

      Completed:
      - {Task 1}
      - {Task 2}

      In Progress:
      - {Task 3}

      Next Session:
      - {Task 4}

  documentation:
    checkpoint_files: "claudedocs/lux-phase-{N}-checkpoint.yaml"
    session_notes: "claudedocs/lux-session-{DATE}.md"
    decision_log: "claudedocs/lux-decisions.md"

  state_preservation:
    package_lock: "Commit package-lock.json after dependency changes"
    snapshots: "Commit visual baselines after validation"
    config_files: "Commit tailwind.config.js, vite.config.ts changes"
```

### Recovery Procedure

```markdown
# Session Recovery Procedure

## Scenario 1: Interrupted Mid-Phase
1. Checkout last phase branch: `git checkout feature/lux-phase-{N}`
2. Review checkpoint file: `claudedocs/lux-phase-{N}-checkpoint.yaml`
3. Identify last completed task
4. Run validation suite: `npm run test:visual`
5. Continue from next incomplete task

## Scenario 2: Visual Regression Detected
1. Review visual diff report: `test-results/visual-report/index.html`
2. Determine if intentional (design change) or regression (bug)
3. If regression:
   - Revert last commit: `git revert HEAD`
   - Re-run tests: `npm run test:visual`
   - Investigate root cause
4. If intentional:
   - Update baselines: `UPDATE_SNAPSHOTS=true npm run test:visual`
   - Document in decision log
   - Commit new baselines

## Scenario 3: Critical Bug in Production
1. Emergency rollback:
   ```bash
   git checkout main
   git revert <lux-merge-commit-sha>
   npm install
   npm run build
   npm run test
   ```
2. Deploy rollback build immediately
3. Investigate issue in feature branch
4. Fix and re-test before re-deployment

## Scenario 4: Performance Regression
1. Identify problematic component via performance tests
2. Checkout previous working commit
3. Compare implementation differences
4. Optimize current implementation:
   - Remove unnecessary animations
   - Reduce CSS selector complexity
   - Optimize React re-renders
5. Re-validate performance benchmarks
```

### Session Documentation Template

```markdown
# LUX Implementation Session Notes

**Date**: 2025-10-02
**Phase**: 3
**Session Duration**: 2.5 hours
**Developer**: [Name]

## Session Objectives
- [ ] Migrate IdeaCard to IdeaCardLux
- [ ] Validate drag-drop functionality
- [ ] Run visual regression suite

## Completed Tasks
- ✅ Created IdeaCardLux wrapper component
- ✅ Implemented gem-tone quadrant mapping
- ✅ Preserved drag-drop event handlers
- ✅ Added unit tests (100% coverage)

## In Progress
- 🔄 Visual regression testing (3/4 quadrants complete)

## Blockers
- None

## Decisions Made
1. **Decision**: Use subtle animation intensity for business components
   **Rationale**: Preserve professional feel, avoid distraction
   **Impact**: Reduced animation duration from 300ms → 200ms

2. **Decision**: Make LUX opt-in via `luxEnabled` prop
   **Rationale**: Safer gradual rollout, easier rollback
   **Impact**: Requires explicit prop in parent components

## Metrics
- Visual regression: 4.2% difference (acceptable)
- Performance: Hover response 12ms (target: <16ms) ✓
- Bundle size: +3KB (acceptable)

## Next Session
- [ ] Complete visual regression for all quadrants
- [ ] Migrate DesignMatrix component
- [ ] Run cross-browser validation
```

---

## V. Technical Dependencies & Risks

### Dependency Analysis

```yaml
critical_dependencies:
  react_ecosystem:
    - react: 18.2.0 (stable, no issues)
    - react-dom: 18.2.0 (stable)
    - @dnd-kit/core: 6.1.0 (CRITICAL: drag-drop for matrix)
    - @dnd-kit/sortable: 8.0.0 (CRITICAL: card reordering)

  styling:
    - tailwindcss: 3.3.6 (stable, supports custom config)
    - postcss: 8.4.32 (stable)
    - autoprefixer: 10.4.16 (stable)

  testing:
    - @playwright/test: 1.55.0 (stable, visual regression ready)
    - vitest: 3.2.4 (unit testing)
    - @testing-library/react: 16.3.0 (component testing)

  build:
    - vite: 5.0.8 (stable, fast builds)
    - typescript: 5.2.2 (stable)

dependency_risks:
  LOW_RISK:
    - Tailwind CSS extension (backward compatible)
    - CSS custom properties (modern browser support)
    - Playwright visual testing (no runtime impact)

  MEDIUM_RISK:
    - Component wrapper pattern (increases component tree depth)
    - CSS bundle size increase (mitigated by tree-shaking)
    - Animation performance on low-end devices

  HIGH_RISK:
    - @dnd-kit integration with enhanced animations (potential conflicts)
    - React re-render performance with complex CSS (requires profiling)
    - Cross-browser animation consistency (requires testing)

mitigation_strategies:
  dnd_kit_integration:
    - Test drag-drop with LUX animations disabled first
    - Gradually enable animations per component
    - Monitor performance metrics during drag operations
    - Fallback: Disable animations during active drag

  performance:
    - Use CSS transforms over position changes
    - Leverage GPU acceleration (will-change, transform)
    - Implement React.memo for expensive components
    - Use useCallback/useMemo for event handlers
    - Monitor with React DevTools Profiler

  cross_browser:
    - Use autoprefixer for CSS compatibility
    - Test on physical devices (macOS Safari, iOS Safari)
    - Adjust animation timing functions per browser
    - Document known rendering differences
```

### Risk Register

| Risk ID | Description | Probability | Impact | Mitigation | Owner |
|---------|-------------|-------------|---------|------------|-------|
| R1 | Drag-drop breaks with LUX animations | Medium | Critical | Comprehensive E2E testing, fallback to disable animations | Dev Team |
| R2 | Performance regression on mobile devices | Medium | High | Performance profiling, conditional animation complexity | Dev Team |
| R3 | Visual regression in production | Low | Critical | Staged rollout, feature flag, immediate rollback capability | DevOps |
| R4 | Cross-browser animation inconsistencies | High | Medium | Browser-specific CSS adjustments, lenient visual thresholds | QA Team |
| R5 | Bundle size exceeds performance budget | Low | Medium | Code splitting, lazy loading, CSS optimization | Dev Team |
| R6 | Accessibility regression (WCAG) | Low | Critical | Automated a11y testing, manual screen reader validation | Accessibility Lead |
| R7 | Session interruption data loss | Medium | Low | Frequent git commits, checkpoint documentation | Dev Team |
| R8 | Developer confusion (dual component APIs) | Medium | Medium | Clear documentation, migration guide, code examples | Tech Lead |

---

## VI. Rollback Strategy

### Rollback Readiness Checklist

```yaml
pre_implementation:
  - [ ] Create baseline git branch: main-pre-lux
  - [ ] Tag baseline commit: lux-baseline-pre-migration
  - [ ] Capture full visual regression baseline
  - [ ] Document current performance metrics
  - [ ] Backup production database (if applicable)
  - [ ] Verify CI/CD pipeline green
  - [ ] Communicate rollback procedure to team

per_phase:
  - [ ] Create phase-specific branch
  - [ ] Commit checkpoint documentation
  - [ ] Run full test suite before merging
  - [ ] Tag phase completion commit
  - [ ] Update rollback documentation

post_implementation:
  - [ ] Monitor production metrics for 48 hours
  - [ ] Set up automated performance alerts
  - [ ] Document known issues and workarounds
  - [ ] Create rollback runbook
  - [ ] Schedule post-implementation review
```

### Rollback Procedures

#### Level 1: Component-Level Rollback (LOW SEVERITY)
**Trigger**: Single component visual regression, minor performance issue
**Impact**: Isolated to specific component
**Downtime**: None

```bash
# Rollback single component
git checkout feature/lux-phase-{N}~1 -- src/components/ComponentName.tsx
git commit -m "Rollback: ComponentName due to [ISSUE]"
npm run test
npm run build
```

#### Level 2: Phase-Level Rollback (MEDIUM SEVERITY)
**Trigger**: Multiple component regressions, phase validation failures
**Impact**: Entire phase (e.g., all wrapper components)
**Downtime**: <5 minutes (re-deploy)

```bash
# Rollback entire phase
git revert <phase-merge-commit-sha>
npm install
npm run test:visual
npm run build
# Deploy rollback build
```

#### Level 3: Full Rollback (HIGH SEVERITY)
**Trigger**: Critical production bug, widespread visual regressions, >25% performance degradation
**Impact**: Entire LUX implementation
**Downtime**: <10 minutes (re-deploy)

```bash
# Full emergency rollback
git checkout main
git revert <lux-merge-commit-sha>
npm install
npm run test
npm run build
# Emergency deploy baseline build

# Optional: Feature flag disable (faster)
# Set VITE_LUX_ENABLED=false in environment
# Re-deploy current build (no code changes)
```

#### Level 4: Nuclear Option (CRITICAL)
**Trigger**: Unrecoverable production state, data corruption
**Impact**: Full application rollback
**Downtime**: 15-30 minutes (infrastructure rollback)

```bash
# Infrastructure-level rollback (Vercel/hosting platform)
vercel rollback <previous-deployment-url>

# OR Git-level nuclear option
git reset --hard <baseline-commit-sha>
git push --force origin main
# Trigger full re-deployment
```

### Rollback Validation

```yaml
validation_steps:
  component_level:
    - [ ] Visual regression tests pass
    - [ ] Unit tests pass for affected component
    - [ ] Manual smoke test in dev environment
    - [ ] Deploy to staging
    - [ ] Validate in staging (15 minutes)
    - [ ] Deploy to production

  phase_level:
    - [ ] Full visual regression suite passes
    - [ ] All unit tests pass
    - [ ] Performance benchmarks validated
    - [ ] E2E tests pass
    - [ ] Staging validation (1 hour)
    - [ ] Production deployment
    - [ ] Monitor for 24 hours

  full_rollback:
    - [ ] Complete test suite passes
    - [ ] Performance metrics match baseline
    - [ ] Visual regression baseline validated
    - [ ] Accessibility compliance maintained
    - [ ] Staging validation (4 hours)
    - [ ] Production deployment (off-peak hours)
    - [ ] 48-hour monitoring period
    - [ ] Post-mortem review scheduled
```

---

## VII. Implementation Timeline

### Gantt Chart (Estimated)

```
Phase 1: Foundation Layer (Sessions 1-2)
├─ Session 1 [2h]: CSS Tokens + Tailwind Config
│  └─ Checkpoint: lux-phase-1-s1
└─ Session 2 [2h]: Visual Baselines + Validation
   └─ Checkpoint: lux-phase-1-complete

Phase 2: Component Wrappers (Sessions 3-5)
├─ Session 3 [2h]: ButtonLux + Unit Tests
│  └─ Checkpoint: lux-phase-2-s3
├─ Session 4 [2h]: InputLux + SelectLux
│  └─ Checkpoint: lux-phase-2-s4
└─ Session 5 [2h]: Visual Regression + Documentation
   └─ Checkpoint: lux-phase-2-complete

Phase 3: Critical Components (Sessions 6-8)
├─ Session 6 [2.5h]: IdeaCardLux Implementation
│  └─ Checkpoint: lux-phase-3-s6
├─ Session 7 [2.5h]: DesignMatrixLux Implementation
│  └─ Checkpoint: lux-phase-3-s7
└─ Session 8 [2h]: Comprehensive Testing + Manual QA
   └─ Checkpoint: lux-phase-3-complete

Phase 4: Application Shell (Sessions 9-12)
├─ Session 9 [2h]: Feature Flag System
│  └─ Checkpoint: lux-phase-4-s9
├─ Session 10 [2h]: Application Shell Migration
│  └─ Checkpoint: lux-phase-4-s10
├─ Session 11 [1.5h]: Documentation + Handoff
│  └─ Checkpoint: lux-phase-4-s11
└─ Session 12 [1.5h]: Final Validation + Production Preparation
   └─ Checkpoint: lux-phase-4-complete

Total Estimated Time: 24 hours across 12 sessions
```

### Milestones

| Milestone | Deliverable | Target Date | Success Criteria |
|-----------|-------------|-------------|------------------|
| M1: Foundation Complete | CSS tokens + Tailwind config | Session 2 | Visual tests pass, no regressions |
| M2: Wrappers Complete | ButtonLux, InputLux, SelectLux | Session 5 | 100% backward compatible, tests pass |
| M3: Critical Components | IdeaCardLux, DesignMatrixLux | Session 8 | Zero functional regressions, performance maintained |
| M4: Production Ready | Feature flags, docs, full app | Session 12 | All tests green, rollback procedure validated |

---

## VIII. Success Metrics

### Quantitative Metrics

```yaml
performance:
  hover_response_time:
    baseline: 8ms
    target: <16ms
    critical_threshold: 32ms

  initial_render_time:
    baseline: 420ms
    target: <500ms
    critical_threshold: 800ms

  bundle_size:
    baseline: 508KB (minified+gzipped)
    target: <530KB
    critical_threshold: 560KB

  build_time:
    baseline: 7.8s
    target: <10s
    critical_threshold: 15s

quality:
  test_coverage:
    baseline: 85%
    target: >85%
    critical_threshold: 80%

  visual_regression_pass_rate:
    baseline: 100%
    target: >95%
    critical_threshold: 90%

  accessibility_score:
    baseline: WCAG 2.1 AA
    target: WCAG 2.1 AA
    critical_threshold: WCAG 2.1 A

business_impact:
  functional_regressions:
    baseline: 0
    target: 0
    critical_threshold: 0

  production_incidents:
    target: 0
    critical_threshold: 1

  rollback_events:
    target: 0
    acceptable: 1 per phase
```

### Qualitative Metrics

```yaml
developer_experience:
  - API clarity (backward compatibility maintained)
  - Documentation quality (comprehensive migration guides)
  - Debugging ease (clear error messages, source maps)
  - Migration effort (minimal code changes required)

user_experience:
  - Visual polish (gem-tone accents enhance aesthetics)
  - Animation smoothness (60fps maintained)
  - Perceived performance (no perceived slowdown)
  - Accessibility (no degradation in usability)

maintainability:
  - Code organization (clear separation of LUX vs base components)
  - Technical debt (no increase from baseline)
  - Testing infrastructure (improved visual regression coverage)
  - Documentation (complete migration playbook)
```

---

## IX. Technical Approach Summary

### CSS-in-JS vs Tailwind Utilities vs Component Wrappers

**CHOSEN APPROACH: Component Wrappers + Tailwind Utility Extensions**

**Rationale**:
1. **Backward Compatibility**: Wrapper pattern preserves existing component API 100%
2. **Progressive Enhancement**: Opt-in `luxEnabled` prop allows gradual migration
3. **Performance**: Tailwind utilities compile to optimized CSS, no runtime JS overhead
4. **Maintainability**: Clear separation between base and enhanced components
5. **Rollback Safety**: Easy to revert to base components without code changes

**Rejected Alternatives**:

| Approach | Pros | Cons | Rejection Reason |
|----------|------|------|------------------|
| CSS-in-JS (styled-components) | Component co-location, dynamic styles | Runtime overhead, bundle size increase | Performance impact unacceptable |
| Direct Component Modification | Fewer files, simpler structure | High risk, difficult rollback, breaks existing usage | Too risky for critical components |
| Atomic Migration | Clean slate, no legacy code | Massive effort (59K LOC), high downtime risk | Scope too large, timeline unrealistic |

### Implementation Patterns

#### Pattern 1: Token-First Design
```css
/* Define tokens first */
:root {
  --lux-sapphire-accent: #1D4ED8;
  --lux-shadow-card: 0px 2px 6px rgba(0, 0, 0, 0.06);
}

/* Apply via Tailwind utilities */
.lux-button--sapphire {
  @apply shadow-[var(--lux-shadow-card)];
  color: var(--lux-sapphire-accent);
}
```

#### Pattern 2: Wrapper Component
```typescript
// Extend base component with LUX enhancements
export const ComponentLux = ({ luxVariant, ...baseProps }) => {
  const luxClasses = luxVariant ? `lux-${luxVariant}` : '';
  return <BaseComponent {...baseProps} className={luxClasses} />;
};
```

#### Pattern 3: Feature Flag Integration
```typescript
// Runtime feature detection
const LuxAwareComponent = (props) => {
  const luxEnabled = useLuxFeatureFlag();
  return luxEnabled ? <ComponentLux {...props} /> : <Component {...props} />;
};
```

---

## X. Conclusion & Next Steps

### Immediate Actions (Pre-Implementation)

1. **Team Alignment**:
   - [ ] Review architecture document with team
   - [ ] Identify primary and backup developers
   - [ ] Schedule 12 implementation sessions (2-3 hours each)
   - [ ] Set up communication channels (Slack, status updates)

2. **Environment Preparation**:
   - [ ] Create feature branch: `feature/lux-foundation`
   - [ ] Verify all dependencies installed and up-to-date
   - [ ] Run baseline test suite (capture green state)
   - [ ] Set up visual regression baseline storage

3. **Documentation Setup**:
   - [ ] Create `claudedocs/lux-decisions.md` decision log
   - [ ] Prepare checkpoint template files
   - [ ] Set up session notes directory structure
   - [ ] Initialize risk register tracking

4. **Validation Preparation**:
   - [ ] Capture current performance metrics
   - [ ] Run full visual regression baseline
   - [ ] Document current bundle size and build times
   - [ ] Create rollback procedure quick reference card

### Session 1 Kickoff Checklist

```bash
# Pre-session verification
npm install
npm run test
npm run test:visual
npm run build

# Create feature branch
git checkout -b feature/lux-phase-1-foundation
git push -u origin feature/lux-phase-1-foundation

# Verify environment
echo "Node: $(node -v)"
echo "NPM: $(npm -v)"
npm run type-check

# Capture baseline
UPDATE_SNAPSHOTS=true npm run test:visual
git add tests/visual/__snapshots__
git commit -m "Baseline: Pre-LUX visual regression snapshots"
git tag lux-baseline-v0.0.0

# Ready to start Phase 1!
```

### Long-Term Recommendations

1. **Design System Governance**:
   - Establish LUX component contribution guidelines
   - Create component showcase (Storybook or similar)
   - Document design token usage standards
   - Set up automated design token validation

2. **Performance Monitoring**:
   - Integrate performance budgets into CI/CD
   - Set up automated performance regression alerts
   - Implement real-user monitoring (RUM) for production
   - Create performance dashboard for team visibility

3. **Accessibility Commitment**:
   - Automated a11y testing in CI/CD pipeline
   - Regular manual screen reader validation
   - Keyboard navigation testing for all new components
   - Color contrast validation tools integration

4. **Continuous Improvement**:
   - Quarterly design system review
   - User feedback collection and analysis
   - Component usage analytics
   - Technical debt tracking and remediation

---

## Appendix A: File Structure

```
design-matrix-app/
├── src/
│   ├── styles/
│   │   ├── lux-tokens.css          # NEW: Design tokens
│   │   ├── lux-animations.css      # NEW: Animation keyframes
│   │   ├── lux-utilities.css       # NEW: Utility classes
│   │   └── design-tokens.css       # EXISTING: Preserve
│   │
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Button.tsx          # EXISTING: Preserve
│   │   │   ├── ButtonLux.tsx       # NEW: Wrapper component
│   │   │   ├── Input.tsx           # EXISTING: Preserve
│   │   │   ├── InputLux.tsx        # NEW: Wrapper component
│   │   │   ├── Select.tsx          # EXISTING: Preserve
│   │   │   └── SelectLux.tsx       # NEW: Wrapper component
│   │   │
│   │   ├── IdeaCardComponent.tsx   # EXISTING: Preserve
│   │   ├── IdeaCardLux.tsx         # NEW: Enhanced version
│   │   ├── DesignMatrix.tsx        # EXISTING: Preserve
│   │   └── DesignMatrixLux.tsx     # NEW: Enhanced version
│   │
│   ├── hooks/
│   │   ├── usePremiumAnimations.ts # EXISTING: Preserve
│   │   └── useLuxFeatureFlag.ts    # NEW: Feature flag hook
│   │
│   └── lib/
│       └── luxFeatureFlag.ts       # NEW: Feature flag logic
│
├── tests/
│   └── visual/
│       ├── __snapshots__/
│       │   ├── lux-baseline/       # NEW: Pre-migration baselines
│       │   └── lux-current/        # NEW: Current LUX snapshots
│       │
│       ├── lux-validation.spec.ts  # NEW: LUX visual tests
│       └── lux-performance.spec.ts # NEW: LUX performance tests
│
├── claudedocs/
│   ├── ANIMATED_LUX_IMPLEMENTATION_ARCHITECTURE.md  # THIS FILE
│   ├── lux-decisions.md                             # NEW: Decision log
│   ├── lux-phase-1-checkpoint.yaml                  # NEW: Phase checkpoints
│   ├── lux-phase-2-checkpoint.yaml
│   ├── lux-phase-3-checkpoint.yaml
│   ├── lux-phase-4-checkpoint.yaml
│   └── lux-session-notes/                           # NEW: Session notes
│       ├── 2025-10-02-session-1.md
│       ├── 2025-10-02-session-2.md
│       └── ...
│
└── tailwind.config.js              # MODIFY: Extend with LUX tokens
```

## Appendix B: Quick Reference Commands

```bash
# Development Commands
npm run dev                              # Start dev server
npm run build                            # Production build
npm run test                             # Run unit tests
npm run test:visual                      # Run visual regression
npm run test:visual:update               # Update visual baselines

# LUX-Specific Commands
VITE_LUX_ENABLED=true npm run dev        # Enable LUX in development
UPDATE_SNAPSHOTS=true npm run test:visual # Update LUX baselines

# Git Workflow
git checkout -b feature/lux-phase-{N}    # Create phase branch
git commit -m "Phase {N}: {description}" # Checkpoint commit
git tag lux-phase-{N}-complete           # Tag phase completion

# Rollback Commands
git revert <commit-sha>                  # Revert specific commit
git checkout main-pre-lux                # Rollback to baseline
vercel rollback <deployment-url>         # Infrastructure rollback
```

---

**Document Version**: 1.0.0
**Last Updated**: 2025-10-02
**Author**: System Architect
**Status**: Ready for Implementation
