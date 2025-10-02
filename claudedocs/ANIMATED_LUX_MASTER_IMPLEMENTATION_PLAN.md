# Animated Lux Design System - Master Implementation Plan

**Project**: Prioritas Design Matrix Application
**Design System**: Animated Lux (from http://localhost:3003/#lux-animated)
**Start Date**: 2025-10-02
**Status**: READY FOR EXECUTION
**Reference**: `src/components/demo/MonochromeLuxAnimated.tsx`

---

## Executive Summary

This document provides a comprehensive implementation plan for applying the Animated Lux design system across the entire Prioritas application, **excluding idea cards and the matrix canvas components**.

### Scope

- **Total Components**: 87 identified
- **Exclusions**: 8 components (matrix, idea cards)
- **Migration Target**: 79 components
- **Estimated Effort**: 6-8 weeks (24 hours execution time)

---

## Design System Specification

### Core Principles

1. **Calm, Confident, Purposeful Motion**
2. **Monochromatic Sophistication** with gem-tone accents
3. **Width-Dominant Shadows** (never darker)
4. **Subtle Movement** (≤6px translations, ≤4% tints)
5. **Accessibility First** (WCAG 2.1 AA, reduced-motion support)

### Motion System

```css
/* Durations */
--duration-instant: 120ms;   /* Hover feedback, pressed states */
--duration-fast: 140ms;      /* Button states, quick transitions */
--duration-base: 190ms;      /* Input focus, standard transitions */
--duration-moderate: 220ms;  /* Overlays, moderate animations */
--duration-slow: 260ms;      /* Large transitions, page changes */

/* Easing Functions */
--easing-glide: cubic-bezier(0.2, 0.6, 0, 0.98);  /* Signature "confident glide" */
--easing-standard: ease;
--easing-in: ease-in;
--easing-out: ease-out;
```

### Color Palette

#### Canvas & Surfaces
```css
--canvas-primary: #FAFBFC;     /* Main background */
--canvas-secondary: #F9FAFB;   /* Hover backgrounds */
--canvas-tertiary: #F3F4F6;    /* Active states */
--surface-primary: #FFFFFF;    /* Cards, modals */
--surface-secondary: #FEFEFE;  /* +2% tint for hover */
```

#### Graphite Text Hierarchy
```css
--graphite-900: #111827;  /* Extreme emphasis */
--graphite-800: #1F2937;  /* Primary text, headings */
--graphite-700: #374151;  /* Primary buttons, strong emphasis */
--graphite-600: #4B5563;  /* Secondary emphasis */
--graphite-500: #6B7280;  /* Secondary text, labels */
--graphite-400: #9CA3AF;  /* Tertiary text, placeholders */
--graphite-300: #D1D5DB;  /* Disabled text */
--graphite-200: #E5E7EB;  /* Dividers, subtle borders */
--graphite-100: #F3F4F6;  /* Subtle backgrounds */
--graphite-50: #F9FAFB;   /* Hover backgrounds */
```

#### Hairline Borders
```css
--hairline-default: #E8EBED;  /* Standard 1px borders */
--hairline-hover: #D1D5DB;    /* Hover state borders */
--hairline-focus: #3B82F6;    /* Focus state (sapphire) */
```

#### Gem-Tone Accents
```css
/* Sapphire - Information & Primary Actions */
--sapphire-50: #EFF6FF;
--sapphire-500: #3B82F6;
--sapphire-700: #1D4ED8;

/* Emerald - Success */
--emerald-50: #ECFDF5;
--emerald-700: #047857;

/* Amber - Warning */
--amber-50: #FFFBEB;
--amber-700: #B45309;

/* Garnet - Error */
--garnet-50: #FEF2F2;
--garnet-700: #B91C1C;
```

### Shadow System
```css
/* Width-dominant, never darker */
--shadow-button: 0 1px 2px rgba(0, 0, 0, 0.05);
--shadow-button-hover: 0 2px 8px rgba(0, 0, 0, 0.08);
--shadow-card: 0 1px 3px rgba(0, 0, 0, 0.02), 0 8px 24px rgba(0, 0, 0, 0.03);
--shadow-card-hover: 0 1px 3px rgba(0, 0, 0, 0.03), 0 12px 32px rgba(0, 0, 0, 0.05);
--shadow-modal: 0 4px 16px rgba(0, 0, 0, 0.08), 0 20px 48px rgba(0, 0, 0, 0.12);
--shadow-focus-ring: 0 0 0 4px rgba(59, 130, 246, 0.1);
```

---

## Exclusion List (DO NOT MODIFY)

### Matrix Components
- ✋ `src/components/DesignMatrix.tsx`
- ✋ `src/components/NewDesignMatrix.tsx`
- ✋ `src/components/matrix/MatrixContainer.tsx`
- ✋ `src/components/matrix/MatrixGrid.tsx`
- ✋ `src/components/matrix/MatrixQuadrants.tsx`
- ✋ `src/components/matrix/MatrixCards.tsx`

### Idea Card Components
- ✋ `src/components/IdeaCardComponent.tsx`
- ✋ `src/components/matrix/OptimizedIdeaCard.tsx`

### Rationale
These components have custom drag-and-drop, positioning logic, and performance optimizations that must not be altered.

---

## Implementation Phases

### Phase 1: Foundation Layer (Week 1-2, Sessions 1-2)

**Goal**: Establish design tokens, CSS infrastructure, Tailwind configuration

**Deliverables**:
1. `src/styles/monochrome-lux-tokens.css` - CSS custom properties
2. `src/styles/monochrome-lux-animations.css` - Animation utilities
3. `tailwind.config.js` - Extended with Lux tokens
4. `src/index.css` - Import new stylesheets
5. Visual regression baselines captured

**Risk**: 🟢 LOW (no functionality changes)

**Validation Criteria**:
- [ ] CSS tokens accessible via `var(--graphite-500)` etc.
- [ ] Tailwind classes work: `bg-graphite-700`, `shadow-button`
- [ ] No visual regression on existing components
- [ ] No console errors

---

### Phase 2: Core Components (Week 2-4, Sessions 3-6)

**Goal**: Migrate high-usage atomic components

**Components**:
1. **Buttons** (20 instances)
   - Primary, Secondary, Tertiary, Destructive
   - Hover lift animation (-1px)
   - Focus ring animation (190ms)

2. **Form Inputs** (15 instances)
   - Text inputs, textareas, selects
   - Focus ring with sapphire border
   - Icon color transitions

3. **Cards** (25 instances, excluding idea cards)
   - Hover elevation (shadow expansion)
   - Background tint (+2%)
   - No translate movement

**Risk**: 🟡 MEDIUM (high usage, many dependents)

**Validation Criteria**:
- [ ] All buttons have -1px hover lift
- [ ] All inputs have smooth focus ring (190ms sapphire)
- [ ] All cards have shadow expansion on hover
- [ ] No functional regressions
- [ ] Visual regression <10%

---

### Phase 3: Layout & Navigation (Week 3-4, Sessions 5-7)

**Goal**: Update application shell and navigation

**Components**:
1. **Sidebar** (collapsible with animations)
   - Left rail indicator slides between items
   - Section collapse/expand
   - Tooltip on collapsed state
   - Nav item hover tint

2. **AppLayout**
   - Canvas background (#FAFBFC)
   - Header styling

3. **ProjectHeader**
   - Action button styling
   - Breadcrumb links

**Risk**: 🔴 HIGH (affects all pages)

**Validation Criteria**:
- [ ] Sidebar animations smooth (280ms glide)
- [ ] Left rail indicator slides correctly
- [ ] Collapse/expand functional
- [ ] All pages render correctly
- [ ] No navigation breakage

---

### Phase 4: Modals & Overlays (Week 4-5, Sessions 7-9)

**Goal**: Migrate all modal components

**Components**:
1. **BaseModal** (foundation)
2. **AddIdeaModal**
3. **EditIdeaModal**
4. **AIStarterModal**
5. **FeatureDetailModal**
6. **RoadmapExportModal**
7. All other modals (13 total)

**Animations**:
- Modal entrance (scale 0.98 → 1.0, opacity 0 → 1, 220ms)
- Backdrop fade (opacity 0 → 1, 220ms)
- Modal exit (reverse, 190ms ease-in)

**Risk**: 🟡 MEDIUM (isolated components)

**Validation Criteria**:
- [ ] All modals animate smoothly
- [ ] Backdrop fades correctly
- [ ] ESC key closes modals
- [ ] Focus trap works
- [ ] No z-index conflicts

---

### Phase 5: Feature Components (Week 5-7, Sessions 9-11)

**Goal**: Migrate domain-specific components

**Component Groups**:
1. **Roadmap Components** (8 components)
2. **Timeline Components** (6 components)
3. **Feature Modal Sub-components** (4 components)
4. **AI Starter Sub-components** (4 components)
5. **Project Management** (3 components)

**Risk**: 🟢 LOW (domain-specific, low coupling)

**Validation Criteria**:
- [ ] Roadmap renders correctly
- [ ] Timeline animations smooth
- [ ] Feature modal functional
- [ ] AI starter wizard works
- [ ] No data loss

---

### Phase 6: Pages & Utilities (Week 7-8, Sessions 11-12)

**Goal**: Complete remaining components

**Components**:
1. **Page Components** (8 pages)
2. **Admin Components** (5 components)
3. **Utility Components** (11 components)
4. **Export Components** (3 components)

**Risk**: 🟢 LOW (low usage, isolated)

**Validation Criteria**:
- [ ] All pages functional
- [ ] Admin portal works
- [ ] Error boundaries functional
- [ ] File upload/viewer works
- [ ] Export functionality intact

---

## Session Persistence Framework

### Checkpoint System

**Git Branching Strategy**:
```bash
feature/lux-phase-1-foundation
feature/lux-phase-2-core-components
feature/lux-phase-3-layout-navigation
feature/lux-phase-4-modals
feature/lux-phase-5-features
feature/lux-phase-6-completion
```

**Commit Frequency**:
- Every 30 minutes OR
- After each major milestone
- Before risky operations

**Checkpoint Files** (YAML format):
```yaml
# claudedocs/checkpoints/phase-1-checkpoint.yaml
phase: 1
status: in_progress
completed_tasks:
  - Create CSS tokens file
  - Update Tailwind config
started: 2025-10-02T10:00:00Z
last_updated: 2025-10-02T11:30:00Z
next_steps:
  - Generate visual baselines
  - Validate token accessibility
```

**Session Notes** (Markdown):
```markdown
# Session 2025-10-02-session-1.md
## Phase: 1 - Foundation
## Duration: 90 minutes
## Completed:
- Created monochrome-lux-tokens.css
- Updated tailwind.config.js
## Issues:
- None
## Next Session:
- Generate baselines
- Start Phase 2
```

---

## Visual Regression Testing

### Baseline Generation

**Command**:
```bash
npm run test:visual -- --update-snapshots --grep "lux-baseline"
```

**Baseline Tags**:
- `lux-baseline-v0.0.0-pre-migration` (before any changes)
- `lux-baseline-v1.0.0-foundation` (after Phase 1)
- `lux-baseline-v2.0.0-components` (after Phase 2)
- `lux-baseline-v3.0.0-layout` (after Phase 3)
- `lux-baseline-v4.0.0-modals` (after Phase 4)
- `lux-baseline-v5.0.0-features` (after Phase 5)
- `lux-baseline-v6.0.0-production` (final)

### Comparison Thresholds

| Component Type | Threshold | Rationale |
|----------------|-----------|-----------|
| Design Tokens | 5% | Tight tolerance for CSS variables |
| Buttons Static | 10% | Color, shadow changes |
| Buttons Hover | 20% | Animation variance |
| Inputs Focus | 20% | Ring animation |
| Cards Hover | 15% | Shadow expansion |
| Modals | 25% | Entrance/exit animations |
| Idea Cards (excluded) | N/A | No changes |
| Matrix (excluded) | N/A | No changes |

### Test Execution

**Per-Phase Validation**:
```bash
# After each phase
npm run test:visual -- --grep "phase-{N}"
```

**Full Suite**:
```bash
npm run test:visual:lux
```

---

## Rollback Strategy

### Level 1: Component Rollback
**Trigger**: Single component breaks
**Action**: Revert specific component file
**Time**: <5 minutes

### Level 2: Phase Rollback
**Trigger**: Phase validation fails
**Action**: `git reset --hard {previous-phase-tag}`
**Time**: <10 minutes

### Level 3: Full Rollback
**Trigger**: Critical production issue
**Action**: `git revert {migration-start}..HEAD`
**Time**: <30 minutes

### Level 4: Nuclear Option
**Trigger**: Catastrophic failure
**Action**: Deploy previous production tag
**Time**: <60 minutes

---

## Acceptance Criteria

### Functional Requirements
- [ ] Zero functional regressions
- [ ] All user workflows intact
- [ ] All tests passing
- [ ] No console errors/warnings
- [ ] Backward compatibility maintained

### Visual Requirements
- [ ] All buttons have -1px hover lift
- [ ] All inputs have sapphire focus ring (190ms)
- [ ] All cards have shadow expansion on hover
- [ ] All modals animate smoothly (220ms entrance)
- [ ] All navigation items have background tint
- [ ] Sidebar collapses/expands smoothly (280ms)

### Performance Requirements
- [ ] 60fps animations (no janky)
- [ ] GPU-accelerated properties only
- [ ] No layout thrashing
- [ ] Bundle size <+30KB
- [ ] Initial render <500ms

### Accessibility Requirements
- [ ] WCAG 2.1 AA compliance
- [ ] Focus rings visible
- [ ] Keyboard navigation intact
- [ ] Screen reader functional
- [ ] Reduced motion support
- [ ] Touch targets ≥44x44px

---

## Risk Mitigation

### High-Risk Areas

**Risk**: Breaking drag-and-drop in matrix
**Mitigation**: Strict exclusion list enforcement, no changes to matrix components
**Validation**: Manual drag-drop testing after each phase

**Risk**: Performance degradation
**Mitigation**: GPU-accelerated properties only, performance profiling
**Validation**: Lighthouse CI, <16ms frame times

**Risk**: Accessibility regressions
**Mitigation**: Automated axe-playwright tests, manual screen reader testing
**Validation**: 100% WCAG AA compliance

### Medium-Risk Areas

**Risk**: Z-index conflicts
**Mitigation**: Audit z-index hierarchy, use CSS variables
**Validation**: Visual inspection of modals/dropdowns

**Risk**: Focus ring visibility
**Mitigation**: Test on all background colors
**Validation**: Manual testing on dark/light backgrounds

### Low-Risk Areas

**Risk**: Browser compatibility
**Mitigation**: Test on Chromium, Firefox, WebKit
**Validation**: Playwright cross-browser tests

---

## Success Metrics

### Quantitative
- **Visual Consistency**: 100% of non-excluded components use Lux tokens
- **Animation Adoption**: 100% of interactive elements have micro-animations
- **Test Coverage**: 85%+ maintained
- **Performance**: 60fps, <500ms initial render
- **Accessibility**: 100% WCAG 2.1 AA

### Qualitative
- **User Feedback**: "Calm, confident, purposeful" aesthetic achieved
- **Developer Experience**: Migration process smooth, well-documented
- **Code Quality**: Maintainable, consistent patterns

---

## Next Steps

1. **Review this plan** - Ensure alignment with requirements
2. **Approve execution** - Green light to proceed
3. **Start Phase 1** - Create foundation layer
4. **Checkpoint regularly** - Maintain session persistence
5. **Validate continuously** - Run tests after each phase
6. **Document thoroughly** - Update session notes

---

## References

- **Design System Spec**: `claudedocs/MONOCHROME_LUX_DESIGN_SYSTEM.md`
- **Animation Guide**: `claudedocs/ANIMATED_DEMO_GUIDE.md`
- **Reference Implementation**: `src/components/demo/MonochromeLuxAnimated.tsx`
- **Component Inventory**: `claudedocs/COMPONENT_INVENTORY_REPORT.md` (generated)
- **Visual Testing Strategy**: `claudedocs/LUX_VISUAL_REGRESSION_TESTING_STRATEGY.md` (generated)

---

**Document Version**: 1.0
**Last Updated**: 2025-10-02
**Status**: APPROVED - READY FOR EXECUTION
**Estimated Timeline**: 6-8 weeks (24 hours execution)
