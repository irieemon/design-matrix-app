# Lux Design System - Test Quick Reference

Quick reference for running and understanding Lux design system tests.

## Quick Commands

```bash
# Run all Lux tests
npm test tests/lux-*.spec.ts

# Run specific test suite
npm test tests/lux-design-system-visual.spec.ts      # Visual regression
npm test tests/lux-form-inputs-functional.spec.ts    # Form input validation
npm test tests/lux-component-states.spec.ts          # State validation
npm test tests/lux-integration.spec.ts               # Integration tests

# Run with UI for debugging
npm test tests/lux-*.spec.ts --ui

# Update visual baselines
npm test tests/lux-design-system-visual.spec.ts --update-snapshots
```

---

## Test Files Overview

| File | Tests | What It Validates |
|------|-------|-------------------|
| `lux-design-system-visual.spec.ts` | 25+ | Visual snapshots, color tokens, NO legacy gradients |
| `lux-form-inputs-functional.spec.ts` | 20+ | Input/Textarea white backgrounds, focus states |
| `lux-component-states.spec.ts` | 30+ | Gem-tone colors for semantic states |
| `lux-integration.spec.ts` | 25+ | Full workflows, cross-component consistency |

---

## Critical Validations

### 🚨 MUST PASS - Background Fix
```typescript
// Tests verify inputs DON'T turn black on hover
input:hover { background: white !important; } // ✅ CRITICAL FIX
```

**Test File**: `lux-form-inputs-functional.spec.ts`
**Tests**:
- "input maintains white background on hover"
- "textarea maintains white background on hover"

---

### 🎨 Color Tokens Reference

#### Gem-Tone Accents (Semantic Only)
```css
--garnet-50: #FEF2F2    /* Error/Danger backgrounds */
--garnet-700: #B91C1C   /* Error/Danger text */

--sapphire-50: #EFF6FF   /* Info backgrounds */
--sapphire-100: #DBEAFE  /* Icon containers */
--sapphire-600: #2563EB  /* Interactive elements */

--emerald-50: #ECFDF5    /* Success backgrounds */
--emerald-700: #047857   /* Success text */

--amber-50: #FFFBEB      /* Warning backgrounds */
--amber-700: #B45309     /* Warning text */
```

#### Graphite Neutrals (Structure)
```css
--graphite-900: #111827  /* Extreme emphasis */
--graphite-800: #1F2937  /* Primary text, headings */
--graphite-700: #374151  /* Primary buttons, emphasis */
--graphite-600: #4B5563  /* Secondary text */
--graphite-500: #6B7280  /* Labels */
--graphite-400: #9CA3AF  /* Placeholders */
--graphite-300: #D1D5DB  /* Disabled text */
--graphite-200: #E5E7EB  /* Borders */
--graphite-100: #F3F4F6  /* Subtle backgrounds */
--graphite-50: #F9FAFB   /* Hover backgrounds */
```

---

## Test Selectors Reference

### Common Test Patterns
```typescript
// Find form inputs
page.locator('input[type="text"]')
page.locator('textarea')

// Find buttons by text
page.getByText('Add Idea')
page.getByText('Save')

// Find modals
page.locator('[role="dialog"]')

// Find stat cards
page.locator('.rounded-xl.p-6.border')

// Find icon containers
page.locator('.w-10.h-10.rounded-xl')
```

---

## Expected Color Usage

### ✅ Correct Usage
```
- Error messages: garnet-700 text on garnet-50 background
- Success messages: emerald-700 text on emerald-50 background
- Info sections: sapphire-700 text on sapphire-50 background
- Interactive hover: sapphire-600 background
- Primary text: graphite-800
- Secondary text: graphite-600
- Borders: graphite-200
- Disabled: graphite-300
```

### ❌ Should NOT Find
```
- Purple gradients: #9333ea, #a855f7
- Legacy blue: #3b82f6 (except sapphire)
- Legacy green: #22c55e
- Black input backgrounds on hover: rgb(0, 0, 0)
```

---

## Visual Snapshot Locations

```
tests/
  lux-design-system-visual.spec.ts-snapshots/
    collaboration-stat-card.png
    role-badge.png
    add-idea-modal-lux.png
    edit-idea-modal-lux.png
    ai-idea-modal-lux.png
    lux-full-page.png
    lux-mobile.png
    lux-tablet.png
```

---

## Debugging Failures

