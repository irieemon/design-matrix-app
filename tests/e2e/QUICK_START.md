# E2E Test Suite Quick Start Guide

**Status**: ✅ Infrastructure validated and operational (Sept 30, 2025)

## ⚠️ Known Issues
Some validation error selectors in `auth-complete-journey.spec.ts` and `auth-security.spec.ts` need updating to match actual UI (`.text-error-700` → actual error classes). All other tests should run successfully. See `claudedocs/PHASE_6_E2E_VALIDATION_REPORT.md` for details.

## First Time Setup

```bash
# Install Playwright browsers (only needed once)
npm run playwright:install

# Generate initial visual baselines
npm run e2e:visual:update
```

## Running Tests

### Run Everything
```bash
npm run e2e:all
```

### Run Specific Suites
```bash
# Visual regression tests only
npm run e2e:visual

# Accessibility tests only
npm run e2e:accessibility
```

### Run by Browser
```bash
# Chrome only
npm run e2e:chromium

# Firefox only
npm run e2e:firefox

# Safari/WebKit only
npm run e2e:webkit

# Mobile devices
npm run e2e:mobile
```

## Debugging Tests

### Interactive UI Mode (Recommended)
```bash
npm run e2e:ui
```

### Step-by-Step Debugging
```bash
npm run e2e:debug
```

## View Test Results

```bash
# Open HTML report
npm run e2e:report
```

## Update Visual Baselines

After making intentional UI changes:

```bash
npm run e2e:visual:update
```

## Common Commands

| Command | Purpose |
|---------|---------|
| `npm run e2e:all` | Run all E2E tests |
| `npm run e2e:visual` | Visual regression tests |
| `npm run e2e:accessibility` | Accessibility tests |
| `npm run e2e:visual:update` | Update visual baselines |
| `npm run e2e:ui` | Interactive debugging |
| `npm run e2e:report` | View test report |

## Test Locations

- **Visual Tests**: `tests/e2e/visual-regression-comprehensive.spec.ts` (32 tests)
- **Accessibility Tests**: `tests/e2e/accessibility-comprehensive.spec.ts` (33 tests)
- **Screenshots**: `tests/e2e/__screenshots__/` (auto-generated)

## Understanding Test Results

### Visual Regression Results
- ✅ **Pass**: No visual changes detected
- ❌ **Fail**: Visual differences found (review screenshots in report)
- ⚠️ **Warning**: Minor differences within threshold

### Accessibility Results
- ✅ **Pass**: No WCAG violations
- ❌ **Fail**: WCAG violations detected (check console for details)
- 📊 **Details**: View axe-core report for specific issues

## When Tests Fail

### Visual Test Failed
1. Open test report: `npm run e2e:report`
2. Review screenshot differences
3. If changes are intentional: `npm run e2e:visual:update`
4. If changes are bugs: Fix the UI and re-run tests

### Accessibility Test Failed
1. Check console output for violation details
2. Review WCAG guidelines for the specific rule
3. Fix HTML/ARIA/CSS issues
4. Re-run tests to verify fix

## Getting Help

- **Full Documentation**: `tests/e2e/README.md`
- **Test Summary**: `tests/e2e/TEST_SUITE_SUMMARY.md`
- **Playwright Docs**: https://playwright.dev/
- **WCAG Guidelines**: https://www.w3.org/WAI/WCAG21/quickref/