### Visual Test Failed
```bash
# 1. Check the pixel diff report
open test-results/lux-design-system-visual/index.html

# 2. Review the diff image
# 3. If change is intentional, update baseline:
npm test tests/lux-design-system-visual.spec.ts --update-snapshots
```

### Functional Test Failed
```bash
# 1. Run with headed browser to see what's happening
npm test tests/lux-form-inputs-functional.spec.ts --headed

# 2. Check browser console for errors
# 3. Verify component is rendering correctly
```

### State Test Failed
```bash
# 1. Run specific test
npm test tests/lux-component-states.spec.ts -g "error messages use garnet-700"

# 2. Use UI mode for debugging
npm test tests/lux-component-states.spec.ts --ui
```

---

## Test Coverage Checklist

### Visual Regression ✅
- [ ] No legacy purple/blue/green gradients
- [ ] Graphite neutrals for base UI
- [ ] Gem-tone accents for semantic states
- [ ] Stat cards use Lux tokens
- [ ] Modals use Lux tokens
- [ ] Forms use Lux tokens

### Functional Validation ✅
- [ ] Inputs maintain white background on hover
- [ ] Textareas maintain white background on hover
- [ ] Focus states show sapphire ring
- [ ] Error states show garnet colors
- [ ] Success states show emerald colors
- [ ] Disabled states show graphite-300

### Component States ✅
- [ ] Garnet for error/danger
- [ ] Sapphire for info/interactive
- [ ] Emerald for success
- [ ] Amber for warning
- [ ] Graphite for neutrals

### Integration ✅
- [ ] Full page layouts consistent
- [ ] Navigation maintains theme
- [ ] Cross-component consistency
- [ ] Responsive behavior correct
- [ ] Accessibility maintained

---

## Common Test Patterns

### Check Background Color
```typescript
const bgColor = await element.evaluate((el) => {
  return window.getComputedStyle(el).backgroundColor;
});
expect(bgColor).toMatch(/255.*255.*255/); // White
```

### Check Text Color
```typescript
const textColor = await element.evaluate((el) => {
  return window.getComputedStyle(el).color;
});
expect(textColor).toMatch(/31.*41.*55/); // graphite-800
```

### Check for Legacy Colors
```typescript
expect(bgColor).not.toContain('147, 51, 234'); // NO purple
expect(bgColor).not.toContain('0, 0, 0');      // NO black
```

### Visual Snapshot
```typescript
await expect(element).toHaveScreenshot('name.png', {
  threshold: 0.1,
  maxDiffPixels: 100
});
```

---

## CI/CD Integration

### GitHub Actions Example
```yaml
- name: Run Lux Tests
  run: npx playwright test tests/lux-*.spec.ts

- name: Upload Test Results
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: lux-test-results
    path: test-results/
```

---

## When to Update Tests

### Add New Tests When:
- New component migrated to Lux
- New interaction pattern added
- New state variation introduced

### Update Baselines When:
- Intentional design token changes
- Layout adjustments made
- New visual states added

### Run Full Suite When:
- Before merging PR
- After updating Lux tokens
- When modifying core components

---

## Test Results Interpretation

### All Green ✅
- Lux migration successful
- No legacy colors found
- All components consistent
- Ready to merge

### Visual Failures ⚠️
- Check pixel diff report
- Verify if change is intentional
- Update baseline if correct

### Functional Failures 🚨
- Critical issue detected
- Fix before merging
- Verify background fix working
- Check gem-tone color usage

### Integration Failures ⚠️
- Check user flow validity
- Verify test data exists
- Check timing/race conditions

---

## Quick Validation Checklist

Before considering Phase 2 complete:

```
✅ All 100+ tests passing
✅ No legacy gradient colors
✅ Form inputs stay white on hover
✅ All gem-tones used correctly
✅ Visual snapshots match design
✅ Accessibility maintained
✅ Performance acceptable
✅ Cross-browser consistent
✅ Responsive design works
✅ CI/CD integration complete
```

---

## Support & Documentation

- **Full Documentation**: `LUX_TEST_SUITE_SUMMARY.md`
- **Design Tokens**: `/src/styles/monochrome-lux-tokens.css`
- **Playwright Docs**: https://playwright.dev
- **Lux Phase 2 Report**: `/claudedocs/PHASE_2_COMPLETE.md`

---

Last Updated: 2025-10-03
Phase: 2 - Core Components
Status: Test Suite Complete ✅
